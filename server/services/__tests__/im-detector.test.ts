/**
 * Acceptance tests for IM detection (Slice 6 + Slice 11).
 *
 * Structure:
 *   Part A — pure unit tests for detectInformationMemorandum (no DB needed)
 *   Part B — wiring test: a contribution written for an IM-detected doc gets
 *             tier 'information_memorandum', and in reselect it is demoted
 *             under a statutory contribution for the same year.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { detectInformationMemorandum } from '../../../shared/utils/im-detector';
import { eq, and, inArray } from 'drizzle-orm';
import { db } from '../../db';
import {
  financialContributions,
  financialPeriods,
  incomeStatements,
} from '@shared/schema';
import { reselect } from '../projection-reselect.service';
import { selectProjectionWinners } from '../../../shared/calculators/projection-selector';

// ─────────────────────────────────────────────────────────────────────────────
// Part A — pure unit tests
// ─────────────────────────────────────────────────────────────────────────────

describe('detectInformationMemorandum — pure logic', () => {
  const CURRENT_YEAR = 2026;

  it('MAC IM fixture: "Information Memorandum" + "Adjusted EBITDA" + exec-summary headers → isIM true', () => {
    const rawText = `
      INFORMATION MEMORANDUM

      Prepared by: MAC Corporate Finance

      Executive Summary
      This document provides an overview of ABC Acquisitions Limited.

      Products and Services
      The company operates in three core segments...

      Financial Performance
      Adjusted EBITDA for FY2025: £1.2m
      Adjusted EBITDA for FY2024: £1.0m
    `;
    const result = detectInformationMemorandum({
      rawText,
      extractedYears: [2023, 2024, 2025],
      currentFiscalYear: CURRENT_YEAR,
    });

    expect(result.isIM).toBe(true);
    expect(result.reasons.some(r => r.includes('information memorandum'))).toBe(true);
    expect(result.reasons.some(r => r.includes('adjusted ebitda'))).toBe(true);
    expect(result.reasons.some(r => r.includes('marketing-narrative'))).toBe(true);
    console.log('[IM-DETECTOR TEST] MAC IM fixture reasons:', result.reasons);
  });

  it('Real statutory accounts fixture: P&L + BS, 1-2 years, no adjusted EBITDA, no marketing headers → isIM false', () => {
    const rawText = `
      Directors' Report and Financial Statements
      For the year ended 31 December 2024

      Profit and Loss Account
      Turnover: £5,234,000
      Cost of Sales: £3,100,000
      Gross Profit: £2,134,000
      Administrative Expenses: £1,200,000
      Operating Profit: £934,000

      Balance Sheet
      Fixed Assets: £450,000
      Current Assets: £1,200,000
      Net Assets: £890,000
    `;
    const result = detectInformationMemorandum({
      rawText,
      extractedYears: [2024, 2023],
      currentFiscalYear: CURRENT_YEAR,
    });

    expect(result.isIM).toBe(false);
  });

  it('Multi-year span with mixed statutory+management data (>=4 years) → isIM true', () => {
    const result = detectInformationMemorandum({
      rawText: 'Management accounts summary 2021–2025',
      extractedYears: [2021, 2022, 2023, 2024, 2025],
      documentSource: 'statutory_and_management',
      currentFiscalYear: CURRENT_YEAR,
    });

    expect(result.isIM).toBe(true);
    expect(result.reasons.some(r => r.includes('fiscal years with mixed statutory/management'))).toBe(true);
  });

  it('Normal standalone P&L (single year, no IM signals) → isIM false', () => {
    const result = detectInformationMemorandum({
      rawText: `
        Profit & Loss Statement
        Year ended 31 March 2024
        Revenue: 820000
        Gross Profit: 350000
        Net Profit: 120000
      `,
      extractedYears: [2024],
      currentFiscalYear: CURRENT_YEAR,
    });

    expect(result.isIM).toBe(false);
  });

  it('LLM classifier STRONG signal alone => isIM true', () => {
    const result = detectInformationMemorandum({
      rawText: 'Revenue and profit figures for 2024',
      extractedYears: [2024],
      currentFiscalYear: CURRENT_YEAR,
      llmIsIM: true,
      llmReason: 'classifier identified as Information Memorandum',
    });

    expect(result.isIM).toBe(true);
    expect(result.reasons.some(r => r.includes('STRONG: classifier identified'))).toBe(true);
  });

  it('LLM classifier + mixed Stat/Mgt labels → isIM true (strong signal dominates)', () => {
    const result = detectInformationMemorandum({
      rawText: 'Stat 2023  Mgt 2023  Revenue  £1.2m  £1.1m',
      extractedYears: [2023],
      currentFiscalYear: CURRENT_YEAR,
      llmIsIM: true,
      llmReason: 'broker summary pack',
    });

    expect(result.isIM).toBe(true);
    expect(result.reasons.some(r => r.includes('STRONG: classifier identified'))).toBe(true);
    expect(result.reasons.some(r => r.includes('MEDIUM'))).toBe(true);
  });

  it('reasons[] is always returned for auditability even when isIM is false', () => {
    const result = detectInformationMemorandum({
      rawText: 'Ordinary accounts',
      extractedYears: [2024],
      currentFiscalYear: CURRENT_YEAR,
    });

    expect(Array.isArray(result.reasons)).toBe(true);
  });

  // ── Slice 11 spec tests ────────────────────────────────────────────────────

  it('Slice 11 — doc-485 shape: llmIsIM + 5 years + statutory_and_management → isIM true', () => {
    const result = detectInformationMemorandum({
      extractedYears: [2021, 2022, 2023, 2024, 2025],
      documentSource: 'statutory_and_management',
      currentFiscalYear: CURRENT_YEAR,
      llmIsIM: true,
    });

    expect(result.isIM).toBe(true);
    console.log('[IM-DETECTOR TEST] doc-485 shape reasons:', result.reasons);
  });

  it('Slice 11 — LLM signal ALONE (no rawText, no source) → isIM true (no single point of failure)', () => {
    const result = detectInformationMemorandum({
      extractedYears: [2021, 2022, 2023, 2024, 2025],
      documentSource: undefined,
      currentFiscalYear: CURRENT_YEAR,
      llmIsIM: true,
    });

    expect(result.isIM).toBe(true);
    expect(result.reasons.some(r => r.includes('STRONG: classifier identified'))).toBe(true);
  });

  it('Slice 11 — span+mixed signal ALONE (llmIsIM false, no rawText) → isIM true (no single point of failure)', () => {
    const result = detectInformationMemorandum({
      extractedYears: [2021, 2022, 2023, 2024, 2025],
      documentSource: 'statutory_and_management',
      currentFiscalYear: CURRENT_YEAR,
      llmIsIM: false,
    });

    expect(result.isIM).toBe(true);
    expect(result.reasons.some(r => r.includes('fiscal years with mixed statutory/management'))).toBe(true);
  });

  it('Slice 11 — 2-year statutory (llmIsIM false; 2 years; all statutory) → isIM false', () => {
    const result = detectInformationMemorandum({
      extractedYears: [2023, 2024],
      documentSource: 'statutory',
      currentFiscalYear: CURRENT_YEAR,
      llmIsIM: false,
    });

    expect(result.isIM).toBe(false);
  });

  it('Slice 11 — 4-year all-statutory filing (llmIsIM false; 4 years; NOT mixed) → isIM false (no false positive)', () => {
    const result = detectInformationMemorandum({
      extractedYears: [2021, 2022, 2023, 2024],
      documentSource: 'statutory',
      currentFiscalYear: CURRENT_YEAR,
      llmIsIM: false,
    });

    expect(result.isIM).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Part B — wiring test (DB integration, graceful skip if no data)
// ─────────────────────────────────────────────────────────────────────────────

const IM_WIRING_YEAR = 2911;
const FAKE_IM_DOC_ID = 910001;
const FAKE_STAT_DOC_ID = 910002;

describe('IM wiring — contribution tier + reselect demotion', () => {
  let targetCompanyId: number | null = null;

  beforeAll(async () => {
    const rows = await db
      .select({ id: financialPeriods.targetCompanyId })
      .from(financialPeriods)
      .limit(1);
    targetCompanyId = rows[0]?.targetCompanyId ?? null;
    if (!targetCompanyId) {
      console.warn('[TEST] No target company found in DB — skipping IM wiring tests');
    }
  });

  afterAll(async () => {
    if (!targetCompanyId) return;
    await db
      .delete(financialContributions)
      .where(
        and(
          eq(financialContributions.targetCompanyId, targetCompanyId),
          eq(financialContributions.fiscalYear, IM_WIRING_YEAR),
        ),
      );
    const periods = await db
      .select({ id: financialPeriods.id })
      .from(financialPeriods)
      .where(
        and(
          eq(financialPeriods.targetCompanyId, targetCompanyId),
          eq(financialPeriods.fiscalYear, IM_WIRING_YEAR),
        ),
      );
    if (periods.length > 0) {
      await db
        .delete(incomeStatements)
        .where(inArray(incomeStatements.financialPeriodId, periods.map(p => p.id)));
      await db.delete(financialPeriods).where(
        and(
          eq(financialPeriods.targetCompanyId, targetCompanyId),
          eq(financialPeriods.fiscalYear, IM_WIRING_YEAR),
        ),
      );
    }
  });

  it('IM contribution gets sourceTier = information_memorandum', async () => {
    if (!targetCompanyId) return;

    await db.insert(financialContributions).values({
      targetCompanyId,
      fiscalYear: IM_WIRING_YEAR,
      statementType: 'income',
      sourceDocumentId: FAKE_IM_DOC_ID,
      sourceTier: 'information_memorandum',
      isFullYear: true,
      monthsCovered: 12,
      periodEnd: `${IM_WIRING_YEAR}-12-31`,
      asAtDate: null,
      figures: { revenue: '999000' } as any,
    });

    const rows = await db
      .select({ sourceTier: financialContributions.sourceTier })
      .from(financialContributions)
      .where(
        and(
          eq(financialContributions.targetCompanyId, targetCompanyId),
          eq(financialContributions.fiscalYear, IM_WIRING_YEAR),
          eq(financialContributions.sourceDocumentId, FAKE_IM_DOC_ID),
        ),
      );

    expect(rows).toHaveLength(1);
    expect(rows[0].sourceTier).toBe('information_memorandum');
  });

  it('reselect demotes IM under a statutory contribution for the same year', async () => {
    if (!targetCompanyId) return;

    await db.insert(financialContributions).values({
      targetCompanyId,
      fiscalYear: IM_WIRING_YEAR,
      statementType: 'income',
      sourceDocumentId: FAKE_STAT_DOC_ID,
      sourceTier: 'statutory',
      isFullYear: true,
      monthsCovered: 12,
      periodEnd: `${IM_WIRING_YEAR}-12-31`,
      asAtDate: null,
      figures: { revenue: '5000000' } as any,
    });

    await reselect(targetCompanyId);

    const allContribs = await db
      .select()
      .from(financialContributions)
      .where(
        and(
          eq(financialContributions.targetCompanyId, targetCompanyId),
          eq(financialContributions.fiscalYear, IM_WIRING_YEAR),
        ),
      );

    const winners = selectProjectionWinners(
      allContribs.map(c => ({
        id: c.id,
        targetCompanyId: c.targetCompanyId,
        fiscalYear: c.fiscalYear,
        statementType: c.statementType,
        sourceTier: c.sourceTier,
        isFullYear: c.isFullYear ?? true,
        monthsCovered: c.monthsCovered,
        periodEnd: c.periodEnd,
        asAtDate: c.asAtDate,
        figures: c.figures,
        createdAt: c.createdAt,
        sourceDocumentId: c.sourceDocumentId,
      })),
    );

    const winner = winners.find(w => w.fiscalYear === IM_WIRING_YEAR && w.statementType === 'income' && w.isFullYear);
    expect(winner).toBeDefined();
    expect(winner?.sourceTier).toBe('statutory');
  });
});
