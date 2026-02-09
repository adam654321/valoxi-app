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
  feeLegalDdPercent: decimal("fee_legal_dd_percent").default('2.5'),
  feeAccountingDdPercent: decimal("fee_accounting_dd_percent").default('1.5'),
  feeBrokerPercent: decimal("fee_broker_percent").default('2.0'),
  feeLoanArrangementPercent: decimal("fee_loan_arrangement_percent").default('1.0'),
  feeDealMakerPercent: decimal("fee_deal_maker_percent").default('5.0'),
  feeLegalDdType: varchar("fee_legal_dd_type", { length: 20 }).default('percent'),
  feeAccountingDdType: varchar("fee_accounting_dd_type", { length: 20 }).default('percent'),
  feeBrokerType: varchar("fee_broker_type", { length: 20 }).default('percent'),
  feeLoanArrangementType: varchar("fee_loan_arrangement_type", { length: 20 }).default('percent'),
  feeDealMakerType: varchar("fee_deal_maker_type", { length: 20 }).default('percent'),
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
  status: varchar("status", { length: 50 }).default('suggested'),
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
  arrangementFeePercent: decimal("arrangement_fee_percent"),
  termMonths: integer("term_months"),
  monthlyRepayment: decimal("monthly_repayment"),
  isDebt: boolean("is_debt").default(false),
  isActive: boolean("is_active").default(false),
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
