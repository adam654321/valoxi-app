import { pgTable, serial, varchar, text, integer, boolean, timestamp, jsonb, unique, pgEnum } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { userCompanies } from './core';

export const planKeyEnum = pgEnum('plan_key', ['CORE', 'PROFESSIONAL', 'EXPERT', 'ENTERPRISE']);
export const subscriptionStatusEnum = pgEnum('subscription_status', ['active', 'trialing', 'past_due', 'canceled', 'incomplete', 'admin_comped']);
export const billingIntervalEnum = pgEnum('billing_interval', ['month', 'year']);

export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userCompanyId: integer("user_company_id").notNull().unique().references(() => userCompanies.id),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }).unique(),
  planKey: planKeyEnum("plan_key").notNull().default('CORE'),
  status: subscriptionStatusEnum("status").notNull().default('trialing'),
  billingInterval: billingIntervalEnum("billing_interval").default('month'),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  trialStart: timestamp("trial_start"),
  trialEnd: timestamp("trial_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  addOnCompanySlots: integer("add_on_company_slots").notNull().default(0),
  additionalSeats: integer("additional_seats").notNull().default(0),
  isCommunityMember: boolean("is_community_member").notNull().default(false),
  communityFreeMonthsRemaining: integer("community_free_months_remaining").notNull().default(0),
  enterpriseOverrides: jsonb("enterprise_overrides"),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const subscriptionEvents = pgTable("subscription_events", {
  id: serial("id").primaryKey(),
  userCompanyId: integer("user_company_id").notNull().references(() => userCompanies.id),
  stripeEventId: varchar("stripe_event_id", { length: 255 }).unique(),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  previousStatus: subscriptionStatusEnum("previous_status"),
  previousPlanKey: planKeyEnum("previous_plan_key"),
  newStatus: subscriptionStatusEnum("new_status"),
  newPlanKey: planKeyEnum("new_plan_key"),
  payload: jsonb("payload").notNull().default({}),
  adminUserId: integer("admin_user_id"),
  processedAt: timestamp("processed_at").defaultNow().notNull(),
});

export const addonPurchases = pgTable("addon_purchases", {
  id: serial("id").primaryKey(),
  userCompanyId: integer("user_company_id").notNull().references(() => userCompanies.id),
  addonType: varchar("addon_type", { length: 50 }).notNull(),
  quantity: integer("quantity").notNull().default(1),
  stripePaymentRef: varchar("stripe_payment_ref", { length: 255 }),
  unitPriceMinorUnit: integer("unit_price_minor_unit").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default('gbp'),
  purchasedAt: timestamp("purchased_at").defaultNow().notNull(),
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSubscriptionEventSchema = createInsertSchema(subscriptionEvents).omit({
  id: true,
  processedAt: true,
});

export const insertAddonPurchaseSchema = createInsertSchema(addonPurchases).omit({
  id: true,
  purchasedAt: true,
});

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;

export type SubscriptionEvent = typeof subscriptionEvents.$inferSelect;
export type InsertSubscriptionEvent = z.infer<typeof insertSubscriptionEventSchema>;

export type AddonPurchase = typeof addonPurchases.$inferSelect;
export type InsertAddonPurchase = z.infer<typeof insertAddonPurchaseSchema>;

export type PlanKey = 'CORE' | 'PROFESSIONAL' | 'EXPERT' | 'ENTERPRISE';
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete' | 'admin_comped';
export type BillingInterval = 'month' | 'year';
