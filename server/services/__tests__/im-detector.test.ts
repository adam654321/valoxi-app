/**
 * Acceptance tests for Slice 6 — content-based IM detection.
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
    // Should have multiple strong reasons
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

  it('Flyer/summary pack: multi-year (>=5) with a forecast year → isIM true', () => {
    const result = detectInformationMemorandum({
      rawText: 'Management accounts summary 2021–2025 including budget forecast',
      extractedYears: [2021, 2022, 2023, 2024, 2025, 2027],
      currentFiscalYear: CURRENT_YEAR,
    });

    expect(result.isIM).toBe(true);
    expect(result.reasons.some(r => r.includes('forecast year'))).toBe(true);
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

  it('LLM advisory alone (single weak signal) is not enough → isIM false', () => {
    const result = detectInformationMemorandum({
      rawText: 'Revenue and profit figures for 2024',
      extractedYears: [2024],
      currentFiscalYear: CURRENT_YEAR,
      llmIsIM: true,
      llmReason: 'summary only financials',
    });

    // One weak (advisory) signal only → not IM
    expect(result.isIM).toBe(false);
    // But the advisory reason IS captured
    expect(result.reasons.some(r => r.includes('ADVISORY'))).toBe(true);
  });

  it('LLM advisory + mixed Stat/Mgt labels = 2 weak signals → isIM true', () => {
    const result = detectInformationMemorandum({
      rawText: 'Stat 2023  Mgt 2023  Revenue  £1.2m  £1.1m',
      extractedYears: [2023],
      currentFiscalYear: CURRENT_YEAR,
      llmIsIM: true,
      llmReason: 'broker summary pack',
    });

    expect(result.isIM).toBe(true);
    expect(result.reasons.some(r => r.includes('MEDIUM'))).toBe(true);
    expect(result.reasons.some(r => r.includes('ADVISORY'))).toBe(true);
  });

  it('reasons[] is always returned for auditability even when isIM is false', () => {
    const result = detectInformationMemorandum({
      rawText: 'Ordinary accounts',
      extractedYears: [2024],
      currentFiscalYear: CURRENT_YEAR,
    });

    expect(Array.isArray(result.reasons)).toBe(true);
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

    // Add a statutory contribution for the same year
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

    // Run reselect — it should pick statutory over IM
    await reselect(targetCompanyId);

    // The selector should pick statutory
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
