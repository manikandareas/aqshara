# Sprint 3 Hardening Design

**Context:** This design covers the remaining backend-only Sprint 3 gaps after the DOCX export path was implemented and reviewed. It focuses on Epic 8 hardening work that is still launch-critical: production-safe rate limiting and machine-readable monitoring/error events without adding a third-party error-tracking SDK.

**Goal:** Make Sprint 3 backend hardening align with `docs/OPERATIONAL PLAN.md` by replacing single-process rate limiting with Redis-backed limits and by making auth, save, AI, export, and worker failures visible through structured internal monitoring events.

## Scope

In scope:
- Redis-backed rate limiting for API-sensitive routes.
- Structured error-event emission for launch-critical API and worker failures.
- Minimal configuration and tests needed to support those behaviors.

Out of scope:
- New third-party monitoring SDKs such as Sentry.
- Dashboard/UI work for ops visibility.
- Broader observability redesign outside launch-critical paths.

## Current Gaps

1. `apps/api/src/http/rate-limit-middleware.ts` stores counters in a process-local `Map`, which is not correct once the API is scaled horizontally or restarted.
2. `packages/observability/src/index.ts` supports structured logs and launch funnel events, but there is no stable error-event shape that downstream monitoring can rely on.
3. Launch-critical failures are logged inconsistently across API and worker paths, which makes Epic 8 acceptance harder to verify.

## Proposed Architecture

### 1. Shared Redis-backed rate limiting

Add a small Redis rate-limit helper that uses the existing Redis configuration already shared by BullMQ. The helper will:
- normalize requests into buckets by identity and route family,
- increment a counter with a one-minute expiry,
- return whether the request is allowed plus remaining metadata useful for logging.

The API middleware will keep the current route-specific policy decisions, but the storage backend moves from local memory to Redis. This keeps behavior familiar while making it safe across multiple API instances.

### 2. Structured internal error events

Extend `packages/observability` with a small helper dedicated to monitoring-style error events, for example:
- event type marker,
- domain such as `auth`, `document_save`, `ai`, `export`, `worker`,
- failure class such as `user` or `system`,
- stable error code,
- request/job identifiers,
- safe contextual fields.

This is intentionally separate from generic request logs. The goal is to make downstream log shipping and alerting deterministic without introducing a new external dependency.

Canonical event shape:

```json
{
  "type": "error_event",
  "ts": "2026-03-26T00:00:00.000Z",
  "domain": "export",
  "failureClass": "system",
  "code": "queue_unavailable",
  "requestId": "req_123",
  "jobId": "42",
  "exportId": "exp_123",
  "message": "Failed to enqueue export job"
}
```

Required fields:
- `type`
- `ts`
- `domain`
- `failureClass`
- `code`

Optional fields:
- `requestId`
- `jobId`
- `userId`
- `documentId`
- `exportId`
- `message`

### 3. Launch-critical emission points

Emit explicit error events in the narrow set of Sprint 3-critical paths:
- API auth/session failures,
- document save stale conflicts, permission denials, and persistence failures,
- AI service/provider failures,
- export request/retry/download failures,
- worker retry/final failure paths.

Existing `logLaunchEvent()` funnel events remain unchanged. The new error events complement them by answering "what failed?" while funnel events answer "what user transition happened?"

## Component Design

### `packages/config`

Expose a reusable Redis client for lightweight key/value operations so the API does not need to instantiate ad hoc clients inside middleware. This should stay small and align with the existing Redis connection shape used by BullMQ.
Use a singleton client/factory in the shared config package so middleware and queue code reuse the same environment contract instead of managing separate connection setup paths.

### `packages/observability`

Add one helper for error events and keep its output as a single JSON line. This keeps the package dependency-free and suitable for both API and worker use.

### `apps/api/src/http/rate-limit-middleware.ts`

Replace the module-global counter map with Redis-backed increments. Preserve current public behavior:
- same `429` payload shape,
- same path-based limits,
- same authenticated/IP split.

If Redis is unavailable:
- fail closed for high-risk launch-critical paths such as AI/export,
- fail open for lower-risk paths if needed,
- always emit an error event so the degradation is visible.

Fail-open / fail-closed policy:

| Route family | Behavior if Redis limiter is unavailable |
|---|---|
| `/v1/documents/*/exports/docx` | Fail closed |
| `/v1/exports/*/retry` | Fail closed |
| `/v1/documents/*/ai/*` | Fail closed |
| `/v1/documents/*/outline/*` | Fail closed |
| `/webhooks/*` IP limiter | Fail open, but emit error event |
| All other authenticated `/v1/*` routes | Fail open, but emit error event |

### `apps/api`

Use explicit error-event hooks in:
- global app error handler,
- sensitive service/route branches for AI/export,
- any save-path failures that are launch-critical.

The implementation should avoid noisy duplication: emit one structured monitoring event per actual failure path, not one per stack frame.

### `apps/worker`

Emit structured error events for retryable and terminal export failures with enough metadata to correlate with queue/job status:
- `exportId`,
- BullMQ job id,
- retry count / attempts,
- stable error code.

This should align with the worker failure strategy already added in the previous Sprint 3 review pass.
Queue monitoring for this slice is satisfied through BullMQ job state plus these structured worker retry/failure events; this design does not add a separate operator dashboard.
Retry policy is not being redesigned in this spec. The implementation should preserve the existing export queue policy already defined in code: bounded attempts with exponential backoff, and structured events for retry and terminal-failure boundaries.

## Data Flow

### Rate limiting

1. Request enters API middleware.
2. Middleware resolves identity bucket from authenticated user or IP.
3. Middleware increments Redis counter with TTL.
4. If over limit, middleware returns `429` and emits a structured rate-limit error event.
5. If allowed, request continues normally.

### Error monitoring

1. A launch-critical failure occurs in API or worker.
2. Code emits a structured error event with stable machine-readable fields.
3. Existing generic logs and launch events continue independently.
4. Log shippers/monitoring consumers can now build alerts from the dedicated error-event stream.

## Error Handling

- Monitoring helpers must never throw into the main request/job path.
- Redis failures in rate limiting must produce visible monitoring events.
- Error-event payloads must avoid secrets, request bodies, or large serialized objects.
- Prefer stable application error codes over raw provider/database messages.

## Testing Strategy

### API

- Add failing tests first for Redis-backed limiter behavior on repeated requests.
- Add tests for degraded behavior when Redis is unavailable on sensitive paths.
- Add tests for structured error-event emission on representative export/AI failure branches.

### Worker

- Add tests for worker failure-event emission on retryable and terminal export failures.

### Verification

- `pnpm --filter @aqshara/api test`
- `pnpm --filter @aqshara/worker test`
- `pnpm spec:generate` only if route contracts change
- verify this hardening slice during Sprint 3 launch checklist closeout

## Risks and Mitigations

- Redis availability becomes part of rate limiting correctness.
  - Mitigation: keep the helper small, observable, and explicit about degradation behavior.
- Error-event volume can get noisy.
  - Mitigation: emit only for launch-critical failure boundaries, not for every warning.
- Monitoring schema drift across API and worker.
  - Mitigation: centralize the helper in `packages/observability`.

## Acceptance Mapping

This design directly addresses Sprint 3 / Epic 8 expectations in `docs/OPERATIONAL PLAN.md`:
- API-sensitive routes get production-safe basic rate limiting.
- Error paths for auth, save, AI, and export are explicitly visible in monitoring logs.
- Queue/worker retry and terminal failures become easier to distinguish operationally.

| Operational requirement | Status in this design |
|---|---|
| Error penting pada auth, editor save, AI action, dan export tercatat di monitoring | Covered by structured `error_event` emission in API and worker |
| API sensitif dilindungi rate limiting dasar | Covered by Redis-backed limiter for sensitive API routes |
| Job queue menampilkan status retry dan terminal failure | Covered by existing BullMQ state plus structured worker retry/failure events |
| Tim dapat membedakan error user-side vs system-side pada jalur utama | Covered by required `failureClass` field |
| Launch analytics | Already handled separately by existing `logLaunchEvent()` flow; unchanged by this design |
| Launch checklist verification | Not implemented by code here; verified during Sprint 3 closeout |
