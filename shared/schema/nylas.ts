import { pgTable, serial, varchar, integer, timestamp, jsonb, boolean, index, uniqueIndex, pgEnum } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { users, userCompanies } from './core';

export const nylasProviderEnum = pgEnum('nylas_provider', ['google', 'microsoft']);
export const nylasGrantStatusEnum = pgEnum('nylas_grant_status', ['active', 'revoked', 'broken']);

export const nylasGrants = pgTable('nylas_grants', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  userCompanyId: integer('user_company_id').notNull().references(() => userCompanies.id),
  grantId: varchar('grant_id', { length: 255 }).notNull().unique(),
  email: varchar('email', { length: 320 }).notNull(),
  provider: nylasProviderEnum('provider').notNull(),
  status: nylasGrantStatusEnum('status').notNull().default('active'),
  scopes: jsonb('scopes'),
  lastUsedAt: timestamp('last_used_at'),
  lastErrorAt: timestamp('last_error_at'),
  lastErrorMessage: varchar('last_error_message', { length: 500 }),
  isCompanyDefault: boolean('is_company_default').notNull().default(false),
  isPersonalDefault: boolean('is_personal_default').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userStatusIdx: index('nylas_grants_user_status_idx').on(table.userId, table.status),
  userCompanyIdx: index('nylas_grants_user_company_idx').on(table.userCompanyId),
  oneCompanyDefault: uniqueIndex('nylas_grants_one_company_default_per_company')
    .on(table.userCompanyId)
    .where(sql`${table.isCompanyDefault} = true`),
  onePersonalDefault: uniqueIndex('nylas_grants_one_personal_default_per_user')
    .on(table.userId)
    .where(sql`${table.isPersonalDefault} = true`),
}));

export const insertNylasGrantSchema = createInsertSchema(nylasGrants).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type NylasGrant = typeof nylasGrants.$inferSelect;
export type InsertNylasGrant = z.infer<typeof insertNylasGrantSchema>;
export type NylasProvider = 'google' | 'microsoft';
export type NylasGrantStatus = 'active' | 'revoked' | 'broken';
