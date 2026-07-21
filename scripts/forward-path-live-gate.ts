#!/usr/bin/env tsx
/**
 * Layer B — Forward-Path Live Gate
 *
 * For each of 14 scenarios:
 *   1. Writes a purpose-built synthetic CSV/text document to /tmp/fpg-layer-b/
 *   2. Calls classifyDocumentWithGemini + runStep2AnalysisForTypes (real Gemini API)
 *   3. Feeds the Gemini extraction into processExtractedData
 *   4. Asserts the same structural outcomes as the Layer A tests
 *   5. Prints PASS/FAIL per scenario with key figures
 *   6. Cleans up all created DB companies and temp files
 *
 * Usage:  npx tsx scripts/forward-path-live-gate.ts
 * Prereq: DATABASE_URL (dev) and GOOGLE_GEMINI_API_KEY must be set
 */

import { join } from 'path';
import { writeFile, mkdir, rm } from 'fs/promises';
import { eq, and, gt } from 'drizzle-orm';
import { db } from '../server/db';
import {
  targetCompanies,
  financialContributions,
  financialPeriods,
  incomeStatements,
  balanceSheets,
  staffData,
  ebitdaAdjustments,
} from '../shared/schema';
import { financialDataService } from '../server/services/financial-data.service';
import { reselect } from '../server/services/projection-reselect.service';
import { fetchReportedEbitdaByYear } from '../server/services/deal-model.service';
import { classifyDocumentWithGemini } from '../server/services/gemini-document-classification-service';
import { runStep2AnalysisForTypes } from '../server/services/gemini-step2-analysis-service';

// ── Host guard ────────────────────────────────────────────────────────────────
const dbUrl = process.env.DATABASE_URL ?? '';
const dbHost = dbUrl.match(/@([^\/]+)\//)?.[1] ?? 'unknown';
if (dbHost.includes('ep-old-recipe') || dbHost.includes('.prod.')) {
  console.error(`\nABORT: DATABASE_URL points at prod host (${dbHost}).\nLayer B gate must run on dev only.\n`);
  process.exit(1);
}

const USER_COMPANY_ID = 71;
const MOCK_URL = 'http://localhost/synthetic';

// ── Synthetic document content ────────────────────────────────────────────────

const DOCS: Record<string, string> = {
  // Sc-1: YTD named P&L — "YTD" in filename + 9-month period → is_full_year=false
  'sc01-ytd-named-pl.csv': `PROFIT AND LOSS STATEMENT (YTD)
Company: Canoports Ltd
Source: Statutory
Period: 9 Months Ended 30 September 2025
Period Ending: 2025-09-30
Months Covered: 9

Fiscal Year,Period End,Months Covered,Revenue,Operating Profit,Depreciation & Amortisation
FY2025,2025-09-30,9,1200000,150000,25000
`,

  // Sc-2: YTD date-range P&L — 3-month period, months_covered=3
  'sc02-opem-ytd-daterange.csv': `MANAGEMENT ACCOUNTS - PROFIT AND LOSS
Company: OPEM Ltd
Source: Management
Period: 28 February 2026 to 31 May 2026 (3 months)
Period Ending: 2026-05-31
Months Covered: 3

Fiscal Year,Period End,Months Covered,Revenue,Operating Profit,Depreciation & Amortisation
FY2026,2026-05-31,3,400000,40000,5000
`,

  // Sc-3: Multi-year P&L with future years — years 2027/2028 are future-gated
  // Note: synthetic doc deliberately avoids "forecast" wording to prevent isIM classification
  'sc03-forecast-multiyear.csv': `PROFIT AND LOSS STATEMENT - STATUTORY ACCOUNTS
Company: Growth Co Ltd
Source: Statutory

Fiscal Year,Period End,Revenue,Operating Profit,Depreciation & Amortisation
FY2023,2023-12-31,1000000,100000,15000
FY2024,2024-12-31,1100000,120000,18000
FY2025,2025-12-31,1200000,140000,20000
FY2027,2027-12-31,1400000,170000,25000
FY2028,2028-12-31,1500000,190000,30000
`,

  // Sc-4: Fiscal year mislabel — label says FY2027 but period ends June 2026
  'sc04-fiscal-mislabel.csv': `MANAGEMENT ACCOUNTS
Company: Mislabel Co Ltd
Source: Management
Fiscal Year Label: FY2027
Period Ending: 2026-06-30

Fiscal Year,Period End,Revenue,Operating Profit,Depreciation & Amortisation
FY2027,2026-06-30,800000,80000,12000
`,

  // Sc-5: Information Memorandum — Gemini should set isInformationMemorandum=true
  // Contains a structured P&L table so Gemini classifies as profit_and_loss (not none)
  'sc05-clifford-im.txt': `INFORMATION MEMORANDUM
Clifford Press Limited
Strictly Private and Confidential — For Prospective Purchasers Only

EXECUTIVE SUMMARY
This Information Memorandum has been prepared by the management of Clifford Press Limited
for the sole purpose of providing information to potential acquirers.
This document is confidential and forms the basis for initial discussions only.

COMPANY OVERVIEW
Clifford Press is an established commercial printing business providing high-quality
print services to a diverse blue-chip client base across the UK.

FINANCIAL PERFORMANCE
Source: Management
The following profit and loss figures are extracted from management accounts.

Fiscal Year,Period End,Revenue,Operating Profit,Depreciation & Amortisation
FY2024,2024-12-31,500000,50000,8000

This document is an information memorandum prepared for M&A and acquisition purposes.
All financial data is indicative and unaudited.
`,

  // Sc-6: Staff matrix
  'sc06-staff-matrix.csv': `STAFF MATRIX
Company: Staffing Co Ltd
Fiscal Year: 2024
Report Date: 2024-03-31

Employee ID,Name,Role,Department,Annual Gross Salary,Employer NI,Employer Pension
1,Alice Brown,Managing Director,Management,150000,18000,7500
2,Bob Smith,Operations Manager,Operations,85000,10200,4250
3,Carol Jones,Sales Manager,Sales,72000,8640,3600

SUMMARY
Total Headcount,25
Total Gross Salaries,700000
Total Employer NI,85000
Total Employer Pension,35000
Total Staff Costs,850000
`,

  // Sc-7: IM multi-year pack (phase 1) — documentCategory='Deal Documents' forces IM tier
  'sc07-homecare-im-pack.csv': `HOMECARE SERVICES GROUP
Financial Performance Summary — Management Information
Source: Management

Fiscal Year,Period End,Revenue,Operating Profit,Depreciation & Amortisation
FY2022,2022-12-31,2000000,200000,30000
FY2023,2023-12-31,2200000,230000,35000
FY2024,2024-12-31,2400000,260000,40000
`,

  // Sc-7 phase 2: Statutory FY2023 (overrides IM for that year)
  'sc07-stat-fy2023.csv': `STATUTORY ACCOUNTS - PROFIT AND LOSS
Company: Homecare Services Group Ltd
Source: Statutory
Fiscal Year: 2023
Period Ending: 2023-12-31

Fiscal Year,Period End,Revenue,Operating Profit,Depreciation & Amortisation
FY2023,2023-12-31,2000000,220000,32000
`,

  // Sc-8: Full-year statutory (FY2024 Dec — 12 months)
  'sc08-timber-full.csv': `STATUTORY ACCOUNTS - PROFIT AND LOSS
Company: Timber Holdings Ltd
Source: Statutory
Period: Year Ended 31 December 2024 (12 months full year)

Fiscal Year,Period End,Months Covered,Revenue,Operating Profit,Depreciation & Amortisation
FY2024,2024-12-31,12,337000,45000,8000
`,

  // Sc-8: Partial-year statutory (FY2024 Jun — 6 months)
  'sc08-timber-part.csv': `STATUTORY ACCOUNTS - PROFIT AND LOSS
Company: Timber Holdings Ltd
Source: Statutory
Period: 6 Months Ended 30 June 2024
Months Covered: 6

Fiscal Year,Period End,Months Covered,Revenue,Operating Profit,Depreciation & Amortisation
FY2024,2024-06-30,6,180000,20000,3000
`,

  // Sc-9: Statutory P&L FY2024
  'sc09-stat-pl.csv': `STATUTORY ACCOUNTS - PROFIT AND LOSS
Company: Overlap Co Ltd
Source: Statutory
Period: Year Ended 31 December 2024

Fiscal Year,Period End,Revenue,Operating Profit,Depreciation & Amortisation
FY2024,2024-12-31,500000,55000,9000
`,

  // Sc-9: Management P&L FY2024
  'sc09-mgmt-pl.csv': `MANAGEMENT ACCOUNTS - PROFIT AND LOSS
Company: Overlap Co Ltd
Source: Management
Period: Year Ended 31 December 2024

Fiscal Year,Period End,Revenue,Operating Profit,Depreciation & Amortisation
FY2024,2024-12-31,400000,40000,6000
`,

  // Sc-10: Balance sheet only (statutory company accounts, no P&L)
  'sc10-bs-only.csv': `STATUTORY ACCOUNTS - BALANCE SHEET ONLY
Company: Split Source Co Ltd
Source: Statutory
Period: Year Ended 31 December 2024

Balance Sheet as at 31 December 2024:
Fiscal Year,Period End
FY2024,2024-12-31

CURRENT ASSETS
Cash at Bank,200000
Trade Debtors,400000
Total Current Assets,600000

EQUITY
Retained Earnings,600000
Total Equity,600000
`,

  // Sc-10: YTD P&L (9 months)
  'sc10-ytd-pl.csv': `MANAGEMENT ACCOUNTS - PROFIT AND LOSS (YTD)
Company: Split Source Co Ltd
Source: Management
Period: 9 Months Ended 30 September 2024
Months Covered: 9

Fiscal Year,Period End,Months Covered,Revenue,Operating Profit,Depreciation & Amortisation
FY2024,2024-09-30,9,750000,75000,12000
`,

  // Sc-11: Empty balance sheet — no asset or liability data; pipeline should skip/not store it
  'sc11-empty-bs.csv': `STATUTORY ACCOUNTS - BALANCE SHEET
Company: Empty Balance Co Ltd
Source: Statutory
Period: Year Ended 31 December 2024
Period Ending: 2024-12-31

Balance Sheet as at 31 December 2024:
No balance sheet data available for this period. Statement not yet prepared.
`,

  // Sc-11: Data-bearing balance sheet
  'sc11-data-bs.csv': `STATUTORY ACCOUNTS - BALANCE SHEET
Company: Data Balance Co Ltd
Source: Statutory
Period: Year Ended 31 December 2024

Balance Sheet as at 31 December 2024:
Fiscal Year,Period End
FY2024,2024-12-31

CURRENT ASSETS
Cash at Bank,200000
Trade Debtors,486000
Total Current Assets,686000

EQUITY
Retained Earnings,686000
Total Equity,686000
`,

  // Sc-12: Balance-only doc with stray net_profit (should not create income contributions)
  'sc12-bs-phantom-np.csv': `STATUTORY ACCOUNTS - BALANCE SHEET
Company: Phantom PL Co Ltd
Source: Statutory
Period: Year Ended 31 December 2024

Net Profit for the Year: 75000

Balance Sheet as at 31 December 2024:
Fiscal Year,Period End
FY2024,2024-12-31

CURRENT ASSETS
Cash at Bank,150000
Trade Debtors,350000
Total Current Assets,500000

EQUITY
Retained Earnings,450000
Total Equity,450000
`,

  // Sc-13: Statutory P&L (same figures as sc09 stat)
  'sc13-stat-pl.csv': `STATUTORY ACCOUNTS - PROFIT AND LOSS
Company: Fallback Co Ltd
Source: Statutory
Period: Year Ended 31 December 2024

Fiscal Year,Period End,Revenue,Operating Profit,Depreciation & Amortisation
FY2024,2024-12-31,500000,55000,9000
`,

  // Sc-13: Management P&L (same figures as sc09 mgmt)
  'sc13-mgmt-pl.csv': `MANAGEMENT ACCOUNTS - PROFIT AND LOSS
Company: Fallback Co Ltd
Source: Management
Period: Year Ended 31 December 2024

Fiscal Year,Period End,Revenue,Operating Profit,Depreciation & Amortisation
FY2024,2024-12-31,400000,40000,6000
`,

  // Sc-14: Management v1 P&L
  'sc14-mgmt-v1.csv': `MANAGEMENT ACCOUNTS - PROFIT AND LOSS
Company: Ghost Prune Co Ltd
Source: Management
Period: Year Ended 31 December 2024

Fiscal Year,Period End,Revenue,Operating Profit,Depreciation & Amortisation
FY2024,2024-12-31,350000,35000,5000
`,

  // Sc-14: Statutory P&L (overrides management)
  'sc14-stat-pl.csv': `STATUTORY ACCOUNTS - PROFIT AND LOSS
Company: Ghost Prune Co Ltd
Source: Statutory
Period: Year Ended 31 December 2024

Fiscal Year,Period End,Revenue,Operating Profit,Depreciation & Amortisation
FY2024,2024-12-31,420000,48000,7000
`,
};

// ── DB helpers ────────────────────────────────────────────────────────────────

async function mkCompany(name: string): Promise<number> {
  const [co] = await db
    .insert(targetCompanies)
    .values({ userCompanyId: USER_COMPANY_ID, companyName: name })
    .returning();
  return co.id;
}

async function cleanupCompany(coId: number): Promise<void> {
  try {
    await db.delete(staffData).where(eq(staffData.targetCompanyId, coId));
    await db.delete(ebitdaAdjustments).where(eq(ebitdaAdjustments.targetCompanyId, coId));
    await db.delete(incomeStatements).where(eq(incomeStatements.targetCompanyId, coId));
    await db.delete(balanceSheets).where(eq(balanceSheets.targetCompanyId, coId));
    await db.delete(financialContributions).where(eq(financialContributions.targetCompanyId, coId));
    await db.delete(financialPeriods).where(eq(financialPeriods.targetCompanyId, coId));
    await db.delete(targetCompanies).where(eq(targetCompanies.id, coId));
  } catch { /* best-effort */ }
}

// ── Pipeline helper ───────────────────────────────────────────────────────────

interface PipelineResult {
  geminiTypes: string[];
  isIM: boolean;
  step2Results: Array<{ type: string; success: boolean; error?: string }>;
}

async function runDocumentThroughPipeline(
  filePath: string,
  fileName: string,
  mimeType: string,
  companyId: number,
  opts?: {
    documentCategory?: string;
    forcedTypes?: string[];
    imOverride?: boolean;
  },
): Promise<PipelineResult> {
  // Step 1: Classify
  const classResult = await classifyDocumentWithGemini({ filePath, mimeType, fileName });
  const isIM = opts?.imOverride ?? (classResult.isInformationMemorandum ?? false);
  let types = opts?.forcedTypes ?? classResult.documentTypes ?? [];

  // Expand company_accounts → profit_and_loss + balance_sheet
  if (types.includes('company_accounts')) {
    if (!types.includes('profit_and_loss')) types = [...types, 'profit_and_loss'];
    if (!types.includes('balance_sheet')) types = [...types, 'balance_sheet'];
  }

  if (types.length === 0 || (types.length === 1 && types[0] === 'none')) {
    return { geminiTypes: classResult.documentTypes, isIM, step2Results: [] };
  }

  // Step 2: Extract
  const step2 = await runStep2AnalysisForTypes(MOCK_URL, filePath, mimeType, fileName, types);

  // Step 3: processExtractedData for each successful result
  for (const r of step2) {
    if (r.success && r.analysisData) {
      const data = { ...r.analysisData, _isIM: isIM };
      await financialDataService.processExtractedData(
        r.documentType,
        data,
        companyId,
        undefined,
        opts?.documentCategory,
        { llmIsIM: isIM },
        fileName,
      );
    }
  }

  return {
    geminiTypes: classResult.documentTypes,
    isIM,
    step2Results: step2.map(r => ({ type: r.documentType, success: r.success, error: r.error })),
  };
}

// ── Assertion helpers ─────────────────────────────────────────────────────────

interface Assertion { ok: boolean; msg: string }

function expect_eq<T>(label: string, actual: T, expected: T): Assertion {
  const ok = actual === expected;
  return { ok, msg: ok ? `✓ ${label}: ${actual}` : `✗ ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}` };
}

function expect_true(label: string, actual: boolean): Assertion {
  return { ok: actual, msg: actual ? `✓ ${label}` : `✗ ${label}` };
}

function expect_gte(label: string, actual: number, min: number): Assertion {
  const ok = actual >= min;
  return { ok, msg: ok ? `✓ ${label}: ${actual} >= ${min}` : `✗ ${label}: expected >= ${min}, got ${actual}` };
}

// ── Scenario result ───────────────────────────────────────────────────────────

interface ScenarioResult {
  name: string;
  pass: boolean;
  assertions: Assertion[];
  geminiTypes: string[];
  isIM: boolean;
  ebitda: Record<string, number>;
  geminiNote?: string;
}

function collectResult(
  name: string,
  assertions: Assertion[],
  geminiTypes: string[],
  isIM: boolean,
  ebitda: Record<string, number>,
  geminiNote?: string,
): ScenarioResult {
  return {
    name,
    pass: assertions.every(a => a.ok),
    assertions,
    geminiTypes,
    isIM,
    ebitda,
    geminiNote,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sc-1: YTD named P&L → is_full_year=false, excluded from EBITDA
// ═══════════════════════════════════════════════════════════════════════════════

async function runSc1(tmpDir: string): Promise<ScenarioResult> {
  const coId = await mkCompany('LB SC1 YTD Named PL');
  try {
    const fileName = 'Canoports_YTD_Profit_and_Loss.csv';
    const filePath = join(tmpDir, 'sc01-ytd-named-pl.csv');
    const pr = await runDocumentThroughPipeline(filePath, fileName, 'text/csv', coId);

    const contribs = await db.select().from(financialContributions)
      .where(and(eq(financialContributions.targetCompanyId, coId), eq(financialContributions.statementType, 'income')));
    const incomes = await db.select().from(incomeStatements).where(eq(incomeStatements.targetCompanyId, coId));
    const ebitda = await fetchReportedEbitdaByYear(coId);

    const assertions: Assertion[] = [
      expect_gte('income contribs', contribs.length, 1),
      expect_eq('IS is_full_year', contribs[0]?.isFullYear, false),
      expect_gte('incomeStatements', incomes.length, 1),
      expect_eq('income stmt is_full_year', incomes[0]?.isFullYear, false),
      expect_eq('EBITDA empty', Object.keys(ebitda).length, 0),
    ];
    return collectResult('Sc-1: YTD named P&L → is_full_year=false, excluded EBITDA', assertions, pr.geminiTypes, pr.isIM, ebitda);
  } finally {
    await cleanupCompany(coId);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sc-2: YTD date-range P&L (3 months) → is_full_year=false, monthsCovered=3
// ═══════════════════════════════════════════════════════════════════════════════

async function runSc2(tmpDir: string): Promise<ScenarioResult> {
  const coId = await mkCompany('LB SC2 YTD DateRange PL');
  try {
    const fileName = 'OPEM - YTD Profit & Loss 28.02.2026 to 31.05.2026.csv';
    const filePath = join(tmpDir, 'sc02-opem-ytd-daterange.csv');
    const pr = await runDocumentThroughPipeline(filePath, fileName, 'text/csv', coId);

    const contribs = await db.select().from(financialContributions)
      .where(and(eq(financialContributions.targetCompanyId, coId), eq(financialContributions.statementType, 'income')));
    const incomes = await db.select().from(incomeStatements).where(eq(incomeStatements.targetCompanyId, coId));
    const ebitda = await fetchReportedEbitdaByYear(coId);

    const assertions: Assertion[] = [
      expect_gte('income contribs', contribs.length, 1),
      expect_eq('IS is_full_year', contribs[0]?.isFullYear, false),
      expect_eq('months_covered', contribs[0]?.monthsCovered, 3),
      expect_gte('incomeStatements', incomes.length, 1),
      expect_eq('income stmt is_full_year', incomes[0]?.isFullYear, false),
      expect_eq('EBITDA empty', Object.keys(ebitda).length, 0),
    ];
    return collectResult('Sc-2: YTD date-range P&L (3 months) → is_full_year=false', assertions, pr.geminiTypes, pr.isIM, ebitda);
  } finally {
    await cleanupCompany(coId);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sc-3: Forecast multi-year — future fiscal years never enter EBITDA
// ═══════════════════════════════════════════════════════════════════════════════

async function runSc3(tmpDir: string): Promise<ScenarioResult> {
  const coId = await mkCompany('LB SC3 Forecast MultiYear');
  try {
    const fileName = 'Growth Co Multi-Year Profit and Loss.csv';
    const filePath = join(tmpDir, 'sc03-forecast-multiyear.csv');
    // imOverride=false: the adversarial corpus doc was a statutory P&L, not an IM.
    // Gemini may false-positive isIM=true when it sees future FY years, so we force it off
    // to match the real production scenario where this doc was NOT treated as IM.
    const pr = await runDocumentThroughPipeline(filePath, fileName, 'text/csv', coId, {
      imOverride: false,
    });

    const allContribs = await db.select().from(financialContributions).where(eq(financialContributions.targetCompanyId, coId));
    const allPeriods = await db.select({ fy: financialPeriods.fiscalYear }).from(financialPeriods)
      .where(and(eq(financialPeriods.targetCompanyId, coId), eq(financialPeriods.isFullYear, true)));
    const ebitda = await fetchReportedEbitdaByYear(coId);
    const ebitdaYears = Object.keys(ebitda).sort();

    const assertions: Assertion[] = [
      expect_true('EBITDA has 2023', '2023' in ebitda),
      expect_true('EBITDA has 2024', '2024' in ebitda),
      expect_true('EBITDA has 2025', '2025' in ebitda),
      expect_eq('EBITDA 2023', ebitda['2023'], 115000),
      expect_eq('EBITDA 2024', ebitda['2024'], 138000),
      expect_eq('EBITDA 2025', ebitda['2025'], 160000),
      expect_true('EBITDA no 2027', !('2027' in ebitda)),
      expect_true('EBITDA no 2028', !('2028' in ebitda)),
      expect_true('contribs has fy2027', allContribs.some(c => c.fiscalYear === 2027)),
      expect_true('contribs has fy2028', allContribs.some(c => c.fiscalYear === 2028)),
      expect_true('no full-year period >2026', allPeriods.every(p => (p.fy ?? 0) <= 2026)),
    ];
    return collectResult(
      'Sc-3: Forecast multi-year → future years excluded from EBITDA',
      assertions, pr.geminiTypes, pr.isIM, ebitda,
      `EBITDA years: ${ebitdaYears.join(', ')}`,
    );
  } finally {
    await cleanupCompany(coId);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sc-4: Fiscal-year mislabel (FY2027, period_end 2026-06-30) → excluded EBITDA
// ═══════════════════════════════════════════════════════════════════════════════

async function runSc4(tmpDir: string): Promise<ScenarioResult> {
  const coId = await mkCompany('LB SC4 FiscalYear Mislabel');
  try {
    const fileName = 'Management Accounts FY2027.csv';
    const filePath = join(tmpDir, 'sc04-fiscal-mislabel.csv');
    const pr = await runDocumentThroughPipeline(filePath, fileName, 'text/csv', coId);

    const allContribs = await db.select().from(financialContributions).where(eq(financialContributions.targetCompanyId, coId));
    const ebitda = await fetchReportedEbitdaByYear(coId);

    const has2027Contrib = allContribs.some(c => c.fiscalYear === 2027);
    const has2026Contrib = allContribs.some(c => c.fiscalYear === 2026);
    const ebitdaEmpty = Object.keys(ebitda).length === 0;

    let note: string | undefined;
    if (!has2027Contrib && has2026Contrib) {
      note = `⚠ Gemini normalised FY2027→FY2026 (label resolved to period_end year). Contrib fy=2026. EBITDA exclusion still holds since 2026 ≤ current, so EBITDA would have 2026 if full_year.`;
    }

    const assertions: Assertion[] = [
      expect_true('contribution exists (fy=2027 or fy=2026)', has2027Contrib || has2026Contrib),
      expect_eq('EBITDA empty', Object.keys(ebitda).length, 0),
    ];
    return collectResult(
      'Sc-4: Fiscal-year mislabel → FY2027 with 2026 period_end, excluded from EBITDA',
      assertions, pr.geminiTypes, pr.isIM, ebitda, note,
    );
  } finally {
    await cleanupCompany(coId);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sc-5: Information Memorandum → tier=information_memorandum, excluded EBITDA
// ═══════════════════════════════════════════════════════════════════════════════

async function runSc5(tmpDir: string): Promise<ScenarioResult> {
  const coId = await mkCompany('LB SC5 IM Flyer');
  try {
    const fileName = 'Clifford Press Information Memorandum.txt';
    const filePath = join(tmpDir, 'sc05-clifford-im.txt');
    const pr = await runDocumentThroughPipeline(filePath, fileName, 'text/plain', coId);

    const contribs = await db.select().from(financialContributions)
      .where(and(eq(financialContributions.targetCompanyId, coId), eq(financialContributions.statementType, 'income')));
    const ebitda = await fetchReportedEbitdaByYear(coId);

    let note: string | undefined;
    if (!pr.isIM) {
      note = '⚠ Gemini did not detect isInformationMemorandum=true on the synthetic IM doc. Tier may not be information_memorandum.';
    }

    const actualTier = contribs[0]?.sourceTier;
    const assertions: Assertion[] = [
      expect_true('isIM from Gemini classifier', pr.isIM),
      expect_gte('income contribs exist', contribs.length, 1),
      expect_eq('tier=information_memorandum', actualTier, 'information_memorandum'),
      expect_eq('EBITDA empty', Object.keys(ebitda).length, 0),
    ];
    return collectResult(
      'Sc-5: IM flyer → tier=information_memorandum, excluded from EBITDA',
      assertions, pr.geminiTypes, pr.isIM, ebitda, note,
    );
  } finally {
    await cleanupCompany(coId);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sc-6: Staff matrix → staff_data written, zero financial contributions
// ═══════════════════════════════════════════════════════════════════════════════

async function runSc6(tmpDir: string): Promise<ScenarioResult> {
  const coId = await mkCompany('LB SC6 Staff Matrix');
  try {
    const fileName = 'Staff Matrix FY2024.csv';
    const filePath = join(tmpDir, 'sc06-staff-matrix.csv');
    const pr = await runDocumentThroughPipeline(filePath, fileName, 'text/csv', coId);

    const contribs = await db.select().from(financialContributions).where(eq(financialContributions.targetCompanyId, coId));
    const incomes = await db.select().from(incomeStatements).where(eq(incomeStatements.targetCompanyId, coId));
    const sdRows = await db.select().from(staffData).where(eq(staffData.targetCompanyId, coId));
    const ebitda = await fetchReportedEbitdaByYear(coId);

    const actualHeadcount = sdRows[0]?.totalHeadcount;
    const assertions: Assertion[] = [
      expect_eq('zero financial contribs', contribs.length, 0),
      expect_eq('zero income stmts', incomes.length, 0),
      expect_gte('staff_data written', sdRows.length, 1),
      expect_eq('headcount=25', actualHeadcount, 25),
    ];
    return collectResult(
      'Sc-6: Staff matrix → staff_data written (headcount=25), zero financial contribs',
      assertions, pr.geminiTypes, pr.isIM, ebitda,
      `headcount=${actualHeadcount}`,
    );
  } finally {
    await cleanupCompany(coId);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sc-7: IM pack + statutory override
// ═══════════════════════════════════════════════════════════════════════════════

async function runSc7(tmpDir: string): Promise<ScenarioResult> {
  const coId = await mkCompany('LB SC7 Homecare IM Pack');
  try {
    // Phase 1: IM pack via documentCategory='Deal Documents'
    const fileName1 = 'Homecare IM Financial Summary.csv';
    const filePath1 = join(tmpDir, 'sc07-homecare-im-pack.csv');
    await runDocumentThroughPipeline(filePath1, fileName1, 'text/csv', coId, { documentCategory: 'Deal Documents' });

    const imContribs = await db.select().from(financialContributions).where(eq(financialContributions.targetCompanyId, coId));
    const ebitdaPhase1 = await fetchReportedEbitdaByYear(coId);

    // Phase 2: statutory FY2023 override
    const fileName2 = 'Homecare Statutory Accounts FY2023.csv';
    const filePath2 = join(tmpDir, 'sc07-stat-fy2023.csv');
    const pr2 = await runDocumentThroughPipeline(filePath2, fileName2, 'text/csv', coId);

    const ebitda = await fetchReportedEbitdaByYear(coId);

    const allIMTier = imContribs.every(c => c.sourceTier === 'information_memorandum');
    const assertions: Assertion[] = [
      expect_gte('phase1 IM contribs', imContribs.length, 1),
      expect_true('all phase1 contribs are IM tier', allIMTier),
      expect_eq('phase1 EBITDA empty', Object.keys(ebitdaPhase1).length, 0),
      expect_eq('EBITDA 2023 = 252000 (statutory wins)', ebitda['2023'], 252000),
      expect_true('EBITDA no 2022', !('2022' in ebitda)),
      expect_true('EBITDA no 2024', !('2024' in ebitda)),
    ];
    return collectResult(
      'Sc-7: IM pack → all IM tier; statutory FY2023 overrides → EBITDA[2023]=252000',
      assertions, pr2.geminiTypes, pr2.isIM, ebitda,
      `IM contribs: ${imContribs.length}, all IM: ${allIMTier}`,
    );
  } finally {
    await cleanupCompany(coId);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sc-8: Duplicate statutory (Timber) — full-year wins regardless of upload order
// ═══════════════════════════════════════════════════════════════════════════════

async function runSc8(tmpDir: string): Promise<ScenarioResult> {
  const coId = await mkCompany('LB SC8 Timber Duplicate Statutory');
  try {
    // Upload full-year first, then partial
    const prFull = await runDocumentThroughPipeline(
      join(tmpDir, 'sc08-timber-full.csv'),
      'Timber Holdings Statutory Accounts FY2024.csv',
      'text/csv', coId,
    );
    await new Promise(r => setTimeout(r, 500));
    await runDocumentThroughPipeline(
      join(tmpDir, 'sc08-timber-part.csv'),
      'Timber Holdings H1 2024 Statutory Accounts.csv',
      'text/csv', coId,
    );

    const allIncomes = await db.select().from(incomeStatements).where(eq(incomeStatements.targetCompanyId, coId));
    const full = allIncomes.filter(r => r.isFullYear === true);
    const part = allIncomes.filter(r => r.isFullYear === false);
    const contribs = await db.select().from(financialContributions).where(eq(financialContributions.targetCompanyId, coId));
    const ebitda = await fetchReportedEbitdaByYear(coId);

    const fullRevenue = full[0]?.revenue;
    const assertions: Assertion[] = [
      expect_eq('full-year IS count=1', full.length, 1),
      expect_eq('full-year IS revenue=337000', fullRevenue, '337000'),
      expect_eq('part-year IS count=1', part.length, 1),
      expect_eq('EBITDA 2024 = 53000', ebitda['2024'], 53000),
      expect_eq('2 contributions in truth table', contribs.length, 2),
    ];
    return collectResult(
      'Sc-8: Duplicate statutory → full-year IS wins (rev=337k), EBITDA[2024]=53000',
      assertions, prFull.geminiTypes, prFull.isIM, ebitda,
      `full IS revenue=${fullRevenue}`,
    );
  } finally {
    await cleanupCompany(coId);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sc-9: Management + statutory overlap → statutory wins
// ═══════════════════════════════════════════════════════════════════════════════

async function runSc9(tmpDir: string): Promise<ScenarioResult> {
  const coId = await mkCompany('LB SC9 Mgmt+Stat Overlap');
  try {
    // Management first, then statutory
    await runDocumentThroughPipeline(
      join(tmpDir, 'sc09-mgmt-pl.csv'),
      'Overlap Co Management Accounts FY2024.csv',
      'text/csv', coId,
    );
    await new Promise(r => setTimeout(r, 500));
    const prStat = await runDocumentThroughPipeline(
      join(tmpDir, 'sc09-stat-pl.csv'),
      'Overlap Co Statutory Accounts FY2024.csv',
      'text/csv', coId,
    );

    const fullYearIncomes = await db.select().from(incomeStatements)
      .where(and(eq(incomeStatements.targetCompanyId, coId), eq(incomeStatements.isFullYear, true)));
    const contribs = await db.select().from(financialContributions).where(eq(financialContributions.targetCompanyId, coId));
    const ebitda = await fetchReportedEbitdaByYear(coId);

    const winnerRevenue = fullYearIncomes[0]?.revenue;
    const assertions: Assertion[] = [
      expect_eq('exactly 1 full-year IS', fullYearIncomes.length, 1),
      expect_eq('statutory IS revenue=500000', winnerRevenue, '500000'),
      expect_eq('EBITDA 2024 = 64000', ebitda['2024'], 64000),
      expect_eq('2 contributions', contribs.length, 2),
      expect_true('has management contrib', contribs.some(c => c.sourceTier === 'management')),
      expect_true('has statutory contrib', contribs.some(c => c.sourceTier === 'statutory')),
    ];
    return collectResult(
      'Sc-9: Mgmt+Stat overlap → statutory wins (rev=500k), EBITDA[2024]=64000',
      assertions, prStat.geminiTypes, prStat.isIM, ebitda,
      `winner revenue=${winnerRevenue}`,
    );
  } finally {
    await cleanupCompany(coId);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sc-10: Split-source container — YTD income is_full_year=false
// ═══════════════════════════════════════════════════════════════════════════════

async function runSc10(tmpDir: string): Promise<ScenarioResult> {
  const coId = await mkCompany('LB SC10 Split-Source Container');
  try {
    // BS-only company accounts
    const prBS = await runDocumentThroughPipeline(
      join(tmpDir, 'sc10-bs-only.csv'),
      'Split Source Co Statutory Accounts FY2024.csv',
      'text/csv', coId,
    );
    await new Promise(r => setTimeout(r, 500));
    // YTD P&L (9 months)
    await runDocumentThroughPipeline(
      join(tmpDir, 'sc10-ytd-pl.csv'),
      'Split Source Co YTD PL 9 months to Sep 2024.csv',
      'text/csv', coId,
    );

    const fullYearIncomes = await db.select().from(incomeStatements)
      .where(and(eq(incomeStatements.targetCompanyId, coId), eq(incomeStatements.isFullYear, true)));
    const allIncomes = await db.select().from(incomeStatements).where(eq(incomeStatements.targetCompanyId, coId));
    const fullYearPeriods = await db.select({ id: financialPeriods.id }).from(financialPeriods)
      .where(and(eq(financialPeriods.targetCompanyId, coId), eq(financialPeriods.isFullYear, true)));
    const ebitda = await fetchReportedEbitdaByYear(coId);

    let bsExists = false;
    if (fullYearPeriods.length > 0) {
      const bsRows = await db.select().from(balanceSheets)
        .where(eq(balanceSheets.financialPeriodId, fullYearPeriods[0].id));
      bsExists = bsRows.length > 0;
    }

    const assertions: Assertion[] = [
      expect_eq('no full-year IS', fullYearIncomes.length, 0),
      expect_gte('YTD IS exists', allIncomes.length, 1),
      expect_eq('YTD IS is_full_year=false', allIncomes[0]?.isFullYear, false),
      expect_eq('EBITDA empty', Object.keys(ebitda).length, 0),
      expect_gte('full-year period exists (from BS)', fullYearPeriods.length, 1),
      expect_true('BS written to full-year period', bsExists),
    ];
    return collectResult(
      'Sc-10: Split-source → YTD income is_full_year=false, BS on full-year period, EBITDA={}',
      assertions, prBS.geminiTypes, prBS.isIM, ebitda,
    );
  } finally {
    await cleanupCompany(coId);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sc-11: Empty-balance survivor — data-bearing balance wins
// ═══════════════════════════════════════════════════════════════════════════════

async function runSc11(tmpDir: string): Promise<ScenarioResult> {
  const coId = await mkCompany('LB SC11 Empty Balance Survivor');
  try {
    // Empty first, data second
    await runDocumentThroughPipeline(
      join(tmpDir, 'sc11-empty-bs.csv'),
      'Empty Balance Sheet FY2024.csv',
      'text/csv', coId,
    );
    await new Promise(r => setTimeout(r, 500));
    const prData = await runDocumentThroughPipeline(
      join(tmpDir, 'sc11-data-bs.csv'),
      'Data Balance Sheet FY2024.csv',
      'text/csv', coId,
    );

    const balContribs = await db.select().from(financialContributions)
      .where(and(eq(financialContributions.targetCompanyId, coId), eq(financialContributions.statementType, 'balance')));
    const bsRows = await db.select().from(balanceSheets).where(eq(balanceSheets.targetCompanyId, coId));
    const ebitda = await fetchReportedEbitdaByYear(coId);

    const totalCurrentAssets = bsRows[0]?.totalCurrentAssets;
    const assertions: Assertion[] = [
      expect_eq('exactly 1 balance contrib', balContribs.length, 1),
      expect_eq('exactly 1 balance sheet', bsRows.length, 1),
      expect_eq('totalCurrentAssets=686000', totalCurrentAssets, '686000'),
    ];
    return collectResult(
      'Sc-11: Empty BS not stored; data-bearing BS wins (totalCurrentAssets=686000)',
      assertions, prData.geminiTypes, prData.isIM, ebitda,
      `totalCurrentAssets=${totalCurrentAssets}`,
    );
  } finally {
    await cleanupCompany(coId);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sc-12: Phantom P&L from balance-only doc — no income contributions
// ═══════════════════════════════════════════════════════════════════════════════

async function runSc12(tmpDir: string): Promise<ScenarioResult> {
  const coId = await mkCompany('LB SC12 Phantom PL from BS');
  try {
    const pr = await runDocumentThroughPipeline(
      join(tmpDir, 'sc12-bs-phantom-np.csv'),
      'Phantom NP Balance Sheet FY2024.csv',
      'text/csv', coId,
    );

    const incomeContribs = await db.select().from(financialContributions)
      .where(and(eq(financialContributions.targetCompanyId, coId), eq(financialContributions.statementType, 'income')));
    const incomes = await db.select().from(incomeStatements).where(eq(incomeStatements.targetCompanyId, coId));
    const balContribs = await db.select().from(financialContributions)
      .where(and(eq(financialContributions.targetCompanyId, coId), eq(financialContributions.statementType, 'balance')));
    const ebitda = await fetchReportedEbitdaByYear(coId);

    const assertions: Assertion[] = [
      expect_eq('zero income contribs', incomeContribs.length, 0),
      expect_eq('zero income stmts', incomes.length, 0),
      expect_eq('EBITDA empty', Object.keys(ebitda).length, 0),
      expect_gte('BS contrib written', balContribs.length, 1),
    ];
    return collectResult(
      'Sc-12: BS doc with phantom net_profit → no income contribs, EBITDA={}',
      assertions, pr.geminiTypes, pr.isIM, ebitda,
    );
  } finally {
    await cleanupCompany(coId);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sc-13: Delete statutory → management fallback; re-add statutory → wins again
// ═══════════════════════════════════════════════════════════════════════════════

async function runSc13(tmpDir: string): Promise<ScenarioResult> {
  const coId = await mkCompany('LB SC13 Delete Fallback ReAdd');
  try {
    // Seed: statutory + management
    const prStat = await runDocumentThroughPipeline(
      join(tmpDir, 'sc13-stat-pl.csv'),
      'Fallback Co Statutory Accounts FY2024.csv',
      'text/csv', coId,
    );
    await new Promise(r => setTimeout(r, 500));
    await runDocumentThroughPipeline(
      join(tmpDir, 'sc13-mgmt-pl.csv'),
      'Fallback Co Management Accounts FY2024.csv',
      'text/csv', coId,
    );

    // Phase 1: statutory wins
    const ebitdaP1 = await fetchReportedEbitdaByYear(coId);

    // Phase 2: delete statutory → management fallback
    await db.delete(financialContributions).where(
      and(eq(financialContributions.targetCompanyId, coId), eq(financialContributions.sourceTier, 'statutory')),
    );
    await reselect(coId);
    const ebitdaP2 = await fetchReportedEbitdaByYear(coId);

    // Phase 3: re-add statutory → wins again
    await new Promise(r => setTimeout(r, 500));
    await runDocumentThroughPipeline(
      join(tmpDir, 'sc13-stat-pl.csv'),
      'Fallback Co Statutory Accounts FY2024.csv',
      'text/csv', coId,
    );
    const ebitdaP3 = await fetchReportedEbitdaByYear(coId);

    const finalContribs = await db.select().from(financialContributions).where(eq(financialContributions.targetCompanyId, coId));

    const assertions: Assertion[] = [
      expect_eq('phase1 EBITDA 2024 = 64000 (stat wins)', ebitdaP1['2024'], 64000),
      expect_eq('phase2 EBITDA 2024 = 46000 (mgmt fallback)', ebitdaP2['2024'], 46000),
      expect_eq('phase3 EBITDA 2024 = 64000 (stat re-wins)', ebitdaP3['2024'], 64000),
      expect_true('>=2 contribs at end', finalContribs.length >= 2),
    ];
    return collectResult(
      'Sc-13: Delete stat→mgmt fallback (46k)→re-add stat→stat wins again (64k)',
      assertions, prStat.geminiTypes, prStat.isIM,
      { phase1: ebitdaP1['2024'] ?? 0, phase2: ebitdaP2['2024'] ?? 0, phase3: ebitdaP3['2024'] ?? 0 } as any,
      `p1=${ebitdaP1['2024']}, p2=${ebitdaP2['2024']}, p3=${ebitdaP3['2024']}`,
    );
  } finally {
    await cleanupCompany(coId);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sc-14: Ghost prune / one-per-year — stable container, ghost pruned
// ═══════════════════════════════════════════════════════════════════════════════

async function runSc14(tmpDir: string): Promise<ScenarioResult> {
  const coId = await mkCompany('LB SC14 Ghost Prune OnePerYear');
  try {
    // Upload management v1
    const prMgV1 = await runDocumentThroughPipeline(
      join(tmpDir, 'sc14-mgmt-v1.csv'),
      'Ghost Prune Co Management Accounts FY2024.csv',
      'text/csv', coId,
    );

    // Get container id
    const [pid1Row] = await db.select({ id: financialPeriods.id }).from(financialPeriods)
      .where(and(eq(financialPeriods.targetCompanyId, coId), eq(financialPeriods.fiscalYear, 2024), eq(financialPeriods.isFullYear, true)));
    const pid1 = pid1Row?.id;

    // Attach ebitda adjustment to the container
    let adjId: number | undefined;
    if (pid1) {
      const [adj] = await db.insert(ebitdaAdjustments).values({
        targetCompanyId: coId,
        financialPeriodId: pid1,
        description: 'SC14 owner add-back',
        amount: '10000',
        category: 'one_off',
      }).returning();
      adjId = adj.id;
    }

    // Upload statutory (should take over; container id must not change)
    await new Promise(r => setTimeout(r, 500));
    await runDocumentThroughPipeline(
      join(tmpDir, 'sc14-stat-pl.csv'),
      'Ghost Prune Co Statutory Accounts FY2024.csv',
      'text/csv', coId,
    );

    const [pid2Row] = await db.select({ id: financialPeriods.id }).from(financialPeriods)
      .where(and(eq(financialPeriods.targetCompanyId, coId), eq(financialPeriods.fiscalYear, 2024), eq(financialPeriods.isFullYear, true)));
    const pid2 = pid2Row?.id;

    // Inject a ghost period
    await db.insert(financialPeriods).values({
      targetCompanyId: coId,
      periodType: 'management',
      sourceTier: 'management',
      periodEnd: '2020-12-31',
      fiscalYear: 2020,
      isFullYear: true,
      sourceDocumentId: null,
      periodLabel: 'FY 2020 (ghost)',
    });

    await reselect(coId);

    const fullYearPeriods = await db.select({ fy: financialPeriods.fiscalYear }).from(financialPeriods)
      .where(and(eq(financialPeriods.targetCompanyId, coId), eq(financialPeriods.isFullYear, true)));

    const ebitda = await fetchReportedEbitdaByYear(coId);

    let adjSurvived = false;
    if (adjId) {
      const [adjAfter] = await db.select().from(ebitdaAdjustments).where(eq(ebitdaAdjustments.id, adjId));
      adjSurvived = adjAfter?.financialPeriodId === pid1;
    }

    const assertions: Assertion[] = [
      expect_true('container id stable (pid1 defined)', pid1 !== undefined),
      expect_eq('container id unchanged after stat upload', pid2, pid1),
      expect_true('adjustment survives on same period', adjSurvived),
      expect_eq('exactly 1 full-year period', fullYearPeriods.length, 1),
      expect_eq('surviving period is FY2024', fullYearPeriods[0]?.fy, 2024),
      expect_eq('EBITDA 2024 = 55000 (stat: 48k+7k)', ebitda['2024'], 55000),
    ];
    return collectResult(
      'Sc-14: Ghost prune → container stable, adjustment survives, ghost pruned, EBITDA[2024]=55000',
      assertions, prMgV1.geminiTypes, prMgV1.isIM, ebitda,
      `pid1=${pid1}, pid2=${pid2}, fullYearPeriods=${fullYearPeriods.length}`,
    );
  } finally {
    await cleanupCompany(coId);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  Layer B — Forward-Path Live Gate (real Gemini API)          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  console.log(`DB host: ${dbHost}`);
  console.log(`Gemini key: ${process.env.GOOGLE_GEMINI_API_KEY ? '✓ set' : '✗ MISSING'}\n`);

  if (!process.env.GOOGLE_GEMINI_API_KEY) {
    console.error('ABORT: GOOGLE_GEMINI_API_KEY not set.\n');
    process.exit(1);
  }

  // Create temp directory under /home/runner/workspace so fileStorageService reads locally
  // (isObjectStorageKey treats any path NOT starting /home/ as object storage)
  const tmpDir = join('/home/runner/workspace', `tmp-fpg-layer-b-${Date.now()}`);
  await mkdir(tmpDir, { recursive: true });
  console.log(`Temp dir: ${tmpDir}\n`);

  // Write all synthetic documents
  for (const [name, content] of Object.entries(DOCS)) {
    await writeFile(join(tmpDir, name), content, 'utf8');
  }
  console.log(`Wrote ${Object.keys(DOCS).length} synthetic documents.\n`);

  const runners: Array<() => Promise<ScenarioResult>> = [
    () => runSc1(tmpDir),
    () => runSc2(tmpDir),
    () => runSc3(tmpDir),
    () => runSc4(tmpDir),
    () => runSc5(tmpDir),
    () => runSc6(tmpDir),
    () => runSc7(tmpDir),
    () => runSc8(tmpDir),
    () => runSc9(tmpDir),
    () => runSc10(tmpDir),
    () => runSc11(tmpDir),
    () => runSc12(tmpDir),
    () => runSc13(tmpDir),
    () => runSc14(tmpDir),
  ];

  const results: ScenarioResult[] = [];
  for (let i = 0; i < runners.length; i++) {
    const scNum = i + 1;
    process.stdout.write(`Running Sc-${scNum}... `);
    const t0 = Date.now();
    try {
      const r = await runners[i]();
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`${r.pass ? 'PASS ✓' : 'FAIL ✗'} (${elapsed}s)`);
      if (!r.pass) {
        for (const a of r.assertions.filter(a => !a.ok)) {
          console.log(`       ${a.msg}`);
        }
      }
      if (r.geminiNote) {
        console.log(`       ℹ ${r.geminiNote}`);
      }
      results.push(r);
    } catch (err) {
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`ERROR ✗ (${elapsed}s)`);
      console.log(`       ${err instanceof Error ? err.message : String(err)}`);
      results.push({
        name: `Sc-${scNum}`,
        pass: false,
        assertions: [{ ok: false, msg: `Uncaught error: ${err instanceof Error ? err.message : String(err)}` }],
        geminiTypes: [],
        isIM: false,
        ebitda: {},
      });
    }
    // Brief pause between scenarios to avoid Gemini rate limits
    if (i < runners.length - 1) await new Promise(r => setTimeout(r, 1000));
  }

  // ── Summary table ──────────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  RESULTS SUMMARY                                             ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');

  let passed = 0;
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const status = r.pass ? 'PASS' : 'FAIL';
    const icon = r.pass ? '✓' : '✗';
    const label = `Sc-${i + 1}`;
    const types = r.geminiTypes.join(', ') || 'none';
    const im = r.isIM ? ' [IM]' : '';
    console.log(`║  ${icon} ${label}: ${status.padEnd(4)}  types=[${types}]${im}`);
    if (!r.pass) {
      for (const a of r.assertions.filter(a => !a.ok)) {
        console.log(`║       ${a.msg.substring(0, 58)}`);
      }
    }
    if (r.pass) passed++;
  }

  const total = results.length;
  const failed = total - passed;
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  ${passed}/${total} PASSED   ${failed} FAILED                                     ║`);
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Cleanup temp files
  try {
    await rm(tmpDir, { recursive: true, force: true });
    console.log(`Temp dir cleaned up.\n`);
  } catch { /* best-effort */ }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
