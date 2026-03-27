# Operational Plan

## 1. Tujuan Dokumen

Dokumen ini menerjemahkan PRD V2 menjadi paket eksekusi yang siap dipakai untuk:

- sprint planning,
- alignment product/design/engineering,
- penentuan scope launch,
- penyusunan acceptance criteria per fitur.

Dokumen ini berasumsi bahwa launch awal difokuskan pada **writing-first MVP**, sementara **research flow berbasis PDF** masuk fase beta setelah core writing workflow stabil.

---

## 1A. Progress Implementasi Saat Ini

Status dokumen ini per update terbaru:

- Fondasi monorepo writing-first sudah selesai diimplementasikan.
- Sprint 1 core path sekarang sudah tersedia end-to-end untuk happy path.
- Sprint 2 backend foundation (API & Worker scope) sudah selesai diimplementasikan:
  - Enriched `/v1/me` dengan document stats, onboarding flags, dan detailed usage info.
  - Template system (`GET /v1/templates`) dan document bootstrap (`POST /v1/documents/bootstrap`).
  - Outline generation (`/outline/generate`) dan apply (`/outline/apply`) dengan AI reservation lifecycle.
  - Writing proposal lifecycle (`/ai/proposals`, `/apply`, `/dismiss`) dengan idempotensi dan stale-write protection.
  - Quota ledger (reserve, finalize, release) terintegrasi dengan AI service layer.
  - Regenerasi OpenAPI contract dan API client (`@aqshara/api-client`) yang sinkron dengan backend.
- Sprint 3 backend launch-hardening sudah selesai diimplementasikan:
  - DOCX export async lengkap dengan export history, retry path, preflight warning, dan queue/job lifecycle.
  - Worker export memakai bounded retry policy, terminal-failure handling, graceful shutdown, dan status reconciliation yang lebih aman.
  - Rate limiting sensitif di API sudah dipindahkan ke Redis-backed route-family buckets dengan fail-open/fail-closed policy per jalur.
  - Structured `error_event` monitoring sudah aktif untuk auth/session, document save, AI, export API, dan worker export failures.
  - Structured launch funnel event untuk export tetap dipertahankan, sehingga launch analytics dan operational failure stream terpisah dengan jelas.
- Sprint 4 backend source-processing beta sudah selesai diimplementasikan:
  - Upload source PDF dengan validation, active-source cap per document, dan checksum dedupe untuk queued/processing/ready state.
  - Retry source now carries explicit `forceOcr` from API to queue payload to worker.
  - Worker source parsing has OCR timeout/abort handling, selective OCR fallback, and safer retry/terminal failure behavior.
  - Worker startup reconciliation handles source/job rows stuck in `processing` so crash recovery does not depend on manual DB cleanup.
  - Source quota booking/reservation follows the same plan-aware transactional guardrails as AI/export flows.
- Sprint 1-4 backend scope sekarang sudah dianggap complete; sisa pekerjaan berikutnya lebih banyak berada pada frontend integration dan phase 2 beta feature expansion.
- Struktur aktif repo sekarang adalah:
  - `apps/web` untuk product frontend Next.js
  - `apps/api` untuk Hono REST API
  - `apps/worker` untuk BullMQ worker/background jobs
- `apps/docs` sudah dihapus dari scope aktif.
- `packages/ui` sudah dihapus karena tidak dipakai; UI sementara berada langsung di `apps/web`.
- Package shared yang sudah tersedia:
  - `packages/api-client`
  - `packages/api-spec`
  - `packages/auth`
  - `packages/config`
  - `packages/database`
  - `packages/documents`
  - `packages/observability`
  - `packages/queue`
  - `packages/storage`
  - `packages/eslint-config`
  - `packages/typescript-config`

### Yang sudah selesai

1. Hono API scaffold tersedia dan dapat dijalankan.
2. Swagger/OpenAPI contract tersedia dari API.
3. OpenAPI spec dapat digenerate ke `apps/api/openapi/openapi.json`.
4. API client untuk web dapat digenerate dari OpenAPI spec.
5. Worker scaffold untuk background jobs sudah tersedia.
6. Canonical document model awal sudah tersedia di package shared.
7. Schema database sudah diperluas untuk mendukung:
   - `users.clerk_user_id`
   - `users.plan_code`
   - `documents.type`
   - `documents.archived_at`
8. Clerk provider + route protection di web sudah tersedia.
9. Endpoint session `/v1/me` sudah tersedia sebagai read path for user yang sudah terprovision.
10. Endpoint public webhook `POST /webhooks/clerk` sudah tersedia untuk:
    - `user.created`
    - `user.updated`
    - `user.deleted`
11. Provisioning user internal + workspace default sekarang berjalan via webhook Clerk.
12. Clerk user backfill script tersedia via `pnpm --filter @aqshara/api clerk:backfill` dengan dukungan safe operational check `--dry-run`.
13. Endpoint dokumen berikut sudah tersedia:
    - list documents (`GET /v1/documents`)
    - list recent documents (`GET /v1/documents/recent`) with limit (1-10, default 5)
    - create document
    - get document by id
    - rename/update metadata
    - save content with stale-save protection via `baseUpdatedAt`
    - archive document
    - delete document
14. Dashboard dokumen di web sudah tersedia dengan:
    - create document
    - active documents
    - archived documents
    - recent documents surface
    - empty state dasar
    - provisioning pending state jika webhook belum selesai
    - deleted account state jika user lokal sudah dinonaktifkan
15. Structured editor v1 sudah tersedia dengan block:
    - heading
    - paragraph
    - bullet list
    - outline sidebar
16. Autosave debounce sudah tersedia dan menyimpan `content_json` + `plain_text` melalui API, dengan stale-write protection via `baseUpdatedAt` (`409 stale_document_save`).
17. Root scripts dan Turbo tasks untuk `lint`, `check-types`, `test`, `spec:generate`, `client:generate`, `db:generate`, `db:migrate`, `db:push`, `db:studio`, dan `build` sudah tersedia.
18. Schema database sekarang sudah mendukung soft delete user melalui `users.deleted_at`.

### Verifikasi yang sudah lolos

- `pnpm lint`
- `pnpm check-types`
- `pnpm test`
- `pnpm spec:generate`
- `pnpm client:generate`
- `pnpm db:generate`
- `pnpm build`
- `pnpm --filter @aqshara/api test`
- `pnpm --filter @aqshara/worker test`
- `pnpm --filter @aqshara/observability test`

### Yang masih belum selesai untuk scope launch

1. Verifikasi delivery webhook Clerk untuk environment production masih bergantung pada setup dashboard, tunnel/domain, dan secret nyata.
2. Basic inline formatting dan keyboard shortcuts editor belum tersedia.
3. Snapshot versioning periodik belum tersedia; save path saat ini sudah memiliki stale-write protection tetapi belum memiliki version history periodik.
4. Integrasi penuh frontend dengan quota engine (limit messaging/enforcement di UI) dan onboarding dashboard.

### Implikasi ke execution plan

- Sprint 1-4 backend foundation sudah selesai; jalur inti, AI layer, export hardening, dan source-processing beta sudah operasional.
- Fokus berikutnya bergeser ke:
  - integrasi frontend dengan AI proposal lifecycle,
  - implementasi UI onboarding berbasis template & outline,
  - hardening auth provisioning dan operational webhook flow,
  - usage/quota enforcement di layer UI,
  - research beta / Sprint 5 untuk summary dan Q&A berbasis source.

---

## 2. Ruang Lingkup Launch

### In scope untuk Launch MVP

1. Authentication dan onboarding ringan
2. Document workspace
3. Structured rich text editor
4. AI writing assistant
5. Template dan outline generator
6. DOCX export
7. Freemium + quota dasar
8. Observability dasar, error handling, dan launch hardening

### Beta setelah launch core stabil

1. Upload PDF
2. Parsing dan OCR fallback selektif
3. Per-file summary
4. Per-file Q&A dengan evidence snippet

### Out of scope untuk launch

1. Realtime collaboration
2. Full citation automation
3. Full bibliography engine
4. PDF export production-grade
5. Cross-file synthesis lintas banyak dokumen
6. Institutional dashboard

---

## 3. Prinsip Implementasi

1. **Masuk editor secepat mungkin** — onboarding tidak boleh menghalangi pembuatan draft pertama.
2. **AI selalu bisa direview** — tidak ada destructive replace tanpa preview.
3. **Satu model dokumen kanonik** — editor, AI insertion, dan DOCX export harus berbagi struktur yang sama.
4. **Async untuk kerja berat** — export, parsing, OCR, embedding berjalan di background.
5. **Biaya AI dikontrol dari awal** — quota, output cap, dan pemisahan task ringan vs berat.
6. **Beta research dibatasi** — retrieval hanya per-file terpilih, bukan workspace-wide chat.

---

## 4. Struktur Delivery

### Phase 1 — Launch MVP

Durasi: 6 minggu

### Phase 2 — Research Beta

Durasi: 4 minggu setelah MVP stabil

### Phase 3 — Source-grounded Writing

Durasi: ditentukan setelah validasi beta research

---

## 5. Epic Breakdown

## Epic 1 — Authentication, Account, dan Plan Foundation

### Outcome

User bisa login, memiliki workspace default, dan sistem mengenali plan serta limit dasar.

### User value

User bisa mulai memakai produk dengan friction minimal.

### Scope

- Google sign-in
- Email OTP fallback
- Sync profile internal via Clerk webhook
- Workspace default creation via Clerk webhook
- Fetch current plan dan usage summary ringan

### Acceptance criteria

- User baru bisa login dengan Google dan langsung masuk ke app tanpa error.
- Jika Google gagal/tidak dipakai, user bisa login melalui email OTP.
- Setelah event `user.created` atau `user.updated` diterima dari Clerk, sistem otomatis membuat atau meng-update user internal.
- Setelah provisioning user berhasil, sistem otomatis membuat workspace default jika belum ada.
- User profile internal tersimpan dengan email, nama, avatar jika tersedia.
- Sistem dapat menampilkan plan user dan batas utama yang relevan.
- Session valid dapat dipakai untuk mengakses endpoint dokumen tanpa login ulang di setiap request.
- Jika user sudah login ke Clerk tetapi provisioning lokal belum selesai, app menampilkan state provisioning pending yang jelas.
- Jika user menerima event `user.deleted`, akses ke workspace lokal ditolak tanpa menghapus dokumen secara fisik.

### Dependencies

- Clerk setup
- Clerk webhook setup
- DB schema `users`, `workspaces`
- Auth middleware backend

---

## Epic 2 — Document Workspace dan Navigation

### Outcome

User bisa membuat, membuka, mengelola, dan kembali ke dokumen dengan cepat.

### User value

User tidak bingung memulai dan bisa fokus ke dokumen aktif.

### Scope

- Create document
- Document list
- Recent documents
- Rename document
- Archive document
- Delete document
- Empty state yang jelas

### Acceptance criteria

- User bisa membuat dokumen baru dari dashboard.
- Dokumen baru memiliki tipe `general_paper`, `proposal`, atau `skripsi`.
- Dokumen yang baru dibuka muncul di recent documents.
- User bisa rename dokumen tanpa reload penuh.
- User bisa archive dokumen dan dokumen pindah dari active list.
- User bisa menghapus dokumen dengan konfirmasi yang jelas.
- Empty state menjelaskan langkah pertama yang harus dilakukan user.
- Dashboard tetap usable saat user belum punya dokumen sama sekali.

### Dependencies

- DB schema `documents`
- Basic app shell
- Protected routes

---

## Epic 3 — Structured Editor Core

### Outcome

User memiliki editor stabil untuk menulis dokumen akademik dengan struktur jelas.

### User value

User dapat fokus menulis tanpa terganggu masalah formatting atau kehilangan konten.

### Scope

- Structured JSON document model
- Paragraph, heading, lists
- Basic inline formatting
- Outline sidebar
- Autosave
- Restore state after refresh
- Keyboard shortcuts dasar

### Acceptance criteria

- User bisa mengetik dan memformat teks dasar tanpa lag yang mengganggu.
- Struktur heading tampil konsisten di editor dan outline sidebar.
- Outline sidebar berpindah ke section yang sesuai saat item diklik.
- Autosave berjalan otomatis saat user idle.
- Refresh browser tidak menyebabkan hilangnya perubahan yang sudah tersimpan.
- Dokumen panjang tetap dapat diedit dengan performa yang layak.
- `content_json` menjadi source of truth untuk rendering editor.
- `plain_text` dapat dihasilkan untuk kebutuhan AI/search tanpa mengganggu editing.

### Dependencies

- Editor framework
- Backend save endpoint
- Document schema final

### Technical notes

- Gunakan debounce idle save.
- Hindari full snapshot pada setiap perubahan kecil.
- Siapkan snapshot version periodik, bukan per keystroke.

---

## Epic 4 — Onboarding Berbasis Goal dan Template System

### Outcome

User baru bisa mulai dari jalur yang paling relevan dengan kebutuhan mereka.

### User value

Waktu dari signup ke draft pertama menjadi sangat singkat.

### Scope

- Goal-based onboarding
- Pilihan: general paper, proposal, skripsi, blank doc
- Template default akademik Indonesia
- Insert template structure
- Generate outline dari topik
- Edit outline sebelum insert

### Acceptance criteria

- User baru melihat opsi berbasis tujuan, bukan konfigurasi teknis yang membingungkan.
- User bisa memilih mulai dari blank document.
- User bisa memilih template `general_paper`, `proposal`, atau `skripsi`.
- User bisa memasukkan topik dan meminta sistem membuat outline awal.
- Outline hasil AI dapat direview dan diedit sebelum dimasukkan ke dokumen.
- Template yang dimasukkan menghasilkan heading hierarchy yang valid di editor.
- User dapat melewati generate outline dan langsung masuk editor.

### Dependencies

- Editor core
- AI outline endpoint
- UX copy dan template content

---

## Epic 5 — AI Writing Assistant

### Outcome

User bisa menggunakan AI untuk mempercepat drafting dan revisi tanpa kehilangan kontrol.

### User value

AI terasa membantu, bukan mengambil alih atau merusak isi dokumen.

### Scope

- Continue writing
- Rewrite formal academic Indonesian
- Paraphrase
- Expand
- Simplify
- Generate section draft from prompt
- Selection-aware actions
- Preview diff / preview result panel
- Apply / insert below / dismiss

### Acceptance criteria

- User dapat menjalankan AI dari cursor atau text selection.
- Continue writing bekerja saat user berada di posisi cursor yang valid.
- Rewrite/paraphrase/expand/simplify bekerja pada selection yang jelas.
- Hasil AI selalu tampil dalam preview sebelum diterapkan.
- User bisa memilih `replace`, `insert below`, atau `dismiss` sesuai konteks.
- Tidak ada perubahan destruktif langsung ke konten tanpa aksi eksplisit user.
- Output mengikuti gaya bahasa Indonesia formal akademik secara konsisten.
- Sistem menangani error AI tanpa membuat editor crash.
- Usage event tercatat untuk setiap AI action yang berhasil diproses.

### Dependencies

- Editor core
- Usage service
- AI routing/prompt layer

### Technical notes

- Bedakan task ringan dan berat.
- Terapkan output length cap.
- Gunakan prompt spec per action, bukan satu prompt serbaguna.

---

## Epic 6 — Usage, Quota, dan Plan Enforcement

### Outcome

Sistem dapat membatasi konsumsi fitur secara jelas dan konsisten tanpa race condition.

### User value

User mendapat ekspektasi yang transparan dan tidak bingung saat limit tercapai.

### Scope

- Free dan Pro plan foundation
- Usage event logging
- Monthly usage counters
- Check dan reserve quota
- Limit messaging di UI

### Acceptance criteria

- Sistem dapat membaca limit user berdasarkan plan aktif.
- Sebelum AI action atau export berjalan, sistem melakukan check quota.
- Jika limit habis, user mendapat pesan yang jelas dan tidak misleading.
- Penggunaan tercatat setelah action berhasil diproses.
- Double-submit atau retry tidak menggandakan usage secara tidak benar.
- Dashboard penggunaan menampilkan sisa kuota utama dengan benar.

### Dependencies

- Auth/account foundation
- Usage tables
- AI dan export hooks

### Technical notes

- Check + reserve harus atomik.
- Tentukan kebijakan kegagalan streaming/timeout sejak awal.

---

## Epic 7 — DOCX Export dan Preflight

### Outcome

User dapat mengekspor dokumen dengan struktur yang rapi dan risiko error rendah.

### User value

Draft bisa segera dipakai untuk dikumpulkan atau dilanjutkan di tool lain.

### Scope

- Export DOCX async
- Export history
- Preflight checks
- Failure state dan retry

### Acceptance criteria

- User dapat memicu export DOCX dari dokumen aktif.
- Export berjalan tanpa memblokir editor.
- Sistem menampilkan status export `queued`, `processing`, `ready`, atau `failed`.
- User dapat mengunduh file DOCX yang sudah selesai diproses.
- Heading hierarchy di hasil export konsisten dengan struktur editor.
- Preflight warning muncul jika ada judul kosong, heading kosong, atau placeholder yang belum diselesaikan.
- Jika export gagal, user bisa melihat status gagal dan mencoba lagi.

### Dependencies

- Canonical document model
- Background jobs
- File storage

### Technical notes

- Jangan render dari HTML ad hoc.
- Gunakan document AST yang sama dengan editor.

---

## Epic 8 — Observability, Reliability, dan Launch Hardening

### Outcome

Produk cukup stabil untuk dipakai publik tanpa blind spot operasional besar.

### User value

Error lebih cepat terdeteksi dan pengalaman lebih konsisten.

### Scope

- Error tracking
- Queue monitoring
- Structured logging
- Rate limiting
- Retry policy
- Basic analytics events

### Acceptance criteria

- Error penting pada auth, editor save, AI action, dan export tercatat di monitoring.
- Job queue menampilkan status retry dan terminal failure.
- API sensitif dilindungi rate limiting dasar.
- Analytics event utama dapat dilihat untuk funnel launch.
- Tim dapat membedakan error user-side vs system-side pada jalur utama.
- Launch checklist dapat diverifikasi sebelum go-live.

### Dependencies

- Semua epic utama minimal sudah ada versi stabil

---

## Epic 9 — Research Beta: Source Upload dan Per-file Retrieval

### Outcome

User dapat mengunggah PDF dan memakainya untuk ringkasan dan Q&A terbatas per file.

### User value

Riset jadi lebih cepat tanpa mengubah launch menjadi produk yang terlalu kompleks.

### Scope

- Upload PDF
- Parse text
- OCR fallback selektif
- Per-file summary
- Per-file Q&A
- Evidence snippet
- File processing status UX
- Retry parse

### Acceptance criteria

- User dapat mengunggah PDF dengan validasi ukuran dan tipe file.
- File yang valid masuk ke status processing tanpa memblokir editor.
- Sistem menampilkan status yang mudah dipahami user.
- Jika parsing standar gagal, sistem dapat menawarkan retry dengan OCR bila masuk kriteria.
- User dapat meminta ringkasan dari satu file yang sudah siap.
- User dapat mengajukan pertanyaan terhadap satu file yang sudah siap.
- Jawaban menampilkan evidence snippet yang relevan.
- Scope default retrieval adalah satu file yang dipilih, bukan seluruh workspace.
- Sistem memberi error state yang jelas bila file gagal diproses.

### Dependencies

- Storage
- Background jobs
- Retrieval pipeline
- Usage/quota integration

### Technical notes

- Jangan aktifkan cross-file synthesis pada beta awal.
- OCR hanya fallback, tidak dijalankan agresif.
- Parsing, chunking, embedding, summary harus idempotent.

---

## 6. Sprint Plan — Phase 1 Launch MVP

## Sprint 1 (Minggu 1–2)

### Goal

Menetapkan fondasi produk: auth, workspace, document CRUD, dan editor dasar.

### Fokus delivery

- Epic 1: Auth/account foundation
- Epic 2: Document workspace
- Epic 3: Editor core versi awal

### Deliverables

- Monorepo foundation:
  - `apps/web`
  - `apps/api`
  - `apps/worker`
  - shared packages inti
- OpenAPI/Swagger contract + generated API client untuk web
- Login Google + email OTP fallback
- Workspace default
- Dashboard dokumen
- Create/open/rename/archive/delete dokumen
- Editor basic dengan paragraph + heading + list
- Autosave awal
- Recent documents

### Status implementasi sprint

- Sudah selesai di repo:
  - Clerk integration dan protected routes di web
  - session read endpoint + Clerk webhook provisioning untuk user/workspace
  - Clerk user backfill strategy/script (termasuk `--dry-run` untuk safe operational check tanpa akses Clerk live)
  - document dashboard dengan list "recent documents"
  - create/open/rename/archive/delete dokumen
  - editor basic dengan paragraph + heading + list
  - outline sidebar
  - autosave awal dengan stale-save protection via `baseUpdatedAt` (`409 stale_document_save`)
- Masih tersisa / perlu hardening:
  - validasi langsung Google sign-in + email OTP fallback pada env Clerk nyata
  - validasi delivery webhook Clerk pada domain/tunnel production-like
  - keyboard shortcuts editor

### Exit criteria sprint

- User bisa login, membuat dokumen, mengetik, lalu membuka kembali dokumen yang sama tanpa kehilangan konten.
- Dashboard usable untuk user baru maupun user yang sudah punya beberapa dokumen.

### Risiko sprint

- Auth integration molor
- Pemilihan editor framework belum final
- Autosave write pattern terlalu berat
- Fondasi API sudah ada, tetapi boundary service masih perlu dijaga agar tidak bocor ke web secara langsung

### QA focus

- Refresh recovery
- Session expiration
- Race condition save sederhana

---

## Sprint 2 (Minggu 3–4)

### Goal

Membuat workflow drafting benar-benar berguna dengan onboarding goal-based, template, outline, dan AI writing.

### Fokus delivery

- Epic 4: Onboarding + template
- Epic 5: AI writing assistant
- Epic 6: Usage/quota foundation

### Deliverables

- Goal-based onboarding
- Template default `general_paper`, `proposal`, `skripsi`
- Outline generator
- AI actions: continue, rewrite, paraphrase, expand, simplify
- Preview apply/insert below/dismiss
- Usage events dan counter dasar
- Plan limit read path

### Exit criteria sprint

- User baru bisa masuk dari onboarding hingga memiliki draft awal yang usable.
- AI actions utama berjalan stabil dan hasilnya bisa direview sebelum diterapkan.
- Quota dasar mulai enforced pada AI action.

### Risiko sprint

- Kualitas output AI bahasa Indonesia tidak konsisten
- UX AI panel membingungkan bila terlalu banyak opsi
- Usage event belum cukup andal untuk limit enforcement

### QA focus

- Selection edge cases
- Large prompt handling
- Rate limit dan error message clarity

### Status implementasi sprint

- Sudah selesai di repo (Backend focus):
  - Canonical `DocumentValue` AST (@aqshara/documents).
  - Quota ledger foundation & reservation lifecycle (reserve/finalize/release).
  - AI writing service layer dengan fake provider support.
  - Enriched `/v1/me` (stats, onboarding logic, usage).
  - Template listing & document bootstrap routes.
  - Outline generate/apply routes.
  - Writing proposal generation/apply/dismiss routes.
  - Regenerasi API Client sinkron dengan route baru.
- Masih tersisa / perlu hardening (Integration & Frontend focus):
  - Integrasi UI onboarding dengan backend template/outline endpoints.
  - Integrasi editor dengan AI proposal lifecycle (apply/dismiss UI).
  - Quota enforcement & messaging di layer frontend.
  - Hardening AI prompt untuk variasi input user.

---

## Sprint 3 (Minggu 5–6)

### Goal

Menyelesaikan launch path dengan export, observability, hardening, dan final polish.

### Fokus delivery

- Epic 7: DOCX export
- Epic 8: Observability/reliability/hardening
- Penyempurnaan epic 3–6 bila masih ada gap launch-critical

### Deliverables

- DOCX export async
- Export history dan status
- Preflight check
- Error tracking
- Queue monitoring dasar
- Structured logging
- Rate limiting
- Launch analytics
- Launch checklist verification

### Exit criteria sprint

- User dapat membuat dokumen, memakai AI, lalu export DOCX tanpa flow blocker besar.
- Error pada jalur inti terlihat dan bisa ditindaklanjuti tim.
- Free user mendapat feedback yang jelas saat limit tercapai.

### Risiko sprint

- Export fidelity tidak sesuai ekspektasi
- Job queue belum cukup stabil
- Launch polish memakan waktu lebih besar dari perkiraan

### QA focus

- DOCX formatting parity
- Export retry dan failure recovery
- Plan limit UI dan observability coverage

### Status implementasi sprint

- Sudah selesai di repo (Backend focus):
  - DOCX export async end-to-end dengan request/replay idempotensi, export history, ready/download flow, dan retry endpoint.
  - Preflight warning untuk export DOCX dan retry policy BullMQ dengan exponential backoff.
  - Worker export failure strategy untuk membedakan retryable vs terminal failure, plus graceful shutdown worker.
  - Structured `launch_event` untuk funnel export dan structured `error_event` untuk auth/session, stale save, AI failures, export request/retry/download failures, serta worker export failures.
  - Redis-backed rate limiting untuk route sensitif dengan route-family bucket, authenticated/IP split, dan degradation policy yang explicit.
  - Monitoring metadata sekarang membedakan jalur user-side vs system-side lewat `failureClass`.
- Masih tersisa / perlu closeout:
  - Validasi ingress/proxy production agar header IP tidak spoofable untuk IP-based limiting.
  - Launch checklist final / go-live verification tetap perlu dijalankan sebagai aktivitas operasional, bukan sekadar implementasi code path.

---

## 7. Sprint Plan — Phase 2 Research Beta

## Sprint 4 (Minggu 7–8)

### Goal

Membangun pipeline upload dan parsing file.

### Fokus delivery

- Upload PDF
- Source status UX
- Parsing pipeline
- Retry dan failure state

### Deliverables

- Upload dan validasi file
- Status processing user-facing
- Parse text
- OCR fallback selektif
- Source entity dan storage integration

### Exit criteria sprint

- User dapat mengunggah file dan melihat progres pemrosesan yang jelas.
- File berhasil diparse atau gagal dengan pesan yang bisa ditindaklanjuti.

### Status implementasi sprint

- Sudah selesai di repo (Backend focus):
  - Upload URL, register, list, status, retry, dan delete source endpoints.
  - Active-source cap per document, in-flight dedupe, retry semantics yang eksplisit, dan worker recovery untuk job stuck.
  - OCR fallback selective dengan timeout/abort handling pada worker.
  - Queue payload dan OpenAPI contract sudah sinkron dengan backend source flow terbaru.
- Masih tersisa / perlu closeout:
  - Source summary/Q&A beta flow dari Sprint 5.
  - UX frontend untuk progress/status/error handling source ingestion.

---

## Sprint 5 (Minggu 9–10)

### Goal

Mengaktifkan ringkasan dan Q&A terbatas berbasis satu file.

### Fokus delivery

- Retrieval per-file
- Summary
- Source Q&A
- Evidence snippet
- Quota integration untuk research beta

### Deliverables

- Per-file summary
- Per-file ask
- Evidence snippet UI
- Retry parse / retry summary flow
- Beta feature guard dan quota

### Exit criteria sprint

- User dapat mengambil insight dari satu file tanpa harus keluar dari workspace.
- Jawaban retrieval menunjukkan evidence yang cukup untuk membangun trust.

---

## 8. Backlog Prioritas Setelah Beta

1. Reference normalization
2. Citation insertion flow
3. Bibliography draft generator
4. Source-grounded writing block untuk section tertentu
5. Cross-file synthesis terbatas pada selected files
6. PDF export
7. Advanced version history
8. Optional import dari dokumen existing

---

## 9. Definition of Done per Layer

### Product/UX

- Flow sudah memiliki empty state, loading, success, dan error state.
- Tidak ada langkah penting yang hanya tersirat tanpa petunjuk UI.
- Semua destructive action memiliki konfirmasi atau reversibility yang memadai.

### Engineering

- Endpoint terdokumentasi.
- Error state terstruktur.
- Logging minimum tersedia.
- Idempotency diterapkan pada job berat.
- Schema migration aman dan rollback-aware.

### QA

- Happy path lolos.
- Edge cases utama lolos.
- Permission/auth case lolos.
- Regression pada editor save, AI apply, dan export dicek.

### Analytics

- Event utama tercatat:
  - signup complete
  - document created
  - template selected
  - outline generated
  - ai action requested
  - ai action applied
  - export requested
  - export completed
  - source uploaded
  - source query completed

---

## 10. Keputusan Produk yang Tidak Boleh Dibuka Lagi Saat Execution

1. Launch tetap writing-first, bukan research-first.
2. PDF research hanya beta terbatas per-file.
3. DOCX adalah satu-satunya export yang didukung di launch.
4. User tidak dipaksa upload source pada first-time flow.
5. Semua AI action wajib preview sebelum apply.
6. Cross-file research tidak masuk launch.
7. Full citation automation tidak masuk launch.

---

## 11. Risiko Program-Level

### Risiko 1 — Scope creep dari tim internal

**Mitigasi:** semua request baru dipetakan ke launch / beta / backlog; tidak masuk sprint aktif tanpa tradeoff eksplisit.

### Risiko 2 — Editor dan AI integration menjadi terlalu rapuh

**Mitigasi:** finalkan document AST lebih awal dan jangan ubah semantik node di tengah sprint tanpa alasan kuat.

### Risiko 3 — AI cost naik sebelum monetization valid

**Mitigasi:** enforce quota sejak sprint 2, batasi output length, dan bedakan model untuk task ringan vs berat.

### Risiko 4 — Research beta menyedot fokus launch

**Mitigasi:** phase 2 baru dimulai setelah core launch metrics stabil.

---

## 12. Launch Readiness Review Questions

1. Apakah user baru bisa sampai ke draft pertama dalam <= 2 menit?
2. Apakah AI assistant meningkatkan kecepatan drafting tanpa membuat user kehilangan kontrol?
3. Apakah autosave dan restore cukup stabil untuk dipakai pada dokumen panjang?
4. Apakah DOCX export konsisten dengan struktur editor?
5. Apakah limit dan quota terasa jelas, bukan mengejutkan?
6. Apakah tim bisa melihat dan mendiagnosis error utama setelah go-live?

---

## 13. Rekomendasi Operasional untuk Tim

### Untuk Product Manager

- Kunci scope launch dan tolak penambahan fitur yang tidak mendukung jalur `login -> create doc -> write -> AI assist -> export`.

### Untuk Product Designer

- Prioritaskan three critical flows:
  1. first-time entry,
  2. AI apply flow,
  3. export preflight.

### Untuk Software Architect / Tech Lead

- Finalkan canonical document model sebelum AI dan export dikerjakan paralel.
- Pastikan usage/quota dan job idempotency tidak ditunda ke akhir.

### Untuk Engineering Manager

- Jangan jalankan research beta paralel penuh dengan hardening launch bila kapasitas tim terbatas.

---

## 14. Ringkasan Eksekusi

Urutan eksekusi yang paling sehat adalah:

1. fondasi auth + document + editor,
2. AI drafting + template + onboarding,
3. quota + export + hardening,
4. baru research beta terbatas.
