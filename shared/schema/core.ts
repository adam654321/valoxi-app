import { sql } from 'drizzle-orm';
import { pgTable, serial, varchar, text, integer, boolean, timestamp, inet, unique, numeric, date, jsonb, uuid, check, index, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// User companies (the acquiring organizations)
export const userCompanies = pgTable("user_companies", {
  id: serial("id").primaryKey(),
  companyName: varchar("company_name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  address: text("address"),
  industry: varchar("industry", { length: 100 }),
  companySize: varchar("company_size", { length: 50 }),
  country: varchar("country", { length: 10 }),
  betaPlanOverride: varchar("beta_plan_override", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Users (M&A professionals who use the system)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  passwordHash: varchar("password_hash", { length: 255 }),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  userCompanyId: integer("user_company_id").references(() => userCompanies.id),
  currentCompanyId: integer("current_company_id").references(() => userCompanies.id),
  role: varchar("role", { length: 50 }).default("user"),
  userRole: varchar("user_role", { length: 50 }).default("analyst"),
  isCompanyAdmin: boolean("is_company_admin").default(false),
  isSystemAdmin: boolean("is_system_admin").default(false).notNull(),
  lastLogin: timestamp("last_login"),
  isActive: boolean("is_active").default(true),
  emailVerified: boolean("email_verified").default(false),
  onboardingCompleted: boolean("onboarding_completed").default(false).notNull(),
  onboardingStep: varchar("onboarding_step", { length: 50 }).default("create_target"),
  onboardingCompletedAt: timestamp("onboarding_completed_at"),
  hearAboutUs: varchar("hear_about_us", { length: 100 }),
  jobTitle: varchar("job_title", { length: 100 }),
  clerkUserId: varchar("clerk_user_id", { length: 255 }).unique(),
  welcomeEmailSentAt: timestamp("welcome_email_sent_at"),
  assignedPromoCampaignId: integer("assigned_promo_campaign_id"),
  assignedByAdminId: integer("assigned_by_admin_id").references((): AnyPgColumn => users.id),
  assignedAt: timestamp("assigned_at", { withTimezone: true }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Junction table for user-company relationships (many-to-many)
export const userCompanyMemberships = pgTable("user_company_memberships", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  userCompanyId: integer("user_company_id").references(() => userCompanies.id).notNull(),
  isCompanyAdmin: boolean("is_company_admin").default(false),
  membershipRole: varchar("membership_role", { length: 50 }).default("analyst"),
  joinedAt: timestamp("joined_at").defaultNow(),
  isActive: boolean("is_active").default(true),
}, (table) => ({
  uniqueUserCompany: unique("unique_user_company").on(table.userId, table.userCompanyId),
}));

// User sessions
export const userSessions = pgTable("user_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  sessionToken: varchar("session_token", { length: 255 }).unique().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// User invitations for team management
export const userInvitations = pgTable("user_invitations", {
  id: serial("id").primaryKey(),
  userCompanyId: integer("user_company_id").references(() => userCompanies.id).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  invitedBy: integer("invited_by").references(() => users.id).notNull(),
  invitationToken: varchar("invitation_token", { length: 255 }).unique().notNull(),
  invitedRole: varchar("invited_role", { length: 50 }).notNull(),
  invitationMessage: text("invitation_message"),
  invitationStatus: varchar("invitation_status", { length: 50 }).default("pending"),
  sentAt: timestamp("sent_at").defaultNow(),
  expiresAt: timestamp("expires_at").default(sql`(NOW() + INTERVAL '7 days')`),
  acceptedAt: timestamp("accepted_at"),
  ipAddressSent: inet("ip_address_sent"),
  ipAddressAccepted: inet("ip_address_accepted"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Waitlist entries — pre-user acquisition records
export const waitlist = pgTable("waitlist", {
  id: uuid("id").primaryKey().defaultRandom(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  acquisitionJourney: text("acquisition_journey").notNull(),
  targetDealSize: text("target_deal_size").notNull(),
  sectors: text("sectors").array().notNull(),
  sectorsOther: text("sectors_other"),
  acquisitionsCompleted: text("acquisitions_completed").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  cohort: text("cohort").notNull().default("5D"),
  discountTier: text("discount_tier").notNull().default("standard"),
  status: varchar("status", { length: 20 }).notNull().default("new"),
  statusChangedAt: timestamp("status_changed_at"),
  statusChangedBy: integer("status_changed_by").references(() => users.id),
  invitedUserId: integer("invited_user_id").references(() => users.id),
}, (table) => ({
  waitlistStatusCheck: check("waitlist_status_check", sql`${table.status} IN ('new','approved','invited','declined')`),
  waitlistStatusIdx: index("waitlist_status_idx").on(table.status),
  waitlistCreatedAtIdx: index("waitlist_created_at_idx").on(table.createdAt),
}));

// User roles with permissions
export const userRoles = pgTable("user_roles", {
  id: serial("id").primaryKey(),
  roleName: varchar("role_name", { length: 50 }).unique().notNull(),
  roleDescription: text("role_description"),
  canManageUsers: boolean("can_manage_users").default(false),
  canManageCompany: boolean("can_manage_company").default(false),
  canCreateDeals: boolean("can_create_deals").default(false),
  canEditAllDeals: boolean("can_edit_all_deals").default(false),
  canDeleteDeals: boolean("can_delete_deals").default(false),
  canUploadDocuments: boolean("can_upload_documents").default(false),
  canCreateOffers: boolean("can_create_offers").default(false),
  canViewFinancials: boolean("can_view_financials").default(false),
  canAccessAnalytics: boolean("can_access_analytics").default(false),
  canExportData: boolean("can_export_data").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertUserCompanySchema = createInsertSchema(userCompanies).omit({
  id: true,
  createdAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertUserCompanyMembershipSchema = createInsertSchema(userCompanyMemberships).omit({
  id: true,
  joinedAt: true,
});

export const insertUserInvitationSchema = createInsertSchema(userInvitations).omit({
  id: true,
  createdAt: true,
  sentAt: true,
  expiresAt: true,
  acceptedAt: true,
});

export const insertUserRoleSchema = createInsertSchema(userRoles).omit({
  id: true,
  createdAt: true,
});

export const insertWaitlistSchema = createInsertSchema(waitlist).omit({
  id: true,
  createdAt: true,
  statusChangedAt: true,
  statusChangedBy: true,
  invitedUserId: true,
});

// Types
export type InsertUserCompany = z.infer<typeof insertUserCompanySchema>;
export type UserCompany = typeof userCompanies.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertUserCompanyMembership = z.infer<typeof insertUserCompanyMembershipSchema>;
export type UserCompanyMembership = typeof userCompanyMemberships.$inferSelect;

export type UserSession = typeof userSessions.$inferSelect;

export type InsertUserInvitation = z.infer<typeof insertUserInvitationSchema>;
export type UserInvitation = typeof userInvitations.$inferSelect;

export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;
export type UserRole = typeof userRoles.$inferSelect;

export type InsertWaitlist = z.infer<typeof insertWaitlistSchema>;
export type Waitlist = typeof waitlist.$inferSelect;

// Token usage tracking
export const tokenUsage = pgTable("token_usage", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  userCompanyId: integer("user_company_id").references(() => userCompanies.id),
  dealId: integer("deal_id"),
  documentId: integer("document_id"),
  service: varchar("service", { length: 100 }).notNull(),
  model: varchar("model", { length: 100 }).notNull(),
  promptTokens: integer("prompt_tokens").notNull().default(0),
  candidateTokens: integer("candidate_tokens").notNull().default(0),
  totalTokens: integer("total_tokens").notNull().default(0),
  estimatedCostUsd: numeric("estimated_cost_usd", { precision: 10, scale: 6 }).notNull().default("0"),
  inputCostUsd: numeric("input_cost_usd", { precision: 10, scale: 6 }).notNull().default("0"),
  outputCostUsd: numeric("output_cost_usd", { precision: 10, scale: 6 }).notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Platform costs tracking
export const platformCosts = pgTable("platform_costs", {
  id: serial("id").primaryKey(),
  costType: varchar("cost_type", { length: 50 }).notNull(),
  provider: varchar("provider", { length: 100 }).notNull(),
  description: varchar("description", { length: 255 }).notNull(),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  amountUsd: numeric("amount_usd", { precision: 10, scale: 2 }).notNull(),
  notes: text("notes"),
  createdBy: integer("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Webhook events tracking
export const webhookEvents = pgTable("webhook_events", {
  id: serial("id").primaryKey(),
  source: varchar("source", { length: 100 }).notNull(),
  stripeEventId: varchar("stripe_event_id", { length: 255 }),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  payload: jsonb("payload").notNull().default({}),
  status: varchar("status", { length: 20 }).notNull().default("received"),
  error: text("error"),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  stripeEventIdIdx: index("webhook_events_stripe_event_id_idx").on(table.stripeEventId),
}));

// Password reset tokens
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({
  id: true,
  createdAt: true,
});

export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

// Insert schemas for new tables
export const insertTokenUsageSchema = createInsertSchema(tokenUsage).omit({
  id: true,
  createdAt: true,
});

export const insertPlatformCostSchema = createInsertSchema(platformCosts).omit({
  id: true,
  createdAt: true,
});

export const insertWebhookEventSchema = createInsertSchema(webhookEvents).omit({
  id: true,
  createdAt: true,
});

// Types for new tables
export type InsertTokenUsage = z.infer<typeof insertTokenUsageSchema>;
export type TokenUsage = typeof tokenUsage.$inferSelect;

export type InsertPlatformCost = z.infer<typeof insertPlatformCostSchema>;
export type PlatformCost = typeof platformCosts.$inferSelect;

export type InsertWebhookEvent = z.infer<typeof insertWebhookEventSchema>;
export type WebhookEvent = typeof webhookEvents.$inferSelect;

export const magicLinks = pgTable("magic_links", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  token: varchar("token", { length: 64 }).notNull().unique(),
  type: varchar("type", { length: 20 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  invalidatedAt: timestamp("invalidated_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMagicLinkSchema = createInsertSchema(magicLinks).omit({
  id: true,
  createdAt: true,
});

export type MagicLink = typeof magicLinks.$inferSelect;
export type InsertMagicLink = z.infer<typeof insertMagicLinkSchema>;

export const resendRateLimits = pgTable("resend_rate_limits", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  requestCount: integer("request_count").default(1),
  windowStart: timestamp("window_start").defaultNow(),
});

export type ResendRateLimit = typeof resendRateLimits.$inferSelect;

export const systemConfig = pgTable("system_config", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedByUserId: integer("updated_by_user_id").references(() => users.id),
});

export type SystemConfig = typeof systemConfig.$inferSelect;
