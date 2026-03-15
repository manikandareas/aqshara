# NestJS Monolith Plan

## Summary

Aqshara will be built as a single NestJS modular monolith.

Core stack:

- NestJS for the application runtime and module system.
- Clerk for authentication.
- Polar for billing and subscription workflows.
- S3 for document storage.
- PostgreSQL for primary persistence.
- Redis + BullMQ for background jobs, retries, and dead-letter handling.
- Drizzle for schema definitions, migrations, and typed table metadata.
- Raw SQL in repositories for non-trivial reads and writes.

This architecture keeps the product simple, preserves the existing API behavior, and avoids distributed-system complexity that is not needed yet.

## Recent Refactor Summary (2026-03-10)

- Billing API and webhook routing are now handled by one controller class, while execution logic is split by responsibility:
  - `BillingService` for plans/snapshot/checkout/portal use-cases.
  - `BillingWebhookService` for Polar webhook validation, idempotent processing, and event handling.
- Billing request/response DTO ownership was moved to `src/modules/billing/dto`, and billing schema classes in shared OpenAPI schema file were removed to avoid duplicated source-of-truth.
- Global `ValidationPipe` is enabled, and billing input validation now uses `class-validator` DTOs instead of manual payload checks in service methods.
- External provider implementations were moved to infrastructure modules:
  - Polar client/webhook verification in `infrastructure/payment-gateway/polar`.
  - Mistral OCR/translation in `infrastructure/ocr`.
- Reusable timeout logic was centralized in a shared utility (`withTimeout` + `TimeoutError`) to remove duplicated timeout wrappers.
- Billing webhook SQL has been moved fully into `BillingRepository` (transaction-aware methods), so service-layer code no longer executes raw SQL directly.
- Current contract status:
  - Public billing and webhook routes remain unchanged (`/api/v1/billing/*`, `/api/v1/webhooks/polar`).
  - Billing validation error messages follow default `ValidationPipe` behavior rather than the previous custom string messages.

## Design Principles

- Keep it simple: one application boundary, one deployment artifact, one codebase.
- Do not repeat yourself: shared auth, storage, database, and queue concerns live in dedicated infrastructure modules.
- Preserve the public API: the only contract change is the base path moving from `/v1` to `/api/v1`.
- Keep module ownership clear: each feature module owns its own tables, services, DTOs, and repository queries.
- Prefer SQL-first persistence: use Drizzle for schema and migrations, then write explicit SQL for real query logic.
- Use queues only for background work: BullMQ handles document processing and translation retry, not general module communication.

## Application Shape

The monolith is one NestJS app with these modules:

1. `AuthModule`

- Verifies Clerk bearer tokens.
- Resolves the current actor and auth context.
- Provides global guards for protected routes.

2. `DocumentsModule`

- Owns document upload, list/detail/delete, lifecycle state, and stage tracking.
- Owns `documents`, `stage_runs`, and `document_metadata`.
- Stores source files in S3 and enqueues processing jobs.

3. `PipelineModule`

- Owns BullMQ producers, processors, retries, and DLQ handling.
- Runs the asynchronous document pipeline and translation retry flows.
- Coordinates with document, reader, and billing services through Nest providers.

4. `ReaderModule`

- Owns outline, paragraphs, translations, glossary, concept map, warnings, and search.
- Owns `sections`, `paragraphs`, `paragraph_translations`, `terms`, `term_occurrences`, `map_nodes`, and `warnings`.
- Serves the reader-facing query endpoints.

5. `BillingModule`

- Owns plans, subscriptions, entitlements, usage accounting, checkout, portal, and Polar webhook handling.
- Owns `subscription_plans`, `billing_customers`, `subscriptions`, `usage_holds`, `usage_ledger`, `usage_counters`, and `billing_events`.

6. `EngagementModule`

- Owns feedback and reader interaction event ingestion.
- Owns `feedback` and `events`.

7. `StorageModule`

- Wraps S3 upload, retrieval, delete, and path generation.
- Keeps S3 details out of feature modules.

8. `DatabaseModule`

- Exposes the PostgreSQL connection, Drizzle schema, migrations, and repository helpers.
- Centralizes SQL execution, transaction helpers, and query conventions.

## Data and Integration Rules

- `document_metadata` is owned by `DocumentsModule`.
- Cross-module communication happens through injected services inside the monolith, not internal HTTP or gRPC APIs.
- Cross-module writes are allowed only through the owning module's service or repository layer.
- Background jobs must be idempotent and safe to retry.
- Polar webhook processing must be signature-verified and idempotent.
- S3 is the system of record for uploaded PDF binaries and generated file artifacts that should not live in PostgreSQL.
- PostgreSQL remains the system of record for workflow state, reader artifacts, billing state, and engagement data.

## Queue and Reliability Model

BullMQ queues replace the old service-boundary orchestration.

Primary queues:

- `document.process`
- `document.process.retry`
- `document.process.dlq`
- `translation.retry`
- `translation.retry.retry`
- `translation.retry.dlq`

Rules:

- Uploading a document creates the document record first, then enqueues processing.
- Translation retry endpoints enqueue retry jobs rather than doing work inline.
- Each processor writes progress back through owning modules, not through ad hoc SQL from the job handler.
- Retry and DLQ behavior stays explicit in the design, but within one application boundary.

## Deployment Shape

Phase 1 deployment is intentionally simple:

- one NestJS app deployment,
- one PostgreSQL instance,
- one Redis instance,
- one S3 bucket or bucket namespace,
- environment-based secrets for Clerk, Polar, PostgreSQL, Redis, and S3.

Recommended application endpoints:

- `/healthz`
- `/readyz`
- `/metrics`

Kubernetes can still be used for deployment, but it is no longer a service-splitting strategy. It is only an infrastructure choice around a single app.

## Delivery Phases

1. Foundation

- Create the NestJS application skeleton and module boundaries.
- Establish shared config, logging, error handling, and observability conventions.
- Set up Drizzle migrations, PostgreSQL connectivity, Redis, BullMQ, and S3 integration.

2. Public API Layer

- Implement the existing API surface under `/api/v1`.
- Add Clerk auth guards and request context handling.
- Keep DTOs and response shapes aligned with generated OpenAPI from `/docs-json`.

3. Document and Reader Flows

- Implement document upload, processing status, SSE, and reader queries.
- Persist reader artifacts through `ReaderModule`.
- Make queue processors update document and stage state through `DocumentsModule`.

4. Billing and Engagement

- Implement plans, checkout, portal, webhook handling, feedback, and analytics event ingestion.
- Keep Polar-specific logic isolated inside `BillingModule`.

5. Hardening

- Add DLQ operations, observability, idempotency checks, and end-to-end validation.
- Add performance tuning for search and reader-heavy queries.

## Test Plan

- Contract tests for all public routes under `/api/v1`.
- Auth tests for Clerk-protected routes and unauthenticated Polar webhook behavior.
- Repository tests for document, reader, billing, and engagement SQL paths.
- Queue processor tests for upload -> processing -> ready and translation retry -> success or DLQ.
- End-to-end tests for:
  - upload -> queue -> processing -> reader ready,
  - translation retry flow,
  - billing webhook -> state update -> billing read endpoints.

## Assumptions

- The only API contract change is the `/api` prefix, making the public base path `/api/v1`.
- The Polar webhook remains under the same public API namespace as `/api/v1/webhooks/polar`.
- Clerk is the only authentication provider in scope.
- BullMQ processors run as part of the monolith in this version.
