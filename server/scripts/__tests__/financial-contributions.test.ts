import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../../db';
import {
  userCompanies,
  targetCompanies,
  financialPeriods,
  incomeStatements,
  balanceSheets,
  financialContributions,
} from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { resolveSourceTier } from '../backfill-financial-contributions';

let testUserCompanyId: number;
let testTargetCompanyId: number;
let testPeriodId: number;
let testIncomeId: number;
let testBalanceId: number;

beforeAll(async () => {
  const [uc] = await db
    .insert(userCompanies)
    .values({ companyName: '__test_fc_company__' })
    .returning({ id: userCompanies.id });
  testUserCompanyId = uc.id;

  const [tc] = await db
    .insert(targetCompanies)
    .values({ userCompanyId: testUserCompanyId, companyName: '__test_fc_target__' })
    .returning({ id: targetCompanies.id });
  testTargetCompanyId = tc.id;

  const [fp] = await db
    .insert(financialPeriods)
    .values({
      targetCompanyId: testTargetCompanyId,
      periodType: 'statutory',
      periodEnd: '2023-12-31',
      fiscalYear: 2023,
      isFullYear: true,
      monthsCovered: 12,
    })
    .returning({ id: financialPeriods.id });
  testPeriodId = fp.id;

  const [is] = await db
    .insert(incomeStatements)
    .values({
      targetCompanyId: testTargetCompanyId,
      financialPeriodId: testPeriodId,
      revenue: '500000',
      grossProfit: '200000',
      netProfit: '80000',
    })
    .returning({ id: incomeStatements.id });
  testIncomeId = is.id;

  const [bs] = await db
    .insert(balanceSheets)
    .values({
      targetCompanyId: testTargetCompanyId,
      financialPeriodId: testPeriodId,
      cashAtBank: '50000',
      totalEquity: '150000',
    })
    .returning({ id: balanceSheets.id });
  testBalanceId = bs.id;
});

afterAll(async () => {
  await db
    .delete(financialContributions)
    .where(eq(financialContributions.targetCompanyId, testTargetCompanyId));
  await db.delete(incomeStatements).where(eq(incomeStatements.id, testIncomeId));
  await db.delete(balanceSheets).where(eq(balanceSheets.id, testBalanceId));
  await db.delete(financialPeriods).where(eq(financialPeriods.id, testPeriodId));
  await db.delete(targetCompanies).where(eq(targetCompanies.id, testTargetCompanyId));
  await db.delete(userCompanies).where(eq(userCompanies.id, testUserCompanyId));
});

describe('resolveSourceTier', () => {
  it('returns information_memorandum for Deal Documents category', () => {
    expect(resolveSourceTier('statutory', 'Deal Documents')).toBe('information_memorandum');
  });
  it('returns statutory for statutory period with non-Deal category', () => {
    expect(resolveSourceTier('statutory', 'Company Accounts')).toBe('statutory');
  });
  it('returns management for non-statutory period', () => {
    expect(resolveSourceTier('management', 'Company Accounts')).toBe('management');
  });
  it('returns management for null document category', () => {
    expect(resolveSourceTier('management', null)).toBe('management');
  });
});

describe('financial_contributions insert logic', () => {
  it('inserts an income contribution with correct tier and figures', async () => {
    const tier = resolveSourceTier('statutory', null);

    await db.insert(financialContributions).values({
      targetCompanyId: testTargetCompanyId,
      fiscalYear: 2023,
      statementType: 'income',
      sourceDocumentId: null,
      sourceTier: tier,
      isFullYear: true,
      monthsCovered: 12,
      periodEnd: '2023-12-31',
      asAtDate: null,
      figures: { revenue: '500000', grossProfit: '200000', netProfit: '80000' },
    });

    const [row] = await db
      .select()
      .from(financialContributions)
      .where(
        and(
          eq(financialContributions.targetCompanyId, testTargetCompanyId),
          eq(financialContributions.statementType, 'income'),
        ),
      );

    expect(row).toBeDefined();
    expect(row.sourceTier).toBe('statutory');
    expect(row.fiscalYear).toBe(2023);
    expect(row.figures).toMatchObject({ revenue: '500000', grossProfit: '200000' });
    expect(row.asAtDate).toBeNull();
  });

  it('inserts a balance contribution with asAtDate = periodEnd', async () => {
    const tier = resolveSourceTier('statutory', null);

    await db.insert(financialContributions).values({
      targetCompanyId: testTargetCompanyId,
      fiscalYear: 2023,
      statementType: 'balance',
      sourceDocumentId: null,
      sourceTier: tier,
      isFullYear: true,
      monthsCovered: 12,
      periodEnd: '2023-12-31',
      asAtDate: '2023-12-31',
      figures: { cashAtBank: '50000', totalEquity: '150000' },
    });

    const [row] = await db
      .select()
      .from(financialContributions)
      .where(
        and(
          eq(financialContributions.targetCompanyId, testTargetCompanyId),
          eq(financialContributions.statementType, 'balance'),
        ),
      );

    expect(row).toBeDefined();
    expect(row.sourceTier).toBe('statutory');
    expect(row.asAtDate).toBe('2023-12-31');
    expect(row.figures).toMatchObject({ cashAtBank: '50000', totalEquity: '150000' });
  });
});
