# Sprint 1 Backend Operations

This document provides operational guidance for the Sprint 1 backend features, including user provisioning, backfill scripts, and document management.

## 1. User Provisioning and Webhooks

Provisioning of internal users and their default workspaces is handled asynchronously via Clerk webhooks.

### Webhook Validation in Production

In production-like environments (including staging), the `POST /webhooks/clerk` endpoint requires a valid signature from Clerk.

- Ensure the `CLERK_WEBHOOK_SIGNING_SECRET` environment variable is set to the secret provided in the Clerk Dashboard.

- For local testing of webhooks, use a tunnel like `ngrok` or `localtunnel` and configure the URL in Clerk's Webhook settings.

### Webhook Behavior

- **`user.created` / `user.updated`**: Upserts the user into the local database and ensures a default workspace exists.
- **`user.deleted`**: Performs a soft delete by setting `deleted_at` on the user record. This prevents further access while preserving document data for audit or recovery.

## 2. Clerk User Backfill

For users that existed before the webhook was active, or in cases where a manual sync is needed, use the backfill script.

### Usage

Run the script from the repository root:

```bash
pnpm --filter @aqshara/api clerk:backfill -- [options]
```

### Options

- `--help`, `-h`: Show the help message.
- `--page-size <number>`: Number of Clerk users to fetch per page (default: 100).

### The `--` Separator Gotcha

When running via `pnpm`, you must use a literal `--` separator to pass arguments to the underlying script. If you need to see the script's help, use:

```bash
pnpm --filter @aqshara/api clerk:backfill -- --help
```

The script is designed to ignore the first `--` if passed by some runners, but the standard `pnpm` pattern requires it for passing any `--options`.

## 3. Document Management API

### Recent Documents

The `GET /v1/documents/recent` endpoint provides a focused list of the user's most recently updated documents.

- **Path**: `/v1/documents/recent`
- **Behavior**: Returns only "active" (non-archived) documents.
- **Parameters**: `limit` (optional, default 5, min 1, hard max 10).

### Autosave and Stale-Save Protection

The `PUT /v1/documents/{documentId}/content` endpoint implements optimistic locking to prevent overwriting newer changes with stale data.

- **Request Body**: Requires `contentJson` (the document AST) and `baseUpdatedAt` (a ISO 8601 datetime string).
- **Stale Detection**: The `baseUpdatedAt` must match the current `updated_at` in the database. If they don't match (indicating another save happened since the client last fetched the document), the API returns:
  - **Status**: `409 Conflict`
  - **Error Code**: `stale_document_save`
- **Client Implementation**: Clients should handle the `409` by prompting the user to refresh or merging changes.
