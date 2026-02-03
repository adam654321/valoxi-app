import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  financialPeriods,
  incomeStatements,
  balanceSheets,
  staffData,
  agedDebtors,
  fixedAssetsRegister,
  loanFacilities,
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
      sourceDocumentId?: number;
    }
  ): Promise<FinancialPeriod> {
    const existing = await db
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

    if (existing.length > 0) {
      if (options?.sourceDocumentId && !existing[0].sourceDocumentId) {
        await db
          .update(financialPeriods)
          .set({ 
            sourceDocumentId: options.sourceDocumentId,
            updatedAt: new Date(),
          })
          .where(eq(financialPeriods.id, existing[0].id));
      }
      return existing[0];
    }

    const [created] = await db
      .insert(financialPeriods)
      .values({
        targetCompanyId,
        periodType,
        periodEnd,
        periodStart: options?.periodStart,
        fiscalYear: options?.fiscalYear,
        periodLabel: options?.periodLabel,
        sourceDocumentId: options?.sourceDocumentId,
      })
      .returning();

    return created;
  }

  async getFinancialPeriodsByCompany(targetCompanyId: number): Promise<FinancialPeriod[]> {
    return await db
      .select()
      .from(financialPeriods)
      .where(eq(financialPeriods.targetCompanyId, targetCompanyId))
      .orderBy(desc(financialPeriods.periodEnd));
  }

  async upsertIncomeStatement(
    financialPeriodId: number,
    targetCompanyId: number,
    data: Partial<InsertIncomeStatement>
  ): Promise<IncomeStatement> {
    const existing = await db
      .select()
      .from(incomeStatements)
      .where(eq(incomeStatements.financialPeriodId, financialPeriodId))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(incomeStatements)
        .set({ ...data, updatedAt: new Date() })
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
      const [updated] = await db
        .update(balanceSheets)
        .set({ ...data, updatedAt: new Date() })
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
    
    // Delete records that reference document directly
    await db.delete(staffData).where(eq(staffData.sourceDocumentId, documentId));
    await db.delete(agedDebtors).where(eq(agedDebtors.sourceDocumentId, documentId));
    await db.delete(fixedAssetsRegister).where(eq(fixedAssetsRegister.sourceDocumentId, documentId));
    await db.delete(loanFacilities).where(eq(loanFacilities.sourceDocumentId, documentId));
    
    // Finally delete the financial periods themselves
    await db.delete(financialPeriods).where(eq(financialPeriods.sourceDocumentId, documentId));
    
    console.log(`[FINANCIAL_DATA] Deleted all financial data for document ${documentId}`);
  }
}

export const financialDataRepository = new FinancialDataRepository();
