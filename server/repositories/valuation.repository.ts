import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  ebitdaAdjustments,
  valuations,
  financialPeriods,
  incomeStatements,
  type EbitdaAdjustment,
  type InsertEbitdaAdjustment,
  type Valuation,
  type InsertValuation,
  type FinancialPeriod,
} from '@shared/schema';

export class ValuationRepository {
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

  async getAdjustmentsByPeriod(financialPeriodId: number): Promise<EbitdaAdjustment[]> {
    return await db
      .select()
      .from(ebitdaAdjustments)
      .where(eq(ebitdaAdjustments.financialPeriodId, financialPeriodId))
      .orderBy(desc(ebitdaAdjustments.createdAt));
  }

  async createAdjustment(data: InsertEbitdaAdjustment): Promise<EbitdaAdjustment> {
    const [created] = await db
      .insert(ebitdaAdjustments)
      .values(data)
      .returning();
    return created;
  }

  async updateAdjustment(id: number, data: Partial<InsertEbitdaAdjustment>): Promise<EbitdaAdjustment | null> {
    const [updated] = await db
      .update(ebitdaAdjustments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(ebitdaAdjustments.id, id))
      .returning();
    return updated || null;
  }

  async deleteAdjustment(id: number): Promise<boolean> {
    const result = await db
      .delete(ebitdaAdjustments)
      .where(eq(ebitdaAdjustments.id, id))
      .returning({ id: ebitdaAdjustments.id });
    return result.length > 0;
  }

  async getAdjustmentById(id: number): Promise<EbitdaAdjustment | null> {
    const [adjustment] = await db
      .select()
      .from(ebitdaAdjustments)
      .where(eq(ebitdaAdjustments.id, id))
      .limit(1);
    return adjustment || null;
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

  async getValuationByCompany(targetCompanyId: number): Promise<Valuation | null> {
    const [valuation] = await db
      .select()
      .from(valuations)
      .where(eq(valuations.targetCompanyId, targetCompanyId))
      .orderBy(desc(valuations.updatedAt))
      .limit(1);
    return valuation || null;
  }

  async upsertValuation(targetCompanyId: number, data: Partial<InsertValuation>): Promise<Valuation> {
    const existing = await this.getValuationByCompany(targetCompanyId);
    
    if (existing) {
      const [updated] = await db
        .update(valuations)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(valuations.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(valuations)
      .values({ targetCompanyId, ...data })
      .returning();
    return created;
  }

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

  async isHistoricPeriod(financialPeriodId: number): Promise<boolean> {
    const [period] = await db
      .select()
      .from(financialPeriods)
      .where(eq(financialPeriods.id, financialPeriodId))
      .limit(1);
    
    if (!period) return true;
    return period.periodType === 'statutory' || period.periodType === 'historic';
  }
}

export const valuationRepository = new ValuationRepository();
