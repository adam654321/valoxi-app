import { pgTable, serial, varchar, text, integer, decimal, boolean, timestamp, unique } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { userCompanies, users } from './core';

// Target companies (businesses users want to acquire)
export const targetCompanies = pgTable("target_companies", {
  id: serial("id").primaryKey(),
  userCompanyId: integer("user_company_id").references(() => userCompanies.id).notNull(),
  companyName: varchar("company_name", { length: 255 }).notNull(),
  industry: varchar("industry", { length: 100 }),
  subSector: varchar("sub_sector", { length: 100 }),
  website: varchar("website", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 255 }),
  address: text("address"),
  annualRevenue: decimal("annual_revenue"),
  employeeCount: integer("employee_count"),
  yearEstablished: integer("year_established"),
  description: text("description"),
  websiteAnalysis: text("website_analysis"),
  websiteAnalysisProcessedAt: timestamp("website_analysis_processed_at"),
  stage: varchar("stage", { length: 50 }).default("New Target"),
  stageUpdatedAt: timestamp("stage_updated_at").defaultNow(),
  stageUpdatedBy: integer("stage_updated_by").references(() => users.id),
  initialDiscussionCompleted: boolean("initial_discussion_completed").default(false),
  initialDiscussionDate: timestamp("initial_discussion_date"),
  initialDiscussionNotes: text("initial_discussion_notes"),
  initialDiscussionBy: integer("initial_discussion_by").references(() => users.id),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  isArchived: boolean("is_archived").default(false).notNull(),
  archivedAt: timestamp("archived_at"),
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
  defaultDuration: integer("default_duration"),
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
  activityTime: varchar("activity_time", { length: 8 }),
  durationMinutes: integer("duration_minutes"),
  contactId: integer("contact_id").references(() => targetContacts.id),
  isCompleted: boolean("is_completed").default(true),
  followUpDate: timestamp("follow_up_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Deal notes for tracking multiple notes per target company
export const dealNotes = pgTable("deal_notes", {
  id: serial("id").primaryKey(),
  targetCompanyId: integer("target_company_id").references(() => targetCompanies.id).notNull(),
  noteType: varchar("note_type", { length: 50 }).default("General"),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content"),
  reminderDate: timestamp("reminder_date"),
  reminderCompleted: boolean("reminder_completed").default(false),
  createdBy: integer("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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

// Insert schemas
export const insertTargetCompanySchema = createInsertSchema(targetCompanies).omit({
  id: true,
  createdAt: true,
  websiteAnalysis: true,
  websiteAnalysisProcessedAt: true,
}).extend({
  annualRevenue: z.union([z.string(), z.number(), z.null()]).optional(),
  employeeCount: z.union([z.string(), z.number(), z.null()]).optional(),
  yearEstablished: z.union([z.string(), z.number(), z.null()]).optional(),
});

export const insertTargetContactSchema = createInsertSchema(targetContacts).omit({
  id: true,
  createdAt: true,
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

export const insertDealNoteSchema = createInsertSchema(dealNotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  reminderDate: z.string().datetime().optional().nullable().or(z.date().optional().nullable()),
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

// Types
export type InsertTargetCompany = z.infer<typeof insertTargetCompanySchema>;
export type TargetCompany = typeof targetCompanies.$inferSelect;

export type InsertTargetContact = z.infer<typeof insertTargetContactSchema>;
export type TargetContact = typeof targetContacts.$inferSelect;

export type InsertPipelineStage = z.infer<typeof insertPipelineStageSchema>;
export type PipelineStage = typeof pipelineStages.$inferSelect;

export type InsertStageHistory = z.infer<typeof insertStageHistorySchema>;
export type StageHistory = typeof stageHistory.$inferSelect;

export type InsertActivityType = z.infer<typeof insertActivityTypeSchema>;
export type ActivityType = typeof activityTypes.$inferSelect;

export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activities.$inferSelect;

export type InsertDealNote = z.infer<typeof insertDealNoteSchema>;
export type DealNote = typeof dealNotes.$inferSelect;

export type InsertUserDealAssignment = z.infer<typeof insertUserDealAssignmentSchema>;
export type UserDealAssignment = typeof userDealAssignments.$inferSelect;

export type InsertTeamNotification = z.infer<typeof insertTeamNotificationSchema>;
export type TeamNotification = typeof teamNotifications.$inferSelect;
