# Agent Guidelines for Aqshara

This document helps AI coding assistants understand and work effectively in the Aqshara monorepo.

## Project Overview

Aqshara is a pnpm + Turborepo monorepo containing a Next.js web app, a NestJS backend, and shared packages. The backend handles document processing, translation, video generation, and billing webhooks; it uses PostgreSQL, Redis, and queue workers.

## Repository Structure

```
aqshara/
├── apps/
│   ├── web/         @aqshara/web   - Next.js 16 (Turbopack)
│   └── server/     @aqshara/server - NestJS API, workers, queues
├── packages/
│   ├── api/        - Shared API types/utilities
│   ├── tsconfig/   @aqshara/tsconfig - Shared TypeScript configs
│   └── video-renderer/
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

## Tech Stack

- **Package manager:** pnpm
- **Build tool:** Turborepo
- **Web:** Next.js 16, React
- **Server:** NestJS, TypeORM, BullMQ
- **Infra:** PostgreSQL, Redis, Docker Compose

## Key Commands

| Command | Description |
|---------|-------------|
| `pnpm install` | Install dependencies |
| `pnpm build` | Build all packages |
| `pnpm dev` | Run all apps in dev mode |
| `pnpm lint` | Lint all packages |
| `pnpm test` | Run tests |
| `pnpm --filter @aqshara/web dev` | Run web app only |
| `pnpm --filter @aqshara/server dev` | Run server only |

## Server-Specific Commands

```bash
# Start local infra (PostgreSQL, Redis)
cd apps/server && docker compose up -d

# Database migrations
pnpm db:generate
pnpm db:migrate

# Run API + worker
pnpm start:dev
pnpm start:worker

# API docs
# http://localhost:3000/docs (Swagger)
# http://localhost:3000/docs-json (OpenAPI)

# Tests
pnpm test          # unit
pnpm test:e2e      # e2e
pnpm test:contract # OpenAPI contract
pnpm test:reliability # Redis queue
```

## Local Environment

For server development, use:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/aqshara
REDIS_URL=redis://localhost:6379
QUEUE_DISABLED=false
```

## Important Paths

- **Server docs:** `apps/server/docs/` — OPERATIONS_RUNBOOK.md, BACKEND_IMPLEMENTATION_TASK_BREAKDOWN.md, MONOLITH_NESTJS_*.md
- **API/contract:** Swagger at `/docs`, OpenAPI at `/docs-json`
- **Ops helpers:** `pnpm ops:replay:dlq --flow document|translation|video`, `pnpm ops:replay:webhook --event-id <id>`

## Known Issues

- **Next.js 16 Turbopack + pnpm monorepo:** The web app may fail to build with Turbopack when run from the monorepo root due to module resolution. Run `pnpm --filter @aqshara/web dev` for development. If the production build fails, try building from `apps/web` directly.

## Conventions

1. **Workspace packages:** Use `@aqshara/*` workspace protocol in `package.json` dependencies.
2. **Shared config:** Extend `@aqshara/tsconfig` for TypeScript configs.
3. **Testing:** Run tests before submitting; contract and reliability tests matter for the server.
4. **Ops changes:** Document any new DLQ flows or webhook replay procedures in `OPERATIONS_RUNBOOK.md`.
