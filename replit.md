# Overview

This is an M&A (Mergers & Acquisitions) CRM platform that helps business buyers track and manage potential acquisition targets through their deal pipeline. The system serves M&A professionals, business buyers, and investment firms who are looking to acquire businesses. Users can track target companies (businesses they want to potentially acquire) from initial identification through deal completion.

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
  - `users`: M&A professionals who use the system
  - `target_companies`: Businesses that users want to acquire
  - Session storage for authentication state

## Authentication & Security
- **Session Management**: PostgreSQL-backed sessions with configurable TTL
- **Password Security**: bcrypt hashing with salt rounds
- **Authorization**: Role-based access (admin/user roles)
- **Session Security**: HTTP-only cookies, CSRF protection considerations

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