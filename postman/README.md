# Aqshara Postman

Collection dan environment ini dipakai untuk mengetes seluruh surface API Aqshara dari root repo.

## Files

- `aqshara-smoke.postman_collection.json`
- `aqshara-e2e.postman_collection.json`
- `aqshara-local.postman_environment.json`
- `sample.pdf`

## Prasyarat

- API aktif di `http://localhost:9000` atau sesuaikan `base_url`.
- Clerk instance aktif dan memiliki user test email/password.
- Anda butuh `clerk_secret_key` dan JWT template name untuk Postman login flow.
- `clerk_webhook_signing_secret` diisi dengan secret webhook Clerk yang sama dengan API.
- Untuk flow source/export sampai status terminal, worker dan dependency pendukung harus aktif: Postgres, Redis, storage, OpenAI, dan worker Aqshara.

## Cara pakai di Postman UI

1. Import kedua collection dan environment dari folder `postman/`.
2. Pilih environment `Aqshara Local`.
3. Isi variabel: `clerk_secret_key`, `clerk_email`, `clerk_password`, `clerk_jwt_template`, dan `clerk_webhook_signing_secret`.
4. Jalankan `Aqshara API Smoke` untuk validasi cepat route publik, docs, dan negative auth checks.
5. Jalankan `Aqshara API E2E`. Empat request awal akan:
   - resolve user Clerk by email
   - verify password
   - create session
   - mint JWT template token ke `access_token`
6. Jika source/export masih `queued` atau `processing`, jalankan collection dari Runner dengan delay sekitar `1000-3000 ms` agar polling tidak terlalu rapat.

## Catatan suite E2E

- Flow auth mengikuti pola reference Postman seperti Paperview: token didapat di awal collection lewat credential request, lalu dipakai untuk seluruh request berikutnya.
- Clerk login di Postman memakai Clerk Backend API dengan urutan:
  - `01. Clerk - Resolve User By Email`
  - `02. Clerk - Verify Password`
  - `03. Clerk - Create Session`
  - `04. Clerk - Create Token`
- Positive webhook menggunakan header Svix yang ditandatangani dari `clerk_webhook_signing_secret`.
- `Sources - Retry If Failed` hanya dijalankan jika status source berakhir di `failed`.
- `Exports - Download If Ready` hanya dijalankan jika export berstatus `ready`.
- `Exports - Retry If Failed` hanya dijalankan jika export berstatus `failed`.
- JWT template name di `clerk_jwt_template` harus sudah dibuat di Clerk Dashboard sebelum run collection.

## Newman

Jalankan dari root repo:

```bash
newman run postman/aqshara-smoke.postman_collection.json \
  -e postman/aqshara-local.postman_environment.json

newman run postman/aqshara-e2e.postman_collection.json \
  -e postman/aqshara-local.postman_environment.json
```
