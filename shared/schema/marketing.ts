import { pgTable, serial, varchar, timestamp, jsonb, integer } from 'drizzle-orm/pg-core';
import { users } from './core';

export const marketingUnsubscribes = pgTable('marketing_unsubscribes', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  email: varchar('email', { length: 255 }).notNull(),
  topicId: varchar('topic_id', { length: 255 }),
  topicName: varchar('topic_name', { length: 255 }),
  resendEventId: varchar('resend_event_id', { length: 255 }).notNull().unique(),
  resendContactId: varchar('resend_contact_id', { length: 255 }),
  payload: jsonb('payload').notNull().default({}),
  unsubscribedAt: timestamp('unsubscribed_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  source: varchar('source', { length: 50 }).notNull().default('resend_webhook'),
});

export type MarketingUnsubscribe = typeof marketingUnsubscribes.$inferSelect;
export type NewMarketingUnsubscribe = typeof marketingUnsubscribes.$inferInsert;
