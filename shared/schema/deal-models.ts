import { pgTable, serial, varchar, text, integer, decimal, boolean, timestamp, json } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { users } from './core';
import { targetCompanies } from './deals';
import { expertAnalysisResults } from './documents';

export const dealModels = pgTable("deal_models", {
  id: serial("id").primaryKey(),
  targetCompanyId: integer("target_company_id").references(() => targetCompanies.id).notNull(),
  createdBy: integer("created_by").references(() => users.id).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  status: varchar("status", { length: 50 }).default('draft'),
  version: integer("version").default(1),
  parentModelId: integer("parent_model_id"),
  isLocked: boolean("is_locked").default(false),
  averagingYears: integer("averaging_years").default(3),
  ebitdaMultiple: decimal("ebitda_multiple").default('3.0'),
  propertyValue: decimal("property_value").default('0'),
  cashValue: decimal("cash_value").default('0'),
  otherAssets: decimal("other_assets").default('0'),
  calculatedEbitda: decimal("calculated_ebitda"),
  adjustedEbitda: decimal("adjusted_ebitda"),
  enterpriseValue: decimal("enterprise_value"),
  totalPurchasePrice: decimal("total_purchase_price"),
  totalFundingAvailable: decimal("total_funding_available"),
  equityRequired: decimal("equity_required"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const dealModelAdjustments = pgTable("deal_model_adjustments", {
  id: serial("id").primaryKey(),
  dealModelId: integer("deal_model_id").references(() => dealModels.id).notNull(),
  sourceExpertResultId: integer("source_expert_result_id").references(() => expertAnalysisResults.id),
  adjustmentType: varchar("adjustment_type", { length: 50 }).notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  description: varchar("description", { length: 500 }).notNull(),
  amount: decimal("amount").notNull(),
  amountsByYear: json("amounts_by_year"),
  sourceExpert: varchar("source_expert", { length: 50 }),
  reasoning: text("reasoning"),
  isAccepted: boolean("is_accepted").default(false),
  isManual: boolean("is_manual").default(false),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const dealModelFundingLines = pgTable("deal_model_funding_lines", {
  id: serial("id").primaryKey(),
  dealModelId: integer("deal_model_id").references(() => dealModels.id).notNull(),
  fundingType: varchar("funding_type", { length: 50 }).notNull(),
  label: varchar("label", { length: 255 }),
  assetBaseValue: decimal("asset_base_value"),
  ltvPercent: decimal("ltv_percent"),
  availableAmount: decimal("available_amount"),
  amountUsed: decimal("amount_used").default('0'),
  interestRate: decimal("interest_rate"),
  termMonths: integer("term_months"),
  monthlyRepayment: decimal("monthly_repayment"),
  notes: text("notes"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertDealModelSchema = createInsertSchema(dealModels).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDealModelAdjustmentSchema = createInsertSchema(dealModelAdjustments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDealModelFundingLineSchema = createInsertSchema(dealModelFundingLines).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type DealModel = typeof dealModels.$inferSelect;
export type InsertDealModel = z.infer<typeof insertDealModelSchema>;
export type DealModelAdjustment = typeof dealModelAdjustments.$inferSelect;
export type InsertDealModelAdjustment = z.infer<typeof insertDealModelAdjustmentSchema>;
export type DealModelFundingLine = typeof dealModelFundingLines.$inferSelect;
export type InsertDealModelFundingLine = z.infer<typeof insertDealModelFundingLineSchema>;
