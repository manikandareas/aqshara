# Sprint 2 API/Worker Foundation

## TL;DR

> **Summary**: Deliver the backend half of Sprint 2 by aligning the canonical document model with PlateJS/Slate JSON, then adding code-owned onboarding/template foundations, synchronous AI outline/writing proposal endpoints, and atomic quota/idempotency behavior in `apps/api` while keeping `apps/worker` out of interactive AI.
> **Deliverables**:
>
> - PlateJS/Slate-compatible backend contracts for templates, outline drafts, and AI change proposals
> - quota reservation/idempotency foundations over existing usage tables
> - onboarding/bootstrap read path and template-driven document creation routes
> - synchronous outline generation and writing-assistant proposal/apply routes
> - OpenAPI/client regeneration and backend regression coverage
>   **Effort**: Large
>   **Parallel**: YES - 4 waves
>   **Critical Path**: 1 → 2 → 3 → 7 → 8 → 9 → 10

## Context

### Original Request

Make a plan to implement Sprint 2 from `docs/OPERATIONAL PLAN.md`.

### Interview Summary

- Scope was narrowed during planning to **API/worker only**; `apps/web` implementation is explicitly out of scope.
- Sprint 2 backend scope covers support for onboarding/template flow, outline generation, AI writing assistant, and usage/quota foundation.
- Execution order preference is onboarding/template foundation first, then AI surfaces, with tests-after as the sprint posture.
- AI execution mode is locked to synchronous request/response in `apps/api`; no interactive BullMQ flow in Sprint 2.
- Onboarding visibility is derived from zero-document state; the backend must expose enough data for that model without persisting onboarding-completion state.
- Editor choice is PlateJS, so backend document storage and proposal contracts must align to Slate JSON and Plate-managed node IDs rather than Tiptap-specific assumptions.

### Metis Review (gaps addressed)

- Lock backend boundaries: `packages/documents` owns shared contracts only, `apps/api` owns orchestration/persistence/quota, and `apps/worker` remains unchanged unless a concrete backend requirement appears.
- Treat current `usage_events` and `monthly_usage_counters` as incomplete foundations, not finished quota enforcement.
- Explicitly decide stale-base and idempotency behavior for AI generation/apply endpoints before defining routes.
- Prevent scope creep into frontend onboarding UX, export infrastructure, OCR/research pipelines, background AI jobs, or full version history.
- Include concrete failure contracts for duplicate requests, quota exhaustion, stale proposal apply, provider failure, and zero-document onboarding derivation.

## Work Objectives

### Core Objective

Provide a decision-complete backend Sprint 2 foundation so a later web implementation can consume stable API contracts for onboarding/templates, outline generation, AI writing proposals, and quota enforcement without reopening architecture decisions.

### Deliverables

- Extended canonical document-domain package with PlateJS/Slate-compatible value contracts, Plate-managed node IDs, template builders, `OutlineDraft`, and `DocumentChangeProposal` contracts.
- Database and repository support for quota reservation, usage idempotency, and persisted AI proposals.
- `/v1/me` bootstrap read-path enhancements for zero-document onboarding and plan/usage surfaces.
- Template catalog and template/bootstrap document creation endpoints.
- Synchronous outline generation and writing-assistant proposal/apply/dismiss endpoints with explicit stale-base behavior.
- Regenerated OpenAPI/client artifacts and backend regression coverage.

### Definition of Done (verifiable conditions with commands)

- `pnpm --filter @aqshara/api test` passes with coverage for template bootstrap, outline generation contracts, proposal generation/apply/dismiss, duplicate idempotency replay, quota exceeded, provider failure accounting, and stale-base rejection.
- `pnpm --filter @aqshara/api check-types` and `pnpm --filter @aqshara/documents check-types` pass after shared contract changes.
- `pnpm spec:generate && pnpm client:generate` pass and capture the new Sprint 2 API surfaces without drift.
- `pnpm lint && pnpm check-types && pnpm test && pnpm build` pass from the repo root.
- `git diff --name-only -- apps/worker packages/queue` shows no Sprint 2 interactive-AI changes outside explicitly documented non-regression edits.

### Must Have

- PlateJS/Slate JSON becomes the canonical persisted document shape before any backend AI proposal/apply flow is introduced.
- Plate-managed node IDs must be preserved in persisted content and used for block targeting; backend logic must not assume path stability or backend-generated IDs.
- Templates are code-owned, global, and generated from `packages/documents`; no DB-backed template CMS in Sprint 2.
- Outline generation uses an intermediate `OutlineDraft` contract that can be edited before insertion.
- Writing assistant uses persisted `DocumentChangeProposal` records; AI never mutates a document during generation.
- Quota enforcement uses reserve → finalize/release semantics plus idempotency keys for provider-backed actions.
- `replace` and `insert_below` apply modes validate document freshness against a base revision and fail deterministically if stale.
- `/v1/me` remains the plan/usage read path and is extended rather than replaced.

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)

- Must NOT add `apps/web` implementation tasks to this plan.
- Must NOT move interactive AI flows into `apps/worker` or add new BullMQ queues for Sprint 2.
- Must NOT introduce chat threads, export work, research-beta retrieval, OCR, or source-upload features.
- Must NOT introduce arbitrary character-range editing semantics; Sprint 2 AI is limited to whole-block targets and block insertion using stable block IDs.
- Must NOT let AI generation endpoints write directly to `documents.content_json`.
- Must NOT assume Markdown or plain-text serialization is lossless enough to replace persisted source-of-truth storage; persistence stays PlateJS/Slate JSON.
- Must NOT create a generalized billing platform; plan limits stay code-owned for `free` in Sprint 2.
- Must NOT add a new shared package unless at least two backend consumers need it immediately.

## Verification Strategy

> ZERO HUMAN INTERVENTION — all verification is agent-executed.

- Test decision: tests-after at sprint level, with contract-first micro-cycles inside each task; backend uses `node:test`, shared packages use package test/typecheck commands.
- QA policy: Every task includes executable API or command-level scenarios with concrete payloads and expected JSON/error codes.
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`

## Execution Strategy

### Parallel Execution Waves

> Target: 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Extract shared dependencies as Wave-1 tasks for max parallelism.

Wave 1: backend domain + persistence foundations

- Task 1: extend canonical document-domain contracts
- Task 2: add database quota/proposal foundations
- Task 3: extend repository/context services for reservations, proposals, and bootstrap metadata

Wave 2: API scaffolding surfaces

- Task 4: add synchronous AI provider/prompt layer
- Task 5: extend `/v1/me` bootstrap read path
- Task 6: add template catalog and bootstrap document-creation routes

Wave 3: AI endpoints and apply lifecycle

- Task 7: add outline generation and insert routes
- Task 8: add writing-assistant proposal generation routes
- Task 9: add proposal apply/dismiss routes with final usage accounting

Wave 4: contract regeneration and backend closeout

- Task 10: regenerate specs/clients and add full backend regression + worker-boundary verification

### Dependency Matrix (full, all tasks)

| Task                                   | Depends On             | Blocks            |
| -------------------------------------- | ---------------------- | ----------------- |
| 1. Document-domain contracts           | none                   | 3, 6, 7, 8, 9, 10 |
| 2. DB quota/proposal foundations       | none                   | 3, 7, 8, 9, 10    |
| 3. Repository/context extensions       | 1, 2                   | 5, 6, 7, 8, 9, 10 |
| 4. AI provider/prompt layer            | 1                      | 7, 8              |
| 5. `/v1/me` bootstrap read path        | 3                      | 10                |
| 6. Template catalog + bootstrap create | 1, 3                   | 10                |
| 7. Outline generation + insert         | 1, 2, 3, 4             | 10                |
| 8. Writing proposal generation         | 1, 2, 3, 4             | 9, 10             |
| 9. Proposal apply/dismiss              | 1, 2, 3, 8             | 10                |
| 10. Spec/client + regression closeout  | 1, 2, 3, 5, 6, 7, 8, 9 | F1-F4             |
| F1-F4 Final verification               | 10                     | completion        |

### Agent Dispatch Summary (wave → task count → categories)

- Wave 1 → 3 tasks → `deep`, `unspecified-high`
- Wave 2 → 3 tasks → `unspecified-high`
- Wave 3 → 3 tasks → `deep`, `unspecified-high`
- Wave 4 → 1 task → `unspecified-high`
- Final Verification → 4 tasks → `oracle`, `unspecified-high`, `deep`

## TODOs

> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [x] 1. Replace the minimal canonical document model with PlateJS-compatible backend contracts

  **What to do**: Refactor `packages/documents/src/index.ts` so the canonical persisted document model becomes PlateJS/Slate-compatible JSON instead of the current hand-rolled `{ version, nodes }` shape. Model root value as a Slate element array, preserve Plate-managed node IDs in persisted blocks, and keep Sprint 2 backend transforms limited to heading/paragraph/list structures that can be produced by templates, outlines, and AI proposals without inventing a separate editor model. Introduce additive exported types/helpers for `TemplateCode`, template builders, `OutlineDraft`, `DocumentChangeProposal`, and deterministic transforms that operate on Slate JSON (`createTemplateDocument`, `outlineDraftToDocumentValue`, `applyDocumentChangeProposal`). Lock Sprint 2 AI to whole-block targeting via Plate node IDs; do not encode path-based assumptions or arbitrary character-range editing semantics. Update backend consumers that import `DocumentAst` or `toPlainText` so they use the new canonical type from `packages/documents`.
  **Must NOT do**: Do not keep the current custom AST as a parallel source of truth. Do not add inline formatting scope beyond what Plate JSON already represents. Do not move prompt/orchestration logic into `packages/documents`. Do not add template storage to the database.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: this is the architectural lock for every later backend task.
  - Skills: `[]` — existing repo/domain patterns are enough.
  - Omitted: `['frontend-design']` — web/editor UI is outside this scope.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 3, 6, 7, 8, 9, 10 | Blocked By: none

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `packages/documents/src/index.ts:1-29` — current canonical document model is intentionally minimal and must be replaced, not duplicated.
  - Pattern: `apps/api/src/app.ts:50-81` — OpenAPI currently mirrors the old custom AST shape and will need coordinated replacement.
  - Pattern: `apps/api/src/lib/app-context.ts:76-87` — `AppDocument` already treats `contentJson` as canonical persisted state.
  - Pattern: `docs/OPERATIONAL PLAN.md:272-304` — Sprint 2 still depends on one canonical document model shared across editor/AI/export.
  - Pattern: `docs/OPERATIONAL PLAN.md:317-340` — onboarding/template flow requires valid heading hierarchy insertion.
  - Pattern: `docs/OPERATIONAL PLAN.md:354-389` — AI actions must preview before apply and use action-specific prompt behavior.
  - External: `https://platejs.org/docs/editor` — Plate content is Slate JSON and node IDs are editor-managed/configurable.
  - External: `https://platejs.org/docs/markdown` — Markdown serialization can include block IDs for AI tracking but should not replace persisted JSON.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `pnpm --filter @aqshara/documents test` exits 0 with contract tests covering template builders, `OutlineDraft` → Slate JSON conversion, and `applyDocumentChangeProposal` for `replace` and `insert_below` modes.
  - [ ] `pnpm --filter @aqshara/documents check-types` exits 0 after replacing the custom AST with PlateJS-compatible value types and exported helpers.
  - [ ] `pnpm --filter @aqshara/api check-types` exits 0 after API imports are updated for the new canonical document type.

  **QA Scenarios** (MANDATORY — task incomplete without these):

  ```
  Scenario: Template builder yields valid PlateJS-compatible document value
    Tool: Bash
    Steps: Run `pnpm --filter @aqshara/documents test`; inspect the test that builds the `proposal` template and converts it to plain text.
    Expected: Test passes and confirms the returned value is Slate JSON, top-level blocks preserve Plate node IDs, the first block is a heading, and `toPlainText` returns deterministic section text.
    Evidence: .sisyphus/evidence/task-1-document-contracts.txt

  Scenario: Proposal apply respects block-level operations only
    Tool: Bash
    Steps: Run `pnpm --filter @aqshara/documents test`; inspect the test that applies a `rewrite` proposal against contiguous target block IDs and rejects an invalid target set.
    Expected: Valid block replacement passes; invalid/non-contiguous targets fail with a deterministic thrown error or assertion.
    Evidence: .sisyphus/evidence/task-1-document-contracts-error.txt
  ```

  **Commit**: YES | Message: `feat(documents): add sprint 2 backend contracts` | Files: `packages/documents/src/index.ts`, `packages/documents/src/*.test.ts`, optional package script/config files only if required

- [x] 2. Add database foundations for quota reservation and persisted AI proposals

  **What to do**: Extend `packages/database/src/schema.ts` and corresponding migrations so Sprint 2 backend accounting becomes safe under concurrency and retries. Keep `usage_events` as the canonical usage ledger, but add the fields needed for AI generation lifecycle tracking: billing period, feature key, status (`reserved`, `succeeded`, `released`, `failed`), idempotency key, request hash, and completion/release timestamps. Add a unique `(user_id, period)` constraint to `monthly_usage_counters`, add `ai_actions_reserved`, and create a new `document_change_proposals` table that stores persisted preview proposals (`proposal_json`, `action_type`, `status`, `document_id`, `user_id`, `base_updated_at`, `target_block_ids`, timestamps). Default plan limits stay code-owned; the database change is only for safe accounting and proposal persistence.
  **Must NOT do**: Do not introduce billing/subscription tables, generalized payment models, or worker job tables. Do not create a separate template table. Do not add source-upload/export schema in this Sprint 2 plan.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: schema choices here determine whether retries and quota enforcement are correct or brittle.
  - Skills: `[]` — existing Drizzle patterns suffice.
  - Omitted: `['supabase-postgres-best-practices']` — useful but not necessary for the bounded schema work here.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 3, 7, 8, 9, 10 | Blocked By: none

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `packages/database/src/schema.ts:50-81` — existing `usage_events`, `monthly_usage_counters`, and `exports` tables are the current persistence baseline.
  - Pattern: `apps/api/src/lib/app-context.ts:93-98` — current usage contract is too shallow for reserved-vs-used semantics.
  - Pattern: `apps/api/src/lib/app-context.ts:676-688` — usage is currently code-stubbed and must be backed by DB state after this task.
  - Pattern: `docs/OPERATIONAL PLAN.md:404-429` — Sprint 2 quota must support atomic check/reserve and explicit failure policy.
  - Pattern: `docs/OPERATIONAL PLAN.md:648-659` — quota clarity and rate-limit behavior are Sprint 2 QA focus areas.
  - External: `https://upstash.com/docs/oss/sdks/ts/ratelimit/methods` — reserve/check must happen before provider execution, even if final implementation stays DB-first.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `pnpm db:generate` exits 0 and produces migration artifacts for proposal persistence, unique monthly counters, and reserved AI-action tracking.
  - [ ] `pnpm --filter @aqshara/database check-types` exits 0 after schema additions.
  - [ ] `pnpm --filter @aqshara/api test` exits 0 with at least one concurrency/idempotency-oriented test using the new schema semantics via repository/service coverage.

  **QA Scenarios** (MANDATORY — task incomplete without these):

  ```
  Scenario: Reserved quota cannot exceed plan limit under duplicate retries
    Tool: Bash
    Steps: Run `pnpm --filter @aqshara/api test`; inspect the quota test that submits two requests with the same `idempotencyKey` and one with a different key at the plan boundary.
    Expected: The replayed key reuses the original reservation without incrementing counters; the extra distinct request is rejected once remaining quota reaches zero.
    Evidence: .sisyphus/evidence/task-2-quota-schema.txt

  Scenario: Persisted proposal rows support lifecycle transitions
    Tool: Bash
    Steps: Run `pnpm --filter @aqshara/api test`; inspect the proposal persistence test that creates a proposal row, marks it applied or dismissed, and verifies terminal timestamps/status.
    Expected: Proposal status transitions are one-way and terminal rows retain the original `baseUpdatedAt` and `targetBlockIds` metadata.
    Evidence: .sisyphus/evidence/task-2-quota-schema-error.txt
  ```

  **Commit**: YES | Message: `feat(database): add quota and proposal persistence` | Files: `packages/database/src/schema.ts`, `packages/database/drizzle/*`, optional DB tests if present

- [x] 3. Extend repository and app-context services for bootstrap, reservations, and proposal lifecycle

  **What to do**: Refactor `apps/api/src/lib/app-context.ts` so the app layer exposes explicit backend services instead of today’s stubbed `getUsage()` shortcut. Add repository methods for counting active/archived documents, reserving/finalizing/releasing AI actions, creating/reading/updating `document_change_proposals`, creating documents from templates, and invalidating stale proposals. Keep route handlers thin by moving period calculation, request-hash comparison, duplicate-idempotency replay, and plan-limit math into repository/service helpers. Update the in-memory test harness in `apps/api/src/test-support/memory-app-context.ts` so tests mirror the new semantics exactly, including reserved counters and proposal status transitions.
  **Must NOT do**: Do not leak SQL or plan-limit logic into route handlers. Do not keep the old hardcoded `getUsage()` numbers after this task. Do not make app-context depend on web-specific onboarding state.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: substantial but bounded refactor of existing app-context/repository seams.
  - Skills: `[]` — repo patterns already exist in app-context and memory fixtures.
  - Omitted: `['hono']` — this task is mostly repository/context, not route design.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 5, 6, 7, 8, 9, 10 | Blocked By: 1, 2

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `apps/api/src/lib/app-context.ts:16-168` — current core types and `AppContext`/`AppRepository` seams to extend.
  - Pattern: `apps/api/src/lib/app-context.ts:459-690` — current Postgres repository methods and hardcoded usage behavior.
  - Pattern: `apps/api/src/test-support/memory-app-context.ts:25-291` — in-memory repository must stay behaviorally aligned with production repository logic.
  - Pattern: `apps/api/src/app.ts:521-592` — `requireAppUser()` already defines the canonical authenticated bootstrap envelope for route handlers.
  - Pattern: `docs/OPERATIONAL PLAN.md:817-825` — AI preview is mandatory and must not be reopened during execution.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `pnpm --filter @aqshara/api test` exits 0 with repository-level coverage for document counts, reservation/finalize/release, duplicate idempotency replay, and proposal invalidation on stale base revisions.
  - [ ] `pnpm --filter @aqshara/api check-types` exits 0 after `AppContext` and `AppRepository` signatures change.
  - [ ] No route handler retains hardcoded usage numbers: `rg "aiActionsRemaining: 10" apps/api/src` returns no application logic match outside intentionally updated tests/fixtures.

  **QA Scenarios** (MANDATORY — task incomplete without these):

  ```
  Scenario: App-context usage summary reflects reserved and used AI credits
    Tool: Bash
    Steps: Run `pnpm --filter @aqshara/api test`; inspect the repository/service test that reserves one AI action, finalizes it, and reads the usage summary for the same user.
    Expected: Remaining decreases only once, `aiActionsReserved` returns to zero after finalization, and the reported period matches `YYYY-MM`.
    Evidence: .sisyphus/evidence/task-3-app-context.txt

  Scenario: Stale proposal invalidation is deterministic
    Tool: Bash
    Steps: Run `pnpm --filter @aqshara/api test`; inspect the test that creates a pending proposal at document revision N, saves document revision N+1, then attempts to apply the old proposal.
    Expected: Apply fails with the stale-proposal error contract and the proposal transitions from `pending` to `invalidated` exactly once.
    Evidence: .sisyphus/evidence/task-3-app-context-error.txt
  ```

  **Commit**: YES | Message: `refactor(api): extend sprint 2 repository services` | Files: `apps/api/src/lib/app-context.ts`, `apps/api/src/test-support/memory-app-context.ts`, related API tests only

- [x] 4. Add a synchronous AI provider and prompt layer for Sprint 2 actions

  **What to do**: Create an `apps/api/src/lib/ai/` layer that isolates provider invocation from route handlers and repositories. Define two provider-facing entry points only: `generateOutlineDraft()` and `generateWritingProposal()`. Store prompt specs per action (`outline`, `continue`, `rewrite`, `paraphrase`, `expand`, `simplify`) as explicit typed builders, not a single multi-purpose prompt. Normalize every provider response into backend contracts from Task 1 before it reaches the route layer. Tests must run against a deterministic fake provider so no live model access is required.
  **Must NOT do**: Do not add streaming, SSE, chat history, tool-calling loops, or worker dispatch. Do not let raw provider payloads leak into route responses.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: isolated backend service work with strict boundaries and deterministic testing.
  - Skills: `[]` — no additional SDK skill is required unless the executor introduces a new AI library deliberately.
  - Omitted: `['ai-sdk']` — the plan does not require adopting a new SDK as part of Sprint 2 backend foundations.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 7, 8 | Blocked By: 1

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `apps/api/src/app.ts:594-890` — route handlers are currently thin and should remain orchestration shells rather than provider wrappers.
  - Pattern: `apps/api/src/lib/app-context.ts:157-168` — app context is the existing dependency-injection seam for testable services.
  - Pattern: `docs/OPERATIONAL PLAN.md:384-389` — prompt spec must be action-specific and output-capped.
  - External: `https://platejs.org/docs/ai` — Plate AI flows separate generation from application/review.
  - External: `https://platejs.org/docs/components/ai-menu` — review/apply flows can use insert vs edit behavior without making preview content the persisted source of truth.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `pnpm --filter @aqshara/api test` exits 0 with fake-provider tests covering one outline response and all five writing actions.
  - [ ] `pnpm --filter @aqshara/api check-types` exits 0 after adding provider interfaces and prompt builders.
  - [ ] No route directly imports the concrete provider client: `grep "from .*provider" apps/api/src/app.ts` returns no direct route-level coupling.

  **QA Scenarios** (MANDATORY — task incomplete without these):

  ```
  Scenario: Outline prompt path normalizes provider output
    Tool: Bash
    Steps: Run `pnpm --filter @aqshara/api test`; inspect the fake-provider test that returns a nested outline payload for topic `Dampak AI pada Pendidikan`.
    Expected: Service output is a valid `OutlineDraft` with deterministic section order and no provider-specific fields in the returned object.
    Evidence: .sisyphus/evidence/task-4-ai-layer.txt

  Scenario: Writing-action prompt routing rejects unsupported action
    Tool: Bash
    Steps: Run `pnpm --filter @aqshara/api test`; inspect the service test that passes an invalid action literal.
    Expected: The service throws or returns the explicit unsupported-action error before any provider call is attempted.
    Evidence: .sisyphus/evidence/task-4-ai-layer-error.txt
  ```

  **Commit**: YES | Message: `feat(api): add ai provider and prompt layer` | Files: `apps/api/src/lib/ai/*`, related API tests only

- [x] 5. Extend `/v1/me` into the Sprint 2 backend bootstrap read path

  **What to do**: Keep `/v1/me` as the single authenticated bootstrap read path, but extend its response so backend consumers can derive onboarding and quota state without extra persistence. Add `documentStats: { activeCount, archivedCount }`, `onboarding: { shouldShow: boolean, reason: 'zero_documents' | 'has_documents' }`, and richer usage metadata for AI actions (`period`, `aiActionsUsed`, `aiActionsReserved`, `aiActionsRemaining`) while preserving current plan summary semantics. The route must remain gated by `requireAppUser()` and compute `shouldShow` strictly from active+archived document counts, not a new onboarding table.
  **Must NOT do**: Do not add a separate `/v1/onboarding` persistence route. Do not remove existing auth/provisioning/deleted-account semantics from `/v1/me`.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: additive contract work over an existing authenticated endpoint.
  - Skills: `[]` — current Hono/OpenAPI patterns are already established.
  - Omitted: `['orpc-contract-first']` — this repo uses Hono OpenAPI + generated client, not oRPC.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 10 | Blocked By: 3

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `apps/api/src/app.ts:133-177` — current `meRoute` schema to extend.
  - Pattern: `apps/api/src/app.ts:657-673` — current `/v1/me` handler shape.
  - Pattern: `packages/api-client/src/generated/types.ts:100-200` — generated client currently exposes the old `/v1/me` contract and will need regeneration.
  - Pattern: `docs/OPERATIONAL PLAN.md:639-646` — Sprint 2 explicitly needs usage counters and a plan-limit read path.
  - Pattern: `docs/web-user-flow-sitemap.md:42-50` — returning users need dashboard-visible quota state from the main bootstrap flow.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `pnpm --filter @aqshara/api test` exits 0 with `/v1/me` coverage for zero-document users, existing-document users, provisioning-pending users, and deleted users.
  - [ ] `pnpm spec:generate && pnpm client:generate` exit 0 and reflect the extended `/v1/me` schema.
  - [ ] `pnpm --filter @aqshara/api check-types` exits 0 after response schema changes.

  **QA Scenarios** (MANDATORY — task incomplete without these):

  ```
  Scenario: Zero-document bootstrap enables onboarding
    Tool: Bash
    Steps: Run `pnpm --filter @aqshara/api test`; inspect the `/v1/me` test for a provisioned user with no documents.
    Expected: Response status is 200 with `onboarding.shouldShow=true`, `onboarding.reason='zero_documents'`, and `documentStats.activeCount=0`.
    Evidence: .sisyphus/evidence/task-5-me-bootstrap.txt

  Scenario: Deleted account remains blocked despite richer bootstrap fields
    Tool: Bash
    Steps: Run `pnpm --filter @aqshara/api test`; inspect the test that soft-deletes the user before hitting `/v1/me`.
    Expected: Response remains 403 `account_deleted`; no onboarding or usage payload leaks through.
    Evidence: .sisyphus/evidence/task-5-me-bootstrap-error.txt
  ```

  **Commit**: YES | Message: `feat(api): add onboarding bootstrap read paths` | Files: `apps/api/src/app.ts`, `apps/api/src/app.test.ts`, `packages/api-client/src/generated/types.ts` via regeneration only

- [x] 6. Add template catalog and bootstrap document-creation routes

  **What to do**: Add two backend routes in `apps/api/src/app.ts`: `GET /v1/templates` and `POST /v1/documents/bootstrap`. `GET /v1/templates` must surface the global, code-owned catalog for `blank`, `general_paper`, `proposal`, and `skripsi`, using `packages/documents` as the source of the three structured templates and synthesizing the blank option from `createEmptyDocument()`. `POST /v1/documents/bootstrap` must create a new document either blank or template-backed, set `contentJson` from the chosen builder, compute `plainText` via `toPlainText`, and return the created document in the existing document envelope style. Keep the original `POST /v1/documents` route intact; this new route exists specifically for Sprint 2 onboarding/template bootstrap.
  **Must NOT do**: Do not persist templates independently. Do not make bootstrap creation depend on outline generation. Do not force the worker or AI provider into this route.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: additive route and repository work on well-known backend patterns.
  - Skills: `[]` — current route/repository/test patterns are sufficient.
  - Omitted: `['hono-api-scaffolder']` — the route surface is small and should stay aligned with existing hand-written patterns.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 10 | Blocked By: 1, 3

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `apps/api/src/app.ts:179-285` — existing create/list route declaration style.
  - Pattern: `apps/api/src/app.ts:719-742` — current `createDocumentRoute` handler logic to preserve envelope/ownership semantics.
  - Pattern: `apps/api/src/lib/app-context.ts:497-533` — current document creation path and default canonical empty document behavior.
  - Pattern: `packages/documents/src/index.ts:11-29` — existing empty-document and plain-text helpers.
  - Pattern: `docs/OPERATIONAL PLAN.md:317-335` — Sprint 2 requires blank-doc and template-start entry points.
  - Pattern: `docs/web-user-flow-sitemap.md:25-34` — onboarding/template flow must reach editor without forcing AI or export.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `pnpm --filter @aqshara/api test` exits 0 with contract coverage for `GET /v1/templates`, blank bootstrap create, and `proposal` template bootstrap create.
  - [ ] `pnpm spec:generate && pnpm client:generate` exit 0 and include both new routes.
  - [ ] `pnpm --filter @aqshara/api check-types` exits 0 after repository/route additions.

  **QA Scenarios** (MANDATORY — task incomplete without these):

  ```
  Scenario: Template catalog exposes code-owned bootstrap options
    Tool: Bash
    Steps: Run `pnpm --filter @aqshara/api test`; inspect the `/v1/templates` test for an authenticated user.
    Expected: Response status is 200 and returns exactly four options including `blank`, `general_paper`, `proposal`, and `skripsi`.
    Evidence: .sisyphus/evidence/task-6-template-bootstrap.txt

  Scenario: Invalid bootstrap payload is rejected without document creation
    Tool: Bash
    Steps: Run `pnpm --filter @aqshara/api test`; inspect the test that posts `mode='template'` without `templateCode`.
    Expected: Request fails with 400 validation error and no document is persisted for the user.
    Evidence: .sisyphus/evidence/task-6-template-bootstrap-error.txt
  ```

  **Commit**: YES | Message: `feat(api): add template bootstrap routes` | Files: `apps/api/src/app.ts`, `apps/api/src/lib/app-context.ts`, `apps/api/src/app.test.ts`, regenerated spec/client files only

- [x] 7. Add outline generation and outline-apply endpoints

  **What to do**: Add two synchronous routes for the document outline flow: `POST /v1/documents/{documentId}/outline/generate` and `POST /v1/documents/{documentId}/outline/apply`. The generate route must require `topic` and `idempotencyKey`, reserve one AI action credit before provider execution, call the Task-4 outline service, and return an editable `OutlineDraft` plus replay-safe usage metadata. The apply route must accept an edited `OutlineDraft`, `baseUpdatedAt`, and optional `templateCode`, then replace the target document’s `contentJson` with canonical Slate JSON produced by `outlineDraftToDocumentValue`; it must not consume additional quota. If the document is newer than `baseUpdatedAt`, return 409 `stale_outline_apply` and leave both document and quota state untouched.
  **Must NOT do**: Do not persist outline proposals to the proposal table. Do not auto-apply generated outlines. Do not append outlines blindly onto stale documents.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: combines AI generation, idempotency, quota, and canonical document transforms.
  - Skills: `[]` — action-specific backend patterns are already prescribed in the plan.
  - Omitted: `['test-driven-development']` — sprint posture stays tests-after, though task execution should still be contract-first.

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: 10 | Blocked By: 1, 2, 3, 4

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `apps/api/src/app.ts:797-842` — existing save-document stale-write handling is the model for outline apply conflict behavior.
  - Pattern: `apps/api/src/app.ts:744-795` — route-level document ownership and 404 behavior for single-document endpoints.
  - Pattern: `apps/api/src/lib/app-context.ts:582-617` — canonical content save path and `baseUpdatedAt` semantics.
  - Pattern: `docs/OPERATIONAL PLAN.md:323-335` — outline must be reviewable/editable before insertion.
  - External: `https://upstash.com/docs/oss/sdks/ts/ratelimit/algorithms` — quota check happens before the provider call, even though accounting remains database-backed here.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `pnpm --filter @aqshara/api test` exits 0 with coverage for generated outline success, duplicate `idempotencyKey` replay, stale outline apply rejection, and quota-exceeded rejection.
  - [ ] `pnpm spec:generate && pnpm client:generate` exit 0 and include both outline routes.
  - [ ] `pnpm --filter @aqshara/api check-types` exits 0 after adding outline schemas and handlers.

  **QA Scenarios** (MANDATORY — task incomplete without these):

  ```
  Scenario: Outline generate returns replay-safe editable draft
    Tool: Bash
    Steps: Run `pnpm --filter @aqshara/api test`; inspect the outline-generation test that posts topic `Dampak AI pada Pendidikan` twice with the same `idempotencyKey`.
    Expected: First response returns 200 with a non-empty `outline`; second response replays the same payload without decrementing quota twice.
    Evidence: .sisyphus/evidence/task-7-outline.txt

  Scenario: Stale outline apply is rejected
    Tool: Bash
    Steps: Run `pnpm --filter @aqshara/api test`; inspect the test that generates an outline at revision N, updates the document to revision N+1, then posts `/outline/apply` with the old `baseUpdatedAt`.
    Expected: Response is 409 `stale_outline_apply` and document content remains at revision N+1.
    Evidence: .sisyphus/evidence/task-7-outline-error.txt
  ```

  **Commit**: YES | Message: `feat(api): add outline generation flow` | Files: `apps/api/src/app.ts`, `apps/api/src/lib/ai/*`, `apps/api/src/lib/app-context.ts`, `apps/api/src/app.test.ts`, regenerated spec/client files only

- [x] 8. Add writing-assistant proposal generation routes

  **What to do**: Add `POST /v1/documents/{documentId}/ai/proposals` as the single generation endpoint for Sprint 2 writing actions. It must accept `{ action, targetBlockIds, idempotencyKey }`, validate the action-specific target rules (`continue` = exactly one trailing block target; `rewrite`/`paraphrase`/`expand`/`simplify` = one or more contiguous block IDs), reserve quota before the provider call, normalize the output into a `DocumentChangeProposal`, persist that proposal in `document_change_proposals`, and return the proposal plus `allowedApplyModes`. Duplicate replays with the same request hash must return the original pending proposal without double-charging. New requests with reused `idempotencyKey` but different payload hashes must fail deterministically with a 409 duplicate-request error.
  **Must NOT do**: Do not auto-apply the proposal. Do not support free-form character ranges, inline spans, or chat-style prompts. Do not create one route per AI action.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: this is the most concurrency-sensitive Sprint 2 backend slice.
  - Skills: `[]` — route/repository/AI patterns are already locked.
  - Omitted: `['hono-api-scaffolder']` — route surface is singular and custom.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: 9, 10 | Blocked By: 1, 2, 3, 4

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `apps/api/src/app.ts:744-842` — single-document route patterns and stale-write error style to mirror.
  - Pattern: `apps/api/src/lib/app-context.ts:535-617` — document lookup and baseUpdatedAt-aware update behavior.
  - Pattern: `docs/OPERATIONAL PLAN.md:356-377` — allowed Sprint 2 writing actions and required preview/apply/insert-below/dismiss UX.
  - Pattern: `docs/web-user-flow-sitemap.md:30-34` — AI assist must be preview-first, never destructive by default.
  - External: `https://platejs.org/docs/block-selection` — generation should operate on frozen block IDs or selection context supplied by the client rather than backend-derived paths.
  - External: `https://platejs.org/docs/markdown` — prompt serialization may include block IDs for AI tracking, but the persisted source remains Slate JSON.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `pnpm --filter @aqshara/api test` exits 0 with generation coverage for all five actions, duplicate-request replay, mismatched-payload idempotency conflict, and invalid target validation.
  - [ ] `pnpm spec:generate && pnpm client:generate` exit 0 and include the proposal-generation route.
  - [ ] `pnpm --filter @aqshara/api check-types` exits 0 after proposal schemas and persistence are wired.

  **QA Scenarios** (MANDATORY — task incomplete without these):

  ```
  Scenario: Rewrite action creates a pending persisted proposal
    Tool: Bash
    Steps: Run `pnpm --filter @aqshara/api test`; inspect the test that posts action `rewrite` with two contiguous `targetBlockIds` and a valid `idempotencyKey`.
    Expected: Response is 200 with a pending `proposalId`, `allowedApplyModes=['replace','insert_below']`, and one AI action reserved/consumed exactly once.
    Evidence: .sisyphus/evidence/task-8-writing-proposal.txt

  Scenario: Reused idempotency key with different payload is rejected
    Tool: Bash
    Steps: Run `pnpm --filter @aqshara/api test`; inspect the test that reuses the same `idempotencyKey` for action `rewrite` and then `expand`.
    Expected: Second request fails with 409 duplicate-request conflict and does not create a second proposal row or extra usage charge.
    Evidence: .sisyphus/evidence/task-8-writing-proposal-error.txt
  ```

  **Commit**: YES | Message: `feat(api): add writing proposal generation` | Files: `apps/api/src/app.ts`, `apps/api/src/lib/ai/*`, `apps/api/src/lib/app-context.ts`, `apps/api/src/app.test.ts`, regenerated spec/client files only

- [x] 9. Add proposal apply and dismiss routes with stale-base validation

  **What to do**: Add `POST /v1/ai/proposals/{proposalId}/apply` and `POST /v1/ai/proposals/{proposalId}/dismiss`. Apply must load the persisted proposal, ensure it belongs to the authenticated user, require `baseUpdatedAt` plus `mode` (`replace` or `insert_below`), compare both the stored proposal base and live document `updatedAt`, and only then write the new canonical `contentJson` + `plainText` via the repository save path. On success, mark the proposal `applied`; on stale mismatch, mark it `invalidated` and return 409 `stale_ai_proposal`; on second apply of a terminal proposal, return a deterministic 409 terminal-state error. Dismiss must be idempotent: first call marks `dismissed`, later calls return 200 with the already-dismissed state and no document changes.
  **Must NOT do**: Do not charge quota on apply or dismiss. Do not mutate documents for dismissed, invalidated, or already-applied proposals. Do not bypass the existing canonical save path.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: this is the critical mutation boundary where proposal safety can fail.
  - Skills: `[]` — current repository/save patterns are sufficient.
  - Omitted: `['systematic-debugging']` — this is new behavior, not a live bugfix task.

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: 10 | Blocked By: 1, 2, 3, 8

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `apps/api/src/app.ts:797-842` — save path already computes `plainText` from canonical document content and returns 409 on stale writes.
  - Pattern: `apps/api/src/lib/app-context.ts:582-617` — existing repository update contract should remain the only content-write path.
  - Pattern: `apps/api/src/test-support/memory-app-context.ts:207-231` — in-memory save behavior must mirror production stale-write semantics.
  - Pattern: `docs/OPERATIONAL PLAN.md:368-376` — AI changes must preview first and require explicit replace/insert-below/dismiss actions.
  - External: `https://platejs.org/docs/suggestion` — Plate review flows are suggestion-based and should remain explicit/user-approved before application.
  - External: `https://platejs.org/docs/comment` — review metadata is ID-based and should be treated as overlay state, not the canonical document body.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `pnpm --filter @aqshara/api test` exits 0 with apply success, insert-below success, dismiss idempotency, stale apply invalidation, and terminal-state rejection coverage.
  - [ ] `pnpm spec:generate && pnpm client:generate` exit 0 and include the apply/dismiss routes.
  - [ ] `pnpm --filter @aqshara/api check-types` exits 0 after proposal mutation schemas are added.

  **QA Scenarios** (MANDATORY — task incomplete without these):

  ```
  Scenario: Insert-below apply writes canonical content once
    Tool: Bash
    Steps: Run `pnpm --filter @aqshara/api test`; inspect the test that generates a `continue` proposal, then applies it with mode `insert_below` against the original `baseUpdatedAt`.
    Expected: Response is 200, document `updatedAt` advances, proposal status becomes `applied`, and `plainText` matches the new canonical Slate JSON content.
    Evidence: .sisyphus/evidence/task-9-proposal-apply.txt

  Scenario: Applying a stale proposal invalidates it without mutating content
    Tool: Bash
    Steps: Run `pnpm --filter @aqshara/api test`; inspect the test that updates the document after proposal generation and then posts `/apply`.
    Expected: Response is 409 `stale_ai_proposal`, proposal status becomes `invalidated`, and the document stays on the newer revision.
    Evidence: .sisyphus/evidence/task-9-proposal-apply-error.txt
  ```

  **Commit**: YES | Message: `feat(api): add proposal apply lifecycle` | Files: `apps/api/src/app.ts`, `apps/api/src/lib/app-context.ts`, `apps/api/src/app.test.ts`, regenerated spec/client files only

- [x] 10. Regenerate contracts and close Sprint 2 backend with regression and worker-boundary verification

  **What to do**: Finish the backend slice by regenerating OpenAPI/client artifacts, consolidating API tests, and proving the Sprint 2 backend changes stay within the agreed boundaries. Run the full backend and root verification suite, add/adjust focused tests if any route/schema drift remains, and capture a worker-boundary check that confirms no interactive AI queue was introduced. If `apps/worker` or `packages/queue` needed incidental edits for build/type safety, keep them strictly non-functional and document them explicitly in the commit summary.
  **Must NOT do**: Do not use this task to sneak in new features, worker queues, or UI-related API revisions. Do not leave generated client/spec drift unresolved.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: regression closure and repo-wide verification.
  - Skills: `[]` — existing scripts are enough.
  - Omitted: `['verification-before-completion']` — its principles are already encoded directly into this plan’s acceptance criteria.

  **Parallelization**: Can Parallel: NO | Wave 4 | Blocks: F1-F4 | Blocked By: 1, 2, 3, 5, 6, 7, 8, 9

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `package.json` root scripts — repo-wide verification already exists for `lint`, `check-types`, `test`, `spec:generate`, `client:generate`, and `build`.
  - Pattern: `.sisyphus/plans/complete-sprint-1-server-worker.md:52-57` — prior backend plan closes with root verification and generated-contract checks.
  - Pattern: `apps/worker/src/index.ts:1-32` — worker currently only wires the export queue.
  - Pattern: `packages/queue/src/index.ts:1-23` — queue package currently exposes only `export_docx`; Sprint 2 must not add interactive AI jobs.
  - Pattern: `docs/OPERATIONAL PLAN.md:648-659` — Sprint 2 QA focus is selection edge cases, large prompts, and error-message clarity.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `pnpm lint && pnpm check-types && pnpm test && pnpm build` exit 0 from repo root.
  - [ ] `pnpm spec:generate && pnpm client:generate` exit 0 with no uncommitted regeneration drift afterward.
  - [ ] `git diff --name-only -- apps/worker packages/queue` is empty, or any listed files are documented as non-functional build/type adjustments only.

  **QA Scenarios** (MANDATORY — task incomplete without these):

  ```
  Scenario: Full backend verification passes with regenerated contracts
    Tool: Bash
    Steps: Run `pnpm spec:generate && pnpm client:generate && pnpm lint && pnpm check-types && pnpm test && pnpm build` from repo root.
    Expected: Entire command chain exits 0 and leaves the working tree clean except for intentional Sprint 2 files.
    Evidence: .sisyphus/evidence/task-10-closeout.txt

  Scenario: Worker boundary remains intact
    Tool: Bash
    Steps: Run `git diff --name-only -- apps/worker packages/queue` after completing Sprint 2 backend work.
    Expected: No new interactive AI queue or worker runtime files appear; if any file changed, it is explicitly documented as non-functional and unrelated to AI orchestration.
    Evidence: .sisyphus/evidence/task-10-closeout-error.txt
  ```

  **Commit**: YES | Message: `test(api): close sprint 2 backend verification` | Files: regenerated spec/client artifacts, API tests, and any documented non-functional worker/queue adjustments only

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.

- [x] F1. Plan Compliance Audit — oracle
- [x] F2. Code Quality Review — unspecified-high
- [x] F3. Real Manual QA — unspecified-high
- [x] F4. Scope Fidelity Check — deep

## Commit Strategy

- Commit 1: `feat(documents): add sprint 2 backend contracts`
- Commit 2: `feat(database): add quota and proposal persistence`
- Commit 3: `refactor(api): extend sprint 2 repository services`
- Commit 4: `feat(api): add ai provider and prompt layer`
- Commit 5: `feat(api): add onboarding bootstrap read paths`
- Commit 6: `feat(api): add template bootstrap routes`
- Commit 7: `feat(api): add outline generation flow`
- Commit 8: `feat(api): add writing proposal generation`
- Commit 9: `feat(api): add proposal apply lifecycle`
- Commit 10: `test(api): close sprint 2 backend verification`

## Success Criteria

- Backend consumers can derive `shouldShowOnboarding` from `/v1/me` without a separate onboarding table.
- Backend consumers can request code-owned templates and create blank/template-backed documents through stable API routes.
- Outline generation returns an editable intermediate contract and inserts only through explicit follow-up requests.
- Writing assistant generation returns preview proposals that are never auto-applied.
- Duplicate idempotency retries are replay-safe and do not double-charge usage.
- Provider failures and stale applies return deterministic error codes without corrupting documents or counters.
- Sprint 2 backend work does not pull interactive AI into `apps/worker`.
