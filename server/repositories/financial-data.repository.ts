import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { db, type DatabaseExecutor } from '../db';
import {
  financialPeriods,
  incomeStatements,
  balanceSheets,
  staffData,
  agedDebtors,
  fixedAssetsRegister,
  loanFacilities,
  ebitdaAdjustments,
  documents,
  financialContributions,
  type FinancialPeriod,
  type InsertFinancialPeriod,
  type IncomeStatement,
  type InsertIncomeStatement,
  type BalanceSheet,
  type InsertBalanceSheet,
  type StaffData,
  type InsertStaffData,
  type AgedDebtors,
  type InsertAgedDebtors,
  type FixedAssetsRegister,
  type InsertFixedAssetsRegister,
  type LoanFacility,
  type InsertLoanFacility,
  type EbitdaAdjustment,
  type InsertEbitdaAdjustment,
} from '@shared/schema';

export class FinancialDataRepository {
  async findOrCreateFinancialPeriod(
    targetCompanyId: number,
    periodType: 'statutory' | 'management',
    periodEnd: string,
    options?: {
      periodStart?: string;
      fiscalYear?: number;
      periodLabel?: string;
      labelPriority?: 'financial' | 'weak';
      monthsCovered?: number | null;
      isFullYear?: boolean;
      sourceDocumentId?: number;
    }
  ): Promise<FinancialPeriod> {
    // Canonicalise fiscal year from periodEnd
    const periodEndYear = parseInt(periodEnd.slice(0, 4), 10);
    let fiscalYear: number | null = options?.fiscalYear ?? null;
    if (!isNaN(periodEndYear)) {
      if (fiscalYear != null && fiscalYear !== periodEndYear) {
        console.warn(`[FINANCIAL_DATA] fiscalYear mismatch: extractor said ${fiscalYear}, periodEnd says ${periodEndYear} — using ${periodEndYear}`);
      }
      fiscalYear = periodEndYear;
    }

    let existing: FinancialPeriod | undefined;

    // MATCH PATH A: fiscalYear known — match on (company, type, fiscalYear, isFullYear)
    if (fiscalYear !== null) {
      const isFullYear = options?.isFullYear ?? true;
      const matches = await db
        .select()
        .from(financialPeriods)
        .where(
          and(
            eq(financialPeriods.targetCompanyId, targetCompanyId),
            eq(financialPeriods.periodType, periodType),
            eq(financialPeriods.fiscalYear, fiscalYear),
            eq(financialPeriods.isFullYear, isFullYear)
          )
        );
      // Prefer rows with a sourceDocumentId, then most recently updated
      matches.sort((a, b) => {
        const aDoc = a.sourceDocumentId != null ? 1 : 0;
        const bDoc = b.sourceDocumentId != null ? 1 : 0;
        if (bDoc !== aDoc) return bDoc - aDoc;
        return (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0);
      });
      existing = matches[0];
    }

    // MATCH PATH B: fallback to (company, type, periodEnd) — defensive only
    if (!existing) {
      const fallback = await db
        .select()
        .from(financialPeriods)
        .where(
          and(
            eq(financialPeriods.targetCompanyId, targetCompanyId),
            eq(financialPeriods.periodType, periodType),
            eq(financialPeriods.periodEnd, periodEnd)
          )
        )
        .limit(1);
      existing = fallback[0];
    }

    if (existing) {
      const updates: Record<string, any> = {
        updatedAt: new Date(),
        periodEnd,
        fiscalYear: fiscalYear ?? existing.fiscalYear,
      };
      if (options?.labelPriority === 'financial') {
        if (options.sourceDocumentId != null) updates.sourceDocumentId = options.sourceDocumentId;
        if (options.monthsCovered != null) {
          updates.monthsCovered = options.monthsCovered;
          updates.isFullYear = options.isFullYear ?? true;
        }
      } else {
        if (options?.sourceDocumentId && !existing.sourceDocumentId) {
          updates.sourceDocumentId = options.sourceDocumentId;
        }
        if (options?.monthsCovered != null && existing.monthsCovered == null) {
          updates.monthsCovered = options.monthsCovered;
          updates.isFullYear = options.isFullYear ?? true;
        }
      }
      // Label precedence: 'financial' always overwrites; 'weak'/unset only fills null
      if (options?.periodLabel) {
        if (options.labelPriority === 'financial') {
          updates.periodLabel = options.periodLabel;
        } else if (!existing.periodLabel) {
          updates.periodLabel = options.periodLabel;
        }
      }
      const [updated] = await db
        .update(financialPeriods)
        .set(updates)
        .where(eq(financialPeriods.id, existing.id))
        .returning();
      return updated;
    }

    // CREATE
    const [created] = await db
      .insert(financialPeriods)
      .values({
        targetCompanyId,
        periodType,
        periodEnd,
        periodStart: options?.periodStart,
        fiscalYear: fiscalYear ?? undefined,
        periodLabel: options?.periodLabel,
        monthsCovered: options?.monthsCovered,
        isFullYear: options?.isFullYear ?? true,
        sourceDocumentId: options?.sourceDocumentId,
      })
      .returning();

    return created;
  }

  async getFinancialPeriodsByCompany(targetCompanyId: number): Promise<(FinancialPeriod & { documentCategory: string | null; documentName: string | null })[]> {
    const results = await db
      .select({
        period: financialPeriods,
        documentCategory: documents.documentCategory,
        documentName: documents.documentName,
      })
      .from(financialPeriods)
      .leftJoin(documents, eq(financialPeriods.sourceDocumentId, documents.id))
      .where(eq(financialPeriods.targetCompanyId, targetCompanyId))
      .orderBy(desc(financialPeriods.periodEnd));

    return results.map(r => ({ ...r.period, documentCategory: r.documentCategory ?? null, documentName: r.documentName ?? null }));
  }

  async upsertIncomeStatement(
    financialPeriodId: number,
    targetCompanyId: number,
    data: Partial<InsertIncomeStatement>,
    isPrimary: boolean = true
  ): Promise<IncomeStatement> {
    const existing = await db
      .select()
      .from(incomeStatements)
      .where(eq(incomeStatements.financialPeriodId, financialPeriodId))
      .limit(1);

    if (existing.length > 0) {
      let updateData: Record<string, any>;

      if (isPrimary) {
        // Primary year: full overwrite — this is the year the document was filed for
        updateData = { ...data, updatedAt: new Date() };
      } else {
        // Comparative year: only fill in fields that are currently null
        // Never overwrite good data with partial comparative figures
        const existingRow = existing[0] as Record<string, any>;
        updateData = { updatedAt: new Date() };
        for (const [key, value] of Object.entries(data as Record<string, any>)) {
          if (value !== null && value !== undefined && existingRow[key] === null) {
            updateData[key] = value;
          }
        }
      }

      const [updated] = await db
        .update(incomeStatements)
        .set(updateData)
        .where(eq(incomeStatements.id, existing[0].id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(incomeStatements)
      .values({
        financialPeriodId,
        targetCompanyId,
        ...data,
      })
      .returning();

    return created;
  }

  async clearIncomeStatementData(targetCompanyId: number): Promise<void> {
    const nullFields = {
      revenue: null,
      costOfSales: null,
      grossProfit: null,
      administrativeExpenses: null,
      depreciationAmortisation: null,
      otherOperatingIncome: null,
      operatingProfit: null,
      interestReceivable: null,
      interestPayable: null,
      profitBeforeTax: null,
      corporationTax: null,
      netProfit: null,
      staffCosts: null,
      directorsRemuneration: null,
      dividendsPaid: null,
      revenueBreakdown: null,
      costOfSalesBreakdown: null,
      overheadsBreakdown: null,
      exceptionalItems: null,
      sourceDocumentId: null,
      updatedAt: new Date(),
    };
    await db
      .update(incomeStatements)
      .set(nullFields)
      .where(eq(incomeStatements.targetCompanyId, targetCompanyId));
  }

  async getIncomeStatementsByCompany(targetCompanyId: number): Promise<(IncomeStatement & { period: FinancialPeriod })[]> {
    const results = await db
      .select({
        incomeStatement: incomeStatements,
        period: financialPeriods,
      })
      .from(incomeStatements)
      .innerJoin(financialPeriods, eq(incomeStatements.financialPeriodId, financialPeriods.id))
      .where(eq(incomeStatements.targetCompanyId, targetCompanyId))
      .orderBy(desc(financialPeriods.periodEnd));

    return results.map(r => ({ ...r.incomeStatement, period: r.period }));
  }

  async upsertBalanceSheet(
    financialPeriodId: number,
    targetCompanyId: number,
    data: Partial<InsertBalanceSheet>
  ): Promise<BalanceSheet> {
    const existing = await db
      .select()
      .from(balanceSheets)
      .where(eq(balanceSheets.financialPeriodId, financialPeriodId))
      .limit(1);

    if (existing.length > 0) {
      const updateData = Object.fromEntries(
        Object.entries(data).filter(([, v]) => v !== null && v !== undefined)
      );
      const [updated] = await db
        .update(balanceSheets)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(balanceSheets.id, existing[0].id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(balanceSheets)
      .values({
        financialPeriodId,
        targetCompanyId,
        ...data,
      })
      .returning();

    return created;
  }

  async getBalanceSheetsByCompany(targetCompanyId: number): Promise<(BalanceSheet & { period: FinancialPeriod })[]> {
    const results = await db
      .select({
        balanceSheet: balanceSheets,
        period: financialPeriods,
      })
      .from(balanceSheets)
      .innerJoin(financialPeriods, eq(balanceSheets.financialPeriodId, financialPeriods.id))
      .where(eq(balanceSheets.targetCompanyId, targetCompanyId))
      .orderBy(desc(financialPeriods.periodEnd));

    return results.map(r => ({ ...r.balanceSheet, period: r.period }));
  }

  async upsertStaffData(
    financialPeriodId: number,
    targetCompanyId: number,
    data: Partial<InsertStaffData>
  ): Promise<StaffData> {
    const existing = await db
      .select()
      .from(staffData)
      .where(eq(staffData.financialPeriodId, financialPeriodId))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(staffData)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(staffData.id, existing[0].id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(staffData)
      .values({
        financialPeriodId,
        targetCompanyId,
        ...data,
      })
      .returning();

    return created;
  }

  async getStaffDataByCompany(targetCompanyId: number): Promise<(StaffData & { period: FinancialPeriod })[]> {
    const results = await db
      .select({
        staffData: staffData,
        period: financialPeriods,
      })
      .from(staffData)
      .innerJoin(financialPeriods, eq(staffData.financialPeriodId, financialPeriods.id))
      .where(eq(staffData.targetCompanyId, targetCompanyId))
      .orderBy(desc(financialPeriods.periodEnd));

    return results.map(r => ({ ...r.staffData, period: r.period }));
  }

  async upsertAgedDebtors(
    targetCompanyId: number,
    reportDate: string,
    data: Partial<InsertAgedDebtors>
  ): Promise<AgedDebtors> {
    const existing = await db
      .select()
      .from(agedDebtors)
      .where(
        and(
          eq(agedDebtors.targetCompanyId, targetCompanyId),
          eq(agedDebtors.reportDate, reportDate)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(agedDebtors)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(agedDebtors.id, existing[0].id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(agedDebtors)
      .values({
        targetCompanyId,
        reportDate,
        ...data,
      })
      .returning();

    return created;
  }

  async getAgedDebtorsByCompany(targetCompanyId: number): Promise<AgedDebtors[]> {
    return await db
      .select()
      .from(agedDebtors)
      .where(eq(agedDebtors.targetCompanyId, targetCompanyId))
      .orderBy(desc(agedDebtors.reportDate));
  }

  async upsertFixedAssetsRegister(
    targetCompanyId: number,
    reportDate: string,
    data: Partial<InsertFixedAssetsRegister>
  ): Promise<FixedAssetsRegister> {
    const existing = await db
      .select()
      .from(fixedAssetsRegister)
      .where(
        and(
          eq(fixedAssetsRegister.targetCompanyId, targetCompanyId),
          eq(fixedAssetsRegister.reportDate, reportDate)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(fixedAssetsRegister)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(fixedAssetsRegister.id, existing[0].id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(fixedAssetsRegister)
      .values({
        targetCompanyId,
        reportDate,
        ...data,
      })
      .returning();

    return created;
  }

  async getFixedAssetsRegisterByCompany(targetCompanyId: number): Promise<FixedAssetsRegister[]> {
    return await db
      .select()
      .from(fixedAssetsRegister)
      .where(eq(fixedAssetsRegister.targetCompanyId, targetCompanyId))
      .orderBy(desc(fixedAssetsRegister.reportDate));
  }

  async upsertLoanFacility(
    targetCompanyId: number,
    lenderName: string,
    loanType: string,
    data: Partial<InsertLoanFacility>
  ): Promise<LoanFacility> {
    const existing = await db
      .select()
      .from(loanFacilities)
      .where(
        and(
          eq(loanFacilities.targetCompanyId, targetCompanyId),
          eq(loanFacilities.lenderName, lenderName),
          eq(loanFacilities.loanType, loanType)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(loanFacilities)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(loanFacilities.id, existing[0].id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(loanFacilities)
      .values({
        targetCompanyId,
        lenderName,
        loanType,
        ...data,
      })
      .returning();

    return created;
  }

  async getLoanFacilitiesByCompany(targetCompanyId: number): Promise<LoanFacility[]> {
    return await db
      .select()
      .from(loanFacilities)
      .where(eq(loanFacilities.targetCompanyId, targetCompanyId))
      .orderBy(desc(loanFacilities.createdAt));
  }

  async getFinancialSummary(targetCompanyId: number): Promise<{
    periods: FinancialPeriod[];
    incomeStatements: IncomeStatement[];
    balanceSheets: BalanceSheet[];
    staffData: StaffData[];
    agedDebtors: AgedDebtors[];
    fixedAssets: FixedAssetsRegister[];
    loans: LoanFacility[];
  }> {
    const [periods, income, balance, staff, debtors, assets, loans] = await Promise.all([
      this.getFinancialPeriodsByCompany(targetCompanyId),
      db.select().from(incomeStatements).where(eq(incomeStatements.targetCompanyId, targetCompanyId)).orderBy(desc(incomeStatements.createdAt)),
      db.select().from(balanceSheets).where(eq(balanceSheets.targetCompanyId, targetCompanyId)).orderBy(desc(balanceSheets.createdAt)),
      db.select().from(staffData).where(eq(staffData.targetCompanyId, targetCompanyId)).orderBy(desc(staffData.createdAt)),
      this.getAgedDebtorsByCompany(targetCompanyId),
      this.getFixedAssetsRegisterByCompany(targetCompanyId),
      this.getLoanFacilitiesByCompany(targetCompanyId),
    ]);

    return {
      periods,
      incomeStatements: income,
      balanceSheets: balance,
      staffData: staff,
      agedDebtors: debtors,
      fixedAssets: assets,
      loans,
    };
  }

  async deleteByDocumentId(documentId: number): Promise<void> {
    // Delete from all financial tables that reference this document
    // Order matters due to foreign key constraints - delete child records first
    
    // Get financial periods linked to this document
    const periods = await db
      .select({ id: financialPeriods.id })
      .from(financialPeriods)
      .where(eq(financialPeriods.sourceDocumentId, documentId));
    
    const periodIds = periods.map(p => p.id);
    
    if (periodIds.length > 0) {
      // Delete income statements linked to these periods
      for (const periodId of periodIds) {
        await db.delete(incomeStatements).where(eq(incomeStatements.financialPeriodId, periodId));
      }
      
      // Delete balance sheets linked to these periods
      for (const periodId of periodIds) {
        await db.delete(balanceSheets).where(eq(balanceSheets.financialPeriodId, periodId));
      }
    }
    
    // Also delete any income statements / balance sheets that reference document directly
    await db.delete(incomeStatements).where(eq(incomeStatements.sourceDocumentId, documentId));
    await db.delete(balanceSheets).where(eq(balanceSheets.sourceDocumentId, documentId));
    
    // Delete records that reference document directly
    await db.delete(staffData).where(eq(staffData.sourceDocumentId, documentId));
    await db.delete(agedDebtors).where(eq(agedDebtors.sourceDocumentId, documentId));
    await db.delete(fixedAssetsRegister).where(eq(fixedAssetsRegister.sourceDocumentId, documentId));
    await db.delete(loanFacilities).where(eq(loanFacilities.sourceDocumentId, documentId));
    
    // Finally delete the financial periods themselves
    await db.delete(financialPeriods).where(eq(financialPeriods.sourceDocumentId, documentId));
    
    console.log(`[FINANCIAL_DATA] Deleted all financial data for document ${documentId}`);
  }

  /**
   * Delete only non-projection financial data for a document (staff, debtors,
   * assets, loans). Does NOT touch income_statements, balance_sheets, or
   * financial_periods — those are managed by reselect() after contributions
   * are dropped.
   */
  async deleteNonProjectionByDocumentId(documentId: number, executor: DatabaseExecutor = db): Promise<void> {
    await executor.delete(staffData).where(eq(staffData.sourceDocumentId, documentId));
    await executor.delete(agedDebtors).where(eq(agedDebtors.sourceDocumentId, documentId));
    await executor.delete(fixedAssetsRegister).where(eq(fixedAssetsRegister.sourceDocumentId, documentId));
    await executor.delete(loanFacilities).where(eq(loanFacilities.sourceDocumentId, documentId));
    console.log(`[FINANCIAL_DATA] Deleted non-projection financial data for document ${documentId}`);
  }

  async deleteDocumentDerivedRows(documentId: number, executor: DatabaseExecutor = db): Promise<void> {
    await executor.delete(incomeStatements).where(eq(incomeStatements.sourceDocumentId, documentId));
    await executor.delete(balanceSheets).where(eq(balanceSheets.sourceDocumentId, documentId));
    await executor.delete(financialPeriods).where(and(
      eq(financialPeriods.sourceDocumentId, documentId),
      sql`NOT EXISTS (SELECT 1 FROM income_statements i WHERE i.financial_period_id = ${financialPeriods.id})`,
      sql`NOT EXISTS (SELECT 1 FROM balance_sheets b WHERE b.financial_period_id = ${financialPeriods.id})`,
    ));
  }

  async deleteContributionsByDocumentIds(documentIds: number[]): Promise<number> {
    if (!documentIds.length) return 0;
    const deleted = await db
      .delete(financialContributions)
      .where(inArray(financialContributions.sourceDocumentId, documentIds))
      .returning({ id: financialContributions.id });
    return deleted.length;
  }

  async deleteContributionsByCompanyId(targetCompanyId: number): Promise<number> {
    const deleted = await db
      .delete(financialContributions)
      .where(eq(financialContributions.targetCompanyId, targetCompanyId))
      .returning({ id: financialContributions.id });
    return deleted.length;
  }

  async getAdjustmentsByCompany(targetCompanyId: number): Promise<(EbitdaAdjustment & { period: FinancialPeriod })[]> {
    const results = await db
      .select({
        adjustment: ebitdaAdjustments,
        period: financialPeriods,
      })
      .from(ebitdaAdjustments)
      .innerJoin(financialPeriods, eq(ebitdaAdjustments.financialPeriodId, financialPeriods.id))
      .where(eq(ebitdaAdjustments.targetCompanyId, targetCompanyId))
      .orderBy(desc(financialPeriods.periodEnd), desc(ebitdaAdjustments.createdAt));

    return results.map(r => ({ ...r.adjustment, period: r.period }));
  }

  async getTotalAdjustmentsByPeriod(financialPeriodId: number): Promise<number> {
    const result = await db
      .select({ 
        total: sql<string>`COALESCE(SUM(${ebitdaAdjustments.amount}), 0)` 
      })
      .from(ebitdaAdjustments)
      .where(eq(ebitdaAdjustments.financialPeriodId, financialPeriodId));
    return parseFloat(result[0]?.total || '0');
  }

  /**
   * @deprecated No active callers remain — EBITDA calculation is now handled by
   * `fetchReportedEbitdaByYear` (deal-model.service.ts) + the pure
   * `calculateFullDealModel` calculator. Retained for reference only.
   */
  async calculateAdjustedEbitda(targetCompanyId: number, calculationMethod: string = 'average_3yr'): Promise<{
    baseEbitda: number;
    totalAdjustments: number;
    adjustedEbitda: number;
    periodsUsed: number[];
  }> {
    const periods = await db
      .select()
      .from(financialPeriods)
      .where(eq(financialPeriods.targetCompanyId, targetCompanyId))
      .orderBy(desc(financialPeriods.periodEnd));

    const statements = await db
      .select({
        incomeStatement: incomeStatements,
        period: financialPeriods,
      })
      .from(incomeStatements)
      .innerJoin(financialPeriods, eq(incomeStatements.financialPeriodId, financialPeriods.id))
      .where(eq(incomeStatements.targetCompanyId, targetCompanyId))
      .orderBy(desc(financialPeriods.periodEnd));

    let periodsToUse: number[] = [];
    let baseEbitda = 0;

    if (calculationMethod === 'latest_year' && statements.length > 0) {
      periodsToUse = [statements[0].period.id];
      const revenue = parseFloat(statements[0].incomeStatement.revenue || '0');
      const costOfSales = parseFloat(statements[0].incomeStatement.costOfSales || '0');
      const adminExpenses = parseFloat(statements[0].incomeStatement.administrativeExpenses || '0');
      const depreciation = parseFloat(statements[0].incomeStatement.depreciationAmortisation || '0');
      baseEbitda = revenue - costOfSales - adminExpenses + depreciation;
    } else if (calculationMethod === 'average_3yr' && statements.length > 0) {
      const yearsToUse = Math.min(3, statements.length);
      periodsToUse = statements.slice(0, yearsToUse).map(s => s.period.id);
      
      let totalEbitda = 0;
      for (let i = 0; i < yearsToUse; i++) {
        const s = statements[i].incomeStatement;
        const revenue = parseFloat(s.revenue || '0');
        const costOfSales = parseFloat(s.costOfSales || '0');
        const adminExpenses = parseFloat(s.administrativeExpenses || '0');
        const depreciation = parseFloat(s.depreciationAmortisation || '0');
        totalEbitda += revenue - costOfSales - adminExpenses + depreciation;
      }
      baseEbitda = totalEbitda / yearsToUse;
    }

    let totalAdjustments = 0;
    for (const periodId of periodsToUse) {
      totalAdjustments += await this.getTotalAdjustmentsByPeriod(periodId);
    }
    if (periodsToUse.length > 1 && calculationMethod === 'average_3yr') {
      totalAdjustments = totalAdjustments / periodsToUse.length;
    }

    return {
      baseEbitda,
      totalAdjustments,
      adjustedEbitda: baseEbitda + totalAdjustments,
      periodsUsed: periodsToUse,
    };
  }
}

export const financialDataRepository = new FinancialDataRepository();
