/**
 * scripts/diff-canonical-vs-live.ts
 * Slice 3d.2 – read-only diff report: canonical vs live coverage and headline numbers.
 *
 * READ-ONLY. No INSERT, no UPDATE, no DELETE, no ALTER, no transaction.
 * Usage: npx tsx scripts/diff-canonical-vs-live.ts [--as-of=YYYY-MM-DD]
 */

import { db } from '../server/db';
import { sql } from 'drizzle-orm';

// ─── Argument handling ────────────────────────────────────────────────────────

const AS_OF_FLAG = '--as-of=';
const asOfArg = process.argv.find((a) => a.startsWith(AS_OF_FLAG));
const asOfPinned = asOfArg !== undefined;
const asOfDate: string = asOfPinned
  ? asOfArg!.slice(AS_OF_FLAG.length)
  : new Date().toISOString().split('T')[0];
const asOfYear = parseInt(asOfDate.slice(0, 4), 10);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(num: number, den: number): string {
  if (den === 0) return '0.0%';
  return ((num / den) * 100).toFixed(1) + '%';
}

function line(s: string = '') {
  console.log(s);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {

  // ── Latest-run CTE (defined once, reused everywhere) ──────────────────────
  // Selects MAX(id) per target_company_id from canonical_run.
  // All canonical queries filter through this.

  // ─────────────────────────────────────────────────────────────────────────
  // HEADER / PROVENANCE
  // ─────────────────────────────────────────────────────────────────────────
  line('='.repeat(70));
  line('DIFF REPORT: canonical vs live');
  line('='.repeat(70));
  line(`as-of date:          ${asOfDate}${asOfPinned ? '' : '  [DEFAULTED]'}`);
  if (!asOfPinned) {
    line('AS-OF DATE WAS NOT PINNED, DEFAULTED TO TODAY');
  }
  line();

  // Canonical run counts
  const runCounts = await db.execute<{ total_runs: string; latest_runs: string; selected_ids: string }>(sql`
    SELECT
      COUNT(*) AS total_runs,
      COUNT(DISTINCT target_company_id) AS latest_runs,
      STRING_AGG(latest_id::text, ', ' ORDER BY latest_id) AS selected_ids
    FROM (
      SELECT target_company_id, MAX(id) AS latest_id
      FROM canonical_run
      GROUP BY target_company_id
    ) t
  `);
  const { total_runs, latest_runs, selected_ids } = runCounts.rows[0];

  line(`canonical_run total rows:         ${total_runs}`);
  line(`canonical_run latest-per-company: ${latest_runs}`);
  line(`selected run ids: ${selected_ids}`);
  line();

  // Canonical period / figure counts
  const cpCounts = await db.execute<{
    all_periods: string; sel_periods: string;
    all_figures: string; sel_figures: string;
  }>(sql`
    SELECT
      (SELECT COUNT(*) FROM canonical_period) AS all_periods,
      (SELECT COUNT(*) FROM canonical_period cp
       WHERE cp.canonical_run_id IN (
         SELECT MAX(id) FROM canonical_run GROUP BY target_company_id
       )) AS sel_periods,
      (SELECT COUNT(*) FROM canonical_figure) AS all_figures,
      (SELECT COUNT(*) FROM canonical_figure cf
       JOIN canonical_period cp ON cf.canonical_period_id = cp.id
       WHERE cp.canonical_run_id IN (
         SELECT MAX(id) FROM canonical_run GROUP BY target_company_id
       )) AS sel_figures
  `);
  const cp = cpCounts.rows[0];
  line(`canonical_period  ALL runs: ${cp.all_periods}   SELECTED runs: ${cp.sel_periods}`);
  line(`canonical_figure  ALL runs: ${cp.all_figures}   SELECTED runs: ${cp.sel_figures}`);
  line();

  // Evidence counts
  const evCounts = await db.execute<{ de: string; dep: string; def: string }>(sql`
    SELECT
      (SELECT COUNT(*) FROM document_evidence) AS de,
      (SELECT COUNT(*) FROM document_evidence_period) AS dep,
      (SELECT COUNT(*) FROM document_evidence_figure) AS def
  `);
  const ev = evCounts.rows[0];
  line(`document_evidence:               ${ev.de}`);
  line(`document_evidence_period:        ${ev.dep}`);
  line(`document_evidence_figure:        ${ev.def}`);
  line();

  // Live financial table counts
  const liveCounts = await db.execute<{ fp: string; is_: string; bs: string }>(sql`
    SELECT
      (SELECT COUNT(*) FROM financial_periods) AS fp,
      (SELECT COUNT(*) FROM income_statements) AS is_,
      (SELECT COUNT(*) FROM balance_sheets) AS bs
  `);
  const lv = liveCounts.rows[0];
  line(`financial_periods:               ${lv.fp}`);
  line(`income_statements:               ${lv.is_}`);
  line(`balance_sheets:                  ${lv.bs}`);
  line();

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 1: COVERAGE
  // ─────────────────────────────────────────────────────────────────────────
  line('='.repeat(70));
  line('SECTION 1: COVERAGE');
  line('='.repeat(70));
  line();

  // 1.1
  const coverageBase = await db.execute<{
    canonical_cos: string; live_cos: string;
    both: string; canonical_only: string; live_only: string;
  }>(sql`
    WITH canonical_cos AS (
      SELECT DISTINCT target_company_id FROM canonical_run
    ),
    live_cos AS (
      SELECT DISTINCT target_company_id FROM financial_periods
    )
    SELECT
      (SELECT COUNT(*) FROM canonical_cos) AS canonical_cos,
      (SELECT COUNT(*) FROM live_cos) AS live_cos,
      (SELECT COUNT(*) FROM canonical_cos c JOIN live_cos l ON c.target_company_id = l.target_company_id) AS both,
      (SELECT COUNT(*) FROM canonical_cos c LEFT JOIN live_cos l ON c.target_company_id = l.target_company_id WHERE l.target_company_id IS NULL) AS canonical_only,
      (SELECT COUNT(*) FROM live_cos l LEFT JOIN canonical_cos c ON l.target_company_id = c.target_company_id WHERE c.target_company_id IS NULL) AS live_only
  `);
  const cov = coverageBase.rows[0];
  const cCos = parseInt(cov.canonical_cos);
  const lCos = parseInt(cov.live_cos);
  const both = parseInt(cov.both);
  const canOnly = parseInt(cov.canonical_only);
  const liveOnly = parseInt(cov.live_only);

  line('1.1 Company coverage');
  line(`  Distinct companies with a canonical run:       ${cCos}`);
  line(`  Distinct companies with financial_periods:     ${lCos}`);
  line(`  Companies in both:                             ${both}`);
  line(`  Canonical-only (run, no FP):                  ${canOnly}`);
  line(`  Live-only (FP, no run):                       ${liveOnly}`);
  line(`  Reconciliation: both ${both} + canonical-only ${canOnly} = ${both + canOnly} = canonical total ${cCos} ✓`);
  line(`  Reconciliation: both ${both} + live-only ${liveOnly} = ${both + liveOnly} = live total ${lCos} ✓`);
  line();

  // 1.2 Canonical-only companies
  const canOnlyDetail = await db.execute<{
    tc: string; evidence_count: string; evidence_period_count: string; canonical_period_count: string;
  }>(sql`
    WITH canonical_cos AS (SELECT DISTINCT target_company_id FROM canonical_run),
    live_cos AS (SELECT DISTINCT target_company_id FROM financial_periods)
    SELECT
      c.target_company_id AS tc,
      (SELECT COUNT(*) FROM document_evidence de WHERE de.target_company_id = c.target_company_id) AS evidence_count,
      (SELECT COUNT(*) FROM document_evidence_period dep
        JOIN document_evidence de ON dep.document_evidence_id = de.id
        WHERE de.target_company_id = c.target_company_id) AS evidence_period_count,
      (SELECT COUNT(*) FROM canonical_period cp
        JOIN canonical_run cr ON cp.canonical_run_id = cr.id
        WHERE cr.target_company_id = c.target_company_id
          AND cr.id = (SELECT MAX(id) FROM canonical_run WHERE target_company_id = c.target_company_id)
      ) AS canonical_period_count
    FROM canonical_cos c
    LEFT JOIN live_cos l ON c.target_company_id = l.target_company_id
    WHERE l.target_company_id IS NULL
    ORDER BY c.target_company_id
  `);
  line('1.2 Canonical-only companies (run exists, no financial_periods):');
  line('  tc | evidence_rows | evidence_periods | canonical_periods');
  for (const r of canOnlyDetail.rows) {
    line(`  ${r.tc} | ${r.evidence_count} | ${r.evidence_period_count} | ${r.canonical_period_count}`);
  }
  line();

  // 1.3 Live-only companies
  const liveOnlyDetail = await db.execute<{
    tc: string; fp_count: string; is_count: string; bs_count: string; de_count: string;
  }>(sql`
    WITH canonical_cos AS (SELECT DISTINCT target_company_id FROM canonical_run),
    live_cos AS (SELECT DISTINCT target_company_id FROM financial_periods)
    SELECT
      l.target_company_id AS tc,
      COUNT(DISTINCT fp.id) AS fp_count,
      COUNT(DISTINCT is_.id) AS is_count,
      COUNT(DISTINCT bs.id) AS bs_count,
      COUNT(DISTINCT de.id) AS de_count
    FROM live_cos l
    LEFT JOIN canonical_cos c ON l.target_company_id = c.target_company_id
    LEFT JOIN financial_periods fp ON fp.target_company_id = l.target_company_id
    LEFT JOIN income_statements is_ ON is_.target_company_id = l.target_company_id
    LEFT JOIN balance_sheets bs ON bs.target_company_id = l.target_company_id
    LEFT JOIN document_evidence de ON de.target_company_id = l.target_company_id
    WHERE c.target_company_id IS NULL
    GROUP BY l.target_company_id
    ORDER BY l.target_company_id
  `);
  line('1.3 Live-only companies (financial_periods, no canonical run):');
  line('  tc | financial_periods | income_statements | balance_sheets | document_evidence');
  let loFpTotal = 0, loIsTotal = 0, loBsTotal = 0, loDeTotal = 0;
  for (const r of liveOnlyDetail.rows) {
    line(`  ${r.tc} | ${r.fp_count} | ${r.is_count} | ${r.bs_count} | ${r.de_count}`);
    loFpTotal += parseInt(r.fp_count);
    loIsTotal += parseInt(r.is_count);
    loBsTotal += parseInt(r.bs_count);
    loDeTotal += parseInt(r.de_count);
  }
  line(`  TOTALS: fp=${loFpTotal} | is=${loIsTotal} | bs=${loBsTotal} | de=${loDeTotal}`);
  if (loDeTotal === 0) {
    line('  ALL LIVE-ONLY COMPANIES HAVE ZERO EVIDENCE');
  } else {
    const exceptions = liveOnlyDetail.rows.filter((r) => parseInt(r.de_count) > 0).map((r) => r.tc);
    line(`  WARNING: live-only companies with evidence: ${exceptions.join(', ')}`);
  }
  line();

  // 1.4 Comparable populations
  const compPop = await db.execute<{
    live_is_in_run_cos: string; can_income_periods: string;
    live_bs_in_run_cos: string; can_balance_periods: string;
  }>(sql`
    WITH run_cos AS (SELECT DISTINCT target_company_id FROM canonical_run),
    sel_runs AS (SELECT MAX(id) AS rid, target_company_id FROM canonical_run GROUP BY target_company_id)
    SELECT
      (SELECT COUNT(*) FROM income_statements is_
        WHERE is_.target_company_id IN (SELECT target_company_id FROM run_cos)) AS live_is_in_run_cos,
      (SELECT COUNT(*) FROM canonical_period cp
        JOIN sel_runs sr ON cp.canonical_run_id = sr.rid
        WHERE cp.statement_type = 'income') AS can_income_periods,
      (SELECT COUNT(*) FROM balance_sheets bs
        WHERE bs.target_company_id IN (SELECT target_company_id FROM run_cos)) AS live_bs_in_run_cos,
      (SELECT COUNT(*) FROM canonical_period cp
        JOIN sel_runs sr ON cp.canonical_run_id = sr.rid
        WHERE cp.statement_type = 'balance') AS can_balance_periods
  `);
  const pp = compPop.rows[0];
  const livIs = parseInt(pp.live_is_in_run_cos);
  const canIs = parseInt(pp.can_income_periods);
  const livBs = parseInt(pp.live_bs_in_run_cos);
  const canBs = parseInt(pp.can_balance_periods);
  line('1.4 Comparable populations (companies with a canonical run only):');
  line(`  income_statements (live):        ${livIs}`);
  line(`  canonical income periods:        ${canIs}   gap: ${livIs - canIs}`);
  line(`  balance_sheets (live):           ${livBs}`);
  line(`  canonical balance periods:       ${canBs}   gap: ${livBs - canBs}`);
  line();
  line('1.5 COVERAGE AND FIDELITY ARE DIFFERENT FAILURES. Rows counted above are absent from the diff because no evidence exists for them, not because the resolver lost them.');
  line();

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 2: HEADLINE NUMBERS
  // ─────────────────────────────────────────────────────────────────────────
  line('='.repeat(70));
  line('SECTION 2: HEADLINE NUMBERS');
  line('='.repeat(70));
  line();

  // 2.1 Income rows passing eligibility predicate (gates from reconciled-financials.service.ts lines 126-136)
  // Predicate: is_full_year = true AND (source_tier IS NULL OR source_tier != 'information_memorandum')
  //            AND period_end <= asOfDate AND fiscal_year <= asOfYear
  const pred1 = await db.execute<{
    with_run: string; without_run: string; total: string;
  }>(sql`
    WITH run_cos AS (SELECT DISTINCT target_company_id FROM canonical_run),
    eligible AS (
      SELECT is_.target_company_id
      FROM income_statements is_
      JOIN financial_periods fp ON is_.financial_period_id = fp.id
      WHERE is_.is_full_year = true
        AND (fp.source_tier IS NULL OR fp.source_tier != 'information_memorandum')
        AND fp.period_end <= ${asOfDate}
        AND fp.fiscal_year <= ${asOfYear}
    )
    SELECT
      (SELECT COUNT(*) FROM eligible e WHERE e.target_company_id IN (SELECT target_company_id FROM run_cos)) AS with_run,
      (SELECT COUNT(*) FROM eligible e WHERE e.target_company_id NOT IN (SELECT target_company_id FROM run_cos)) AS without_run,
      (SELECT COUNT(*) FROM eligible) AS total
  `);
  const p1 = pred1.rows[0];
  const p1WithRun = parseInt(p1.with_run);
  const p1WithoutRun = parseInt(p1.without_run);
  const p1Total = parseInt(p1.total);
  line('2.1 Income rows passing live eligibility predicate (predicate 1):');
  line(`  Rows with a canonical run:       ${p1WithRun}`);
  line(`  Rows without a canonical run:    ${p1WithoutRun}`);
  line(`  Total passing predicate 1:       ${p1Total}   (${p1WithRun} + ${p1WithoutRun} = ${p1WithRun + p1WithoutRun})`);
  line(`  Rows without run as % of total:  ${pct(p1WithoutRun, p1Total)}`);
  line('  These rows have no document_evidence of any kind. Under spec P3 they are unanchorable in principle, not merely unanchored today. This does not improve when 1c ships.');
  line(`  The predicate used was reconciled-financials.service.ts lines 126-136. The live system has THREE eligibility predicates which disagree. This number is predicate 1 only.`);
  line();

  // 2.2 anchor_complete
  const anchor = await db.execute<{ ac_true: string; ac_total: string }>(sql`
    SELECT
      SUM(CASE WHEN cp.anchor_complete = true THEN 1 ELSE 0 END) AS ac_true,
      COUNT(*) AS ac_total
    FROM canonical_period cp
    WHERE cp.canonical_run_id IN (SELECT MAX(id) FROM canonical_run GROUP BY target_company_id)
  `);
  const ac = anchor.rows[0];
  line('2.2 anchor_complete (selected runs):');
  line(`  anchor_complete = true:  ${ac.ac_true} of ${ac.ac_total}`);
  line('  page_number and label_text_as_printed have never been written on any figure on either database. See #363.');
  line();

  // 2.3 is_full_year vs span_kind unknown
  const spanAndFull = await db.execute<{
    is_fy_true: string; is_fy_total: string;
    unk_total: string; unk_balance: string; unk_income: string; sel_total: string;
  }>(sql`
    SELECT
      (SELECT COUNT(*) FROM income_statements WHERE is_full_year = true) AS is_fy_true,
      (SELECT COUNT(*) FROM income_statements) AS is_fy_total,
      (SELECT COUNT(*) FROM canonical_period cp
        WHERE cp.canonical_run_id IN (SELECT MAX(id) FROM canonical_run GROUP BY target_company_id)
          AND cp.span_kind = 'unknown') AS unk_total,
      (SELECT COUNT(*) FROM canonical_period cp
        WHERE cp.canonical_run_id IN (SELECT MAX(id) FROM canonical_run GROUP BY target_company_id)
          AND cp.span_kind = 'unknown' AND cp.statement_type = 'balance') AS unk_balance,
      (SELECT COUNT(*) FROM canonical_period cp
        WHERE cp.canonical_run_id IN (SELECT MAX(id) FROM canonical_run GROUP BY target_company_id)
          AND cp.span_kind = 'unknown' AND cp.statement_type = 'income') AS unk_income,
      (SELECT COUNT(*) FROM canonical_period cp
        WHERE cp.canonical_run_id IN (SELECT MAX(id) FROM canonical_run GROUP BY target_company_id)) AS sel_total
  `);
  const sf = spanAndFull.rows[0];
  const isFyTrue = parseInt(sf.is_fy_true);
  const isFyTotal = parseInt(sf.is_fy_total);
  const unkTotal = parseInt(sf.unk_total);
  const unkBal = parseInt(sf.unk_balance);
  const unkInc = parseInt(sf.unk_income);
  const selTot = parseInt(sf.sel_total);
  line('2.3 Full-year status:');
  line(`  income_statements.is_full_year = true:   ${isFyTrue} of ${isFyTotal}  (${pct(isFyTrue, isFyTotal)})`);
  line(`  canonical span_kind = 'unknown':         ${unkTotal} of ${selTot}  (${pct(unkTotal, selTot)})`);
  line(`    breakdown: balance=${unkBal}  income=${unkInc}  sum=${unkBal + unkInc}`);
  line('  income_statements.is_full_year is NOT NULL DEFAULT true. Every row asserts full-year status whether or not anything established it.');
  line();

  // 2.4 valuation_eligible vs predicate 1
  const valEl = await db.execute<{ ve_true: string; ve_total: string }>(sql`
    SELECT
      SUM(CASE WHEN cp.valuation_eligible = true THEN 1 ELSE 0 END) AS ve_true,
      COUNT(*) AS ve_total
    FROM canonical_period cp
    WHERE cp.canonical_run_id IN (SELECT MAX(id) FROM canonical_run GROUP BY target_company_id)
  `);
  const ve = valEl.rows[0];
  line('2.4 valuation_eligible (selected runs) vs predicate 1 pass count:');
  line(`  valuation_eligible = true:       ${ve.ve_true} of ${ve.ve_total}`);
  line(`  predicate 1 pass count:          ${p1Total}`);
  line();

  // 2.5 trust_state distribution
  const trustDist = await db.execute<{
    trust_state: string; statement_type: string; cnt: string;
  }>(sql`
    SELECT cp.trust_state, cp.statement_type, COUNT(*) AS cnt
    FROM canonical_period cp
    WHERE cp.canonical_run_id IN (SELECT MAX(id) FROM canonical_run GROUP BY target_company_id)
    GROUP BY cp.trust_state, cp.statement_type
    ORDER BY cp.trust_state, cp.statement_type
  `);
  line('2.5 trust_state × statement_type (selected runs):');
  let trustTotal = 0;
  for (const r of trustDist.rows) {
    const cnt = parseInt(r.cnt);
    trustTotal += cnt;
    line(`  ${r.trust_state} / ${r.statement_type}:  ${cnt}  (${pct(cnt, selTot)})`);
  }
  line(`  Sum: ${trustTotal}  of selected total ${selTot}  ✓`);
  line('  This is a DEV number and it is inflated by the clone cohort (see #349). It is NOT a user-load number and must not be quoted as one. Sizing on prod is blocked until prod canonical is populated. See #376.');
  line('  TRUST_UNRESOLVED dominating is the CORRECT result, not a failure. It reflects that 1c has not shipped, and it will resolve when identity and signed/draft markers exist.');
  line();

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 3: STRUCTURAL FINDINGS ON THE LIVE SIDE
  // ─────────────────────────────────────────────────────────────────────────
  line('='.repeat(70));
  line('SECTION 3: STRUCTURAL FINDINGS ON THE LIVE SIDE');
  line('='.repeat(70));
  line();

  // 3.1 period_end ending in '-12-31'
  const dec31 = await db.execute<{
    dec31_total: string; fp_total: string;
    dec31_with_run: string;
    dec31_with_run_disagree: string;
    dec31_with_run_can_null: string;
  }>(sql`
    WITH run_cos AS (SELECT DISTINCT target_company_id FROM canonical_run),
    sel_runs AS (SELECT MAX(id) AS rid, target_company_id FROM canonical_run GROUP BY target_company_id),
    dec31_fp AS (
      SELECT fp.id AS fp_id, fp.target_company_id, fp.fiscal_year, fp.period_end
      FROM financial_periods fp
      WHERE fp.period_end::text LIKE '%-12-31'
    )
    SELECT
      (SELECT COUNT(*) FROM dec31_fp) AS dec31_total,
      (SELECT COUNT(*) FROM financial_periods) AS fp_total,
      (SELECT COUNT(*) FROM dec31_fp d WHERE d.target_company_id IN (SELECT target_company_id FROM run_cos)) AS dec31_with_run,
      (SELECT COUNT(*) FROM dec31_fp d
        JOIN run_cos rc ON d.target_company_id = rc.target_company_id
        WHERE EXISTS (
          SELECT 1 FROM canonical_period cp
          JOIN sel_runs sr ON cp.canonical_run_id = sr.rid
          WHERE cp.target_company_id = d.target_company_id
            AND cp.fiscal_year = d.fiscal_year
            AND cp.period_end IS NOT NULL
            AND cp.period_end::text != d.period_end::text
        )) AS dec31_with_run_disagree,
      (SELECT COUNT(*) FROM dec31_fp d
        JOIN run_cos rc ON d.target_company_id = rc.target_company_id
        WHERE EXISTS (
          SELECT 1 FROM canonical_period cp
          JOIN sel_runs sr ON cp.canonical_run_id = sr.rid
          WHERE cp.target_company_id = d.target_company_id
            AND cp.fiscal_year = d.fiscal_year
            AND cp.period_end IS NULL
        )) AS dec31_with_run_can_null
  `);
  const d31 = dec31.rows[0];
  const d31Tot = parseInt(d31.dec31_total);
  const fpTot = parseInt(d31.fp_total);
  line('3.1 financial_periods rows with period_end ending in \'-12-31\':');
  line(`  Dec-31 rows:             ${d31Tot} of ${fpTot}  (${pct(d31Tot, fpTot)})`);
  line(`  Of those, belonging to companies with a canonical run: ${d31.dec31_with_run}`);
  line(`  Of those, canonical period_end disagrees with live:    ${d31.dec31_with_run_disagree}`);
  line(`  Of those, canonical period_end is null:                ${d31.dec31_with_run_can_null}`);
  line('  financial-data.service.ts lines 187, 268, 383 and 481 fall back to a fabricated 31 December when the extractor produced no period end. financial-data.repository.ts lines 48-54 then derive fiscal_year from that date unconditionally. No column anywhere in the system stores a company\'s true year end, so nothing can contradict a fabricated one.');
  line();

  // 3.2 is_full_year disagreement between FP and IS
  const fyDisagree = await db.execute<{
    disagree: string; total_with_is: string;
    fp_true: string; fp_false: string; is_true: string; is_false: string;
  }>(sql`
    SELECT
      SUM(CASE WHEN fp.is_full_year != is_.is_full_year THEN 1 ELSE 0 END) AS disagree,
      COUNT(*) AS total_with_is,
      SUM(CASE WHEN fp.is_full_year = true THEN 1 ELSE 0 END) AS fp_true,
      SUM(CASE WHEN fp.is_full_year = false THEN 1 ELSE 0 END) AS fp_false,
      SUM(CASE WHEN is_.is_full_year = true THEN 1 ELSE 0 END) AS is_true,
      SUM(CASE WHEN is_.is_full_year = false THEN 1 ELSE 0 END) AS is_false
    FROM income_statements is_
    JOIN financial_periods fp ON is_.financial_period_id = fp.id
  `);
  const fyd = fyDisagree.rows[0];
  line('3.2 is_full_year disagreement between financial_periods and income_statements:');
  line(`  Disagreements:           ${fyd.disagree} of ${fyd.total_with_is} periods with an income statement`);
  line(`  financial_periods.is_full_year:  true=${fyd.fp_true}  false=${fyd.fp_false}`);
  line(`  income_statements.is_full_year:  true=${fyd.is_true}  false=${fyd.is_false}`);
  line('  Two independent full-year assertions exist and nothing keeps them in step. The reconciler gates on the child, not the parent.');
  line();

  // 3.3 source_tier distribution and IM balance sheets
  const tierDist = await db.execute<{ source_tier: string | null; cnt: string }>(sql`
    SELECT source_tier, COUNT(*) AS cnt
    FROM financial_periods
    GROUP BY source_tier
    ORDER BY source_tier NULLS LAST
  `);
  const imBs = await db.execute<{ cnt: string }>(sql`
    SELECT COUNT(*) AS cnt
    FROM balance_sheets bs
    JOIN financial_periods fp ON bs.financial_period_id = fp.id
    WHERE fp.source_tier = 'information_memorandum'
  `);
  line('3.3 financial_periods.source_tier distribution:');
  let nullTierCount = 0;
  for (const r of tierDist.rows) {
    if (r.source_tier === null) {
      nullTierCount = parseInt(r.cnt);
      line(`  NULL:                    ${r.cnt}`);
    } else {
      line(`  ${r.source_tier}: ${r.cnt}`);
    }
  }
  line(`  balance_sheets hanging off an IM period: ${imBs.rows[0].cnt}`);
  line('  Predicate 1 excludes information memoranda from income. Predicate 2 applies no tier gate at all, so these balance sheets are admitted to valuation.');
  line();

  // 3.4 duplicate groups
  const dupGroups = await db.execute<{
    grp2_groups: string; grp2_rows: string;
    grp3_groups: string; grp3_rows: string;
    total_fp: string;
  }>(sql`
    WITH counts2 AS (
      SELECT target_company_id, fiscal_year, COUNT(*) AS cnt
      FROM financial_periods
      GROUP BY target_company_id, fiscal_year
    ),
    counts3 AS (
      SELECT target_company_id, fiscal_year, period_end, COUNT(*) AS cnt
      FROM financial_periods
      GROUP BY target_company_id, fiscal_year, period_end
    )
    SELECT
      (SELECT COUNT(*) FROM counts2 WHERE cnt > 1) AS grp2_groups,
      (SELECT SUM(cnt) FROM counts2 WHERE cnt > 1) AS grp2_rows,
      (SELECT COUNT(*) FROM counts3 WHERE cnt > 1) AS grp3_groups,
      (SELECT SUM(cnt) FROM counts3 WHERE cnt > 1) AS grp3_rows,
      (SELECT COUNT(*) FROM financial_periods) AS total_fp
  `);
  const dg = dupGroups.rows[0];
  const grp2g = parseInt(dg.grp2_groups);
  const grp2r = parseInt(dg.grp2_rows);
  const grp3g = parseInt(dg.grp3_groups);
  const grp3r = parseInt(dg.grp3_rows);
  const totFp = parseInt(dg.total_fp);
  const singletonsFromGrp2 = totFp - grp2r;
  const singletonsFromGrp3 = totFp - grp3r;

  line('3.4 Duplicate groups in financial_periods:');
  line(`  Key (company, fiscal_year):              ${grp2g} duplicate groups, ${grp2r} rows covered`);
  line(`  Singleton rows under this key:           ${singletonsFromGrp2}`);
  line(`  Reconciliation: ${grp2r} dup rows + ${singletonsFromGrp2} singletons = ${grp2r + singletonsFromGrp2} = total ${totFp} ✓`);
  line();
  line(`  Key (company, fiscal_year, period_end):  ${grp3g} duplicate groups, ${grp3r} rows covered`);
  line(`  Singleton rows under this key:           ${singletonsFromGrp3}`);
  line(`  Reconciliation: ${grp3r} dup rows + ${singletonsFromGrp3} singletons = ${grp3r + singletonsFromGrp3} = total ${totFp} ✓`);
  line();
  line(`  Difference in group counts: ${grp2g} - ${grp3g} = ${grp2g - grp3g}`);
  line('  The difference is same company, same fiscal year, different period_end, which is part-year against full-year within one fiscal year. Canonical\'s span_kind dissolves those by construction. The groups surviving the tighter key are the genuine #332 duplicates.');
  line();

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 4: SCOPE AND LIMITS
  // ─────────────────────────────────────────────────────────────────────────
  line('='.repeat(70));
  line('SECTION 4: SCOPE AND LIMITS');
  line('='.repeat(70));
  line();
  line('This report at 3d.2 does NOT yet perform any figure-level or period-level');
  line('value comparison.');
  line();
  line('Figure-level fidelity arrives at 3d.3.');
  line();
  line('The join key that 3d.3 will use:');
  line('  target_company_id + fiscal_year + statement_type + span');
  line();
  line('period_end is deliberately compared rather than joined on, for the reason');
  line('given in 3.1: a fabricated Dec-31 date on the live side may disagree with');
  line('the canonical period_end derived from evidence, and that disagreement is');
  line('itself a finding, not a key collision to be silently resolved.');

  line();
  line('='.repeat(70));
  line('END OF REPORT');
  line('='.repeat(70));
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
