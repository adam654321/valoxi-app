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
  - `AppSidebar.tsx`: Main sidebar with grouped navigation (Core, Relationships, Intelligence sections)
  - `NavUser.tsx`: User profile dropdown in sidebar footer
  - `PageHeader.tsx`: Thin top bar with breadcrumbs, notifications, and actions
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
- **EventBus Pattern**: Typed EventEmitter singleton (`server/services/event-bus.service.ts`) for decoupled inter-service communication. Supports events: `analysis:completed`, `file:uploaded`, `stage:updated`, `document:update`.
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
- **Legacy Storage Facade**: The `server/storage.ts` facade remains for route compatibility but services use repositories directly. Legacy stores (`server/storage/*.store.ts`) are deprecated.
- **Feature Specifications**:
    - **Target Company Management**: Full CRUD operations with detailed information, industry categorization, and card-based views.
    - **Contact Management**: Full CRUD operations, primary contact designation, integrated with target company details.
    - **Search & Filtering**: Real-time search with debounce, advanced filtering, and sorting capabilities.
    - **Team Management**: Includes user roles, permissions, invitation workflows, and deal-specific team assignments.
    - **Activity Management**: Logs various activity types (calls, emails, meetings, notes) linked to contacts and displayed in a timeline.
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

## Database Design
- **Primary Database**: PostgreSQL via Neon serverless.
- **Schema Management**: Drizzle Kit.
- **Schema Architecture**: Modular domain-driven structure under `shared/schema/`:
  - `core.ts` — Users, companies, sessions, roles, invitations, memberships (6 tables)
  - `deals.ts` — Target companies, contacts, pipeline stages, activities, deal notes (9 tables)
  - `documents.ts` — Document storage, categories, access log, upload events, AI analysis (7 tables)
  - `portal.ts` — External portal tokens, submissions, chase-ups, campaigns, analytics (13 tables)
  - `financials.ts` — P&L, balance sheets, staff data, assets, loans, EBITDA adjustments, valuations (9 tables)
  - `dashboard.ts` — Dashboard preferences, alerts, composite types (2 tables)
  - `relations.ts` — All 33 Drizzle relation definitions (centralized to avoid circular deps)
  - `index.ts` — Barrel re-export of all modules
  - `shared/schema.ts` — Top-level re-export (`export * from './schema/index'`) so all existing imports continue to work unchanged
- **Key Entities**: Includes `user_companies`, `users`, `user_roles`, `target_companies`, `target_contacts`, activity logs, document management, external document portals, standardized document requirements, `chase_up_schedules`, and `chase_up_emails`.

## Authentication & Security
- **Session Management**: PostgreSQL-backed sessions.
- **Password Security**: bcrypt hashing.
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