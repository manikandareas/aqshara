# Aqshara Web User Flow and Sitemap

## TL;DR

> **Summary**: Produce one canonical markdown artifact at `docs/web-user-flow-sitemap.md` that documents the launch-first web user flow, returning-user flow, beta research flow, and a status-driven sitemap grounded in current `apps/web` routes plus product docs.
> **Deliverables**:
>
> - `docs/web-user-flow-sitemap.md`
> - explicit `LIVE / MVP / BETA / FUTURE` legend
> - single source-of-truth inventory table for route/surface/state mapping
> - launch-vs-beta boundary section with no ambiguous scope blur
>   **Effort**: Short
>   **Parallel**: NO
>   **Critical Path**: Task 1 → Task 2 → Task 3 → Task 4 → Task 5

## Context

### Original Request

Create a user flow for web and a sitemap based on `docs/PRD.md` and `docs/OPERATIONAL PLAN.md`, so the team can understand what pages exist and how users move from the start of the experience.

### Interview Summary

- Deliverable is documentation, not implementation.
- Launch-first writing workflow is primary; beta research flow must be shown separately.
- Existing draft at `.sisyphus/drafts/web-user-flow-sitemap.md` already captures the baseline route inventory and product constraints.
- Current web routes are limited to `/`, `/sign-in`, `/sign-up`, `/app`, and `/app/documents/[documentId]`.

### Metis Review (gaps addressed)

- Lock one canonical artifact path: `docs/web-user-flow-sitemap.md`.
- Use a strict status legend: `LIVE`, `MVP`, `BETA`, `FUTURE`.
- Distinguish every inventory item as `Route`, `Embedded surface`, or `State` so the doc does not invent URLs.
- Keep scope descriptive and IA-oriented only; do not expand into wireframes, screen specs, or implementation tickets.
- Explicitly separate launch and beta to prevent source-upload flow from leaking into MVP scope.

## Work Objectives

### Core Objective

Create a single polished markdown document that accurately describes Aqshara’s launch web information architecture and user flows, anchored to current route reality and product planning docs.

### Deliverables

- `docs/web-user-flow-sitemap.md` with required sections and evidence-backed statements
- one inventory table covering current live routes, planned MVP surfaces, and beta research surfaces
- explicit route/surface/state classification for each entry
- explicit MVP-vs-beta boundary language and non-goals

### Definition of Done (verifiable conditions with commands)

- `test -f docs/web-user-flow-sitemap.md`
- `pnpm exec prettier --check docs/web-user-flow-sitemap.md`
- `python - <<'PY'
from pathlib import Path
text = Path('docs/web-user-flow-sitemap.md').read_text()
required = [
    '## Launch MVP Flow',
    '## Returning User Flow',
    '## Beta Research Flow',
    '## Sitemap / Page Inventory',
    '## MVP vs Beta Boundaries',
    '/', '/sign-in', '/sign-up', '/app', '/app/documents/[documentId]',
    'DOCX-only', 'no mandatory source upload',
    'LIVE', 'MVP', 'BETA', 'FUTURE',
    'Route', 'Embedded surface', 'State',
    'onboarding', 'template chooser', 'AI assist preview', 'export', 'usage/billing',
]
missing = [item for item in required if item not in text]
assert not missing, f'Missing required content: {missing}'
print('content-check: OK')
PY`

### Must Have

- Ground every flow statement in `docs/PRD.md`, `docs/OPERATIONAL PLAN.md`, the current draft, or current route files
- Treat onboarding, template chooser, AI assist preview, export flow, and usage/billing as planned MVP surfaces unless code proves they are already live
- Treat source upload, source summary, source Q&A, and evidence snippets as beta-only
- Preserve the launch-first path: auth → dashboard/create doc → editor → AI assist → export

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)

- Must NOT invent new URLs unless explicitly supported by docs
- Must NOT blur `Route`, `Embedded surface`, and `State`
- Must NOT turn the document into a wireframe, screen design, component spec, or implementation ticket list
- Must NOT imply source upload is mandatory in first-time onboarding
- Must NOT claim PDF export, collaboration, cross-file synthesis, or full citation automation are launch scope

## Verification Strategy

> ZERO HUMAN INTERVENTION — all verification is agent-executed.

- Test decision: docs-first verification (`tests-after` for markdown structure/content) + `pnpm exec prettier --check`
- QA policy: Every task includes command-based checks; no visual-only review
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`

## Execution Strategy

### Parallel Execution Waves

> Target: 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Extract shared dependencies as Wave-1 tasks for max parallelism.

Wave 1: establish artifact path, assertion set, and evidence source list
Wave 2: author route inventory and launch/returning flows
Wave 3: author beta flow, boundary section, and final verification

### Dependency Matrix (full, all tasks)

- Task 1 blocks Tasks 2-5
- Task 2 blocks Tasks 3-5
- Task 3 blocks Tasks 4-5
- Task 4 blocks Task 5
- Task 5 unblocks Final Verification Wave

### Agent Dispatch Summary (wave → task count → categories)

- Wave 1 → 1 task → writing
- Wave 2 → 2 tasks → writing
- Wave 3 → 2 tasks → writing
- Final Verification → 4 tasks → oracle / unspecified-high / deep

## TODOs

> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [x] 1. Create the canonical document scaffold

     **What to do**: Create `docs/web-user-flow-sitemap.md` with the fixed section skeleton below and no extra sections: `# Aqshara Web User Flow and Sitemap`, `## Purpose`, `## Status Legend`, `## Launch MVP Flow`, `## Returning User Flow`, `## Beta Research Flow`, `## Sitemap / Page Inventory`, `## MVP vs Beta Boundaries`, `## Evidence Sources`. In `## Status Legend`, define `LIVE`, `MVP`, `BETA`, and `FUTURE`. In `## Evidence Sources`, list exact evidence files used.
     **Must NOT do**: Do not add wireframes, user stories, backlog items, analytics plans, or recommended UI redesigns.

     **Recommended Agent Profile**:
  - Category: `writing` — Reason: documentation artifact with strict structure and evidence mapping
  - Skills: [] — no extra skill required beyond repo-grounded writing
  - Omitted: [`frontend-design`] — not a UI implementation task

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: [2, 3, 4, 5] | Blocked By: []

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `.sisyphus/drafts/web-user-flow-sitemap.md:1-49` — baseline flow, sitemap grouping, and agreed scope
  - Pattern: `docs/PRD.md:213-262` — canonical launch, AI preview, and beta research journeys
  - Pattern: `docs/OPERATIONAL PLAN.md:470-537` — onboarding, AI preview, export status, and quota expectations
  - Pattern: `docs/OPERATIONAL PLAN.md:545-589` — beta source upload and file-Q&A boundaries

  **Acceptance Criteria** (agent-executable only):
  - [ ] `test -f docs/web-user-flow-sitemap.md`
  - [ ] `python - <<'PY'
from pathlib import Path
text = Path('docs/web-user-flow-sitemap.md').read_text()
required = ['## Purpose','## Status Legend','## Launch MVP Flow','## Returning User Flow','## Beta Research Flow','## Sitemap / Page Inventory','## MVP vs Beta Boundaries','## Evidence Sources']
missing = [item for item in required if item not in text]
assert not missing, missing
print('scaffold-check: OK')
PY`

  **QA Scenarios** (MANDATORY — task incomplete without these):

  ```
  Scenario: Canonical scaffold exists
    Tool: Bash
    Steps: Run `test -f docs/web-user-flow-sitemap.md` and the Python scaffold-check assertion.
    Expected: File exists and every required heading is present exactly once.
    Evidence: .sisyphus/evidence/task-1-canonical-scaffold.txt

  Scenario: No scope-creep sections added
    Tool: Bash
    Steps: Run `python - <<'PY'
  from pathlib import Path
  text = Path('docs/web-user-flow-sitemap.md').read_text().lower()
  for banned in ['wireframe', 'component spec', 'analytics plan', 'implementation ticket']:
    assert banned not in text, banned
  print('banned-check: OK')
  PY`
    Expected: The banned terms are absent from the initial scaffold.
    Evidence: .sisyphus/evidence/task-1-canonical-scaffold-error.txt
  ```

  **Commit**: YES | Message: `docs(ia): scaffold web flow sitemap artifact` | Files: [`docs/web-user-flow-sitemap.md`]

- [x] 2. Inventory current live routes, embedded surfaces, and states

     **What to do**: Fill `## Sitemap / Page Inventory` with one source-of-truth markdown table containing columns `Surface`, `Type`, `Route/URL`, `Status`, `Purpose`, `Entry points`, `Key states`, `Replaces/redirects`, `Evidence`. Include at minimum these live entries: landing `/`, sign-in `/sign-in`, sign-up `/sign-up`, dashboard `/app`, editor `/app/documents/[documentId]`, dashboard quota summary, dashboard active-doc list, dashboard archived-doc section, provisioning pending state, deleted-account state, editor autosave state, editor outline sidebar, editor archive action, editor delete action. Mark route entries `LIVE`; mark embedded surfaces/states `LIVE` where supported by code.
     **Must NOT do**: Do not promote embedded surfaces into fake routes. Do not omit current redirect/auth behaviors.

     **Recommended Agent Profile**:
  - Category: `writing` — Reason: evidence-backed documentation synthesis
  - Skills: [] — none needed
  - Omitted: [`adapt`] — no responsive design work needed

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: [3, 4, 5] | Blocked By: [1]

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `apps/web/app/page.tsx:6-57` — signed-in redirect and landing auth entry
  - Pattern: `apps/web/app/app/page.tsx:18-117` — dashboard create-document flow, active docs, archived docs, quota text, empty state
  - Pattern: `apps/web/app/app/page.tsx:118-156` — provisioning pending and deleted-account states
  - Pattern: `apps/web/app/app/documents/[documentId]/page.tsx:17-40` — document page auth/deep-link behavior and redirect to `/app`
  - Pattern: `apps/web/components/document-editor.tsx:32-147` — title edit, autosave, archive, delete
  - Pattern: `apps/web/components/document-editor.tsx:149-355` — editor nodes, outline sidebar, empty-outline state

  **Acceptance Criteria** (agent-executable only):
  - [ ] `python - <<'PY'
from pathlib import Path
text = Path('docs/web-user-flow-sitemap.md').read_text()
for required in ['| Surface | Type | Route/URL | Status | Purpose | Entry points | Key states | Replaces/redirects | Evidence |','/','/sign-in','/sign-up','/app','/app/documents/[documentId]','Route','Embedded surface','State','Provisioning','Access removed','Save state:']:
    assert required in text, required
print('inventory-check: OK')
PY`

  **QA Scenarios** (MANDATORY — task incomplete without these):

  ```
  Scenario: Route/surface/state distinction is explicit
    Tool: Bash
    Steps: Run the inventory-check assertion script.
    Expected: The table exists and includes route, embedded surface, and state labels plus core live paths.
    Evidence: .sisyphus/evidence/task-2-live-inventory.txt

  Scenario: Redirect/account states are not lost
    Tool: Bash
    Steps: Run `python - <<'PY'
  from pathlib import Path
  text = Path('docs/web-user-flow-sitemap.md').read_text()
  for required in ['signed-in user hitting / redirects to /app','unauthenticated access redirects to /sign-in','provisioning pending','deleted account']:
    assert required in text, required
  print('state-check: OK')
  PY`
    Expected: The inventory or surrounding prose records the redirect and account-state behavior explicitly.
    Evidence: .sisyphus/evidence/task-2-live-inventory-error.txt
  ```

  **Commit**: YES | Message: `docs(ia): document live web routes and states` | Files: [`docs/web-user-flow-sitemap.md`]

- [x] 3. Author launch MVP and returning-user flows

     **What to do**: Write `## Launch MVP Flow` and `## Returning User Flow` as ordered, evidence-backed steps. Launch flow must explicitly describe: landing/auth entry, goal-based onboarding intent, create document, template-or-blank choice, title/topic entry, optional outline, editor, AI preview/apply choices, manual editing, DOCX export. Returning-user flow must explicitly describe dashboard re-entry, open existing draft, continue writing, AI assist, export. Where a surface is planned but not live, say so using `MVP` status wording rather than pretending it exists today.
     **Must NOT do**: Do not treat onboarding as a fully implemented route. Do not omit AI preview or reversibility rules.

     **Recommended Agent Profile**:
  - Category: `writing` — Reason: narrative workflow synthesis grounded in docs
  - Skills: [] — none needed
  - Omitted: [`copywriting`] — persuasive marketing language is out of scope

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: [4, 5] | Blocked By: [2]

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `docs/PRD.md:215-247` — launch and AI-preview flow rules
  - Pattern: `docs/OPERATIONAL PLAN.md:482-500` — onboarding, template, AI preview, and quota messaging requirements
  - Pattern: `docs/OPERATIONAL PLAN.md:518-537` — export UX and DOCX flow requirements
  - Pattern: `apps/web/app/page.tsx:36-54` — landing message for current sign-in/create-account entry
  - Pattern: `apps/web/app/app/page.tsx:52-66` — current create-document action starting point

  **Acceptance Criteria** (agent-executable only):
  - [ ] `python - <<'PY'
from pathlib import Path
text = Path('docs/web-user-flow-sitemap.md').read_text()
checks = [
    '## Launch MVP Flow',
    '## Returning User Flow',
    'goal-based onboarding',
    'template or blank',
    'optional outline',
    'AI assist preview',
    'apply',
    'insert below',
    'dismiss',
    'DOCX-only export',
]
missing = [c for c in checks if c not in text]
assert not missing, missing
print('launch-flow-check: OK')
PY`

  **QA Scenarios** (MANDATORY — task incomplete without these):

  ```
  Scenario: Core launch path is complete
    Tool: Bash
    Steps: Run the launch-flow-check assertion script.
    Expected: The launch and returning-user sections mention the full login -> create doc -> write -> AI assist -> export path with preview/apply safeguards.
    Evidence: .sisyphus/evidence/task-3-launch-flow.txt

  Scenario: Planned MVP surfaces are not overstated as live
    Tool: Bash
    Steps: Run `python - <<'PY'
  from pathlib import Path
  text = Path('docs/web-user-flow-sitemap.md').read_text()
  for required in ['onboarding — MVP','template chooser — MVP','AI assist preview — MVP','export status/history — MVP','usage/billing detail — MVP']:
    assert required in text, required
  print('planned-mvp-check: OK')
  PY`
    Expected: Planned launch surfaces are present with `MVP` wording instead of `LIVE` wording.
    Evidence: .sisyphus/evidence/task-3-launch-flow-error.txt
  ```

  **Commit**: YES | Message: `docs(ia): add launch and returning-user flows` | Files: [`docs/web-user-flow-sitemap.md`]

- [x] 4. Author beta research flow and boundary rules

     **What to do**: Write `## Beta Research Flow` and `## MVP vs Beta Boundaries`. Beta flow must describe upload PDF → background processing → summary/ask-file → evidence snippet → manual writing back in editor. Boundary section must explicitly state: writing-first launch, AI preview required, DOCX-only export, no mandatory source upload, source upload/retrieval is beta, no workspace-wide chat, no cross-file synthesis in launch, and no full citation automation in launch.
     **Must NOT do**: Do not place beta research inside launch-first onboarding or imply it is required before entering the editor.

     **Recommended Agent Profile**:
  - Category: `writing` — Reason: scope-boundary and beta-lane documentation
  - Skills: [] — none needed
  - Omitted: [`audit`] — this is not a product audit report

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: [5] | Blocked By: [3]

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `docs/PRD.md:249-262` — beta research journey and constraints
  - Pattern: `docs/PRD.md:86-115` — launch scope and deferred capabilities
  - Pattern: `docs/OPERATIONAL PLAN.md:122-150` — launch in-scope, beta after launch, and out-of-scope rules
  - Pattern: `docs/OPERATIONAL PLAN.md:545-589` — beta source upload details and technical boundaries

  **Acceptance Criteria** (agent-executable only):
  - [ ] `python - <<'PY'
from pathlib import Path
text = Path('docs/web-user-flow-sitemap.md').read_text()
checks = [
    '## Beta Research Flow',
    'upload PDF',
    'background processing',
    'summary',
    'ask file',
    'evidence snippet',
    '## MVP vs Beta Boundaries',
    'writing-first launch',
    'no mandatory source upload',
    'DOCX-only',
    'no workspace-wide chat',
    'no cross-file synthesis in launch',
    'no full citation automation in launch',
    'BETA',
]
missing = [c for c in checks if c not in text]
assert not missing, missing
print('beta-boundary-check: OK')
PY`

  **QA Scenarios** (MANDATORY — task incomplete without these):

  ```
  Scenario: Beta lane is isolated from launch
    Tool: Bash
    Steps: Run the beta-boundary-check assertion script.
    Expected: The beta flow and launch boundary rules are both explicit and unambiguous.
    Evidence: .sisyphus/evidence/task-4-beta-boundaries.txt

  Scenario: Source upload is explicitly optional at launch
    Tool: Bash
    Steps: Run `python - <<'PY'
  from pathlib import Path
  text = Path('docs/web-user-flow-sitemap.md').read_text()
  assert 'source upload is not part of the first-time launch flow' in text
  print('optional-source-check: OK')
  PY`
    Expected: The artifact explicitly states that source upload is optional and not part of launch onboarding.
    Evidence: .sisyphus/evidence/task-4-beta-boundaries-error.txt
  ```

  **Commit**: YES | Message: `docs(ia): separate beta research flow from launch` | Files: [`docs/web-user-flow-sitemap.md`]

- [x] 5. Finalize evidence coverage, formatting, and draft handoff note

     **What to do**: Complete `## Evidence Sources` with exact file references and ensure the prose/table cite the supporting file paths. Run formatting and content assertions. Add a brief note near the top or bottom stating that `.sisyphus/drafts/web-user-flow-sitemap.md` was the planning draft and `docs/web-user-flow-sitemap.md` is the canonical artifact. Preserve the draft unless explicitly asked to remove it.
     **Must NOT do**: Do not delete the draft. Do not leave any `TBD`, `todo`, `placeholder`, or undocumented surface statuses.

     **Recommended Agent Profile**:
  - Category: `writing` — Reason: doc finalization and evidence validation
  - Skills: [] — none needed
  - Omitted: [`verification-before-completion`] — task-specific checks are already explicit here

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: [] | Blocked By: [4]

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `.sisyphus/drafts/web-user-flow-sitemap.md:1-49` — planning draft to reference but not canonize
  - Pattern: `apps/web/app/page.tsx:6-57` — landing source evidence
  - Pattern: `apps/web/app/app/page.tsx:18-156` — dashboard and account-state source evidence
  - Pattern: `apps/web/app/app/documents/[documentId]/page.tsx:17-40` — document route and redirect evidence
  - Pattern: `apps/web/components/document-editor.tsx:32-355` — editor and outline evidence
  - Pattern: `docs/PRD.md:215-262` — primary journeys
  - Pattern: `docs/OPERATIONAL PLAN.md:387-537` — web MVP surface and export expectations
  - Pattern: `docs/OPERATIONAL PLAN.md:545-589` — beta flow expectations

  **Acceptance Criteria** (agent-executable only):
  - [ ] `pnpm exec prettier --check docs/web-user-flow-sitemap.md`
  - [ ] `python - <<'PY'
from pathlib import Path
text = Path('docs/web-user-flow-sitemap.md').read_text().lower()
for banned in ['tbd', 'todo', 'placeholder']:
    assert banned not in text, banned
assert '.sisyphus/drafts/web-user-flow-sitemap.md' in Path('docs/web-user-flow-sitemap.md').read_text()
print('final-cleanliness-check: OK')
PY`
  - [ ] `python - <<'PY'
from pathlib import Path
text = Path('docs/web-user-flow-sitemap.md').read_text()
required = [
    'docs/PRD.md',
    'docs/OPERATIONAL PLAN.md',
    'apps/web/app/page.tsx',
    'apps/web/app/app/page.tsx',
    'apps/web/app/app/documents/[documentId]/page.tsx',
    'apps/web/components/document-editor.tsx',
]
missing = [item for item in required if item not in text]
assert not missing, missing
print('evidence-source-check: OK')
PY`

  **QA Scenarios** (MANDATORY — task incomplete without these):

  ```
  Scenario: Final artifact is clean and formatted
    Tool: Bash
    Steps: Run `pnpm exec prettier --check docs/web-user-flow-sitemap.md` and the final-cleanliness-check assertion.
    Expected: Prettier passes and no draft markers/TBD placeholders remain.
    Evidence: .sisyphus/evidence/task-5-finalize-doc.txt

  Scenario: Evidence references are complete
    Tool: Bash
    Steps: Run the evidence-source-check assertion.
    Expected: The final artifact names every source file required by this plan.
    Evidence: .sisyphus/evidence/task-5-finalize-doc-error.txt
  ```

  **Commit**: YES | Message: `docs(ia): finalize canonical web flow sitemap` | Files: [`docs/web-user-flow-sitemap.md`]

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.

- [x] F1. Plan Compliance Audit — oracle
- [x] F2. Code Quality Review — unspecified-high
- [x] F3. Real Manual QA — unspecified-high (+ playwright if UI)
- [x] F4. Scope Fidelity Check — deep

## Commit Strategy

- Use small documentation-only commits in this order:
  1. `docs(ia): scaffold web flow sitemap artifact`
  2. `docs(ia): document live web routes and states`
  3. `docs(ia): add launch and returning-user flows`
  4. `docs(ia): separate beta research flow from launch`
  5. `docs(ia): finalize canonical web flow sitemap`
- Preserve `.sisyphus/drafts/web-user-flow-sitemap.md` unless the user explicitly asks to remove it.

## Success Criteria

- The team can identify launch pages, embedded surfaces, and states without inferring from multiple docs.
- The document clearly distinguishes what is already live, what is planned for MVP, and what is beta-only.
- No route is invented, no beta feature appears mandatory for launch, and no launch-critical AI/export rule is omitted.
