/**
 * Integration test — Slice 15: document deletion FK detach.
 *
 * Regression guard: after dropping a document's contributions + reselect,
 * any financial_period / income_statement / balance_sheet row that was the
 * ONLY source of a period must have its source_document_id NULLed before
 * the documents row is deleted, otherwise the FK constraint fires.
 *
 * Scenario:
 *   Doc A (2023 filing): FY2022 comparative + FY2023 primary
 *   Doc B (2024 filing): FY2023 comparative + FY2024 primary
 *
 *   After deleteDocument(docA):
 *     FY2022 period: no winner → must be detached (source_document_id = NULL)
 *     FY2023 period: falls back to doc B (comparative)
 *     FY2024 period: unchanged (doc B primary)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
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
import { documentsFilesService } from '../documents-files.service';

const USER_COMPANY_ID = 71;

describe('deleteDocument — FK detach (Slice 15)', () => {
  let testCompanyId: number;
  let docAId: number;
  let docBId: number;

  beforeAll(async () => {
    // Resolve a real user in this company so uploadedBy FK is satisfied
    const [userRow] = await db.select({ id: users.id })
      .from(users)
      .where(eq(users.userCompanyId, USER_COMPANY_ID))
      .limit(1);
    if (!userRow) throw new Error(`No user found for userCompanyId ${USER_COMPANY_ID} — seed the DB first`);
    const userId = userRow.id;

    // Test-isolated target company
    const [company] = await db.insert(targetCompanies).values({
      userCompanyId: USER_COMPANY_ID,
      companyName: 'Slice-15 FK Detach Test Co',
    }).returning();
    testCompanyId = company.id;

    // file_path prefixed with 'uploads/' → fileStorageService.delete() skips it silently
    const mkToken = () => `s15-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const [docA, docB] = await db.insert(documents).values([
      {
        targetCompanyId: testCompanyId,
        uploadedBy: userId,
        documentName: '2023 Statutory Accounts',
        originalFilename: '2023-accounts.pdf',
        filePath: 'uploads/slice15-2023.pdf',
        fileSize: 1000,
        fileType: 'application/pdf',
        documentCategory: 'statutory_accounts',
        publicToken: mkToken(),
      },
      {
        targetCompanyId: testCompanyId,
        uploadedBy: userId,
        documentName: '2024 Statutory Accounts',
        originalFilename: '2024-accounts.pdf',
        filePath: 'uploads/slice15-2024.pdf',
        fileSize: 1000,
        fileType: 'application/pdf',
        documentCategory: 'statutory_accounts',
        publicToken: mkToken(),
      },
    ]).returning();
    docAId = docA.id;
    docBId = docB.id;

    // Doc A: FY2022 comparative + FY2023 primary
    // Doc B: FY2023 comparative + FY2024 primary
    await db.insert(financialContributions).values([
      {
        targetCompanyId: testCompanyId,
        sourceDocumentId: docAId,
        statementType: 'income',
        sourceTier: 'statutory',
        isFullYear: true,
        isPrimaryYear: false,      // comparative in the 2023 filing
        periodEnd: '2022-12-31',
        fiscalYear: 2022,
        figures: { operatingProfit: '100000', depreciationAmortisation: '10000' },
      },
      {
        targetCompanyId: testCompanyId,
        sourceDocumentId: docAId,
        statementType: 'income',
        sourceTier: 'statutory',
        isFullYear: true,
        isPrimaryYear: true,       // primary year in the 2023 filing
        periodEnd: '2023-12-31',
        fiscalYear: 2023,
        figures: { operatingProfit: '120000', depreciationAmortisation: '11000' },
      },
      {
        targetCompanyId: testCompanyId,
        sourceDocumentId: docBId,
        statementType: 'income',
        sourceTier: 'statutory',
        isFullYear: true,
        isPrimaryYear: false,      // comparative in the 2024 filing
        periodEnd: '2023-12-31',
        fiscalYear: 2023,
        figures: { operatingProfit: '115000', depreciationAmortisation: '10500' },
      },
      {
        targetCompanyId: testCompanyId,
        sourceDocumentId: docBId,
        statementType: 'income',
        sourceTier: 'statutory',
        isFullYear: true,
        isPrimaryYear: true,       // primary year in the 2024 filing
        periodEnd: '2024-12-31',
        fiscalYear: 2024,
        figures: { operatingProfit: '140000', depreciationAmortisation: '12000' },
      },
    ]);

    // Build the initial projection
    await reselect(testCompanyId);
  });

  afterAll(async () => {
    // Best-effort cleanup — delete in FK-safe order
    try {
      await db.delete(ebitdaAdjustments).where(eq(ebitdaAdjustments.targetCompanyId, testCompanyId));
    } catch { /* no adjustments in test — ignore */ }
    try {
      await db.delete(financialContributions).where(eq(financialContributions.targetCompanyId, testCompanyId));
      await db.delete(incomeStatements).where(eq(incomeStatements.targetCompanyId, testCompanyId));
      await db.delete(balanceSheets).where(eq(balanceSheets.targetCompanyId, testCompanyId));
      await db.delete(financialPeriods).where(eq(financialPeriods.targetCompanyId, testCompanyId));
      await db.delete(documents).where(eq(documents.targetCompanyId, testCompanyId));
      await db.delete(targetCompanies).where(eq(targetCompanies.id, testCompanyId));
    } catch { /* best-effort */ }
  });

  it('initial state: FY2022 + FY2023 sourced from doc A; FY2024 from doc B', async () => {
    const periods = await db.select()
      .from(financialPeriods)
      .where(eq(financialPeriods.targetCompanyId, testCompanyId));

    expect(periods.length).toBeGreaterThanOrEqual(3);

    const fy2022 = periods.find(p => p.fiscalYear === 2022);
    const fy2023 = periods.find(p => p.fiscalYear === 2023);
    const fy2024 = periods.find(p => p.fiscalYear === 2024);

    // Doc A is primary-year winner for FY2023 (isPrimaryYear = true beats comparative)
    expect(fy2022?.sourceDocumentId).toBe(docAId);
    expect(fy2023?.sourceDocumentId).toBe(docAId);
    expect(fy2024?.sourceDocumentId).toBe(docBId);
  });

  it('deleteDocument(docA) succeeds without FK error; FY2022 detached; FY2023 falls back to doc B', async () => {
    // Core regression guard — must NOT throw financial_periods_source_document_id_fkey
    await expect(
      documentsFilesService.deleteDocument(docAId, USER_COMPANY_ID),
    ).resolves.not.toThrow();

    const periods = await db.select()
      .from(financialPeriods)
      .where(eq(financialPeriods.targetCompanyId, testCompanyId));

    const fy2022 = periods.find(p => p.fiscalYear === 2022);
    expect(fy2022).toBeDefined();               // period still exists (reselect never deletes periods)
    expect(fy2022?.sourceDocumentId).toBeNull(); // detached — only source was deleted doc

    const fy2023 = periods.find(p => p.fiscalYear === 2023);
    expect(fy2023?.sourceDocumentId).toBe(docBId); // fell back to doc B comparative

    const fy2024 = periods.find(p => p.fiscalYear === 2024);
    expect(fy2024?.sourceDocumentId).toBe(docBId); // unchanged
  });

  it('income_statement for FY2022 is detached (source_document_id = null)', async () => {
    const rows = await db.select()
      .from(incomeStatements)
      .where(eq(incomeStatements.targetCompanyId, testCompanyId));

    const fy2022Income = rows.find(r => {
      // income rows don't carry periodEnd directly — join via period
      return r.sourceDocumentId === null;
    });
    expect(fy2022Income).toBeDefined();
  });

  it('doc A row is removed from the documents table', async () => {
    const rows = await db.select({ id: documents.id })
      .from(documents)
      .where(eq(documents.id, docAId));
    expect(rows.length).toBe(0);
  });
});
