import { pgTable, serial, varchar, timestamp, jsonb, integer, text, boolean, uuid, inet, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users, waitlist } from './core';

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

export const marketingConsentTokens = pgTable('marketing_consent_tokens', {
  id: serial('id').primaryKey(),
  token: varchar('token', { length: 64 }).notNull().unique(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  waitlistId: uuid('waitlist_id').references(() => waitlist.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }).notNull(),
  resendMessageId: varchar('resend_message_id', { length: 255 }),
  sentAt: timestamp('sent_at').defaultNow().notNull(),
  consentRecordedAt: timestamp('consent_recorded_at'),
  ipAddress: inet('ip_address'),
  expiresAt: timestamp('expires_at').notNull(),
}, (table) => ({
  recipientCheck: check('marketing_consent_tokens_recipient_check',
    sql`(${table.userId} IS NOT NULL AND ${table.waitlistId} IS NULL) OR (${table.userId} IS NULL AND ${table.waitlistId} IS NOT NULL)`),
}));

export type MarketingConsentToken = typeof marketingConsentTokens.$inferSelect;
export type NewMarketingConsentToken = typeof marketingConsentTokens.$inferInsert;
