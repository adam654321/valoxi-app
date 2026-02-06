/**
 * Schema barrel file - re-exports all domain modules.
 * 
 * The schema is split into domain modules under shared/schema/:
 *   core.ts       - Users, companies, sessions, roles, invitations
 *   deals.ts      - Target companies, contacts, pipeline, activities, notes
 *   documents.ts  - Document storage, analysis, AI pipeline
 *   portal.ts     - External portal, submissions, chase-ups
 *   financials.ts - P&L, balance sheets, staff, assets, valuations
 *   dashboard.ts  - Dashboard widgets, alerts, composite types
 *   relations.ts  - All Drizzle relation definitions
 */
export * from './schema/index';
