# worker

Python worker for Aqshara background job processing.

## Run locally

```bash
docker compose --profile workers up -d bullmq-proxy
pnpm dev:worker
```

For local development, BullMQ Proxy and `worker` default to the shared token `dev-token`. If you override `WORKER_PROXY_TOKEN`, use the same value for both services.

The worker exposes:

- `GET /health`
- `GET /readiness`
- `POST /internal/jobs/export_docx`
- `POST /internal/jobs/parse_source`

## Required environment

- `DATABASE_URL`
- `REDIS_HOST`
- `REDIS_PORT`
- `WORKER_PROXY_BASE_URL`
- `WORKER_PUBLIC_BASE_URL`

Optional but supported:

- `WORKER_PROXY_TOKEN`
- `WORKER_PROXY_SYNC_ENABLED`
- `WORKER_EXPORT_CONCURRENCY`
- `WORKER_SOURCE_CONCURRENCY`
- `AQSHARA_LOG_FORMAT`
- `AQSHARA_EXPORTS_DIR`
- `AQSHARA_SOURCES_DIR`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`
- `MISTRAL_API_KEY`
- `MISTRAL_API_BASE_URL`

## Deployment notes

- Deploy BullMQ Proxy alongside `worker`.
- Keep `apps/api` unchanged; it remains the BullMQ producer.
- Keep the TypeScript worker deployable until the Python path is stable.

## Rollback

1. Stop `worker`.
2. Stop BullMQ Proxy worker registrations for the Python callbacks.
3. Restart the TypeScript worker consumers.
4. Leave queued jobs in Redis; the payload contract is unchanged.
