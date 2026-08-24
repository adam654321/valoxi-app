# Valoxi

Valoxi is an M&A deal management platform that centralizes the tracking and management of potential acquisition targets for business buyers, M&A professionals, and investment firms.

## Run & Operate

To run the application, ensure the following environment variables are set in your Replit Secrets:

- `SESSION_SECRET`: Random 32-byte hex string. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `GOOGLE_GEMINI_API_KEY`: Gemini API key for document and website analysis.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_EMAIL`, `SMTP_SECURE`: For email functionality.
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PARTNER_CUSTOMER_5D`, `STRIPE_PARTNER_PRICE_5D`: For billing and partner invoicing.

```bash
# Install dependencies
npm install

# Run the development server
npm run dev

# Build the application
npm run build

# Typecheck the project
npm run typecheck

# Generate Drizzle migration snapshot. REVIEW ONLY. Do not run the migration.
npm run db:generate

# DO NOT RUN. db:push is BLOCKED by the #188 drift. See "Gotchas" below.
# Schema changes go through a direct ALTER with explicit constraint names (#189).
# npm run db:push
```

## Stack

- **Frontend**: React 18, TypeScript, Wouter, TanStack React Query, Radix UI, shadcn/ui, Tailwind CSS, React Hook Form, Zod, Vite
- **Backend**: Express.js, TypeScript, Drizzle ORM
- **Database**: PostgreSQL (Neon serverless)
- **Authentication**: `express-session`, bcrypt
- **Validation**: Zod
- **Build Tool**: Vite
- **Testing**: Vitest

## Where things live

- **Frontend Source**: `client/src/`
- **Backend Source**: `server/`
- **Shared Utilities/Types**: `shared/`
- **Database Schema**: `shared/schema/` (source-of-truth for Drizzle ORM)
- **API Routes**: `server/routes/` (modular, `server/routes/index.ts` for full map)
- **UI Layout Components**: `client/src/components/layout/`
- **Admin Section Frontend**: `client/src/pages/admin/`
- **Entitlements/Feature Gating Logic**: `shared/entitlements.ts`
- **Database Backup Procedure**: `docs/restore-procedure.md`
- **Project Configuration**: `server/config.ts`
- **Client Theme Provider**: `client/src/components/theme-provider.tsx`

## Architecture decisions

- **Modular Backend Architecture**: Layered `repositories` (data access), `services` (business logic), and `routes` (HTTP concerns) using domain-specific files for maintainability and separation of concerns.
- **Drizzle Schema Strategy, LIVE DATABASE authoritative**: `db:push` was the original strategy and is now BLOCKED by the #188 drift. The live database is authoritative for accepted deltas. Schema changes are applied as direct ALTER statements with explicit constraint names, because auto-generated names drift between `_key` and `_unique` (#189). Migrations must not be generated or run to close accepted deltas without a dedicated reviewed slice. See `docs/drizzle-rebaseline/drift-register.md`.
- **EventBus Pattern**: Utilizes a typed EventEmitter singleton for decoupled inter-service communication, facilitating reactive system behavior (e.g., `file:uploaded` triggers analysis).
- **Entitlements Layer**: Centralized `shared/entitlements.ts` as the single source of truth for tier-based feature gating and limits, applied consistently across both client and server.
- **Value Creation Modeller**: Implements a pure TypeScript calculation engine for financial projections, isolated from database concerns, enabling robust and testable financial modeling.

## Product

- **Target & Contact Management**: Comprehensive CRUD for acquisition targets and associated contacts, with search, filtering, and card views.
- **Team Collaboration & RBAC**: User roles, permissions, invitation workflows, and deal-specific team assignments for secure collaboration.
- **Activity Tracking**: Unified activity logger for all deal interactions, displayed in a timeline.
- **Document Management & External Portal**: Secure document handling, advanced viewer, and a portal for external document collection with automated submission and analysis.
- **AI-Powered Insights**: "AI Explain" feature for financial metrics, Gemini-powered website analysis on company creation, and AI document analysis for commercial due diligence reports.
- **Billing & Subscriptions**: Tier-based feature gating, promo code system, and multi-currency support, with beta testing infrastructure including plan overrides and feature kill switches.
- **Value Creation Modelling**: Post-acquisition financial modelling tool with scenarios, assumptions, synergies, and exit projections.
- **Automated Chase-Up System**: Timeframe-based reminder system for portal document submissions with escalating email sequences.

## User preferences

Preferred communication style: Simple, everyday language.

## Gotchas

- **Drizzle Migration Strategy, DO NOT RUN `db:push`**: It is blocked by the #188 drift and will reintroduce it. Apply schema changes as a direct ALTER with EXPLICIT constraint names (#189: auto-generated names drift between `_key` and `_unique`). Do not run `db:migrate`. `db:generate` is for producing a snapshot to review, never to apply. The live database is authoritative for accepted deltas; see `docs/drizzle-rebaseline/drift-register.md`.
- **CSRF Tokens**: Frontend must fetch a CSRF token (`GET /api/v2/auth/csrf`) and attach it as `x-csrf-token` header to all mutating API requests after authentication.
- **Data Isolation**: All data access must respect `userCompanyId` for multi-tenancy.
- **Analysis Pipeline Disk Access**: The analysis pipeline (e.g., `classifyDocumentWithGemini()`) reads text files directly from disk (`fs.readFile`) and does not use loopback HTTP calls.
- **Deal Metrics Snapshots**: Automated snapshots are silent failures and will not block parent operations if they encounter an issue.

## Pointers

- **Replit Secrets Documentation**: [https://docs.replit.com/programming-environments/secrets](https://docs.replit.com/programming-environments/secrets)
- **Drizzle ORM Documentation**: [https://orm.drizzle.team/](https://orm.drizzle.team/)
- **TanStack Query Documentation**: [https://tanstack.com/query/latest](https://tanstack.com/query/latest)
- **React Hook Form Documentation**: [https://react-hook-form.com/](https://react-hook-form.com/)
- **Zod Documentation**: [https://zod.dev/](https://zod.dev/)
- **Tailwind CSS Documentation**: [https://tailwindcss.com/docs](https://tailwindcss.com/docs)
- **Radix UI Documentation**: [https://www.radix-ui.com/](https://www.radix-ui.com/)
- **Vitest Documentation**: [https://vitest.dev/](https://vitest.dev/)