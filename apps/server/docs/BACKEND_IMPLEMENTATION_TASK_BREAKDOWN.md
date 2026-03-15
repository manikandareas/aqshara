# Backend Implementation Task Breakdown (NestJS Monolith)

## 1) Purpose

This document is the execution backlog for implementing the Aqshara NestJS backend as a modular monolith.

It is derived from:

- `docs/MONOLITH_NESTJS_PLAN.md`
- `docs/MONOLITH_NESTJS_MODULE_DETAILS.md`
- generated OpenAPI document at `/docs-json`

The goal is to keep implementation fast and extensible without overengineering.

## 2) Boundary Charter (V1 Minimal Guardrails)

These boundaries are mandatory for all implementation tasks and future features.

1. Keep it one application boundary.

- No internal HTTP/gRPC calls between modules.
- Modules communicate through Nest providers (service-to-service calls in-process).

2. Owner-writes-only for persistence.

- Only the owning module writes its tables.
- Cross-module changes must go through owner module services.

3. No premature abstractions.

- Do not introduce shared frameworks, base repositories, plugin systems, or generalized orchestration layers unless duplication has appeared in at least 2 real features.

4. Queue scope is background work only.

- BullMQ is used for async document and translation processing.
- Do not use queue jobs as a substitute for synchronous module request flow.

5. Preserve the public contract.

- Public API behavior is implemented from the generated OpenAPI contract at `/docs-json` under `/api/v1`.
- No additional public endpoints unless added to the contract intentionally.

6. Explicit non-goals per task.

- Every task must include out-of-scope notes to prevent scope creep.

## 3) Definition of Done (Global)

A task is complete only when all are true:

- Implementation matches task scope and stated module ownership.
- Required tests for the task pass.
- Logging/error handling follows app conventions.
- No boundary violations introduced.
- Task acceptance criteria in this document are satisfied.

## 4) Phase Backlog and Numbered Tasks

## 4.1) Current Progress Snapshot (Updated: 2026-03-10)

- Verification baseline:
  - `pnpm lint` passing.
  - `pnpm build` passing.
  - `pnpm test` passing.
  - `pnpm test:e2e` passing.

Phase A status:

- A1 App skeleton and module wiring: `[DONE]`
  - Module skeleton created for `Auth`, `Documents`, `Pipeline`, `Reader`, `Billing`, `Engagement`, `Storage`, `Database`.
  - `/api/v1/healthz`, `/api/v1/readyz`, `/api/v1/metrics` endpoints implemented.
- A2 Shared config, logging, and error envelope baseline: `[DONE]`
  - Global env validation, structured logging, correlation ID propagation, and global error envelope implemented.
- A3 Database module, Drizzle schema scaffolding, migration baseline: `[DONE]`
  - `DatabaseModule`, connection lifecycle, transaction helper, Drizzle config, and migration scripts are implemented.
  - Local validation complete with:
    - `pnpm db:generate`
    - `pnpm db:migrate`
  - Result observed: migration flow runs successfully against local PostgreSQL.
- A4 Redis and BullMQ infrastructure baseline: `[DONE]`
  - Queue naming contract, BullMQ producer primitives, and separate worker bootstrap are implemented.
  - Local runtime validation complete with:
    - `pnpm start:dev`
    - `pnpm start:worker`
  - Result observed: app and worker processes run successfully with local Redis.
- A5 Storage module (S3 abstraction): `[IN PROGRESS]`
  - S3-compatible storage service and key strategy implemented for Cloudflare R2.
  - Remaining to mark complete: integration validation for upload/retrieve/delete against configured R2 bucket.

Phase B status:

- B1 Clerk token verification and auth context: `[DONE]`
  - Implemented global Clerk auth guard using `@clerk/backend` (`authenticateRequest`) with request auth context attachment.
  - Added auth helpers/decorators for public-route marking and current auth extraction (`@Public`, `@CurrentUserId`, `@CurrentAuth`).
  - Added required env/config keys for Clerk runtime (`CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, optional `CLERK_JWT_KEY`, optional `CLERK_AUTHORIZED_PARTIES`).
- B2 Route protection policy and webhook exemption: `[DONE]`
  - Applied guard globally to `/api/v1` with explicit public exemptions for ops endpoints and `/api/v1/webhooks/polar`.
  - Added minimal `POST /api/v1/webhooks/polar` endpoint with signature verification via `@polar-sh/sdk/webhooks` and `403` on invalid signatures.
  - Follow-up billing webhook event processing is now completed in Phase F.

Phase C status:

- C1 Documents table repositories and ownership checks: `[DONE]`
  - Implemented `documents`, `stage_runs`, and `document_metadata` schema + migration, and repository SQL for create/list/detail/delete/status reads.
  - Ownership filtering enforced for all document-scoped reads/deletes.
- C2 `GET /documents`, `GET /documents/{document_id}`, `DELETE /documents/{document_id}`: `[DONE]`
  - Implemented list/detail/delete endpoints with pagination + optional status filter and ownership-aware not-found behavior.
  - Added dedicated e2e coverage for lifecycle endpoints and response envelopes.
- C3 `POST /documents` upload orchestration: `[DONE]`
  - Implemented multipart upload (`application/pdf`) with size validation via `DOCUMENT_UPLOAD_MAX_BYTES` (default `52428800`, 50MB).
  - Upload flow persists initial document + metadata state, stores source object, enqueues `document.process`, and compensates on enqueue failure.
- C4 `GET /documents/{document_id}/status` and SSE stream endpoint: `[DONE]`
  - Implemented status polling payload from document + stage data.
  - Implemented SSE stream endpoint with status event emission and support for bearer auth via `Authorization` header or `access_token` query parameter.

Phase D status:

- D1 Queue contract implementation: `[DONE]`
  - Registered and attached processors for:
    - `document.process`
    - `document.process.retry`
    - `document.process.dlq`
    - `translation.retry`
    - `translation.retry.retry`
    - `translation.retry.dlq`
  - Added payload validation and explicit retry->DLQ routing behavior in worker flow.
- D2 Document processing worker orchestration: `[DONE]`
  - Worker loads source PDF from storage, processes OCR through Mistral (`files.upload` + signed URL + OCR process), and persists raw OCR artifact.
  - Pipeline updates stage and terminal document status through owner services, with retry-safe behavior.
  - Reader artifact rebuild is invoked from pipeline orchestration before final `ready` transition.
- D3 Translation retry worker orchestration: `[DONE]`
  - Implemented translation retry job processing with Reader owner service state updates.
  - Added Mistral-based translation execution and error handling for retry/DLQ flows.
  - DLQ path marks translation rows as `error` consistently.

Phase E status:

- E1 Reader repositories and artifact lifecycle: `[DONE]`
  - Added Reader schema + migration for `sections`, `paragraphs`, `paragraph_translations`, `terms`, `term_occurrences`, `map_nodes`, and `warnings`.
  - Implemented transactional clear-and-rebuild persistence path and query SQL for reader endpoints.
- E2 Reader read endpoints: `[DONE]`
  - Implemented all planned Reader endpoints:
    - `GET /documents/{document_id}/outline`
    - `GET /documents/{document_id}/paragraphs`
    - `GET /documents/{document_id}/paragraphs/{paragraph_id}`
    - `GET /documents/{document_id}/search`
    - `GET /documents/{document_id}/translations`
    - `GET /documents/{document_id}/glossary`
    - `GET /documents/{document_id}/glossary/{term_id}`
    - `GET /documents/{document_id}/glossary/lookup`
    - `GET /documents/{document_id}/map`
    - `GET /documents/{document_id}/map/{node_id}`
  - Ownership and ready-state validation are enforced, including `422` behavior for non-ready documents.
- E3 Translation retry endpoint: `[DONE]`
  - Implemented `POST /documents/{document_id}/translations/{paragraph_id}/retry`.
  - Endpoint validates ownership/readiness, sets translation status to `pending`, and enqueues one retry job.
  - Accepted payload returns `202` with paragraph status.

Phase F status:

- F1 Billing repositories and state model: `[DONE]`
  - Added billing schema + migration for:
    - `subscription_plans`
    - `billing_customers`
    - `subscriptions`
    - `usage_holds`
    - `usage_ledger`
    - `usage_counters`
    - `billing_events`
  - Implemented Billing repository SQL for plan/snapshot reads and idempotent webhook event lifecycle.
- F2 Billing read and session endpoints: `[DONE]`
  - Implemented:
    - `GET /billing/plans`
    - `GET /billing/me`
    - `POST /billing/checkout`
    - `POST /billing/portal`
  - Added Polar SDK integration for checkout/portal session creation and mapped provider failures to `503`.
  - Added explicit billing request/response schemas in the generated OpenAPI contract (`/docs-json`).
- F3 Polar webhook handling: `[DONE]`
  - Extended `POST /webhooks/polar` from signature-only verification to verified + persisted processing flow.
  - Added idempotent event processing with event deduplication and billing state transitions.
  - Duplicate deliveries no longer duplicate side effects; accepted events return `202`.

Phase G status:

- G1 Engagement repositories: `[DONE]`
  - Added Engagement schema + migration for:
    - `feedback`
    - `events`
  - Implemented Engagement repository SQL for feedback creation and all-or-nothing event batch insertion.
  - Persisted actor/document references for both feedback and event records.
- G2 Engagement endpoints: `[DONE]`
  - Implemented:
    - `POST /documents/{document_id}/feedback`
    - `POST /events`
  - Added feedback validation rules (`type=rating` requires `rating` 1-5; `type=issue` requires `issue_type` and `description`) with ownership checks.
  - Added all-or-nothing event ingestion with payload validation, optional document ownership validation per event, and accepted-count response payload.
  - Added explicit engagement request validation constraints in the generated OpenAPI contract (`/docs-json`).

Additional verification updates:

- `pnpm db:migrate` executed successfully after Phase E migration generation.
- Full checks passing with Phase E changes:
  - `pnpm lint`
  - `pnpm build`
  - `pnpm test`
  - `pnpm test:e2e`
- `pnpm db:migrate` executed successfully after Phase F migration generation.
- Full checks passing with Phase F changes:
  - `pnpm lint`
  - `pnpm build`
  - `pnpm test`
  - `pnpm test:e2e`
- `pnpm db:migrate` executed successfully after Phase G migration generation.
- Full checks passing with Phase G changes:
  - `pnpm lint`
  - `pnpm build`
  - `pnpm test`
  - `pnpm test:e2e`

Phase H status:

- H1 Contract and module boundary tests: `[DONE]`
  - Added OpenAPI-driven contract parity suite and auth-policy checks.
  - Added boundary guardrail tests for cross-module repository access and owner-write policy.
- H2 Queue reliability and idempotency validation: `[DONE]`
  - Added Redis/BullMQ reliability integration tests for document + translation retry/DLQ routing.
  - Added duplicate-delivery idempotency test coverage for billing webhook processing.
- H3 Observability and operational runbook minimums: `[DONE]`
  - Added queue depth metrics integration (`queue_jobs_depth`) on `/api/v1/metrics`.
  - Added structured queue processing logs with request/job/document correlation fields.
  - Added operations runbook and replay helper scripts for DLQ and webhook replay workflows.

## Phase A: Foundation and Platform Baseline

### A1. App skeleton and module wiring

Goal:

- Create the NestJS app structure with modules: `Auth`, `Documents`, `Pipeline`, `Reader`, `Billing`, `Engagement`, `Storage`, `Database`.

In scope:

- Bootstrap app, shared config, module imports/exports.
- Add health/readiness/metrics endpoints.

Out of scope:

- Domain logic for routes.
- Queue processors and repository SQL.

Dependencies:

- None.

Acceptance criteria:

- App boots with all modules registered.
- `/healthz`, `/readyz`, `/metrics` endpoints exist.
- Module imports avoid circular dependencies.

### A2. Shared config, logging, and error envelope baseline

Goal:

- Establish consistent environment config and cross-cutting runtime behavior.

In scope:

- Config loading/validation for PostgreSQL, Redis, S3, Clerk, Polar.
- Global exception filter and response/error envelope consistency.
- Request-scoped correlation IDs and structured logs.

Out of scope:

- Feature-specific policy logic.

Dependencies:

- A1.

Acceptance criteria:

- Missing required env vars fail startup clearly.
- Runtime errors are emitted through standardized error structure.
- Request logs include correlation metadata.

### A3. Database module, Drizzle schema scaffolding, migration baseline

Goal:

- Make PostgreSQL access and migration flow production-ready.

In scope:

- Database connection lifecycle.
- Drizzle schema layout and migration commands.
- Transaction helper primitives.

Out of scope:

- Feature query logic.

Dependencies:

- A1, A2.

Acceptance criteria:

- App connects to PostgreSQL successfully.
- Initial migration mechanism runs in local/dev environments.
- Transaction helper is usable by feature repositories.

### A4. Redis and BullMQ infrastructure baseline

Goal:

- Establish queue infrastructure primitives.

In scope:

- Redis connection, BullMQ queue registration, retry and DLQ naming config.
- Queue observability hooks (job state metrics/logs).

Out of scope:

- Document or translation processor business logic.

Dependencies:

- A1, A2.

Acceptance criteria:

- Queues can be created and consumed by test worker.
- Retry and DLQ queue naming follows agreed contracts.

### A5. Storage module (S3 abstraction)

Goal:

- Provide file upload/fetch/delete primitives for document binaries and artifacts.

In scope:

- S3 client setup.
- Key generation and bucket namespace strategy.
- Upload, download, delete helpers.

Out of scope:

- Document lifecycle orchestration.

Dependencies:

- A1, A2.

Acceptance criteria:

- Storage service can upload and retrieve a test object.
- Delete operation is idempotent-safe for non-existent keys.

## Phase B: Auth and Security Boundary

### B1. Clerk token verification and auth context `[DONE]`

Goal:

- Enforce Clerk bearer auth for protected endpoints.

In scope:

- Clerk integration.
- Auth guard and current-user extraction decorators/utilities.

Out of scope:

- Billing entitlements and authorization policies beyond ownership checks.

Dependencies:

- A1, A2.

Acceptance criteria:

- Protected routes reject missing/invalid tokens with 401.
- Valid Clerk token resolves actor identity in request context.
  Status notes:
- Implemented with `@clerk/backend` `authenticateRequest`.
- Guard and auth context wiring are complete and validated by unit/e2e tests.

### B2. Route protection policy and webhook exemption `[DONE]`

Goal:

- Apply consistent auth rules across all route groups.

In scope:

- Guard application across `/api/v1` routes.
- Explicit exemption for `/api/v1/webhooks/polar`.

Out of scope:

- Polar event handling itself.

Dependencies:

- B1.

Acceptance criteria:

- All documented protected endpoints require bearer auth.
- Polar webhook route remains unguarded and reachable.
  Status notes:
- Global guard policy and explicit webhook exemption are in place.
- Minimal webhook endpoint exists and validates signatures; business event handling is deferred to Phase F.

## Phase C: Documents Module (Lifecycle APIs + Ownership)

### C1. Documents table repositories and ownership checks `[DONE]`

Goal:

- Implement repositories for `documents`, `stage_runs`, `document_metadata`.

In scope:

- SQL paths for create/list/detail/delete/status persistence.
- Ownership-based filtering by actor ID.

Out of scope:

- Reader artifact persistence.

Dependencies:

- A3, B1.

Acceptance criteria:

- CRUD/status query paths are implemented with transaction-safe operations where needed.
- Cross-user document access is rejected.
  Status notes:
- Repository SQL and ownership checks are implemented and validated through unit/e2e tests.
- Drizzle migration for `documents`, `stage_runs`, and `document_metadata` has been generated and applied.

### C2. `GET /documents`, `GET /documents/{document_id}`, `DELETE /documents/{document_id}` `[DONE]`

Goal:

- Deliver core lifecycle read/delete endpoints.

In scope:

- Pagination and optional status filtering for list endpoint.
- Detail and delete behavior aligned to contract.

Out of scope:

- Upload processing orchestration.

Dependencies:

- C1, B2.

Acceptance criteria:

- Contract tests pass for list/detail/delete responses and status codes.
- Delete path handles not-found and ownership correctly.
  Status notes:
- Endpoints are implemented and protected by ownership filtering.
- Dedicated e2e tests cover list/detail/delete contract behavior and unauthorized access.

### C3. `POST /documents` upload orchestration `[DONE]`

Goal:

- Upload PDF, create initial document records, enqueue processing.

In scope:

- Multipart file validation and size constraints.
- Persist initial document state and metadata.
- Store source file in S3 and enqueue `document.process`.

Out of scope:

- Actual extraction/reader generation logic.

Dependencies:

- C1, A5, A4, B2.

Acceptance criteria:

- Upload returns 202 with document payload.
- New record is in initial processing state and job is enqueued once.
- Failed upload flow does not leave inconsistent partial state.
  Status notes:
- Upload endpoint is implemented with PDF validation, size checks, initial state persistence, storage upload, and queue enqueue.
- Compensation logic removes partial state (DB + storage) when enqueue fails.

### C4. `GET /documents/{document_id}/status` and SSE stream endpoint `[DONE]`

Goal:

- Expose status polling and streaming state updates.

In scope:

- Status payload assembly from document and stage data.
- SSE endpoint with access token support as defined by contract.

Out of scope:

- Stage transition production logic.

Dependencies:

- C1, B2.

Acceptance criteria:

- Polling endpoint returns stage/status payload per contract.
- SSE endpoint emits events and handles unauthorized access correctly.
  Status notes:
- Status endpoint and SSE stream are implemented; SSE uses polling-based event emission for Phase C.
- SSE authentication accepts `Authorization` bearer token and `access_token` query token as defined by contract.

## Phase D: Pipeline Module (Async Processing, Retry, DLQ)

### D1. Queue contract implementation `[DONE]`

Goal:

- Register and implement queue contracts:
  - `document.process`
  - `document.process.retry`
  - `document.process.dlq`
  - `translation.retry`
  - `translation.retry.retry`
  - `translation.retry.dlq`

In scope:

- Payload validation and processor registration.
- Retry/backoff and DLQ routing setup.

Out of scope:

- Full reader artifact SQL details.

Dependencies:

- A4, C3.

Acceptance criteria:

- All queue names are created and processors attached.
- Retry and DLQ routing is observable and testable.

### D2. Document processing worker orchestration `[DONE]`

Goal:

- Process uploaded documents asynchronously and update lifecycle state.

In scope:

- Load source from S3.
- Run extraction pipeline integration points.
- Invoke owner services for stage and final state updates.

Out of scope:

- Direct SQL writes into non-owned module tables from worker handlers.

Dependencies:

- D1, C1, A5.

Acceptance criteria:

- Document transitions to terminal state (`ready` or `error`) through owner services.
- Worker is idempotent for retried jobs.

### D3. Translation retry worker orchestration `[DONE]`

Goal:

- Re-run translation for a single paragraph via queued job flow.

In scope:

- Process `translation.retry` jobs.
- Update translation status through Reader owner services.

Out of scope:

- Inline retry logic in HTTP controller.

Dependencies:

- D1, E1.

Acceptance criteria:

- Retried paragraph status is updated consistently.
- Failed retries route to retry/DLQ according to queue policy.

## Phase E: Reader Module (Artifact Persistence + Query APIs)

### E1. Reader repositories and artifact lifecycle `[DONE]`

Goal:

- Implement SQL for `sections`, `paragraphs`, `paragraph_translations`, `terms`, `term_occurrences`, `map_nodes`, `warnings`.

In scope:

- Upsert and clear/rebuild methods used by pipeline.
- Query methods for outline/paragraphs/search/translations/glossary/map endpoints.

Out of scope:

- Upload and billing logic.

Dependencies:

- A3, C1.

Acceptance criteria:

- Artifact clear-and-rebuild path is transactionally safe where required.
- Query methods support contract filters and pagination.

### E2. Reader read endpoints `[DONE]`

Goal:

- Implement:
  - `GET /documents/{document_id}/outline`
  - `GET /documents/{document_id}/paragraphs`
  - `GET /documents/{document_id}/paragraphs/{paragraph_id}`
  - `GET /documents/{document_id}/search`
  - `GET /documents/{document_id}/translations`
  - `GET /documents/{document_id}/glossary`
  - `GET /documents/{document_id}/glossary/{term_id}`
  - `GET /documents/{document_id}/glossary/lookup`
  - `GET /documents/{document_id}/map`
  - `GET /documents/{document_id}/map/{node_id}`

In scope:

- Controller + service + repository composition.
- Ownership and processed-state validation.

Out of scope:

- Translation retry enqueue route.

Dependencies:

- E1, B2.

Acceptance criteria:

- Contract tests pass for all listed reader endpoints.
- 404/422 behavior aligns with OpenAPI responses where defined.

### E3. Translation retry endpoint `[DONE]`

Goal:

- Implement `POST /documents/{document_id}/translations/{paragraph_id}/retry`.

In scope:

- Validate document/paragraph ownership and readiness for retry.
- Enqueue translation retry job and return accepted payload.

Out of scope:

- Translation execution inline in request path.

Dependencies:

- E1, D1, B2.

Acceptance criteria:

- Endpoint returns 202 and enqueues one job.
- Invalid ownership or missing resources return correct errors.

## Phase F: Billing Module (Polar + Subscription State)

### F1. Billing repositories and state model `[DONE]`

Goal:

- Implement persistence for:
  - `subscription_plans`
  - `billing_customers`
  - `subscriptions`
  - `usage_holds`
  - `usage_ledger`
  - `usage_counters`
  - `billing_events`

In scope:

- SQL for billing state retrieval and idempotent event persistence.

Out of scope:

- Reader/document domain writes.

Dependencies:

- A3, B1.

Acceptance criteria:

- Billing data model can represent active plan and usage state.
- Event ingestion supports idempotency keys.

### F2. Billing read and session endpoints `[DONE]`

Goal:

- Implement:
  - `GET /billing/plans`
  - `GET /billing/me`
  - `POST /billing/checkout`
  - `POST /billing/portal`

In scope:

- Polar session creation integration.
- Clerk user to billing customer mapping.

Out of scope:

- Webhook event ingestion flow.

Dependencies:

- F1, B2.

Acceptance criteria:

- Endpoints return contract-aligned status codes and payloads.
- Dependency failures return mapped service-unavailable errors where documented.

### F3. Polar webhook handling `[DONE]`

Goal:

- Implement `POST /webhooks/polar` with signature verification and idempotent updates.

In scope:

- Signature verification.
- Event deduplication/idempotent processing.
- Billing state transitions from accepted events.

Out of scope:

- Clerk authentication on webhook route.

Dependencies:

- F1, B2.

Acceptance criteria:

- Invalid signatures are rejected with 403.
- Duplicate webhook deliveries do not duplicate side effects.
- Accepted events return 202.

## Phase G: Engagement Module (Feedback + Events)

### G1. Engagement repositories `[DONE]`

Goal:

- Implement persistence for `feedback` and `events`.

In scope:

- SQL insert/query primitives for feedback and event ingestion.

Out of scope:

- Reader analytics pipelines beyond storage.

Dependencies:

- A3.

Acceptance criteria:

- Feedback and event writes are persisted with actor/document references.

### G2. Engagement endpoints `[DONE]`

Goal:

- Implement:
  - `POST /documents/{document_id}/feedback`
  - `POST /events`

In scope:

- Payload validation and ownership checks.
- Event batch acceptance accounting.

Out of scope:

- Real-time analytics processing.

Dependencies:

- G1, B2.

Acceptance criteria:

- Feedback endpoint returns 201 with created payload.
- Event ingestion returns accepted count payload and proper error handling.

## Phase H: Hardening, Reliability, and Verification

### H1. Contract and module boundary tests `[DONE]`

Goal:

- Ensure endpoint behavior and module boundaries remain enforceable.

In scope:

- Contract tests for all OpenAPI routes.
- Ownership/auth tests for protected routes and webhook exemption.
- Module-level boundary tests to prevent owner-write violations.

Out of scope:

- Load/perf benchmarking.

Dependencies:

- B2 through G2.

Acceptance criteria:

- Full contract test suite passes.
- Boundary policy tests catch illegal cross-module write attempts.

### H2. Queue reliability and idempotency validation `[DONE]`

Goal:

- Prove retry/DLQ and idempotency behavior in async flows.

In scope:

- Upload to processing success/error scenarios.
- Translation retry success/failure and DLQ routing scenarios.
- Webhook idempotency scenarios.

Out of scope:

- New queue types.

Dependencies:

- D2, D3, F3.

Acceptance criteria:

- End-to-end reliability scenarios pass in CI.
- Idempotent reprocessing does not corrupt state.

### H3. Observability and operational runbook minimums `[DONE]`

Goal:

- Make operations observable and supportable for V1.

In scope:

- Structured logs for request and queue correlation.
- Queue depth/failure metrics integration.
- Runbook notes for DLQ recovery and webhook replay.

Out of scope:

- Full SRE platform rollout.

Dependencies:

- H1, H2.

Acceptance criteria:

- Operators can identify failed jobs and replay path.
- Metrics and logs are sufficient to triage processing and billing incidents.

## 5) API-to-Task Traceability Matrix

| API Endpoint                                                             | Owner Module                   | Task IDs |
| ------------------------------------------------------------------------ | ------------------------------ | -------- |
| `GET /api/v1/documents`                                                  | Documents                      | C2       |
| `POST /api/v1/documents`                                                 | Documents + Pipeline + Storage | C3, D1   |
| `GET /api/v1/documents/{document_id}`                                    | Documents                      | C2       |
| `DELETE /api/v1/documents/{document_id}`                                 | Documents                      | C2       |
| `GET /api/v1/documents/{document_id}/status`                             | Documents                      | C4       |
| `GET /api/v1/documents/{document_id}/status/stream`                      | Documents                      | C4       |
| `GET /api/v1/documents/{document_id}/outline`                            | Reader                         | E2       |
| `GET /api/v1/documents/{document_id}/paragraphs`                         | Reader                         | E2       |
| `GET /api/v1/documents/{document_id}/paragraphs/{paragraph_id}`          | Reader                         | E2       |
| `GET /api/v1/documents/{document_id}/search`                             | Reader                         | E2       |
| `GET /api/v1/documents/{document_id}/translations`                       | Reader                         | E2       |
| `POST /api/v1/documents/{document_id}/translations/{paragraph_id}/retry` | Reader + Pipeline              | E3, D3   |
| `GET /api/v1/documents/{document_id}/glossary`                           | Reader                         | E2       |
| `GET /api/v1/documents/{document_id}/glossary/{term_id}`                 | Reader                         | E2       |
| `GET /api/v1/documents/{document_id}/glossary/lookup`                    | Reader                         | E2       |
| `GET /api/v1/documents/{document_id}/map`                                | Reader                         | E2       |
| `GET /api/v1/documents/{document_id}/map/{node_id}`                      | Reader                         | E2       |
| `GET /api/v1/billing/plans`                                              | Billing                        | F2       |
| `GET /api/v1/billing/me`                                                 | Billing                        | F2       |
| `POST /api/v1/billing/checkout`                                          | Billing                        | F2       |
| `POST /api/v1/billing/portal`                                            | Billing                        | F2       |
| `POST /api/v1/webhooks/polar`                                            | Billing                        | F3       |
| `POST /api/v1/documents/{document_id}/feedback`                          | Engagement                     | G2       |
| `POST /api/v1/events`                                                    | Engagement                     | G2       |

## 6) Table Ownership to Task Mapping

| Table Group                                                                                                                   | Owner Module | Task IDs   |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------ | ---------- |
| `documents`, `stage_runs`, `document_metadata`                                                                                | Documents    | C1, C3, C4 |
| `sections`, `paragraphs`, `paragraph_translations`, `terms`, `term_occurrences`, `map_nodes`, `warnings`                      | Reader       | E1, E2, E3 |
| `subscription_plans`, `billing_customers`, `subscriptions`, `usage_holds`, `usage_ledger`, `usage_counters`, `billing_events` | Billing      | F1, F2, F3 |
| `feedback`, `events`                                                                                                          | Engagement   | G1, G2     |

## 7) Queue Contract to Task Mapping

| Queue                     | Owner Module | Task IDs   |
| ------------------------- | ------------ | ---------- |
| `document.process`        | Pipeline     | D1, D2     |
| `document.process.retry`  | Pipeline     | D1, D2     |
| `document.process.dlq`    | Pipeline     | D1, D2, H2 |
| `translation.retry`       | Pipeline     | D1, D3     |
| `translation.retry.retry` | Pipeline     | D1, D3     |
| `translation.retry.dlq`   | Pipeline     | D1, D3, H2 |

## 8) Feature Continuation Protocol (How to Add Features Without Overengineering)

When adding a new backend feature after V1:

1. Assign one owner module first.

- If ownership is unclear, split the feature by bounded responsibility before coding.

2. Decide storage ownership.

- New table belongs to exactly one owner module.
- Other modules access via owner services, not direct writes.

3. Choose sync vs queue by one simple rule.

- Use synchronous service calls for request-time outcomes.
- Use queue only for long-running, retryable, or non-blocking background jobs.

4. Apply the abstraction threshold rule.

- If duplication is present in only one feature, keep implementation local.
- Introduce shared abstraction only when duplication is proven in 2 or more features.

5. Update this document before implementation.

- Add new task IDs in the correct phase (or append a new phase).
- Update API/table/queue traceability matrices.
- Add explicit out-of-scope notes for the new tasks.

6. Preserve contract discipline.

- If the feature changes public API, update controller/DTO Swagger metadata so `/docs-json` stays correct, then map endpoint to tasks.

## 9) Do Not Build Yet (Explicit Anti-Overengineering List)

- No plugin architecture.
- No internal service mesh or RPC layer inside the monolith.
- No generic base repository framework.
- No domain event bus abstraction beyond required BullMQ queues.
- No multi-service deployment decomposition in this phase.
- No speculative caching layer until real bottleneck evidence exists.

## 10) Initial Execution Sequence (Recommended)

1. A1-A5
2. B1-B2
3. C1-C4
4. E1-E3 and D1-D3 (in coordination)
5. F1-F3
6. G1-G2
7. H1-H3

This order keeps features shipping continuously while preserving boundary clarity.
