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

export type DdCategory = typeof ddCategories.$inferSelect;
export type InsertDdCategory = z.infer<typeof insertDdCategorySchema>;

export type DdRequirement = typeof ddRequirements.$inferSelect;
export type InsertDdRequirement = z.infer<typeof insertDdRequirementSchema>;

export type DdRequirementStatus = typeof ddRequirementStatus.$inferSelect;
export type InsertDdRequirementStatus = z.infer<typeof insertDdRequirementStatusSchema>;
