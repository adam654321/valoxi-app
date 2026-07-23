#!/usr/bin/env tsx
/**
 * scripts/validate-multiples-and-nullwinner.ts  — READ-ONLY (no dev writes)
 *
 * PART A — EV Multiple verification
 *   For every company on the email list (ACTIVE+MATERIAL affected companies):
 *   1. Does the company have a configured deal model?
 *   2. What is the stored ebitdaMultiple and averagingYears?
 *   3. Was a fallback default used?  (multiple defaulted to 3.0x, years to 3)
 *   Hickenbuild tc=101 checked explicitly.
 *
 * PART B — Null income-winner gap scan
 *   Checks every affected company for the pattern:
 *     statutory income contribution has null core figures (OP=null) AND wins
 *     over a management income contribution that has real figures.
 *   After clone→backfill→reselect, the statutory contribution beats management
 *   on tier rank alone — reselect has NO null-figure guard.  This means the
 *   IS is stamped with null OP/DA and getDevEbitdaByYear returns 0 for that
 *   year.  Detected purely from prod schema without running the pipeline.
 *
 * READS: PROD_DATABASE_URL only.  No dev writes.
 *
 * Run: npx tsx scripts/validate-multiples-and-nullwinner.ts
 */

import pg from 'pg';

pg.types.setTypeParser(114,  (v: string) => v);
pg.types.setTypeParser(3802, (v: string) => v);
const { Pool } = pg;

const prodPool = new Pool({
  connectionString: process.env.PROD_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
});

const EXCLUDED_TC_IDS   = [45, 76, 77, 78, 120, 71];
const FALLBACK_MULTIPLE = '3.0';
const FALLBACK_YEARS    = 3;
const TODAY_YEAR        = 2026;

const exclude = EXCLUDED_TC_IDS.join(',');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const gbp = (n: number | null | undefined) =>
  n == null ? 'null' : '\u00a3' + Math.round(n).toLocaleString('en-GB');

async function assertProd(): Promise<void> {
  const url = process.env.PROD_DATABASE_URL ?? '';
  if (!url.includes('ep-old-recipe')) {
    throw new Error('ABORT: PROD_DATABASE_URL missing ep-old-recipe fingerprint');
  }
  const db = (await prodPool.query('SELECT current_database() AS db')).rows[0].db;
  console.log(`  PROD db: ${db}  (read-only)\n`);
}

// ─── Step 1: Identify affected+active companies (mirrors comms-analysis) ──────

interface AffectedCo {
  tcId: number;
  companyName: string;
  userCompanyId: number;
  flags: string[];
  isActive: boolean;
  ownerEmail: string;
  ownerName: string;
}

async function identifyAffectedActive(): Promise<AffectedCo[]> {
  // Flag A: duplicate full-year periods for the same fiscal year
  const { rows: fA } = await prodPool.query(`
    SELECT DISTINCT target_company_id
    FROM financial_periods
    WHERE is_full_year = true AND fiscal_year IS NOT NULL
      AND target_company_id NOT IN (${exclude})
    GROUP BY target_company_id, fiscal_year
    HAVING COUNT(*) > 1
  `);
  const setA = new Set(fA.map(r => r.target_company_id as number));

  // Flag B: management full-year coexisting with statutory for same year
  const { rows: fB } = await prodPool.query(`
    SELECT DISTINCT fp1.target_company_id
    FROM financial_periods fp1
    WHERE fp1.is_full_year = true AND fp1.period_type = 'management'
      AND fp1.target_company_id NOT IN (${exclude})
      AND EXISTS (
        SELECT 1 FROM financial_periods fp2
        WHERE fp2.target_company_id = fp1.target_company_id
          AND fp2.fiscal_year = fp1.fiscal_year
          AND fp2.is_full_year = true AND fp2.period_type = 'statutory'
      )
  `);
  const setB = new Set(fB.map(r => r.target_company_id as number));

  // Flag C: any period fiscal_year > TODAY_YEAR
  const { rows: fC } = await prodPool.query(`
    SELECT DISTINCT target_company_id
    FROM financial_periods
    WHERE fiscal_year > $1
      AND target_company_id NOT IN (${exclude})
  `, [TODAY_YEAR]);
  const setC = new Set(fC.map(r => r.target_company_id as number));

  // Flag D: accounting documents uploaded, but zero statutory full-year periods
  const { rows: fD } = await prodPool.query(`
    SELECT DISTINCT d.target_company_id
    FROM documents d
    WHERE d.document_category IN ('Company Accounts', 'Statutory Accounts')
      AND d.target_company_id NOT IN (${exclude})
      AND NOT EXISTS (
        SELECT 1 FROM financial_periods fp
        WHERE fp.target_company_id = d.target_company_id
          AND fp.period_type = 'statutory' AND fp.is_full_year = true
      )
  `);
  const setD = new Set(fD.map(r => r.target_company_id as number));

  const allTcIds = new Set([...setA, ...setB, ...setC, ...setD]);

  // Fetch company + account details
  const { rows: tcs } = await prodPool.query(`
    SELECT tc.id, tc.company_name, tc.user_company_id
    FROM target_companies tc
    WHERE tc.id = ANY($1::int[])
    ORDER BY tc.id
  `, [[...allTcIds]]);

  const result: AffectedCo[] = [];
  for (const tc of tcs) {
    const tcId: number = tc.id;
    const flags: string[] = [];
    if (setA.has(tcId)) flags.push('A');
    if (setB.has(tcId)) flags.push('B');
    if (setC.has(tcId)) flags.push('C');
    if (setD.has(tcId)) flags.push('D');

    // Account info
    const { rows: users } = await prodPool.query(`
      SELECT u.name, u.email FROM users u WHERE u.user_company_id = $1 AND u.role = 'owner' LIMIT 1
    `, [tc.user_company_id]).catch(() => ({ rows: [] }));

    const { rows: subs } = await prodPool.query(`
      SELECT status FROM subscriptions WHERE user_company_id = $1 ORDER BY created_at DESC LIMIT 1
    `, [tc.user_company_id]).catch(() => ({ rows: [] }));

    const user       = users[0] ?? { name: '(unknown)', email: '(unknown)' };
    const subStatus  = (subs[0]?.status as string | undefined) ?? 'unknown';
    const isActive   = ['active', 'trialing', 'admin_comped'].includes(subStatus);

    result.push({
      tcId,
      companyName:  tc.company_name,
      userCompanyId: tc.user_company_id,
      flags,
      isActive,
      ownerEmail: user.email,
      ownerName:  user.name,
    });
  }

  return result;
}

// ─── PART A: Deal model check ─────────────────────────────────────────────────

interface DealModelInfo {
  hasDealModel: boolean;
  modelId: number | null;
  modelName: string | null;
  storedMultiple: string | null;
  storedAvgYears: number | null;
  effectiveMultiple: string;
  effectiveAvgYears: number;
  usingFallbackMultiple: boolean;
  usingFallbackYears: boolean;
}

async function getDealModelInfo(prodTcId: number): Promise<DealModelInfo> {
  const { rows } = await prodPool.query(`
    SELECT id, name, ebitda_multiple, averaging_years
    FROM deal_models
    WHERE target_company_id = $1
    ORDER BY id
    LIMIT 1
  `, [prodTcId]);

  if (rows.length === 0) {
    return {
      hasDealModel: false,
      modelId: null,
      modelName: null,
      storedMultiple: null,
      storedAvgYears: null,
      effectiveMultiple: FALLBACK_MULTIPLE,
      effectiveAvgYears: FALLBACK_YEARS,
      usingFallbackMultiple: true,
      usingFallbackYears: true,
    };
  }

  const dm = rows[0];
  const stored   = dm.ebitda_multiple != null ? String(dm.ebitda_multiple) : null;
  const storedYr = dm.averaging_years != null ? Number(dm.averaging_years) : null;

  return {
    hasDealModel: true,
    modelId: dm.id as number,
    modelName: dm.name as string | null,
    storedMultiple: stored,
    storedAvgYears: storedYr,
    effectiveMultiple:  stored  ?? FALLBACK_MULTIPLE,
    effectiveAvgYears:  storedYr ?? FALLBACK_YEARS,
    usingFallbackMultiple: stored == null,
    usingFallbackYears:    storedYr == null,
  };
}

// ─── PART B: Null income-winner gap scan ─────────────────────────────────────
//
// Detects the tc=185 pattern on prod:
//   "A statutory full-year period has an IS with null operating_profit,
//    AND a management full-year period exists for the same fiscal year
//    with a non-null operating_profit."
//
// After clone→backfill→reselect this becomes an income winner with null figures,
// silently converting that year's EBITDA to £0 in correctedEbitdaByYear.

interface NullWinnerHit {
  tcId: number;
  companyName: string;
  fiscalYear: number;
  statPeriodId: number;
  statPeriodEnd: string | null;
  statOP: number | null;
  statDA: number | null;
  mgmtPeriodId: number;
  mgmtPeriodEnd: string | null;
  mgmtOP: number | null;
  mgmtDA: number | null;
  mgmtDocName: string | null;
}

async function scanNullWinnerGap(tcIds: number[]): Promise<NullWinnerHit[]> {
  if (tcIds.length === 0) return [];

  const { rows } = await prodPool.query(`
    SELECT
      tc.id               AS tc_id,
      tc.company_name,
      fp_s.fiscal_year,
      fp_s.id             AS stat_period_id,
      fp_s.period_end     AS stat_period_end,
      is_s.operating_profit            AS stat_op,
      is_s.depreciation_amortisation   AS stat_da,
      fp_m.id             AS mgmt_period_id,
      fp_m.period_end     AS mgmt_period_end,
      is_m.operating_profit            AS mgmt_op,
      is_m.depreciation_amortisation   AS mgmt_da,
      d.document_name     AS mgmt_doc_name
    FROM financial_periods fp_s
    JOIN target_companies  tc   ON tc.id  = fp_s.target_company_id
    JOIN income_statements is_s ON is_s.financial_period_id = fp_s.id
    JOIN financial_periods fp_m ON fp_m.target_company_id = fp_s.target_company_id
                                AND fp_m.fiscal_year       = fp_s.fiscal_year
                                AND fp_m.period_type       = 'management'
                                AND fp_m.is_full_year      = true
    JOIN income_statements is_m ON is_m.financial_period_id = fp_m.id
                                AND is_m.operating_profit IS NOT NULL
    LEFT JOIN documents d ON d.id = fp_m.source_document_id
    WHERE fp_s.period_type      = 'statutory'
      AND fp_s.is_full_year     = true
      AND is_s.operating_profit IS NULL
      AND fp_s.target_company_id = ANY($1::int[])
    ORDER BY tc.id, fp_s.fiscal_year
  `, [tcIds]);

  return rows.map(r => ({
    tcId:          r.tc_id as number,
    companyName:   r.company_name as string,
    fiscalYear:    r.fiscal_year as number,
    statPeriodId:  r.stat_period_id as number,
    statPeriodEnd: r.stat_period_end ? String(r.stat_period_end).split('T')[0] : null,
    statOP:        r.stat_op != null ? parseFloat(r.stat_op) : null,
    statDA:        r.stat_da != null ? parseFloat(r.stat_da) : null,
    mgmtPeriodId:  r.mgmt_period_id as number,
    mgmtPeriodEnd: r.mgmt_period_end ? String(r.mgmt_period_end).split('T')[0] : null,
    mgmtOP:        r.mgmt_op != null ? parseFloat(r.mgmt_op) : null,
    mgmtDA:        r.mgmt_da != null ? parseFloat(r.mgmt_da) : null,
    mgmtDocName:   r.mgmt_doc_name as string | null,
  }));
}

// ─── Also check: statutory period with null IS but NO management alternative ──
// (This is the partial-null pattern: statutory wins, null figures, nothing better.)

interface NullStatOnly {
  tcId: number;
  companyName: string;
  fiscalYear: number;
  periodId: number;
  periodEnd: string | null;
  statOP: number | null;
  statDA: number | null;
}

async function scanNullStatNoMgmt(tcIds: number[]): Promise<NullStatOnly[]> {
  if (tcIds.length === 0) return [];

  const { rows } = await prodPool.query(`
    SELECT
      tc.id            AS tc_id,
      tc.company_name,
      fp.fiscal_year,
      fp.id            AS period_id,
      fp.period_end,
      is_s.operating_profit AS stat_op,
      is_s.depreciation_amortisation AS stat_da
    FROM financial_periods fp
    JOIN target_companies tc    ON tc.id = fp.target_company_id
    JOIN income_statements is_s ON is_s.financial_period_id = fp.id
    WHERE fp.period_type = 'statutory'
      AND fp.is_full_year = true
      AND is_s.operating_profit IS NULL
      AND fp.target_company_id = ANY($1::int[])
      AND NOT EXISTS (
        SELECT 1 FROM financial_periods fp2
        JOIN income_statements is2 ON is2.financial_period_id = fp2.id
        WHERE fp2.target_company_id = fp.target_company_id
          AND fp2.fiscal_year = fp.fiscal_year
          AND fp2.is_full_year = true
          AND is2.operating_profit IS NOT NULL
      )
    ORDER BY tc.id, fp.fiscal_year
  `, [tcIds]);

  return rows.map(r => ({
    tcId:      r.tc_id as number,
    companyName: r.company_name as string,
    fiscalYear: r.fiscal_year as number,
    periodId:  r.period_id as number,
    periodEnd: r.period_end ? String(r.period_end).split('T')[0] : null,
    statOP:    r.stat_op != null ? parseFloat(r.stat_op) : null,
    statDA:    r.stat_da != null ? parseFloat(r.stat_da) : null,
  }));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const sep = '═'.repeat(110);
  console.log(sep);
  console.log('EV MULTIPLE VERIFICATION + NULL INCOME-WINNER GAP SCAN');
  console.log(sep);

  await assertProd();

  // Identify the full affected list
  process.stdout.write('Identifying affected companies from prod ... ');
  const all      = await identifyAffectedActive();
  const active   = all.filter(c => c.isActive);
  console.log(`${all.length} affected  |  ${active.length} active\n`);

  // ─── PART A: EV Multiple verification ────────────────────────────────────────

  console.log(sep);
  console.log('PART A — EV Multiple verification (active affected companies)');
  console.log('  comms-analysis fallbacks: multiple=3.0x if null, averagingYears=3 if null');
  console.log('  "ACTIVE+MATERIAL" = active AND EBITDA/EV changed — deal model check covers all active');
  console.log(sep);

  let anyFallbackMultiple = false;
  let hickenbuildFound    = false;

  // Also explicitly check tc=101 even if not flagged
  const activeWithHicken = [...active];
  if (!active.find(c => c.tcId === 101)) {
    const { rows: h } = await prodPool.query(
      'SELECT id, company_name, user_company_id FROM target_companies WHERE id = 101',
    );
    if (h.length > 0) {
      activeWithHicken.push({
        tcId: 101, companyName: h[0].company_name, userCompanyId: h[0].user_company_id,
        flags: ['(explicit check)'], isActive: true,
        ownerEmail: '', ownerName: '',
      });
    }
  }

  const col = (s: string, w: number) => String(s).padEnd(w).slice(0, w);

  console.log(
    col('tc', 5) + col('Company', 32) + col('Active', 8) + col('HasModel', 10) +
    col('StoredMultiple', 16) + col('StoredAvgYrs', 13) + col('EffectiveMultiple', 18) +
    col('EffectiveYrs', 13) + 'FallbackFlags',
  );
  console.log('─'.repeat(115));

  for (const c of activeWithHicken) {
    const dm   = await getDealModelInfo(c.tcId);
    const flag: string[] = [];
    if (dm.usingFallbackMultiple) { flag.push('FALLBACK-MULTIPLE'); anyFallbackMultiple = true; }
    if (dm.usingFallbackYears)    flag.push('FALLBACK-YEARS');
    if (c.tcId === 101) hickenbuildFound = true;

    console.log(
      col(String(c.tcId), 5) +
      col(c.companyName, 32) +
      col(c.isActive ? 'yes' : 'no', 8) +
      col(dm.hasDealModel ? `yes (id=${dm.modelId})` : 'NO', 10) +
      col(dm.storedMultiple ?? '(null)', 16) +
      col(dm.storedAvgYears != null ? String(dm.storedAvgYears) : '(null)', 13) +
      col(dm.effectiveMultiple + 'x', 18) +
      col(String(dm.effectiveAvgYears), 13) +
      (flag.length ? '⚠  ' + flag.join(', ') : '\u2713 own model'),
    );
  }

  console.log('\nNotes:');
  if (anyFallbackMultiple) {
    console.log('  ⚠  Companies with FALLBACK-MULTIPLE had ebitdaMultiple=null in their deal model.');
    console.log('     comms-analysis used 3.0x for them.  For these, quote EBITDA-only in emails — do NOT quote an EV.');
  } else {
    console.log('  \u2713 No active affected company used a fallback multiple — all EVs used the company\'s own stored multiple.');
  }
  if (!hickenbuildFound) {
    console.log('  Hickenbuild (tc=101) was not in the affected list (or had no active account).');
  }

  // ─── PART B: Null income-winner gap scan ─────────────────────────────────────

  console.log('\n\n' + sep);
  console.log('PART B — Null income-winner gap scan (all affected companies)');
  console.log('  Pattern: statutory full-year IS has null OP  AND  management full-year IS');
  console.log('  has non-null OP for the same company+fiscal_year.');
  console.log('  After reselect, statutory wins on tier alone → £0 EBITDA that year.');
  console.log(sep);

  const allTcIds = all.map(c => c.tcId);
  const hits     = await scanNullWinnerGap(allTcIds);

  if (hits.length === 0) {
    console.log('  \u2713 No null-winner gaps found across all affected companies.');
    console.log('  tc=185 trade double glazing pattern does NOT recur on any other affected company.');
  } else {
    console.log(`  ⚠  ${hits.length} null-winner gap(s) found:\n`);
    for (const h of hits) {
      const mgmtEbitda = (h.mgmtOP ?? 0) + (h.mgmtDA ?? 0);
      console.log(`  tc=${h.tcId}  "${h.companyName}"  FY${h.fiscalYear}`);
      console.log(`    Statutory period id=${h.statPeriodId}  end=${h.statPeriodEnd}`);
      console.log(`      IS: OP=${h.statOP ?? 'null'}  DA=${h.statDA ?? 'null'}  → EBITDA would be £0 after reselect`);
      console.log(`    Management period id=${h.mgmtPeriodId}  end=${h.mgmtPeriodEnd}`);
      console.log(`      IS: OP=${gbp(h.mgmtOP)}  DA=${gbp(h.mgmtDA)}  → EBITDA=${gbp(mgmtEbitda)}`);
      console.log(`      Doc: "${h.mgmtDocName ?? '(none)'}"`);
      console.log(`    IMPACT: after reselect, FY${h.fiscalYear} EBITDA becomes £0 instead of ${gbp(mgmtEbitda)}`);
      console.log(`    ROOT CAUSE: selectProjectionWinners() picks by tier rank only — no null-figure fallthrough`);
      console.log();
    }
  }

  // Also report statutory-null-no-alternative (these become £0 but there's no better candidate)
  const nullStatOnly = await scanNullStatNoMgmt(allTcIds);
  const interesting  = nullStatOnly.filter(r => {
    // Only flag if the year would appear in correctedEbitdaByYear with £0
    // (i.e. it's not already in 'hits')
    return !hits.find(h => h.tcId === r.tcId && h.fiscalYear === r.fiscalYear);
  });

  if (interesting.length > 0) {
    console.log(`\n  Additional: ${interesting.length} year(s) with null statutory IS and NO management alternative`);
    console.log('  (these become £0 but there is no better candidate — not a null-winner-gap per se):');
    for (const r of interesting) {
      console.log(`    tc=${r.tcId} "${r.companyName}"  FY${r.fiscalYear}  period_end=${r.periodEnd}  OP=null  DA=${r.statDA ?? 'null'}`);
    }
  }

  // ─── Code-level confirmation of null-winner gap root cause ────────────────────

  console.log('\n\n' + sep);
  console.log('PART B — Code-level analysis (no queries needed)');
  console.log(sep);
  console.log(`
  projection-selector.ts — selectProjectionWinners():
    Winner chosen by:  tierRank(sourceTier) → isPrimaryYear → createdAt → sourceDocumentId
    NO check on figures.operatingProfit or figures.depreciationAmortisation.
    A statutory contribution with { operatingProfit: null } has tierRank=1.
    A management contribution with { operatingProfit: 50000 } has tierRank=2.
    Statutory wins regardless of figures.  The null IS is upserted verbatim.

  projection-reselect.service.ts — upsertIncomeFromFigures():
    Writes figures.operatingProfit ?? null to income_statements.operating_profit.
    No guard.  If winner.figures.operatingProfit is null, IS gets null OP.

  deal-model.service.ts — fetchReportedEbitdaByYear() / getDevEbitdaByYear():
    result[year] = toNum(row.operatingProfit) + toNum(row.depreciationAmortisation)
    toNum(null) = 0, so: null + null = £0.
    The year IS included in correctedEbitdaByYear with EBITDA=£0, silently.
    This is NOT the same as the year being absent — it DRAGS DOWN the average.

  Proposed fix (income-winner-empty guard):
    In selectProjectionWinners() or in reselect() step 4, before crowning a winner:
    if winner.figures.operatingProfit == null AND winner.figures.depreciationAmortisation == null:
      skip this candidate and try the next-best (same group, next in precedence).
    If NO candidate has core figures, mark the year as "data gap" and exclude from averaging.

  Alternatively (softer):
    In getDevEbitdaByYear / fetchReportedEbitdaByYear:
    Add: AND (is_val.operating_profit IS NOT NULL OR is_val.depreciation_amortisation IS NOT NULL)
    This excludes all-null IS rows from the averaging window without changing the winner selection.
`);

  await prodPool.end();
}

main().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
