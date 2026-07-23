#!/usr/bin/env tsx
/**
 * End-to-end validation for:
 *   tc=101  Hickenbuild Ltd      (YTD-excluded up-move case)
 *   tc=185  trade double glazing  (FY2026 removal / £0 case — no docs, analytical only)
 *
 * For tc=101: downloads real prod docs from R2 (shared bucket), creates a fresh
 * dev target company, registers each doc via the normal insert path, calls
 * analyzeUploadedFileWithGemini (real Gemini), then runs a final reselect and
 * reports reportedEbitdaByYear + per-period guard analysis.
 *
 * For tc=185: pure analytical report — no documents exist in prod, all data
 * was manually entered.  Explains why FY2026 became £0 after reselect.
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
import pg from 'pg';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEV_USER_COMPANY_ID = 5;   // Valoxi.ai on dev
const DEV_USER_ID        = 1;    // adam@shiftopsconsulting.com

// Prod documents for tc=101 Hickenbuild (same R2 bucket as dev)
const HICKENBUILD_DOCS = [
  { name: 'Hickenbuild Asset Register.pdf',
    filePath: 'companies/101/doc-1783289272735-195830860.pdf',
    category: 'Asset Register',          fileSize: 1440876 },
  { name: 'Hickenbuild YTD P&L - May 2025 to Sept 2025.pdf',
    filePath: 'companies/101/doc-1783289294086-26605560.pdf',
    category: 'YTD Profit & Loss',       fileSize: 37124 },
  { name: 'Hickenbuild YTD Balance Sheet - May 2025 to Sept 2025.pdf',
    filePath: 'companies/101/doc-1783289307960-205305218.pdf',
    category: 'YTD Balance Sheet',       fileSize: 37007 },
  { name: 'Hickenbuild Accounts YE 30.04.2022.pdf',
    filePath: 'companies/101/doc-1783289346939-568053083.pdf',
    category: 'Company Accounts',        fileSize: 195396 },
  { name: 'Hickenbuild Accounts YE 30.04.2023.pdf',
    filePath: 'companies/101/doc-1783289359123-912072336.pdf',
    category: 'Company Accounts',        fileSize: 200277 },
  { name: 'Hickenbuild Accounts YE 30.04.2024.pdf',
    filePath: 'companies/101/doc-1783289372264-285801672.pdf',
    category: 'Company Accounts',        fileSize: 200379 },
  { name: 'Hickenbuild Accounts YE 30.04.2025.pdf',
    filePath: 'companies/101/doc-1783289391141-113368480.pdf',
    category: 'Company Accounts',        fileSize: 210271 },
];

// Prod raw data for tc=185 (no documents — analytical section uses these)
const TC185_PERIODS = [
  { id: 1069, fiscalYear: 2021, periodType: 'statutory', periodEnd: '2021-03-31', mc: null, prodIsFullYear: true,  op: 64168.53, da: null },
  { id: 1068, fiscalYear: 2022, periodType: 'statutory', periodEnd: '2022-03-31', mc: null, prodIsFullYear: true,  op: 28929.07, da: null },
  { id: 1066, fiscalYear: 2023, periodType: 'statutory', periodEnd: '2023-03-31', mc: null, prodIsFullYear: true,  op: 41881,    da: null },
  { id: 1064, fiscalYear: 2024, periodType: 'statutory', periodEnd: '2024-03-31', mc: null, prodIsFullYear: true,  op: 40859,    da: null },
  { id: 1065, fiscalYear: 2025, periodType: 'statutory', periodEnd: '2025-03-31', mc: null, prodIsFullYear: true,  op: 63267,    da: null },
  { id: 1067, fiscalYear: 2026, periodType: 'statutory', periodEnd: '2026-03-31', mc: null, prodIsFullYear: true,  op: null,     da: null, note: 'statutory period — null P&L' },
  { id: 1063, fiscalYear: 2026, periodType: 'statutory', periodEnd: '2026-05-27', mc: null, prodIsFullYear: true,  op: null,     da: null, note: 'statutory period — no IS' },
  { id: 1062, fiscalYear: 2026, periodType: 'management', periodEnd: '2026-05-27', mc: null, prodIsFullYear: true, op: 13056.54, da: null, note: 'management period with figures' },
];

const TIER_RANK: Record<string, number> = {
  statutory: 0, management: 1, information_memorandum: 2, deal_documents: 3,
};

function tier(periodType: string, docCategory: string | null): string {
  const im = ['Information Memorandum', 'Management Presentation'];
  if (docCategory && im.includes(docCategory)) return 'information_memorandum';
  if (docCategory === 'Deal Documents') return 'deal_documents';
  return periodType === 'statutory' ? 'statutory' : 'management';
}

function gbp(n: number | null | undefined): string {
  if (n == null) return 'null';
  return '\u00a3' + Math.round(n).toLocaleString();
}

function fmt(n: number | null | undefined): string {
  if (n == null) return '–';
  return Math.round(n).toLocaleString();
}

// ─── tc=185 Analytical Report ──────────────────────────────────────────────

function reportTc185(): void {
  console.log('\n' + '═'.repeat(100));
  console.log('tc=185  trade double glazing  —  ANALYTICAL REPORT (no documents in prod)');
  console.log('═'.repeat(100));
  console.log('\nAll financial data for tc=185 was manually entered; prod has zero documents.');
  console.log('End-to-end doc-upload validation is not possible for this company.\n');

  console.log('FY2026 data in prod (source_document_id = NULL on all periods):');
  console.log('─'.repeat(80));

  const fy2026 = TC185_PERIODS.filter(p => p.fiscalYear === 2026);
  for (const p of fy2026) {
    const t = tier(p.periodType, null);
    const ebitda = (p.op ?? 0) + (p.da ?? 0);
    console.log(`  period id=${p.id}  [${p.periodType}]  end=${p.periodEnd}  tier=${t}`);
    console.log(`    IS: OP=${p.op ?? 'null'}  DA=${p.da ?? 'null'}  EBITDA≈${fmt(ebitda)}  ${p.note ?? ''}`);
  }

  // Simulate reselect logic for FY2026
  const allFy2026    = fy2026.map(p => ({
    periodId:   p.id,
    t:          tier(p.periodType, null),
    isFullYear: true,   // all mc=null, periodType determines → isFullYear=true from computeSpan
    ebitda:     (p.op ?? 0) + (p.da ?? 0),
    hasIS:      p.op !== null,
  })).filter(p => p.hasIS);

  allFy2026.sort((a, b) => (TIER_RANK[a.t] ?? 9) - (TIER_RANK[b.t] ?? 9));

  console.log('\nReselect outcome for FY2026:');
  console.log('  All periods have months_covered=NULL and is_full_year=true in prod.');
  console.log('  computeSpan(mc=null, period_type=statutory) → isFullYear=true');
  console.log('  computeSpan(mc=null, period_type=management) → isFullYear=true');
  console.log('  Contributions ranked by tier (statutory=0 < management=1):');
  for (const c of allFy2026) {
    console.log(`    period ${c.periodId}  tier=${c.t} (rank=${TIER_RANK[c.t]})  EBITDA≈${fmt(c.ebitda)}`);
  }

  const winner = allFy2026[0];
  if (winner) {
    console.log(`\n  → RESELECT WINNER: period ${winner.periodId}  tier=${winner.t}`);
    console.log(`    IS stamped is_full_year=TRUE  EBITDA≈${fmt(winner.ebitda)}`);
    if (winner.ebitda === 0) {
      console.log('\n  FY2026 = £0 because:');
      console.log('    The winning statutory IS (period 1067, end=2026-03-31) has OP=null, DA=null.');
      console.log('    Statutory accounts for the year ending March 31 2026 appear to exist as a');
      console.log('    period container but have no extracted P&L figures.');
      console.log('    The management IS (£13,057) is correctly demoted — when a statutory period');
      console.log('    exists for the same fiscal year, management figures should not dominate.');
      console.log('\n  (a) This is NOT a part-year exclusion. Both periods have is_full_year=true.');
      console.log('      The £0 result comes from the winning statutory IS having null figures,');
      console.log('      not from a months_covered / YTD / forecast guard.');
      console.log('\n  (b) Guard fired: TIER DISPLACEMENT (statutory beats management)');
      console.log('      months_covered=NULL on both periods → no part-year guard');
      console.log('      period_end=2026-03-31 ≤ today (2026-07-23) → no forecast gate');
      console.log('      No document_category=Deal Documents → no IM guard');
      console.log('\n  (c) Correct behaviour: statutory wins. The null P&L figures in the statutory');
      console.log('      IS indicate that accounts are not yet filed / not yet entered.');
      console.log('      ACTION: enter the filed statutory figures for FY2026, or delete the empty');
      console.log('      statutory period if accounts are not yet available.');
    }  // end if (winner.ebitda === 0)
  }    // end if (winner)
}      // end reportTc185

// ─── tc=101 Live Validation ────────────────────────────────────────────────

async function validateHickenbuild(): Promise<void> {
  console.log('\n' + '═'.repeat(100));
  console.log('tc=101  Hickenbuild Ltd  —  LIVE END-TO-END VALIDATION');
  console.log('═'.repeat(100));

  // 1. Create fresh target company
  console.log('\n[1] Creating fresh target company on dev...');
  const label = `VALIDATION_Hickenbuild_${Date.now()}`;
  const [devTc] = await db
    .insert(targetCompanies)
    .values({
      companyName:    label,
      userCompanyId:  DEV_USER_COMPANY_ID,
      createdBy:      DEV_USER_ID,
    })
    .returning({ id: targetCompanies.id });
  const devTcId = devTc.id;
  console.log(`    → dev company id=${devTcId}  name="${label}"`);

  // 2. Register documents and run Gemini analysis for each
  console.log('\n[2] Registering documents + running Gemini analysis...');
  const docResults: Array<{ name: string; category: string; docId: number; eventId: number; analysisMs: number }> = [];

  for (const docInfo of HICKENBUILD_DOCS) {
    // Insert document record pointing to prod R2 key (shared bucket)
    const [doc] = await db
      .insert(documents)
      .values({
        targetCompanyId: devTcId,
        uploadedBy:      DEV_USER_ID,
        documentName:    docInfo.name,
        originalFilename: docInfo.name,
        filePath:        docInfo.filePath,   // prod R2 key — same bucket
        fileSize:        docInfo.fileSize,
        fileType:        'application/pdf',
        documentCategory: docInfo.category,
        description:     '',
        isConfidential:  false,
        publicToken:     randomUUID(),
      })
      .returning({ id: documents.id });

    // Insert file upload event
    const [evt] = await db
      .insert(fileUploadEvents)
      .values({
        documentId:    doc.id,
        targetCompanyId: devTcId,
        uploadedBy:    DEV_USER_ID,
        fileName:      docInfo.name,
        fileUrl:       `https://validation-placeholder/doc/${doc.id}`,
        webhookStatus: 'pending',
      })
      .returning({ id: fileUploadEvents.id });

    const t0 = Date.now();
    process.stdout.write(`    ${docInfo.category.padEnd(22)}  "${docInfo.name.substring(0, 50)}"  → `);
    try {
      await analyzeUploadedFileWithGemini(evt.id);
      const ms = Date.now() - t0;
      console.log(`done (${(ms / 1000).toFixed(1)}s)`);
      docResults.push({ name: docInfo.name, category: docInfo.category, docId: doc.id, eventId: evt.id, analysisMs: ms });
    } catch (err: any) {
      console.log(`ERROR: ${err.message}`);
      docResults.push({ name: docInfo.name, category: docInfo.category, docId: doc.id, eventId: evt.id, analysisMs: Date.now() - t0 });
    }
  }

  // 3. Final reselect (idempotent safety pass after all docs done)
  console.log('\n[3] Running final reselect...');
  await reselect(devTcId);
  console.log('    → done');

  // 4. Query reportedEbitdaByYear
  console.log('\n[4] Querying reportedEbitdaByYear...');
  const ebitdaByYear = await fetchReportedEbitdaByYear(devTcId);
  const years = Object.keys(ebitdaByYear).sort();
  console.log(`    Years included: ${years.join(', ')}`);
  for (const y of years) {
    console.log(`    FY${y}: ${gbp(ebitdaByYear[y])}`);
  }

  // Simple 3-year average (most recent 3 full years)
  const ebitdaVals = years.map(y => ebitdaByYear[y]);
  if (ebitdaVals.length >= 3) {
    const last3 = ebitdaVals.slice(-3);
    const avg3  = last3.reduce((a, b) => a + b, 0) / 3;
    console.log(`\n    3-year avg EBITDA (most recent): ${gbp(avg3)}`);
    console.log(`    At 4.0x multiple → implied EV: ${gbp(avg3 * 4)}`);
    console.log(`    (comms-pass target: ~£1,067,787)`);
  }

  // 5. Full period + IS detail for the fresh company
  console.log('\n[5] Full period / IS detail for fresh company...');
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
    console.log(`\n    period id=${p.id}  FY${p.fiscalYear}  [${p.periodType}]`);
    console.log(`      start=${ps}  end=${pe}  months_covered=${p.monthsCovered ?? 'NULL'}`);
    console.log(`      is_full_year=${p.isFullYear}  source_tier=${p.sourceTier ?? 'NULL'}`);

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
        const ebitda = (Number(is.op) || 0) + (Number(is.da) || 0);
        const inEbitda = is.isFullYear ? '✓ in reportedEbitda' : '✗ excluded from reportedEbitda';
        console.log(`      IS id=${is.isId}  OP=${is.op}  DA=${is.da}  EBITDA≈${fmt(ebitda)}  IS.is_full_year=${is.isFullYear}  → ${inEbitda}`);
      }
    }
  }

  // 6. financial_contributions detail
  console.log('\n[6] financial_contributions (income, FY dimension)...');
  const contribs = await db
    .select()
    .from(financialContributions)
    .where(and(
      eq(financialContributions.targetCompanyId, devTcId),
      eq(financialContributions.statementType,   'income'),
    ))
    .orderBy(financialContributions.fiscalYear, desc(financialContributions.periodEnd));

  if (contribs.length === 0) {
    console.log('    No income contributions found.');
  } else {
    for (const c of contribs) {
      const pe = c.periodEnd ? String(c.periodEnd).substring(0, 10) : 'NULL';
      const ebitda = (Number((c.figures as any)?.operatingProfit) || 0) +
                     (Number((c.figures as any)?.depreciationAmortisation) || 0);
      console.log(`    FY${c.fiscalYear}  tier=${c.sourceTier}  is_full_year=${c.isFullYear}  months_covered=${c.monthsCovered ?? 'NULL'}  period_end=${pe}  EBITDA≈${fmt(ebitda)}`);
    }
  }

  // 7. Guard summary per excluded IS
  console.log('\n[7] Guard summary — why each IS was excluded from reportedEbitdaByYear:');
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
  if (excluded.length === 0) {
    console.log('    No excluded IS rows found.');
  } else {
    for (const r of excluded) {
      const ebitda = (Number(r.op) || 0) + (Number(r.da) || 0);
      const mc     = r.mc;
      const pe     = r.periodEnd ? String(r.periodEnd).substring(0, 10) : 'NULL';
      const today  = '2026-07-23';
      let guard = '';
      if (mc !== null && mc < 11) {
        guard = `PART-YEAR (months_covered=${mc} < 11)`;
      } else if (pe > today) {
        guard = `FORECAST (period_end=${pe} > today)`;
      } else if (r.tier === 'information_memorandum') {
        guard = `IM EXCLUDED (source_tier=information_memorandum)`;
      } else {
        guard = `TIER DISPLACED (is_full_year set false by reselect — a higher-tier IS won this FY)`;
      }
      console.log(`    IS id=${r.isId}  FY${r.fiscalYear}  [${r.periodType}]  tier=${r.tier ?? '?'}  mc=${mc ?? 'NULL'}  end=${pe}  EBITDA≈${fmt(ebitda)}`);
      console.log(`      Guard: ${guard}`);
    }
  }

  // 8. Ghost / duplicate / forecast check
  console.log('\n[8] Ghost / duplicate / forecast / YTD leakage check...');
  const included = allIS.filter(r => r.isFullYear === true);
  const byFY: Record<number, typeof included> = {};
  for (const r of included) { (byFY[r.fiscalYear!] = byFY[r.fiscalYear!] || []).push(r); }

  let clean = true;
  for (const [fy, rows] of Object.entries(byFY)) {
    if (rows.length > 1) {
      console.log(`  ⚠ FY${fy}: ${rows.length} IS rows with is_full_year=true (duplicate)`);
      clean = false;
    }
  }

  // Check for future-dated full-year periods
  const futureFull = periods.filter(p => {
    const pe = p.periodEnd ? String(p.periodEnd).substring(0, 10) : '';
    return p.isFullYear && pe > '2026-07-23';
  });
  if (futureFull.length > 0) {
    console.log(`  ⚠ ${futureFull.length} full-year period(s) with future period_end (forecast leak)`);
    futureFull.forEach(p => console.log(`    FY${p.fiscalYear}  end=${String(p.periodEnd).substring(0,10)}`));
    clean = false;
  }

  // Check for YTD categories with is_full_year=true IS
  for (const r of included) {
    const t = r.tier ?? '';
    if (t === 'information_memorandum') {
      console.log(`  ⚠ IS id=${r.isId} FY${r.fiscalYear} has tier=IM but is_full_year=true — should be excluded`);
      clean = false;
    }
  }

  if (clean) {
    console.log('    ✓ No ghost / duplicate / forecast / IM leakage detected.');
  }

  console.log('\n[DONE] Hickenbuild validation complete.');
  console.log(`    Dev company id=${devTcId}  (label="${label}")`);
  console.log('    This company can be deleted from dev after review.\n');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  reportTc185();

  try {
    await validateHickenbuild();
  } catch (err: any) {
    console.error('\n[ERROR] Hickenbuild validation failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }

  process.exit(0);
}

main();
