import { pgTable, serial, varchar, text, integer, boolean, timestamp, json, jsonb, inet } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { targetCompanies } from './deals';
import { userCompanies, users } from './core';
import { dealModels } from './deal-models';
import { portalAccessTokens } from './portal';

export const dealDocumentTemplates = pgTable("deal_document_templates", {
  id: serial("id").primaryKey(),
  userCompanyId: integer("user_company_id").references(() => userCompanies.id),
  templateName: varchar("template_name", { length: 255 }).notNull(),
  documentType: varchar("document_type", { length: 50 }).notNull(),
  templateFileUrl: text("template_file_url").notNull(),
  placeholderMap: json("placeholder_map"),
  sections: json("sections"),
  isSystem: boolean("is_system").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const dealDocuments = pgTable("deal_documents", {
  id: serial("id").primaryKey(),
  targetCompanyId: integer("target_company_id").references(() => targetCompanies.id).notNull(),
  userCompanyId: integer("user_company_id").references(() => userCompanies.id).notNull(),
  dealModelId: integer("deal_model_id").references(() => dealModels.id),
  portalTokenId: integer("portal_token_id").references(() => portalAccessTokens.id),
  templateId: integer("template_id").references(() => dealDocumentTemplates.id),
  documentType: varchar("document_type", { length: 50 }).notNull(),
  status: varchar("status", { length: 50 }).default("draft").notNull(),
  deliveryMethod: varchar('delivery_method', { length: 10 }).default('portal').notNull(),
  version: integer("version").default(1).notNull(),
  parentDocumentId: integer("parent_document_id"),
  documentData: json("document_data"),
  sectionConfig: json("section_config"),
  generatedFileUrl: text("generated_file_url"),
  createdBy: integer("created_by").references(() => users.id).notNull(),
  sentAt: timestamp("sent_at"),
  viewedAt: timestamp("viewed_at"),
  respondedAt: timestamp("responded_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  // Set when a user explicitly confirms sending an offer whose computed price is at or
  // below zero. Null means never acknowledged, which is what blocks the send. Persisted
  // rather than logged: the offer letter goes to the seller, so the record of who chose
  // to send it needs to outlive a log rotation.
  unsupportedPriceAcknowledgedAt: timestamp("unsupported_price_acknowledged_at"),
  unsupportedPriceAcknowledgedBy: integer("unsupported_price_acknowledged_by").references(() => users.id),
});

export const currentOffers = pgTable('current_offers', {
  id: serial('id').primaryKey(),
  targetCompanyId: integer('target_company_id').notNull().references(() => targetCompanies.id),
  userCompanyId: integer('user_company_id').notNull().references(() => userCompanies.id),
  dealDocumentId: integer('deal_document_id').references(() => dealDocuments.id),
  dealModelId: integer('deal_model_id'),
  offerPrice: text('offer_price'),
  enterpriseValue: text('enterprise_value'),
  transactionType: varchar('transaction_type', { length: 20 }),
  documentData: jsonb('document_data'),
  deliveryMethod: varchar('delivery_method', { length: 10 }),
  status: varchar('status', { length: 20 }).default('sent'),
  sentAt: timestamp('sent_at'),
  acceptedAt: timestamp('accepted_at'),
  acceptedBy: varchar('accepted_by', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const dealDocumentResponses = pgTable("deal_document_responses", {
  id: serial("id").primaryKey(),
  dealDocumentId: integer("deal_document_id").references(() => dealDocuments.id).notNull(),
  responseType: varchar("response_type", { length: 50 }).notNull(),
  comments: text("comments"),
  respondentName: text("respondent_name").notNull(),
  respondentEmail: text("respondent_email"),
  respondentIp: inet("respondent_ip"),
  respondentUserAgent: text("respondent_user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDealDocumentTemplateSchema = createInsertSchema(dealDocumentTemplates).omit({
  id: true,
  createdAt: true,
});

export const insertDealDocumentSchema = createInsertSchema(dealDocuments).omit({
  id: true,
  createdAt: true,
});

export const insertDealDocumentResponseSchema = createInsertSchema(dealDocumentResponses).omit({
  id: true,
  createdAt: true,
});

export type DealDocumentTemplate = typeof dealDocumentTemplates.$inferSelect;
export type InsertDealDocumentTemplate = z.infer<typeof insertDealDocumentTemplateSchema>;

export type DealDocument = typeof dealDocuments.$inferSelect;
export type InsertDealDocument = z.infer<typeof insertDealDocumentSchema>;

export type DealDocumentResponse = typeof dealDocumentResponses.$inferSelect;
export type InsertDealDocumentResponse = z.infer<typeof insertDealDocumentResponseSchema>;

export const insertCurrentOfferSchema = createInsertSchema(currentOffers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CurrentOffer = typeof currentOffers.$inferSelect;
export type InsertCurrentOffer = z.infer<typeof insertCurrentOfferSchema>;
