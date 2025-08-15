import { sql } from 'drizzle-orm';
import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  decimal,
  boolean,
  timestamp,
  inet,
  unique,
  numeric,
  date,
  bigint,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// User companies (the acquiring organizations)
export const userCompanies = pgTable("user_companies", {
  id: serial("id").primaryKey(),
  companyName: varchar("company_name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  address: text("address"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Users (M&A professionals who use the system)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  userCompanyId: integer("user_company_id").references(() => userCompanies.id),
  role: varchar("role", { length: 50 }).default("user"),
  userRole: varchar("user_role", { length: 50 }).default("analyst"),
  isCompanyAdmin: boolean("is_company_admin").default(false),
  lastLogin: timestamp("last_login"),
  isActive: boolean("is_active").default(true),
  emailVerified: boolean("email_verified").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Target companies (businesses users want to acquire)
export const targetCompanies = pgTable("target_companies", {
  id: serial("id").primaryKey(),
  userCompanyId: integer("user_company_id").references(() => userCompanies.id).notNull(),
  companyName: varchar("company_name", { length: 255 }).notNull(),
  industry: varchar("industry", { length: 100 }),
  website: varchar("website", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 255 }),
  address: text("address"),
  annualRevenue: decimal("annual_revenue"),
  employeeCount: integer("employee_count"),
  yearEstablished: integer("year_established"),
  description: text("description"),
  websiteAnalysis: text("website_analysis"), // Store processed website information from webhook
  websiteAnalysisProcessedAt: timestamp("website_analysis_processed_at"), // Track when analysis was completed
  stage: varchar("stage", { length: 50 }).default("New Target"),
  stageUpdatedAt: timestamp("stage_updated_at").defaultNow(),
  stageUpdatedBy: integer("stage_updated_by").references(() => users.id),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Primary contacts at target companies
export const targetContacts = pgTable("target_contacts", {
  id: serial("id").primaryKey(),
  targetCompanyId: integer("target_company_id").references(() => targetCompanies.id).notNull(),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  title: varchar("title", { length: 100 }),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  isPrimary: boolean("is_primary").default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

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

// User deal assignments (many-to-many for users and target companies)
export const userDealAssignments = pgTable("user_deal_assignments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  targetCompanyId: integer("target_company_id").references(() => targetCompanies.id).notNull(),
  assignedBy: integer("assigned_by").references(() => users.id).notNull(),
  assignmentRole: varchar("assignment_role", { length: 50 }).default("analyst"),
  assignmentDate: timestamp("assignment_date").defaultNow(),
  isActive: boolean("is_active").default(true),
  canEditCompany: boolean("can_edit_company").default(true),
  canUploadDocuments: boolean("can_upload_documents").default(true),
  canCreateActivities: boolean("can_create_activities").default(true),
  canManageContacts: boolean("can_manage_contacts").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueUserCompany: unique().on(table.userId, table.targetCompanyId),
}));

// Team notifications
export const teamNotifications = pgTable("team_notifications", {
  id: serial("id").primaryKey(),
  userCompanyId: integer("user_company_id").references(() => userCompanies.id).notNull(),
  targetUserId: integer("target_user_id").references(() => users.id).notNull(),
  fromUserId: integer("from_user_id").references(() => users.id).notNull(),
  notificationType: varchar("notification_type", { length: 50 }).notNull(),
  notificationTitle: varchar("notification_title", { length: 255 }).notNull(),
  notificationMessage: text("notification_message"),
  targetCompanyId: integer("target_company_id").references(() => targetCompanies.id),
  relatedObjectType: varchar("related_object_type", { length: 50 }),
  relatedObjectId: integer("related_object_id"),
  isRead: boolean("is_read").default(false),
  readAt: timestamp("read_at"),
  isEmailSent: boolean("is_email_sent").default(false),
  emailSentAt: timestamp("email_sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Pipeline stages definitions
export const pipelineStages = pgTable("pipeline_stages", {
  id: serial("id").primaryKey(),
  stageName: varchar("stage_name", { length: 50 }).unique().notNull(),
  stageOrder: integer("stage_order").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Stage history for tracking changes
export const stageHistory = pgTable("stage_history", {
  id: serial("id").primaryKey(),
  targetCompanyId: integer("target_company_id").references(() => targetCompanies.id).notNull(),
  fromStage: varchar("from_stage", { length: 50 }),
  toStage: varchar("to_stage", { length: 50 }).notNull(),
  changedBy: integer("changed_by").references(() => users.id).notNull(),
  changedAt: timestamp("changed_at").defaultNow(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Activity types reference table
export const activityTypes = pgTable("activity_types", {
  id: serial("id").primaryKey(),
  typeName: varchar("type_name", { length: 50 }).unique().notNull(),
  description: text("description"),
  requiresContact: boolean("requires_contact").default(false),
  defaultDuration: integer("default_duration"), // in minutes
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Activities table for tracking all interactions
export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  targetCompanyId: integer("target_company_id").references(() => targetCompanies.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  activityType: varchar("activity_type", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  activityDate: timestamp("activity_date").notNull(),
  activityTime: varchar("activity_time", { length: 8 }), // HH:MM format
  durationMinutes: integer("duration_minutes"),
  contactId: integer("contact_id").references(() => targetContacts.id),
  isCompleted: boolean("is_completed").default(true),
  followUpDate: timestamp("follow_up_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const userCompaniesRelations = relations(userCompanies, ({ many }) => ({
  users: many(users),
  targetCompanies: many(targetCompanies),
  invitations: many(userInvitations),
  notifications: many(teamNotifications),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  userCompany: one(userCompanies, {
    fields: [users.userCompanyId],
    references: [userCompanies.id],
  }),
  targetCompanies: many(targetCompanies),
  sessions: many(userSessions),
  invitationsSent: many(userInvitations, { relationName: "inviter" }),
  dealAssignments: many(userDealAssignments, { relationName: "assignedUser" }),
  dealAssignmentsMade: many(userDealAssignments, { relationName: "assigner" }),
  notificationsReceived: many(teamNotifications, { relationName: "targetUser" }),
  notificationsSent: many(teamNotifications, { relationName: "fromUser" }),
  activities: many(activities),
}));

export const targetCompaniesRelations = relations(targetCompanies, ({ one, many }) => ({
  userCompany: one(userCompanies, {
    fields: [targetCompanies.userCompanyId],
    references: [userCompanies.id],
  }),
  createdByUser: one(users, {
    fields: [targetCompanies.createdBy],
    references: [users.id],
  }),
  stageUpdatedByUser: one(users, {
    fields: [targetCompanies.stageUpdatedBy],
    references: [users.id],
    relationName: "stageUpdater",
  }),
  contacts: many(targetContacts),
  dealAssignments: many(userDealAssignments),
  notifications: many(teamNotifications),
  stageHistory: many(stageHistory),
  activities: many(activities),
  documents: many(documents),
}));

export const targetContactsRelations = relations(targetContacts, ({ one, many }) => ({
  targetCompany: one(targetCompanies, {
    fields: [targetContacts.targetCompanyId],
    references: [targetCompanies.id],
  }),
  activities: many(activities),
}));

export const userSessionsRelations = relations(userSessions, ({ one }) => ({
  user: one(users, {
    fields: [userSessions.userId],
    references: [users.id],
  }),
}));

// New relations for team management tables
export const userInvitationsRelations = relations(userInvitations, ({ one }) => ({
  userCompany: one(userCompanies, {
    fields: [userInvitations.userCompanyId],
    references: [userCompanies.id],
  }),
  inviter: one(users, {
    fields: [userInvitations.invitedBy],
    references: [users.id],
    relationName: "inviter",
  }),
}));

export const userDealAssignmentsRelations = relations(userDealAssignments, ({ one }) => ({
  user: one(users, {
    fields: [userDealAssignments.userId],
    references: [users.id],
    relationName: "assignedUser",
  }),
  targetCompany: one(targetCompanies, {
    fields: [userDealAssignments.targetCompanyId],
    references: [targetCompanies.id],
  }),
  assignedBy: one(users, {
    fields: [userDealAssignments.assignedBy],
    references: [users.id],
    relationName: "assigner",
  }),
}));

export const teamNotificationsRelations = relations(teamNotifications, ({ one }) => ({
  userCompany: one(userCompanies, {
    fields: [teamNotifications.userCompanyId],
    references: [userCompanies.id],
  }),
  targetUser: one(users, {
    fields: [teamNotifications.targetUserId],
    references: [users.id],
    relationName: "targetUser",
  }),
  fromUser: one(users, {
    fields: [teamNotifications.fromUserId],
    references: [users.id],
    relationName: "fromUser",
  }),
  targetCompany: one(targetCompanies, {
    fields: [teamNotifications.targetCompanyId],
    references: [targetCompanies.id],
  }),
}));

export const pipelineStagesRelations = relations(pipelineStages, ({ many }) => ({
  stageHistory: many(stageHistory),
}));

export const stageHistoryRelations = relations(stageHistory, ({ one }) => ({
  targetCompany: one(targetCompanies, {
    fields: [stageHistory.targetCompanyId],
    references: [targetCompanies.id],
  }),
  changedByUser: one(users, {
    fields: [stageHistory.changedBy],
    references: [users.id],
  }),
  pipelineStage: one(pipelineStages, {
    fields: [stageHistory.toStage],
    references: [pipelineStages.stageName],
  }),
}));

export const activityTypesRelations = relations(activityTypes, ({ many }) => ({
  activities: many(activities),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  targetCompany: one(targetCompanies, {
    fields: [activities.targetCompanyId],
    references: [targetCompanies.id],
  }),
  user: one(users, {
    fields: [activities.userId],
    references: [users.id],
  }),
  contact: one(targetContacts, {
    fields: [activities.contactId],
    references: [targetContacts.id],
  }),
  activityType: one(activityTypes, {
    fields: [activities.activityType],
    references: [activityTypes.typeName],
  }),
}));

// Document categories table
export const documentCategories = pgTable("document_categories", {
  id: serial("id").primaryKey(),
  categoryName: varchar("category_name", { length: 100 }).unique().notNull(),
  description: text("description"),
  isRequired: boolean("is_required").default(false),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Documents table
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  targetCompanyId: integer("target_company_id").references(() => targetCompanies.id).notNull(),
  uploadedBy: integer("uploaded_by").references(() => users.id).notNull(),
  documentName: varchar("document_name", { length: 255 }).notNull(),
  originalFilename: varchar("original_filename", { length: 255 }).notNull(),
  filePath: varchar("file_path", { length: 500 }).notNull(),
  fileSize: integer("file_size").notNull(), // in bytes
  fileType: varchar("file_type", { length: 200 }).notNull(),
  documentCategory: varchar("document_category", { length: 100 }).notNull(),
  description: text("description"),
  isConfidential: boolean("is_confidential").default(true),
  uploadDate: timestamp("upload_date").defaultNow(),
  lastAccessed: timestamp("last_accessed"),
  accessCount: integer("access_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Document access log
export const documentAccessLog = pgTable("document_access_log", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").references(() => documents.id).notNull(),
  accessedBy: integer("accessed_by").references(() => users.id).notNull(),
  accessType: varchar("access_type", { length: 50 }).notNull(), // 'view', 'download'
  accessedAt: timestamp("accessed_at").defaultNow(),
  ipAddress: inet("ip_address"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations for document tables
export const documentCategoriesRelations = relations(documentCategories, ({ many }) => ({
  documents: many(documents),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  targetCompany: one(targetCompanies, {
    fields: [documents.targetCompanyId],
    references: [targetCompanies.id],
  }),
  uploadedByUser: one(users, {
    fields: [documents.uploadedBy],
    references: [users.id],
  }),
  category: one(documentCategories, {
    fields: [documents.documentCategory],
    references: [documentCategories.categoryName],
  }),
  accessLog: many(documentAccessLog),
}));

export const documentAccessLogRelations = relations(documentAccessLog, ({ one }) => ({
  document: one(documents, {
    fields: [documentAccessLog.documentId],
    references: [documents.id],
  }),
  accessedByUser: one(users, {
    fields: [documentAccessLog.accessedBy],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertUserCompanySchema = createInsertSchema(userCompanies).omit({
  id: true,
  createdAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertTargetCompanySchema = createInsertSchema(targetCompanies).omit({
  id: true,
  createdAt: true,
  websiteAnalysis: true, // Auto-managed by webhook
  websiteAnalysisProcessedAt: true, // Auto-managed by webhook
}).extend({
  annualRevenue: z.union([z.string(), z.number(), z.null()]).optional(),
  employeeCount: z.union([z.string(), z.number(), z.null()]).optional(),
  yearEstablished: z.union([z.string(), z.number(), z.null()]).optional(),
});

export const insertTargetContactSchema = createInsertSchema(targetContacts).omit({
  id: true,
  createdAt: true,
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

export const insertUserDealAssignmentSchema = createInsertSchema(userDealAssignments).omit({
  id: true,
  createdAt: true,
  assignmentDate: true,
});

export const insertTeamNotificationSchema = createInsertSchema(teamNotifications).omit({
  id: true,
  createdAt: true,
  readAt: true,
  emailSentAt: true,
});

export const insertPipelineStageSchema = createInsertSchema(pipelineStages).omit({
  id: true,
  createdAt: true,
});

export const insertStageHistorySchema = createInsertSchema(stageHistory).omit({
  id: true,
  createdAt: true,
  changedAt: true,
});

export const insertActivityTypeSchema = createInsertSchema(activityTypes).omit({
  id: true,
  createdAt: true,
});

export const insertActivitySchema = createInsertSchema(activities).omit({
  id: true,
  createdAt: true,
}).extend({
  activityDate: z.string().datetime().or(z.date()),
  durationMinutes: z.number().optional().nullable(),
  contactId: z.number().optional().nullable(),
  followUpDate: z.string().datetime().optional().nullable().or(z.date().optional().nullable()),
});

export const insertDocumentCategorySchema = createInsertSchema(documentCategories).omit({
  id: true,
  createdAt: true,
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
  uploadDate: true,
  lastAccessed: true,
  accessCount: true,
});

export const insertDocumentAccessLogSchema = createInsertSchema(documentAccessLog).omit({
  id: true,
  createdAt: true,
  accessedAt: true,
});

// Types
export type InsertUserCompany = z.infer<typeof insertUserCompanySchema>;
export type UserCompany = typeof userCompanies.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertTargetCompany = z.infer<typeof insertTargetCompanySchema>;
export type TargetCompany = typeof targetCompanies.$inferSelect;

export type InsertTargetContact = z.infer<typeof insertTargetContactSchema>;
export type TargetContact = typeof targetContacts.$inferSelect;

export type UserSession = typeof userSessions.$inferSelect;

export type InsertUserInvitation = z.infer<typeof insertUserInvitationSchema>;
export type UserInvitation = typeof userInvitations.$inferSelect;

export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;
export type UserRole = typeof userRoles.$inferSelect;

export type InsertUserDealAssignment = z.infer<typeof insertUserDealAssignmentSchema>;
export type UserDealAssignment = typeof userDealAssignments.$inferSelect;

export type InsertTeamNotification = z.infer<typeof insertTeamNotificationSchema>;
export type TeamNotification = typeof teamNotifications.$inferSelect;

export type InsertPipelineStage = z.infer<typeof insertPipelineStageSchema>;
export type PipelineStage = typeof pipelineStages.$inferSelect;

export type InsertStageHistory = z.infer<typeof insertStageHistorySchema>;
export type StageHistory = typeof stageHistory.$inferSelect;

export type InsertActivityType = z.infer<typeof insertActivityTypeSchema>;
export type ActivityType = typeof activityTypes.$inferSelect;

export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activities.$inferSelect;

export type InsertDocumentCategory = z.infer<typeof insertDocumentCategorySchema>;
export type DocumentCategory = typeof documentCategories.$inferSelect;

export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;

export type InsertDocumentAccessLog = z.infer<typeof insertDocumentAccessLogSchema>;
export type DocumentAccessLog = typeof documentAccessLog.$inferSelect;

// Dashboard preferences table
export const dashboardPreferences = pgTable("dashboard_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  widgetType: varchar("widget_type", { length: 50 }).notNull(),
  widgetPosition: integer("widget_position").notNull(),
  widgetSize: varchar("widget_size", { length: 20 }).default("medium"),
  isVisible: boolean("is_visible").default(true),
  widgetConfig: text("widget_config"), // JSON string for widget-specific settings
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Dashboard alerts table
export const dashboardAlerts = pgTable("dashboard_alerts", {
  id: serial("id").primaryKey(),
  userCompanyId: integer("user_company_id").references(() => userCompanies.id).notNull(),
  alertType: varchar("alert_type", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  severity: varchar("severity", { length: 20 }).default("info"),
  targetCompanyId: integer("target_company_id").references(() => targetCompanies.id),
  isDismissed: boolean("is_dismissed").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  dismissedAt: timestamp("dismissed_at"),
});

// Dashboard relations
export const dashboardPreferencesRelations = relations(dashboardPreferences, ({ one }) => ({
  user: one(users, {
    fields: [dashboardPreferences.userId],
    references: [users.id],
  }),
}));

export const dashboardAlertsRelations = relations(dashboardAlerts, ({ one }) => ({
  userCompany: one(userCompanies, {
    fields: [dashboardAlerts.userCompanyId],
    references: [userCompanies.id],
  }),
  targetCompany: one(targetCompanies, {
    fields: [dashboardAlerts.targetCompanyId],
    references: [targetCompanies.id],
  }),
}));

// Dashboard schemas
export const insertDashboardPreferenceSchema = createInsertSchema(dashboardPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDashboardAlertSchema = createInsertSchema(dashboardAlerts).omit({
  id: true,
  createdAt: true,
  dismissedAt: true,
});

export type TeamMember = User & {
  roleDescription?: string;
  assignedDealsCount?: number;
  permissions?: {
    id?: number;
    roleName?: string;
    roleDescription?: string;
    canManageUsers?: boolean;
    canManageCompany?: boolean;
    canCreateDeals?: boolean;
    canEditAllDeals?: boolean;
    canDeleteDeals?: boolean;
    canUploadDocuments?: boolean;
    canCreateOffers?: boolean;
    canViewFinancials?: boolean;
    canAccessAnalytics?: boolean;
    canExportData?: boolean;
    createdAt?: Date;
  };
};

export type UserWithRole = User & {
  roleDescription?: string;
  permissions?: {
    canManageUsers?: boolean;
    canManageCompany?: boolean;
    canCreateDeals?: boolean;
    canEditAllDeals?: boolean;
    canDeleteDeals?: boolean;
    canUploadDocuments?: boolean;
    canCreateOffers?: boolean;
    canViewFinancials?: boolean;
    canAccessAnalytics?: boolean;
    canExportData?: boolean;
  };
};

// Dashboard types
export type InsertDashboardPreference = z.infer<typeof insertDashboardPreferenceSchema>;
export type DashboardPreference = typeof dashboardPreferences.$inferSelect;

export type InsertDashboardAlert = z.infer<typeof insertDashboardAlertSchema>;
export type DashboardAlert = typeof dashboardAlerts.$inferSelect;

// ========================================
// External Document Portal Schema
// ========================================

// Portal access tokens table for secure external document sharing
export const portalAccessTokens = pgTable("portal_access_tokens", {
  id: serial("id").primaryKey(),
  targetCompanyId: integer("target_company_id").references(() => targetCompanies.id).notNull(),
  targetContactId: integer("target_contact_id").references(() => targetContacts.id).notNull(),
  userCompanyId: integer("user_company_id").references(() => userCompanies.id).notNull(),
  
  // Token Details
  accessToken: varchar("access_token", { length: 255 }).unique().notNull(),
  tokenPurpose: varchar("token_purpose", { length: 50 }).default("document_submission"),
  
  // Access Control
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at").default(sql`(NOW() + INTERVAL '30 days')`),
  lastAccessed: timestamp("last_accessed"),
  accessCount: integer("access_count").default(0),
  
  // Security Tracking
  createdBy: integer("created_by").references(() => users.id).notNull(),
  ipAddressesUsed: text("ip_addresses_used").array(),
  userAgentStrings: text("user_agent_strings").array(),
  
  // Portal Configuration
  allowedActions: text("allowed_actions").default('{"upload": true, "download": true, "message": true}'),
  customMessage: text("custom_message"),
  portalBranding: text("portal_branding"), // JSON as text
});

// External document submissions table
export const externalDocumentSubmissions = pgTable("external_document_submissions", {
  id: serial("id").primaryKey(),
  portalTokenId: integer("portal_token_id").references(() => portalAccessTokens.id).notNull(),
  targetCompanyId: integer("target_company_id").references(() => targetCompanies.id).notNull(),
  targetContactId: integer("target_contact_id").references(() => targetContacts.id).notNull(),
  
  // Document Details
  originalFilename: varchar("original_filename", { length: 255 }).notNull(),
  storedFilename: varchar("stored_filename", { length: 255 }).notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size").notNull(),
  fileType: varchar("file_type", { length: 100 }),
  documentCategory: varchar("document_category", { length: 100 }),
  
  // Submission Details
  submissionNotes: text("submission_notes"),
  submittedAt: timestamp("submitted_at").defaultNow(),
  submissionIp: inet("submission_ip"),
  submissionUserAgent: text("submission_user_agent"),
  
  // Processing Status
  processingStatus: varchar("processing_status", { length: 50 }).default("pending"),
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  
  // Document Requirements Link
  documentRequirementId: integer("document_requirement_id"),
  
  // Security and Compliance
  virusScanStatus: varchar("virus_scan_status", { length: 50 }).default("pending"),
  virusScanResult: text("virus_scan_result"), // JSON as text
  encryptionStatus: varchar("encryption_status", { length: 50 }).default("encrypted"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Portal document requirements table
export const portalDocumentRequirements = pgTable("portal_document_requirements", {
  id: serial("id").primaryKey(),
  targetCompanyId: integer("target_company_id").references(() => targetCompanies.id).notNull(),
  portalTokenId: integer("portal_token_id").references(() => portalAccessTokens.id).notNull(),
  
  // Requirement Details
  requirementName: varchar("requirement_name", { length: 255 }).notNull(),
  requirementDescription: text("requirement_description"),
  documentCategory: varchar("document_category", { length: 100 }),
  isMandatory: boolean("is_mandatory").default(true),
  
  // Stage and Priority
  collectionStage: integer("collection_stage").default(1),
  priorityLevel: varchar("priority_level", { length: 20 }).default("medium"),
  dueDate: timestamp("due_date"),
  
  // Submission Status
  submissionStatus: varchar("submission_status", { length: 50 }).default("outstanding"),
  submittedDocumentId: integer("submitted_document_id").references(() => externalDocumentSubmissions.id),
  
  // Requirements Specification
  acceptedFileTypes: text("accepted_file_types").array(),
  maxFileSize: integer("max_file_size").default(10485760), // 10MB default
  minFileSize: integer("min_file_size").default(1024), // 1KB minimum
  
  // Instructions and Help
  submissionInstructions: text("submission_instructions"),
  exampleDocuments: text("example_documents").array(),
  helpText: text("help_text"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Portal activity log table
export const portalActivityLog = pgTable("portal_activity_log", {
  id: serial("id").primaryKey(),
  portalTokenId: integer("portal_token_id").references(() => portalAccessTokens.id).notNull(),
  targetContactId: integer("target_contact_id").references(() => targetContacts.id).notNull(),
  
  // Activity Details
  activityType: varchar("activity_type", { length: 50 }).notNull(),
  activityDescription: text("activity_description"),
  activityTimestamp: timestamp("activity_timestamp").defaultNow(),
  
  // Technical Details
  ipAddress: inet("ip_address"),
  userAgent: text("user_agent"),
  sessionDuration: integer("session_duration"), // seconds
  
  // Related Objects
  relatedDocumentId: integer("related_document_id").references(() => externalDocumentSubmissions.id),
  relatedMessageId: integer("related_message_id"),
  
  // Security Flags
  securityFlags: text("security_flags"), // JSON as text
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Portal link campaigns table
export const portalLinkCampaigns = pgTable("portal_link_campaigns", {
  id: serial("id").primaryKey(),
  userCompanyId: integer("user_company_id").references(() => userCompanies.id).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 50 }).default("draft"),
  targetAudience: varchar("target_audience", { length: 255 }),
  startDate: date("start_date"),
  endDate: date("end_date"),
  createdBy: integer("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Portal link shares table
export const portalLinkShares = pgTable("portal_link_shares", {
  id: serial("id").primaryKey(),
  portalTokenId: integer("portal_token_id").references(() => portalAccessTokens.id).notNull(),
  sharedBy: integer("shared_by").references(() => users.id).notNull(),
  sharedMethod: varchar("shared_method", { length: 50 }),
  sharedTo: varchar("shared_to", { length: 255 }),
  shareMessage: text("share_message"),
  maxUses: integer("max_uses").default(1),
  currentUses: integer("current_uses").default(0),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").default(true),
  lastAccessed: timestamp("last_accessed"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Email templates table
export const portalEmailTemplates = pgTable("portal_email_templates", {
  id: serial("id").primaryKey(),
  userCompanyId: integer("user_company_id").references(() => userCompanies.id).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  subject: varchar("subject", { length: 500 }).notNull(),
  bodyTemplate: text("body_template").notNull(),
  templateCategory: varchar("template_category", { length: 50 }).default("custom"),
  isActive: boolean("is_active").default(true),
  usageCount: integer("usage_count").default(0),
  lastUsed: timestamp("last_used"),
  createdBy: integer("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Portal communications log table
export const portalCommunicationsLog = pgTable("portal_communications_log", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").references(() => portalLinkCampaigns.id),
  targetContactId: integer("target_contact_id").references(() => targetContacts.id).notNull(),
  communicationType: varchar("communication_type", { length: 50 }).notNull(),
  subject: varchar("subject", { length: 500 }),
  message: text("message"),
  emailStatus: varchar("email_status", { length: 50 }),
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  openedAt: timestamp("opened_at"),
  clickedAt: timestamp("clicked_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Portal analytics table
export const portalAnalytics = pgTable("portal_analytics", {
  id: serial("id").primaryKey(),
  userCompanyId: integer("user_company_id").references(() => userCompanies.id).notNull(),
  analyticsDate: date("analytics_date").default(sql`CURRENT_DATE`),
  targetCompanyId: integer("target_company_id").references(() => targetCompanies.id),
  portalTokenId: integer("portal_token_id").references(() => portalAccessTokens.id),
  uniqueVisitors: integer("unique_visitors").default(0),
  totalPageViews: integer("total_page_views").default(0),
  documentsViewed: integer("documents_viewed").default(0),
  documentsDownloaded: integer("documents_downloaded").default(0),
  averageSessionDuration: numeric("average_session_duration", { precision: 10, scale: 2 }).default("0"),
  emailsSent: integer("emails_sent").default(0),
  emailsOpened: integer("emails_opened").default(0),
  emailsClicked: integer("emails_clicked").default(0),
  portalLinksGenerated: integer("portal_links_generated").default(0),
  portalLinksShared: integer("portal_links_shared").default(0),
  conversionRate: numeric("conversion_rate", { precision: 5, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Portal schemas
export const insertPortalAccessTokenSchema = createInsertSchema(portalAccessTokens).omit({
  id: true,
  createdAt: true,
  lastAccessed: true,
  accessCount: true,
});

export const insertExternalDocumentSubmissionSchema = createInsertSchema(externalDocumentSubmissions).omit({
  id: true,
  submittedAt: true,
  reviewedAt: true,
  createdAt: true,
});

export const insertPortalDocumentRequirementSchema = createInsertSchema(portalDocumentRequirements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPortalActivityLogSchema = createInsertSchema(portalActivityLog).omit({
  id: true,
  activityTimestamp: true,
  createdAt: true,
});

export const insertPortalLinkCampaignSchema = createInsertSchema(portalLinkCampaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPortalEmailTemplateSchema = createInsertSchema(portalEmailTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPortalCommunicationsLogSchema = createInsertSchema(portalCommunicationsLog).omit({
  id: true,
  createdAt: true,
});

export const insertPortalAnalyticsSchema = createInsertSchema(portalAnalytics).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPortalLinkShareSchema = createInsertSchema(portalLinkShares).omit({
  id: true,
  createdAt: true,
});

// Portal types
export type PortalAccessToken = typeof portalAccessTokens.$inferSelect;
export type InsertPortalAccessToken = z.infer<typeof insertPortalAccessTokenSchema>;

export type ExternalDocumentSubmission = typeof externalDocumentSubmissions.$inferSelect;
export type InsertExternalDocumentSubmission = z.infer<typeof insertExternalDocumentSubmissionSchema>;

export type PortalDocumentRequirement = typeof portalDocumentRequirements.$inferSelect;
export type InsertPortalDocumentRequirement = z.infer<typeof insertPortalDocumentRequirementSchema>;

export type PortalActivityLog = typeof portalActivityLog.$inferSelect;
export type InsertPortalActivityLog = z.infer<typeof insertPortalActivityLogSchema>;

export type PortalLinkCampaign = typeof portalLinkCampaigns.$inferSelect;
export type InsertPortalLinkCampaign = z.infer<typeof insertPortalLinkCampaignSchema>;

export type PortalEmailTemplate = typeof portalEmailTemplates.$inferSelect;
export type InsertPortalEmailTemplate = z.infer<typeof insertPortalEmailTemplateSchema>;

export type PortalCommunicationsLog = typeof portalCommunicationsLog.$inferSelect;
export type InsertPortalCommunicationsLog = z.infer<typeof insertPortalCommunicationsLogSchema>;

export type PortalAnalytics = typeof portalAnalytics.$inferSelect;
export type InsertPortalAnalytics = z.infer<typeof insertPortalAnalyticsSchema>;

export type PortalLinkShare = typeof portalLinkShares.$inferSelect;
export type InsertPortalLinkShare = z.infer<typeof insertPortalLinkShareSchema>;

// ========================================
// STAGED DOCUMENT REQUIREMENTS SYSTEM
// ========================================

// Document requirement templates table
export const documentRequirementTemplates = pgTable("document_requirement_templates", {
  id: serial("id").primaryKey(),
  userCompanyId: integer("user_company_id").references(() => userCompanies.id).notNull(),
  createdBy: integer("created_by").references(() => users.id).notNull(),
  
  // Template Details
  templateName: varchar("template_name", { length: 255 }).notNull(),
  templateDescription: text("template_description"),
  industryCategory: varchar("industry_category", { length: 100 }),
  dealSizeCategory: varchar("deal_size_category", { length: 50 }),
  
  // Template Configuration
  isDefault: boolean("is_default").default(false),
  isActive: boolean("is_active").default(true),
  templateVersion: varchar("template_version", { length: 20 }).default("1.0"),
  
  // Usage Tracking
  usageCount: integer("usage_count").default(0),
  lastUsed: timestamp("last_used"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Document requirement items table
export const documentRequirementItems = pgTable("document_requirement_items", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id").references(() => documentRequirementTemplates.id).notNull(),
  
  // Requirement Details
  requirementName: varchar("requirement_name", { length: 255 }).notNull(),
  requirementDescription: text("requirement_description"),
  documentCategory: varchar("document_category", { length: 100 }),
  
  // Stage and Priority
  collectionStage: integer("collection_stage").notNull(), // 1 = pre-offer, 2 = post-heads-of-terms
  priorityLevel: varchar("priority_level", { length: 20 }).default("medium"),
  isMandatory: boolean("is_mandatory").default(true),
  
  // Document Specifications
  acceptedFileTypes: text("accepted_file_types").array().default(sql`ARRAY['pdf', 'docx', 'xlsx']`),
  maxFileSize: bigint("max_file_size", { mode: "number" }).default(10485760), // 10MB default
  minFileSize: bigint("min_file_size", { mode: "number" }).default(1024), // 1KB minimum
  maxFileCount: integer("max_file_count").default(1),
  
  // Instructions and Help
  submissionInstructions: text("submission_instructions"),
  exampleDocuments: text("example_documents").array(),
  helpText: text("help_text"),
  commonIssues: text("common_issues"),
  
  // Dependencies
  prerequisiteRequirements: integer("prerequisite_requirements").array(),
  relatedRequirements: integer("related_requirements").array(),
  
  // Validation Rules
  validationRules: text("validation_rules"), // JSON string
  autoValidation: boolean("auto_validation").default(false),
  
  // Display and Ordering
  displayOrder: integer("display_order").default(0),
  isVisible: boolean("is_visible").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Company document requirements table (instance of template for specific deal)
export const companyDocumentRequirements = pgTable("company_document_requirements", {
  id: serial("id").primaryKey(),
  targetCompanyId: integer("target_company_id").references(() => targetCompanies.id).notNull(),
  templateId: integer("template_id").references(() => documentRequirementTemplates.id),
  requirementItemId: integer("requirement_item_id").references(() => documentRequirementItems.id).notNull(),
  
  // Requirement Status
  requirementStatus: varchar("requirement_status", { length: 50 }).default("outstanding"),
  submissionStatus: varchar("submission_status", { length: 50 }).default("not_started"),
  
  // Submission Details
  submittedDocumentId: integer("submitted_document_id").references(() => externalDocumentSubmissions.id),
  submittedAt: timestamp("submitted_at"),
  submittedByContactId: integer("submitted_by_contact_id").references(() => targetContacts.id),
  
  // Review and Approval
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewStatus: varchar("review_status", { length: 50 }),
  reviewNotes: text("review_notes"),
  reviewScore: integer("review_score"),
  
  // Waiver Information
  isWaived: boolean("is_waived").default(false),
  waivedBy: integer("waived_by").references(() => users.id),
  waivedAt: timestamp("waived_at"),
  waiverReason: text("waiver_reason"),
  waiverJustification: text("waiver_justification"),
  waiverApprovedBy: integer("waiver_approved_by").references(() => users.id),
  
  // Due Dates and Reminders
  dueDate: timestamp("due_date"),
  reminderSentCount: integer("reminder_sent_count").default(0),
  lastReminderSent: timestamp("last_reminder_sent"),
  nextReminderDue: timestamp("next_reminder_due"),
  
  // Custom Modifications
  customInstructions: text("custom_instructions"),
  customPriority: varchar("custom_priority", { length: 20 }),
  isCustomRequirement: boolean("is_custom_requirement").default(false),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Document stage progression table
export const documentStageProgression = pgTable("document_stage_progression", {
  id: serial("id").primaryKey(),
  targetCompanyId: integer("target_company_id").references(() => targetCompanies.id).notNull(),
  
  // Stage Information
  currentStage: integer("current_stage").default(1),
  stage1Status: varchar("stage_1_status", { length: 50 }).default("in_progress"),
  stage2Status: varchar("stage_2_status", { length: 50 }).default("not_started"),
  
  // Stage 1 Completion
  stage1CompletedAt: timestamp("stage_1_completed_at"),
  stage1CompletedBy: integer("stage_1_completed_by").references(() => users.id),
  stage1CompletionPercentage: decimal("stage_1_completion_percentage", { precision: 5, scale: 2 }).default("0.00"),
  stage1MandatoryCompleted: boolean("stage_1_mandatory_completed").default(false),
  
  // Stage 2 Completion
  stage2StartedAt: timestamp("stage_2_started_at"),
  stage2CompletedAt: timestamp("stage_2_completed_at"),
  stage2CompletedBy: integer("stage_2_completed_by").references(() => users.id),
  stage2CompletionPercentage: decimal("stage_2_completion_percentage", { precision: 5, scale: 2 }).default("0.00"),
  stage2MandatoryCompleted: boolean("stage_2_mandatory_completed").default(false),
  
  // Overall Progress
  totalRequirements: integer("total_requirements").default(0),
  completedRequirements: integer("completed_requirements").default(0),
  overallCompletionPercentage: decimal("overall_completion_percentage", { precision: 5, scale: 2 }).default("0.00"),
  
  // Pipeline Integration
  canProgressToOffer: boolean("can_progress_to_offer").default(false),
  canProgressToLegal: boolean("can_progress_to_legal").default(false),
  pipelineStageUpdatedAt: timestamp("pipeline_stage_updated_at"),
  
  // Blocking Issues
  blockingIssues: text("blocking_issues"), // JSON string
  resolutionNotes: text("resolution_notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => {
  return {
    uniqueTargetCompany: unique().on(table.targetCompanyId),
  };
});

// Document requirement waivers table
export const documentRequirementWaivers = pgTable("document_requirement_waivers", {
  id: serial("id").primaryKey(),
  companyRequirementId: integer("company_requirement_id").references(() => companyDocumentRequirements.id).notNull(),
  targetCompanyId: integer("target_company_id").references(() => targetCompanies.id).notNull(),
  
  // Waiver Request
  requestedBy: integer("requested_by").references(() => users.id).notNull(),
  requestedAt: timestamp("requested_at").defaultNow(),
  waiverReason: varchar("waiver_reason", { length: 100 }),
  waiverJustification: text("waiver_justification").notNull(),
  alternativeDocumentation: text("alternative_documentation"),
  
  // Approval Process
  approvalStatus: varchar("approval_status", { length: 50 }).default("pending"),
  approvedBy: integer("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  approvalNotes: text("approval_notes"),
  
  // Risk Assessment
  riskLevel: varchar("risk_level", { length: 20 }).default("low"),
  riskAssessment: text("risk_assessment"),
  mitigationMeasures: text("mitigation_measures"),
  
  // Conditions
  conditionalApproval: boolean("conditional_approval").default(false),
  approvalConditions: text("approval_conditions"),
  conditionMet: boolean("condition_met").default(false),
  conditionVerifiedBy: integer("condition_verified_by").references(() => users.id),
  conditionVerifiedAt: timestamp("condition_verified_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations for staged requirements
export const documentRequirementTemplatesRelations = relations(documentRequirementTemplates, ({ one, many }) => ({
  userCompany: one(userCompanies, {
    fields: [documentRequirementTemplates.userCompanyId],
    references: [userCompanies.id],
  }),
  createdByUser: one(users, {
    fields: [documentRequirementTemplates.createdBy],
    references: [users.id],
  }),
  requirementItems: many(documentRequirementItems),
  companyRequirements: many(companyDocumentRequirements),
}));

export const documentRequirementItemsRelations = relations(documentRequirementItems, ({ one, many }) => ({
  template: one(documentRequirementTemplates, {
    fields: [documentRequirementItems.templateId],
    references: [documentRequirementTemplates.id],
  }),
  companyRequirements: many(companyDocumentRequirements),
}));

export const companyDocumentRequirementsRelations = relations(companyDocumentRequirements, ({ one }) => ({
  targetCompany: one(targetCompanies, {
    fields: [companyDocumentRequirements.targetCompanyId],
    references: [targetCompanies.id],
  }),
  template: one(documentRequirementTemplates, {
    fields: [companyDocumentRequirements.templateId],
    references: [documentRequirementTemplates.id],
  }),
  requirementItem: one(documentRequirementItems, {
    fields: [companyDocumentRequirements.requirementItemId],
    references: [documentRequirementItems.id],
  }),
  submittedDocument: one(externalDocumentSubmissions, {
    fields: [companyDocumentRequirements.submittedDocumentId],
    references: [externalDocumentSubmissions.id],
  }),
  submittedByContact: one(targetContacts, {
    fields: [companyDocumentRequirements.submittedByContactId],
    references: [targetContacts.id],
  }),
  reviewedByUser: one(users, {
    fields: [companyDocumentRequirements.reviewedBy],
    references: [users.id],
  }),
}));

export const documentStageProgressionRelations = relations(documentStageProgression, ({ one }) => ({
  targetCompany: one(targetCompanies, {
    fields: [documentStageProgression.targetCompanyId],
    references: [targetCompanies.id],
  }),
  stage1CompletedByUser: one(users, {
    fields: [documentStageProgression.stage1CompletedBy],
    references: [users.id],
  }),
  stage2CompletedByUser: one(users, {
    fields: [documentStageProgression.stage2CompletedBy],
    references: [users.id],
  }),
}));

export const documentRequirementWaiversRelations = relations(documentRequirementWaivers, ({ one }) => ({
  companyRequirement: one(companyDocumentRequirements, {
    fields: [documentRequirementWaivers.companyRequirementId],
    references: [companyDocumentRequirements.id],
  }),
  targetCompany: one(targetCompanies, {
    fields: [documentRequirementWaivers.targetCompanyId],
    references: [targetCompanies.id],
  }),
  requestedByUser: one(users, {
    fields: [documentRequirementWaivers.requestedBy],
    references: [users.id],
  }),
  approvedByUser: one(users, {
    fields: [documentRequirementWaivers.approvedBy],
    references: [users.id],
  }),
}));

// Document requirement schemas
export const insertDocumentRequirementTemplateSchema = createInsertSchema(documentRequirementTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  usageCount: true,
  lastUsed: true,
});

export const insertDocumentRequirementItemSchema = createInsertSchema(documentRequirementItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCompanyDocumentRequirementSchema = createInsertSchema(companyDocumentRequirements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  submittedAt: true,
  reviewedAt: true,
  waivedAt: true,
  lastReminderSent: true,
});

export const insertDocumentStageProgressionSchema = createInsertSchema(documentStageProgression).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  stage1CompletedAt: true,
  stage2StartedAt: true,
  stage2CompletedAt: true,
  pipelineStageUpdatedAt: true,
});

export const insertDocumentRequirementWaiverSchema = createInsertSchema(documentRequirementWaivers).omit({
  id: true,
  requestedAt: true,
  approvedAt: true,
  conditionVerifiedAt: true,
  createdAt: true,
  updatedAt: true,
});

// Document requirement types
export type DocumentRequirementTemplate = typeof documentRequirementTemplates.$inferSelect;
export type InsertDocumentRequirementTemplate = z.infer<typeof insertDocumentRequirementTemplateSchema>;

export type DocumentRequirementItem = typeof documentRequirementItems.$inferSelect;
export type InsertDocumentRequirementItem = z.infer<typeof insertDocumentRequirementItemSchema>;

export type CompanyDocumentRequirement = typeof companyDocumentRequirements.$inferSelect;
export type InsertCompanyDocumentRequirement = z.infer<typeof insertCompanyDocumentRequirementSchema>;

export type DocumentStageProgression = typeof documentStageProgression.$inferSelect;
export type InsertDocumentStageProgression = z.infer<typeof insertDocumentStageProgressionSchema>;

export type DocumentRequirementWaiver = typeof documentRequirementWaivers.$inferSelect;
export type InsertDocumentRequirementWaiver = z.infer<typeof insertDocumentRequirementWaiverSchema>;
