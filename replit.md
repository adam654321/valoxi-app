# Overview

This is an M&A (Mergers & Acquisitions) CRM platform designed to help business buyers track and manage potential acquisition targets through their deal pipeline. The system provides tools for M&A professionals, business buyers, and investment firms to manage target companies from initial identification through deal completion. Key capabilities include comprehensive target and contact management, robust team collaboration with role-based access control, integrated activity tracking, and a secure external document portal for due diligence. The platform aims to streamline the M&A process, enhance communication, and provide a centralized system for all deal-related information.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack React Query for server state and caching
- **UI Components**: Radix UI primitives with shadcn/ui component system
- **Styling**: Tailwind CSS with CSS custom properties for theming
- **Forms**: React Hook Form with Zod validation
- **Build Tool**: Vite for development and production builds
- **UI/UX Decisions**: Professional, modern design with tabbed interfaces, dashboard-style metrics, color-coded financial data, responsive layouts, and consistent iconography. Utilizes gradients and clean typography for visual appeal.

## Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Authentication**: Session-based auth using express-session with PostgreSQL store
- **Password Hashing**: bcrypt for secure password storage
- **API Design**: RESTful API with structured error handling

## Database Design
- **Primary Database**: PostgreSQL via Neon serverless
- **Schema Management**: Drizzle Kit for migrations and schema management
- **Key Entities**: `user_companies`, `users`, `user_roles`, `user_invitations`, `user_deal_assignments`, `team_notifications`, `target_companies`, `target_contacts`, and entities for activity logging, document management, external document portals, and standardized document requirements.
- **Document Requirements**: Standardized 29-requirement system with automatic initialization for all deals via database function.

## Authentication & Security
- **Session Management**: PostgreSQL-backed sessions with configurable TTL
- **Password Security**: bcrypt hashing with salt rounds
- **Authorization**: Comprehensive role-based access control system with company admin permissions, role-specific permissions (e.g., `canManageUsers`, `canCreateDeals`), and deal-specific team member assignments.
- **User Onboarding**: Invitation-based user onboarding with secure token validation.
- **Data Isolation**: Ensures data is isolated by user company ID.

## Data Flow Architecture
- **Client-Server Communication**: JSON API with fetch-based requests.
- **Query Caching**: TanStack Query handles server state caching and synchronization.
- **Error Handling**: Centralized error handling with toast notifications.
- **Form Validation**: Client-side validation with Zod schemas, mirrored by server-side validation.

## System Design Choices
- **Target Company Management**: Full CRUD operations for target companies with comprehensive details, industry categorization, and card-based list views.
- **Contact Management**: Full CRUD operations for contacts, primary contact designation, and integration with target company details.
- **Search & Filtering**: Real-time search with debounce, advanced filtering by industry, revenue, employees, and sorting options.
- **Team Management**: Comprehensive system with user roles, permissions, invitation workflow, and deal-specific team assignments.
- **Activity Management**: Logging and tracking of various activity types (calls, emails, meetings, notes) linked to contacts and displayed in a timeline view.
- **Document Management**: Advanced document viewer supporting various file types (PDF, images, Office documents) with secure handling and browser compatibility.
- **External Document Portal**: Simple, secure portal system for sending document collection links to target companies. Users select company and contacts, send portal link via email, and track document submissions. Focused on essential functionality without complex campaign features.
- **Email Integration**: Simple email system using nodemailer with Google Workspace SMTP for team invitations and portal access notifications. Focused on essential communications without complex campaign management.
- **Team Invitation System**: Complete invitation workflow with secure token-based invitations, professional signup forms with validation, and proper handling of existing users to prevent security conflicts.
- **Webhook Integration**: Automated webhook system that triggers when target companies are created with websites. Includes comprehensive logging, real-time response tracking, and a dedicated testing interface. Features both manual testing tools and automatic webhook firing for new companies with website data. **Fixed 2025-08-14**: Webhook response detection system now properly integrates with production company creation. Critical fix: External webhook service returns analysis data directly in the initial response body rather than calling back to our response endpoint. Both test and production systems now parse the direct response and store website analysis immediately.
- **File Upload Webhook Integration**: **Completed 2025-08-17**: Comprehensive automatic webhook system for document analysis. When files are uploaded, the system automatically sends webhook to external analysis service, receives structured analysis responses, and stores results in document_analysis_results table. Supports sales ledger, staff matrix, asset register, profit & loss, and balance sheet document types with flexible response format handling (array, nested object, direct object formats). Features professional display components for each document type showing financial metrics, employee data, asset breakdowns with depreciation calculations, profit & loss statements with year-by-year financial performance tracking, and balance sheet analysis with assets, liabilities, and equity breakdowns. Includes dedicated webhook response endpoint (/api/file-upload-events/:eventId/webhook-response), robust error handling for various response structures, and proper database cascade deletion for data integrity. **Fixed 2025-08-17**: Enhanced webhook response processing to handle all external service response formats and corrected document deletion cascade to prevent foreign key constraint violations. **Enhanced 2025-08-17**: Added profit & loss document type support with comprehensive financial performance display including revenue, gross profit, operating profit, net profit, and year-over-year analysis with colored status indicators, summary insights, and key financial ratios (Gross Margin %, Net Margin %, Interest Coverage Ratio). **Enhanced 2025-08-17**: Added balance sheet document type support with professional orange-themed display showing fixed assets, current assets breakdown, liabilities sections, shareholders' equity, and calculated metrics including Current Ratio. **Enhanced 2025-08-17**: Added multiple document type analysis support - webhook processing now handles responses containing multiple document analysis types (e.g., asset_register + sales_ledger + staff_matrix) in a single response, creating separate analysis results for each type and displaying them as individual analysis cards in the UI. **Enhanced 2025-08-17**: Added comprehensive analysis completion tracking - displays progress indicator in document management interface showing completion percentage (0-100%), completed analysis types with color-coded badges, remaining types needed, and completion celebration when all 5 analysis types are finished. Provides visual feedback for due diligence readiness.
- **Stage 1 Analysis System**: **Completed 2025-08-18**: Automated comprehensive analysis system that triggers when all 5 required document analyses (Asset Register, Balance Sheet, Profit & Loss, Sales Ledger, Staff Matrix) are complete. Features automatic detection system that monitors document analysis completion and triggers Stage 1 webhook when threshold is met. Includes database table `stage1_analysis_events` for tracking analysis lifecycle, webhook integration that sends concatenated JSON data from all 5 document types to external `stage1_json_analyser` endpoint, comprehensive frontend "Analysis" tab displaying markdown-formatted analysis results with proper loading states, and complete API integration with authentication and company access controls. System successfully tested with real document data and webhook integration, providing professional financial intelligence reports with executive summaries, key metrics, strategic insights, and investment recommendations. **Fixed 2025-08-18**: Enhanced webhook processing debugging to properly handle multiple document analysis types in array format responses from external analysis service. **Fixed 2025-08-18**: Critical data leakage fix - Stage 1 webhooks now properly filter analysis data by target company instead of sending ALL companies' data. Implemented proper JSON parsing in frontend to extract and display markdown analysis content from webhook responses instead of showing raw JSON.
- **Document Requirements System**: **CORRECTIVELY SIMPLIFIED (2025-08-15)**: Replaced complex template-based requirements with standardized 29-requirement system that automatically applies to all deals. Eliminates template management, waiver workflows, and custom requirement creation for consistent due diligence processes across all transactions.

# External Dependencies

## Database Services
- **Neon Serverless PostgreSQL**: Primary database hosting.
- **connect-pg-simple**: PostgreSQL session store for Express sessions.

## UI and Component Libraries
- **Radix UI**: Unstyled, accessible UI primitives.
- **shadcn/ui**: Pre-built component system built on Radix UI.
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

# Recent Major Changes

## 2025-08-15: Document Requirements System - Corrective Simplification

**Problem**: The previous template-based document requirements system was overly complex with:
- Custom template creation and management interfaces
- Complex waiver request and approval workflows  
- Inconsistent requirements across different deals
- Complicated template-based initialization processes

**Solution**: Implemented standardized requirements system with:
- **Fixed 29-requirement set** automatically applied to all deals
- **Two-stage collection process**:
  - Stage 1 (6 requirements): Essential financial documents for pre-offer evaluation
  - Stage 2 (23 requirements): Comprehensive due diligence post-heads-of-terms
- **Database function**: `initialize_standard_requirements()` ensures consistency
- **Eliminated complexity**: Removed template tables, waiver systems, and custom requirement creation

**Technical Changes**:
- Removed tables: `document_requirement_templates`, `document_requirement_items`, `document_requirement_waivers`
- Retained simplified: `company_document_requirements`, `document_stage_progression`
- Updated storage layer to use standardized initialization
- Removed complex route handlers for template and waiver management
- Maintained all portal functionality and document submission workflows

**Benefits**:
- Consistent due diligence requirements across all deals
- Simplified deal setup (automatic requirement initialization)
- Reduced system complexity and maintenance burden
- Maintained comprehensive document tracking and stage progression
- Preserved all external portal and communication capabilities