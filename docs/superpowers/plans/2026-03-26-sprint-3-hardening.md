# Sprint 3 Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the remaining backend-only Sprint 3 hardening work by adding Redis-backed API rate limiting and structured internal error-event coverage for launch-critical API and worker paths.

**Architecture:** Keep the existing backend shape and shared packages intact. Add a shared Redis client in config, move rate-limit state out of process memory into Redis, add a small `error_event` helper in observability, and wire explicit API/worker error events into Sprint 3-critical failure boundaries without adding third-party monitoring SDKs.

**Tech Stack:** Hono, BullMQ, Redis, shared workspace packages (`config`, `observability`), Node test runner, TypeScript.

---

### Task 1: Shared Redis Helpers

**Files:**
- Modify: `packages/config/src/index.ts`
- Test: `apps/api/src/http/rate-limit-middleware.test.ts`

- [ ] **Step 1: Write the failing test**

Add a test in `apps/api/src/http/rate-limit-middleware.test.ts` that expects the rate limiter to depend on a shared Redis-backed counter interface rather than module-global memory.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @aqshara/api test`
Expected: FAIL because the middleware still uses the in-process `Map`.

- [ ] **Step 3: Write minimal implementation**

Add a shared Redis client/factory in `packages/config/src/index.ts` that can be reused by the API middleware without changing existing BullMQ connection behavior.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @aqshara/api test`
Expected: The new middleware-focused test passes.

### Task 2: Redis-Backed Rate Limiting

**Files:**
- Modify: `apps/api/src/http/rate-limit-middleware.ts`
- Test: `apps/api/src/http/rate-limit-middleware.test.ts`

- [ ] **Step 1: Write the failing tests**

Add tests that verify:
- repeated requests are limited through a shared counter backend,
- sensitive routes fail closed when the Redis limiter backend is unavailable,
- lower-risk routes fail open when the Redis limiter backend is unavailable.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @aqshara/api test`
Expected: FAIL because the current implementation has only process-local counters and no degradation policy.

- [ ] **Step 3: Write minimal implementation**

Replace the module-global `Map` logic in `apps/api/src/http/rate-limit-middleware.ts` with Redis-backed increments, preserving current response payloads and route-specific limit buckets.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @aqshara/api test`
Expected: Middleware tests pass and existing API tests remain green.

### Task 3: Structured Error Event Helper

**Files:**
- Modify: `packages/observability/src/index.ts`
- Test: `apps/api/src/app.test.ts`

- [ ] **Step 1: Write the failing test**

Add a focused test that expects a stable machine-readable `error_event` log shape for launch-critical failures.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @aqshara/api test`
Expected: FAIL because there is no dedicated `error_event` helper yet.

- [ ] **Step 3: Write minimal implementation**

Add a helper in `packages/observability/src/index.ts` that emits a single-line JSON `error_event` with required fields and optional correlation metadata.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @aqshara/api test`
Expected: The new observability test passes.

### Task 4: API Error Event Coverage

**Files:**
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/routes/exports.ts`
- Modify: `apps/api/src/http/rate-limit-middleware.ts`
- Test: `apps/api/src/app.test.ts`

- [ ] **Step 1: Write the failing tests**

Add tests that expect structured `error_event` emission for:
- global unhandled API errors,
- export queue/rate-limit failures,
- launch-critical rate-limit degradation paths.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @aqshara/api test`
Expected: FAIL because these API paths do not yet emit the structured monitoring events.

- [ ] **Step 3: Write minimal implementation**

Wire `error_event` emission into the global app error handler and selected launch-critical API failure branches, avoiding duplicate emission for the same failure boundary.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @aqshara/api test`
Expected: Error-event tests pass and existing export/API tests remain green.

### Task 5: Worker Error Event Coverage

**Files:**
- Modify: `apps/worker/src/jobs/export-docx.ts`
- Modify: `apps/worker/src/index.ts`
- Test: `apps/worker/src/jobs/export-docx.test.ts`

- [ ] **Step 1: Write the failing tests**

Add tests that expect structured worker `error_event` emission for retryable and terminal export failures.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @aqshara/worker test`
Expected: FAIL because worker failure strategy does not yet emit the dedicated monitoring event shape.

- [ ] **Step 3: Write minimal implementation**

Emit structured `error_event` logs from worker failure boundaries while preserving existing retry/terminal-failure behavior and launch funnel events.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @aqshara/worker test`
Expected: Worker tests pass and existing render/export tests remain green.

### Task 6: Final Verification

**Files:**
- Verify only

- [ ] **Step 1: Run API verification**

Run: `pnpm --filter @aqshara/api test`
Expected: PASS

- [ ] **Step 2: Run worker verification**

Run: `pnpm --filter @aqshara/worker test`
Expected: PASS

- [ ] **Step 3: Check diagnostics**

Run: lints/diagnostics on edited files
Expected: no new diagnostics
