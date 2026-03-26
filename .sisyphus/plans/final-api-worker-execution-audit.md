# Final API/Worker Backend Execution Audit and Completion

## TL;DR

> **Summary**: Complete the remaining backend PRD scope by preserving the current Hono + BullMQ + Postgres architecture, hardening all production dependencies, and adding the missing retrieval + versioning capabilities without touching `apps/web`.
> **Deliverables**:
>
> - Remove runtime fake-provider behavior and add dependency-aware readiness
> - Finish free/pro backend enforcement and lightweight document snapshots
> - Make export delivery shared-storage-safe
> - Add source dedupe, cleanup, and stuck-job reconciliation
> - Implement per-file retrieval (chunking, embeddings, summary, deepagents-based Q&A, evidence)
> - Add dedicated agent-run persistence and API streaming for long-running Q&A
> - Add live-service staging smoke validation for API + Worker
>   **Effort**: XL
>   **Parallel**: YES - 3 waves
>   **Critical Path**: 6 → 7 → 8 → 9 → 10

## Context

### Original Request

Produce a final, comprehensive execution-and-audit plan for the Aqshara backend after Sprint 4, focused only on API and Worker services, with zero tolerance for placeholders, `// TODO`, or mock providers, and with all remaining backend PRD requirements completed against real services.

### Interview Summary

- Backend-only scope: `apps/api`, `apps/worker`, and backend shared packages only.
- Sprint 4 ingestion is treated as complete; the plan must also include unfinished Sprint 5 backend retrieval scope.
- Test strategy is **tests-after**.
- Completion requires **staging validation against live Postgres, Redis, object storage, OpenAI, Mistral OCR, and Clerk webhook delivery**.
- Retrieval remains **per-file only**; no cross-file research, no web implementation, no architecture rewrite.
- Q&A must run in a dedicated Worker-based agent using LangChain JS `deepagents` (current JS package name), not a synchronous API-only retrieval call.

### Metis Review (gaps addressed)

- Guard against scope creep into web UX, billing redesign, cross-file RAG, or broad platform rewrites.
- Make provider/readiness behavior explicit; no silent runtime fallbacks outside tests.
- Add executable acceptance criteria for retrieval contracts, free/pro enforcement, version snapshots, shared-storage export, ingestion reconciliation, and staging validation.
- Cover edge cases: duplicate uploads, retrieval-before-ready, OCR-noisy sources, worker crash between storage and DB updates, expired/missing export artifacts, replayed jobs, and stuck processing jobs.

## Work Objectives

### Core Objective

Bring the backend to PRD/Operational-Plan completeness by closing all remaining API/Worker gaps: production-safe provider behavior, free/pro enforcement, document snapshots, shared-storage export, ingestion reconciliation, and per-file retrieval with evidence plus a dedicated agentic Q&A worker.

### Deliverables

- Dependency-aware backend readiness and fail-fast provider policy
- `free` and `pro` backend plan enforcement with retrieval usage integrated into the existing AI quota ledger
- Lightweight immutable `document_versions` snapshots plus list endpoint
- Shared object-storage export artifacts with API download independent of worker local disk
- Workspace-checksum source dedupe, abandoned-upload cleanup, and stuck-job reconciliation
- Retrieval persistence (`source_chunks`, `source_summaries`, `source_query_runs`, `source_query_run_events`, `source_query_evidence`) with pgvector-backed per-file search
- Dedicated BullMQ Q&A agent worker using LangChain JS `deepagents`, Postgres-backed run state/checkpointing, and source-scoped tools
- Retrieval API routes for summary, query-run submit/status/stream, and evidence, plus OpenAPI/client regeneration
- Live-service smoke lane and staging validation commands

### Definition of Done (verifiable conditions with commands)

- `pnpm lint`
- `pnpm check-types`
- `pnpm test`
- `pnpm --filter @aqshara/api test`
- `pnpm --filter @aqshara/worker test`
- `pnpm spec:generate`
- `pnpm client:generate`
- `pnpm build`
- `pnpm smoke:backend-live`

### Must Have

- Real provider behavior in staging/production: no `FakeAiProvider` fallback outside tests.
- Retrieval limited to one selected source per request, with persisted evidence snippets and page/chunk provenance.
- Source Q&A runs only through a dedicated Worker agent with explicit run IDs, persisted progress events, and API-consumable streaming.
- Export artifacts stored in shared object storage and retrievable without shared filesystem assumptions.
- Snapshot creation is lightweight, immutable, and throttled; not per keystroke.
- Quota reserve/finalize/release remains atomic and idempotent for retrieval just as it already is for writing/export.
- Readiness and smoke validation explicitly fail when required live dependencies are unavailable.

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)

- No `apps/web` changes.
- No cross-file retrieval, citation automation, bibliography generation, or workspace-wide chat.
- No mock/fake provider paths in runtime code outside tests.
- No local-disk-only export delivery in staging/production.
- No placeholder content, TODO comments, temporary schema shortcuts, or silent degraded success paths.
- No broad refactor of existing auth/session/document/proposal systems beyond the exact gaps below.
- No deepagents filesystem/shell backends in production; use source-scoped retrieval tools only.

## Verification Strategy

> ZERO HUMAN INTERVENTION — all verification is agent-executed.

- Test decision: tests-after + existing `node:test` suites in API/Worker, expanded with new contract, repository, queue, and smoke coverage.
- QA policy: Every task includes executable package tests and one failure-path smoke/assertion.
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`

## Execution Strategy

### Parallel Execution Waves

> Target: 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Extract shared dependencies as Wave-1 tasks for max parallelism.

Wave 1: 1 provider/readiness hardening, 2 plan enforcement, 3 version snapshots, 4 shared export storage, 5 ingestion dedupe/reconciliation, 6 retrieval persistence/contracts

Wave 2: 7 retrieval indexing + deepagents worker pipeline, 8 async query-run API + SSE surface, 9 observability/rate-limit/reconciliation closeout

Wave 3: 10 live-service smoke lane and staging validation

### Dependency Matrix (full, all tasks)

- 1 blocks 8, 9, 10
- 2 blocks 8 and partially informs 10
- 3 independent after existing document save/apply flows are understood
- 4 blocks 9 and 10
- 5 blocks 9 and informs 10
- 6 blocks 7 and 8
- 7 blocks 8, 9, and 10
- 8 blocks 9 and 10
- 9 blocks 10
- 10 depends on 1, 2, 4, 5, 7, 8, 9

### Agent Dispatch Summary (wave → task count → categories)

- Wave 1 → 6 tasks → `unspecified-high`, `deep`, `bullmq-specialist`, `supabase-postgres-best-practices`, `hono`
- Wave 2 → 3 tasks → `deep`, `unspecified-high`, `hono`, `bullmq-specialist`
- Wave 3 → 1 task → `deep`, `verification-before-completion`, `agent-browser` only if Clerk webhook staging flow requires browser-based dashboard confirmation

## TODOs

> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [x] 1. Remove Runtime Fake Providers and Add Dependency-Aware Readiness

  **What to do**: Update `apps/api/src/lib/ai/factory.ts`, `apps/api/src/lib/app-context.ts`, and the system routes so that `FakeAiProvider` is available only in test harnesses (`apps/api/src/test-support/memory-app-context.ts`). In non-test environments, API startup/readiness must fail or expose route-level `503 dependency_unavailable` behavior when required dependencies for enabled features are missing. Add an explicit `/v1/system/readiness` route that checks Postgres, Redis, object storage, OpenAI, and optional Mistral OCR separately. Add exact package smoke scripts `pnpm --filter @aqshara/api smoke:readiness` and `pnpm --filter @aqshara/api smoke:providers` as the verification entrypoints for this contract. Treat OCR as optional fallback only: readiness may stay green if OCR is degraded, but the OCR-specific retry path must return a clear `503 ocr_unavailable` contract.
  **Must NOT do**: Do not remove fake providers from tests. Do not silently degrade AI writing/retrieval endpoints in staging/production. Do not add UI-facing work.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: cross-cutting API wiring, provider policy, and health contract changes.
  - Skills: [`hono`, `verification-before-completion`] — route contract discipline and final verification rigor.
  - Omitted: [`better-auth-best-practices`] — auth provider behavior is already implemented and not the target gap.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: [8, 9, 10] | Blocked By: []

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `apps/api/src/app.ts` — central route mounting, middleware order, and top-level error handling.
  - Pattern: `apps/api/src/routes/system.ts` — current health route registration pattern to extend with readiness.
  - Pattern: `apps/api/src/http/api-http.ts` — request helper and auth guard conventions.
  - Pattern: `apps/api/src/lib/ai/factory.ts` — current fake-provider fallback to remove from runtime paths.
  - Pattern: `apps/api/src/lib/ai/provider.ts` — keep test-only fake implementation, not runtime fallback.
  - Pattern: `apps/api/src/lib/app-context.ts` — production dependency wiring and service assembly.
  - Test: `apps/api/src/lib/ai/factory.test.ts` — provider selection coverage to expand.
  - Test: `apps/api/src/app.test.ts` — route-level integration test pattern for readiness and `503` contracts.
  - Test harness: `apps/api/src/test-support/memory-app-context.ts` — preserve fake provider usage here only.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Missing `OPENAI_API_KEY` in non-test mode causes readiness failure or deterministic `503 dependency_unavailable`; package tests pass with updated expectations.
  - [ ] OCR-disabled environments keep core readiness green while OCR retry requests fail with a structured `503 ocr_unavailable` error.
  - [ ] `pnpm --filter @aqshara/api test` passes and includes coverage for readiness and missing-provider behavior.

  **QA Scenarios** (MANDATORY — task incomplete without these):

  ```
  Scenario: Runtime dependencies healthy
    Tool: Bash
    Steps: run `pnpm --filter @aqshara/api test`; then run `pnpm --filter @aqshara/api smoke:readiness` against a fully configured local/staging API to assert `/v1/system/readiness` returns all required dependencies healthy.
    Expected: API test suite passes and readiness returns HTTP 200 with green statuses for Postgres, Redis, object storage, and OpenAI.
    Evidence: .sisyphus/evidence/task-1-provider-readiness.log

  Scenario: Missing OpenAI key in non-test mode
    Tool: Bash
    Steps: run `OPENAI_API_KEY= NODE_ENV=production pnpm --filter @aqshara/api smoke:providers`.
    Expected: command exits non-zero or returns HTTP 503 with `dependency_unavailable`; no fake provider output is returned.
    Evidence: .sisyphus/evidence/task-1-provider-readiness-error.log
  ```

  **Commit**: YES | Message: `fix(api): enforce runtime dependency readiness` | Files: `apps/api/src/lib/ai/factory.ts`, `apps/api/src/lib/app-context.ts`, `apps/api/src/routes/system.ts`, related tests/scripts

- [x] 2. Complete Free/Pro Backend Enforcement and Retrieval Quota Policy

  **What to do**: Extend the current plan model so backend runtime supports both `free` and `pro` in `apps/api/src/lib/plan-limits.ts`, `apps/api/src/lib/app-context.ts`, `apps/api/src/services/session-service.ts`, and `apps/api/src/repositories/postgres-app-repository.ts`. Preserve current `free` numeric caps exactly as already encoded. Add `pro` as **5x each existing free monthly cap** for AI actions, exports, source uploads, and storage bytes, while keeping the PRD beta ceiling of **5 active sources per document for both plans**. Retrieval summary and source-query usage must consume the existing AI quota ledger instead of introducing a new counter family.
  **Must NOT do**: Do not redesign billing/subscription flows. Do not add a separate retrieval-specific quota bucket. Do not change existing free-plan numbers.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: policy implementation spans limits, repository enforcement, and session payloads.
  - Skills: [`verification-before-completion`] — required to prove free/pro behavior deterministically.
  - Omitted: [`supabase-nextjs`] — no web work and no frontend billing scope.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: [8, 10] | Blocked By: []

  **References**:
  - Pattern: `apps/api/src/lib/plan-limits.ts` — current centralized limit map to extend.
  - Pattern: `apps/api/src/lib/app-context.ts` — current usage summary and plan lookup wiring.
  - Pattern: `apps/api/src/services/session-service.ts` — `/v1/me` payload shape for plan/usage exposure.
  - Pattern: `apps/api/src/repositories/postgres-app-repository.ts` — reservation/finalize/release logic to extend for plan branching.
  - Type: `apps/api/src/repositories/app-repository.types.ts` — repository contract for usage and quota methods.
  - Schema: `packages/database/src/schema.ts` — usage and monthly counters backing storage.
  - Pattern: `packages/database/src/export-job.ts` — existing usage increment style for export.
  - Pattern: `packages/database/src/source-job.ts` — existing usage increment style for sources.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `free` preserves current limits while `pro` is enforced as 5x the encoded free monthly caps with the same code path.
  - [ ] Source summary and source query reserve/finalize the existing AI quota ledger with no double-counting on retries.
  - [ ] `/v1/me` and any usage-specific read paths expose correct plan and remaining quota for both `free` and `pro` test fixtures.

  **QA Scenarios**:

  ```
  Scenario: Pro plan receives expanded limits
    Tool: Bash
    Steps: run `pnpm --filter @aqshara/api test` after adding repository/session tests for a seeded `pro` user and free user.
    Expected: tests prove `pro` receives 5x monthly caps while active source ceiling remains 5 for both plans.
    Evidence: .sisyphus/evidence/task-2-plan-enforcement.log

  Scenario: Retrieval retry does not double-charge AI quota
    Tool: Bash
    Steps: run the new API test covering repeated summary/query idempotency keys against the repository and service layers.
    Expected: usage counters increment once and reserved units are reconciled correctly after retry/replay.
    Evidence: .sisyphus/evidence/task-2-plan-enforcement-error.log
  ```

  **Commit**: YES | Message: `feat(api): complete free and pro plan enforcement` | Files: `apps/api/src/lib/plan-limits.ts`, `apps/api/src/lib/app-context.ts`, `apps/api/src/services/session-service.ts`, repository/tests

- [ ] 3. Add Lightweight Document Snapshots and Version Listing

  **What to do**: Implement immutable `document_versions` support in the backend using the existing document save/apply flows. Snapshot rows must store full `content_json` and `plain_text`; create the first snapshot on the first successful persisted content change and then only when **at least 5 minutes** have elapsed since the most recent snapshot for the document. Also create a snapshot before destructive content mutations triggered by AI proposal apply, outline apply, or template bootstrap if no snapshot exists within the last 5 minutes. Add `GET /v1/documents/:id/versions` and repository/service support for listing snapshots newest-first with pagination.
  **Must NOT do**: Do not snapshot per keystroke. Do not build restore/revert UX. Do not add diff storage.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: touches repository, services, schema, and route contract but stays bounded.
  - Skills: [`hono`, `verification-before-completion`] — route addition plus deterministic verification.
  - Omitted: [`code-simplifier`] — this is feature completion, not cleanup-first refactoring.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: [] | Blocked By: []

  **References**:
  - Pattern: `apps/api/src/routes/documents.ts` — document route registration and save/apply patterns.
  - Pattern: `apps/api/src/services/document-service.ts` — save/bootstrap/outline application flow boundaries.
  - Pattern: `apps/api/src/services/proposal-service.ts` — AI proposal apply/dismiss mutation path that may require pre-mutation snapshotting.
  - Type: `packages/documents/src/index.ts` — canonical document model to persist as snapshot content.
  - Schema: `docs/PRD.md` — `document_versions` recommended data model.
  - Test: `apps/api/src/app.test.ts` — route-level document lifecycle integration coverage pattern.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Successful document save/apply paths create a version when no version exists or the last version is older than 5 minutes.
  - [ ] `GET /v1/documents/:id/versions` returns newest-first immutable snapshots for the authenticated document owner.
  - [ ] `pnpm --filter @aqshara/api test` passes with coverage for save throttling and pre-destructive snapshot creation.

  **QA Scenarios**:

  ```
  Scenario: Snapshot created on milestone save
    Tool: Bash
    Steps: run `pnpm --filter @aqshara/api test` including the new document version route and service tests.
    Expected: tests show the first save creates version 1 and a second save within 5 minutes does not create an extra version.
    Evidence: .sisyphus/evidence/task-3-document-versions.log

  Scenario: Destructive apply without recent snapshot
    Tool: Bash
    Steps: run the new proposal/outline apply tests where no recent snapshot exists before the mutation.
    Expected: a snapshot is created before mutation and the route still returns success.
    Evidence: .sisyphus/evidence/task-3-document-versions-error.log
  ```

  **Commit**: YES | Message: `feat(api): add lightweight document snapshots` | Files: `apps/api/src/routes/documents.ts`, `apps/api/src/services/document-service.ts`, `apps/api/src/services/proposal-service.ts`, repository/schema/tests

- [x] 4. Make DOCX Export Delivery Shared-Storage-Safe

  **What to do**: Remove any production/staging assumption that API and Worker share local disk. Standardize export artifacts on `packages/storage/src/index.ts` so `apps/worker/src/jobs/export-docx.ts` always writes ready files through shared object storage and `apps/api/src/routes/exports.ts`/`apps/api/src/services/export-service.ts` serve downloads via presigned URL or storage-backed streaming. Keep local filesystem storage available only for development/test behind explicit storage-driver configuration; staging/production readiness must require remote shared storage. Add exact package smoke script `pnpm --filter @aqshara/api smoke:exports` for export-storage verification.
  **Must NOT do**: Do not proxy downloads through worker local paths. Do not leave mixed local/object-storage code paths in staging/production.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: cross-service storage correctness in split deployment is operationally critical.
  - Skills: [`bullmq-specialist`, `verification-before-completion`] — background job behavior plus durable verification.
  - Omitted: [`hono-api-scaffolder`] — existing routes already exist; this is hardening, not scaffolding.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: [9, 10] | Blocked By: []

  **References**:
  - Pattern: `apps/api/src/routes/exports.ts` — current export route contract, download, and retry semantics.
  - Pattern: `apps/api/src/services/export-service.ts` — export preflight, enqueue, and ready/download lifecycle.
  - Pattern: `apps/api/src/lib/export-queue.ts` — queue producer conventions.
  - Pattern: `apps/worker/src/jobs/export-docx.ts` — export worker execution and artifact finalization.
  - Pattern: `apps/worker/src/render-docx.ts` — DOCX renderer called by worker.
  - Pattern: `packages/storage/src/index.ts` — shared storage abstraction to make authoritative for exports.
  - Pattern: `packages/database/src/export-job.ts` — export state machine and usage update helpers.
  - Test: `apps/api/src/services/export-service.test.ts` — export service test style.
  - Test: `apps/worker/src/jobs/export-docx.test.ts` — worker export failure strategy coverage.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Ready export artifacts are stored and downloaded through shared storage only in staging/production modes.
  - [ ] Export retry and ready/download flows keep idempotent behavior and do not regress existing preflight or status semantics.
  - [ ] `pnpm --filter @aqshara/api test && pnpm --filter @aqshara/worker test` pass with new shared-storage assertions.

  **QA Scenarios**:

  ```
  Scenario: Export succeeds with shared storage
    Tool: Bash
    Steps: run API and worker package tests after adding split-deployment storage assertions.
    Expected: export tests confirm worker writes through storage abstraction and API retrieves without local filesystem coupling.
    Evidence: .sisyphus/evidence/task-4-export-storage.log

  Scenario: Missing remote storage in staging/production mode
    Tool: Bash
    Steps: run `NODE_ENV=production STORAGE_DRIVER=r2 pnpm --filter @aqshara/api smoke:exports` without object-storage credentials.
    Expected: readiness fails or export routes return structured `503 dependency_unavailable`; no local fallback masks the failure.
    Evidence: .sisyphus/evidence/task-4-export-storage-error.log
  ```

  **Commit**: YES | Message: `fix(export): use shared storage for docx delivery` | Files: `packages/storage/src/index.ts`, `apps/worker/src/jobs/export-docx.ts`, `apps/api/src/routes/exports.ts`, `apps/api/src/services/export-service.ts`, tests

- [ ] 5. Add Source Dedupe, Abandoned-Upload Cleanup, and Stuck-Job Reconciliation

  **What to do**: Strengthen `apps/api/src/services/source-service.ts`, `apps/api/src/repositories/postgres-app-repository.ts`, and `packages/database/src/source-job.ts` so the canonical dedupe identity is **`workspace_id + sha256 checksum`**. On source register, atomically reuse an existing `queued`, `processing`, or `ready` source with the same checksum instead of creating a duplicate. Failed rows must remain retryable in-place. Add cleanup for objects uploaded but never successfully registered within **30 minutes** and reconciliation that marks `processing` sources older than **30 minutes** as `failed` with `job_stuck_timeout` while preserving retry eligibility.
  **Must NOT do**: Do not dedupe across workspaces. Do not delete storage objects that are still linked to retryable source rows. Do not create duplicate usage events when a duplicate upload reuses an existing source.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: correctness depends on DB atomicity, storage cleanup, and queue state reconciliation.
  - Skills: [`bullmq-specialist`, `supabase-postgres-best-practices`, `verification-before-completion`] — queue semantics, atomic DB logic, and verification.
  - Omitted: [`hono`] — this task is primarily repository/service and maintenance logic.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: [9, 10] | Blocked By: []

  **References**:
  - Pattern: `apps/api/src/services/source-service.ts` — source register, retry, delete, and queue enqueue logic.
  - Pattern: `apps/api/src/repositories/postgres-app-repository.ts` — source persistence and quota logic to make atomic.
  - Type: `apps/api/src/repositories/app-repository.types.ts` — source repository contract.
  - Pattern: `packages/database/src/source-job.ts` — source state transitions and usage accounting.
  - Schema: `packages/database/src/schema.ts` — source and document-source-link persistence.
  - Pattern: `packages/storage/src/index.ts` — object deletion and presign behavior for abandoned uploads.
  - Test: `apps/api/src/services/source-service.test.ts` — source service test style.
  - Test: `apps/worker/src/jobs/source-parse.test.ts` — parse lifecycle behavior.
  - Test: `apps/worker/src/jobs/source-parse-failure-strategy.test.ts` — retry/terminal failure strategy pattern.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Duplicate uploads within the same workspace reuse an existing source row if checksum matches and status is `queued|processing|ready`.
  - [ ] Unregistered upload objects older than 30 minutes are deleted or marked for cleanup without corrupting linked rows.
  - [ ] Stuck `processing` sources older than 30 minutes are reconciled to `failed` with retry eligibility and structured error metadata.

  **QA Scenarios**:

  ```
  Scenario: Duplicate upload reuses existing source
    Tool: Bash
    Steps: run `pnpm --filter @aqshara/api test` after adding duplicate-register tests for the same checksum in one workspace.
    Expected: tests show a single source row/process path and no duplicate usage charge.
    Evidence: .sisyphus/evidence/task-5-source-reconcile.log

  Scenario: Stuck source is reconciled
    Tool: Bash
    Steps: run the new reconciliation test that seeds a stale `processing` source older than 30 minutes.
    Expected: status becomes `failed`, reason is `job_stuck_timeout`, and retry remains allowed.
    Evidence: .sisyphus/evidence/task-5-source-reconcile-error.log
  ```

  **Commit**: YES | Message: `fix(source): reconcile duplicate and stuck ingestion` | Files: `apps/api/src/services/source-service.ts`, `apps/api/src/repositories/postgres-app-repository.ts`, `packages/database/src/source-job.ts`, storage/tests

- [ ] 6. Add Retrieval Persistence, Agent-Run Contracts, and Queue Definitions

  **What to do**: Introduce the missing retrieval and agent-run data model in `packages/database/src/schema.ts` and `packages/queue/src/index.ts`. Add `source_chunks` with pgvector embedding storage plus page/chunk metadata, `source_summaries` for cached async summaries, `source_query_runs` for worker-backed Q&A runs, `source_query_run_events` for persisted stream/progress events, and `source_query_evidence` for per-answer evidence rows. Add queue definitions for `source_chunk`, `source_embed`, `source_summary`, and `source_query_agent`. Use OpenAI embeddings (`text-embedding-3-small`) and LangChain JS `deepagents` for the Q&A agent runtime; do not add a second LLM provider or a separate vector service. Keep all retrieval scoped to one `sourceId` per request. Persist agent checkpoints in Postgres keyed by `thread_id = runId`.
  **Must NOT do**: Do not introduce cross-file retrieval. Do not add a separate vector store service. Do not skip persistence for run status, events, evidence, or summary status.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: schema, queue contracts, vector persistence, and agent-run architecture decisions are foundational.
  - Skills: [`bullmq-specialist`, `supabase-postgres-best-practices`, `verification-before-completion`] — queue contract design, Postgres schema discipline, and final verification.
  - Omitted: [`langchain-architecture`] — retrieval must stay inside current backend patterns, not adopt a new orchestration layer.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: [7, 8] | Blocked By: []

  **References**:
  - Pattern: `packages/database/src/schema.ts` — current canonical backend schema location.
  - Pattern: `packages/queue/src/index.ts` — queue names and payload schemas.
  - Pattern: `apps/api/src/repositories/app-repository.types.ts` — repository contracts to extend for retrieval and run persistence.
  - Pattern: `apps/api/src/repositories/postgres-app-repository.ts` — concrete persistence layer to implement retrieval/run methods.
  - Pattern: `apps/api/src/lib/ai/types.ts` — AI contract conventions.
  - Pattern: `apps/api/src/lib/ai/service.ts` — OpenAI service wrapper to reuse for summaries and agent tools.
  - Schema guidance: `docs/PRD.md` — source chunk and retrieval architecture expectations.
  - Official: `https://docs.langchain.com/oss/javascript/deepagents/overview` — deepagents JS overview.
  - Official: `https://docs.langchain.com/oss/javascript/langgraph/persistence` — LangGraph persistence and thread/checkpoint expectations.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Database schema includes persisted chunk, summary, query-run, query-run-event, and evidence tables with migration support and pgvector-backed chunk embeddings.
  - [ ] Queue contract layer exposes `source_chunk`, `source_embed`, `source_summary`, and `source_query_agent` payloads with deterministic idempotency keys.
  - [ ] Repository contracts and tests cover create/update/list operations for chunk, summary, query-run, event, and evidence records.

  **QA Scenarios**:

  ```
  Scenario: Retrieval schema and agent-run contracts compile and pass
    Tool: Bash
    Steps: run `pnpm check-types` and `pnpm --filter @aqshara/api test` after adding retrieval repository coverage.
    Expected: types pass, migrations compile, and repository tests validate chunk/summary/query-run persistence.
    Evidence: .sisyphus/evidence/task-6-retrieval-contracts.log

  Scenario: Missing pgvector extension is detected in live validation path
    Tool: Bash
    Steps: run `pnpm smoke:backend-live -- --check=pgvector` against a Postgres instance without pgvector enabled.
    Expected: smoke fails fast with a clear extension/readiness error instead of silently degrading retrieval.
    Evidence: .sisyphus/evidence/task-6-retrieval-contracts-error.log
  ```

  **Commit**: YES | Message: `feat(database): add retrieval and agent run contracts` | Files: `packages/database/src/schema.ts`, `packages/queue/src/index.ts`, repository types/implementation, migrations/tests

- [ ] 7. Implement Retrieval Indexing and DeepAgents Worker Pipeline

  **What to do**: Extend `apps/worker/src/index.ts` and add retrieval job modules so the post-parse pipeline runs as: `source_parse` -> `source_chunk` -> `source_embed`; `source_summary` runs on demand when the summary endpoint is called and no ready cached summary exists; `source_query_agent` runs when the API submits a Q&A run. Chunking must preserve source page numbers, chunk indices, and character offsets from parsed text; embeddings are generated with OpenAI embeddings and written back to `source_chunks`; summary jobs write to `source_summaries` keyed by `summary:${sourceId}:${parseVersion}:${promptVersion}`. The Q&A agent must instantiate LangChain JS `createDeepAgent()` using the current JS `deepagents` package, with `thread_id = runId`, Postgres-backed checkpointing, no filesystem/shell backend, no cross-run memory, and only these source-scoped tools: `search_source_chunks`, `fetch_source_chunk_context`, and `get_source_metadata`. The final agent response must be validated against a typed schema: `{ resultType: 'answer' | 'insufficient_evidence', answerText: string, citedChunkIds: string[], confidence: 'low' | 'medium' | 'high', insufficiencyReason?: 'not_enough_evidence' }`. If `resultType='insufficient_evidence'`, persist a ready run with the fixed Indonesian answer text `Bukti dari file ini tidak cukup untuk menjawab pertanyaan secara andal.` and zero evidence rows. Retry behavior must mirror existing bounded retry patterns and classify provider timeouts/5xx as retryable, while invalid structured output, invalid evidence references, or hallucination-guard failures are terminal.
  **Must NOT do**: Do not execute summary generation synchronously in the API when no cached summary exists. Do not run OCR here; OCR remains a parse fallback only. Do not enable deepagents filesystem, shell, or broad task-planning tools in production.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: worker orchestration, deepagents integration, idempotency, and provider failure classification are central here.
  - Skills: [`bullmq-specialist`, `verification-before-completion`] — worker/job behavior and evidence-first verification.
  - Omitted: [`hono`] — no route surface here.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: [8, 9, 10] | Blocked By: [6]

  **References**:
  - Pattern: `apps/worker/src/index.ts` — worker registration and lifecycle wiring.
  - Pattern: `apps/worker/src/jobs/source-parse.ts` — existing job structure, bounded retry, and state transitions to mirror.
  - Pattern: `apps/worker/src/jobs/source-parse-failure-strategy.ts` — failure classification pattern.
  - Pattern: `apps/worker/src/jobs/source-parse-error-event.ts` — structured error event pattern.
  - Pattern: `apps/api/src/lib/ai/openai-provider.ts` — OpenAI provider wrapper to reuse for embeddings/chat.
  - Pattern: `apps/api/src/lib/ai/prompts.ts` — prompt-spec style to mirror for summary prompts.
  - Official: `https://docs.langchain.com/oss/javascript/deepagents/customization` — `createDeepAgent` configuration surface.
  - Official: `https://docs.langchain.com/oss/javascript/deepagents/backends` — backend constraints; avoid filesystem/shell in production.
  - Official: `https://docs.langchain.com/oss/javascript/langgraph/persistence` — thread/checkpoint persistence.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Parsed sources automatically enqueue chunking and embedding work and persist chunks with vector embeddings and provenance metadata.
  - [ ] Summary requests enqueue `source_summary` exactly once per `sourceId + parseVersion + promptVersion` cache key and persist ready/failed status.
  - [ ] Q&A runs enqueue `source_query_agent`, use `deepagents` with only the approved source-scoped tools, persist run events as the agent reasons/acts, and reject final answers that cite evidence outside retrieved chunks.
  - [ ] Insufficient-evidence outcomes are persisted as `ready` runs with the fixed Indonesian insufficiency message and no evidence rows.
  - [ ] `pnpm --filter @aqshara/worker test` passes with coverage for indexing happy path, agent timeout, malformed final output, hallucination guard failure, and job replay.

  **QA Scenarios**:

  ```
  Scenario: Parse completion fans out to chunk and embed jobs
    Tool: Bash
    Steps: run `pnpm --filter @aqshara/worker test` with the new retrieval pipeline suites.
    Expected: worker tests show chunk and embed jobs execute in order and persist chunk metadata + embeddings.
    Evidence: .sisyphus/evidence/task-7-retrieval-worker.log

  Scenario: Agent output fails hallucination guard
    Tool: Bash
    Steps: run the worker Q&A failure suite that simulates the agent citing chunk IDs not returned by the retrieval tools.
    Expected: run ends as terminal failure with a structured hallucination-guard error event and no ready answer is persisted.
    Evidence: .sisyphus/evidence/task-7-retrieval-worker-error.log
  ```

  **Commit**: YES | Message: `feat(worker): add deepagents retrieval pipeline jobs` | Files: `apps/worker/src/index.ts`, new retrieval job files, queue/tests

- [ ] 8. Add Async Query-Run API, SSE Streaming, and Evidence Contract

  **What to do**: Add a retrieval route module (for current API versioning, use `v1`) plus service/repository support for four operations: `POST /v1/retrieval/source-summary`, `POST /v1/retrieval/source-query/runs`, `GET /v1/retrieval/source-query/runs/:runId`, and `GET /v1/retrieval/source-query/runs/:runId/stream`. Keep `GET /v1/retrieval/source/:sourceId/evidence?runId=...` for persisted evidence. Summary route behavior stays async/cached: if a ready cached summary exists for the latest parse version + prompt version, return it immediately; otherwise reserve AI quota, enqueue `source_summary`, and return `202 queued|processing`. Query-run submit behavior: require source status `ready` plus chunk embeddings available, reserve AI quota, create a persisted run in `queued` state, enqueue `source_query_agent`, and return `202 accepted` with `runId`. Status route returns `queued|processing|ready|failed` plus final answer metadata when ready. Stream route exposes SSE from the API by reading persisted `source_query_run_events` and emitting ordered events until terminal status. SSE event names are fixed to: `run.created`, `run.processing`, `agent.thought`, `tool.start`, `tool.end`, `answer.ready`, `run.completed`, and `run.failed`. Evidence endpoint returns the persisted evidence rows for a `runId`, including `pageNumber`, `chunkIndex`, `score`, and a **220-character** excerpt.
  **Must NOT do**: Do not accept multiple source IDs. Do not answer queries synchronously in the API. Do not answer queries when the source is not retrieval-ready. Do not return unpersisted evidence only in-memory.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: combines async route design, service logic, quota, SSE, and persistence contracts.
  - Skills: [`hono`, `verification-before-completion`] — route/OpenAPI discipline and deterministic verification.
  - Omitted: [`ai-sdk`] — backend already uses its own provider wrapper and should stay consistent.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: [9, 10] | Blocked By: [1, 2, 6, 7]

  **References**:
  - Pattern: `apps/api/src/routes/sources.ts` — source route/OpenAPI style and status contract patterns.
  - Pattern: `apps/api/src/routes/exports.ts` — async status/download route pattern to mirror for run submission/status.
  - Pattern: `apps/api/src/routes/proposals.ts` — POST action route structure with auth + OpenAPI.
  - Pattern: `apps/api/src/services/writing-service.ts` — AI quota reserve/finalize lifecycle to mirror for retrieval.
  - Pattern: `apps/api/src/services/source-service.ts` — source readiness and document-link checks.
  - Pattern: `apps/api/src/lib/ai/prompts.ts` — action-specific prompt style to extend with summary/query prompts.
  - Pattern: `apps/api/src/lib/error-events.ts` — structured API error emission for new retrieval errors.
  - Official: `https://reference.langchain.com/javascript/langchain-langgraph-sdk/client/RunsClient` — reference model for run status/join semantics.
  - Official: `https://docs.langchain.com/langsmith/streaming.md` — streaming modes and late-join caveat to mirror in API docs.
  - Contract output: `apps/api/openapi/openapi.json` and `packages/api-client` — regenerate in same task.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Summary route returns cached-ready content when present, otherwise deterministic `202` queued/processing plus source/summary status payload.
  - [ ] Query-run submit route returns `202 accepted` with one persisted `runId`, and retries with the same idempotency key do not create duplicate runs or double-charge.
  - [ ] Query-run status route returns terminal answer metadata only when the worker has persisted a ready result.
  - [ ] Query-run stream route emits only the fixed SSE event names from persisted `source_query_run_events` and closes on terminal status.
  - [ ] Evidence route returns the persisted evidence set for a run with page number, chunk index, score, and excerpt.
  - [ ] `pnpm --filter @aqshara/api test && pnpm spec:generate && pnpm client:generate` pass.

  **QA Scenarios**:

  ```
  Scenario: Ready source submits async run and streams progress
    Tool: Bash
    Steps: run API package tests, then regenerate OpenAPI and client artifacts.
    Expected: retrieval tests pass, and generated spec/client include summary, run submit/status/stream, and evidence routes/schemas.
    Evidence: .sisyphus/evidence/task-8-retrieval-api.log

  Scenario: Query against source without retrieval-ready chunks
    Tool: Bash
    Steps: run the new API failure-path tests where parse is ready but chunk/embed pipeline is incomplete.
    Expected: submit route returns structured `409 source_not_ready_for_query`, no run is enqueued, and no AI quota is finalized.
    Evidence: .sisyphus/evidence/task-8-retrieval-api-error.log
  ```

  **Commit**: YES | Message: `feat(api): add async source query run endpoints` | Files: new retrieval routes/services, prompts, repository methods, `apps/api/openapi/openapi.json`, `packages/api-client`, tests

- [ ] 9. Close Observability, Rate Limiting, and Reconciliation Gaps for New Backend Flows

  **What to do**: Extend structured monitoring across the new and hardened flows. Add retrieval-specific `launch_event` and `error_event` emission in the API and worker layers; ensure provider-readiness failures, retrieval summary/query-run failures, export delivery failures, source reconciliation events, and hallucination-guard failures are all classed as user-side vs system-side consistently. Extend `apps/api/src/http/rate-limit-middleware.ts` family buckets to cover retrieval summary/query-run submission and SSE stream routes, plus any new readiness/smoke-sensitive endpoints. Add worker-startup reconciliation for stale `processing` source/export rows and stale `queued|processing` query runs so deploy/restart does not leave indefinite states.
  **Must NOT do**: Do not introduce a new monitoring platform. Do not create noisy high-cardinality logs with raw prompts or full source text.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: cross-cutting operational hardening across API, worker, and observability packages.
  - Skills: [`bullmq-specialist`, `verification-before-completion`] — queue restart semantics and evidence-driven closeout.
  - Omitted: [`audit`] — the task is implementation hardening, not only a design audit.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: [10] | Blocked By: [1, 4, 5, 7, 8]

  **References**:
  - Pattern: `packages/observability/src/index.ts` — event/logging primitives.
  - Pattern: `apps/api/src/lib/error-events.ts` — API structured error emission and `failureClass` mapping.
  - Pattern: `apps/api/src/http/rate-limit-middleware.ts` — route-family bucket behavior and fail-open/fail-closed policy.
  - Pattern: `apps/worker/src/index.ts` — worker startup/shutdown and lifecycle logging.
  - Pattern: `apps/worker/src/jobs/export-docx-error-event.ts` — worker error event structure.
  - Pattern: `apps/worker/src/jobs/source-parse-error-event.ts` — source worker error event structure.
  - Pattern: `apps/api/src/app.ts` — request logging and route registration for new retrieval modules.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Retrieval summary/query-run flows emit structured launch and error events with correct `failureClass` separation.
  - [ ] Retrieval submit + stream routes are rate-limited with explicit route-family behavior consistent with existing sensitive endpoints.
  - [ ] Worker startup reconciliation converts stale `processing` source/export rows and stale query runs to retryable failed states according to policy.

  **QA Scenarios**:

  ```
  Scenario: Retrieval agent failures emit structured events
    Tool: Bash
    Steps: run API and worker package tests that simulate retrieval provider failure, hallucination-guard rejection, stale export recovery, and duplicate source reconciliation.
    Expected: tests assert the correct event names, failure classes, and retryable/terminal classification.
    Evidence: .sisyphus/evidence/task-9-observability.log

  Scenario: Retrieval rate limiting blocks abuse safely
    Tool: Bash
    Steps: run the new rate-limit suite against retrieval routes using repeated authenticated/IP requests.
    Expected: route returns the configured rate-limit response and does not crash or bypass quota accounting.
    Evidence: .sisyphus/evidence/task-9-observability-error.log
  ```

  **Commit**: YES | Message: `chore(api-worker): harden retrieval observability and reconciliation` | Files: `packages/observability/src/index.ts`, `apps/api/src/http/rate-limit-middleware.ts`, `apps/api/src/lib/error-events.ts`, `apps/worker/src/index.ts`, tests

- [ ] 10. Add Live-Service Smoke Lane and Run Mandatory Staging Validation

  **What to do**: Add a root/backend smoke command (`pnpm smoke:backend-live`) that validates the full live dependency path against staging: Postgres reachable with pgvector enabled, Redis reachable, shared object storage writable/readable, OpenAI chat + embeddings reachable, LangChain JS `deepagents` worker runtime operational, Mistral OCR reachable for OCR-specific flows, and Clerk webhook delivery verified. The root command must support `--check=pgvector`, `--mode=happy`, and `--mode=dependency-failure`, and it may orchestrate the package-level smoke commands added earlier (`smoke:readiness`, `smoke:providers`, `smoke:exports`). The smoke lane must exercise: readiness, one source upload/register, parse -> chunk/embed pipeline completion, one summary request, one source query-run submission, streamed progress reception from `/stream`, one final grounded answer with evidence, one DOCX export request/download, and one failure-path check with a disabled dependency. Persist evidence logs under `.sisyphus/evidence/` and treat any missing dependency or stuck state as release-blocking.
  **Must NOT do**: Do not treat local-only tests as sufficient for completion. Do not mark the plan complete without a captured staging smoke artifact.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: final integration gate spans every backend subsystem and real credentials.
  - Skills: [`verification-before-completion`, `bullmq-specialist`] — release-grade verification and queue-aware debugging if staging fails.
  - Omitted: [`agent-browser`] — only use if Clerk dashboard/webhook configuration truly requires browser automation; prefer CLI/webhook inspection first.

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: [] | Blocked By: [1, 2, 4, 5, 7, 8, 9]

  **References**:
  - Pattern: `apps/api/src/routes/system.ts` — readiness route to exercise first.
  - Pattern: `apps/api/src/routes/sources.ts` — live upload/register/status/retry/delete flow.
  - Pattern: `apps/api/src/routes/exports.ts` — live export request/status/download flow.
  - Pattern: new retrieval run routes added in Task 8 — live query-run submit/status/stream flow.
  - Pattern: `apps/worker/src/index.ts` — worker processing lifecycle to monitor during smoke.
  - Pattern: `packages/storage/src/index.ts` — shared storage behavior to verify.
  - Pattern: `packages/queue/src/index.ts` — queue names for smoke assertions.
  - Pattern: `apps/api/src/lib/ai/openai-provider.ts` — chat + embedding provider to verify live.
  - Pattern: `apps/worker/src/lib/mistral-ocr.ts` — OCR provider path for fallback smoke.
  - Pattern: `apps/api/src/routes/webhooks.ts` — Clerk webhook delivery contract.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `pnpm smoke:backend-live` passes in staging and produces evidence for readiness, retrieval run streaming, export, and one explicit failure-path check.
  - [ ] Smoke proves pgvector, Redis, object storage, OpenAI, deepagents runtime wiring, and Clerk are all live; Mistral OCR is proven for OCR-only path or explicitly reported unavailable with a blocked OCR retry route.
  - [ ] The staging evidence captures status transitions for source parse/chunk/embed, summary, query-run events, final evidence, and export download.

  **QA Scenarios**:

  ```
  Scenario: Full staging happy path
    Tool: Bash
    Steps: run `pnpm smoke:backend-live -- --mode=happy` against staging with real credentials and capture all generated logs/artifacts.
    Expected: readiness passes, source ingestion completes, summary returns or queues correctly, query-run streaming emits progress events, grounded answer + evidence persist, and export download succeeds.
    Evidence: .sisyphus/evidence/task-10-backend-live.log

  Scenario: Disabled dependency blocks the correct path
    Tool: Bash
    Steps: run `pnpm smoke:backend-live -- --mode=dependency-failure` in a safe staging sandbox with one required dependency intentionally disabled.
    Expected: readiness or the targeted route fails with the expected structured dependency error, and no silent fallback masks the outage.
    Evidence: .sisyphus/evidence/task-10-backend-live-error.log
  ```

  **Commit**: YES | Message: `test(backend): add live staging smoke validation` | Files: root/package scripts, smoke utilities, API/worker support code, evidence docs if needed

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.

- [ ] F1. Plan Compliance Audit — oracle
- [ ] F2. Code Quality Review — unspecified-high
- [ ] F3. Real Manual QA — unspecified-high (+ playwright if UI)
- [ ] F4. Scope Fidelity Check — deep

## Commit Strategy

- Commit at the end of each numbered task; no cross-task mega commits.
- Use conventional commits scoped to the backend area touched (`api`, `worker`, `database`, `queue`, `storage`).
- Preserve generated artifacts (`openapi.json`, `@aqshara/api-client`) in the same commit as the route/contract changes that require them.

## Success Criteria

- Backend has no runtime fake-provider execution path outside tests.
- Backend supports `free` and `pro` plan codes with deterministic quota enforcement and retrieval counted against AI usage.
- `document_versions` snapshots are created and listable without per-keystroke churn.
- Export works in split API/Worker deployment using shared object storage only.
- Duplicate source uploads do not cause duplicate processing or quota drift.
- Per-file summary plus deepagents-based Q&A/evidence run APIs work against parsed sources with persisted provenance and streamed run progress.
- Staging live smoke validates real dependencies end to end.
