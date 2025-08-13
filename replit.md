# Overview

This is an M&A (Mergers & Acquisitions) CRM platform that helps business buyers track and manage potential acquisition targets through their deal pipeline. The system serves M&A professionals, business buyers, and investment firms who are looking to acquire businesses. Users can track target companies (businesses they want to potentially acquire) from initial identification through deal completion.

## Recent Changes (Latest: August 13, 2025)

**Phase 2 Complete - Target Company Management System**
- ✅ Full CRUD operations for target companies with all API endpoints
- ✅ Professional creation form with all required fields from specification
- ✅ Industry dropdown with exact 15 options from prompt
- ✅ Card-based list view showing company details and actions
- ✅ Modal dialogs for adding/editing with proper validation
- ✅ Website auto-prefix (https://) functionality 
- ✅ Number-to-string conversion for proper data handling
- ✅ Real-time dashboard stats integration
- ✅ Mobile-responsive design with professional UI
- ✅ Complete data isolation by user company ID
- ✅ Currency formatting and business data display
- ✅ Form validation with proper error messages
- ✅ Delete confirmation dialogs
- ✅ Loading states and skeleton screens
- ✅ Fixed accessibility warnings

**Phase 3 Complete - Target Company Contact Management System**
- ✅ Full contact CRUD operations with all required API endpoints
- ✅ Contact form with all required fields (name, title, email, phone, notes)
- ✅ Primary contact designation system with visual highlighting
- ✅ Target company detail page with comprehensive company information
- ✅ Contact list display with email/phone links and action buttons
- ✅ "View Details" eye icon button on target company cards
- ✅ Professional contact management interface with validation
- ✅ Data isolation ensuring users only see their company's contacts
- ✅ Primary contact logic (only one per company)
- ✅ Responsive design with loading states and error handling
- ✅ Complete security with user company access verification
- ✅ Professional UI components (Badge, Checkbox, Skeleton)
- ✅ Dedicated contacts page with search and filtering capabilities
- ✅ Multiple contact addition pathways (company detail page + contacts page)
- ✅ Contact filtering system (all contacts vs primary only)
- ✅ Cross-page navigation and professional M&A-focused UI

**Phase 4 Complete - Enhanced Target Company Search & Filtering**
- ✅ Real-time search with 300ms debounce for optimal performance
- ✅ Advanced filtering by industry, revenue range, employee count, year established
- ✅ Multiple sorting options (name, date, revenue, employees) with contact count integration
- ✅ Automatic website URL prefix (https://) for user convenience
- ✅ Professional search interface with active filter indicators
- ✅ Filter options endpoint providing dynamic filter data
- ✅ Database schema updates with proper numeric data types
- ✅ Mobile-responsive search and filtering interface
- ✅ Reset filters functionality and search results counter

**Phase 4 Enhancement - Direct Contact Editing from Contacts Page**
- ✅ Added Edit and Delete buttons directly on contact cards in contacts page
- ✅ Contact editing modal with pre-populated form data
- ✅ Update contact mutation with proper API endpoint integration
- ✅ Delete contact confirmation dialog with user-friendly messaging
- ✅ Form state management for both adding and editing modes
- ✅ Professional UI with Edit/Delete/View Company button grouping
- ✅ Loading states and error handling for all contact operations
- ✅ Data validation and query invalidation after mutations

**Status: Phase 4 fully implemented and enhanced - users can now edit contacts directly from the contacts page without navigating to company details**

**Phase 5 Complete - Comprehensive Team Management System (August 13, 2025)**
- ✅ Complete database schema for team management (5 new tables)
- ✅ User roles and permissions system with default role seeding
- ✅ Team member invitation workflow with secure token-based acceptance
- ✅ User notification system for team activities and deal assignments
- ✅ Deal-specific team member assignments with granular permissions
- ✅ Role-based access control with canManageUsers permissions
- ✅ Full API endpoints for invitation management (send, cancel, resend, accept)
- ✅ Team member CRUD operations with proper authorization
- ✅ Deal team assignment system with role-based permissions
- ✅ Notification system for team activities, invitations, and assignments
- ✅ Database migration with proper indexes and relationships
- ✅ Integration with existing authentication and company isolation systems
- ✅ TypeScript type safety throughout entire team management system

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

## Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Authentication**: Session-based auth using express-session with PostgreSQL store
- **Password Hashing**: bcrypt for secure password storage
- **API Design**: RESTful API with structured error handling
- **Development**: Hot reload with tsx for TypeScript execution

## Database Design
- **Primary Database**: PostgreSQL via Neon serverless
- **Schema Management**: Drizzle Kit for migrations and schema management
- **Key Entities**:
  - `user_companies`: Acquiring organizations (investment firms, buyers)
  - `users`: M&A professionals who use the system (now with team role assignments)
  - `user_roles`: Role definitions with permissions (admin, analyst, associate, etc.)
  - `user_invitations`: Secure invitation system for team member onboarding
  - `user_deal_assignments`: Deal-specific team member assignments with permissions
  - `team_notifications`: Activity notifications for team collaboration
  - `target_companies`: Businesses that users want to acquire
  - `target_contacts`: Contact information for target company personnel
  - Session storage for authentication state

## Authentication & Security
- **Session Management**: PostgreSQL-backed sessions with configurable TTL
- **Password Security**: bcrypt hashing with salt rounds
- **Authorization**: Comprehensive role-based access control system
  - Company admin permissions for full team management
  - Role-specific permissions (canManageUsers, canCreateDeals, canManageContacts)
  - Deal-specific team member assignments with granular permissions
  - Invitation-based user onboarding with secure token validation
- **Session Security**: HTTP-only cookies, CSRF protection considerations
- **Team Security**: Multi-level permission system with company isolation

## Data Flow Architecture
- **Client-Server Communication**: JSON API with fetch-based requests
- **Query Caching**: TanStack Query handles server state caching and synchronization
- **Error Handling**: Centralized error handling with toast notifications
- **Form Validation**: Client-side validation with Zod schemas, server-side validation mirroring

## Development Workflow
- **Monorepo Structure**: Shared types and schemas between client/server
- **Path Aliases**: TypeScript path mapping for clean imports (@/, @shared/)
- **Hot Reload**: Vite HMR for frontend, tsx watch mode for backend
- **Type Safety**: End-to-end TypeScript with shared schema validation

# External Dependencies

## Database Services
- **Neon Serverless PostgreSQL**: Primary database hosting with connection pooling
- **connect-pg-simple**: PostgreSQL session store for Express sessions

## UI and Component Libraries
- **Radix UI**: Unstyled, accessible UI primitives for complex components
- **shadcn/ui**: Pre-built component system built on Radix UI
- **Tailwind CSS**: Utility-first CSS framework with custom design tokens
- **Lucide React**: Icon library for consistent iconography

## Development and Build Tools
- **Vite**: Fast build tool with HMR and optimized production builds
- **Drizzle Kit**: Database migration and schema management
- **TanStack React Query**: Server state management and caching
- **React Hook Form**: Form state management with validation
- **Zod**: Runtime type validation and schema definition

## Authentication and Security
- **bcrypt**: Password hashing library
- **express-session**: Session management middleware
- **wouter**: Lightweight routing library for React

## Development Environment
- **Replit Integration**: Custom Vite plugins for Replit-specific features
- **TypeScript**: Full type safety across the entire stack
- **ESLint/Prettier**: Code quality and formatting (configured via package.json)