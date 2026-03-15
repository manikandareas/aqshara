# Aqshara Postman E2E

Collection ini disinkronkan dengan kondisi API saat ini:

1. health/readiness check
2. login Clerk (Backend API) otomatis via email+password
3. billing smoke checks
4. upload dokumen + status polling + SSE auth behavior
5. reader endpoints (outline/paragraph/search/translations/glossary/map)
6. engagement endpoints (events + feedback)
7. cleanup delete dokumen

Collection sekarang memiliki 2 folder utama:

- `e2e` → full sequence original (34 request).
- `flow-auth-upload-result` → alur fokus dari signin Clerk sampai hasil reader (`search`) tanpa delete dokumen (tanpa step stream tanpa token).

## Files

- `aqshara-e2e.postman_collection.json`
- `aqshara-local.postman_environment.json`
- `sample.pdf`

## Prasyarat

- API aktif di `http://localhost:8000`.
- Prefix API aktif di `/api/v1` (default env `API_PREFIX=api/v1`).
- Worker + dependency aktif (Redis, DB, Storage, Mistral) jika ingin flow sampai `ready`.
- Akun Clerk email/password aktif untuk testing.

## Variabel environment wajib

- `base_url` (default `http://localhost:8000`)
- `api_prefix` (default `/api/v1`)
- `clerk_api_url` (default `https://api.clerk.com`)
- `clerk_secret_key`
- `clerk_identifier` (email user Clerk)
- `clerk_password`

Collection akan membuat `access_token` otomatis lewat Clerk Backend API sequence:

1. resolve `user_id` dari email
2. verify password
3. create session
4. issue session token (`jwt`)

## Jalankan di Postman UI

1. Import collection dan environment dari folder ini.
2. Pilih environment `Aqshara Local`.
3. Isi credential Clerk (`clerk_secret_key`, `clerk_identifier`, `clerk_password`).
4. Jalankan collection `Aqshara API E2E Sequence`.
5. Request upload memakai `docs/postman/sample.pdf`.

## Jalankan via Newman

Dari root repo:

```bash
newman run docs/postman/aqshara-e2e.postman_collection.json \
  -e docs/postman/aqshara-local.postman_environment.json
```

Jalankan folder tertentu:

```bash
newman run docs/postman/aqshara-e2e.postman_collection.json \
  -e docs/postman/aqshara-local.postman_environment.json \
  --folder e2e

newman run docs/postman/aqshara-e2e.postman_collection.json \
  -e docs/postman/aqshara-local.postman_environment.json \
  --folder flow-auth-upload-result
```

Jika Newman dijalankan dari direktori lain, tambahkan `--working-dir` yang menunjuk root repo ini.

## Catatan penting

- Semua route server di collection memakai pola `{{base_url}}{{api_prefix}}/...`.
- Header `Authorization: Bearer {{access_token}}` dipasang di level collection.
- SSE status stream tanpa token harus `401`; dengan `access_token` query harus `200`.
- Request SSE (`15`/`16` dan `F09`) bersifat long-lived (`text/event-stream`) dan tidak dipakai sebagai langkah blocking di alur otomatis collection runner.
- Validasi SSE sebaiknya dijalankan manual (Send request langsung) atau sebagai langkah terminal terpisah.
- `POST /events` dan `POST /documents/:id/feedback` saat ini return `201`.
- Validation untuk query invalid (mis. search tanpa `q`) return `400`.
- Token/secret Clerk bersifat sensitif, jangan commit nilai real ke repo.
