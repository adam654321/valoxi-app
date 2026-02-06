import { pgTable, serial, varchar, text, integer, boolean, timestamp, inet, json } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { users } from './core';
import { targetCompanies } from './deals';
import { externalDocumentSubmissions } from './portal';

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
  fileSize: integer("file_size").notNull(),
  fileType: varchar("file_type", { length: 200 }).notNull(),
  documentCategory: varchar("document_category", { length: 100 }).notNull(),
  description: text("description"),
  isConfidential: boolean("is_confidential").default(true),
  uploadDate: timestamp("upload_date").defaultNow(),
  lastAccessed: timestamp("last_accessed"),
  accessCount: integer("access_count").default(0),
  externalSubmissionId: integer("external_submission_id").references(() => externalDocumentSubmissions.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Document access log
export const documentAccessLog = pgTable("document_access_log", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").references(() => documents.id).notNull(),
  accessedBy: integer("accessed_by").references(() => users.id).notNull(),
  accessType: varchar("access_type", { length: 50 }).notNull(),
  accessedAt: timestamp("accessed_at").defaultNow(),
  ipAddress: inet("ip_address"),
  createdAt: timestamp("created_at").defaultNow(),
});

// File upload monitoring table for webhook testing
export const fileUploadEvents = pgTable("file_upload_events", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").references(() => documents.id).notNull(),
  targetCompanyId: integer("target_company_id").references(() => targetCompanies.id).notNull(),
  uploadedBy: integer("uploaded_by").references(() => users.id).notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileUrl: varchar("file_url", { length: 500 }).notNull(),
  webhookSent: boolean("webhook_sent").default(false),
  webhookResponse: text("webhook_response"),
  webhookStatus: varchar("webhook_status", { length: 50 }).default("pending"),
  webhookSentAt: timestamp("webhook_sent_at"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Document analysis results table for storing webhook response data
export const documentAnalysisResults = pgTable("document_analysis_results", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").references(() => documents.id).notNull(),
  fileUploadEventId: integer("file_upload_event_id").references(() => fileUploadEvents.id).notNull(),
  documentType: varchar("document_type", { length: 100 }).notNull(),
  analysisData: json("analysis_data").notNull(),
  processingTime: integer("processing_time"),
  usageMetadata: json("usage_metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Stage 1 analysis events for tracking comprehensive analysis when all 5 documents are complete
export const stage1AnalysisEvents = pgTable("stage1_analysis_events", {
  id: serial("id").primaryKey(),
  targetCompanyId: integer("target_company_id").references(() => targetCompanies.id).notNull(),
  triggeredBy: integer("triggered_by").references(() => users.id).notNull(),
  concatenatedData: json("concatenated_data").notNull(),
  webhookSent: boolean("webhook_sent").default(false),
  webhookResponse: text("webhook_response"),
  webhookStatus: varchar("webhook_status", { length: 50 }).default("pending"),
  webhookSentAt: timestamp("webhook_sent_at"),
  processingTime: integer("processing_time"),
  detailedAnalysisData: json("detailed_analysis_data"),
  usageMetadata: json("usage_metadata"),
  detailedAnalysisMarkdown: text("detailed_analysis_markdown"),
  detailedAnalysisStatus: varchar("detailed_analysis_status", { length: 50 }).default("pending"),
  detailedAnalysisProcessingTime: integer("detailed_analysis_processing_time"),
  detailedAnalysisUsageMetadata: json("detailed_analysis_usage_metadata"),
  detailedAnalysisTriggeredBy: integer("detailed_analysis_triggered_by").references(() => users.id),
  detailedAnalysisTriggeredAt: timestamp("detailed_analysis_triggered_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Expert analysis results for Multi-Expert M&A Analysis Engine
export const expertAnalysisResults = pgTable("expert_analysis_results", {
  id: serial("id").primaryKey(),
  targetCompanyId: integer("target_company_id").references(() => targetCompanies.id).notNull(),
  stage1EventId: integer("stage1_event_id"),
  expertType: varchar("expert_type", { length: 50 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default('pending'),
  analysisData: json("analysis_data"),
  analysisMarkdown: text("analysis_markdown"),
  score: integer("score"),
  confidence: varchar("confidence", { length: 10 }),
  processingTime: integer("processing_time"),
  usageMetadata: json("usage_metadata"),
  triggeredBy: integer("triggered_by").references(() => users.id),
  dependsOn: text("depends_on").array(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas
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

export const insertFileUploadEventSchema = createInsertSchema(fileUploadEvents).omit({
  id: true,
  createdAt: true,
  uploadedAt: true,
  webhookSentAt: true,
});

export const insertDocumentAnalysisResultSchema = createInsertSchema(documentAnalysisResults).omit({
  id: true,
  createdAt: true,
});

export const insertStage1AnalysisEventSchema = createInsertSchema(stage1AnalysisEvents).omit({
  id: true,
  createdAt: true,
  webhookSent: true,
  webhookResponse: true,
  webhookStatus: true,
  webhookSentAt: true,
  processingTime: true,
});

export const insertExpertAnalysisResultSchema = createInsertSchema(expertAnalysisResults).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type InsertDocumentCategory = z.infer<typeof insertDocumentCategorySchema>;
export type DocumentCategory = typeof documentCategories.$inferSelect;

export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;

export type InsertDocumentAccessLog = z.infer<typeof insertDocumentAccessLogSchema>;
export type DocumentAccessLog = typeof documentAccessLog.$inferSelect;

export type InsertFileUploadEvent = z.infer<typeof insertFileUploadEventSchema>;
export type FileUploadEvent = typeof fileUploadEvents.$inferSelect;

export type InsertDocumentAnalysisResult = z.infer<typeof insertDocumentAnalysisResultSchema>;
export type DocumentAnalysisResult = typeof documentAnalysisResults.$inferSelect;

export type InsertStage1AnalysisEvent = z.infer<typeof insertStage1AnalysisEventSchema>;
export type Stage1AnalysisEvent = typeof stage1AnalysisEvents.$inferSelect;

export type InsertExpertAnalysisResult = z.infer<typeof insertExpertAnalysisResultSchema>;
export type ExpertAnalysisResult = typeof expertAnalysisResults.$inferSelect;
