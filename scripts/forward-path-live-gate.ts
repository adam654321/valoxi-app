#!/usr/bin/env tsx
/**
 * Layer B — Forward-Path Live Gate (REAL PROD FILES)
 *
 * HARD RULES:
 *  - Uses ACTUAL prod binaries via object storage keys — no synthetic documents
 *  - Assertions are UNCHANGED from Layer A — failing = a result, not a bug to fix
 *  - documentCategory is the REAL category from prod (may affect tier)
 *  - imOverride is NEVER used — Gemini determines isIM from document content
 *
 * Step 1: Print prod document manifest (company → doc_id → filename → key)
 * Step 2: For each scenario create a fresh dev company, run real file through
 *         the full pipeline (classifyDocumentWithGemini + runStep2AnalysisForTypes
 *         + processExtractedData), assert unchanged Layer A assertions
 * Step 3: Print PASS/FAIL table with raw extracted values for every scenario
 *
 * Usage: npx tsx scripts/forward-path-live-gate.ts
 * Prereq: DATABASE_URL (dev) and GOOGLE_GEMINI_API_KEY must be set
 */

import { eq, and } from 'drizzle-orm';
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
import { fetchReportedEbitdaByYear } from '../server/services/deal-model.service';
import { classifyDocumentWithGemini } from '../server/services/gemini-document-classification-service';
import { runStep2AnalysisForTypes } from '../server/services/gemini-step2-analysis-service';

// ── Host guard ────────────────────────────────────────────────────────────────
const dbUrl = process.env.DATABASE_URL ?? '';
const dbHost = dbUrl.match(/@([^\/]+)\//)?.[1] ?? 'unknown';
if (dbHost.includes('ep-old-recipe') || dbHost.includes('.prod.')) {
  console.error(`\nABORT: DATABASE_URL points at prod host (${dbHost}). Must run on dev.\n`);
  process.exit(1);
}

const USER_COMPANY_ID = 71;
const MOCK_URL = 'http://localhost/prod-doc';

// ── Prod document manifest ────────────────────────────────────────────────────
// Storage keys are real prod object storage paths — readable from dev because
// dev and prod share the same object storage bucket.

interface ProdDoc {
  prodCo: string;    // prod company name + ID
  docId: number;     // prod document ID
  fileName: string;  // original filename (used for YTD / filename-based detection)
  key: string;       // object storage key (NOT a local path)
  mimeType: string;
  docCategory: string;
}

const DOCS: Record<string, ProdDoc> = {
  sc01: {
    prodCo: 'Canoports UK Limited (220)',
    docId: 1543,
    fileName: 'Canoports_YTD_Profit_and_Loss.pdf',
    key: 'companies/220/doc-1783154915000-431657599.pdf',
    mimeType: 'application/pdf',
    docCategory: 'YTD Profit & Loss',
  },
  sc02: {
    prodCo: 'Opem Security (215)',
    docId: 1497,
    fileName: 'Valoxi - OPEM - YTD Profit & Loss 28.02.2026 to 31.05.2026.xlsx',
    key: 'companies/215/doc-1782943014906-133969238.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    docCategory: 'YTD Profit & Loss',
  },
  sc03: {
    prodCo: 'Canoports UK Limited (218)',
    docId: 1506,
    fileName: 'Sales Ledger 2.pdf',
    key: 'companies/218/doc-1782995714308-283716183.pdf',
    mimeType: 'application/pdf',
    docCategory: 'Sales Ledger',
  },
  sc04: {
    prodCo: 'MANOR BUILDING SOLUTIONS (UK) LTD (137)',
    docId: 1596,
    fileName: 'Manor Building Solutions YTD P&L.pdf',
    key: 'companies/137/doc-1783613615639-259551387.pdf',
    mimeType: 'application/pdf',
    docCategory: 'Deal Documents',
  },
  sc05: {
    prodCo: 'Clifford Press Limited (122)',
    docId: 700,
    fileName: 'Project Folio - Flyer (new).pdf',
    key: 'companies/122/doc-1777926859738-906639683.pdf',
    mimeType: 'application/pdf',
    docCategory: 'Company Accounts',
  },
  sc06: {
    prodCo: 'Canoports UK Limited (220)',
    docId: 1542,
    fileName: 'Canoports_Staff_Matrix (1).pdf',
    key: 'companies/220/doc-1783154907393-627077613.pdf',
    mimeType: 'application/pdf',
    docCategory: 'Staff Matrix',
  },
  // Sc-7 phase 1: IM multi-year results pack (Deal Documents → IM tier)
  sc07a: {
    prodCo: 'The Homecare People (161)',
    docId: 1051,
    fileName: 'Year on Year 2023_2026 (2).pdf',
    key: 'companies/161/doc-1780160579222-622971738.pdf',
    mimeType: 'application/pdf',
    docCategory: 'Deal Documents',
  },
  // Sc-7 phase 2: statutory FY2023 override
  sc07b: {
    prodCo: 'The Homecare People (161)',
    docId: 1048,
    fileName: 'THCP Stat Accounts 31 Dec 2023 (detailed PL) (1).pdf',
    key: 'companies/161/doc-1780160490371-374310687.pdf',
    mimeType: 'application/pdf',
    docCategory: 'Company Accounts',
  },
  // Sc-10 BS doc: Canoports 220 YTD Balance Sheet
  sc10a: {
    prodCo: 'Canoports UK Limited (220)',
    docId: 1522,
    fileName: 'Canoports_YTD_Balance_Sheet.pdf',
    key: 'companies/220/doc-1783111615066-242378147.pdf',
    mimeType: 'application/pdf',
    docCategory: 'YTD Balance Sheet',
  },
  // Sc-10 P&L doc: Canoports 220 YTD P&L (same as Sc-1)
  sc10b: {
    prodCo: 'Canoports UK Limited (220)',
    docId: 1543,
    fileName: 'Canoports_YTD_Profit_and_Loss.pdf',
    key: 'companies/220/doc-1783154915000-431657599.pdf',
    mimeType: 'application/pdf',
    docCategory: 'YTD Profit & Loss',
  },
};

// Scenarios without a real prod file
const SKIPPED: Record<string, string> = {
  'Sc-8':  'No prod pair found: requires partial + full-year statutory for the SAME fiscal year from same company',
  'Sc-9':  'No prod pair found: requires management + statutory for the SAME fiscal year from same company',
  'Sc-11': 'No prod file: requires an empty balance sheet with no core asset data',
  'Sc-12': 'No prod file: requires balance-only doc with stray net_profit at year level',
  'Sc-13': 'No prod pair: requires same-FY management + statutory for delete/fallback/re-add test',
  'Sc-14': 'No prod pair: requires same-FY management + statutory for ghost-prune/container-stability test',
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

// ── Pipeline ──────────────────────────────────────────────────────────────────

interface PipelineResult {
  geminiTypes: string[];
  isIM: boolean;
  step2Results: Array<{ type: string; success: boolean }>;
}

async function runDocThroughPipeline(
  doc: ProdDoc,
  companyId: number,
): Promise<PipelineResult> {
  // Step 1: Classify — uses real prod binary from object storage
  const classResult = await classifyDocumentWithGemini({
    filePath: doc.key,
    mimeType: doc.mimeType,
    fileName: doc.fileName,
  });
  const isIM = classResult.isInformationMemorandum ?? false;
  let types = classResult.documentTypes ?? [];

  // Expand company_accounts → both P&L and BS (mirrors real pipeline)
  if (types.includes('company_accounts')) {
    if (!types.includes('profit_and_loss')) types = [...types, 'profit_and_loss'];
    if (!types.includes('balance_sheet')) types = [...types, 'balance_sheet'];
  }

  if (types.length === 0 || (types.length === 1 && types[0] === 'none')) {
    return { geminiTypes: classResult.documentTypes, isIM, step2Results: [] };
  }

  // Step 2: Extract
  const step2 = await runStep2AnalysisForTypes(
    MOCK_URL, doc.key, doc.mimeType, doc.fileName, types,
  );

  // Step 3: processExtractedData — uses REAL documentCategory from prod
  for (const r of step2) {
    if (r.success && r.analysisData) {
      await financialDataService.processExtractedData(
        r.documentType,
        r.analysisData,
        companyId,
        undefined,
        doc.docCategory,
        { llmIsIM: isIM },
        doc.fileName,
      );
    }
  }

  return {
    geminiTypes: classResult.documentTypes,
    isIM,
    step2Results: step2.map(r => ({ type: r.documentType, success: r.success })),
  };
}

// ── Assertions ────────────────────────────────────────────────────────────────

interface Assertion { ok: boolean; msg: string }

function aeq<T>(label: string, actual: T, expected: T): Assertion {
  const ok = actual === expected;
  return { ok, msg: ok ? `  ✓ ${label}: ${JSON.stringify(actual)}` : `  ✗ ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}` };
}
function agte(label: string, actual: number, min: number): Assertion {
  const ok = actual >= min;
  return { ok, msg: ok ? `  ✓ ${label}: ${actual} >= ${min}` : `  ✗ ${label}: expected >= ${min}, got ${actual}` };
}
function atrue(label: string, val: boolean): Assertion {
  return { ok: val, msg: val ? `  ✓ ${label}` : `  ✗ ${label}` };
}

interface ScResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  skipReason?: string;
  assertions: Assertion[];
  geminiTypes: string[];
  isIM: boolean;
  raw: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sc-1: Canoports YTD P&L → is_full_year=false, excluded from EBITDA
// ═══════════════════════════════════════════════════════════════════════════════

async function runSc1(): Promise<ScResult> {
  const coId = await mkCompany('LB-PROD Sc1 Canoports YTD PL');
  try {
    const pr = await runDocThroughPipeline(DOCS.sc01, coId);
    const contribs = await db.select().from(financialContributions)
      .where(and(eq(financialContributions.targetCompanyId, coId), eq(financialContributions.statementType, 'income')));
    const incomes = await db.select().from(incomeStatements).where(eq(incomeStatements.targetCompanyId, coId));
    const ebitda = await fetchReportedEbitdaByYear(coId);
    const raw = { types: pr.geminiTypes, isIM: pr.isIM, incomeContribs: contribs.length, isFullYear: contribs[0]?.isFullYear, monthsCovered: contribs[0]?.monthsCovered, ebitdaKeys: Object.keys(ebitda) };
    const assertions = [
      agte('income contribs ≥ 1', contribs.length, 1),
      aeq('contrib.isFullYear=false', contribs[0]?.isFullYear, false),
      agte('incomeStatements ≥ 1', incomes.length, 1),
      aeq('IS.isFullYear=false', incomes[0]?.isFullYear, false),
      aeq('EBITDA={}', Object.keys(ebitda).length, 0),
    ];
    return { name: 'Sc-1: Canoports YTD P&L → is_full_year=false, EBITDA={}', status: assertions.every(a => a.ok) ? 'PASS' : 'FAIL', assertions, geminiTypes: pr.geminiTypes, isIM: pr.isIM, raw };
  } finally { await cleanupCompany(coId); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sc-2: OPEM YTD P&L xlsx → monthsCovered=3, is_full_year=false
// ═══════════════════════════════════════════════════════════════════════════════

async function runSc2(): Promise<ScResult> {
  const coId = await mkCompany('LB-PROD Sc2 OPEM YTD PL');
  try {
    const pr = await runDocThroughPipeline(DOCS.sc02, coId);
    const contribs = await db.select().from(financialContributions)
      .where(and(eq(financialContributions.targetCompanyId, coId), eq(financialContributions.statementType, 'income')));
    const incomes = await db.select().from(incomeStatements).where(eq(incomeStatements.targetCompanyId, coId));
    const ebitda = await fetchReportedEbitdaByYear(coId);
    const raw = { types: pr.geminiTypes, isIM: pr.isIM, incomeContribs: contribs.length, isFullYear: contribs[0]?.isFullYear, monthsCovered: contribs[0]?.monthsCovered, tier: contribs[0]?.sourceTier, ebitdaKeys: Object.keys(ebitda) };
    const assertions = [
      agte('income contribs ≥ 1', contribs.length, 1),
      aeq('contrib.isFullYear=false', contribs[0]?.isFullYear, false),
      aeq('contrib.monthsCovered=3', contribs[0]?.monthsCovered, 3),
      agte('incomeStatements ≥ 1', incomes.length, 1),
      aeq('IS.isFullYear=false', incomes[0]?.isFullYear, false),
      aeq('EBITDA={}', Object.keys(ebitda).length, 0),
    ];
    return { name: 'Sc-2: OPEM YTD P&L (3 months) → monthsCovered=3, EBITDA={}', status: assertions.every(a => a.ok) ? 'PASS' : 'FAIL', assertions, geminiTypes: pr.geminiTypes, isIM: pr.isIM, raw };
  } finally { await cleanupCompany(coId); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sc-3: Canoports 218 Sales Ledger → multi-year with future-gated years
// ═══════════════════════════════════════════════════════════════════════════════

async function runSc3(): Promise<ScResult> {
  const coId = await mkCompany('LB-PROD Sc3 Canoports218 SalesLedger');
  try {
    const pr = await runDocThroughPipeline(DOCS.sc03, coId);
    const allContribs = await db.select().from(financialContributions).where(eq(financialContributions.targetCompanyId, coId));
    const allPeriods = await db.select({ fy: financialPeriods.fiscalYear }).from(financialPeriods)
      .where(and(eq(financialPeriods.targetCompanyId, coId), eq(financialPeriods.isFullYear, true)));
    const ebitda = await fetchReportedEbitdaByYear(coId);
    const raw = { types: pr.geminiTypes, isIM: pr.isIM, contribCount: allContribs.length, contribFYs: allContribs.map(c => c.fiscalYear), ebitdaKeys: Object.keys(ebitda), ebitda2023: ebitda['2023'], ebitda2024: ebitda['2024'], ebitda2025: ebitda['2025'] };
    const assertions = [
      atrue('EBITDA has 2023', '2023' in ebitda),
      atrue('EBITDA has 2024', '2024' in ebitda),
      atrue('EBITDA has 2025', '2025' in ebitda),
      aeq('ebitda[2023]=115000', ebitda['2023'], 115000),
      aeq('ebitda[2024]=138000', ebitda['2024'], 138000),
      aeq('ebitda[2025]=160000', ebitda['2025'], 160000),
      atrue('EBITDA no 2027', !('2027' in ebitda)),
      atrue('EBITDA no 2028', !('2028' in ebitda)),
      atrue('contrib fy2027 exists', allContribs.some(c => c.fiscalYear === 2027)),
      atrue('contrib fy2028 exists', allContribs.some(c => c.fiscalYear === 2028)),
      atrue('no full-year period >2026', allPeriods.every(p => (p.fy ?? 0) <= 2026)),
    ];
    return { name: 'Sc-3: Canoports 218 Sales Ledger → future FYs excluded, EBITDA[2023-2025]=unchanged', status: assertions.every(a => a.ok) ? 'PASS' : 'FAIL', assertions, geminiTypes: pr.geminiTypes, isIM: pr.isIM, raw };
  } finally { await cleanupCompany(coId); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sc-4: Manor YTD P&L (FY2027 mislabel, category=Deal Documents) → EBITDA={}
// ═══════════════════════════════════════════════════════════════════════════════

async function runSc4(): Promise<ScResult> {
  const coId = await mkCompany('LB-PROD Sc4 Manor YTD Mislabel');
  try {
    const pr = await runDocThroughPipeline(DOCS.sc04, coId);
    const allContribs = await db.select().from(financialContributions).where(eq(financialContributions.targetCompanyId, coId));
    const ebitda = await fetchReportedEbitdaByYear(coId);
    const has2027 = allContribs.some(c => c.fiscalYear === 2027);
    const has2026 = allContribs.some(c => c.fiscalYear === 2026);
    const raw = { types: pr.geminiTypes, isIM: pr.isIM, contribFYs: allContribs.map(c => ({ fy: c.fiscalYear, tier: c.sourceTier })), ebitdaKeys: Object.keys(ebitda), ebitda };
    const assertions = [
      atrue('contribution exists (fy=2027 or 2026)', has2027 || has2026),
      aeq('EBITDA={}', Object.keys(ebitda).length, 0),
    ];
    return { name: 'Sc-4: Manor YTD P&L (FY2027 mislabel, Deal Docs cat) → contrib exists, EBITDA={}', status: assertions.every(a => a.ok) ? 'PASS' : 'FAIL', assertions, geminiTypes: pr.geminiTypes, isIM: pr.isIM, raw };
  } finally { await cleanupCompany(coId); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sc-5: Clifford Press flyer → isInformationMemorandum=true, tier=IM, EBITDA={}
// ═══════════════════════════════════════════════════════════════════════════════

async function runSc5(): Promise<ScResult> {
  const coId = await mkCompany('LB-PROD Sc5 Clifford Flyer');
  try {
    const pr = await runDocThroughPipeline(DOCS.sc05, coId);
    const contribs = await db.select().from(financialContributions)
      .where(and(eq(financialContributions.targetCompanyId, coId), eq(financialContributions.statementType, 'income')));
    const ebitda = await fetchReportedEbitdaByYear(coId);
    const actualTier = contribs[0]?.sourceTier;
    const raw = { types: pr.geminiTypes, isIM: pr.isIM, incomeContribs: contribs.length, tier: actualTier, ebitdaKeys: Object.keys(ebitda) };
    const assertions = [
      atrue('Gemini isIM=true', pr.isIM),
      agte('income contribs ≥ 1', contribs.length, 1),
      aeq('tier=information_memorandum', actualTier, 'information_memorandum'),
      aeq('EBITDA={}', Object.keys(ebitda).length, 0),
    ];
    return { name: 'Sc-5: Clifford Flyer → isIM=true, tier=information_memorandum, EBITDA={}', status: assertions.every(a => a.ok) ? 'PASS' : 'FAIL', assertions, geminiTypes: pr.geminiTypes, isIM: pr.isIM, raw };
  } finally { await cleanupCompany(coId); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sc-6: Canoports staff matrix → staff_data written, zero financial contribs
// ═══════════════════════════════════════════════════════════════════════════════

async function runSc6(): Promise<ScResult> {
  const coId = await mkCompany('LB-PROD Sc6 Canoports StaffMatrix');
  try {
    const pr = await runDocThroughPipeline(DOCS.sc06, coId);
    const contribs = await db.select().from(financialContributions).where(eq(financialContributions.targetCompanyId, coId));
    const incomes = await db.select().from(incomeStatements).where(eq(incomeStatements.targetCompanyId, coId));
    const sdRows = await db.select().from(staffData).where(eq(staffData.targetCompanyId, coId));
    const ebitda = await fetchReportedEbitdaByYear(coId);
    const actualHeadcount = sdRows[0]?.totalHeadcount;
    const raw = { types: pr.geminiTypes, isIM: pr.isIM, contribCount: contribs.length, incomeCount: incomes.length, staffDataRows: sdRows.length, headcount: actualHeadcount };
    const assertions = [
      aeq('zero financial contribs', contribs.length, 0),
      aeq('zero income stmts', incomes.length, 0),
      agte('staffData rows ≥ 1', sdRows.length, 1),
      aeq('totalHeadcount=25', actualHeadcount, 25),
    ];
    return { name: 'Sc-6: Canoports Staff Matrix → staffData written (headcount=25), zero financial contribs', status: assertions.every(a => a.ok) ? 'PASS' : 'FAIL', assertions, geminiTypes: pr.geminiTypes, isIM: pr.isIM, raw };
  } finally { await cleanupCompany(coId); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sc-7: Homecare multi-year results pack (Deal Docs) → IM tier; stat FY2023 overrides
// ═══════════════════════════════════════════════════════════════════════════════

async function runSc7(): Promise<ScResult> {
  const coId = await mkCompany('LB-PROD Sc7 Homecare IM Pack');
  try {
    // Phase 1: IM pack (Deal Documents → IM tier forced by category)
    const pr1 = await runDocThroughPipeline(DOCS.sc07a, coId);
    const imContribs = await db.select().from(financialContributions).where(eq(financialContributions.targetCompanyId, coId));
    const ebitdaP1 = await fetchReportedEbitdaByYear(coId);
    const allIMTier = imContribs.every(c => c.sourceTier === 'information_memorandum');

    // Phase 2: statutory FY2023 override
    await new Promise(r => setTimeout(r, 500));
    const pr2 = await runDocThroughPipeline(DOCS.sc07b, coId);
    const ebitda = await fetchReportedEbitdaByYear(coId);

    const raw = {
      types_phase1: pr1.geminiTypes,
      isIM_phase1: pr1.isIM,
      imContribCount: imContribs.length,
      allIMTier,
      ebitdaPhase1Keys: Object.keys(ebitdaP1),
      types_phase2: pr2.geminiTypes,
      ebitda,
    };
    const assertions = [
      agte('phase1 IM contribs ≥ 1', imContribs.length, 1),
      atrue('all phase1 contribs are IM tier', allIMTier),
      aeq('phase1 EBITDA={}', Object.keys(ebitdaP1).length, 0),
      aeq('ebitda[2023]=252000 after phase2', ebitda['2023'], 252000),
      atrue('EBITDA no 2022', !('2022' in ebitda)),
      atrue('EBITDA no 2024', !('2024' in ebitda)),
    ];
    return { name: 'Sc-7: Homecare IM pack → all IM; stat FY2023 overrides → EBITDA[2023]=252000', status: assertions.every(a => a.ok) ? 'PASS' : 'FAIL', assertions, geminiTypes: pr1.geminiTypes, isIM: pr1.isIM, raw };
  } finally { await cleanupCompany(coId); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sc-10: Canoports 220 YTD BS + YTD P&L → split-source container
// (NOTE: both docs are YTD, not full-year statutory BS — expected to diverge from Layer A)
// ═══════════════════════════════════════════════════════════════════════════════

async function runSc10(): Promise<ScResult> {
  const coId = await mkCompany('LB-PROD Sc10 Canoports YTD BS+PL');
  try {
    const prBS = await runDocThroughPipeline(DOCS.sc10a, coId);
    await new Promise(r => setTimeout(r, 500));
    await runDocThroughPipeline(DOCS.sc10b, coId);

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

    const raw = {
      types_bs: prBS.geminiTypes,
      isIM_bs: prBS.isIM,
      fullYearIncomes: fullYearIncomes.length,
      allIncomes: allIncomes.length,
      allIncomesIsFullYear: allIncomes.map(i => i.isFullYear),
      fullYearPeriods: fullYearPeriods.length,
      bsExists,
      ebitdaKeys: Object.keys(ebitda),
    };
    const assertions = [
      aeq('no full-year IS', fullYearIncomes.length, 0),
      agte('YTD IS exists ≥ 1', allIncomes.length, 1),
      aeq('allIncomes[0].isFullYear=false', allIncomes[0]?.isFullYear, false),
      aeq('EBITDA={}', Object.keys(ebitda).length, 0),
      agte('full-year period from BS ≥ 1', fullYearPeriods.length, 1),
      atrue('BS written to full-year period', bsExists),
    ];
    return { name: 'Sc-10: Canoports YTD BS + YTD P&L → split-source container', status: assertions.every(a => a.ok) ? 'PASS' : 'FAIL', assertions, geminiTypes: prBS.geminiTypes, isIM: prBS.isIM, raw };
  } finally { await cleanupCompany(coId); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║  Layer B — Forward-Path Live Gate (REAL PROD FILES)                  ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');
  console.log(`DB host: ${dbHost}`);
  console.log(`Gemini key: ${process.env.GOOGLE_GEMINI_API_KEY ? '✓ set' : '✗ MISSING'}\n`);

  if (!process.env.GOOGLE_GEMINI_API_KEY) {
    console.error('ABORT: GOOGLE_GEMINI_API_KEY not set.\n');
    process.exit(1);
  }

  // ── STEP 1: Manifest ────────────────────────────────────────────────────────
  console.log('STEP 1 — PROD DOCUMENT MANIFEST');
  console.log('─'.repeat(100));
  const manifestRows = [
    ['Sc',   'Prod Company',                          'Doc ID', 'Filename',                                                    'Storage Key'],
    ['──',   '────────────',                          '──────', '────────',                                                    '───────────'],
    ['1',    'Canoports UK Limited (220)',             '1543',   'Canoports_YTD_Profit_and_Loss.pdf',                           'companies/220/doc-1783154915000-431657599.pdf'],
    ['2',    'Opem Security (215)',                   '1497',   'Valoxi - OPEM - YTD P&L 28.02.2026 to 31.05.2026.xlsx',      'companies/215/doc-1782943014906-133969238.xlsx'],
    ['3',    'Canoports UK Limited (218)',            '1506',   'Sales Ledger 2.pdf',                                          'companies/218/doc-1782995714308-283716183.pdf'],
    ['4',    'MANOR BUILDING SOLUTIONS (137)',        '1596',   'Manor Building Solutions YTD P&L.pdf',                        'companies/137/doc-1783613615639-259551387.pdf'],
    ['5',    'Clifford Press Limited (122)',          '700',    'Project Folio - Flyer (new).pdf',                             'companies/122/doc-1777926859738-906639683.pdf'],
    ['6',    'Canoports UK Limited (220)',            '1542',   'Canoports_Staff_Matrix (1).pdf',                              'companies/220/doc-1783154907393-627077613.pdf'],
    ['7a',   'The Homecare People (161)',             '1051',   'Year on Year 2023_2026 (2).pdf',                              'companies/161/doc-1780160579222-622971738.pdf'],
    ['7b',   'The Homecare People (161)',             '1048',   'THCP Stat Accounts 31 Dec 2023 (detailed PL) (1).pdf',        'companies/161/doc-1780160490371-374310687.pdf'],
    ['8',    'NO PROD FILE',                          '—',      'Requires partial+full statutory for same FY',                 '—'],
    ['9',    'NO PROD FILE',                          '—',      'Requires management+statutory for same FY',                   '—'],
    ['10a',  'Canoports UK Limited (220)',            '1522',   'Canoports_YTD_Balance_Sheet.pdf',                             'companies/220/doc-1783111615066-242378147.pdf'],
    ['10b',  'Canoports UK Limited (220)',            '1543',   'Canoports_YTD_Profit_and_Loss.pdf',                           'companies/220/doc-1783154915000-431657599.pdf'],
    ['11',   'NO PROD FILE',                          '—',      'Requires empty balance sheet',                                '—'],
    ['12',   'NO PROD FILE',                          '—',      'Requires BS-only doc with stray net_profit',                  '—'],
    ['13',   'NO PROD FILE',                          '—',      'Requires same-FY management+statutory pair',                  '—'],
    ['14',   'NO PROD FILE',                          '—',      'Requires same-FY pair for container-stability test',          '—'],
  ];
  for (const row of manifestRows) {
    console.log(`  ${row[0].padEnd(5)} ${row[1].padEnd(35)} ${row[2].padEnd(8)} ${row[3].padEnd(55)} ${row[4]}`);
  }
  console.log();

  // ── STEP 2: Run scenarios ────────────────────────────────────────────────────
  console.log('STEP 2 — RUNNING SCENARIOS');
  console.log('─'.repeat(100));

  const runners: Array<() => Promise<ScResult>> = [
    runSc1, runSc2, runSc3, runSc4, runSc5, runSc6, runSc7, runSc10,
  ];
  const scNames = [
    'Sc-1 (Canoports YTD P&L)',
    'Sc-2 (OPEM YTD P&L xlsx)',
    'Sc-3 (Canoports 218 Sales Ledger)',
    'Sc-4 (Manor YTD Mislabel)',
    'Sc-5 (Clifford Flyer)',
    'Sc-6 (Canoports Staff Matrix)',
    'Sc-7 (Homecare IM Pack)',
    'Sc-10 (Canoports YTD BS+PL)',
  ];

  const results: ScResult[] = [];

  for (let i = 0; i < runners.length; i++) {
    process.stdout.write(`Running ${scNames[i]}... `);
    const t0 = Date.now();
    try {
      const r = await runners[i]();
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      const statusIcon = r.status === 'PASS' ? '✓ PASS' : '✗ FAIL';
      console.log(`${statusIcon} (${elapsed}s)  types=[${r.geminiTypes.join(',')}]  isIM=${r.isIM}`);
      for (const a of r.assertions.filter(a => !a.ok)) {
        console.log(a.msg);
      }
      results.push(r);
    } catch (err) {
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`✗ ERROR (${elapsed}s): ${err instanceof Error ? err.message : String(err)}`);
      results.push({
        name: scNames[i],
        status: 'FAIL',
        assertions: [{ ok: false, msg: `  ✗ Uncaught error: ${err instanceof Error ? err.message : String(err)}` }],
        geminiTypes: [],
        isIM: false,
        raw: {},
      });
    }

    if (i < runners.length - 1) await new Promise(r => setTimeout(r, 800));
  }

  // Add skipped scenarios
  for (const [name, reason] of Object.entries(SKIPPED)) {
    results.push({
      name,
      status: 'SKIP',
      skipReason: reason,
      assertions: [],
      geminiTypes: [],
      isIM: false,
      raw: {},
    });
  }

  // ── STEP 3: Report ────────────────────────────────────────────────────────────
  const runnable = results.filter(r => r.status !== 'SKIP');
  const passed = runnable.filter(r => r.status === 'PASS').length;
  const failed = runnable.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;

  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║  STEP 3 — RESULTS                                                    ║');
  console.log('╠══════════════════════════════════════════════════════════════════════╣');
  for (const r of results) {
    const icon = r.status === 'PASS' ? '✓' : r.status === 'SKIP' ? '◌' : '✗';
    const types = r.geminiTypes.length ? `[${r.geminiTypes.join(',')}]` : '';
    const im = r.isIM ? '[IM]' : '';
    console.log(`║  ${icon} ${r.status.padEnd(4)}  ${r.name.substring(0, 60)}`);
    if (r.status === 'SKIP') {
      console.log(`║         SKIP: ${r.skipReason?.substring(0, 65)}`);
    } else {
      if (types || im) console.log(`║         Gemini: ${types} ${im}`);
      if (Object.keys(r.raw).length > 0) {
        console.log(`║         raw: ${JSON.stringify(r.raw).substring(0, 75)}`);
      }
      for (const a of r.assertions.filter(a => !a.ok)) {
        console.log(`║         ${a.msg.substring(0, 68)}`);
      }
    }
  }
  console.log('╠══════════════════════════════════════════════════════════════════════╣');
  console.log(`║  ${passed}/${passed + failed} RUNNABLE PASSED   ${failed} FAILED   ${skipped} SKIPPED (no prod file)    ║`);
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
