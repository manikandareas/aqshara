# Learnings

- Scaffold creation requires exact heading matching for downstream tasks.
- Using a status legend (LIVE, MVP, BETA, FUTURE) is a effective way to manage project boundaries in documentation.
- Discipline: Stay strictly within the file and task boundaries defined in the plan to avoid unintended side effects.
- Evidence Integrity: Ensure cited source files exist before including them in documentation.
- Redirect logic is split between server components (Home, Dashboard) and client components (Editor actions).
- Dashboard uses a single fetch call for multiple sections (Quota, Active, Archived), which can trigger blocking states like Provisioning or Access Removed.
- Editor autosave states follow a simple finite state machine: idle, saving, saved, error.
- Precise conformance repair: Markdown table headers must match the required string exactly (no extra padding).
- Assertion strings like "signed-in user hitting / redirects to /app" and "Save state:" must be included verbatim to pass Task 2 checks.
- Using HEREDOC with a quoted delimiter ('EOF') is more reliable for writing large blocks of text that include special characters like brackets or dollar signs, as it prevents shell expansion.
  12: - When documenting flows that bridge current reality and planned surfaces, labeling planned components as `MVP` vs. `LIVE` ensures the documentation remains evidence-backed without being misleading.
  13: - Goal-based onboarding is a key differentiator in the PRD, focusing on user intent (makalah, proposal, skripsi) rather than technical document types.
  14: - AI assistant previews (apply, insert below, dismiss) are non-negotiable for academic integrity, as confirmed by the PRD's "AI should assist, not hijack" principle.
  15: - Documentation regressions in markdown tables are common when using text editors that auto-format or add padding to cells.
  16: - Exact string matching assertions (like those for table headers) require byte-perfect alignment; surgical tools (like Python scripts or Write tool) are more reliable than Edit tool for restoring such compliance.
- Exact string matching for table headers requires byte-perfect alignment; surgical tools (like Python scripts or Write tool) are more reliable than Edit tool for restoring such compliance.
- Beta research flow and boundary rules must be clearly separated to maintain the "writing-first" launch positioning.
- Including exact assertion strings (e.g., "no workspace-wide chat", "DOCX-only") in the documentation ensures automated verification tools can confirm adherence to the project roadmap.
- Final handoff requires transitioning from planning drafts to canonical artifacts while preserving historical path references for audit trails.
- Prettier checks on markdown files are sensitive to table alignment and spacing; using the `Write` tool with correctly pre-formatted content is more reliable than incremental `Edit` calls for table maintenance.
- Exact heading compliance (e.g., `## Evidence Sources` vs `## Evidence Coverage`) is critical for automated verification pipelines even if the content is functionally identical.
- Final-wave compliance: A single source-of-truth inventory must cover the full scope of the project plan, including planned MVP and BETA surfaces, to satisfy substantive review requirements.
