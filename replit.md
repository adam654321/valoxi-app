# Overview

This M&A (Mergers & Acquisitions) CRM platform helps business buyers track and manage potential acquisition targets through their deal pipeline. It provides tools for M&A professionals, business buyers, and investment firms to manage target companies from initial identification to deal completion. Key capabilities include comprehensive target and contact management, robust team collaboration with role-based access control, integrated activity tracking, and a secure external document portal for due diligence. The platform streamlines the M&A process, enhances communication, and centralizes all deal-related information.

## Recent Changes (January 2026)
- **Architecture Refactoring (Phase 1 - Pipeline)**: Implemented new modular architecture pattern to address code maintainability issues. Extracted pipeline functionality as proof-of-concept:
  - New layered architecture: Repository → Service → Routes
  - Created `server/repositories/`, `server/services/`, `server/routes/` folders
  - Shared utilities in `server/utils/` (errors.ts, response.ts)
  - New v2 API endpoints at `/api/v2/pipeline/*` running alongside existing endpoints
  - Old endpoints preserved for backwards compatibility until full migration

- **Stage 1 Analysis: Gemini Integration**: Replaced external webhook calls with internal Google Gemini LLM API calls for Stage 1 document analysis. When all 10 required files are uploaded, the system now sends file URLs directly to Gemini (gemini-3-flash-preview) for analysis instead of calling external webhooks. Key changes:
  - New Gemini service at `server/gemini-stage1-service.ts`
  - Prompt template at `server/prompts/stage1-analysis-prompt.ts`
  - New storage function `getStage1DocumentFiles()` to gather file URLs
  - Modified `checkAndTriggerStage1Analysis()` to use Gemini instead of webhooks
  - Removed automatic detailed analysis webhook (to be implemented as on-demand feature)
  - Full implementation documented in `docs/GEMINI_STAGE1_IMPLEMENTATION.md`
- **Token Usage Tracking**: Added `usage_metadata` column to `stage1_analysis_events` table to store Gemini API token usage data including:
  - `promptTokenCount`, `candidatesTokenCount`, `totalTokenCount`
  - `promptTokensDetails` (breakdown by modality: TEXT, IMAGE)
  - `thoughtsTokenCount` for model reasoning tokens

## Recent Changes (August 2025)
- **Unified Document Upload Process**: Portal uploads now use the same backend process as internal uploads, ensuring consistent categorization, folder placement, and webhook integration
- **Document Category Mapping**: Portal document types (company_accounts_1-5, balance_sheet, etc.) are automatically mapped to internal categories (Financial Statements, etc.)
- **External Submission Tracking**: Added external_submission_id column to track portal submissions while maintaining unified document management
- **Enhanced Stage 1 Webhook Logic**: Modified STAGE1_JSON_ANALYSER_WEBHOOK_URL trigger to require:
  - Exactly 5 files uploaded with 'Company Accounts' category (direct upload or portal)
  - At least 1 file in each of the 5 specific categories: Asset Register, Balance Sheet, Profit & Loss, Sales Ledger, Staff Matrix
  - Only triggers once per target company (prevents duplicate webhook calls)
  - Logic based on actual document categories, not analysis results from Company Accounts files
- **Fixed Category Name Mismatch Issue**: Critical bug fix where Stage 1 webhook was checking for 'Profit and Loss' but database contained 'Profit & Loss', preventing webhook triggers
- **Stage 1 Analysis Display**: Implemented missing `/api/target-companies/:id/stage1-analysis` endpoint to fetch and display Stage 1 analysis results in the Analysis tab
- **Fixed Duplicate Document Display Issue (Aug 19, 2025)**: Resolved issue where portal-uploaded documents appeared twice in documents folder by updating getCompanyDocuments query to exclude external submissions already processed into main documents table
- **Portal Document Counting Fix (Aug 19, 2025)**: Fixed bug where portal document progress wasn't displaying correctly by updating query to use documentCategory field instead of submissionNotes field
- **Fixed Document Categorization Bug (Aug 20, 2025)**: Resolved critical issue where "Profit & Loss (June 2024).pdf" was incorrectly categorized as "Company Accounts" instead of "Profit & Loss":
  - Updated portal mapping to include both 'profit_loss' and 'p_and_l' document types
  - Fixed category name mismatch: changed "Profit and Loss" to "Profit & Loss" in portal mapping
  - Corrected document 100 category from "Company Accounts" to "Profit & Loss" 
  - Fixed external submission filtering by setting correct external_submission_id to prevent duplicate display
  - Removed duplicate frontend reference to old "COMPANY ACCOUNTS-" prefixed filename

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript, Wouter for routing, TanStack React Query for state.
- **UI**: Radix UI primitives, shadcn/ui components, Tailwind CSS for styling.
- **Forms**: React Hook Form with Zod validation.
- **Build**: Vite.
- **UI/UX Decisions**: Professional, modern design featuring tabbed interfaces, dashboard-style metrics, color-coded financial data, responsive layouts, and consistent iconography.

## Backend Architecture
- **Framework**: Express.js with TypeScript.
- **Database ORM**: Drizzle ORM.
- **Authentication**: Session-based using `express-session` and PostgreSQL store, bcrypt for password hashing.
- **API Design**: RESTful with structured error handling.

### Modular Architecture (New Pattern)
All new features must follow this layered architecture:

```
server/
├── repositories/           # Data Access Layer (DAL)
│   └── [domain].repository.ts
├── services/              # Business Logic Layer
│   └── [domain].service.ts
├── routes/                # HTTP Layer (thin controllers)
│   ├── index.ts           # Route aggregator
│   └── [domain].routes.ts
├── utils/                 # Shared utilities
│   ├── errors.ts          # Custom error classes
│   └── response.ts        # Standardized responses
├── routes.ts              # Legacy (being migrated)
└── storage.ts             # Legacy (being migrated)
```

**Layer Responsibilities:**
1. **Repository** (`repositories/*.repository.ts`): Pure data access, database queries, no business logic
2. **Service** (`services/*.service.ts`): Business rules, validation, orchestration between repositories
3. **Routes** (`routes/*.routes.ts`): HTTP concerns only - request parsing, auth checks, response formatting

**Development Rules:**
- Max ~300 lines per file; split if larger
- New endpoints go to v2 API: `/api/v2/[domain]/*`
- Use custom errors from `utils/errors.ts`
- Use `sendSuccess()` / `sendError()` from `utils/response.ts`
- Register routes via `routes/index.ts` → `registerModularRoutes()`

**Migration Priority (from routes.ts/storage.ts):**
1. ~~Pipeline Stages~~ ✓ (Completed)
2. ~~User Roles/Permissions~~ ✓ (Completed)
3. ~~Target Contacts~~ ✓ (Completed)
4. ~~Activities~~ ✓ (Completed)
5. ~~Notifications~~ ✓ (Completed)
6. ~~Documents~~ ✓ (Completed - core CRUD)
7. ~~Target Companies~~ ✓ (Completed - core CRUD)
8. ~~Users/Auth~~ ✓ (Completed - core auth: register, login, logout, me)
9. ~~Notes~~ ✓ (Completed - deal notes CRUD at `/api/v2/notes/*`)
10. ~~Dashboard~~ ✓ (Completed - stats, widgets, alerts at `/api/v2/dashboard/*`)
11. ~~Team Management~~ ✓ (Completed - invitations, members, roles at `/api/v2/team/*`)
12. ~~Deal Assignments~~ ✓ (Completed - assign/remove team from deals at `/api/v2/deals/*`)
13. ~~Reports~~ ✓ (Completed - pipeline, activity, performance reports at `/api/v2/reports/*`)
14. ~~Portal~~ ✓ (Completed - token management, submissions at `/api/v2/portal/*`)
15. ~~Document Files~~ ✓ (Completed - upload, view, download, delete at `/api/v2/files/*` with public downloads at `/api/v2/public/documents/*`)
16. ~~Portal Submissions~~ ✓ (Completed - external document submission flow at `/api/v2/portal-submit/*` with file uploads, token validation, category mapping, and activity logging)
17. ~~Stage 1 Analysis~~ ✓ (Completed - Gemini integration for document analysis at `/api/v2/stage1-analysis/*` with requirements checking, analysis triggering, and event tracking)

## Database Design
- **Primary Database**: PostgreSQL via Neon serverless.
- **Schema Management**: Drizzle Kit.
- **Key Entities**: `user_companies`, `users`, `user_roles`, `target_companies`, `target_contacts`, activity logs, document management, external document portals, and standardized document requirements.
- **Document Requirements**: Standardized 29-requirement system initialized via database function for all deals.

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

## System Design Choices
- **Target Company Management**: Full CRUD operations with detailed information, industry categorization, and card-based views.
- **Contact Management**: Full CRUD operations, primary contact designation, integrated with target company details.
- **Search & Filtering**: Real-time search with debounce, advanced filtering, and sorting.
- **Team Management**: User roles, permissions, invitation workflow, and deal-specific team assignments.
- **Activity Management**: Logging of various activity types (calls, emails, meetings, notes) linked to contacts and displayed in a timeline.
- **Document Management**: Advanced viewer for various file types (PDF, images, Office documents) with secure handling.
- **External Document Portal**: Simple, secure portal for collecting documents from target companies, sending links via email, and tracking submissions. Portal uploads are automatically integrated into the main document system and trigger analysis webhooks.
- **Email Integration**: Simple email system using Nodemailer with Google Workspace SMTP for invitations and portal access notifications.
- **Team Invitation System**: Complete token-based invitation workflow with secure signup forms.
- **Webhook Integration**:
    - **Website Analysis**: Triggers when target companies are created with websites, sending data to an external service for analysis.
    - **File Upload Analysis**: Triggers on document upload, sending to an external analysis service. Supports sales ledger, staff matrix, asset register, profit & loss, and balance sheet document types, storing results in `document_analysis_results`. Displays financial metrics, employee data, asset breakdowns, profit & loss statements, and balance sheet analysis.
    - **Stage 1 Analysis (Gemini)**: Triggers when all 10 required documents are uploaded (5 Company Accounts + 5 analysis documents). Uses internal Google Gemini LLM API to analyze documents directly via file URLs, generating a Commercial Due Diligence Report in markdown format. Displays analysis results in a dedicated "Analysis" tab.
- **Document Requirements System**: Standardized 29-requirement system applied to all deals, with a two-stage collection process (essential financial documents and comprehensive due diligence).

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