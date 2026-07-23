#!/usr/bin/env tsx
/**
 * scripts/validate-exclusions.ts
 *
 * For each of the 5 target companies below:
 *   1.  Clone prod → fresh dev company (same pattern as comms-analysis.ts)
 *   2.  Backfill financial_contributions on the dev clone
 *   3.  Apply Slice-18 YTD-flip (computeSpan + doc filename)
 *   4.  Run reselect()
 *   5.  Call getDevEbitdaByYear() — the corrected set
 *   6.  For every fiscal year NOT in the corrected set, print WHY each income
 *       contribution was excluded (part-year / YTD-hint / forecast / IM / duplicate-loser).
 *
 * ASSERT: no excluded year was backed by a genuine full-year (months>=11,
 * not YTD/interim, not forecast, not IM) figure that was not simply outcompeted
 * by a higher-tier full-year winner.  Any such case is flagged OVER-REMOVAL.
 *
 * READS:  PROD_DATABASE_URL (read-only, ep-old-recipe fingerprint enforced)
 * WRITES: DATABASE_URL      (dev heliumdb — asserted before every write)
 * Dev clones are DELETED at the end of each run.
 *
 * Run: npx tsx scripts/validate-exclusions.ts
 */

import pg from 'pg';
import crypto from 'crypto';
import { eq, and, ne, isNull, or, desc } from 'drizzle-orm';

import { db, pool as devDrizzlePool } from '../server/db';
import {
  financialContributions,
  financialPeriods,
  incomeStatements,
  documents,
} from '../shared/schema';
import { resolveSourceTier } from '../server/scripts/backfill-financial-contributions';
import { computeSpan } from '../shared/utils/derive-span';
import { reselect } from '../server/services/projection-reselect.service';
import { toNum } from '../shared/calculators/deal-model.calc';

pg.types.setTypeParser(114,  (v: string) => v);
pg.types.setTypeParser(3802, (v: string) => v);
const { Pool } = pg;

const prodPool = new Pool({ connectionString: process.env.PROD_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 3 });
const devPool  = new Pool({ connectionString: process.env.DATABASE_URL,      ssl: { rejectUnauthorized: false }, max: 3 });

const DEV_USER_ID         = 1;
const DEV_USER_COMPANY_ID = 5;
const TODAY               = '2026-07-23';   // script run date

const TARGET_COMPANIES = [
  { tcId:  83, name: 'Newbie&Me' },
  { tcId: 130, name: 'Keen As Mustard' },
  { tcId: 216, name: 'Baytree' },
  { tcId:  86, name: 'Thomas Niamh' },
  { tcId: 179, name: 'Little Agnes' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeJson(value: string | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value !== 'string') return JSON.stringify(value);
  try { JSON.parse(value); return value; } catch { return null; }
}

async function insertOne(client: pg.PoolClient, table: string, row: Record<string, unknown>): Promise<number> {
  const cols = Object.keys(row);
  const vals = cols.map((_, i) => `$${i + 1}`);
  const res  = await client.query(
    `INSERT INTO ${table} (${cols.join(',')}) VALUES (${vals.join(',')}) RETURNING id`,
    cols.map(c => row[c]),
  );
  return (res.rows[0] as { id: number }).id;
}

function remapSoft(val: number | null | undefined, map: Map<number, number>): number | null {
  if (val == null) return null;
  return map.get(val) ?? null;
}

function remap(val: number | null | undefined, map: Map<number, number>): number {
  if (val == null) throw new Error(`remap: null value`);
  const r = map.get(val);
  if (r === undefined) throw new Error(`remap: id ${val} not in map`);
  return r;
}

const gbp = (n: number | null | undefined) =>
  n == null ? '\u00a3null' : '\u00a3' + Math.round(n).toLocaleString('en-GB');

const YTD_PATTERN = /(?<![a-zA-Z])YTD(?![a-zA-Z])|\byear[\s\-]?to[\s\-]?date\b|\binterim\b/i;

// ─── Safety guards ────────────────────────────────────────────────────────────

async function assertHosts(): Promise<void> {
  const prodUrl = process.env.PROD_DATABASE_URL ?? '';
  const devUrl  = process.env.DATABASE_URL ?? '';
  if (!prodUrl.includes('ep-old-recipe')) throw new Error(`ABORT: PROD_DATABASE_URL missing ep-old-recipe fingerprint`);
  if (devUrl.includes('ep-old-recipe'))   throw new Error(`ABORT: DATABASE_URL contains prod fingerprint — writes refused`);
  const prodDb = (await prodPool.query('SELECT current_database() AS db')).rows[0].db;
  const devDb  = (await devPool.query('SELECT current_database() AS db')).rows[0].db;
  console.log(`  PROD db: ${prodDb}  |  DEV db: ${devDb}`);
  console.log(`  Today: ${TODAY}\n`);
}

// ─── Clone prod → dev ─────────────────────────────────────────────────────────

async function cloneCompany(prodTcId: number, name: string): Promise<{
  devTcId: number;
  docMap: Map<number, number>;
  periodMap: Map<number, number>;
}> {
  const devClient = await devPool.connect();
  try {
    await devClient.query('BEGIN');

    const { rows: [src] } = await prodPool.query('SELECT * FROM target_companies WHERE id = $1', [prodTcId]);
    const devTcId = await insertOne(devClient, 'target_companies', {
      user_company_id:  DEV_USER_COMPANY_ID,
      company_name:     `[VALIDATE-EXCL] ${name}_${Date.now()}`,
      industry:         src.industry,
      sub_sector:       src.sub_sector,
      website:          src.website,
      phone:            src.phone,
      email:            src.email,
      address:          src.address,
      annual_revenue:   src.annual_revenue,
      employee_count:   src.employee_count,
      year_established: src.year_established,
      description:      src.description,
      stage:            src.stage,
      is_archived:      false,
      created_by:       DEV_USER_ID,
    });

    // documents
    const { rows: prodDocs } = await prodPool.query('SELECT * FROM documents WHERE target_company_id = $1 ORDER BY id', [prodTcId]);
    const docMap = new Map<number, number>();
    for (const d of prodDocs) {
      const id = await insertOne(devClient, 'documents', {
        target_company_id: devTcId,
        uploaded_by:       DEV_USER_ID,
        document_name:     d.document_name,
        original_filename: d.original_filename,
        file_path:         d.file_path,
        file_size:         d.file_size,
        file_type:         d.file_type,
        document_category: d.document_category,
        secondary_category: d.secondary_category,
        description:       d.description,
        is_confidential:   d.is_confidential,
        public_token:      crypto.randomBytes(32).toString('hex'),
      });
      docMap.set(d.id as number, id);
    }

    // financial_periods — prod has no source_tier; derive from period_type
    const { rows: prodPeriods } = await prodPool.query('SELECT * FROM financial_periods WHERE target_company_id = $1 ORDER BY id', [prodTcId]);
    const periodMap = new Map<number, number>();
    for (const p of prodPeriods) {
      const derivedTier = p.period_type === 'statutory' ? 'statutory' : 'management';
      const id = await insertOne(devClient, 'financial_periods', {
        target_company_id:  devTcId,
        period_type:        p.period_type,
        period_start:       p.period_start,
        period_end:         p.period_end,
        fiscal_year:        p.fiscal_year,
        period_label:       p.period_label,
        months_covered:     p.months_covered,
        is_full_year:       p.is_full_year,
        source_tier:        derivedTier,
        source_document_id: remapSoft(p.source_document_id as number, docMap),
      });
      periodMap.set(p.id as number, id);
    }

    // income_statements
    const { rows: prodIS } = await prodPool.query('SELECT * FROM income_statements WHERE target_company_id = $1 ORDER BY id', [prodTcId]);
    for (const r of prodIS) {
      await insertOne(devClient, 'income_statements', {
        financial_period_id:       remap(r.financial_period_id as number, periodMap),
        target_company_id:         devTcId,
        revenue:                   r.revenue,
        cost_of_sales:             r.cost_of_sales,
        gross_profit:              r.gross_profit,
        administrative_expenses:   r.administrative_expenses,
        depreciation_amortisation: r.depreciation_amortisation,
        other_operating_income:    r.other_operating_income,
        operating_profit:          r.operating_profit,
        interest_receivable:       r.interest_receivable,
        interest_payable:          r.interest_payable,
        profit_before_tax:         r.profit_before_tax,
        corporation_tax:           r.corporation_tax,
        net_profit:                r.net_profit,
        staff_costs:               r.staff_costs,
        directors_remuneration:    r.directors_remuneration,
        dividends_paid:            r.dividends_paid,
        revenue_breakdown:         safeJson(r.revenue_breakdown),
        cost_of_sales_breakdown:   safeJson(r.cost_of_sales_breakdown),
        overheads_breakdown:       safeJson(r.overheads_breakdown),
        exceptional_items:         safeJson(r.exceptional_items),
        source_document_id:        remapSoft(r.source_document_id as number, docMap),
      });
    }

    await devClient.query('COMMIT');
    return { devTcId, docMap, periodMap };
  } catch (err) {
    await devClient.query('ROLLBACK');
    throw err;
  } finally {
    devClient.release();
  }
}

// ─── Backfill contributions ───────────────────────────────────────────────────

async function backfillContributions(devTcId: number): Promise<void> {
  await db.delete(financialContributions).where(eq(financialContributions.targetCompanyId, devTcId));

  const incRows = await db.select().from(incomeStatements)
    .where(eq(incomeStatements.targetCompanyId, devTcId));

  for (const row of incRows) {
    const [period] = await db.select({
      fiscalYear:    financialPeriods.fiscalYear,
      periodType:    financialPeriods.periodType,
      isFullYear:    financialPeriods.isFullYear,
      monthsCovered: financialPeriods.monthsCovered,
      periodEnd:     financialPeriods.periodEnd,
    }).from(financialPeriods).where(eq(financialPeriods.id, row.financialPeriodId));

    let documentCategory: string | null = null;
    if (row.sourceDocumentId) {
      const [doc] = await db.select({ documentCategory: documents.documentCategory })
        .from(documents).where(eq(documents.id, row.sourceDocumentId));
      documentCategory = doc?.documentCategory ?? null;
    }

    const tier = resolveSourceTier(period?.periodType ?? '', documentCategory);

    const figures = {
      revenue:                  row.revenue,
      costOfSales:              row.costOfSales,
      grossProfit:              row.grossProfit,
      administrativeExpenses:   row.administrativeExpenses,
      depreciationAmortisation: row.depreciationAmortisation,
      otherOperatingIncome:     row.otherOperatingIncome,
      operatingProfit:          row.operatingProfit,
      interestReceivable:       row.interestReceivable,
      interestPayable:          row.interestPayable,
      profitBeforeTax:          row.profitBeforeTax,
      corporationTax:           row.corporationTax,
      netProfit:                row.netProfit,
      staffCosts:               row.staffCosts,
      directorsRemuneration:    row.directorsRemuneration,
      dividendsPaid:            row.dividendsPaid,
      revenueBreakdown:         row.revenueBreakdown,
      costOfSalesBreakdown:     row.costOfSalesBreakdown,
      overheadsBreakdown:       row.overheadsBreakdown,
      exceptionalItems:         row.exceptionalItems,
    };

    await db.insert(financialContributions).values({
      targetCompanyId:  devTcId,
      fiscalYear:       period?.fiscalYear ?? null,
      statementType:    'income',
      sourceDocumentId: row.sourceDocumentId ?? null,
      sourceTier:       tier,
      isFullYear:       period?.isFullYear ?? true,
      monthsCovered:    period?.monthsCovered ?? null,
      periodEnd:        period?.periodEnd ?? null,
      asAtDate:         null,
      figures,
    });
  }
}

// ─── Slice-18 YTD flip ───────────────────────────────────────────────────────

async function applySlice18Patch(devTcId: number): Promise<number> {
  const contribs = await db.select({
    id:              financialContributions.id,
    periodEnd:       financialContributions.periodEnd,
    monthsCovered:   financialContributions.monthsCovered,
    isFullYear:      financialContributions.isFullYear,
    sourceDocumentId: financialContributions.sourceDocumentId,
  }).from(financialContributions)
    .where(and(
      eq(financialContributions.targetCompanyId, devTcId),
      eq(financialContributions.statementType, 'income'),
    ));

  let flipped = 0;
  for (const c of contribs) {
    if (!c.isFullYear) continue;

    let docName: string | null = null;
    if (c.sourceDocumentId) {
      const [doc] = await db.select({ documentName: documents.documentName })
        .from(documents).where(eq(documents.id, c.sourceDocumentId)).limit(1);
      docName = doc?.documentName ?? null;
    }

    const { isFullYear: newFull } = computeSpan({
      periodEnd:     c.periodEnd,
      monthsCovered: c.monthsCovered,
      ytdHintText:   docName,
    });

    if (!newFull) {
      await db.update(financialContributions)
        .set({ isFullYear: false })
        .where(eq(financialContributions.id, c.id));
      flipped++;
    }
  }
  return flipped;
}

// ─── getDevEbitdaByYear (mirrors comms-analysis.ts exactly) ──────────────────

async function getDevEbitdaByYear(devTcId: number): Promise<Record<string, number>> {
  const rows = await db
    .select({
      fiscalYear:               financialPeriods.fiscalYear,
      periodEnd:                financialPeriods.periodEnd,
      operatingProfit:          incomeStatements.operatingProfit,
      depreciationAmortisation: incomeStatements.depreciationAmortisation,
    })
    .from(incomeStatements)
    .innerJoin(financialPeriods, eq(incomeStatements.financialPeriodId, financialPeriods.id))
    .where(
      and(
        eq(incomeStatements.targetCompanyId, devTcId),
        eq(incomeStatements.isFullYear, true),
        or(
          isNull(financialPeriods.sourceTier),
          ne(financialPeriods.sourceTier, 'information_memorandum'),
        ),
      ),
    )
    .orderBy(desc(financialPeriods.periodEnd));

  const result: Record<string, number> = {};
  for (const row of rows) {
    const year = row.fiscalYear?.toString()
      || (row.periodEnd ? String(new Date(row.periodEnd).getFullYear()) : null);
    if (!year) continue;
    if (year in result) continue;
    result[year] = toNum(row.operatingProfit) + toNum(row.depreciationAmortisation);
  }
  return result;
}

// ─── Classify exclusion reason for a single contribution ──────────────────────

function classifyExclusionReason(c: {
  isFullYear: boolean;
  monthsCovered: number | null;
  periodEnd: string | null;
  sourceTier: string;
  docName: string | null;
}): string {
  // IM always excluded from EBITDA average regardless of full-year status
  if (c.sourceTier === 'information_memorandum') return 'IM (information_memorandum tier)';

  // Future period gate
  if (c.periodEnd && c.periodEnd > TODAY) return `FORECAST-GATED (period_end=${c.periodEnd} > ${TODAY})`;

  if (!c.isFullYear) {
    // Determine why it was marked part-year
    const hasYtd = !!(c.docName && YTD_PATTERN.test(c.docName));
    const mc     = c.monthsCovered;

    if (hasYtd && mc != null && mc >= 11) return `YTD-HINT (doc name "${c.docName}" signals partial-period; months_covered=${mc} overridden)`;
    if (hasYtd)                           return `YTD-HINT (doc name "${c.docName}" signals partial-period)`;
    if (mc != null && mc < 11)            return `PART-YEAR (months_covered=${mc} < 11)`;
    if (mc != null)                       return `PART-YEAR (months_covered=${mc} < 11)`;
    // periodEnd > TODAY already handled above — but might be from prod is_full_year=false
    return 'PART-YEAR (prod period marked is_full_year=false; no further mc/ytd signal)';
  }

  // isFullYear=true, not IM, not future-gated
  // This contribution was a valid full-year eligible input.
  // If the year is still excluded from correctedEbitdaByYear, this is ANOMALOUS.
  return 'ANOMALY: full-year non-IM non-future contribution did not produce a winner — investigate';
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

async function cleanupClone(devTcId: number): Promise<void> {
  const c = await devPool.connect();
  try {
    await c.query('DELETE FROM financial_contributions WHERE target_company_id=$1', [devTcId]);
    await c.query('DELETE FROM income_statements WHERE target_company_id=$1', [devTcId]);
    await c.query('DELETE FROM balance_sheets WHERE target_company_id=$1', [devTcId]);
    await c.query('DELETE FROM financial_periods WHERE target_company_id=$1', [devTcId]);
    await c.query('DELETE FROM documents WHERE target_company_id=$1', [devTcId]);
    await c.query('DELETE FROM target_companies WHERE id=$1', [devTcId]);
  } finally {
    c.release();
  }
}

// ─── Per-company analysis ─────────────────────────────────────────────────────

async function analyseCompany(prodTcId: number, prodName: string): Promise<boolean> {
  const bar = '═'.repeat(100);
  console.log(`\n${bar}`);
  console.log(`tc=${prodTcId}  ${prodName}`);
  console.log(bar);

  let devTcId = -1;
  let overRemovalFound = false;

  try {
    // 1. Clone
    process.stdout.write('  [1] Clone prod→dev ... ');
    const { devTcId: id } = await cloneCompany(prodTcId, prodName);
    devTcId = id;
    console.log(`dev company id=${devTcId}`);

    // 2. Backfill
    process.stdout.write('  [2] Backfill contributions ... ');
    await backfillContributions(devTcId);
    const allContribs = await db.select().from(financialContributions)
      .where(and(
        eq(financialContributions.targetCompanyId, devTcId),
        eq(financialContributions.statementType, 'income'),
      ));
    console.log(`${allContribs.length} income contributions`);

    // 3. Slice-18
    process.stdout.write('  [3] Slice-18 YTD flip ... ');
    const flipped = await applySlice18Patch(devTcId);
    console.log(`${flipped} flipped to is_full_year=false`);

    // 4. Reselect
    process.stdout.write('  [4] Reselect ... ');
    await reselect(devTcId);
    console.log('done');

    // 5. Corrected EBITDA
    const corrected = await getDevEbitdaByYear(devTcId);
    const includedYears = new Set(Object.keys(corrected));
    console.log(`\n  [5] Corrected reportedEbitdaByYear:`);
    if (includedYears.size === 0) {
      console.log('      (none — zero years pass the is_full_year=true gate)');
    } else {
      for (const yr of [...includedYears].sort()) {
        console.log(`      FY${yr}: ${gbp(corrected[yr])}`);
      }
    }

    // 6. Fetch all income contributions + doc names for reason classification
    const contribRows = await db.select({
      id:              financialContributions.id,
      fiscalYear:      financialContributions.fiscalYear,
      isFullYear:      financialContributions.isFullYear,
      monthsCovered:   financialContributions.monthsCovered,
      periodEnd:       financialContributions.periodEnd,
      sourceTier:      financialContributions.sourceTier,
      sourceDocumentId: financialContributions.sourceDocumentId,
      figures:         financialContributions.figures,
    }).from(financialContributions)
      .where(and(
        eq(financialContributions.targetCompanyId, devTcId),
        eq(financialContributions.statementType, 'income'),
      ));

    // Fetch document names in one batch
    const docIds = [...new Set(contribRows.map(c => c.sourceDocumentId).filter(Boolean))] as number[];
    const docNames = new Map<number, string>();
    for (const docId of docIds) {
      const [doc] = await db.select({ documentName: documents.documentName })
        .from(documents).where(eq(documents.id, docId)).limit(1);
      if (doc) docNames.set(docId, doc.documentName);
    }

    // Group contributions by fiscal year
    const byYear = new Map<string, typeof contribRows>();
    for (const c of contribRows) {
      const yr = c.fiscalYear != null
        ? String(c.fiscalYear)
        : (c.periodEnd ? String(new Date(c.periodEnd).getFullYear()) : null);
      if (!yr) continue;
      if (!byYear.has(yr)) byYear.set(yr, []);
      byYear.get(yr)!.push(c);
    }

    // Find all years that exist in contributions but NOT in corrected EBITDA
    const excludedYears = [...byYear.keys()].filter(yr => !includedYears.has(yr)).sort();

    if (excludedYears.length === 0) {
      console.log(`\n  \u2713 No excluded fiscal years — every contribution year appears in correctedEbitdaByYear.`);
    } else {
      console.log(`\n  Excluded fiscal years: ${excludedYears.join(', ')}`);
      console.log('  ' + '─'.repeat(96));

      for (const yr of excludedYears) {
        const contribs = byYear.get(yr)!;
        console.log(`\n  FY${yr}  (${contribs.length} contribution(s) — ALL excluded)`);

        for (const c of contribs) {
          const docName  = c.sourceDocumentId ? (docNames.get(c.sourceDocumentId) ?? null) : null;
          const figures  = c.figures as Record<string, number | null> | null;
          const op       = figures?.operatingProfit ?? null;
          const da       = figures?.depreciationAmortisation ?? null;
          const ebitda   = (op ?? 0) + (da ?? 0);

          const reason = classifyExclusionReason({
            isFullYear:    c.isFullYear ?? false,
            monthsCovered: c.monthsCovered,
            periodEnd:     c.periodEnd,
            sourceTier:    c.sourceTier ?? '',
            docName,
          });

          console.log(`    Contribution id=${c.id}`);
          console.log(`      Source doc : ${docName ?? '(none — manually entered)'}`);
          console.log(`      period_end : ${c.periodEnd ?? 'null'}  months_covered=${c.monthsCovered ?? 'null'}`);
          console.log(`      tier       : ${c.sourceTier}  is_full_year(after slice18)=${c.isFullYear}`);
          console.log(`      EBITDA     : OP=${op ?? 'null'} + DA=${da ?? 'null'} = ${gbp(ebitda)}`);
          console.log(`      REASON     : ${reason}`);

          // ASSERT: genuine full-year check
          const isGenuineFullYear =
            (c.isFullYear === true) &&
            (c.sourceTier !== 'information_memorandum') &&
            (!c.periodEnd || c.periodEnd <= TODAY);

          if (isGenuineFullYear) {
            // This contribution was full-year, not IM, not future-gated.
            // The only acceptable reason for the year being excluded is that the
            // year IS in corrected (another winner took it) — but we only reach
            // this block for excluded years. FLAG it.
            console.log(`      *** OVER-REMOVAL FLAG ***`);
            console.log(`          This contribution is full-year, not IM, not future-gated.`);
            console.log(`          It should have become a reselect winner for FY${yr}.`);
            console.log(`          Investigate: did reselect evict it incorrectly?`);
            overRemovalFound = true;
          }
        }
      }
    }

    // Also check: are there included years with losing full-year contributions?
    // (These are NOT over-removals — the year IS included — but show them for completeness.)
    const includedWithLosers = [...byYear.keys()].filter(yr => includedYears.has(yr));
    const loserLines: string[] = [];
    for (const yr of includedWithLosers) {
      const contribs = byYear.get(yr)!;
      if (contribs.length <= 1) continue;
      const losers = contribs.filter(c => !c.isFullYear || c.sourceTier === 'information_memorandum');
      for (const c of losers) {
        const docName = c.sourceDocumentId ? (docNames.get(c.sourceDocumentId) ?? null) : null;
        const figures = c.figures as Record<string, number | null> | null;
        const op = figures?.operatingProfit ?? null;
        const da = figures?.depreciationAmortisation ?? null;
        const reason = classifyExclusionReason({
          isFullYear:    c.isFullYear ?? false,
          monthsCovered: c.monthsCovered,
          periodEnd:     c.periodEnd,
          sourceTier:    c.sourceTier ?? '',
          docName,
        });
        loserLines.push(`    FY${yr}  contrib id=${c.id}  tier=${c.sourceTier}  mc=${c.monthsCovered}  doc="${docName ?? 'none'}"  → ${reason}`);
      }
    }
    if (loserLines.length > 0) {
      console.log(`\n  Included years with losing/demoted contributions (year IS in corrected EBITDA, contributor lost):`);
      for (const l of loserLines) console.log(l);
    }

    console.log(`\n  ASSERT result: ${overRemovalFound ? '*** OVER-REMOVAL DETECTED — SEE FLAG ABOVE ***' : '\u2713 PASS — no over-removal'}`);

  } finally {
    if (devTcId !== -1) {
      await cleanupClone(devTcId).catch(e => console.error(`  Cleanup error for dev id=${devTcId}:`, e));
      console.log(`  Dev clone id=${devTcId} deleted.`);
    }
  }

  return overRemovalFound;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('═'.repeat(100));
  console.log('EXCLUSION VALIDATION — tc=83, 130, 216, 86, 179');
  console.log('Clone prod → dev → backfill → slice18 → reselect → explain every excluded year');
  console.log('═'.repeat(100));

  await assertHosts();

  let anyOverRemoval = false;

  for (const { tcId, name } of TARGET_COMPANIES) {
    const flag = await analyseCompany(tcId, name);
    if (flag) anyOverRemoval = true;
  }

  console.log('\n' + '═'.repeat(100));
  console.log('SUMMARY');
  console.log('═'.repeat(100));
  if (anyOverRemoval) {
    console.log('  *** ONE OR MORE OVER-REMOVALS DETECTED — DO NOT SEND EMAILS UNTIL RESOLVED ***');
  } else {
    console.log('  \u2713 ALL CLEAR — every excluded year has a legitimate guard reason.');
    console.log('    No genuine full-year figures were incorrectly removed from the EBITDA average.');
  }

  await prodPool.end();
  await devPool.end();
  await devDrizzlePool.end();
}

main().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
