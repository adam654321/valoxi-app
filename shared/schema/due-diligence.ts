import { pgTable, serial, varchar, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { targetCompanies } from './deals';
import { documents } from './documents';
import { externalDocumentSubmissions } from './portal';
import { users } from './core';

export const ddCategories = pgTable("dd_categories", {
  id: serial("id").primaryKey(),
  refPrefix: varchar("ref_prefix", { length: 10 }).unique().notNull(),
  categoryName: varchar("category_name", { length: 255 }).unique().notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const ddRequirements = pgTable("dd_requirements", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").references(() => ddCategories.id).notNull(),
  refNumber: varchar("ref_number", { length: 10 }).unique().notNull(),
  documentName: varchar("document_name", { length: 500 }).notNull(),
  priority: varchar("priority", { length: 20 }).notNull(),
  guidance: text("guidance"),
  collectionStage: integer("collection_stage").default(2),
  sortOrder: integer("sort_order").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const ddRequirementStatus = pgTable("dd_requirement_status", {
  id: serial("id").primaryKey(),
  requirementId: integer("requirement_id").references(() => ddRequirements.id).notNull(),
  targetCompanyId: integer("target_company_id").references(() => targetCompanies.id).notNull(),
  status: varchar("status", { length: 30 }).default("not_submitted").notNull(),
  notes: text("notes"),
  documentId: integer("document_id").references(() => documents.id),
  externalSubmissionId: integer("external_submission_id").references(() => externalDocumentSubmissions.id),
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  updatedBy: integer("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  sellerMarkedComplete: boolean("seller_marked_complete").default(false),
  sellerMarkedCompleteAt: timestamp("seller_marked_complete_at"),
  buyerReviewStatus: varchar("buyer_review_status", { length: 30 }).default("not_reviewed"),
  buyerReviewNotes: text("buyer_review_notes"),
  buyerReviewedAt: timestamp("buyer_reviewed_at"),
  buyerReviewedBy: integer("buyer_reviewed_by").references(() => users.id),
});

export const ddRequirementDocuments = pgTable("dd_requirement_documents", {
  id: serial("id").primaryKey(),
  requirementStatusId: integer("requirement_status_id").references(() => ddRequirementStatus.id).notNull(),
  targetCompanyId: integer("target_company_id").references(() => targetCompanies.id).notNull(),
  documentSource: varchar("document_source", { length: 20 }).notNull(),
  documentId: integer("document_id").references(() => documents.id),
  externalSubmissionId: integer("external_submission_id").references(() => externalDocumentSubmissions.id),
  addedBy: integer("added_by").references(() => users.id),
  addedAt: timestamp("added_at").defaultNow(),
  notes: text("notes"),
});

export const insertDdCategorySchema = createInsertSchema(ddCategories).omit({
  id: true,
  createdAt: true,
});

export const insertDdRequirementSchema = createInsertSchema(ddRequirements).omit({
  id: true,
  createdAt: true,
});

export const insertDdRequirementStatusSchema = createInsertSchema(ddRequirementStatus).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  reviewedAt: true,
});

export const insertDdRequirementDocumentSchema = createInsertSchema(ddRequirementDocuments).omit({
  id: true,
  addedAt: true,
});

export type DdCategory = typeof ddCategories.$inferSelect;
export type InsertDdCategory = z.infer<typeof insertDdCategorySchema>;

export type DdRequirement = typeof ddRequirements.$inferSelect;
export type InsertDdRequirement = z.infer<typeof insertDdRequirementSchema>;

export type DdRequirementStatus = typeof ddRequirementStatus.$inferSelect;
export type InsertDdRequirementStatus = z.infer<typeof insertDdRequirementStatusSchema>;

export type DdRequirementDocument = typeof ddRequirementDocuments.$inferSelect;
export type InsertDdRequirementDocument = z.infer<typeof insertDdRequirementDocumentSchema>;
