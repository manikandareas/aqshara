# Complete Sprint 1 Server/Worker

## TL;DR

> **Summary**: Selesaikan sisa Sprint 1 backend/worker dengan menutup gap operasional Clerk provisioning, menyediakan backend surface recent documents yang eksplisit, dan mengeraskan save path autosave agar stale write tidak bisa menimpa state terbaru.
> **Deliverables**:
>
> - Clerk webhook hardening + operational verification path
> - repeatable backfill/replay path untuk existing Clerk users
> - backend recent-documents contract terpisah dari document list umum
> - autosave stale-write protection + regression coverage
> - Sprint 1 operational runbook + repo verification evidence
>   **Effort**: Medium
>   **Parallel**: YES - 2 waves
>   **Critical Path**: 1 → 2 → 4 → 5

## Context

### Original Request

Buat plan untuk complete Sprint 1 `docs/OPERATIONAL PLAN.md` pada sisi server/worker.

### Interview Summary

- Fokus dibatasi ke backend/worker saja; tidak mencakup implementasi UI web/editor.
- Baseline repo saat ini: `apps/api` sudah punya Clerk webhook provisioning, `/v1/me`, dan document CRUD; `apps/worker` masih scaffold BullMQ.
- Sprint 2+ scope seperti AI backend, quota enforcement penuh, DOCX export nyata, dan research beta dikeluarkan dari plan ini.
- Keputusan eksplisit dalam plan ini: **recent documents tetap diimplementasikan di backend** karena masih tercantum sebagai deliverable Sprint 1 dan belum punya surface API terpisah; path final yang dipakai adalah `GET /v1/documents/recent?limit=5`.
- Worker hanya diubah bila benar-benar dibutuhkan untuk hardening operasional Sprint 1; default-nya tidak menambah pipeline job baru.

### Metis Review (gaps addressed)

- Kunci scope ke lima slice saja: webhook hardening, replay/backfill, recent-documents decision, autosave hardening, verification/docs.
- Jangan ubah autosave menjadi full version history; cukup capai jaminan bahwa stale write ditolak dan newest client state menang.
- Jangan mengubah replay/backfill menjadi framework sync generik; pilih operator-safe path minimal.
- Tambahkan negative-path tests untuk invalid signature, duplicate delivery, deleted-user follow-up event, missing email, dan autosave out-of-order completion.

## Work Objectives

### Core Objective

Menutup seluruh sisa pekerjaan Sprint 1 dari sisi server/worker agar auth provisioning, document navigation backend, dan autosave path siap dipakai sebagai fondasi launch tanpa membuka scope Sprint 2.

### Deliverables

- Hardened Clerk webhook behavior dengan negative-path coverage dan operational validation support.
- Idempotent backfill/replay path untuk Clerk users yang sudah ada sebelum webhook flow aktif.
- Endpoint recent-documents terpisah dengan kontrak backend yang eksplisit.
- Autosave API contract yang menolak stale content save dan lulus regression test race-condition.
- Runbook/ops notes Sprint 1 + verification suite yang dapat dijalankan agent.

### Definition of Done (verifiable conditions with commands)

- `pnpm --filter @aqshara/api test` lulus dengan coverage untuk webhook edge cases, recent-documents, dan autosave stale-write handling.
- `pnpm spec:generate && pnpm client:generate` lulus tanpa drift untuk contract backend baru.
- `pnpm lint && pnpm check-types && pnpm test && pnpm build` lulus dari root.
- Tidak ada task dalam plan ini yang menambahkan AI route, export pipeline nyata, atau research-beta schema.

### Must Have

- Webhook invalid payload/signature tidak memutasi state lokal.
- Duplicate/replayed Clerk events tidak membuat duplicate user/workspace.
- Existing Clerk users bisa di-backfill dengan path yang aman untuk diulang.
- Recent documents memiliki read surface backend terpisah dari list umum.
- Save document content menolak stale write berdasarkan token `baseUpdatedAt` dari state dokumen terakhir yang diketahui client.
- Semua perubahan tercermin di OpenAPI / generated client bila API surface berubah.

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)

- Must NOT menambah AI endpoints, quota enforcement penuh, DOCX export implementation, atau PDF/research pipeline.
- Must NOT mengubah canonical document AST di `packages/documents/src/index.ts`.
- Must NOT membangun event bus, generic sync engine, atau worker orchestration baru untuk replay/backfill.
- Must NOT mengubah autosave menjadi snapshot versioning penuh.
- Must NOT menambah dependency operasional yang tidak diperlukan untuk exit criteria Sprint 1.

## Verification Strategy

> ZERO HUMAN INTERVENTION — all verification is agent-executed.

- Test decision: tests-after pada backend test framework yang sudah ada (`node:test` via `apps/api/src/app.test.ts`) + command verification root scripts.
- QA policy: Every task has agent-executed scenarios.
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`

## Execution Strategy

### Parallel Execution Waves

> Target: 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Extract shared dependencies as Wave-1 tasks for max parallelism.

Wave 1: API contract foundations and operational safety

- Task 1: webhook hardening + negative-path coverage
- Task 2: replay/backfill path for existing Clerk users

Wave 2: document backend closeout

- Task 3: recent-documents backend surface
- Task 4: autosave stale-write protection
- Task 5: Sprint 1 closeout docs + full verification

### Dependency Matrix (full, all tasks)

| Task                               | Depends On | Blocks     |
| ---------------------------------- | ---------- | ---------- |
| 1. Webhook hardening               | none       | 2, 5       |
| 2. Replay/backfill path            | 1          | 5          |
| 3. Recent-documents API            | none       | 5          |
| 4. Autosave stale-write protection | none       | 5          |
| 5. Closeout verification/docs      | 1, 2, 3, 4 | F1-F4      |
| F1-F4 Final verification           | 5          | completion |

### Agent Dispatch Summary (wave → task count → categories)

- Wave 1 → 2 tasks → `unspecified-high`, `deep`
- Wave 2 → 3 tasks → `unspecified-high`, `writing`
- Final Verification → 4 tasks → `oracle`, `unspecified-high`, `deep`

## TODOs

> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [x] 1. Harden Clerk webhook handling and negative-path coverage

  **What to do**: Extend the webhook slice in `apps/api/src/app.ts` and the repository behaviors in `apps/api/src/lib/app-context.ts` so Sprint 1 provisioning flow is explicitly safe under invalid deliveries and duplicate/replayed events. Keep the existing route/context split, preserve soft-delete semantics, and add backend tests in `apps/api/src/app.test.ts` plus any required memory-fixture support in `apps/api/src/test-support/memory-app-context.ts`. Cover at minimum: invalid webhook verification failure, duplicate `user.created`, `user.deleted` for unknown users, missing usable primary email, and `user.updated` after a local soft delete. Add minimal structured log context only where needed for these operational branches.
  **Must NOT do**: Do not add new product routes unrelated to Clerk provisioning. Do not resurrect soft-deleted users. Do not introduce worker jobs, AI logic, quota logic, or production-only secret management changes.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: touches route behavior, repository invariants, and regression coverage across several backend files.
  - Skills: `[]` — existing backend patterns are sufficient; no domain-specific skill needed.
  - Omitted: `['superpowers/test-driven-development']` — plan already encodes tests and verification explicitly; executor can still follow TDD without loading the skill.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 2, 5 | Blocked By: none

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `apps/api/src/app.ts:498-566` — `requireAppUser()` already defines 401/403/409 auth-provisioning semantics; preserve these envelopes.
  - Pattern: `apps/api/src/app.ts:585-624` — current `/webhooks/clerk` route handles verification, identity extraction, soft delete, and upsert flow.
  - Pattern: `apps/api/src/lib/app-context.ts:172-255` — `upsertUserFromWebhook()` is the canonical provisioning path and already ensures default workspace creation.
  - Pattern: `apps/api/src/lib/app-context.ts:257-292` — `softDeleteUserByClerkUserId()` defines current soft-delete behavior; later updates must not reverse it.
  - Test: `apps/api/src/app.test.ts:60-165` — existing webhook happy-path tests and deleted-account assertions.
  - Test: `apps/api/src/test-support/memory-app-context.ts:39-83` — in-memory webhook/user fixture behavior must stay aligned with production repository semantics.
  - Config: `packages/config/src/index.ts:3-21` — env defaults currently hide missing production config; use only for detection/logging guidance, not broad config rewrites.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `pnpm --filter @aqshara/api test` exits 0 and includes assertions for invalid verification failure, duplicate `user.created`, missing-email no-op, unknown `user.deleted`, and ignored post-delete `user.updated`.
  - [ ] `pnpm --filter @aqshara/api check-types` exits 0 after webhook branch changes.
  - [ ] OpenAPI output remains valid: `pnpm --filter @aqshara/api spec:generate` exits 0 without removing existing `/webhooks/clerk` contract.

  **QA Scenarios** (MANDATORY — task incomplete without these):

  ```
  Scenario: Duplicate webhook delivery stays idempotent
    Tool: Bash
    Steps: Run `pnpm --filter @aqshara/api test`; inspect the webhook test that posts `user.created` twice and then resolves `/v1/me`.
    Expected: Test passes; only one internal user/workspace is observed and `/v1/me` still returns 200.
    Evidence: .sisyphus/evidence/task-1-webhook-hardening.txt

  Scenario: Invalid webhook verification does not mutate state
    Tool: Bash
    Steps: Run `pnpm --filter @aqshara/api test`; inspect the test that forces `verifyWebhook` failure before requesting `/v1/me` for the same Clerk user.
    Expected: Webhook request returns 400 and subsequent `/v1/me` remains 409 `account_provisioning` instead of provisioning a local user.
    Evidence: .sisyphus/evidence/task-1-webhook-hardening-error.txt
  ```

  **Commit**: YES | Message: `fix(api): harden clerk webhook handling` | Files: `apps/api/src/app.ts`, `apps/api/src/lib/app-context.ts`, `apps/api/src/app.test.ts`, `apps/api/src/test-support/memory-app-context.ts`

- [x] 2. Add a repeatable Clerk backfill/replay path for pre-webhook users

  **What to do**: Implement a minimal, operator-safe backfill path that reuses the existing provisioning logic rather than introducing a second codepath. Create a script `apps/api/scripts/backfill-clerk-users.ts`, expose it as `pnpm --filter @aqshara/api clerk:backfill`, and add any small repository helpers needed in `apps/api/src/lib/app-context.ts` so existing Clerk users can be provisioned into local `users` + `workspaces` without duplicates. Add focused test coverage in `apps/api/src/backfill.test.ts`, and keep reruns idempotent. If the backfill path needs to read Clerk users, isolate external fetch logic behind a small injectable boundary so tests can run without live Clerk access.
  **Must NOT do**: Do not create an admin HTTP route unless the script path is proven insufficient. Do not create BullMQ replay jobs. Do not build a generic synchronization framework. Do not mutate documents during backfill.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: combines operational design, idempotent data mutation, testability, and safe reuse of provisioning logic.
  - Skills: `[]` — no additional skill required if existing app-context pattern is followed.
  - Omitted: `['hono']` — this slice should avoid a new HTTP route unless absolutely necessary.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 5 | Blocked By: 1

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `apps/api/src/lib/app-context.ts:172-255` — reuse `upsertUserFromWebhook()` semantics for user/workspace creation instead of duplicating business rules.
  - Pattern: `apps/api/package.json:6-14` — existing app-level scripts pattern; add a dedicated backfill script alongside `spec:generate`.
  - Pattern: `apps/api/scripts/generate-openapi.ts` — existing script placement convention under `apps/api/scripts/`.
  - Test: `apps/api/src/app.test.ts:60-129` — current provisioning assertions provide the expected shape of created local user/workspace state.
  - Test harness: `apps/api/src/test-support/memory-app-context.ts:24-71` — extend memory repository/helpers only if needed to simulate rerunnable backfill safely.
  - Schema: `packages/database/src/schema.ts:12-36` — target tables for idempotent backfill are `users` and `workspaces`; no new schema required by default.

  **Acceptance Criteria** (agent-executable only):
  - [ ] A repeatable command `pnpm --filter @aqshara/api clerk:backfill` exists and can be executed in a test/dry-run mode without live Clerk credentials.
  - [ ] `pnpm --filter @aqshara/api test` exits 0 with coverage proving rerunning the backfill path does not create duplicate users/workspaces.
  - [ ] `pnpm --filter @aqshara/api check-types` exits 0 after adding script/repository helpers.

  **QA Scenarios** (MANDATORY — task incomplete without these):

  ```
  Scenario: Backfill provisions a pre-existing Clerk user once
    Tool: Bash
    Steps: Run the focused backfill test via `pnpm --filter @aqshara/api test` and inspect the scenario that seeds a remote-user fixture, runs backfill, then reads the local bootstrap state.
    Expected: One local user and one default workspace are created, matching the existing provisioning contract.
    Evidence: .sisyphus/evidence/task-2-backfill.txt

  Scenario: Re-running backfill stays idempotent
    Tool: Bash
    Steps: Run the same test suite; inspect the scenario that executes backfill twice for the same Clerk user fixture.
    Expected: Test passes with no duplicate `users` or `workspaces` entries and no resurrection of soft-deleted users.
    Evidence: .sisyphus/evidence/task-2-backfill-error.txt
  ```

  **Commit**: YES | Message: `feat(api): add clerk backfill path` | Files: `apps/api/scripts/backfill-clerk-users.ts`, `apps/api/package.json`, `apps/api/src/lib/app-context.ts`, `apps/api/src/backfill.test.ts`, optional `apps/api/src/test-support/*`

- [x] 3. Add an explicit recent-documents backend surface for Sprint 1

  **What to do**: Create a dedicated backend read surface `GET /v1/documents/recent?limit=5` rather than overloading the generic list contract. Add route/schema/OpenAPI coverage in `apps/api/src/app.ts`, repository support in `apps/api/src/lib/app-context.ts`, matching test coverage in `apps/api/src/app.test.ts` and `apps/api/src/test-support/memory-app-context.ts`, and regenerate API spec/client artifacts if the contract changes. Use active documents only, sorted by most recent `updatedAt`, with default limit `5` and hard max `10`, with no new database table.
  **Must NOT do**: Do not redesign document navigation. Do not add archived items to recent results. Do not add scoring/recommendation logic. Do not turn this into a paginated search endpoint.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: requires route contract, repository method, and tests without architectural novelty.
  - Skills: `[]` — existing Hono/OpenAPI patterns in repo are sufficient.
  - Omitted: `['orpc-contract-first']` — repo uses Hono OpenAPI + generated client here, not oRPC.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 5 | Blocked By: none

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `apps/api/src/app.ts:171-201` — document list route shows current query/response schema structure for Hono OpenAPI.
  - Pattern: `apps/api/src/app.ts:644-660` — list handler already resolves authenticated bootstrap then repository list call.
  - Pattern: `apps/api/src/lib/app-context.ts:61-65` and `294-310` — current list contract sorts by `updatedAt desc`; extend with a dedicated repository method rather than encoding “recent” via ambiguous query branching.
  - Test: `apps/api/src/app.test.ts:191-308` — current document workflow test can be expanded to create multiple docs and assert recent ordering + active-only filtering.
  - Test harness: `apps/api/src/test-support/memory-app-context.ts:85-98` — in-memory sorting already matches `updatedAt desc`; reuse for deterministic recent ordering.
  - Contract output: `apps/api/openapi/openapi.json` and `packages/api-client/src/generated/types.ts` — must be regenerated if route is added.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `pnpm --filter @aqshara/api test` exits 0 with a test proving recent documents returns only active docs ordered by newest `updatedAt` first and capped at the chosen limit.
  - [ ] `pnpm spec:generate && pnpm client:generate` exits 0 and the generated client exposes the new recent-documents contract.
  - [ ] `pnpm --filter @aqshara/api check-types` exits 0 after repository and route additions.

  **QA Scenarios** (MANDATORY — task incomplete without these):

  ```
  Scenario: Recent documents returns newest active items first
    Tool: Bash
    Steps: Run `pnpm --filter @aqshara/api test`; inspect the test that creates more than five docs with different update times and calls the recent-documents route.
    Expected: Response is 200, contains only active docs, and is sorted descending by `updatedAt` with the configured cap.
    Evidence: .sisyphus/evidence/task-3-recent-documents.txt

  Scenario: Archived documents are excluded from recent surface
    Tool: Bash
    Steps: Run the same test suite; inspect the scenario that archives a previously recent document before calling the recent route again.
    Expected: Archived doc is absent from the recent response while still present in the archived list route.
    Evidence: .sisyphus/evidence/task-3-recent-documents-error.txt
  ```

  **Commit**: YES | Message: `feat(api): add recent documents endpoint` | Files: `apps/api/src/app.ts`, `apps/api/src/lib/app-context.ts`, `apps/api/src/app.test.ts`, `apps/api/src/test-support/memory-app-context.ts`, `apps/api/openapi/openapi.json`, `packages/api-client/src/generated/types.ts`

- [x] 4. Prevent stale autosave overwrites in the document content save path

  **What to do**: Add a minimal concurrency guard to document content saves so an older client state cannot overwrite a newer saved version. Extend the `PUT /v1/documents/{documentId}/content` contract in `apps/api/src/app.ts` to require request body `{ contentJson, baseUpdatedAt }`, where `baseUpdatedAt` is the client’s last known server `updatedAt` value. Update `apps/api/src/lib/app-context.ts` and memory test support to reject stale saves with HTTP `409` and error code `stale_document_save`. Add regression tests that simulate two sequential saves where the older completion arrives last, and ensure `plainText` derivation still comes from accepted `contentJson` only.
  **Must NOT do**: Do not add snapshot history tables. Do not alter the document AST schema. Do not silently accept stale overwrites. Do not introduce websocket/realtime sync.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: contract change plus persistence correctness and regression testing.
  - Skills: `[]` — existing repo patterns are enough.
  - Omitted: `['systematic-debugging']` — this is preventive hardening, not open-ended debugging.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 5 | Blocked By: none

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `apps/api/src/app.ts:332-377` — current save route accepts only `contentJson`; this is where the save token contract must be introduced.
  - Pattern: `apps/api/src/app.ts:748-779` — save handler currently derives `plainText` via `toPlainText()` and writes blindly.
  - Pattern: `apps/api/src/lib/app-context.ts:394-421` — `updateDocumentContent()` is the single persistence point for save behavior; enforce stale-write rejection here.
  - Pattern: `apps/api/src/app.ts:75-80` and `448-458` — reuse structured API error envelope with `code`, `message`, `requestId`.
  - Test: `apps/api/src/app.test.ts:234-253` — existing content save assertions provide the base happy-path behavior.
  - Test harness: `apps/api/src/test-support/memory-app-context.ts:165-180` — in-memory save behavior must mirror production stale-write semantics for deterministic testing.
  - Canonical AST: `packages/documents/src/index.ts:18-29` — `plainText` must still be derived from accepted AST via `toPlainText()`.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `pnpm --filter @aqshara/api test` exits 0 with coverage for accepted `baseUpdatedAt` and rejected stale `baseUpdatedAt`.
  - [ ] `pnpm spec:generate && pnpm client:generate` exits 0 and generated types reflect request body `{ contentJson, baseUpdatedAt }` plus `409 stale_document_save` response.
  - [ ] `pnpm --filter @aqshara/api check-types` exits 0 after route and repository signature changes.

  **QA Scenarios** (MANDATORY — task incomplete without these):

  ```
  Scenario: Latest autosave state is preserved
    Tool: Bash
    Steps: Run `pnpm --filter @aqshara/api test`; inspect the scenario that saves content A, then saves content B with the updated token from A.
    Expected: Both writes succeed in order and the fetched document/plainText reflects content B.
    Evidence: .sisyphus/evidence/task-4-autosave.txt

  Scenario: Stale autosave cannot overwrite newer content
    Tool: Bash
    Steps: Run the same test suite; inspect the scenario that replays an older save token after a newer save has already updated the document.
    Expected: Older write is rejected with HTTP 409 and code `stale_document_save`, and the stored document/plainText remains at the newer content.
    Evidence: .sisyphus/evidence/task-4-autosave-error.txt
  ```

  **Commit**: YES | Message: `fix(api): reject stale document saves` | Files: `apps/api/src/app.ts`, `apps/api/src/lib/app-context.ts`, `apps/api/src/app.test.ts`, `apps/api/src/test-support/memory-app-context.ts`, `apps/api/openapi/openapi.json`, `packages/api-client/src/generated/types.ts`

- [x] 5. Close out Sprint 1 backend with docs, verification, and operational evidence

  **What to do**: After Tasks 1-4 land, update `docs/OPERATIONAL PLAN.md` and add `docs/sprint-1-backend-operations.md` so the remaining backend/worker gaps are explicitly closed. Document webhook validation steps for production-like environments, how to run `pnpm --filter @aqshara/api clerk:backfill` safely, the `GET /v1/documents/recent?limit=5` contract, and autosave stale-write behavior for `baseUpdatedAt`. Regenerate OpenAPI/client if not already done, run the full repo verification sequence, and store command outputs/evidence under `.sisyphus/evidence/` during execution.
  **Must NOT do**: Do not introduce new product scope while documenting. Do not claim production readiness without executable verification outputs. Do not skip root-level verification commands.

  **Recommended Agent Profile**:
  - Category: `writing` — Reason: primarily documentation and verification orchestration with light technical cross-checking.
  - Skills: `[]` — repo-specific operational writing is sufficient.
  - Omitted: `['verification-before-completion']` — the task itself already mandates exact verification commands and evidence capture.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: F1, F2, F3, F4 | Blocked By: 1, 2, 3, 4

  **References** (executor has NO interview context — be exhaustive):
  - Source of truth: `docs/OPERATIONAL PLAN.md:583-618` — explicitly lists remaining Sprint 1 items, risks, and QA focus.
  - Verification baseline: `docs/OPERATIONAL PLAN.md:92-100` — current commands already known to pass and must continue to pass.
  - Contract generation: `apps/api/package.json:6-14` — `test` and `spec:generate` scripts.
  - API spec artifact: `apps/api/openapi/openapi.json` — verify it stays current after contract changes.
  - Client artifact: `packages/api-client/src/generated/types.ts` — verify generated client stays aligned with API changes.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `pnpm lint && pnpm check-types && pnpm test && pnpm spec:generate && pnpm client:generate && pnpm build` exits 0 from repo root.
  - [ ] `docs/OPERATIONAL PLAN.md` and `docs/sprint-1-backend-operations.md` are updated to document webhook validation, `clerk:backfill` usage, recent-documents contract, and autosave stale-write behavior.
  - [ ] Evidence files for all Sprint 1 backend tasks exist under `.sisyphus/evidence/` after execution.

  **QA Scenarios** (MANDATORY — task incomplete without these):

  ```
  Scenario: Full repo verification passes after Sprint 1 backend closeout
    Tool: Bash
    Steps: Run `pnpm lint && pnpm check-types && pnpm test && pnpm spec:generate && pnpm client:generate && pnpm build` from repo root.
    Expected: Every command exits 0 with no skipped failing backend checks.
    Evidence: .sisyphus/evidence/task-5-closeout.txt

  Scenario: Operational docs match implemented backend behavior
    Tool: Bash
    Steps: Read the updated documentation file(s) and compare them against final route/script/test names introduced by Tasks 1-4.
    Expected: Documented commands, endpoint names, and failure behaviors match the implemented backend exactly; no stale references remain.
    Evidence: .sisyphus/evidence/task-5-closeout-error.txt
  ```

  **Commit**: YES | Message: `docs(api): document sprint 1 operations and verification` | Files: `docs/OPERATIONAL PLAN.md`, `docs/sprint-1-backend-operations.md`, regenerated API artifacts if needed, evidence paths during execution

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.

- [x] F1. Plan Compliance Audit — oracle
- [x] F2. Code Quality Review — unspecified-high
- [x] F3. Real Manual QA — unspecified-high (+ playwright if UI)
- [x] F4. Scope Fidelity Check — deep

## Commit Strategy

- Task 1: `test(api): add webhook hardening coverage` then `fix(api): harden Clerk webhook handling`
- Task 2: `test(api): add replay backfill coverage` then `feat(api): add clerk backfill path`
- Task 3: `test(api): add recent documents contract coverage` then `feat(api): add recent documents endpoint`
- Task 4: `test(api): add autosave stale write coverage` then `fix(api): reject stale document saves`
- Task 5: `docs(api): document sprint 1 operations and verification`

## Success Criteria

- Sprint 1 backend blockers listed in `docs/OPERATIONAL PLAN.md` are either implemented or explicitly closed as done within this plan’s scope.
- Repo retains clean backend boundary: web consumes API contract; no direct service leakage.
- Operational auth provisioning path is testable, repeatable, and safe for duplicate/replayed input.
