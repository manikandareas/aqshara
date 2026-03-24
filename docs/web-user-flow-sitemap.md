# Aqshara Web User Flow and Sitemap

## Purpose

This document provides a canonical overview of the web information architecture, user flows, and page inventory for Aqshara. It distinguishes between live functionality, planned MVP surfaces, and beta research capabilities to ensure a clear understanding of the product's current state and roadmap boundaries.

> [!NOTE]
> This document is the canonical artifact. The initial planning draft was located at `.sisyphus/drafts/web-user-flow-sitemap.md`.

## Status Legend

- **LIVE**: Currently implemented and accessible in the production/development environment.
- **MVP**: Planned for the initial Minimum Viable Product launch; not yet live.
- **BETA**: Planned for the beta research phase following the MVP launch.
- **FUTURE**: Post-beta capabilities and long-term roadmap items.

## Launch MVP Flow

The Launch MVP flow focuses on a **writing-first** journey, moving users from landing to a structured draft as quickly as possible.

1. **Entry & Onboarding**:
  - **Landing (`/`) — LIVE**: Anonymous users see the product value and entry points.
    - **Auth Entry (`/sign-in`, `/sign-up`) — LIVE**: Users authenticate via Google or Email OTP.
    - **goal-based onboarding — MVP**: New users select their writing intent (e.g., "Tulis skripsi", "Tulis makalah") to bootstrap their first workspace. This is a planned onboarding surface, not a currently implemented route.
2. **Document Creation**:
  - **Create Document — LIVE**: From the dashboard, users enter a title and select a type.
    - **template or blank — MVP**: Users choose between a pre-structured **template** (General Paper, Proposal, Skripsi) or a **blank** document.
    - **template chooser — MVP**: A planned surface for selecting academic templates.
    - **optional outline — MVP**: Users can optionally provide a topic to generate an initial structure before entering the editor.
3. **Writing & AI Assistance**:
  - **Editor (`/app/documents/[id]`) — LIVE**: Users write in a structured block editor with autosave and a persistent outline.
    - **AI assist preview — MVP**: When using AI actions (continue, rewrite, expand, etc.), the system shows a preview of the changes.
    - **apply / insert below / dismiss — MVP**: Users must explicitly choose to **apply** the change, **insert below** the current block, or **dismiss** the suggestion. No auto-replace occurs without review.
4. **Completion**:
  - **DOCX-only export — MVP**: Users export their structured draft to a standard DOCX file.
    - **export status/history — MVP**: A planned surface to track background export jobs and download previous versions.

## Returning User Flow

Returning users are fast-tracked back into their active work with clear visibility into their progress and limits.

1. **Dashboard Re-entry**:
  - **dashboard re-entry (`/app`) — LIVE**: Signed-in users hitting `/` are redirected to the dashboard.
    - **usage/billing detail — MVP**: Users see their current plan and remaining quota (AI actions, exports) in the dashboard header.
2. **Continue Writing**:
  - **open existing draft — LIVE**: Users select a document from the **Active documents** list.
    - **continue writing — LIVE**: The editor restores the last saved state, allowing the user to pick up exactly where they left off.
3. **Refine & Finalize**:
  - **AI assist — MVP**: Users refine existing sections using academic rewrite or expansion tools.
    - **export — MVP**: Users trigger a final export once the draft is complete.

## Beta Research Flow

The Beta Research flow introduces **source-aware** capabilities, allowing users to ground their writing in specific PDF documents. This flow is secondary to the writing-first journey and is clearly labeled as **BETA**.

1. **Source Integration**:
  - **upload PDF — BETA**: Users upload PDF documents (up to 5 active files per document) to their workspace.
    - **background processing — BETA**: Files are processed asynchronously (text extraction, chunking, embedding). Users can continue writing while processing runs.
    - **file status UX — BETA**: Users see clear status indicators: `queued`, `processing`, `ready`, or `failed`.
2. **Insight Extraction**:
  - **summary — BETA**: Users can request a per-file summary once a source is `ready`.
    - **ask file — BETA**: Users can ask questions directly to a specific file (per-file Q&A).
    - **evidence snippet — BETA**: Answers from the source include a direct quote or snippet from the PDF to ensure trust.
3. **Writing with Sources**:
  - **manual writing — BETA**: Users manually incorporate insights from the research panel back into the editor.
    - **no cross-file synthesis in launch — BETA**: Retrieval is limited to a single selected file; multi-file synthesis is a future capability.

## Sitemap / Page Inventory




| Surface              | Type             | Route/URL                     | Status | Purpose                      | Entry points            | Key states                                     | Replaces/redirects                                        | Evidence                                           |
| -------------------- | ---------------- | ----------------------------- | ------ | ---------------------------- | ----------------------- | ---------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------- |
| Landing              | Route            | `/`                           | LIVE   | Product intro & auth entry   | Direct                  | Anonymous                                      | signed-in user hitting / redirects to /app                | `apps/web/app/page.tsx`                            |
| Sign In              | Route            | `/sign-in`                    | LIVE   | Clerk auth (Sign In)         | `/`, Clerk modal        | Unauthenticated                                | Redirect to `/app` on success                             | `apps/web/app/sign-in/[[...sign-in]]/page.tsx`     |
| Sign Up              | Route            | `/sign-up`                    | LIVE   | Clerk auth (Sign Up)         | `/`, `/sign-in`         | Unauthenticated                                | Redirect to `/app` on success                             | `apps/web/app/sign-up/[[...sign-up]]/page.tsx`     |
| Dashboard            | Route            | `/app`                        | LIVE   | Workspace management         | `/`, `/sign-in`         | Authenticated                                  | unauthenticated access redirects to /sign-in              | `apps/web/app/app/page.tsx`                        |
| Document Editor      | Route            | `/app/documents/[documentId]` | LIVE   | Core writing workspace       | Dashboard list          | Document loaded                                | Redirect to `/app` on provisioning/deleted-account errors | `apps/web/app/app/documents/[documentId]/page.tsx` |
| Quota Summary        | Embedded surface | `/app`                        | LIVE   | Plan and usage status        | Dashboard (Top)         | -                                              | -                                                         | `apps/web/app/app/page.tsx`                        |
| Active-doc List      | Embedded surface | `/app`                        | LIVE   | Recent drafts access         | Dashboard (Middle)      | Empty state                                    | -                                                         | `apps/web/app/app/page.tsx`                        |
| Archived-doc Section | Embedded surface | `/app`                        | LIVE   | Access to archived work      | Dashboard (Bottom)      | Hidden if empty                                | -                                                         | `apps/web/app/app/page.tsx`                        |
| Editor Outline       | Embedded surface | `/app/documents/[documentId]` | LIVE   | Document structural nav      | Editor (Sidebar)        | Empty state (missing headings)                 | -                                                         | `apps/web/components/document-editor.tsx`          |
| Provisioning         | State            | `/app`                        | LIVE   | Account setup in progress    | Dashboard fetch         | provisioning pending                           | Blocking dashboard view                                   | `apps/web/app/app/page.tsx`                        |
| Access removed       | State            | `/app`                        | LIVE   | Account disabled             | Dashboard fetch         | deleted account                                | Blocking dashboard view                                   | `apps/web/app/app/page.tsx`                        |
| Autosave             | State            | `/app/documents/[documentId]` | LIVE   | Content persistence          | Editor input            | Save state: `idle`, `saving`, `saved`, `error` | -                                                         | `apps/web/components/document-editor.tsx`          |
| Archive Action       | State            | `/app/documents/[documentId]` | LIVE   | Document status change       | Editor header           | `handleArchive`                                | Redirect to `/app` on success                             | `apps/web/components/document-editor.tsx`          |
| Delete Action        | State            | `/app/documents/[documentId]` | LIVE   | Permanent removal            | Editor header           | `handleDelete`                                 | Redirect to `/app` on success                             | `apps/web/components/document-editor.tsx`          |
| Goal Onboarding      | Embedded surface | -                             | MVP    | Goal-based intent selection  | Post-signup first visit | makalah, proposal, skripsi                     | -                                                         | `docs/PRD.md`                                      |
| Template Chooser     | Embedded surface | -                             | MVP    | Academic structure selection | Onboarding/New doc      | template, blank                                | -                                                         | `docs/PRD.md`                                      |
| AI Assist Preview    | Embedded surface | `/app/documents/[documentId]` | MVP    | AI change review panel       | Editor AI action        | apply, insert below, dismiss                   | -                                                         | `docs/PRD.md`                                      |
| Export Status        | Embedded surface | `/app`                        | MVP    | Background job tracking      | Dashboard/Editor        | queued, processing, ready, failed              | -                                                         | `docs/PRD.md`                                      |
| Export History       | Embedded surface | `/app`                        | MVP    | Previous export downloads    | Dashboard/Profile       | -                                              | -                                                         | `docs/PRD.md`                                      |
| Usage Detail         | Embedded surface | `/app`                        | MVP    | Quota and billing breakdown  | Dashboard header        | quota warning                                  | -                                                         | `docs/PRD.md`                                      |
| Upload PDF           | Embedded surface | `/app/documents/[documentId]` | BETA   | Source file ingestion        | Research sidebar        | -                                              | -                                                         | `docs/PRD.md`                                      |
| Source Summary       | Embedded surface | `/app/documents/[documentId]` | BETA   | Per-file AI summary          | Research sidebar        | -                                              | -                                                         | `docs/PRD.md`                                      |
| Ask File             | Embedded surface | `/app/documents/[documentId]` | BETA   | Per-file Q&A                 | Research sidebar        | evidence snippet                               | -                                                         | `docs/PRD.md`                                      |
| Processing Status    | State            | `/app/documents/[documentId]` | BETA   | Ingestion progress           | Research sidebar        | queued, processing, ready, failed              | -                                                         | `docs/PRD.md`                                      |


## MVP vs Beta Boundaries

To maintain a **writing-first launch** positioning, the following boundaries define the scope of the MVP versus the Beta research phase:

- **Launch Philosophy**: The initial release is a writing-first tool, not a research-first platform. The source upload is not part of the first-time launch flow; users are encouraged to start a draft immediately.
- **File Types**: The launch is strictly **DOCX-only** for export to ensure standard academic compatibility.
- **AI Controls**: **AI assist preview** is required for all changes; no auto-replace occurs without a user's `apply` or `insert below` action.
- **Retrieval Limits**: There is **no workspace-wide chat** and **no cross-file synthesis in launch**. AI only accesses the current draft or a single, explicitly selected source file.
- **Citations**: There is **no full citation automation in launch** and no automatic bibliography engine. These are planned for the post-beta "Source-grounded Writing" phase.
- **Onboarding**: There is no mandatory source upload during the initial signup or project creation. Users choose their goal (e.g., "Tulis skripsi") and move directly to a template or outline.

## Evidence Sources

The documentation in this file is grounded in the following sources:

- Product Requirements: `docs/PRD.md`
- Implementation Strategy: `docs/OPERATIONAL PLAN.md`
- Routing & Landing: `apps/web/app/page.tsx`
- Dashboard Implementation: `apps/web/app/app/page.tsx`
- Document Loading: `apps/web/app/app/documents/[documentId]/page.tsx`
- Editor Interaction: `apps/web/components/document-editor.tsx`

