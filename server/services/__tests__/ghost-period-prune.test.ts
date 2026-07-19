/**
 * Integration test — Slice 16: ghost period pruning in reselect.
 *
 * After a winner changes, the previously-winning period row becomes an empty
 * shell (no income, no balance).  Reselect must now prune those shells while
 * leaving every data-bearing period intact.
 *
 * Test scenario:
 *   1. Seed doc A as the only FY2023 contributor → reselect creates period P1.
 *   2. Manually INSERT a second empty FY2023 period (P_ghost) simulating a
 *      stale shell from a prior reselect run.
 *   3. Run reselect again → P_ghost must be pruned; P1 must survive with its
 *      income_statement untouched.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, and } from 'drizzle-orm';
import { db } from '../../db';
import {
  users,
  targetCompanies,
  documents,
  financialContributions,
  financialPeriods,
  incomeStatements,
  balanceSheets,
  ebitdaAdjustments,
} from '@shared/schema';
import { reselect } from '../projection-reselect.service';

const USER_COMPANY_ID = 71;

describe('reselect — ghost period pruning (Slice 16)', () => {
  let testCompanyId: number;
  let docAId: number;
  let p1Id: number; // canonical period created in phase 1

  beforeAll(async () => {
    const [userRow] = await db.select({ id: users.id })
      .from(users)
      .where(eq(users.userCompanyId, USER_COMPANY_ID))
      .limit(1);
    if (!userRow) throw new Error(`No user for userCompanyId ${USER_COMPANY_ID}`);
    const userId = userRow.id;

    const [company] = await db.insert(targetCompanies).values({
      userCompanyId: USER_COMPANY_ID,
      companyName: 'Slice-16 Ghost Prune Test Co',
    }).returning();
    testCompanyId = company.id;

    const mkToken = () => `s16-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const [docA] = await db.insert(documents).values({
      targetCompanyId: testCompanyId,
      uploadedBy: userId,
      documentName: '2023 Statutory Accounts',
      originalFilename: '2023-accounts.pdf',
      filePath: 'uploads/slice16-doc-a.pdf',
      fileSize: 1000,
      fileType: 'application/pdf',
      documentCategory: 'statutory_accounts',
      publicToken: mkToken(),
    }).returning();
    docAId = docA.id;
  });

  afterAll(async () => {
    try {
      await db.delete(ebitdaAdjustments).where(eq(ebitdaAdjustments.targetCompanyId, testCompanyId));
      await db.delete(financialContributions).where(eq(financialContributions.targetCompanyId, testCompanyId));
      await db.delete(incomeStatements).where(eq(incomeStatements.targetCompanyId, testCompanyId));
      await db.delete(balanceSheets).where(eq(balanceSheets.targetCompanyId, testCompanyId));
      await db.delete(financialPeriods).where(eq(financialPeriods.targetCompanyId, testCompanyId));
      await db.delete(documents).where(eq(documents.targetCompanyId, testCompanyId));
      await db.delete(targetCompanies).where(eq(targetCompanies.id, testCompanyId));
    } catch { /* best-effort */ }
  });

  it('phase 1: reselect creates exactly one FY2023 period with income attached', async () => {
    await db.insert(financialContributions).values({
      targetCompanyId: testCompanyId,
      sourceDocumentId: docAId,
      statementType: 'income',
      sourceTier: 'statutory',
      isFullYear: true,
      isPrimaryYear: true,
      periodEnd: '2023-12-31',
      fiscalYear: 2023,
      figures: { operatingProfit: '100000', depreciationAmortisation: '5000' },
    });

    await reselect(testCompanyId);

    const periods = await db.select()
      .from(financialPeriods)
      .where(and(
        eq(financialPeriods.targetCompanyId, testCompanyId),
        eq(financialPeriods.isFullYear, true),
      ));

    expect(periods.filter(p => p.fiscalYear === 2023)).toHaveLength(1);
    p1Id = periods[0].id;

    const income = await db.select()
      .from(incomeStatements)
      .where(eq(incomeStatements.financialPeriodId, p1Id));
    expect(income).toHaveLength(1);
    expect(Number(income[0].operatingProfit)).toBe(100000);
  });

  it('phase 2: after injecting a ghost and reselecting, only P1 survives', async () => {
    // Inject an empty ghost period for the same FY2023 slot (no income, no balance)
    const [ghost] = await db.insert(financialPeriods).values({
      targetCompanyId: testCompanyId,
      periodType: 'statutory',
      sourceTier: 'statutory',
      periodEnd: '2023-12-31',
      fiscalYear: 2023,
      isFullYear: true,
      sourceDocumentId: null,
      periodLabel: 'FY 2023 (ghost)',
    }).returning();

    // Confirm two FY2023 periods now exist
    let fy2023 = await db.select()
      .from(financialPeriods)
      .where(and(
        eq(financialPeriods.targetCompanyId, testCompanyId),
        eq(financialPeriods.isFullYear, true),
        eq(financialPeriods.fiscalYear, 2023),
      ));
    expect(fy2023).toHaveLength(2);
    expect(fy2023.map(p => p.id)).toContain(ghost.id);

    // Reselect must prune the ghost
    await reselect(testCompanyId);

    fy2023 = await db.select()
      .from(financialPeriods)
      .where(and(
        eq(financialPeriods.targetCompanyId, testCompanyId),
        eq(financialPeriods.isFullYear, true),
        eq(financialPeriods.fiscalYear, 2023),
      ));

    expect(fy2023).toHaveLength(1);          // ghost gone
    expect(fy2023[0].id).toBe(p1Id);         // canonical period survived

    // Ghost is gone from the DB entirely
    const ghostCheck = await db.select({ id: financialPeriods.id })
      .from(financialPeriods)
      .where(eq(financialPeriods.id, ghost.id));
    expect(ghostCheck).toHaveLength(0);
  });

  it('phase 3: data-bearing period retains its income_statement after prune', async () => {
    const income = await db.select()
      .from(incomeStatements)
      .where(eq(incomeStatements.financialPeriodId, p1Id));
    expect(income).toHaveLength(1);
    expect(Number(income[0].operatingProfit)).toBe(100000);
    expect(Number(income[0].depreciationAmortisation)).toBe(5000);
  });

  it('reselect is idempotent: running again produces no further changes', async () => {
    await reselect(testCompanyId);

    const periods = await db.select()
      .from(financialPeriods)
      .where(and(
        eq(financialPeriods.targetCompanyId, testCompanyId),
        eq(financialPeriods.isFullYear, true),
      ));
    expect(periods).toHaveLength(1); // still exactly one
    expect(periods[0].id).toBe(p1Id);

    const income = await db.select()
      .from(incomeStatements)
      .where(eq(incomeStatements.financialPeriodId, p1Id));
    expect(income).toHaveLength(1);
  });
});
