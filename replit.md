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

## Backend Architecture
- **Framework**: Express.js with TypeScript.
- **Database ORM**: Drizzle ORM.
- **Authentication**: Session-based using `express-session` and PostgreSQL store, with bcrypt for password hashing.
- **API Design**: RESTful with structured error handling.
- **Modular Architecture**: A layered architecture comprising `repositories` (data access), `services` (business logic), and `routes` (HTTP concerns) to ensure separation of concerns and maintainability. New endpoints are designed for a v2 API structure (`/api/v2/[domain]/*`).
- **EventBus Pattern**: Typed EventEmitter singleton (`server/services/event-bus.service.ts`) for decoupled inter-service communication. Supports events: `analysis:completed`, `file:uploaded`, `stage:updated`, `document:update`.
- **Centralized Configuration**: All environment variables managed through `server/config.ts` module organized by domain (server, gemini, smtp, replit, database, session).
- **Repository Pattern (Primary)**: Data access through domain repositories (`server/repositories/*.repository.ts`):
    - `usersRepository`: User CRUD, sessions, invitations, roles, team management
    - `targetCompaniesRepository`: Target company CRUD with search/filter
    - `contactsRepository`: Contact management with cascade delete handling
    - `documentAnalysisRepository`: Document analysis results
    - `portalRequirementsRepository`: Document requirements management
- **Legacy Domain Stores (Deprecated)**: Some stores remain for specialized operations (`server/storage/*.store.ts`): `documentStore`, `activityStore`, `portalStore`. Services should prefer repositories over stores.
- **Feature Specifications**:
    - **Target Company Management**: Full CRUD operations with detailed information, industry categorization, and card-based views.
    - **Contact Management**: Full CRUD operations, primary contact designation, integrated with target company details.
    - **Search & Filtering**: Real-time search with debounce, advanced filtering, and sorting capabilities.
    - **Team Management**: Includes user roles, permissions, invitation workflows, and deal-specific team assignments.
    - **Activity Management**: Logs various activity types (calls, emails, meetings, notes) linked to contacts and displayed in a timeline.
    - **Document Management**: Advanced viewer supporting various file types (PDF, images, Office documents) with secure handling.
    - **External Document Portal**: Provides a secure portal for collecting documents from target companies, integrating submissions automatically into the main document system, and triggering analysis.
    - **Email Integration**: Utilizes Nodemailer with Google Workspace SMTP for invitations and portal access notifications.
    - **Webhook Integration**:
        - **Website Analysis (Gemini)**: Triggers on company creation with a website, using Google Gemini 3.0 Flash API for analysis to extract structured company data.
        - **File Upload Analysis**: Triggers on document upload, sending to an external analysis service for financial and other data extraction.
        - **Stage 1 Analysis (Gemini)**: Triggers when specific documents are uploaded, using Google Gemini LLM API to analyze documents and generate a Commercial Due Diligence Report.
    - **Document Requirements System**: A standardized 29-requirement system is applied to all deals for a two-stage collection process.

## Database Design
- **Primary Database**: PostgreSQL via Neon serverless.
- **Schema Management**: Drizzle Kit.
- **Key Entities**: Includes `user_companies`, `users`, `user_roles`, `target_companies`, `target_contacts`, activity logs, document management, external document portals, and standardized document requirements.

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