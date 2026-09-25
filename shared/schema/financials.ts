import { pgTable, serial, varchar, text, integer, decimal, boolean, timestamp, date, json, jsonb } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { users } from './core';
import { targetCompanies } from './deals';
import { documents } from './documents';

// Financial periods - tracks fiscal years and management accounting periods
export const financialPeriods = pgTable("financial_periods", {
  id: serial("id").primaryKey(),
  targetCompanyId: integer("target_company_id").references(() => targetCompanies.id).notNull(),
  periodType: varchar("period_type", { length: 20 }).notNull(),
  periodStart: date("period_start"),
  periodEnd: date("period_end").notNull(),
  fiscalYear: integer("fiscal_year"),
  periodLabel: varchar("period_label", { length: 100 }),
  monthsCovered: integer("months_covered"),
  isFullYear: boolean("is_full_year").notNull().default(true),
  sourceTier: varchar("source_tier", { length: 30 }),
  sourceDocumentId: integer("source_document_id").references(() => documents.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Income statements (P&L) - one row per financial period
export const incomeStatements = pgTable("income_statements", {
  id: serial("id").primaryKey(),
  financialPeriodId: integer("financial_period_id").references(() => financialPeriods.id).notNull(),
  targetCompanyId: integer("target_company_id").references(() => targetCompanies.id).notNull(),
  revenue: decimal("revenue"),
  costOfSales: decimal("cost_of_sales"),
  grossProfit: decimal("gross_profit"),
  administrativeExpenses: decimal("administrative_expenses"),
  depreciationAmortisation: decimal("depreciation_amortisation"),
  otherOperatingIncome: decimal("other_operating_income"),
  operatingProfit: decimal("operating_profit"),
  interestReceivable: decimal("interest_receivable"),
  interestPayable: decimal("interest_payable"),
  profitBeforeTax: decimal("profit_before_tax"),
  corporationTax: decimal("corporation_tax"),
  netProfit: decimal("net_profit"),
  staffCosts: decimal("staff_costs"),
  directorsRemuneration: decimal("directors_remuneration"),
  dividendsPaid: decimal("dividends_paid"),
  revenueBreakdown: json("revenue_breakdown"),
  costOfSalesBreakdown: json("cost_of_sales_breakdown"),
  overheadsBreakdown: json("overheads_breakdown"),
  exceptionalItems: json("exceptional_items"),
  isFullYear: boolean("is_full_year").notNull().default(true),
  sourceDocumentId: integer("source_document_id").references(() => documents.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Balance sheets - one row per financial period
export const balanceSheets = pgTable("balance_sheets", {
  id: serial("id").primaryKey(),
  financialPeriodId: integer("financial_period_id").references(() => financialPeriods.id).notNull(),
  targetCompanyId: integer("target_company_id").references(() => targetCompanies.id).notNull(),
  intangibleAssets: decimal("intangible_assets"),
  tangibleFixedAssets: decimal("tangible_fixed_assets"),
  freeholdProperty: decimal("freehold_property"),
  leaseholdProperty: decimal("leasehold_property"),
  plantMachinery: decimal("plant_machinery"),
  fixturesFittings: decimal("fixtures_fittings"),
  motorVehicles: decimal("motor_vehicles"),
  computerEquipment: decimal("computer_equipment"),
  stockInventory: decimal("stock_inventory"),
  tradeDebtors: decimal("trade_debtors"),
  prepayments: decimal("prepayments"),
  amountsOwedByDirectors: decimal("amounts_owed_by_directors"),
  amountsOwedByConnectedCompanies: decimal("amounts_owed_by_connected_companies"),
  directorsCurrentAccount: decimal("directors_current_account"),
  otherDebtors: decimal("other_debtors"),
  cashAtBank: decimal("cash_at_bank"),
  totalCurrentAssets: decimal("total_current_assets"),
  tradeCreditors: decimal("trade_creditors"),
  taxationSocialSecurity: decimal("taxation_social_security"),
  vatPayable: decimal("vat_payable"),
  corporationTaxDue: decimal("corporation_tax_due"),
  bankLoansOverdraftCurrent: decimal("bank_loans_overdraft_current"),
  hirePurchaseCurrent: decimal("hire_purchase_current"),
  accruals: decimal("accruals"),
  amountsOwedToDirectors: decimal("amounts_owed_to_directors"),
  otherCreditors: decimal("other_creditors"),
  totalCurrentLiabilities: decimal("total_current_liabilities"),
  bankLoansLongTerm: decimal("bank_loans_long_term"),
  hirePurchaseLongTerm: decimal("hire_purchase_long_term"),
  deferredTaxation: decimal("deferred_taxation"),
  otherLongTermDebt: decimal("other_long_term_debt"),
  totalLongTermLiabilities: decimal("total_long_term_liabilities"),
  shareCapital: decimal("share_capital"),
  retainedEarnings: decimal("retained_earnings"),
  totalEquity: decimal("total_equity"),
  debtorsList: json("debtors_list"),
  creditorsList: json("creditors_list"),
  fixedAssetsDetail: json("fixed_assets_detail"),
  sourceDocumentId: integer("source_document_id").references(() => documents.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Staff data - payroll and headcount information
export const staffData = pgTable("staff_data", {
  id: serial("id").primaryKey(),
  financialPeriodId: integer("financial_period_id").references(() => financialPeriods.id).notNull(),
  targetCompanyId: integer("target_company_id").references(() => targetCompanies.id).notNull(),
  totalHeadcount: integer("total_headcount"),
  totalStaffCosts: decimal("total_staff_costs"),
  totalGrossSalaries: decimal("total_gross_salaries"),
  totalEmployerNi: decimal("total_employer_ni"),
  totalEmployerPension: decimal("total_employer_pension"),
  directorCount: integer("director_count"),
  directorRemuneration: decimal("director_remuneration"),
  workingDirectorCount: integer("working_director_count"),
  nonWorkingDirectorCount: integer("non_working_director_count"),
  employeeCount: integer("employee_count"),
  employeeCosts: decimal("employee_costs"),
  staffRecords: json("staff_records"),
  sourceDocumentId: integer("source_document_id").references(() => documents.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Aged debtors - receivables aging analysis
export const agedDebtors = pgTable("aged_debtors", {
  id: serial("id").primaryKey(),
  targetCompanyId: integer("target_company_id").references(() => targetCompanies.id).notNull(),
  reportDate: date("report_date").notNull(),
  totalTradeDebtors: decimal("total_trade_debtors"),
  current0To30: decimal("current_0_to_30"),
  days31To60: decimal("days_31_to_60"),
  days61To90: decimal("days_61_to_90"),
  days90Plus: decimal("days_90_plus"),
  badDebtProvision: decimal("bad_debt_provision"),
  doubtfulDebts: decimal("doubtful_debts"),
  recentRevenue: decimal("recent_revenue"),
  debtorDays: decimal("debtor_days"),
  topDebtors: json("top_debtors"),
  sourceDocumentId: integer("source_document_id").references(() => documents.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Fixed assets register - detailed asset tracking
export const fixedAssetsRegister = pgTable("fixed_assets_register", {
  id: serial("id").primaryKey(),
  targetCompanyId: integer("target_company_id").references(() => targetCompanies.id).notNull(),
  reportDate: date("report_date").notNull(),
  totalGrossBookValue: decimal("total_gross_book_value"),
  totalAccumulatedDepreciation: decimal("total_accumulated_depreciation"),
  totalNetBookValue: decimal("total_net_book_value"),
  propertyGrossValue: decimal("property_gross_value"),
  propertyNetBookValue: decimal("property_net_book_value"),
  plantMachineryGrossValue: decimal("plant_machinery_gross_value"),
  plantMachineryNetBookValue: decimal("plant_machinery_net_book_value"),
  vehiclesGrossValue: decimal("vehicles_gross_value"),
  vehiclesNetBookValue: decimal("vehicles_net_book_value"),
  itEquipmentGrossValue: decimal("it_equipment_gross_value"),
  itEquipmentNetBookValue: decimal("it_equipment_net_book_value"),
  otherAssetsGrossValue: decimal("other_assets_gross_value"),
  otherAssetsNetBookValue: decimal("other_assets_net_book_value"),
  refinanceableAssetsValue: decimal("refinanceable_assets_value"),
  fullyDepreciatedStillInUse: decimal("fully_depreciated_still_in_use"),
  assetItems: json("asset_items"),
  propertyDetails: json("property_details"),
  vehicleDetails: json("vehicle_details"),
  sourceDocumentId: integer("source_document_id").references(() => documents.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Loan facilities - debt documentation
export const loanFacilities = pgTable("loan_facilities", {
  id: serial("id").primaryKey(),
  targetCompanyId: integer("target_company_id").references(() => targetCompanies.id).notNull(),
  lenderName: varchar("lender_name", { length: 255 }),
  loanType: varchar("loan_type", { length: 100 }),
  originalAmount: decimal("original_amount"),
  outstandingBalance: decimal("outstanding_balance"),
  interestRate: decimal("interest_rate"),
  termMonths: integer("term_months"),
  startDate: date("start_date"),
  maturityDate: date("maturity_date"),
  monthlyRepayment: decimal("monthly_repayment"),
  annualRepayment: decimal("annual_repayment"),
  security: text("security"),
  personalGuarantees: boolean("personal_guarantees"),
  covenants: text("covenants"),
  earlyRepaymentTerms: text("early_repayment_terms"),
  sourceDocumentId: integer("source_document_id").references(() => documents.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// EBITDA Adjustments - for normalizing earnings with add-backs
export const ebitdaAdjustments = pgTable("ebitda_adjustments", {
  id: serial("id").primaryKey(),
  financialPeriodId: integer("financial_period_id").references(() => financialPeriods.id).notNull(),
  targetCompanyId: integer("target_company_id").references(() => targetCompanies.id).notNull(),
  description: varchar("description", { length: 500 }).notNull(),
  amount: decimal("amount").notNull(),
  category: varchar("category", { length: 100 }),
  notes: text("notes"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Valuations - deal structure and valuation calculations
export const valuations = pgTable("valuations", {
  id: serial("id").primaryKey(),
  targetCompanyId: integer("target_company_id").references(() => targetCompanies.id).notNull(),
  calculationMethod: varchar("calculation_method", { length: 50 }).default("average_3yr"),
  valuationMultiple: decimal("valuation_multiple").default("4.0"),
  adjustedEbitda: decimal("adjusted_ebitda"),
  enterpriseValue: decimal("enterprise_value"),
  netDebt: decimal("net_debt"),
  equityValue: decimal("equity_value"),
  fundingStructure: json("funding_structure"),
  dealNotes: text("deal_notes"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Financial contributions — append-only truth table for income + balance snapshots
export const financialContributions = pgTable("financial_contributions", {
  id: serial("id").primaryKey(),
  targetCompanyId: integer("target_company_id").references(() => targetCompanies.id).notNull(),
  fiscalYear: integer("fiscal_year"),
  statementType: varchar("statement_type", { length: 10 }).notNull(), // 'income' | 'balance'
  sourceDocumentId: integer("source_document_id").references(() => documents.id),
  sourceTier: varchar("source_tier", { length: 30 }).notNull(), // 'user_override'|'statutory'|'management'|'information_memorandum'
  isFullYear: boolean("is_full_year").notNull().default(true),
  isPrimaryYear: boolean("is_primary_year").notNull().default(true),
  monthsCovered: integer("months_covered"),
  periodEnd: date("period_end"),
  asAtDate: date("as_at_date"),
  figures: jsonb("figures").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertFinancialPeriodSchema = createInsertSchema(financialPeriods).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertIncomeStatementSchema = createInsertSchema(incomeStatements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBalanceSheetSchema = createInsertSchema(balanceSheets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStaffDataSchema = createInsertSchema(staffData).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAgedDebtorsSchema = createInsertSchema(agedDebtors).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFixedAssetsRegisterSchema = createInsertSchema(fixedAssetsRegister).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLoanFacilitySchema = createInsertSchema(loanFacilities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEbitdaAdjustmentSchema = createInsertSchema(ebitdaAdjustments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertValuationSchema = createInsertSchema(valuations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type FinancialPeriod = typeof financialPeriods.$inferSelect;
export type InsertFinancialPeriod = z.infer<typeof insertFinancialPeriodSchema>;

export type IncomeStatement = typeof incomeStatements.$inferSelect;
export type InsertIncomeStatement = z.infer<typeof insertIncomeStatementSchema>;

export type BalanceSheet = typeof balanceSheets.$inferSelect;
export type InsertBalanceSheet = z.infer<typeof insertBalanceSheetSchema>;

export type StaffData = typeof staffData.$inferSelect;
export type InsertStaffData = z.infer<typeof insertStaffDataSchema>;

export type AgedDebtors = typeof agedDebtors.$inferSelect;
export type InsertAgedDebtors = z.infer<typeof insertAgedDebtorsSchema>;

export type FixedAssetsRegister = typeof fixedAssetsRegister.$inferSelect;
export type InsertFixedAssetsRegister = z.infer<typeof insertFixedAssetsRegisterSchema>;

export type LoanFacility = typeof loanFacilities.$inferSelect;
export type InsertLoanFacility = z.infer<typeof insertLoanFacilitySchema>;

export type EbitdaAdjustment = typeof ebitdaAdjustments.$inferSelect;
export type InsertEbitdaAdjustment = z.infer<typeof insertEbitdaAdjustmentSchema>;

export type Valuation = typeof valuations.$inferSelect;
export type InsertValuation = z.infer<typeof insertValuationSchema>;

export const insertFinancialContributionSchema = createInsertSchema(financialContributions).omit({
  id: true,
  createdAt: true,
});

export type FinancialContribution = typeof financialContributions.$inferSelect;
export type InsertFinancialContribution = z.infer<typeof insertFinancialContributionSchema>;
