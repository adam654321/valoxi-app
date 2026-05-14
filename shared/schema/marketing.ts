import { pgTable, serial, varchar, timestamp, jsonb, integer, text, boolean } from 'drizzle-orm/pg-core';
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

export const broadcastsSent = pgTable('broadcasts_sent', {
  id: serial('id').primaryKey(),
  composerSessionId: varchar('composer_session_id', { length: 64 }).notNull(),
  subject: varchar('subject', { length: 255 }).notNull(),
  bodyMarkdown: text('body_markdown').notNull(),
  segmentKey: varchar('segment_key', { length: 50 }).notNull(),
  segmentId: varchar('segment_id', { length: 255 }).notNull(),
  isTest: boolean('is_test').notNull().default(false),
  recipientCountEstimate: integer('recipient_count_estimate'),
  resendBroadcastId: varchar('resend_broadcast_id', { length: 255 }),
  sentByUserId: integer('sent_by_user_id').notNull().references(() => users.id),
  status: varchar('status', { length: 30 }).notNull().default('sent'),
  errorMessage: text('error_message'),
  sentAt: timestamp('sent_at').defaultNow().notNull(),
});

export type BroadcastSent = typeof broadcastsSent.$inferSelect;
export type NewBroadcastSent = typeof broadcastsSent.$inferInsert;
