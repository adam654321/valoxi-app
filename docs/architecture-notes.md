# Valoxi architecture notes

Salvaged from `replit.md` (removed in the DO migration, plan 2.10). Replit-specific
sections dropped. Claims about authentication corrected to match the code.

Valoxi is an M&A deal management platform that centralises tracking and management of
acquisition targets for business buyers, M&A professionals and investment firms.

## Run and operate

Environment variables: see `.env.example` (full list) and `docs/do-migration/assessment.md`
section 3. Generate a session secret with
`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

```bash
npm ci
npm run dev        # development server
npm run build      # vite build + esbuild server bundle into dist/
npm run check      # tsc typecheck (there is no `typecheck` script)
npm run db:generate  # REVIEW ONLY. Never apply.
# npm run db:push    # DO NOT RUN. Blocked by the #188 drift. See Gotchas.
```

Local tests need a database that is NOT prod; see `assessment.md` section 10.

## Stack

- Frontend: React 18, TypeScript, Wouter, TanStack React Query, Radix UI, shadcn/ui,
  Tailwind CSS, React Hook Form, Zod, Vite
- Backend: Express, TypeScript, Drizzle ORM
- Database: PostgreSQL (Neon serverless, `@neondatabase/serverless` over WebSocket)
- Authentication: Clerk (`@clerk/express`, `@clerk/react`); server sessions in Postgres
  via `connect-pg-simple`
- Files: Cloudflare R2 (`server/services/file-storage.service.ts`)
- Testing: Vitest

## Where things live

- Frontend: `client/src/`; admin pages `client/src/pages/admin/`; layout
  `client/src/components/layout/`
- Backend: `server/`; routes `server/routes/` (map in `server/routes/index.ts`)
- Shared types and schema: `shared/`; Drizzle schema `shared/schema/`
- Entitlements and feature gating: `shared/entitlements.ts`
- Config: `server/config.ts`
- Restore procedure: `docs/restore-procedure.md`
- Drift between schema and live DB: `docs/drizzle-rebaseline/drift-register.md`

## Architecture decisions

- Layered backend: repositories (data access), services (business logic), routes (HTTP).
- Drizzle strategy, LIVE DATABASE authoritative. `db:push` is blocked by the #188 drift;
  schema changes are direct ALTERs with explicit constraint names (#189), because
  auto-generated names drift between `_key` and `_unique`. Do not generate or run
  migrations to close accepted deltas without a dedicated reviewed slice.
- EventBus: typed EventEmitter singleton for decoupled service communication (for example
  `file:uploaded` triggers analysis).
- Entitlements layer: `shared/entitlements.ts` is the single source of truth for tier
  gating, used by client and server.
- Value Creation Modeller: pure TypeScript calculation engine, isolated from the database.

## Product

Target and contact management; team collaboration and RBAC; activity tracking; document
management with an external portal; AI insights (Gemini); billing and subscriptions with
tier gating, promo codes and multi-currency; value creation modelling; automated chase-up
emails for portal submissions.

## Gotchas

- Do NOT run `db:push` or `db:migrate`. `db:generate` produces a snapshot to review only.
  Drizzle's snapshot is frozen at journal index 7; a push would attempt destructive
  statements including DROP TABLE promo_codes CASCADE and twelve DROP COLUMN
  (from the retired `scripts/post-merge.sh` note, SS3-H1).
- CSRF: the frontend fetches a token from `GET /api/v2/auth/csrf` and sends it as
  `x-csrf-token` on every mutating request after authentication.
- Data isolation: all data access must respect `userCompanyId`.
- The analysis pipeline reads R2 keys through `fileStorageService`. Non-R2 paths (legacy
  `uploads/...` rows) fall back to local disk and fail on an ephemeral container. See
  `assessment.md` section 6, question 2.
- Deal metrics snapshots fail silently by design and never block the parent operation.
