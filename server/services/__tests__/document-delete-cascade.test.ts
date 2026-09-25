import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../../db';
import {
  users, targetCompanies, documents, financialContributions, financialPeriods,
  incomeStatements, balanceSheets, documentEvidence, documentEvidencePeriod,
  documentEvidenceFigure, documentAnalysisResults, fileUploadEvents,
} from '@shared/schema';
import { reselect } from '../projection-reselect.service';
import { documentsFilesService } from '../documents-files.service';
import { financialDataRepository } from '../../repositories/financial-data.repository';

const USER_COMPANY_ID = 71;

describe('document deletion removes derived figures', () => {
  let companyId: number;
  let userId: number;
  let serial = 0;

  beforeAll(async () => {
    const [user] = await db.select({ id: users.id }).from(users)
      .where(eq(users.userCompanyId, USER_COMPANY_ID)).limit(1);
    if (!user) throw new Error('Document-delete tests require a seeded development user for company 71');
    userId = user.id;
  });

  beforeEach(async () => {
    const [company] = await db.insert(targetCompanies).values({
      userCompanyId: USER_COMPANY_ID,
      companyName: `Document delete cascade test ${Date.now()}-${++serial}`,
    }).returning();
    companyId = company.id;
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await db.delete(financialContributions).where(eq(financialContributions.targetCompanyId, companyId));
    await db.delete(incomeStatements).where(eq(incomeStatements.targetCompanyId, companyId));
    await db.delete(balanceSheets).where(eq(balanceSheets.targetCompanyId, companyId));
    await db.delete(financialPeriods).where(eq(financialPeriods.targetCompanyId, companyId));
    await db.delete(documentEvidence).where(eq(documentEvidence.targetCompanyId, companyId));
    const docIds = db.select({ id: documents.id }).from(documents)
      .where(eq(documents.targetCompanyId, companyId));
    await db.delete(documentAnalysisResults).where(inArray(documentAnalysisResults.documentId, docIds));
    await db.delete(fileUploadEvents).where(inArray(fileUploadEvents.documentId, docIds));
    await db.delete(documents).where(eq(documents.targetCompanyId, companyId));
    await db.delete(targetCompanies).where(eq(targetCompanies.id, companyId));
  });

  async function addDocument(name: string) {
    const [doc] = await db.insert(documents).values({
      targetCompanyId: companyId, uploadedBy: userId,
      documentName: name, originalFilename: `${name}.pdf`,
      filePath: `uploads/cascade-test-${companyId}-${name}.pdf`,
      fileSize: 100, fileType: 'application/pdf',
      documentCategory: 'statutory_accounts',
      publicToken: `cascade-${companyId}-${name}-${Date.now()}`,
    }).returning();
    return doc.id;
  }

  async function addFigures(documentId: number, year: number, revenue: string, cash: string, primary = true) {
    await db.insert(financialContributions).values([
      {
        targetCompanyId: companyId, sourceDocumentId: documentId,
        fiscalYear: year, statementType: 'income', sourceTier: 'statutory',
        isFullYear: true, isPrimaryYear: primary, periodEnd: `${year}-12-31`,
        figures: { revenue, operatingProfit: revenue },
      },
      {
        targetCompanyId: companyId, sourceDocumentId: documentId,
        fiscalYear: year, statementType: 'balance', sourceTier: 'statutory',
        isFullYear: true, isPrimaryYear: primary, periodEnd: `${year}-12-31`,
        figures: { cashAtBank: cash },
      },
    ]);
  }

  async function assertNoNullSources() {
    const [periods, income, balance, evidence] = await Promise.all([
      db.select().from(financialPeriods).where(eq(financialPeriods.targetCompanyId, companyId)),
      db.select().from(incomeStatements).where(eq(incomeStatements.targetCompanyId, companyId)),
      db.select().from(balanceSheets).where(eq(balanceSheets.targetCompanyId, companyId)),
      db.select().from(documentEvidence).where(eq(documentEvidence.targetCompanyId, companyId)),
    ]);
    expect(periods.filter(row => row.sourceDocumentId === null)).toHaveLength(0);
    expect(income.filter(row => row.sourceDocumentId === null)).toHaveLength(0);
    expect(balance.filter(row => row.sourceDocumentId === null)).toHaveLength(0);
    expect(evidence.filter(row => row.documentId === null)).toHaveLength(0);
  }

  it('a document’s income, balance, period and evidence figures are gone, not detached', async () => {
    const doc = await addDocument('only');
    await addFigures(doc, 2024, '12500', '460');
    await reselect(companyId);
    const [ev] = await db.insert(documentEvidence).values({
      targetCompanyId: companyId, documentId: doc,
      documentType: 'profit_and_loss', extractionVersion: 1,
    }).returning();
    const [ep] = await db.insert(documentEvidencePeriod).values({
      documentEvidenceId: ev.id, fiscalYearStated: 2024,
    }).returning();
    await db.insert(documentEvidenceFigure).values({
      documentEvidencePeriodId: ep.id, statementType: 'is',
      fieldKey: 'revenue', value: '12500',
    });

    await documentsFilesService.deleteDocument(doc, USER_COMPANY_ID);

    expect(await db.select().from(incomeStatements).where(eq(incomeStatements.targetCompanyId, companyId))).toHaveLength(0);
    expect(await db.select().from(balanceSheets).where(eq(balanceSheets.targetCompanyId, companyId))).toHaveLength(0);
    expect(await db.select().from(financialPeriods).where(eq(financialPeriods.targetCompanyId, companyId))).toHaveLength(0);
    expect(await db.select().from(documentEvidence).where(eq(documentEvidence.targetCompanyId, companyId))).toHaveLength(0);
    expect(await db.select().from(documentEvidencePeriod).where(eq(documentEvidencePeriod.documentEvidenceId, ev.id))).toHaveLength(0);
    expect(await db.select().from(documentEvidenceFigure).where(eq(documentEvidenceFigure.documentEvidencePeriodId, ep.id))).toHaveLength(0);
    await assertNoNullSources();
  });

  it('a different document’s year and values survive', async () => {
    const oldDoc = await addDocument('old');
    const keptDoc = await addDocument('kept');
    await addFigures(oldDoc, 2023, '10000', '100');
    await addFigures(keptDoc, 2024, '22000', '900');
    await reselect(companyId);

    await documentsFilesService.deleteDocument(oldDoc, USER_COMPANY_ID);

    const income = await db.select().from(incomeStatements).where(eq(incomeStatements.targetCompanyId, companyId));
    const balance = await db.select().from(balanceSheets).where(eq(balanceSheets.targetCompanyId, companyId));
    expect(income).toHaveLength(1);
    expect(balance).toHaveLength(1);
    expect(income[0].sourceDocumentId).toBe(keptDoc);
    expect(income[0].revenue).toBe('22000');
    expect(balance[0].sourceDocumentId).toBe(keptDoc);
    expect(balance[0].cashAtBank).toBe('900');
    await assertNoNullSources();
  });

  it('reselect rebuilds the same year from the losing document', async () => {
    const winner = await addDocument('winner');
    const fallback = await addDocument('fallback');
    await addFigures(winner, 2024, '33000', '770', true);
    await addFigures(fallback, 2024, '14000', '320', false);
    await reselect(companyId);
    const before = await db.select().from(incomeStatements).where(eq(incomeStatements.targetCompanyId, companyId));
    expect(before[0].sourceDocumentId).toBe(winner);

    await documentsFilesService.deleteDocument(winner, USER_COMPANY_ID);

    const income = await db.select().from(incomeStatements).where(eq(incomeStatements.targetCompanyId, companyId));
    const balance = await db.select().from(balanceSheets).where(eq(balanceSheets.targetCompanyId, companyId));
    expect(income).toHaveLength(1);
    expect(balance).toHaveLength(1);
    expect(income[0].sourceDocumentId).toBe(fallback);
    expect(income[0].revenue).toBe('14000');
    expect(balance[0].sourceDocumentId).toBe(fallback);
    expect(balance[0].cashAtBank).toBe('320');
    await assertNoNullSources();
  });

  it('no financial or evidence source is converted to NULL by a delete', async () => {
    const doc = await addDocument('no-orphans');
    await addFigures(doc, 2024, '8000', '200');
    await reselect(companyId);
    await documentsFilesService.deleteDocument(doc, USER_COMPANY_ID);
    await assertNoNullSources();
  });

  it('a mid-sequence failure rolls back evidence and financial deletion', async () => {
    const doc = await addDocument('rollback');
    await addFigures(doc, 2024, '5000', '100');
    await reselect(companyId);
    await db.insert(documentEvidence).values({
      targetCompanyId: companyId, documentId: doc,
      documentType: 'profit_and_loss', extractionVersion: 1,
    });
    vi.spyOn(financialDataRepository, 'deleteDocumentDerivedRows')
      .mockRejectedValueOnce(new Error('forced mid-sequence failure'));

    await expect(documentsFilesService.deleteDocument(doc, USER_COMPANY_ID))
      .rejects.toThrow('forced mid-sequence failure');
    expect(await db.select().from(documents).where(eq(documents.id, doc))).toHaveLength(1);
    expect(await db.select().from(documentEvidence).where(eq(documentEvidence.targetCompanyId, companyId))).toHaveLength(1);
    expect(await db.select().from(financialContributions).where(eq(financialContributions.targetCompanyId, companyId))).toHaveLength(2);
    expect(await db.select().from(incomeStatements).where(eq(incomeStatements.targetCompanyId, companyId))).toHaveLength(1);
    expect(await db.select().from(balanceSheets).where(eq(balanceSheets.targetCompanyId, companyId))).toHaveLength(1);
    await assertNoNullSources();
  });
});