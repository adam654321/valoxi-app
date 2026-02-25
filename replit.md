# Overview

This M&A (Mergers & Acquisitions) CRM platform is designed to assist business buyers, M&A professionals, and investment firms in managing their deal pipelines. It centralizes the tracking and management of potential acquisition targets from initial identification through to deal completion. The platform aims to streamline the M&A process by offering comprehensive target and contact management, robust team collaboration with role-based access control, integrated activity tracking, and a secure external document portal for due diligence.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript, Wouter for routing, and TanStack React Query for state management.
- **UI**: Utilizes Radix UI primitives and shadcn/ui components, styled with Tailwind CSS.
- **Forms**: Managed using React Hook Form with Zod for validation.
- **Build**: Vite.
- **UI/UX Decisions**: Features a professional, modern design with tabbed interfaces, dashboard-style metrics, color-coded financial data, responsive layouts, and consistent iconography.
- **Layout Architecture**: Modern collapsible sidebar navigation system (`client/src/components/layout/`):
  - `AppSidebar.tsx`: Main sidebar with grouped navigation (Core, Relationships, Intelligence sections). Shows "Admin" link for system admins.
  - `NavUser.tsx`: User profile dropdown in sidebar footer
  - `PageHeader.tsx`: Thin top bar with breadcrumbs, notifications, and actions
- **Admin Section** (`client/src/pages/admin/`): System admin dashboard with its own layout and route guard:
  - `AdminRoute` component (`client/src/components/admin-route.tsx`): Auth + isSystemAdmin guard
  - `AdminLayout` component (`client/src/components/admin-layout.tsx`): Dedicated sidebar with admin navigation
  - Pages: Overview (metrics + charts), Token Usage (by company/deal/service with date filtering), Platform Costs (CRUD + summary cards), Companies (list + detail drill-down), Users (list with roles/status), Webhook Events (log viewer)
  - Sidebar collapses to icon-only mode with tooltips, mobile-responsive drawer on small screens, keyboard shortcut Ctrl+B to toggle

## Backend Architecture
- **Framework**: Express.js with TypeScript.
- **Database ORM**: Drizzle ORM.
- **Authentication**: Session-based using `express-session` and PostgreSQL store, with bcrypt for password hashing.
- **API Design**: RESTful with structured error handling.
- **Modular Architecture**: A layered architecture comprising `repositories` (data access), `services` (business logic), and `routes` (HTTP concerns) to ensure separation of concerns and maintainability. All endpoints use the v2 API structure (`/api/v2/[domain]/*`).
- **Route Infrastructure**: `server/routes.ts` is a minimal infrastructure-only file (session middleware + modular route registration + HTTP server creation). All domain logic lives in `server/routes/*.routes.ts` files.
- **Middleware Layer** (`server/middleware/`):
    - `session.ts`: Exports `createSessionMiddleware()` for PostgreSQL-backed session configuration. Requires `SESSION_SECRET` env var (throws on missing).
    - `auth.ts`: Exports `isAuthenticated` middleware for route protection (checks `req.session.userId`).
- **EventBus Pattern**: Typed EventEmitter singleton (`server/services/event-bus.service.ts`) for decoupled inter-service communication. Supports events: `file:uploaded`, `stage:updated`, `document:update`, `financial_data:update`.
- **Centralized Configuration**: All environment variables managed through `server/config.ts` module organized by domain (server, gemini, smtp, replit, database, session).
- **Repository Pattern (Primary)**: Data access through domain repositories (`server/repositories/*.repository.ts`):
    - `usersRepository`: User CRUD, sessions, invitations, roles, team management
    - `targetCompaniesRepository`: Target company CRUD with search/filter
    - `contactsRepository`: Contact management with cascade delete handling
    - `documentsRepository`: Document CRUD, file upload events, external submissions
    - `documentAnalysisRepository`: Document analysis results storage and retrieval
    - `stage1AnalysisRepository`: Stage 1 analysis events and document categorization
    - `activitiesRepository`: Activity CRUD, timeline, and recent activities
    - `portalRepository`: Portal tokens, submissions, and access logging
    - `portalRequirementsRepository`: Document requirements management
    - `dashboardRepository`: Dashboard metrics, widgets, and preferences
    - `assignmentsRepository`: Deal team assignments
    - `pipelineRepository`: Pipeline stages and stage history
    - `notificationsRepository`: User notifications
    - `teamRepository`: Team members and roles
    - `chaseUpRepository`: Chase-up schedules and email tracking for portal submissions
    - `passwordResetRepository`: Password reset token creation, validation, and cleanup
- **Legacy Storage Facade**: The `server/storage.ts` facade remains for route compatibility but services use repositories directly. Legacy stores (`server/storage/*.store.ts`) are deprecated.
- **Feature Specifications**:
    - **Target Company Management**: Full CRUD operations with detailed information, industry categorization, and card-based views.
    - **Contact Management**: Full CRUD operations, primary contact designation, integrated with target company details.
    - **Search & Filtering**: Real-time search with debounce, advanced filtering, and sorting capabilities.
    - **Team Management**: Includes user roles, permissions, invitation workflows, and deal-specific team assignments.
    - **Activity Management**: Unified activity logger covering all deal interactions (calls, emails, meetings, broker discussions, due diligence, heads of terms, meeting notes, etc.) linked to contacts and displayed in a timeline. Notes feature has been retired and consolidated into activities.
    - **Document Management**: Advanced viewer supporting various file types (PDF, images, Office documents) with secure handling.
    - **External Document Portal**: Provides a secure portal for collecting documents from target companies, integrating submissions automatically into the main document system, and triggering analysis.
    - **Chase-Up System**: Automated timeframe-based reminder system for portal document submissions. Features include:
        - Configurable submission timeframes (7-60 days) when creating portal links
        - Escalating 4-email sequence (gentle → firm → urgent → final) after deadline passes
        - Email delays at 0, 2, 5, 8 days post-deadline, then manual intervention at 11+ days
        - Manual controls: extend deadline, stop chase-up reminders
        - Internal team alerts for urgent cases and manual intervention required
        - Daily cron job (9:00 AM UK time) processes overdue schedules
        - V2 API endpoints: `/api/v2/chase-up/*` for dashboard, alerts, status, extend, stop
    - **Email Integration**: Utilizes Nodemailer with Google Workspace SMTP for invitations and portal access notifications.
    - **Webhook Integration**:
        - **Website Analysis (Gemini)**: Triggers on company creation with a website, using Google Gemini 3.0 Flash API for analysis to extract structured company data.
        - **File Upload Analysis**: Triggers on document upload, sending to an external analysis service for financial and other data extraction.
        - **Stage 1 Analysis (Gemini)**: Triggers when specific documents are uploaded, using Google Gemini LLM API to analyze documents and generate a Commercial Due Diligence Report.
    - **Document Requirements System**: A standardized 29-requirement system is applied to all deals for a two-stage collection process.
    - **DD Document Collection via Portal**: Public endpoint `GET /api/v2/portal-submit/:token/dd-requirements` serves DD categories, requirements, and their status (including linked document names) to the seller portal. Portal uploads with a `requirement_id` auto-link to DD requirements by updating `dd_requirement_status` with `externalSubmissionId`, `documentId`, and status `in_progress`. The `getDdStatusForCompany` method joins with the documents table to include `linkedDocumentName` and `linkedDocumentFilename` in status responses.

## Database Design
- **Primary Database**: PostgreSQL via Neon serverless.
- **Schema Management**: Drizzle Kit — using `db:push` as the active sync strategy (`npm run db:push`). `db:generate` is also available to snapshot schema changes into versioned SQL files in `migrations/` if needed for review or rollback reference. The 3 existing migration files (`0000`, `0001`, `0002`) are historical artifacts — `push` is the source of truth for the live database. Do not mix `push` and `migrate` strategies.
- **Schema Architecture**: Modular domain-driven structure under `shared/schema/`:
  - `core.ts` — Users, companies, sessions, roles, invitations, memberships (6 tables)
  - `deals.ts` — Target companies, contacts, pipeline stages, activities, deal notes [retired] (9 tables)
  - `documents.ts` — Document storage, categories, access log, upload events, AI analysis (7 tables)
  - `portal.ts` — External portal tokens, submissions, chase-ups, campaigns, analytics (13 tables)
  - `financials.ts` — P&L, balance sheets, staff data, assets, loans, EBITDA adjustments, valuations (9 tables)
  - `dashboard.ts` — Dashboard preferences, alerts, composite types (2 tables)
  - `value-creation.ts` — Value creation scenarios, assumptions, synergies, exit assumptions (4 tables)
  - `relations.ts` — All 33 Drizzle relation definitions (centralized to avoid circular deps)
  - `index.ts` — Barrel re-export of all modules
  - `shared/schema.ts` — Top-level re-export (`export * from './schema/index'`) so all existing imports continue to work unchanged
- **Key Entities**: Includes `user_companies`, `users`, `user_roles`, `target_companies`, `target_contacts`, activity logs, document management, external document portals, standardized document requirements, `chase_up_schedules`, `chase_up_emails`, and value creation modelling tables.
- **Value Creation Modeller**: Post-acquisition financial modelling feature:
    - Pure TypeScript calculation engine at `shared/calculators/value-creation.calc.ts` (5-year P&L projections, debt schedules, waterfall, returns/IRR/MOIC, sensitivity analysis)
    - Service at `server/services/value-creation.service.ts`, routes at `server/routes/value-creation.routes.ts`
    - V2 API endpoints: `/api/v2/value-creation/*` for scenarios, assumptions, synergies, exit assumptions
    - Auto-creates bear/base/bull scenarios with 5-year assumptions on first access per deal model

## Authentication & Security
- **Session Management**: PostgreSQL-backed sessions.
- **Password Security**: bcrypt hashing.
- **CSRF Protection**: Token-based CSRF protection (`server/middleware/csrf.ts`):
  - `attachCsrfToken`: Generates and stores a per-session CSRF token (crypto randomBytes) on every request.
  - `validateCsrfToken`: Validates `x-csrf-token` header against session token for all non-GET/HEAD/OPTIONS requests. Returns 403 on mismatch.
  - Applied to all authenticated route groups; excluded from public/portal routes and auth login/register endpoints.
  - Frontend fetches token via `GET /api/v2/auth/csrf` on auth check and after login/register, attaches it to all mutating `apiRequest` calls.
- **Authorization**: Comprehensive role-based access control (RBAC) with company admin and role-specific permissions, and deal-specific team assignments.
- **User Onboarding**: Invitation-based with secure token validation.
- **Data Isolation**: Ensures data isolation by user company ID.

## Data Flow Architecture
- **Client-Server Communication**: JSON API with fetch-based requests.
- **Query Caching**: TanStack Query for server state caching.
- **Error Handling**: Centralized with toast notifications.
- **Form Validation**: Client-side (Zod) mirrored by server-side.

# External Dependencies

## Database Services
- **Neon Serverless PostgreSQL**: Primary database hosting.
- **connect-pg-simple**: PostgreSQL session store.

## UI and Component Libraries
- **Radix UI**: Unstyled, accessible UI primitives.
- **shadcn/ui**: Component system built on Radix UI.
- **Tailwind CSS**: Utility-first CSS framework.
- **Lucide React**: Icon library.

## Design System & Theming
- **Color tokens**: All colors use CSS custom properties via shadcn/Tailwind theme tokens. No hardcoded gray-* Tailwind classes.
  - Text: `text-foreground` (primary), `text-muted-foreground` (secondary), `text-muted-foreground/70` (tertiary)
  - Backgrounds: `bg-card` (surfaces), `bg-muted` (subtle), `bg-background` (page)
  - Borders: `border-border`, `divide-border`
  - Dark mode: `ThemeProvider` (`client/src/components/theme-provider.tsx`) manages light/dark/system preference via `localStorage` key `ma-crm-theme`, toggles `dark` class on `<html>`. Toggle button in `PageHeader.tsx` via `ThemeToggle` component. CSS variables in `:root` and `.dark` handle all color switching — no `dark:*-gray-*` classes needed
- **Error Boundary**: `client/src/components/error-boundary.tsx` wraps router in App.tsx
- **Code Splitting**: 22 pages use `React.lazy()` with strategic Suspense boundaries
- **Component Extraction**: Dashboard (7 widgets) and Target Companies (4 components) extracted into dedicated `client/src/components/` subdirectories

## Development and Build Tools
- **Vite**: Fast build tool.
- **Drizzle Kit**: Database migration and schema management.
- **TanStack React Query**: Server state management and caching.
- **React Hook Form**: Form state management.
- **Zod**: Runtime type validation and schema definition.

## Authentication and Security
- **bcrypt**: Password hashing library.
- **express-session**: Session management middleware.
- **wouter**: Lightweight routing library for React.

# Testing

## Framework
- **Vitest** (`npx vitest run` to execute, `npx vitest` for watch mode)
- Config: `vitest.config.ts` (node environment, `@shared` alias)

## Test Files (55 tests)
- `shared/calculators/__tests__/deal-model.calc.test.ts` — 28 tests covering `toNum`, `calculateAdjustedEbitda`, `calculateOfferPrice`, `calculateFees`, `calculateFundingStack`, `calculatePaymentCover`, `calculateFullDealModel`
- `shared/calculators/__tests__/value-creation.calc.test.ts` — 16 tests covering `calculateProjections`, `calculateIRR`, `calculateReturns`, `calculateLinkedScenarios`
- `server/services/__tests__/parseDecimal.test.ts` — 11 tests covering currency/number string parsing (£, $, commas, whitespace, edge cases)

## Strategy
Targeted tests on pure financial calculation engines only. No UI/component tests. No API route tests.

# Required Secrets

Configure these in the Replit **Secrets** panel (padlock icon). Variables marked Replit-provided are injected automatically — do not add them manually.

## Auto-Provided by Replit
| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default 5000) |
| `NODE_ENV` | Runtime environment |
| `REPL_ID` | Unique Repl identifier |
| `REPL_SLUG` | Repl name slug |
| `REPL_OWNER` | Repl owner username |
| `REPLIT_DEV_DOMAIN` | Public dev domain (used for portal URLs and email links) |

## Managed by Replit Integrations
| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Neon PostgreSQL connection string (provisioned via Database integration) |
| `AI_INTEGRATIONS_GEMINI_API_KEY` | Gemini key for Replit AI chat/image integrations |
| `AI_INTEGRATIONS_GEMINI_BASE_URL` | Base URL for Replit AI integrations |

## Required — Set Manually
| Variable | Required | Description |
|----------|----------|-------------|
| `SESSION_SECRET` | ✅ Yes | Random 32-byte hex string. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `GOOGLE_GEMINI_API_KEY` | ✅ Yes | Gemini API key for document analysis and website analysis |
| `SMTP_HOST` | ⚠️ Email only | SMTP server hostname (e.g. `smtp.gmail.com`) |
| `SMTP_PORT` | ⚠️ Email only | SMTP port (default `587`) |
| `SMTP_USER` | ⚠️ Email only | SMTP username / email address |
| `SMTP_PASS` | ⚠️ Email only | SMTP password or app password |
| `SMTP_FROM_EMAIL` | ⚠️ Email only | Sender address for outbound emails |
| `SMTP_SECURE` | ⚠️ Email only | `true` for TLS/465, `false` for STARTTLS/587 |

# API Reference

All endpoints are prefixed `/api/v2/`. The API is consumed exclusively by the internal React frontend — no external consumers. For the full route map, see `server/routes/index.ts`.

| Base Path | Auth | Description |
|-----------|------|-------------|
| `/api/v2/auth` | 🔑 Rate limited | Login, logout, register, session check, CSRF token, password reset |
| `/api/v2/target-companies` | 🔒 | CRUD for acquisition target companies |
| `/api/v2/contacts` | 🔒 | Contacts linked to target companies |
| `/api/v2/activities` | 🔒 | Activity log (calls, emails, meetings) per company |
| `/api/v2/pipeline` | 🔒 | Pipeline stages, company stage movement, stage history |
| `/api/v2/deals` | 🔒 | Deal team assignments and permissions |
| `/api/v2/deal-models` | 🔒 | Deal modeller (financial model assumptions) |
| `/api/v2/deal-documents` | 🔒 | Offer letters, HoT, withdrawal letters (HTML generation + sending) |
| `/api/v2/public/deal-documents` | 🌐 Rate limited | Public access to deal documents for portal users |
| `/api/v2/documents` | 🔒 | Document metadata CRUD |
| `/api/v2/files` | 🔒 | Document file uploads and downloads |
| `/api/v2/public/documents` | 🌐 | Public document access for portal submissions |
| `/api/v2/document-analysis` | 🔒 | AI document parsing, categorisation, and analysis results |
| `/api/v2/due-diligence` | 🔒 | Due diligence checklist and requirement status |
| `/api/v2/requirements` | 🔒 | Portal document requirements management |
| `/api/v2/portal` | 🌐 Rate limited | Portal token creation and management |
| `/api/v2/portal-submit` | 🌐 Rate limited | External portal: document uploads, NDA/offer/HoT submissions |
| `/api/v2/public/portal` | 🌐 Rate limited | Public DD requirements and portal status |
| `/api/v2/chase-up` | 🔒 | Automated chase-up campaign dashboard, alerts, extend/stop controls |
| `/api/v2/financial-data` | 📊 | P&L, balance sheets, EBITDA adjustments, valuations |
| `/api/v2/value-creation` | 🔒 | Post-acquisition value creation scenarios and modelling |
| `/api/v2/expert-analysis` | 📊 Rate limited | Gemini AI expert analysis pipeline (triggers AI processing) |
| `/api/v2/website-analysis` | 🔒 Rate limited | Gemini AI website analysis (triggers on company creation) |
| `/api/v2/dashboard` | 🔒 | Dashboard widgets, metrics, and preferences |
| `/api/v2/reports` | 📊 | Analytics and reporting |
| `/api/v2/notifications` | 🔒 | User notifications |
| `/api/v2/email` | 🔒 | Manual email sending |
| `/api/v2/team` | 👥 | Team member management (public: invitation acceptance) |
| `/api/v2/roles` | 🔒 | Role assignment |
| `/api/v2/user/companies` | 🔒 | User–company membership |
| `/api/v2/admin` | ⚙️ | System admin: users, companies, costs, token usage, webhook events |