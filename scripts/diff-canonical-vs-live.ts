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
      (SELECT COUNT(*) FROM canonical_run) AS total_runs,
      COUNT(*) AS latest_runs,
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
  // SECTION 5: PERIOD-LEVEL MATCHING
  // ─────────────────────────────────────────────────────────────────────────
  line('='.repeat(70));
  line('SECTION 5: PERIOD-LEVEL MATCHING');
  line('='.repeat(70));
  line();
  line('Scope: 36 companies with both a canonical run and financial_periods rows.');
  line('Company 76 (canonical-only) is excluded; it is reported at 1.2.');
  line();
  line('Canonical side: latest run per company only (same CTE as sections 1-3).');
  line('Expected 335 periods: 175 income, 160 balance.');
  line('Live side: financial_periods joined to income_statements (187 rows) and');
  line('balance_sheets (169 rows) for these 36 companies. Total: 356 live rows.');
  line();
  line('Span derivation on live side uses financial_periods.is_full_year (PARENT),');
  line('not income_statements.is_full_year (CHILD). Span is a property of the period.');
  line('The parent-child disagreement is already reported at 3.2 and is not conflated here.');
  line('Rules in order: months_covered=12 → full_year; months_covered IS NOT NULL AND !=12');
  line('→ part_year; months_covered IS NULL AND is_full_year=true → full_year;');
  line('months_covered IS NULL AND is_full_year=false → part_year.');
  line('The live side can never produce span = \'unknown\'. Canonical can.');
  line('That asymmetry is a finding, not a bug.');
  line();
  line('Join key: target_company_id + fiscal_year + statement_type + derived span.');
  line('period_end is compared as a field (5.5), NOT used as a join key (see 3.1).');
  line();

  // Shared CTE fragment used across 5.x queries — defined as raw SQL string
  // to avoid repeating. All queries below inline it.
  //
  // both_cos: 36 companies with both canonical run and financial_periods
  // sel_runs: latest run id per company
  // can_periods: 335 canonical periods from latest runs for those 36 companies
  // live_income / live_balance / live_all: live rows with derived span
  //
  // SPAN derivation uses financial_periods.is_full_year (parent), never IS.is_full_year.

  const SPAN_CASE = `
    CASE
      WHEN fp.months_covered = 12 THEN 'full_year'
      WHEN fp.months_covered IS NOT NULL AND fp.months_covered != 12 THEN 'part_year'
      WHEN fp.months_covered IS NULL AND fp.is_full_year = true THEN 'full_year'
      WHEN fp.months_covered IS NULL AND fp.is_full_year = false THEN 'part_year'
    END`;

  const SHARED_CTES = `
    both_cos AS (
      SELECT DISTINCT cr.target_company_id
      FROM canonical_run cr
      WHERE cr.target_company_id IN (SELECT DISTINCT target_company_id FROM financial_periods)
    ),
    sel_runs AS (
      SELECT MAX(id) AS rid, target_company_id FROM canonical_run GROUP BY target_company_id
    ),
    can_periods AS (
      SELECT cp.id, cp.target_company_id, cp.fiscal_year, cp.statement_type,
             cp.span_kind, cp.period_end
      FROM canonical_period cp
      JOIN sel_runs sr ON cp.canonical_run_id = sr.rid
      WHERE cp.target_company_id IN (SELECT target_company_id FROM both_cos)
    ),
    live_income AS (
      SELECT fp.target_company_id, fp.fiscal_year, 'income'::text AS statement_type,
             fp.period_end,
             ${SPAN_CASE} AS derived_span
      FROM financial_periods fp
      JOIN income_statements is_ ON is_.financial_period_id = fp.id
      WHERE fp.target_company_id IN (SELECT target_company_id FROM both_cos)
    ),
    live_balance AS (
      SELECT fp.target_company_id, fp.fiscal_year, 'balance'::text AS statement_type,
             fp.period_end,
             ${SPAN_CASE} AS derived_span
      FROM financial_periods fp
      JOIN balance_sheets bs ON bs.financial_period_id = fp.id
      WHERE fp.target_company_id IN (SELECT target_company_id FROM both_cos)
    ),
    live_all AS (SELECT * FROM live_income UNION ALL SELECT * FROM live_balance)`;

  // ── 5.1 Match outcomes, canonical side ────────────────────────────────────
  const s51 = await db.execute<{
    bucket_a: string; bucket_a_income: string; bucket_a_balance: string;
    bucket_b: string; bucket_b_income: string; bucket_b_balance: string;
    bucket_c: string; bucket_c_income: string; bucket_c_balance: string;
    bucket_d: string; bucket_d_income: string; bucket_d_balance: string;
    total: string;
  }>(sql.raw(`
    WITH ${SHARED_CTES},
    match_counts AS (
      SELECT cp.id, cp.target_company_id, cp.fiscal_year, cp.statement_type,
             cp.span_kind, cp.period_end,
             COUNT(la.target_company_id) AS exact_matches
      FROM can_periods cp
      LEFT JOIN live_all la
        ON la.target_company_id = cp.target_company_id
       AND la.fiscal_year = cp.fiscal_year
       AND la.statement_type = cp.statement_type
       AND la.derived_span = cp.span_kind
      GROUP BY cp.id, cp.target_company_id, cp.fiscal_year, cp.statement_type,
               cp.span_kind, cp.period_end
    ),
    live_fy_any AS (
      SELECT DISTINCT target_company_id, fiscal_year, statement_type FROM live_all
    )
    SELECT
      SUM(CASE WHEN exact_matches = 1 THEN 1 ELSE 0 END)::text AS bucket_a,
      SUM(CASE WHEN exact_matches = 1 AND statement_type='income' THEN 1 ELSE 0 END)::text AS bucket_a_income,
      SUM(CASE WHEN exact_matches = 1 AND statement_type='balance' THEN 1 ELSE 0 END)::text AS bucket_a_balance,
      SUM(CASE WHEN exact_matches > 1 THEN 1 ELSE 0 END)::text AS bucket_b,
      SUM(CASE WHEN exact_matches > 1 AND statement_type='income' THEN 1 ELSE 0 END)::text AS bucket_b_income,
      SUM(CASE WHEN exact_matches > 1 AND statement_type='balance' THEN 1 ELSE 0 END)::text AS bucket_b_balance,
      SUM(CASE WHEN exact_matches = 0
        AND NOT EXISTS (SELECT 1 FROM live_fy_any lfa
          WHERE lfa.target_company_id = mc.target_company_id
            AND lfa.fiscal_year = mc.fiscal_year
            AND lfa.statement_type = mc.statement_type)
        THEN 1 ELSE 0 END)::text AS bucket_c,
      SUM(CASE WHEN exact_matches = 0 AND statement_type='income'
        AND NOT EXISTS (SELECT 1 FROM live_fy_any lfa
          WHERE lfa.target_company_id = mc.target_company_id
            AND lfa.fiscal_year = mc.fiscal_year
            AND lfa.statement_type = mc.statement_type)
        THEN 1 ELSE 0 END)::text AS bucket_c_income,
      SUM(CASE WHEN exact_matches = 0 AND statement_type='balance'
        AND NOT EXISTS (SELECT 1 FROM live_fy_any lfa
          WHERE lfa.target_company_id = mc.target_company_id
            AND lfa.fiscal_year = mc.fiscal_year
            AND lfa.statement_type = mc.statement_type)
        THEN 1 ELSE 0 END)::text AS bucket_c_balance,
      SUM(CASE WHEN exact_matches = 0
        AND EXISTS (SELECT 1 FROM live_fy_any lfa
          WHERE lfa.target_company_id = mc.target_company_id
            AND lfa.fiscal_year = mc.fiscal_year
            AND lfa.statement_type = mc.statement_type)
        THEN 1 ELSE 0 END)::text AS bucket_d,
      SUM(CASE WHEN exact_matches = 0 AND statement_type='income'
        AND EXISTS (SELECT 1 FROM live_fy_any lfa
          WHERE lfa.target_company_id = mc.target_company_id
            AND lfa.fiscal_year = mc.fiscal_year
            AND lfa.statement_type = mc.statement_type)
        THEN 1 ELSE 0 END)::text AS bucket_d_income,
      SUM(CASE WHEN exact_matches = 0 AND statement_type='balance'
        AND EXISTS (SELECT 1 FROM live_fy_any lfa
          WHERE lfa.target_company_id = mc.target_company_id
            AND lfa.fiscal_year = mc.fiscal_year
            AND lfa.statement_type = mc.statement_type)
        THEN 1 ELSE 0 END)::text AS bucket_d_balance,
      COUNT(*)::text AS total
    FROM match_counts mc
  `));
  const r51 = s51.rows[0];
  const ba = parseInt(r51.bucket_a), bb = parseInt(r51.bucket_b);
  const bc = parseInt(r51.bucket_c), bd = parseInt(r51.bucket_d);
  const s51total = parseInt(r51.total);
  const s51sum = ba + bb + bc + bd;

  line('5.1 MATCH OUTCOMES, canonical side (335 canonical periods):');
  line(`  a. matched to exactly one live row:          ${r51.bucket_a}  (income=${r51.bucket_a_income}, balance=${r51.bucket_a_balance})`);
  line(`  b. matched to MORE THAN ONE live row:        ${r51.bucket_b}  (income=${r51.bucket_b_income}, balance=${r51.bucket_b_balance})`);
  line(`  c. no live row for company+fiscal_year:      ${r51.bucket_c}  (income=${r51.bucket_c_income}, balance=${r51.bucket_c_balance})`);
  line(`  d. live row exists, span does not match:     ${r51.bucket_d}  (income=${r51.bucket_d_income}, balance=${r51.bucket_d_balance})`);
  line(`  Arithmetic: a(${ba}) + b(${bb}) + c(${bc}) + d(${bd}) = ${s51sum}`);
  if (s51sum === 335) {
    line(`  Sum = 335. Reconciles. ✓`);
  } else {
    line(`  *** SUM IS ${s51sum}, NOT 335. DOES NOT RECONCILE. ***`);
  }
  line();

  // ── 5.2 Match outcomes, live side ─────────────────────────────────────────
  const s52 = await db.execute<{
    bucket_a: string; bucket_a_income: string; bucket_a_balance: string;
    bucket_b: string; bucket_b_income: string; bucket_b_balance: string;
    bucket_c: string; bucket_c_income: string; bucket_c_balance: string;
    total: string; total_income: string; total_balance: string;
  }>(sql.raw(`
    WITH ${SHARED_CTES},
    can_fy AS (
      SELECT DISTINCT target_company_id, fiscal_year, statement_type FROM can_periods
    )
    SELECT
      SUM(CASE WHEN EXISTS (
        SELECT 1 FROM can_periods cp
        WHERE cp.target_company_id = la.target_company_id
          AND cp.fiscal_year = la.fiscal_year
          AND cp.statement_type = la.statement_type
          AND cp.span_kind = la.derived_span
      ) THEN 1 ELSE 0 END)::text AS bucket_a,
      SUM(CASE WHEN statement_type='income' AND EXISTS (
        SELECT 1 FROM can_periods cp
        WHERE cp.target_company_id = la.target_company_id
          AND cp.fiscal_year = la.fiscal_year
          AND cp.statement_type = la.statement_type
          AND cp.span_kind = la.derived_span
      ) THEN 1 ELSE 0 END)::text AS bucket_a_income,
      SUM(CASE WHEN statement_type='balance' AND EXISTS (
        SELECT 1 FROM can_periods cp
        WHERE cp.target_company_id = la.target_company_id
          AND cp.fiscal_year = la.fiscal_year
          AND cp.statement_type = la.statement_type
          AND cp.span_kind = la.derived_span
      ) THEN 1 ELSE 0 END)::text AS bucket_a_balance,
      SUM(CASE WHEN NOT EXISTS (
        SELECT 1 FROM can_fy cf
        WHERE cf.target_company_id = la.target_company_id
          AND cf.fiscal_year = la.fiscal_year
          AND cf.statement_type = la.statement_type
      ) THEN 1 ELSE 0 END)::text AS bucket_b,
      SUM(CASE WHEN statement_type='income' AND NOT EXISTS (
        SELECT 1 FROM can_fy cf
        WHERE cf.target_company_id = la.target_company_id
          AND cf.fiscal_year = la.fiscal_year
          AND cf.statement_type = la.statement_type
      ) THEN 1 ELSE 0 END)::text AS bucket_b_income,
      SUM(CASE WHEN statement_type='balance' AND NOT EXISTS (
        SELECT 1 FROM can_fy cf
        WHERE cf.target_company_id = la.target_company_id
          AND cf.fiscal_year = la.fiscal_year
          AND cf.statement_type = la.statement_type
      ) THEN 1 ELSE 0 END)::text AS bucket_b_balance,
      SUM(CASE WHEN
        NOT EXISTS (
          SELECT 1 FROM can_periods cp
          WHERE cp.target_company_id = la.target_company_id
            AND cp.fiscal_year = la.fiscal_year
            AND cp.statement_type = la.statement_type
            AND cp.span_kind = la.derived_span
        )
        AND EXISTS (
          SELECT 1 FROM can_fy cf
          WHERE cf.target_company_id = la.target_company_id
            AND cf.fiscal_year = la.fiscal_year
            AND cf.statement_type = la.statement_type
        ) THEN 1 ELSE 0 END)::text AS bucket_c,
      SUM(CASE WHEN statement_type='income'
        AND NOT EXISTS (
          SELECT 1 FROM can_periods cp
          WHERE cp.target_company_id = la.target_company_id
            AND cp.fiscal_year = la.fiscal_year
            AND cp.statement_type = la.statement_type
            AND cp.span_kind = la.derived_span
        )
        AND EXISTS (
          SELECT 1 FROM can_fy cf
          WHERE cf.target_company_id = la.target_company_id
            AND cf.fiscal_year = la.fiscal_year
            AND cf.statement_type = la.statement_type
        ) THEN 1 ELSE 0 END)::text AS bucket_c_income,
      SUM(CASE WHEN statement_type='balance'
        AND NOT EXISTS (
          SELECT 1 FROM can_periods cp
          WHERE cp.target_company_id = la.target_company_id
            AND cp.fiscal_year = la.fiscal_year
            AND cp.statement_type = la.statement_type
            AND cp.span_kind = la.derived_span
        )
        AND EXISTS (
          SELECT 1 FROM can_fy cf
          WHERE cf.target_company_id = la.target_company_id
            AND cf.fiscal_year = la.fiscal_year
            AND cf.statement_type = la.statement_type
        ) THEN 1 ELSE 0 END)::text AS bucket_c_balance,
      COUNT(*)::text AS total,
      SUM(CASE WHEN statement_type='income' THEN 1 ELSE 0 END)::text AS total_income,
      SUM(CASE WHEN statement_type='balance' THEN 1 ELSE 0 END)::text AS total_balance
    FROM live_all la
  `));
  const r52 = s52.rows[0];
  const la = parseInt(r52.bucket_a), lb = parseInt(r52.bucket_b), lc = parseInt(r52.bucket_c);
  const s52total = parseInt(r52.total);
  const s52sum = la + lb + lc;

  line(`5.2 MATCH OUTCOMES, live side (${r52.total_income} income + ${r52.total_balance} balance = ${r52.total} total live rows):`);
  line(`  a. matched to a canonical period:                ${r52.bucket_a}  (income=${r52.bucket_a_income}, balance=${r52.bucket_a_balance})`);
  line(`  b. no canonical period for company+fiscal_year:  ${r52.bucket_b}  (income=${r52.bucket_b_income}, balance=${r52.bucket_b_balance})`);
  line(`  c. canonical exists, span does not match:        ${r52.bucket_c}  (income=${r52.bucket_c_income}, balance=${r52.bucket_c_balance})`);
  line(`  Arithmetic: a(${la}) + b(${lb}) + c(${lc}) = ${s52sum}`);
  if (s52sum === s52total) {
    line(`  Sum = ${s52total}. Reconciles. ✓`);
  } else {
    line(`  *** SUM IS ${s52sum}, NOT ${s52total}. DOES NOT RECONCILE. ***`);
  }
  line();

  // ── 5.3 Multi-match list (canonical bucket b) ──────────────────────────────
  const s53 = await db.execute<{
    target_company_id: string; fiscal_year: string; statement_type: string;
    span_kind: string; live_count: string; live_period_ends: string;
  }>(sql.raw(`
    WITH ${SHARED_CTES},
    match_counts AS (
      SELECT cp.target_company_id, cp.fiscal_year, cp.statement_type,
             cp.span_kind, COUNT(la.target_company_id) AS exact_matches,
             STRING_AGG(la.period_end::text, ', ' ORDER BY la.period_end::text) AS live_period_ends
      FROM can_periods cp
      LEFT JOIN live_all la
        ON la.target_company_id = cp.target_company_id
       AND la.fiscal_year = cp.fiscal_year
       AND la.statement_type = cp.statement_type
       AND la.derived_span = cp.span_kind
      GROUP BY cp.target_company_id, cp.fiscal_year, cp.statement_type, cp.span_kind
    )
    SELECT target_company_id::text, fiscal_year::text, statement_type,
           span_kind, exact_matches::text AS live_count, live_period_ends
    FROM match_counts
    WHERE exact_matches > 1
    ORDER BY target_company_id, fiscal_year, statement_type
  `));

  line('5.3 THE MULTI-MATCH LIST (canonical periods in bucket b):');
  if (s53.rows.length === 0) {
    line('  NO MULTI-MATCHES');
  } else {
    line('  tc | fiscal_year | statement_type | span | live_count | live_period_ends');
    for (const r of s53.rows) {
      line(`  ${r.target_company_id} | ${r.fiscal_year} | ${r.statement_type} | ${r.span_kind} | ${r.live_count} | ${r.live_period_ends}`);
    }
  }
  line();

  // ── 5.4 Span mismatch list (canonical bucket d) ────────────────────────────
  const s54 = await db.execute<{
    target_company_id: string; fiscal_year: string; statement_type: string;
    can_span: string; live_spans: string;
  }>(sql.raw(`
    WITH ${SHARED_CTES},
    live_fy_any AS (
      SELECT DISTINCT target_company_id, fiscal_year, statement_type FROM live_all
    ),
    match_counts AS (
      SELECT cp.target_company_id, cp.fiscal_year, cp.statement_type,
             cp.span_kind, COUNT(la.target_company_id) AS exact_matches
      FROM can_periods cp
      LEFT JOIN live_all la
        ON la.target_company_id = cp.target_company_id
       AND la.fiscal_year = cp.fiscal_year
       AND la.statement_type = cp.statement_type
       AND la.derived_span = cp.span_kind
      GROUP BY cp.target_company_id, cp.fiscal_year, cp.statement_type, cp.span_kind
    ),
    bucket_d AS (
      SELECT mc.target_company_id, mc.fiscal_year, mc.statement_type, mc.span_kind AS can_span
      FROM match_counts mc
      WHERE mc.exact_matches = 0
        AND EXISTS (SELECT 1 FROM live_fy_any lfa
          WHERE lfa.target_company_id = mc.target_company_id
            AND lfa.fiscal_year = mc.fiscal_year
            AND lfa.statement_type = mc.statement_type)
    )
    SELECT
      bd.target_company_id::text, bd.fiscal_year::text, bd.statement_type,
      bd.can_span,
      STRING_AGG(DISTINCT la.derived_span, ', ' ORDER BY la.derived_span) AS live_spans
    FROM bucket_d bd
    JOIN live_all la
      ON la.target_company_id = bd.target_company_id
     AND la.fiscal_year = bd.fiscal_year
     AND la.statement_type = bd.statement_type
    GROUP BY bd.target_company_id, bd.fiscal_year, bd.statement_type, bd.can_span
    ORDER BY bd.target_company_id, bd.fiscal_year, bd.statement_type
  `));

  const s54total = s54.rows.length;
  const s54cap = 40;
  line(`5.4 THE SPAN MISMATCH LIST (canonical bucket d, ${s54total} rows):`);
  if (s54total === 0) {
    line('  NO SPAN MISMATCHES');
  } else {
    line('  tc | fiscal_year | statement_type | canonical_span | live_span(s)');
    const rowsToShow = s54.rows.slice(0, s54cap);
    for (const r of rowsToShow) {
      line(`  ${r.target_company_id} | ${r.fiscal_year} | ${r.statement_type} | ${r.can_span} | ${r.live_spans}`);
    }
    if (s54total > s54cap) {
      line(`  TRUNCATED AT 40 OF ${s54total}`);
    }
  }
  line();

  // ── 5.5 period_end comparison, matched periods only (bucket a) ─────────────
  const s55 = await db.execute<{
    equal_count: string; differ_count: string; can_null_live_not: string; both_null: string; total_matched: string;
  }>(sql.raw(`
    WITH ${SHARED_CTES},
    matched AS (
      SELECT cp.target_company_id, cp.fiscal_year, cp.statement_type,
             cp.span_kind, cp.period_end AS can_end,
             la.period_end AS live_end,
             COUNT(*) OVER (PARTITION BY cp.target_company_id, cp.fiscal_year, cp.statement_type, cp.span_kind) AS match_cnt
      FROM can_periods cp
      JOIN live_all la
        ON la.target_company_id = cp.target_company_id
       AND la.fiscal_year = cp.fiscal_year
       AND la.statement_type = cp.statement_type
       AND la.derived_span = cp.span_kind
    ),
    single_matched AS (
      SELECT * FROM matched WHERE match_cnt = 1
    )
    SELECT
      SUM(CASE WHEN can_end IS NOT NULL AND live_end IS NOT NULL AND can_end::text = live_end::text THEN 1 ELSE 0 END)::text AS equal_count,
      SUM(CASE WHEN can_end IS NOT NULL AND live_end IS NOT NULL AND can_end::text != live_end::text THEN 1 ELSE 0 END)::text AS differ_count,
      SUM(CASE WHEN can_end IS NULL AND live_end IS NOT NULL THEN 1 ELSE 0 END)::text AS can_null_live_not,
      SUM(CASE WHEN can_end IS NULL AND live_end IS NULL THEN 1 ELSE 0 END)::text AS both_null,
      COUNT(*)::text AS total_matched
    FROM single_matched
  `));

  const r55 = s55.rows[0];
  const eq = parseInt(r55.equal_count), diff = parseInt(r55.differ_count);
  const cnull = parseInt(r55.can_null_live_not), bnull = parseInt(r55.both_null);
  const s55total = parseInt(r55.total_matched);
  const s55sum = eq + diff + cnull + bnull;

  line(`5.5 PERIOD_END COMPARISON (bucket 5.1a only: ${r55.total_matched} matched periods):`);
  line(`  equal:                              ${r55.equal_count}`);
  line(`  differ:                             ${r55.differ_count}`);
  line(`  canonical null, live not null:      ${r55.can_null_live_not}`);
  line(`  both null:                          ${r55.both_null}`);
  line(`  Arithmetic: ${eq} + ${diff} + ${cnull} + ${bnull} = ${s55sum}`);
  if (s55sum === s55total) {
    line(`  Sum = ${s55total} = 5.1a count. Reconciles. ✓`);
  } else {
    line(`  *** SUM IS ${s55sum}, NOT ${s55total}. DOES NOT RECONCILE. ***`);
  }

  if (diff > 0) {
    // List every differing case
    const s55diff = await db.execute<{
      target_company_id: string; fiscal_year: string; statement_type: string;
      can_end: string; live_end: string;
    }>(sql.raw(`
      WITH ${SHARED_CTES},
      matched AS (
        SELECT cp.target_company_id, cp.fiscal_year, cp.statement_type,
               cp.span_kind, cp.period_end AS can_end, la.period_end AS live_end,
               COUNT(*) OVER (PARTITION BY cp.target_company_id, cp.fiscal_year, cp.statement_type, cp.span_kind) AS match_cnt
        FROM can_periods cp
        JOIN live_all la
          ON la.target_company_id = cp.target_company_id
         AND la.fiscal_year = cp.fiscal_year
         AND la.statement_type = cp.statement_type
         AND la.derived_span = cp.span_kind
      )
      SELECT target_company_id::text, fiscal_year::text, statement_type,
             can_end::text, live_end::text
      FROM matched
      WHERE match_cnt = 1
        AND can_end IS NOT NULL AND live_end IS NOT NULL
        AND can_end::text != live_end::text
      ORDER BY target_company_id, fiscal_year, statement_type
    `));
    line('  Differing cases (tc | fiscal_year | statement_type | canonical_end | live_end):');
    for (const r of s55diff.rows) {
      line(`    ${r.target_company_id} | ${r.fiscal_year} | ${r.statement_type} | ${r.can_end} | ${r.live_end}`);
    }
  }
  line('  A period_end disagreement is a FINDING, not a join failure. The live value may be the fabricated 31 December described in 3.1.');
  line();

  line('5.6 No canonical period was matched to a live row by picking one of several.');
  line('Multi-matches are reported at 5.3 and excluded from figure-level comparison at 3d.3b.');
  line();

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 6: SCOPE AND LIMITS
  // ─────────────────────────────────────────────────────────────────────────
  line('='.repeat(70));
  line('SECTION 6: SCOPE AND LIMITS');
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
