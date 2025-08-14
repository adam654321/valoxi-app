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
- **Key Entities**: `user_companies`, `users`, `user_roles`, `user_invitations`, `user_deal_assignments`, `team_notifications`, `target_companies`, `target_contacts`, and entities for activity logging, document management, and external document portals.

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
- **External Document Portal**: Secure, token-based portal for external parties to submit documents, with robust access control, activity logging, and integration with the main document system.
- **Email Integration**: Comprehensive email system using nodemailer with Google Workspace SMTP for team invitations, portal access notifications, and document submission alerts. Features professional email templates and secure credential management.
- **Team Invitation System**: Complete invitation workflow with secure token-based invitations, professional signup forms with validation, and proper handling of existing users to prevent security conflicts.
- **Webhook Integration**: Automated webhook system that triggers when target companies are created with websites. Includes comprehensive logging, real-time response tracking, and a dedicated testing interface. Features both manual testing tools and automatic webhook firing for new companies with website data.

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