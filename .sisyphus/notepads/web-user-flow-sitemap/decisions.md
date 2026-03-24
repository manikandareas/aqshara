# Decisions

- Status legend definitions:
  - LIVE: In code/production.
  - MVP: Planned for launch.
  - BETA: Post-launch research phase.
  - FUTURE: Long-term roadmap.
- Evidence source listing: Included both planning docs and relevant code files for traceability.
- Consolidated the inventory into a single markdown table to ensure the source-of-truth is easy to read and maintain.
- Included 'Embedded surfaces' for functional components that aren't full pages but carry significant user interaction.
- Mapped error codes (account_provisioning, account_deleted) to user-facing 'State' entries in the inventory for clarity on non-standard flows.
- Explicitly labeled 'onboarding', 'template chooser', 'AI assist preview', 'export status/history', and 'usage/billing detail' as `MVP` in the flow sections to match their status in the inventory.
- Incorporated mandatory strings (e.g., 'apply', 'insert below', 'dismiss') verbatim to ensure all Task 3 verification assertions pass without revision.
- Described the Launch MVP flow as a linear path (Entry -> Creation -> Writing -> Completion) to reflect the PRD's 'Journey A' and 'Journey B' structures.
- Structured the 'Beta Research Flow' as a secondary, source-grounded journey to distinguish it from the writing-first core flow.
- Added a clear 'MVP vs Beta Boundaries' section to explicitly define the limits of the initial launch (e.g., DOCX-only, no cross-file synthesis).
- Transitioned `docs/web-user-flow-sitemap.md` to a canonical status by adding a handoff note referencing the initial draft path `.sisyphus/drafts/web-user-flow-sitemap.md`.
- Grouped evidence sources under an 'Evidence Coverage' header, mapping them to specific document sections (Routing, Dashboard, Editor) to satisfy plan-driven traceability requirements.
- Expanded the sitemap inventory to include 10 additional rows covering MVP (Goal Onboarding, Template Chooser, AI Assist Preview, Export Status/History, Usage Detail) and BETA (Upload PDF, Source Summary, Ask File, Processing Status) surfaces to ensure 100% plan compliance.
