# PRD V2 — AI Academic Writing Workspace for Indonesian Students

## 1. Ringkasan Produk

Membangun aplikasi web untuk membantu mahasiswa Indonesia **memulai, menyusun, dan menyelesaikan tulisan akademik lebih cepat** melalui editor yang stabil, AI writing assistant berbahasa Indonesia formal, template struktur akademik, serta workflow riset yang bertahap dan source-aware.

**Prinsip V2:**
Produk tidak lagi diposisikan sebagai “semua hal sekaligus” pada launch. Fokus launch adalah **writing workspace yang cepat, jelas, dan dapat dipercaya**. Workflow riset berbasis PDF, citation, dan bibliography tetap masuk roadmap produk, tetapi dirilis bertahap.

---

## 2. Masalah Utama

Mahasiswa Indonesia sering mengalami hambatan berikut:

- Sulit memulai tulisan dari nol.
- Bingung menyusun struktur tulisan akademik yang rapi.
- Terlalu banyak pindah tool untuk drafting, parafrase, baca PDF, dan rapikan sitasi.
- Sering menyalin output AI mentah tanpa alur review yang aman.
- Kehilangan waktu di formatting, bukan di pemikiran inti.

---

## 3. Visi Produk

Menjadi **workspace menulis akademik berbasis AI paling praktis untuk mahasiswa Indonesia**, dari topik kosong hingga draft yang rapi, dengan bantuan AI yang cepat, mudah dikendalikan, dan transparan terhadap sumber.

---

## 4. Positioning Produk

### Positioning statement

Untuk mahasiswa Indonesia yang perlu menyelesaikan tulisan akademik dengan cepat, produk ini adalah **AI academic writing workspace** yang membantu menyusun struktur, menulis draft, dan memanfaatkan referensi secara lebih rapi dalam satu alur kerja.

### Bukan tujuan launch

- Bukan pengganti Turnitin
- Bukan reference manager penuh seperti Zotero/Mendeley
- Bukan collaborative editor multi-user
- Bukan institutional dashboard
- Bukan platform dengan ratusan citation style

---

## 5. Tujuan Produk

### Tujuan bisnis

- Memvalidasi problem-solution fit di segmen mahasiswa Indonesia.
- Mencapai usage aktif mingguan yang sehat pada user yang sedang menulis tugas.
- Membuka monetisasi freemium dengan struktur biaya AI yang terkendali.

### Tujuan pengguna

- Masuk ke dokumen pertama dan mulai menulis dalam hitungan menit.
- Mendapat draft awal yang lebih rapi dan lebih cepat.
- Memperbaiki tulisan tanpa takut hasil AI langsung merusak isi.
- Memakai referensi dengan cara yang lebih terarah dan tidak membingungkan.

---

## 6. Persona Target

### Primary persona

**Mahasiswa S1 Indonesia**

- Menulis makalah, laporan, proposal, atau paper umum
- Butuh hasil cepat
- Tidak ingin belajar tool yang rumit
- Lebih peduli “tugas selesai rapi” daripada konfigurasi teknis

### Secondary persona

**Mahasiswa tingkat akhir / skripsi**

- Lebih sering bekerja dengan PDF jurnal
- Perlu outline, drafting, ringkasan, dan sitasi yang lebih serius
- Lebih sensitif terhadap kualitas struktur dan sumber

---

## 7. Keputusan Produk Final di V2

### 7.1 Scope launch

**Launch scope hanya mencakup:**

1. Auth + onboarding ringan
2. Document workspace
3. Rich text editor stabil
4. AI writing assistant
5. Outline/template generator
6. DOCX export
7. Freemium + quota dasar
8. Source upload terbatas sebagai **beta riset**, bukan fitur inti launch

### 7.2 Fitur yang ditunda ke phase berikutnya

- Multi-file cross-document Q&A penuh
- Citation insertion otomatis penuh
- Bibliography auto-build penuh
- PDF export production-grade
- Workspace-level research chat
- Advanced source library management

### 7.3 Keputusan open questions yang ditutup

- **Template awal:** produk menyediakan template default akademik Indonesia yang bisa diedit user
- **Paid plan saat launch:** satu tier berbayar (`pro`)
- **Social login saat launch:** Google login + email OTP fallback; tidak ada Apple/GitHub di launch
- **Batas file riset:** maksimal 5 file aktif per dokumen pada mode beta
- **Free tier export:** DOCX penuh tersedia; PDF tidak tersedia di launch free tier

---

## 8. Prinsip Produk

1. **Start fast** — user harus bisa mulai menulis cepat tanpa setup yang berat.
2. **AI should assist, not hijack** — output AI harus bisa direview sebelum masuk ke dokumen.
3. **Grounded when needed** — mode berbasis sumber harus dibedakan jelas dari mode free writing.
4. **Progressive complexity** — fitur kompleks muncul setelah user butuh, bukan di awal.
5. **One stable document model** — editor, AI insertion, dan export harus berbasis struktur dokumen yang sama.
6. **Cost-aware by design** — semua fitur AI dan retrieval dibatasi dengan guardrail biaya dan latency.

---

## 9. Scope Produk

## 9.1 Launch MVP

### A. Authentication & onboarding

- Google sign-in
- Email OTP fallback
- Bootstrap profile internal
- Pembuatan workspace default
- Onboarding berbasis tujuan:
  - Tulis makalah/paper umum
  - Tulis proposal
  - Tulis skripsi
  - Mulai dari dokumen kosong

### B. Document workspace

- Buat, buka, rename, archive, delete dokumen
- Recent documents
- Empty state yang jelas
- Autosave

### C. Editor core

- Heading, paragraph, bold, italic, bullet list, numbered list
- Outline sidebar
- Placeholder guidance
- Section-level navigation

### D. AI writing assistant

- Continue writing
- Rewrite into formal academic Indonesian
- Expand
- Simplify
- Paraphrase
- Generate section draft dari prompt
- Preview diff sebelum apply

### E. Template & outline

- Template default:
  - paper umum
  - proposal
  - skripsi

- Generate outline dari topik
- Insert outline ke dokumen
- Edit manual setelah insert

### F. Export

- DOCX export
- Preserve heading hierarchy
- Preflight check sederhana sebelum export

### G. Freemium & quota

- AI action quota
- DOCX export quota
- Source upload beta quota
- Usage summary

## 9.2 Beta research scope

- Upload PDF
- Parse text
- Summary per file
- Tanya jawab per file
- Evidence snippet per jawaban
- Belum ada cross-file synthesis otomatis di launch

## 9.3 Out of scope

- Realtime collaboration
- Full citation automation
- Full bibliography engine
- PDF export yang pixel-perfect
- Full source library lintas workspace
- Institution / classroom features

---

## 10. User Journey Utama

## 10.1 Journey A — Mulai menulis dari nol

1. User login
2. User pilih tujuan penulisan
3. User pilih template atau blank document
4. User isi judul/topik
5. Sistem menawarkan outline
6. User masuk editor
7. User pilih section dan gunakan AI untuk draft awal
8. User edit manual
9. User export DOCX

### Prinsip UX

- Onboarding berbasis **goal**, bukan langsung berbasis “jenis dokumen”
- User masuk editor secepat mungkin
- Generate outline adalah bantuan, bukan langkah wajib

## 10.2 Journey B — Perbaiki tulisan yang sudah ada

1. User paste atau tulis teks
2. User blok paragraf
3. User pilih AI action
4. Sistem menampilkan preview hasil
5. User pilih:
   - replace
   - insert below
   - copy only

### Prinsip UX

- Tidak ada replace otomatis tanpa preview
- Semua AI action bersifat reversible

## 10.3 Journey C — Pakai referensi PDF

1. User upload PDF
2. Sistem memproses file di background
3. User tetap bisa menulis saat file diproses
4. Jika file siap, user bisa buka summary atau ask file
5. Jawaban menampilkan evidence snippet
6. User memakai insight untuk menulis manual

### Prinsip UX

- Mode riset bukan flow utama launch
- Tidak ada workspace-wide chat default
- Scope file dipilih eksplisit oleh user

---

## 11. Functional Requirements

## 11.1 Authentication & account

- Google OAuth
- Email OTP fallback
- Session management aman
- Sinkronisasi user ke DB internal
- Plan summary di profile

## 11.2 Document management

- CRUD dokumen
- Tipe dokumen:
  - `general_paper`
  - `proposal`
  - `skripsi`

- Autosave
- Archive document
- Recent documents
- Version snapshot ringan

## 11.3 Editor

- JSON-based structured document model
- Heading levels
- Lists
- Inline formatting dasar
- Outline sidebar
- Selection-aware AI actions
- Keyboard shortcut dasar
- Empty-state hints

## 11.4 AI writing modes

### Mode 1 — Free writing mode

Dipakai untuk:

- continue
- rewrite
- simplify
- expand
- paraphrase
- draft from prompt

### Mode 2 — Source-grounded mode

Dipakai untuk:

- summarize uploaded file
- answer question from selected file
- generate notes from selected evidence

**Aturan penting:**

- Output grounded mode harus menunjukkan evidence snippet
- Output free writing mode tidak boleh diberi kesan “sudah tervalidasi oleh sumber”

## 11.5 Template & outline

- User bisa memilih template awal
- User bisa generate outline dari topik
- User bisa edit outline sebelum insert
- General paper memakai template sederhana
- Proposal/skripsi memakai template akademik Indonesia default

## 11.6 Source upload beta

- Upload PDF
- Validasi ukuran dan mime type
- Async text extraction
- OCR hanya bila perlu
- Per-file summary
- Per-file Q&A dengan evidence
- Status file:
  - queued
  - processing
  - ready
  - failed

## 11.7 Export

- DOCX export tersedia di launch
- Export menggunakan canonical document structure
- Preflight checks:
  - title kosong
  - heading kosong
  - unresolved placeholder
  - source note belum selesai

## 11.8 Usage & billing foundation

- Free plan
- Pro plan
- Quota reserve/check sebelum action berat
- Usage summary dashboard
- Event tracking per AI action dan export

---

## 12. UX Requirements

## 12.1 First-time experience

- Time to first usable draft harus singkat
- Empty state menjelaskan langkah berikutnya
- User tidak dipaksa upload sumber di awal
- User tidak dipaksa memilih terlalu banyak konfigurasi

## 12.2 AI interaction pattern

- Semua output AI muncul di panel preview atau inline diff
- CTA utama selalu jelas:
  - apply
  - insert below
  - dismiss

- Loading state harus memberi rasa progres, bukan sekadar spinner

## 12.3 Source processing UX

Status ditampilkan dengan bahasa manusia:

- Mengunggah
- Membaca isi file
- Menyiapkan ringkasan
- Siap dipakai
- Gagal diproses

Jika gagal:

- retry
- coba mode OCR
- hapus file

## 12.4 Export UX

- Preflight warning sebelum export
- Export history
- Retry bila export gagal
- Jangan blokir editor selama export berjalan

---

## 13. Non-Functional Requirements

- AI action ringan terasa responsif
- Autosave tidak mengganggu typing
- Semua job berat berjalan async
- File upload aman dan tervalidasi
- Error tracking aktif
- Queue observability aktif
- Semua job penting idempotent
- Arsitektur siap dipisah per service saat trafik naik

### SLO awal

- Autosave acknowledgement < 1 detik dalam kondisi normal
- Inline AI request ringan target p50 < 4 detik
- DOCX export kecil target p50 < 10 detik
- Source processing status terlihat jelas maksimal beberapa detik setelah upload dimulai

---

## 14. Arsitektur Produk

## 14.1 Frontend

- Next.js
- Plate.js atau editor structured-json setara
- TanStack Query
- Tailwind + shadcn/ui
- Clerk frontend SDK

## 14.2 Backend API

- Hono / TypeScript
- REST JSON API
- Auth verification via Clerk
- Service boundaries:
  - auth/profile
  - document
  - AI assist
  - source ingestion
  - retrieval
  - export
  - usage/billing

## 14.3 Background jobs

- BullMQ + Redis
- Job types:
  - source_parse
  - source_ocr
  - source_chunk
  - source_embed
  - source_summary
  - export_docx

## 14.4 Database

- PostgreSQL + Drizzle
- Structured document storage di `jsonb`
- Usage counters terpisah
- Source metadata dan chunks dipisah dari document tables utama

## 14.5 Retrieval storage

- pgvector masih dapat dipakai pada tahap awal
- Namun retrieval harus dibatasi:
  - hanya file terpilih
  - metadata pre-filter dulu
  - chunk retrieval bertingkat

- Harus mudah dimigrasikan ke vector store terpisah bila volume naik

## 14.6 Storage

- Cloudflare R2 untuk source files dan hasil export

## 14.7 AI providers

- LLM utama untuk writing dan summary
- OCR/document fallback hanya dipakai saat parse biasa gagal
- Semua prompt menggunakan guardrail panjang output dan style control

---

## 15. Domain Model V2

### Workspace

Container milik user untuk dokumen dan sumber.

### Document

Objek tulisan utama milik user.

### Source Library

Koleksi file sumber di level workspace.

### Document Source Link

Relasi file mana yang aktif dipakai oleh dokumen tertentu.

### Reference

Metadata bibliografi yang sudah dibersihkan.

### Citation

Pemakaian reference di dokumen.

### Export

Riwayat hasil keluaran dokumen.

### Usage Event

Catatan konsumsi kuota.

---

## 16. Data Model yang Disarankan

### users

- id
- clerk_user_id
- email
- full_name
- avatar_url
- current_plan_code
- created_at
- updated_at

### workspaces

- id
- user_id
- name
- created_at
- updated_at

### documents

- id
- workspace_id
- user_id
- title
- document_type (`general_paper | proposal | skripsi`)
- lifecycle_status (`active | archived`)
- content_json
- plain_text
- last_opened_at
- created_at
- updated_at

### document_versions

- id
- document_id
- version_no
- content_json
- plain_text
- created_at

### sources

- id
- workspace_id
- user_id
- file_name
- mime_type
- storage_key
- file_size_bytes
- page_count
- processing_status
- parse_mode (`standard | ocr`)
- error_message
- created_at
- updated_at

### document_source_links

- id
- document_id
- source_id
- linked_at

### source_chunks

- id
- source_id
- chunk_index
- page_number
- content
- embedding
- token_count
- metadata_json
- created_at

### references

- id
- workspace_id
- source_id nullable
- normalized_title
- authors_json
- year
- journal
- publisher
- doi
- url
- raw_metadata_json
- created_at
- updated_at

### document_citations

- id
- document_id
- reference_id
- node_id
- selection_json
- inline_text
- citation_style
- created_at

### exports

- id
- document_id
- user_id
- format (`docx`)
- status (`queued | processing | ready | failed`)
- storage_key
- error_message
- created_at
- updated_at

### usage_events

- id
- user_id
- document_id nullable
- event_type
- units
- metadata_json
- created_at

### monthly_usage_counters

- id
- user_id
- period
- ai_actions_used
- source_uploads_used
- exports_used
- storage_used_bytes
- updated_at

---

## 17. Technical Design Principles

### 17.1 Canonical document model

Editor, AI insertion, dan DOCX export harus memakai struktur dokumen yang sama.
Tidak boleh ada renderer export yang “menebak” dari HTML mentah.

### 17.2 Autosave strategy

- Debounce berbasis idle
- Simpan patch ringan untuk save rutin
- Snapshot version hanya periodik atau saat milestone penting
- `plain_text` dibangun async, bukan tiap keypress

### 17.3 Retrieval strategy

- Scope default: satu file yang dipilih user
- Tahap retrieval:
  1. filter file
  2. pilih chunk kandidat
  3. generate jawaban

- Cross-file synthesis ditunda ke phase berikutnya

### 17.4 OCR strategy

- OCR hanya fallback
- Jalankan per halaman bila perlu
- Jangan OCR seluruh file secara agresif
- Free tier punya limit halaman/ukuran file yang ketat

### 17.5 Quota enforcement

- Check + reserve quota harus atomik
- Commit setelah task berhasil
- Retry tidak boleh menggandakan usage

### 17.6 Job orchestration

- Semua job berat idempotent
- Ada retry policy
- Ada terminal failure state
- Ada checksum file untuk dedupe pemrosesan

---

## 18. API Modules

### Auth/Profile

- get current profile
- get plan summary
- bootstrap user profile

### Documents

- create document
- list documents
- get document
- update document
- rename/archive/delete document
- list versions

### AI Assist

- continue
- rewrite
- paraphrase
- expand
- simplify
- generate section draft
- generate outline

### Sources

- create upload session
- register upload
- list document sources
- link source to document
- get source status
- retry source processing
- delete source

### Retrieval

- summarize source
- ask source question
- list evidence snippets

### Export

- export docx
- get export status/history

### Usage

- get usage summary
- get plan limits

---

## 19. Endpoint Draft

### Documents

- `POST /v2/documents`
- `GET /v2/documents`
- `GET /v2/documents/:id`
- `PATCH /v2/documents/:id`
- `POST /v2/documents/:id/archive`
- `DELETE /v2/documents/:id`

### AI

- `POST /v2/ai/continue`
- `POST /v2/ai/rewrite`
- `POST /v2/ai/paraphrase`
- `POST /v2/ai/expand`
- `POST /v2/ai/simplify`
- `POST /v2/ai/section-draft`
- `POST /v2/ai/outline`

### Sources

- `POST /v2/sources/upload-url`
- `POST /v2/sources/register`
- `GET /v2/documents/:id/sources`
- `POST /v2/documents/:id/sources/:sourceId/link`
- `GET /v2/sources/:id/status`
- `POST /v2/sources/:id/retry`
- `DELETE /v2/sources/:id`

### Retrieval

- `POST /v2/retrieval/source-summary`
- `POST /v2/retrieval/source-query`
- `GET /v2/retrieval/source/:id/evidence`

### Export

- `POST /v2/exports/docx`
- `GET /v2/exports/:id`

### Usage

- `GET /v2/me/usage`
- `GET /v2/me/plan`

---

## 20. Success Metrics

### Product metrics

- Signup to first document conversion
- Time to first useful draft
- Weekly active writers
- Documents edited per active user
- DOCX export completion rate

### Quality metrics

- AI suggestion acceptance rate
- AI suggestion rejection rate
- Median latency per AI action
- Autosave failure rate
- DOCX export success rate
- Source summary helpfulness score
- Source answer evidence click-through rate

### Trust metrics

- Citation/reference correction rate pada phase riset
- Grounded answer complaint rate
- Percentage of AI outputs inserted after preview, bukan auto-apply

### Business metrics

- Free to pro conversion
- Cost per active writer
- AI cost per successful draft session

---

## 21. Risiko & Mitigasi

### Risiko 1 — Scope creep

**Mitigasi:** launch scope dikunci pada writing workflow; research workflow hanya beta terbatas.

### Risiko 2 — AI output bahasa Indonesia tidak konsisten

**Mitigasi:** prompt spec per action, output length guardrail, evaluasi acceptance rate.

### Risiko 3 — Editor dan export tidak sinkron

**Mitigasi:** canonical document model tunggal.

### Risiko 4 — Source parsing mahal dan lambat

**Mitigasi:** file limits, async jobs, OCR fallback selektif.

### Risiko 5 — Retrieval terasa tidak akurat

**Mitigasi:** per-file scope dulu, evidence snippet wajib, cross-file ditunda.

### Risiko 6 — Biaya AI membengkak

**Mitigasi:** quota, caching ringan untuk summary, output length cap, model routing sesuai task.

---

## 22. Milestone Delivery

## Phase 1 — Launch MVP (6 minggu)

### Minggu 1

- Monorepo setup
- Auth integration
- DB schema dasar
- Document CRUD

### Minggu 2

- Editor core
- Autosave
- Recent documents
- Empty states

### Minggu 3

- AI continue/rewrite/paraphrase/expand/simplify
- Preview diff pattern
- Usage tracking dasar

### Minggu 4

- Onboarding berbasis goal
- Template general paper / proposal / skripsi
- Outline generator
- Archive/version snapshot

### Minggu 5

- DOCX export
- Preflight export check
- Plan/quota summary
- Launch analytics

### Minggu 6

- Hardening
- Rate limiting
- Error tracking
- Retry strategy
- UX polish
- Launch checklist

## Phase 2 — Research Beta (4 minggu)

- Source upload
- Parse pipeline
- OCR fallback selektif
- Per-file summary
- Per-file Q&A dengan evidence
- File status UX
- Beta quota

## Phase 3 — Source-grounded Writing

- Note generation from source
- Reference normalization
- Citation insertion
- Bibliography draft
- Cross-file synthesis terbatas

---

## 23. Launch Checklist

- Rate limiting aktif
- Quota enforcement atomik aktif
- Error tracking aktif
- Autosave recovery tested
- DOCX export tested pada dokumen panjang
- File validation aktif
- Queue retry strategy aktif
- Privacy policy dan terms minimal tersedia
- Free dan pro plan tersedia
- Product analytics event utama lengkap

---

## 24. Acceptance Criteria Launch

- User baru bisa membuat dokumen pertama dalam <= 2 menit
- Autosave stabil dan tidak kehilangan isi saat refresh
- AI action utama bisa dipakai dari selection/cursor
- Hasil AI selalu bisa direview sebelum diterapkan
- Template dan outline bisa diinsert lalu diedit
- DOCX export berhasil pada dokumen standar
- User free mendapat feedback jelas saat quota habis
