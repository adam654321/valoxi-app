/**
 * Integration test — Slice 1a.2: company delete clears evidence layer.
 *
 * Regression guard: targetCompaniesService.delete() must remove
 * document_evidence_figure → document_evidence_period → document_evidence
 * (in that child-first order, FKs are NO ACTION) before deleting the
 * target_companies row, which would otherwise fail with FK violation.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, and } from 'drizzle-orm';
import { db } from '../../db';
import {
  users,
  targetCompanies,
  documentEvidence,
  documentEvidencePeriod,
  documentEvidenceFigure,
} from '@shared/schema';
import { targetCompaniesService } from '../target-companies.service';

const USER_COMPANY_ID = 71;

describe('company delete — evidence layer cleanup (Slice 1a.2)', () => {
  // ── Test 1: full evidence chain ──────────────────────────────────────────
  describe('Test 1: full evidence chain is removed with the company', () => {
    let testCompanyId: number;
    let evidenceId: number;
    let periodId: number;

    beforeAll(async () => {
      const [company] = await db.insert(targetCompanies).values({
        userCompanyId: USER_COMPANY_ID,
        companyName: 'Slice-1a2 Evidence Delete Test Co 1',
      }).returning();
      testCompanyId = company.id;

      // Evidence row — document_id and document_analysis_result_id left null
      // (the FKs on those columns are SET NULL, so they are nullable)
      const [ev] = await db.insert(documentEvidence).values({
        targetCompanyId: testCompanyId,
        documentType: 'profit_and_loss',
        extractionVersion: 1,
      }).returning();
      evidenceId = ev.id;

      const [period] = await db.insert(documentEvidencePeriod).values({
        documentEvidenceId: evidenceId,
        fiscalYearStated: 2023,
        periodEnd: '2023-03-31',
      }).returning();
      periodId = period.id;

      await db.insert(documentEvidenceFigure).values({
        documentEvidencePeriodId: periodId,
        statementType: 'is',
        fieldKey: 'revenue',
        value: '500000',
        isModelDerived: false,
      });
    });

    afterAll(async () => {
      // Best-effort cleanup in case the test failed before the service delete
      try {
        await db.delete(documentEvidenceFigure)
          .where(eq(documentEvidenceFigure.documentEvidencePeriodId, periodId));
        await db.delete(documentEvidencePeriod)
          .where(eq(documentEvidencePeriod.id, periodId));
        await db.delete(documentEvidence)
          .where(eq(documentEvidence.id, evidenceId));
        await db.delete(targetCompanies)
          .where(eq(targetCompanies.id, testCompanyId));
      } catch { /* best-effort */ }
    });

    it('delete returns true and all three evidence tables are empty for that chain, company row is gone', async () => {
      const result = await targetCompaniesService.delete(testCompanyId, USER_COMPANY_ID);
      expect(result).toBe(true);

      // document_evidence_figure rows for that period must be gone
      const figures = await db.select()
        .from(documentEvidenceFigure)
        .where(eq(documentEvidenceFigure.documentEvidencePeriodId, periodId));
      expect(figures).toHaveLength(0);

      // document_evidence_period rows for that evidence must be gone
      const periods = await db.select()
        .from(documentEvidencePeriod)
        .where(eq(documentEvidencePeriod.documentEvidenceId, evidenceId));
      expect(periods).toHaveLength(0);

      // document_evidence row itself must be gone
      const evRows = await db.select()
        .from(documentEvidence)
        .where(eq(documentEvidence.id, evidenceId));
      expect(evRows).toHaveLength(0);

      // target_companies row must be gone
      const companies = await db.select()
        .from(targetCompanies)
        .where(eq(targetCompanies.id, testCompanyId));
      expect(companies).toHaveLength(0);
    });
  });

  // ── Test 2: orphaned evidence (no document, no DAR) ──────────────────────
  describe('Test 2: orphaned evidence row (post-document-deletion state) is removed', () => {
    let testCompanyId: number;
    let evidenceId: number;

    beforeAll(async () => {
      const [company] = await db.insert(targetCompanies).values({
        userCompanyId: USER_COMPANY_ID,
        companyName: 'Slice-1a2 Evidence Delete Test Co 2',
      }).returning();
      testCompanyId = company.id;

      // Orphaned evidence: document_id and document_analysis_result_id are both NULL
      const [ev] = await db.insert(documentEvidence).values({
        targetCompanyId: testCompanyId,
        documentId: null,
        documentAnalysisResultId: null,
        documentType: 'management_accounts',
        extractionVersion: 1,
      }).returning();
      evidenceId = ev.id;
    });

    afterAll(async () => {
      // Best-effort cleanup
      try {
        await db.delete(documentEvidence)
          .where(eq(documentEvidence.id, evidenceId));
        await db.delete(targetCompanies)
          .where(eq(targetCompanies.id, testCompanyId));
      } catch { /* best-effort */ }
    });

    it('delete succeeds, orphaned evidence row is gone, company row is gone', async () => {
      const result = await targetCompaniesService.delete(testCompanyId, USER_COMPANY_ID);
      expect(result).toBe(true);

      // Orphaned evidence row must be gone
      const evRows = await db.select()
        .from(documentEvidence)
        .where(eq(documentEvidence.id, evidenceId));
      expect(evRows).toHaveLength(0);

      // target_companies row must be gone
      const companies = await db.select()
        .from(targetCompanies)
        .where(eq(targetCompanies.id, testCompanyId));
      expect(companies).toHaveLength(0);
    });
  });
});
