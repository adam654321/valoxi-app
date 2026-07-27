import { pgTable, serial, varchar, text, integer, decimal, boolean, timestamp, json, jsonb } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { users, userCompanies } from './core';
import { targetCompanies } from './deals';
import { expertAnalysisResults } from './documents';

export const dealModels = pgTable("deal_models", {
  id: serial("id").primaryKey(),
  targetCompanyId: integer("target_company_id").references(() => targetCompanies.id).notNull(),
  createdBy: integer("created_by").references(() => users.id).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  status: varchar("status", { length: 50 }).default('draft'),
  version: integer("version").default(1),
  transactionType: varchar("transaction_type", { length: 20 }).default('share_sale'),
  parentModelId: integer("parent_model_id"),
  isLocked: boolean("is_locked").default(false),
  averagingYears: integer("averaging_years").default(3),
  ebitdaMultiple: decimal("ebitda_multiple").default('3.0'),
  offerDriver: varchar("offer_driver", { length: 20 }).default('ebitda'),
  targetOfferPrice: decimal("target_offer_price"),
  multipleLow: decimal("multiple_low"),
  multipleHigh: decimal("multiple_high"),
  propertyValue: decimal("property_value").default('0'),
  cashValue: decimal("cash_value").default('0'),
  otherAssets: decimal("other_assets").default('0'),
  calculatedEbitda: decimal("calculated_ebitda"),
  adjustedEbitda: decimal("adjusted_ebitda"),
  enterpriseValue: decimal("enterprise_value"),
  plusExcessCash: decimal("plus_excess_cash"),
  minusPrimaryDebt: decimal("minus_primary_debt"),
  minusOtherDebt: decimal("minus_other_debt"),
  minusCorpTaxDue: decimal("minus_corp_tax_due"),
  minusWorkingCapitalAdj: decimal("minus_working_capital_adj"),
  workingCapitalMonths: integer("working_capital_months").default(3),
  workingCapitalMonthlyAmount: decimal("working_capital_monthly_amount"),
  totalPurchasePrice: decimal("total_purchase_price"),
  totalFundingAvailable: decimal("total_funding_available"),
  equityRequired: decimal("equity_required"),
  upfrontCash: decimal("upfront_cash"),
  deferredAmount: decimal("deferred_amount"),
  deferredTerms: varchar("deferred_terms", { length: 500 }),
  earnoutMaximum: decimal("earnout_maximum"),
  earnoutMetric: varchar("earnout_metric", { length: 255 }),
  earnoutPeriodMonths: integer("earnout_period_months"),
  retentionEscrow: decimal("retention_escrow"),
  feeLegalDdAmount: decimal("fee_legal_dd_amount"),
  feeAccountingDdAmount: decimal("fee_accounting_dd_amount"),
  feeLoanArrangementAmount: decimal("fee_loan_arrangement_amount"),
  feeDealMakerAmount: decimal("fee_deal_maker_amount"),
  customFees: jsonb("custom_fees").default([]),
  expertDataSnapshot: json("expert_data_snapshot"),
  financialDataSnapshot: json("financial_data_snapshot"),
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
  confidence: varchar("confidence", { length: 20 }),
  defensibilityScore: integer("defensibility_score"),
  caseForInclusion: text("case_for_inclusion"),
  caseForExclusion: text("case_for_exclusion"),
  status: varchar("status", { length: 50 }).default('suggested'),
  isAccepted: boolean("is_accepted").default(false),
  isManual: boolean("is_manual").default(false),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// DEPRECATED (#98): upfrontCash, deferredAmount, deferredTerms, earnoutMaximum, earnoutMetric, earnoutPeriodMonths, retentionEscrow on deal_models are vestigial. Seller/earnout now live in deal_model_seller_payments and deal_model_contingent_consideration. Do not drop until the AI pipeline writes to the new tables (later slice).
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
  arrangementFeePercent: decimal("arrangement_fee_percent"),
  termMonths: integer("term_months"),
  monthlyRepayment: decimal("monthly_repayment"),
  isDebt: boolean("is_debt").default(false),
  repaymentStructure: varchar("repayment_structure", { length: 50 }).notNull().default('amortizing'),
  isActive: boolean("is_active").default(false),
  notes: text("notes"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const dealModelSellerPayments = pgTable("deal_model_seller_payments", {
  id: serial("id").primaryKey(),
  dealModelId: integer("deal_model_id").references(() => dealModels.id).notNull(),
  paymentType: varchar("payment_type", { length: 50 }).notNull().default('fixed_schedule'),
  amount: decimal("amount").default('0'),
  termMonths: integer("term_months"),
  interestRate: decimal("interest_rate"),
  label: varchar("label", { length: 255 }),
  includeInDscr: boolean("include_in_dscr").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const dealModelContingentConsideration = pgTable("deal_model_contingent_consideration", {
  id: serial("id").primaryKey(),
  dealModelId: integer("deal_model_id").references(() => dealModels.id).notNull(),
  considerationType: varchar("consideration_type", { length: 50 }).notNull().default('custom'),
  maximumAmount: decimal("maximum_amount").default('0'),
  termMonths: integer("term_months"),
  triggerDescription: text("trigger_description"),
  includeInDscr: boolean("include_in_dscr").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type DealModelSellerPayment = typeof dealModelSellerPayments.$inferSelect;
export type InsertDealModelSellerPayment = typeof dealModelSellerPayments.$inferInsert;
export type DealModelContingentConsideration = typeof dealModelContingentConsideration.$inferSelect;
export type InsertDealModelContingentConsideration = typeof dealModelContingentConsideration.$inferInsert;

export const dealMetricsSnapshots = pgTable("deal_metrics_snapshots", {
  id: serial("id").primaryKey(),
  userCompanyId: integer("user_company_id").references(() => userCompanies.id).notNull(),
  targetCompanyId: integer("target_company_id").references(() => targetCompanies.id).notNull(),
  dealModelId: integer("deal_model_id").references(() => dealModels.id),
  triggerEvent: varchar("trigger_event", { length: 50 }).notNull(),
  schemaVersion: integer("schema_version").notNull().default(1),
  metrics: jsonb("metrics").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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

export const insertDealMetricsSnapshotSchema = createInsertSchema(dealMetricsSnapshots).omit({
  id: true,
  createdAt: true,
});

export type DealModel = typeof dealModels.$inferSelect;
export type InsertDealModel = z.infer<typeof insertDealModelSchema>;
export type DealModelAdjustment = typeof dealModelAdjustments.$inferSelect;
export type InsertDealModelAdjustment = z.infer<typeof insertDealModelAdjustmentSchema>;
export type DealModelFundingLine = typeof dealModelFundingLines.$inferSelect;
export type InsertDealModelFundingLine = z.infer<typeof insertDealModelFundingLineSchema>;
export type DealMetricsSnapshot = typeof dealMetricsSnapshots.$inferSelect;
export type InsertDealMetricsSnapshot = z.infer<typeof insertDealMetricsSnapshotSchema>;
