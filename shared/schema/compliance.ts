import { pgTable, serial, integer, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { users } from './core';

export const userAcceptances = pgTable('user_acceptances', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  documentType: varchar('document_type', { length: 32 }).notNull(),
  version: varchar('version', { length: 32 }).notNull(),
  acceptedAt: timestamp('accepted_at').defaultNow().notNull(),
  ipAddress: varchar('ip_address', { length: 64 }),
  userAgent: text('user_agent'),
});

export const insertUserAcceptanceSchema = createInsertSchema(userAcceptances).omit({
  id: true,
  acceptedAt: true,
});

export type InsertUserAcceptance = z.infer<typeof insertUserAcceptanceSchema>;
export type UserAcceptance = typeof userAcceptances.$inferSelect;
