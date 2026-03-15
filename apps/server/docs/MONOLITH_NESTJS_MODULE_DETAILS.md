# NestJS Monolith Module Details

## Purpose

This document expands [`MONOLITH_NESTJS_PLAN.md`](./MONOLITH_NESTJS_PLAN.md) with implementation-level module details for the Aqshara NestJS modular monolith.

The target shape is one NestJS application with clear feature boundaries, shared infrastructure modules, and a SQL-first persistence approach.

## Global Architecture Rules

- Public API remains exposed from one NestJS app under `/api/v1`.
- Clerk auth is enforced at the application boundary with Nest guards.
- Polar webhook verification is handled inside `BillingModule` and is not protected by Clerk auth.
- Modules can call each other through injected application services, not through HTTP or gRPC.
- Cross-module writes must go through the owning module's service or repository layer.
- BullMQ job handlers must be idempotent and safe to retry.
- Use Drizzle for schema and migrations, raw SQL for non-trivial query logic.
- Keep module boundaries practical and simple; avoid extra abstractions unless they remove real duplication.

## Database Ownership Model

Table ownership in the monolith is logical rather than process-based.

### DocumentsModule

- `documents`
- `stage_runs`
- `document_metadata`

### ReaderModule

- `sections`
- `paragraphs`
- `paragraph_translations`
- `terms`
- `term_occurrences`
- `map_nodes`
- `warnings`

### BillingModule

- `subscription_plans`
- `billing_customers`
- `subscriptions`
- `usage_holds`
- `usage_ledger`
- `usage_counters`
- `billing_events`

### EngagementModule

- `events`
- `feedback`

Identity data comes from Clerk. If the application keeps a local profile table later, that table should be treated as auth-adjacent infrastructure rather than part of the document or billing domains.

## Module Specifications

## 1) AuthModule

### Goals

- Verify Clerk bearer tokens.
- Resolve actor identity and auth context.
- Provide reusable guards and request decorators.

### Owns

- Clerk integration code.
- Auth guard, current-user decorator, and auth context service.

### Interfaces

- Route guards for protected controllers.
- Helper for extracting the current Clerk user ID and session metadata.

### Non-goals

- Local password auth.
- Billing or entitlement logic.

## 2) DocumentsModule

### Goals

- Own document upload, list/detail/delete, lifecycle status, and stage progress.
- Persist document records and source metadata.
- Coordinate initial queue submission after upload.

### Owns

- `documents`
- `stage_runs`
- `document_metadata`
- Upload orchestration with `StorageModule`

### Public API Responsibility

- `GET /api/v1/documents`
- `POST /api/v1/documents`
- `GET /api/v1/documents/{document_id}`
- `DELETE /api/v1/documents/{document_id}`
- `GET /api/v1/documents/{document_id}/status`
- `GET /api/v1/documents/{document_id}/status/stream`

### Key Internal Responsibilities

- Validate document ownership against the authenticated Clerk actor.
- Create initial document state before queueing background work.
- Record stage transitions from `PipelineModule`.
- Expose document status snapshots for SSE and polling.

### Non-goals

- Parsing reader artifacts directly inside controllers.
- Calling Polar or billing providers.

## 3) PipelineModule

### Goals

- Execute the asynchronous document pipeline.
- Manage retries, DLQ behavior, translation retry, and background orchestration.
- Keep heavy processing out of the request path.

### Owns

- BullMQ queue registration and processors.
- Job payload schemas and retry policy.
- Processing orchestration logic.

### Queues

- `document.process`
- `document.process.retry`
- `document.process.dlq`
- `translation.retry`
- `translation.retry.retry`
- `translation.retry.dlq`

### Job Contracts

- `document.process`
  - payload: `document_id`, `actor_id`, `require_translate`, and trace metadata
  - behavior: load source file from S3, run extraction pipeline, update stage state, persist reader artifacts, finalize document status
- `translation.retry`
  - payload: `document_id`, `paragraph_id`, `actor_id`, and trace metadata
  - behavior: re-run translation for one paragraph and update translation status

### Module Dependencies

- Uses `DocumentsModule` services for state transitions.
- Uses `ReaderModule` services for clearing and upserting artifacts.
- Uses `StorageModule` for source file access.

### Non-goals

- Public HTTP endpoints.
- Direct SQL writes into another module's tables from processor code.

## 4) ReaderModule

### Goals

- Own all reader-facing query data and derived artifacts.
- Serve low-latency read endpoints for outline, paragraphs, search, glossary, map, and translations.

### Owns

- `sections`
- `paragraphs`
- `paragraph_translations`
- `terms`
- `term_occurrences`
- `map_nodes`
- `warnings`

### Public API Responsibility

- `GET /api/v1/documents/{document_id}/outline`
- `GET /api/v1/documents/{document_id}/paragraphs`
- `GET /api/v1/documents/{document_id}/paragraphs/{paragraph_id}`
- `GET /api/v1/documents/{document_id}/search`
- `GET /api/v1/documents/{document_id}/translations`
- `POST /api/v1/documents/{document_id}/translations/{paragraph_id}/retry`
- `GET /api/v1/documents/{document_id}/glossary`
- `GET /api/v1/documents/{document_id}/glossary/{term_id}`
- `GET /api/v1/documents/{document_id}/glossary/lookup`
- `GET /api/v1/documents/{document_id}/map`
- `GET /api/v1/documents/{document_id}/map/{node_id}`

### Key Internal Responsibilities

- Upsert reader artifacts during pipeline execution.
- Clear and rebuild reader artifacts when a document is reprocessed.
- Keep search, glossary, and translation queries SQL-driven and explicit.

### Non-goals

- Upload orchestration.
- Billing, checkout, or portal logic.

## 5) BillingModule

### Goals

- Own plans, subscriptions, entitlements, usage accounting, checkout, portal, and Polar webhook processing.
- Keep all Polar-specific logic isolated inside one module.

### Owns

- `subscription_plans`
- `billing_customers`
- `subscriptions`
- `usage_holds`
- `usage_ledger`
- `usage_counters`
- `billing_events`

### Public API Responsibility

- `GET /api/v1/billing/plans`
- `GET /api/v1/billing/me`
- `POST /api/v1/billing/checkout`
- `POST /api/v1/billing/portal`
- `POST /api/v1/webhooks/polar`

### Key Internal Responsibilities

- Map Clerk users to local billing customer records.
- Create Polar checkout and portal sessions.
- Verify and ingest Polar webhook events.
- Keep usage and entitlement updates idempotent.

### Non-goals

- Document parsing.
- Reader artifact generation.

## 6) EngagementModule

### Goals

- Capture user feedback and reader interaction events.
- Keep analytics ingestion separate from document and reader modules.

### Owns

- `feedback`
- `events`

### Public API Responsibility

- `POST /api/v1/documents/{document_id}/feedback`
- `POST /api/v1/events`

### Non-goals

- Event streaming infrastructure beyond storing accepted analytics events.

## 7) StorageModule

### Goals

- Encapsulate all S3 operations.
- Keep bucket naming, keys, and storage client configuration out of feature modules.

### Owns

- S3 client integration.
- Upload, fetch, delete, and signed URL helpers if needed later.

### Non-goals

- Database persistence.
- Queue orchestration.

## 8) DatabaseModule

### Goals

- Provide shared PostgreSQL access patterns without becoming a business-logic module.
- Keep migrations and SQL execution conventions centralized.

### Owns

- Drizzle schema files.
- Migration execution and migration conventions.
- Shared transaction helpers and query execution helpers.

### Query Conventions

- Trivial CRUD can use Drizzle query building when it stays clear.
- Complex reads and writes should use explicit SQL in repository files.
- Repositories stay feature-local; `DatabaseModule` provides primitives, not domain repositories.

## Public API Mapping

The public API contract is generated by Nest Swagger and served at `/docs-json`, with base path `/api/v1`.

Route groups:

- Documents: lifecycle, status, SSE
- Reader: outline, paragraphs, search, translations, glossary, map
- Billing: plans, billing snapshot, checkout, portal, Polar webhook
- Engagement: feedback and event ingestion

## Security and Access Control

- Use Clerk bearer tokens for all protected routes.
- Exempt only the Polar webhook from Clerk auth.
- Verify Polar webhook signatures before any state changes.
- Validate resource ownership on every document-scoped route.
- Keep S3, database, Redis, Clerk, and Polar secrets in environment-backed config.

## Observability Baseline

The application should emit:

- request counts, error counts, and latency histograms,
- queue lag, retry count, and DLQ count,
- structured logs with `request_id`, `user_id`, and `document_id` when available,
- health, readiness, and metrics endpoints.

Correlation IDs should flow from the HTTP request into queue jobs so document processing can be traced end to end.

## Testing Requirements

- Unit tests for module services, DTO validation, and guards.
- Repository tests for SQL-heavy document, reader, and billing queries.
- Queue processor tests for retry and DLQ behavior.
- Integration tests for S3, PostgreSQL, Redis, Clerk auth mocking, and Polar webhook verification.
- End-to-end tests for:
  - upload -> queue -> processing -> ready,
  - translation retry -> success or DLQ,
  - billing webhook -> billing snapshot update,
  - feedback and event ingestion.

## Defaults Locked for Build

- Public API base path is `/api/v1`.
- `document_metadata` belongs to `DocumentsModule`.
- The Polar webhook lives at `/api/v1/webhooks/polar`.
- No internal HTTP or gRPC layer exists inside the monolith.
- BullMQ processors run inside the same application architecture as the public API.
