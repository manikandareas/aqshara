# Operations Runbook (Phase H Baseline)

## 1) Minimum triage checklist

1. Verify platform health:
- `GET /api/v1/healthz`
- `GET /api/v1/readyz`
- `GET /api/v1/metrics`

2. Check queue health signals from metrics:
- `queue_jobs_total{queue=...,status="failed"}`
- `queue_jobs_total{queue=...,status="enqueued"}`
- `queue_jobs_depth{queue=...,status="waiting|active|delayed|failed"}`

3. Correlate logs with request and job context:
- `request_id`
- `document_id`
- `paragraph_id`
- `queue`
- `job_id`

## 2) DLQ recovery and replay

### Document processing DLQ replay

Use the replay helper to move jobs from `document.process.dlq` to `document.process.retry`:

```bash
pnpm ops:replay:dlq --flow document --limit 50
```

Dry-run preview:

```bash
pnpm ops:replay:dlq --flow document --limit 50 --dry-run
```

### Translation retry DLQ replay

Use the replay helper to move jobs from `translation.retry.dlq` to `translation.retry.retry`:

```bash
pnpm ops:replay:dlq --flow translation --limit 50
```

Dry-run preview:

```bash
pnpm ops:replay:dlq --flow translation --limit 50 --dry-run
```

### Video generation DLQ replay

Use the replay helper to move jobs from `video.generate.dlq` to `video.generate.retry`:

```bash
pnpm ops:replay:dlq --flow video --limit 50
```

Dry-run preview:

```bash
pnpm ops:replay:dlq --flow video --limit 50 --dry-run
```

## 3) Billing webhook replay

Replay a previously persisted event from `billing_events` by event ID:

```bash
pnpm ops:replay:webhook --event-id <event_id>
```

Expected behavior:
- The stored payload is reprocessed through `BillingWebhookService`.
- Duplicate already-processed events remain idempotent.
- Replayed failures remain visible via `billing_events.status = 'error'` and `error_message`.

## 4) Incident notes and follow-up

1. Capture `request_id` and queue/job IDs for every incident timeline.
2. Record replay command, scope (`limit`), and operator identity.
3. Re-check queue depth and failed counters after replay.
4. Open a corrective issue if repeated failures occur for the same payload shape.
