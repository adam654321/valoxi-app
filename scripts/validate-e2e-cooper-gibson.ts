#!/usr/bin/env tsx
/**
 * End-to-end validation for:
 *   tc=138  Cooper Gibson Ltd
 *
 * Downloads real prod docs from R2 (shared bucket), creates a fresh dev
 * target company, registers each doc via the normal insert path, calls
 * analyzeUploadedFileWithGemini (real Gemini), then runs a final reselect
 * and compares reportedEbitdaByYear + EV against the current prod state.
 *
 * The key question: after proper analysis + reselect, does the YTD Balance Sheet
 * doc (FYTDBalanceSheet_25.6.26.pdf) get correctly excluded from EBITDA, so
 * that FY2026 comes from the annual accounts (OP=£45,733) instead of the
 * 4-month YTD P&L (OP=£7,695) it currently carries?
 */

import { eq, and, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';

import { db } from '../server/db';
import {
  targetCompanies,
  documents,
  fileUploadEvents,
  financialPeriods,
  incomeStatements,
  financialContributions,
} from '@shared/schema';
import { analyzeUploadedFileWithGemini } from '../server/services/file-analysis.service';
import { reselect } from '../server/services/projection-reselect.service';
import { fetchReportedEbitdaByYear } from '../server/services/deal-model.service';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEV_USER_COMPANY_ID = 5;
const DEV_USER_ID         = 1;

// Stored deal model: 3x / 3yr average
const CG_MULTIPLE     = 3;
const CG_AVG_YEARS    = 3;

// Current prod EBITDA by year (from direct query — these are the values the
// deal model sees RIGHT NOW on prod, using the winning IS per fiscal year
// picked by ORDER BY period_end DESC).
//
//  FY2026: is_id=1061 from doc 1432 (FYTDBalanceSheet_25.6.26.pdf)
//          OP=£7,694.58  DA=null  → EBITDA=£7,695  ← 4-month YTD! Wrong.
//  FY2025: is_id=662   from doc 848 (IM/statutory)
//          OP=£221,372  DA=£299   → EBITDA=£221,671
//  FY2024: is_id=661   from doc 848 (IM/statutory)
//          OP=£118,518  DA=£640   → EBITDA=£119,158
//  FY2023: is_id=664   from doc 854 (YE23 Accounts, end=2023-03-31)
//          OP=£17,739   DA=£463   → EBITDA=£18,202
//  FY2022: is_id=663   from doc 854 (YE23 Accounts, end=2022-03-31 comparative)
//          OP=£14,064   DA=£615   → EBITDA=£14,679
const PROD_EBITDA: Record<number, number> = {
  2022: 14_679,
  2023: 18_202,
  2024: 119_158,
  2025: 221_671,
  2026: 7_695,  // ← wrong: this is the 4-month YTD figure
};

// All 11 production documents for tc=138 Cooper Gibson (R2 keys shared bucket)
const COOPER_GIBSON_DOCS = [
  {
    name:     'IM - 163009.pdf',
    filePath: 'companies/138/doc-1778838673399-328152625.pdf',
    category: 'Deal Documents',
    fileSize:  2082278,
    fileType:  'application/pdf',
    note:     'IM — expected: IM-tier income/BS for multiple years',
  },
  {
    name:     'Cooper-Gibson Limited AC and CT ye 29.02.2024.pdf',
    filePath: 'companies/138/doc-1778838689011-823319302.pdf',
    category: 'Company Accounts',
    fileSize:  118101,
    fileType:  'application/pdf',
    note:     'Statutory accounts FY2024 — expected: FY2024 statutory IS',
  },
  {
    name:     'CGRProfitandLoss1Mar24.pdf',
    filePath: 'companies/138/doc-1778838746863-404999227.pdf',
    category: 'Company Accounts',
    fileSize:  40179,
    fileType:  'application/pdf',
    note:     'Management P&L FY2024 — should lose to statutory for FY2024',
  },
  {
    name:     'CompanyOverview-end28.2.25.pdf',
    filePath: 'companies/138/doc-1778838776011-725630720.pdf',
    category: 'Deal Documents',
    fileSize:  35253,
    fileType:  'application/pdf',
    note:     'FY2025 management overview — Deal Documents tier',
  },
  {
    name:     'FS_Cooper-GibsonLimited_28022025.pdf',
    filePath: 'companies/138/doc-1778838798393-104382606.pdf',
    category: 'Company Accounts',
    fileSize:  73405,
    fileType:  'application/pdf',
    note:     'Statutory accounts FY2025 — expected: FY2025 statutory IS',
  },
  {
    name:     'YE23 Accounts.pdf',
    filePath: 'companies/138/doc-1778838811755-535012742.pdf',
    category: 'Company Accounts',
    fileSize:  182192,
    fileType:  'application/pdf',
    note:     'Statutory accounts YE March 2023 (+ FY2022 comparative)',
  },
  {
    name:     'Cooper-Gibson Ltd AC and CT ye 29.02.26._final.pdf',
    filePath: 'companies/138/doc-1782036715100-291703953.pdf',
    category: 'Company Accounts',
    fileSize:  109852,
    fileType:  'application/pdf',
    note:     'Statutory accounts FY2026 (year ending 28 Feb 2026) — should WIN for FY2026',
  },
  {
    name:     'FYTDBalanceSheet_25.6.26.pdf',
    filePath: 'companies/138/doc-1782760216464-656399555.pdf',
    category: 'YTD Balance Sheet',
    fileSize:  37383,
    fileType:  'application/pdf',
    note:     'YTD Balance Sheet as at 25 Jun 2026 — IS should be EXCLUDED (part-year)',
  },
  {
    name:     'FYTD_ProfitandLoss_25.6.26.pdf',
    filePath: 'companies/138/doc-1782760240362-645911187.pdf',
    category: 'Deal Documents',
    fileSize:  35681,
    fileType:  'application/pdf',
    note:     'YTD P&L to 25 Jun 2026 — Deal Documents tier, should lose to statutory',
  },
  {
    name:     'Cooper-Gibson Ltd_Sales by Customer Summary_LastFYto28.2.26.xlsx',
    filePath: 'companies/138/doc-1782760262433-615318484.xlsx',
    category: 'Sales Ledger',
    fileSize:  10347,
    fileType:  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    note:     'Sales ledger — no IS impact expected',
  },
  {
    name:     'Cooper-Gibson Ltd_Sales by Customer Summary_1.3.26-25.6.26.xlsx',
    filePath: 'companies/138/doc-1782760273763-234847667.xlsx',
    category: 'Deal Documents',
    fileSize:  10099,
    fileType:  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    note:     'YTD sales summary — Deal Documents, no IS impact expected',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function gbp(n: number | null | undefined): string {
  if (n == null) return 'null';
  return '£' + Math.round(n).toLocaleString('en-GB');
}

function fmt(n: number | null | undefined): string {
  if (n == null) return '–';
  return Math.round(n).toLocaleString('en-GB');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function validateCooperGibson(): Promise<void> {
  const sep = '═'.repeat(100);
  console.log('\n' + sep);
  console.log('tc=138  Cooper Gibson Ltd  —  LIVE END-TO-END VALIDATION');
  console.log(sep);

  // ── Step 1: Show current prod state ─────────────────────────────────────────
  console.log('\n[CURRENT PROD STATE]  (direct query — what deal model sees today)');
  console.log('─'.repeat(70));
  console.log('  Prod IS winners (ORDER BY period_end DESC per fiscal year):');
  for (const [fy, ebitda] of Object.entries(PROD_EBITDA).sort()) {
    const flag = Number(fy) === 2026 ? '  ← 4-month YTD!' : '';
    console.log(`    FY${fy}: ${gbp(ebitda)}${flag}`);
  }
  const prodYears   = Object.keys(PROD_EBITDA).map(Number).sort().reverse();
  const prodSlice   = prodYears.slice(0, CG_AVG_YEARS);
  const prodAvg     = prodSlice.reduce((s, y) => s + PROD_EBITDA[y]!, 0) / CG_AVG_YEARS;
  const prodEV      = prodAvg * CG_MULTIPLE;
  console.log(`\n  ${CG_AVG_YEARS}-yr avg (FY${prodSlice.join('/')}): ${gbp(prodAvg)}`);
  console.log(`  EV at ${CG_MULTIPLE}x: ${gbp(prodEV)}`);
  console.log('\n  KEY ISSUE: FY2026 is driven by the 4-month YTD P&L extracted from');
  console.log('  FYTDBalanceSheet_25.6.26.pdf (period_end=2026-06-25, OP=£7,694).');
  console.log('  This beats the annual accounts P&L (period_end=2026-02-28, OP=£45,733)');
  console.log('  simply because 2026-06-25 > 2026-02-28 in the ORDER BY period_end sort.');
  console.log('  After reselect with correct is_full_year stamping, the YTD IS should be');
  console.log('  excluded, and FY2026 should come from the annual accounts.\n');

  // ── Step 2: Create fresh dev company ────────────────────────────────────────
  console.log('\n[1] Creating fresh dev company...');
  const label = `VALIDATION_CooperGibson_${Date.now()}`;
  const [devTc] = await db
    .insert(targetCompanies)
    .values({ companyName: label, userCompanyId: DEV_USER_COMPANY_ID, createdBy: DEV_USER_ID })
    .returning({ id: targetCompanies.id });
  const devTcId = devTc.id;
  console.log(`    → dev tc=${devTcId}  name="${label}"`);

  // ── Step 3: Register documents + Gemini analysis ─────────────────────────────
  console.log('\n[2] Registering documents + running Gemini analysis...');
  console.log('    (real Gemini API calls — each takes a few seconds)\n');

  const docResults: Array<{
    name: string; category: string; docId: number; analysisMs: number; ok: boolean;
  }> = [];

  for (const docInfo of COOPER_GIBSON_DOCS) {
    const [doc] = await db
      .insert(documents)
      .values({
        targetCompanyId:  devTcId,
        uploadedBy:       DEV_USER_ID,
        documentName:     docInfo.name,
        originalFilename: docInfo.name,
        filePath:         docInfo.filePath,
        fileSize:         docInfo.fileSize,
        fileType:         docInfo.fileType,
        documentCategory: docInfo.category,
        description:      docInfo.note,
        isConfidential:   false,
        publicToken:      randomUUID(),
      })
      .returning({ id: documents.id });

    const [evt] = await db
      .insert(fileUploadEvents)
      .values({
        documentId:      doc.id,
        targetCompanyId: devTcId,
        uploadedBy:      DEV_USER_ID,
        fileName:        docInfo.name,
        fileUrl:         `https://validation-placeholder/doc/${doc.id}`,
        webhookStatus:   'pending',
      })
      .returning({ id: fileUploadEvents.id });

    const label = `${docInfo.category.padEnd(22)}  "${docInfo.name.substring(0, 52)}"`;
    process.stdout.write(`    ${label}  → `);
    const t0 = Date.now();
    let ok = true;
    try {
      await analyzeUploadedFileWithGemini(evt.id);
      const ms = Date.now() - t0;
      console.log(`done (${(ms / 1000).toFixed(1)}s)`);
      docResults.push({ name: docInfo.name, category: docInfo.category, docId: doc.id, analysisMs: ms, ok: true });
    } catch (err: any) {
      console.log(`ERROR: ${err.message}`);
      ok = false;
      docResults.push({ name: docInfo.name, category: docInfo.category, docId: doc.id, analysisMs: Date.now() - t0, ok: false });
    }
  }

  const failures = docResults.filter(r => !r.ok);
  if (failures.length > 0) {
    console.log(`\n    ⚠ ${failures.length} analysis failure(s): ${failures.map(f => f.name).join(', ')}`);
  }

  // ── Step 4: Final reselect ────────────────────────────────────────────────
  console.log('\n[3] Running final reselect...');
  await reselect(devTcId);
  console.log('    → done');

  // ── Step 5: Corrected EBITDA ──────────────────────────────────────────────
  console.log('\n[4] Corrected reportedEbitdaByYear (post-reselect)...');
  const correctedEbitda = await fetchReportedEbitdaByYear(devTcId);
  const correctedYears  = Object.keys(correctedEbitda).map(Number).sort();
  console.log(`    Years included: ${correctedYears.map(y => 'FY' + y).join(', ')}`);
  for (const y of correctedYears) {
    const cur  = PROD_EBITDA[y];
    const corr = correctedEbitda[y];
    const delta = cur != null ? ` (was ${gbp(cur)}, Δ${gbp(corr - cur)})` : ' (new year)';
    console.log(`    FY${y}: ${gbp(corr)}${delta}`);
  }

  // ── Step 6: Deal model comparison ────────────────────────────────────────
  console.log('\n[5] Deal model comparison (3x / 3yr average)...');
  const corrSlice = correctedYears.reverse().slice(0, CG_AVG_YEARS);
  corrSlice.sort();
  if (corrSlice.length >= CG_AVG_YEARS) {
    const corrAvg = corrSlice.reduce((s, y) => s + correctedEbitda[y]!, 0) / CG_AVG_YEARS;
    const corrEV  = corrAvg * CG_MULTIPLE;
    console.log(`    Years averaged: FY${corrSlice.join('/')}`);
    console.log(`    Corrected avg EBITDA: ${gbp(corrAvg)}`);
    console.log(`    Corrected EV at ${CG_MULTIPLE}x: ${gbp(corrEV)}`);
    console.log(`\n    CURRENT prod EV:   ${gbp(prodEV)}  (using FY${prodSlice.join('/')})`);
    console.log(`    CORRECTED EV:      ${gbp(corrEV)}`);
    console.log(`    Delta:             ${gbp(corrEV - prodEV)}`);
  } else {
    const corrAvg = correctedYears.length > 0
      ? corrSlice.reduce((s, y) => s + correctedEbitda[y]!, 0) / corrSlice.length
      : 0;
    console.log(`    Only ${corrSlice.length} year(s) available for averaging`);
    console.log(`    Avg EBITDA: ${gbp(corrAvg)}  EV at ${CG_MULTIPLE}x: ${gbp(corrAvg * CG_MULTIPLE)}`);
    console.log(`\n    CURRENT prod EV: ${gbp(prodEV)}`);
  }

  // ── Step 7: Full period + IS detail ──────────────────────────────────────
  console.log('\n[6] Full period / IS detail for dev company...');
  const periods = await db
    .select({
      id:           financialPeriods.id,
      fiscalYear:   financialPeriods.fiscalYear,
      periodType:   financialPeriods.periodType,
      periodStart:  financialPeriods.periodStart,
      periodEnd:    financialPeriods.periodEnd,
      monthsCovered: financialPeriods.monthsCovered,
      isFullYear:   financialPeriods.isFullYear,
      sourceTier:   financialPeriods.sourceTier,
    })
    .from(financialPeriods)
    .where(eq(financialPeriods.targetCompanyId, devTcId))
    .orderBy(financialPeriods.fiscalYear, financialPeriods.periodEnd);

  for (const p of periods) {
    const pe = p.periodEnd   ? String(p.periodEnd).substring(0, 10)   : 'NULL';
    const ps = p.periodStart ? String(p.periodStart).substring(0, 10) : 'NULL';
    console.log(`\n    period id=${p.id}  FY${p.fiscalYear}  [${p.periodType}]  tier=${p.sourceTier ?? '?'}`);
    console.log(`      start=${ps}  end=${pe}  months_covered=${p.monthsCovered ?? 'NULL'}  is_full_year=${p.isFullYear}`);

    const isRows = await db
      .select({
        isId:       incomeStatements.id,
        op:         incomeStatements.operatingProfit,
        da:         incomeStatements.depreciationAmortisation,
        isFullYear: incomeStatements.isFullYear,
      })
      .from(incomeStatements)
      .where(and(
        eq(incomeStatements.financialPeriodId, p.id),
        eq(incomeStatements.targetCompanyId, devTcId),
      ));

    if (isRows.length === 0) {
      console.log('      IS: none');
    } else {
      for (const is of isRows) {
        const ebitda  = (Number(is.op) || 0) + (Number(is.da) || 0);
        const inEbitda = is.isFullYear ? '✓ in reportedEbitda' : '✗ excluded from reportedEbitda';
        console.log(`      IS id=${is.isId}  OP=${is.op}  DA=${is.da}  EBITDA≈${fmt(ebitda)}  IS.is_full_year=${is.isFullYear}  → ${inEbitda}`);
      }
    }
  }

  // ── Step 8: financial_contributions (income) ──────────────────────────────
  console.log('\n[7] financial_contributions (income only, all FYs)...');
  const contribs = await db
    .select()
    .from(financialContributions)
    .where(and(
      eq(financialContributions.targetCompanyId, devTcId),
      eq(financialContributions.statementType, 'income'),
    ))
    .orderBy(financialContributions.fiscalYear, desc(financialContributions.periodEnd));

  if (contribs.length === 0) {
    console.log('    No income contributions found.');
  } else {
    for (const c of contribs) {
      const pe     = c.periodEnd ? String(c.periodEnd).substring(0, 10) : 'NULL';
      const figs   = c.figures as any;
      const op     = Number(figs?.operatingProfit)        || 0;
      const da     = Number(figs?.depreciationAmortisation) || 0;
      const ebitda = op + da;
      console.log(`    FY${c.fiscalYear}  tier=${c.sourceTier}  is_full_year=${c.isFullYear}  months=${c.monthsCovered ?? 'NULL'}  end=${pe}  EBITDA≈${fmt(ebitda)}`);
    }
  }

  // ── Step 9: Guard summary (excluded ISes) ────────────────────────────────
  console.log('\n[8] Guard summary — ISes excluded from reportedEbitdaByYear:');
  const allIS = await db
    .select({
      isId:       incomeStatements.id,
      isFullYear: incomeStatements.isFullYear,
      op:         incomeStatements.operatingProfit,
      da:         incomeStatements.depreciationAmortisation,
      fpId:       financialPeriods.id,
      fiscalYear: financialPeriods.fiscalYear,
      periodType: financialPeriods.periodType,
      periodEnd:  financialPeriods.periodEnd,
      mc:         financialPeriods.monthsCovered,
      tier:       financialPeriods.sourceTier,
    })
    .from(incomeStatements)
    .innerJoin(financialPeriods, eq(incomeStatements.financialPeriodId, financialPeriods.id))
    .where(eq(incomeStatements.targetCompanyId, devTcId));

  const excluded = allIS.filter(r => r.isFullYear === false);
  const included = allIS.filter(r => r.isFullYear === true);

  if (excluded.length === 0) {
    console.log('    No excluded IS rows — all ISes have is_full_year=true.');
  } else {
    for (const r of excluded) {
      const ebitda = (Number(r.op) || 0) + (Number(r.da) || 0);
      const mc     = r.mc;
      const pe     = r.periodEnd ? String(r.periodEnd).substring(0, 10) : 'NULL';
      const today  = '2026-07-23';
      let guard: string;
      if (mc !== null && mc < 11) {
        guard = `PART-YEAR (months_covered=${mc} < 11)`;
      } else if (pe > today) {
        guard = `FORECAST (period_end=${pe} > today)`;
      } else if (r.tier === 'information_memorandum') {
        guard = `IM EXCLUDED (source_tier=information_memorandum)`;
      } else {
        guard = `TIER DISPLACED (higher-tier IS won this FY slot)`;
      }
      console.log(`    IS id=${r.isId}  FY${r.fiscalYear}  [${r.periodType}]  tier=${r.tier ?? '?'}  mc=${mc ?? 'NULL'}  end=${pe}  EBITDA≈${fmt(ebitda)}`);
      console.log(`      Guard: ${guard}`);
    }
  }

  // ── Step 10: Duplicate / ghost / leak check ───────────────────────────────
  console.log('\n[9] Ghost / duplicate / forecast / YTD-leak check...');
  const byFY: Record<number, typeof included> = {};
  for (const r of included) { (byFY[r.fiscalYear!] = byFY[r.fiscalYear!] || []).push(r); }
  let clean = true;
  for (const [fy, rows] of Object.entries(byFY)) {
    if (rows.length > 1) {
      console.log(`    ⚠ FY${fy}: ${rows.length} IS rows with is_full_year=true (duplicate!)`);
      clean = false;
    }
  }
  const futureFull = periods.filter(p => {
    const pe = p.periodEnd ? String(p.periodEnd).substring(0, 10) : '';
    return p.isFullYear && pe > '2026-07-23';
  });
  if (futureFull.length > 0) {
    console.log(`    ⚠ ${futureFull.length} full-year period(s) with future period_end`);
    futureFull.forEach(p => console.log(`      FY${p.fiscalYear}  end=${String(p.periodEnd).substring(0,10)}`));
    clean = false;
  }
  for (const r of included) {
    if ((r.tier ?? '') === 'information_memorandum') {
      console.log(`    ⚠ IS id=${r.isId} FY${r.fiscalYear} tier=IM but is_full_year=true`);
      clean = false;
    }
  }
  if (clean) console.log('    ✓ Clean — no ghost / duplicate / forecast / IM leakage.');

  // ── Final summary ─────────────────────────────────────────────────────────
  console.log('\n' + sep);
  console.log('SUMMARY');
  console.log(sep);
  console.log(`  Dev company:    tc=${devTcId}  name="${label}"`);
  console.log(`  Docs analysed:  ${docResults.filter(r => r.ok).length}/${docResults.length}`);
  console.log(`\n  CURRENT prod EV:   ${gbp(prodEV)}  (3yr avg ${gbp(prodAvg)}, using FY${prodSlice.join('/')})`);
  const cSlice = Object.keys(correctedEbitda).map(Number).sort().reverse().slice(0, CG_AVG_YEARS).sort();
  if (cSlice.length >= CG_AVG_YEARS) {
    const cAvg = cSlice.reduce((s, y) => s + correctedEbitda[y]!, 0) / CG_AVG_YEARS;
    const cEV  = cAvg * CG_MULTIPLE;
    console.log(`  CORRECTED EV:      ${gbp(cEV)}  (3yr avg ${gbp(cAvg)}, using FY${cSlice.join('/')})`);
    console.log(`  Delta:             ${gbp(cEV - prodEV)}`);
    if (Math.abs(cEV - prodEV) < 1) {
      console.log('\n  ✓ NO CHANGE — prod EV is already correct.');
    } else if (cEV > prodEV) {
      console.log('\n  ↑ CORRECTED EV IS HIGHER — current prod is under-stated.');
    } else {
      console.log('\n  ↓ CORRECTED EV IS LOWER — current prod is over-stated.');
    }
  }

  const ytdFY2026 = allIS.find(r => r.fiscalYear === 2026 && r.isFullYear === false);
  const annualFY2026 = allIS.find(r => r.fiscalYear === 2026 && r.isFullYear === true);
  console.log('\n  FY2026 IS outcome:');
  if (ytdFY2026) {
    console.log(`    ✓ YTD IS (id=${ytdFY2026.isId}) correctly excluded — IS.is_full_year=false`);
    console.log(`      OP=${ytdFY2026.op}  DA=${ytdFY2026.da}`);
  } else {
    console.log('    ? YTD IS was not found as excluded (may not have been created, or was pruned)');
  }
  if (annualFY2026) {
    const ebitda = (Number(annualFY2026.op) || 0) + (Number(annualFY2026.da) || 0);
    console.log(`    ✓ Annual IS (id=${annualFY2026.isId}) is the winner — IS.is_full_year=true  EBITDA=${gbp(ebitda)}`);
  }

  console.log('\n  This dev company can be deleted from dev after review.');
  console.log(sep + '\n');
}

async function main(): Promise<void> {
  try {
    await validateCooperGibson();
  } catch (err: any) {
    console.error('\n[ERROR] Cooper Gibson validation failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
  process.exit(0);
}

main();
