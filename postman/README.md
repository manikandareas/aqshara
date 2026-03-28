# Aqshara Postman

Collection dan environment ini dipakai untuk mengetes seluruh surface API Aqshara dari root repo.

## Files

- `aqshara-smoke.postman_collection.json`
- `aqshara-e2e.postman_collection.json`
- `aqshara-local.postman_environment.json`
- `sample.pdf`

## Prasyarat

- API aktif di `http://localhost:9000` atau sesuaikan `base_url`.
- Clerk local instance aktif dengan email/password sign-in untuk user test.
- MFA untuk user test dimatikan.
- `clerk_frontend_api_url` mengarah ke Frontend API Clerk yang dipakai web app.
- `clerk_webhook_signing_secret` diisi dengan secret webhook Clerk yang sama dengan API.
- Untuk flow source/export sampai status terminal, worker dan dependency pendukung harus aktif: Postgres, Redis, storage, OpenAI, dan worker Aqshara.

## Cara pakai di Postman UI

1. Import kedua collection dan environment dari folder `postman/`.
2. Pilih environment `Aqshara Local`.
3. Isi variabel kosong: `clerk_frontend_api_url`, `clerk_email`, `clerk_password`, dan `clerk_webhook_signing_secret`.
4. Jalankan `Aqshara API Smoke` untuk validasi cepat route publik, docs, dan negative auth checks.
5. Jalankan `Aqshara API E2E` untuk flow auth, documents, AI, sources, exports, webhook, dan cleanup.
6. Jika source/export masih `queued` atau `processing`, jalankan collection dari Runner dengan delay sekitar `1000-3000 ms` agar polling tidak terlalu rapat.

## Catatan suite E2E

- Login Clerk memakai tiga request awal:
  - `01. Clerk - Start Sign In`
  - `02. Clerk - Attempt Password`
  - `03. Clerk - Read Client Session`
- Positive webhook menggunakan header Svix yang ditandatangani dari `clerk_webhook_signing_secret`.
- `Sources - Retry If Failed` hanya dijalankan jika status source berakhir di `failed`.
- `Exports - Download If Ready` hanya dijalankan jika export berstatus `ready`.
- `Exports - Retry If Failed` hanya dijalankan jika export berstatus `failed`.
- Jika auto-login Clerk tidak cocok dengan instance lokal Anda, isi `access_token` manual lalu mulai run dari request setelah login.

## Newman

Jalankan dari root repo:

```bash
newman run postman/aqshara-smoke.postman_collection.json \
  -e postman/aqshara-local.postman_environment.json

newman run postman/aqshara-e2e.postman_collection.json \
  -e postman/aqshara-local.postman_environment.json
```
