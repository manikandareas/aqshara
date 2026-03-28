# Agent guide: `apps/web` structure

This app uses a **feature-first** layout under `src/features/`. When you add or extend functionality, colocate code by **domain** (product area), not only by technical type.

## Where things live

| Kind of code | Location |
|--------------|----------|
| Domain UI (screens, widgets, flows) | `src/features/<domain>/components/` |
| TanStack Query keys, `queryOptions`, API calls tied to that domain | `src/features/<domain>/queries/` |
| Pure TS: types derived from API, helpers, redirect rules, labels | `src/features/<domain>/lib/` |
| Route definition, loaders, thin composition | `src/routes/*.tsx` (file-based routing; do not move route files) |
| Shared design system (shadcn) | `src/components/ui/` only |
| Shared utilities (`cn`, etc.) | `src/lib/utils.ts` |

Path alias: `@/*` maps to `src/*`. Prefer `@/features/<domain>/...` when importing from routes or across features; prefer **relative imports** (`../lib/...`, `./foo`) inside the same feature.

## Adding a new feature

1. Pick a **domain folder name** in `kebab-case` or a short single word (e.g. `onboarding`, `workspace`, `billing`).
2. Create:

   ```text
   src/features/<domain>/
     components/     # React components for this domain
     queries/        # React Query + fetchers for this domain (optional if no client data)
     lib/            # Types, pure functions, constants (optional)
   ```

3. Add **tests** next to the code they cover (e.g. `lib/foo.test.ts`, `queries/bar.test.ts`).
4. Wire the feature from **`src/routes/`**: import feature modules with `@/features/<domain>/...`, keep the route file focused on routing, loaders, and composition.

## Rules

- **Do not** move `src/components/ui/` into `features/` without updating `components.json` and the shadcn CLI aliases.
- **Do not** put large presentational trees in route files; extract to `features/<domain>/components/` (see `workspace/components/app-shell.tsx`).
- **Do** keep API/session types and domain logic in `lib/` when they are reused by `queries/` and `components/`.
- **Do** run from repo root after substantive changes: `pnpm --filter web typecheck`, `pnpm --filter web test`, and `pnpm --filter web build` when appropriate.

## Reference examples

- Onboarding: `src/features/onboarding/` (`queries`, `components`, `lib`).
- Main app shell: `src/features/workspace/components/app-shell.tsx`, mounted from `src/routes/app.tsx`.
