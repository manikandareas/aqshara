# Aqshara Monorepo

pnpm + Turborepo monorepo for Aqshara applications.

## Structure

```
aqshara/
├── apps/
│   ├── web/        @aqshara/web  - Next.js 16
│   └── server/     @aqshara/server - NestJS
├── packages/
│   └── tsconfig/   @aqshara/tsconfig - Shared TypeScript configs
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

## Setup

```bash
pnpm install
```

## Scripts

| Command | Description |
|--------|-------------|
| `pnpm build` | Build all packages |
| `pnpm dev` | Run all apps in dev mode |
| `pnpm lint` | Lint all packages |
| `pnpm test` | Run tests |
| `pnpm --filter @aqshara/web dev` | Run web app only |
| `pnpm --filter @aqshara/server dev` | Run server only |

## Known issues

**Next.js 16 Turbopack + pnpm monorepo**: The web app (`@aqshara/web`) may fail to build with Turbopack when run from the monorepo root due to module resolution from the `app/` directory. The server builds successfully. You can run `pnpm --filter @aqshara/web dev` for development. If the production build fails, try building from `apps/web` directly or track [Next.js monorepo compatibility](https://github.com/vercel/next.js/issues).
