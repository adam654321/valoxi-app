import { sql } from 'drizzle-orm';
import { pgTable, serial, varchar, text, integer, decimal, boolean, timestamp, date, inet, numeric, unique } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { userCompanies, users } from './core';
import { targetCompanies, targetContacts } from './deals';

// Portal access tokens table for secure external document sharing
export const portalAccessTokens = pgTable("portal_access_tokens", {
  id: serial("id").primaryKey(),
  targetCompanyId: integer("target_company_id").references(() => targetCompanies.id).notNull(),
  targetContactId: integer("target_contact_id").references(() => targetContacts.id).notNull(),
  userCompanyId: integer("user_company_id").references(() => userCompanies.id).notNull(),
  accessToken: varchar("access_token", { length: 255 }).unique().notNull(),
  tokenPurpose: varchar("token_purpose", { length: 50 }).default("document_submission"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at").default(sql`(NOW() + INTERVAL '30 days')`),
  lastAccessed: timestamp("last_accessed"),
  accessCount: integer("access_count").default(0),
  createdBy: integer("created_by").references(() => users.id).notNull(),
  ipAddressesUsed: text("ip_addresses_used").array(),
  userAgentStrings: text("user_agent_strings").array(),
  allowedActions: text("allowed_actions").default('{"upload": true, "download": true, "message": true}'),
  customMessage: text("custom_message"),
  portalBranding: text("portal_branding"),
  agreedSubmissionTimeframe: integer("agreed_submission_timeframe").default(14),
  submissionDeadline: date("submission_deadline"),
  chaseUpStatus: varchar("chase_up_status", { length: 50 }).default("not_started"),
  lastChaseEmailSent: timestamp("last_chase_email_sent"),
  chaseEmailCount: integer("chase_email_count").default(0),
  manualDeadlineSet: timestamp("manual_deadline_set"),
  finalDeadlineDate: date("final_deadline_date"),
  escalationLevel: varchar("escalation_level", { length: 50 }).default("none"),
});

// External document submissions table
export const externalDocumentSubmissions = pgTable("external_document_submissions", {
  id: serial("id").primaryKey(),
  portalTokenId: integer("portal_token_id").references(() => portalAccessTokens.id).notNull(),
  targetCompanyId: integer("target_company_id").references(() => targetCompanies.id).notNull(),
  targetContactId: integer("target_contact_id").references(() => targetContacts.id).notNull(),
  originalFilename: varchar("original_filename", { length: 255 }).notNull(),
  storedFilename: varchar("stored_filename", { length: 255 }).notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size").notNull(),
  fileType: varchar("file_type", { length: 100 }),
  documentCategory: varchar("document_category", { length: 100 }),
  submissionNotes: text("submission_notes"),
  submittedAt: timestamp("submitted_at").defaultNow(),
  submissionIp: inet("submission_ip"),
  submissionUserAgent: text("submission_user_agent"),
  processingStatus: varchar("processing_status", { length: 50 }).default("pending"),
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  documentRequirementId: integer("document_requirement_id"),
  virusScanStatus: varchar("virus_scan_status", { length: 50 }).default("pending"),
  virusScanResult: text("virus_scan_result"),
  encryptionStatus: varchar("encryption_status", { length: 50 }).default("encrypted"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Portal document requirements table
export const portalDocumentRequirements = pgTable("portal_document_requirements", {
  id: serial("id").primaryKey(),
  targetCompanyId: integer("target_company_id").references(() => targetCompanies.id).notNull(),
  portalTokenId: integer("portal_token_id").references(() => portalAccessTokens.id).notNull(),
  requirementName: varchar("requirement_name", { length: 255 }).notNull(),
  requirementDescription: text("requirement_description"),
  documentCategory: varchar("document_category", { length: 100 }),
  isMandatory: boolean("is_mandatory").default(true),
  collectionStage: integer("collection_stage").default(1),
  priorityLevel: varchar("priority_level", { length: 20 }).default("medium"),
  dueDate: timestamp("due_date"),
  submissionStatus: varchar("submission_status", { length: 50 }).default("outstanding"),
  submittedDocumentId: integer("submitted_document_id").references(() => externalDocumentSubmissions.id),
  acceptedFileTypes: text("accepted_file_types").array(),
  maxFileSize: integer("max_file_size").default(10485760),
  minFileSize: integer("min_file_size").default(1024),
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
  activityType: varchar("activity_type", { length: 50 }).notNull(),
  activityDescription: text("activity_description"),
  activityTimestamp: timestamp("activity_timestamp").defaultNow(),
  ipAddress: inet("ip_address"),
  userAgent: text("user_agent"),
  sessionDuration: integer("session_duration"),
  relatedDocumentId: integer("related_document_id").references(() => externalDocumentSubmissions.id),
  relatedMessageId: integer("related_message_id"),
  securityFlags: text("security_flags"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Chase-up emails tracking table
export const chaseUpEmails = pgTable("chase_up_emails", {
  id: serial("id").primaryKey(),
  portalTokenId: integer("portal_token_id").references(() => portalAccessTokens.id).notNull(),
  targetCompanyId: integer("target_company_id").references(() => targetCompanies.id).notNull(),
  emailSequenceNumber: integer("email_sequence_number").notNull(),
  emailType: varchar("email_type", { length: 50 }).notNull(),
  sentToContacts: text("sent_to_contacts").array(),
  ccInternalUsers: text("cc_internal_users").array(),
  emailSubject: varchar("email_subject", { length: 255 }),
  scheduledSendTime: timestamp("scheduled_send_time"),
  sentAt: timestamp("sent_at"),
  deliveryStatus: varchar("delivery_status", { length: 50 }).default("pending"),
  internalAlertSent: boolean("internal_alert_sent").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Chase-up schedules table
export const chaseUpSchedules = pgTable("chase_up_schedules", {
  id: serial("id").primaryKey(),
  portalTokenId: integer("portal_token_id").references(() => portalAccessTokens.id).notNull(),
  targetCompanyId: integer("target_company_id").references(() => targetCompanies.id).notNull(),
  timeframeDays: integer("timeframe_days").notNull(),
  submissionDeadline: date("submission_deadline").notNull(),
  email1DelayDays: integer("email_1_delay_days").default(0),
  email2DelayDays: integer("email_2_delay_days").default(2),
  email3DelayDays: integer("email_3_delay_days").default(5),
  email4DelayDays: integer("email_4_delay_days").default(8),
  manualDeadlineDelayDays: integer("manual_deadline_delay_days").default(11),
  isActive: boolean("is_active").default(true),
  isCompleted: boolean("is_completed").default(false),
  completionReason: varchar("completion_reason", { length: 100 }),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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

// Company document requirements table (standardized for all companies)
export const companyDocumentRequirements = pgTable("company_document_requirements", {
  id: serial("id").primaryKey(),
  targetCompanyId: integer("target_company_id").references(() => targetCompanies.id).notNull(),
  requirementName: varchar("requirement_name", { length: 255 }).notNull(),
  requirementDescription: text("requirement_description"),
  documentCategory: varchar("document_category", { length: 100 }),
  collectionStage: integer("collection_stage").notNull().default(1),
  priorityLevel: varchar("priority_level", { length: 20 }).default("medium"),
  isMandatory: boolean("is_mandatory").default(true),
  requirementStatus: varchar("requirement_status", { length: 50 }).default("outstanding"),
  submissionStatus: varchar("submission_status", { length: 50 }).default("not_started"),
  submittedDocumentId: integer("submitted_document_id").references(() => externalDocumentSubmissions.id),
  submittedAt: timestamp("submitted_at"),
  submittedByContactId: integer("submitted_by_contact_id").references(() => targetContacts.id),
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewStatus: varchar("review_status", { length: 50 }),
  reviewNotes: text("review_notes"),
  reviewScore: integer("review_score"),
  dueDate: timestamp("due_date"),
  reminderSentCount: integer("reminder_sent_count").default(0),
  lastReminderSent: timestamp("last_reminder_sent"),
  nextReminderDue: timestamp("next_reminder_due"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Document stage progression table
export const documentStageProgression = pgTable("document_stage_progression", {
  id: serial("id").primaryKey(),
  targetCompanyId: integer("target_company_id").references(() => targetCompanies.id).notNull(),
  currentStage: integer("current_stage").default(1),
  stage1Status: varchar("stage_1_status", { length: 50 }).default("in_progress"),
  stage2Status: varchar("stage_2_status", { length: 50 }).default("not_started"),
  stage1CompletedAt: timestamp("stage_1_completed_at"),
  stage1CompletedBy: integer("stage_1_completed_by").references(() => users.id),
  stage1CompletionPercentage: decimal("stage_1_completion_percentage", { precision: 5, scale: 2 }).default("0.00"),
  stage1MandatoryCompleted: boolean("stage_1_mandatory_completed").default(false),
  stage2StartedAt: timestamp("stage_2_started_at"),
  stage2CompletedAt: timestamp("stage_2_completed_at"),
  stage2CompletedBy: integer("stage_2_completed_by").references(() => users.id),
  stage2CompletionPercentage: decimal("stage_2_completion_percentage", { precision: 5, scale: 2 }).default("0.00"),
  stage2MandatoryCompleted: boolean("stage_2_mandatory_completed").default(false),
  totalRequirements: integer("total_requirements").default(0),
  completedRequirements: integer("completed_requirements").default(0),
  overallCompletionPercentage: decimal("overall_completion_percentage", { precision: 5, scale: 2 }).default("0.00"),
  canProgressToOffer: boolean("can_progress_to_offer").default(false),
  canProgressToLegal: boolean("can_progress_to_legal").default(false),
  pipelineStageUpdatedAt: timestamp("pipeline_stage_updated_at"),
  blockingIssues: text("blocking_issues"),
  resolutionNotes: text("resolution_notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => {
  return {
    uniqueTargetCompany: unique().on(table.targetCompanyId),
  };
});

// Insert schemas
export const insertPortalAccessTokenSchema = createInsertSchema(portalAccessTokens).omit({
  id: true,
  createdAt: true,
  lastAccessed: true,
  accessCount: true,
  lastChaseEmailSent: true,
  chaseEmailCount: true,
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

export const insertChaseUpEmailSchema = createInsertSchema(chaseUpEmails).omit({
  id: true,
  createdAt: true,
});

export const insertChaseUpScheduleSchema = createInsertSchema(chaseUpSchedules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPortalLinkCampaignSchema = createInsertSchema(portalLinkCampaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPortalLinkShareSchema = createInsertSchema(portalLinkShares).omit({
  id: true,
  createdAt: true,
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

export const insertCompanyDocumentRequirementSchema = createInsertSchema(companyDocumentRequirements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  submittedAt: true,
  reviewedAt: true,
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

// Types
export type PortalAccessToken = typeof portalAccessTokens.$inferSelect;
export type InsertPortalAccessToken = z.infer<typeof insertPortalAccessTokenSchema>;

export type ExternalDocumentSubmission = typeof externalDocumentSubmissions.$inferSelect;
export type InsertExternalDocumentSubmission = z.infer<typeof insertExternalDocumentSubmissionSchema>;

export type PortalDocumentRequirement = typeof portalDocumentRequirements.$inferSelect;
export type InsertPortalDocumentRequirement = z.infer<typeof insertPortalDocumentRequirementSchema>;

export type PortalActivityLog = typeof portalActivityLog.$inferSelect;
export type InsertPortalActivityLog = z.infer<typeof insertPortalActivityLogSchema>;

export type ChaseUpEmail = typeof chaseUpEmails.$inferSelect;
export type InsertChaseUpEmail = z.infer<typeof insertChaseUpEmailSchema>;

export type ChaseUpSchedule = typeof chaseUpSchedules.$inferSelect;
export type InsertChaseUpSchedule = z.infer<typeof insertChaseUpScheduleSchema>;

export type PortalLinkCampaign = typeof portalLinkCampaigns.$inferSelect;
export type InsertPortalLinkCampaign = z.infer<typeof insertPortalLinkCampaignSchema>;

export type PortalLinkShare = typeof portalLinkShares.$inferSelect;
export type InsertPortalLinkShare = z.infer<typeof insertPortalLinkShareSchema>;

export type PortalEmailTemplate = typeof portalEmailTemplates.$inferSelect;
export type InsertPortalEmailTemplate = z.infer<typeof insertPortalEmailTemplateSchema>;

export type PortalCommunicationsLog = typeof portalCommunicationsLog.$inferSelect;
export type InsertPortalCommunicationsLog = z.infer<typeof insertPortalCommunicationsLogSchema>;

export type PortalAnalytics = typeof portalAnalytics.$inferSelect;
export type InsertPortalAnalytics = z.infer<typeof insertPortalAnalyticsSchema>;

export type CompanyDocumentRequirement = typeof companyDocumentRequirements.$inferSelect;
export type InsertCompanyDocumentRequirement = z.infer<typeof insertCompanyDocumentRequirementSchema>;

export type DocumentStageProgression = typeof documentStageProgression.$inferSelect;
export type InsertDocumentStageProgression = z.infer<typeof insertDocumentStageProgressionSchema>;
