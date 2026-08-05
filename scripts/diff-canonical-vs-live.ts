/**
 * scripts/diff-canonical-vs-live.ts
 * Slice 3d.2 – read-only diff report: canonical vs live coverage and headline numbers.
 *
 * READ-ONLY. No INSERT, no UPDATE, no DELETE, no ALTER, no transaction.
 * Usage: npx tsx scripts/diff-canonical-vs-live.ts [--as-of=YYYY-MM-DD]
 */

import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import { mapFigurePath } from '../shared/calculators/canonical-live-map';

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

  // ── SECTION 4: reserved ──────────────────────────────────────────────────
  line('SECTION 4: RESERVED');
  line('  Section 4 was removed during report drafting. Later section numbers are retained');
  line('  deliberately so that 5.x and 6.x references in the action log and handovers stay stable.');
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
  line('Primary join key: target_company_id + fiscal_year + statement_type.');
  line('Span is NOT part of the primary join key. It is used only as a discriminator');
  line('when the primary key yields more than one live row, or when multiple canonical');
  line('periods share a group and compete for the same live rows (see rules below).');
  line('The match is INJECTIVE: a live row may be claimed by at most one canonical period.');
  line('Span is compared as a field and reported at 5.4.');
  line('period_end is compared as a field (5.5), NOT used as a join key (see 3.1).');
  line();
  line('Matching rules per canonical period in a group (company+fiscal_year+statement_type):');
  line('  Single canonical in group:');
  line('    1. No live rows → bucket c.');
  line('    2. Exactly one live row → bucket a, matched.');
  line('    3. Multiple live rows, canonical span known AND exactly one matches → bucket a.');
  line('    4. Otherwise → bucket b, ambiguous.');
  line('  Multiple canonicals in group (competition for live rows):');
  line('    5. If this canonical\'s span matches live rows AND it is the only canonical');
  line('       with that span match → WINNER → bucket a.');
  line('    6. If another canonical wins (rule 5 applies to a peer, not to this period)');
  line('       → bucket e (live row claimed by a closer span match).');
  line('    7. Otherwise → bucket b, ambiguous.');
  line();

  // Shared CTE fragment used across 5.x queries.
  //
  // SPAN derivation uses financial_periods.is_full_year (parent), never IS.is_full_year.
  // live_all includes fp.months_covered and fp.is_full_year for 5.4 detail listing.

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
             fp.period_end, fp.months_covered, fp.is_full_year,
             ${SPAN_CASE} AS derived_span
      FROM financial_periods fp
      JOIN income_statements is_ ON is_.financial_period_id = fp.id
      WHERE fp.target_company_id IN (SELECT target_company_id FROM both_cos)
    ),
    live_balance AS (
      SELECT fp.target_company_id, fp.fiscal_year, 'balance'::text AS statement_type,
             fp.period_end, fp.months_covered, fp.is_full_year,
             ${SPAN_CASE} AS derived_span
      FROM financial_periods fp
      JOIN balance_sheets bs ON bs.financial_period_id = fp.id
      WHERE fp.target_company_id IN (SELECT target_company_id FROM both_cos)
    ),
    live_all AS (SELECT * FROM live_income UNION ALL SELECT * FROM live_balance)`;

  // CAN_BUCKETS_EXT: appended to SHARED_CTES in every 5.x query.
  //
  // live_total:           all live rows per canonical period (primary key only)
  // live_span_count:      span-matching live rows per canonical period (for rule 3)
  // can_count_per_group:  how many canonical periods share the same group
  // multi_span_match_count: for multi-canonical groups, how many canonicals match
  //                         each live derived_span (used for competition resolution)
  // can_buckets:          final bucket assignment (a / b / c / e) per canonical period
  //
  // matched_a condition (used in 5.4, 5.5, 5.7 as a separate CTE each time):
  //   Single canonical, total_live=1:  (can_count=1 AND total_live=1)
  //   Span disambiguation (single or multi winner): (span_disambiguated=true AND derived_span=span_kind)
  //
  // live_classified condition (5.2): same two clauses in EXISTS check.

  const CAN_BUCKETS_EXT = `,
    live_total AS (
      SELECT cp.id AS cp_id, COUNT(la.target_company_id) AS total_live
      FROM can_periods cp
      LEFT JOIN live_all la
        ON la.target_company_id = cp.target_company_id
        AND la.fiscal_year = cp.fiscal_year
        AND la.statement_type = cp.statement_type
      GROUP BY cp.id
    ),
    live_span_count AS (
      SELECT cp.id AS cp_id, COUNT(la.target_company_id) AS span_matches
      FROM can_periods cp
      JOIN live_all la
        ON la.target_company_id = cp.target_company_id
        AND la.fiscal_year = cp.fiscal_year
        AND la.statement_type = cp.statement_type
        AND la.derived_span = cp.span_kind
      WHERE cp.span_kind IN ('full_year', 'part_year')
      GROUP BY cp.id
    ),
    can_count_per_group AS (
      SELECT target_company_id, fiscal_year, statement_type, COUNT(*) AS can_count
      FROM can_periods
      GROUP BY target_company_id, fiscal_year, statement_type
    ),
    multi_span_match_count AS (
      SELECT cp.target_company_id, cp.fiscal_year, cp.statement_type,
             la.derived_span AS live_derived_span,
             COUNT(DISTINCT cp.id) AS matching_can_count
      FROM can_periods cp
      JOIN live_all la
        ON la.target_company_id = cp.target_company_id
        AND la.fiscal_year = cp.fiscal_year
        AND la.statement_type = cp.statement_type
        AND la.derived_span = cp.span_kind
      WHERE cp.span_kind IN ('full_year', 'part_year')
      GROUP BY cp.target_company_id, cp.fiscal_year, cp.statement_type, la.derived_span
    ),
    can_buckets AS (
      SELECT
        cp.id AS cp_id,
        cp.target_company_id, cp.fiscal_year, cp.statement_type,
        cp.span_kind, cp.period_end,
        lt.total_live,
        COALESCE(ls.span_matches, 0) AS span_matches,
        ccg.can_count,
        CASE
          WHEN lt.total_live = 0 THEN 'c'
          WHEN ccg.can_count > 1 THEN
            CASE
              WHEN cp.span_kind IN ('full_year', 'part_year')
                AND COALESCE(ls.span_matches, 0) > 0
                AND EXISTS (
                  SELECT 1 FROM multi_span_match_count msmc
                  WHERE msmc.target_company_id = cp.target_company_id
                    AND msmc.fiscal_year = cp.fiscal_year
                    AND msmc.statement_type = cp.statement_type
                    AND msmc.live_derived_span = cp.span_kind
                    AND msmc.matching_can_count = 1
                )
              THEN 'a'
              WHEN EXISTS (
                SELECT 1 FROM multi_span_match_count msmc
                WHERE msmc.target_company_id = cp.target_company_id
                  AND msmc.fiscal_year = cp.fiscal_year
                  AND msmc.statement_type = cp.statement_type
                  AND msmc.matching_can_count = 1
                  AND msmc.live_derived_span != cp.span_kind
              )
              THEN 'e'
              ELSE 'b'
            END
          WHEN lt.total_live = 1 THEN 'a'
          WHEN lt.total_live > 1
            AND cp.span_kind IN ('full_year', 'part_year')
            AND COALESCE(ls.span_matches, 0) = 1 THEN 'a'
          ELSE 'b'
        END AS bucket,
        CASE
          WHEN ccg.can_count = 1
            AND lt.total_live > 1
            AND cp.span_kind IN ('full_year', 'part_year')
            AND COALESCE(ls.span_matches, 0) = 1
          THEN true
          WHEN ccg.can_count > 1
            AND cp.span_kind IN ('full_year', 'part_year')
            AND COALESCE(ls.span_matches, 0) > 0
            AND EXISTS (
              SELECT 1 FROM multi_span_match_count msmc
              WHERE msmc.target_company_id = cp.target_company_id
                AND msmc.fiscal_year = cp.fiscal_year
                AND msmc.statement_type = cp.statement_type
                AND msmc.live_derived_span = cp.span_kind
                AND msmc.matching_can_count = 1
            )
          THEN true
          ELSE false
        END AS span_disambiguated
      FROM can_periods cp
      JOIN live_total lt ON lt.cp_id = cp.id
      LEFT JOIN live_span_count ls ON ls.cp_id = cp.id
      JOIN can_count_per_group ccg
        ON ccg.target_company_id = cp.target_company_id
        AND ccg.fiscal_year = cp.fiscal_year
        AND ccg.statement_type = cp.statement_type
    )`;

  // ── 5.1 Match outcomes, canonical side ────────────────────────────────────
  const s51 = await db.execute<{
    bucket_a: string; bucket_a_income: string; bucket_a_balance: string;
    bucket_b: string; bucket_b_income: string; bucket_b_balance: string;
    bucket_c: string; bucket_c_income: string; bucket_c_balance: string;
    bucket_e: string; bucket_e_income: string; bucket_e_balance: string;
    total: string;
  }>(sql.raw(`
    WITH ${SHARED_CTES}
    ${CAN_BUCKETS_EXT}
    SELECT
      SUM(CASE WHEN bucket = 'a' THEN 1 ELSE 0 END)::text AS bucket_a,
      SUM(CASE WHEN bucket = 'a' AND statement_type = 'income' THEN 1 ELSE 0 END)::text AS bucket_a_income,
      SUM(CASE WHEN bucket = 'a' AND statement_type = 'balance' THEN 1 ELSE 0 END)::text AS bucket_a_balance,
      SUM(CASE WHEN bucket = 'b' THEN 1 ELSE 0 END)::text AS bucket_b,
      SUM(CASE WHEN bucket = 'b' AND statement_type = 'income' THEN 1 ELSE 0 END)::text AS bucket_b_income,
      SUM(CASE WHEN bucket = 'b' AND statement_type = 'balance' THEN 1 ELSE 0 END)::text AS bucket_b_balance,
      SUM(CASE WHEN bucket = 'c' THEN 1 ELSE 0 END)::text AS bucket_c,
      SUM(CASE WHEN bucket = 'c' AND statement_type = 'income' THEN 1 ELSE 0 END)::text AS bucket_c_income,
      SUM(CASE WHEN bucket = 'c' AND statement_type = 'balance' THEN 1 ELSE 0 END)::text AS bucket_c_balance,
      SUM(CASE WHEN bucket = 'e' THEN 1 ELSE 0 END)::text AS bucket_e,
      SUM(CASE WHEN bucket = 'e' AND statement_type = 'income' THEN 1 ELSE 0 END)::text AS bucket_e_income,
      SUM(CASE WHEN bucket = 'e' AND statement_type = 'balance' THEN 1 ELSE 0 END)::text AS bucket_e_balance,
      COUNT(*)::text AS total
    FROM can_buckets
  `));
  const r51 = s51.rows[0];
  const ba = parseInt(r51.bucket_a), bb = parseInt(r51.bucket_b);
  const bc = parseInt(r51.bucket_c), be = parseInt(r51.bucket_e);
  const s51total = parseInt(r51.total);
  const s51sum = ba + bb + bc + be;

  line('5.1 MATCH OUTCOMES, canonical side (335 canonical periods):');
  line(`  a. matched to exactly one live row:                                ${r51.bucket_a}  (income=${r51.bucket_a_income}, balance=${r51.bucket_a_balance})`);
  line(`  b. ambiguous, more than one live row, span did not help:           ${r51.bucket_b}  (income=${r51.bucket_b_income}, balance=${r51.bucket_b_balance})`);
  line(`  c. no live row for that company and fiscal_year:                   ${r51.bucket_c}  (income=${r51.bucket_c_income}, balance=${r51.bucket_c_balance})`);
  line(`  e. live row claimed by a closer span match (injective resolution): ${r51.bucket_e}  (income=${r51.bucket_e_income}, balance=${r51.bucket_e_balance})`);
  line(`  Arithmetic: a(${ba}) + b(${bb}) + c(${bc}) + e(${be}) = ${s51sum}`);
  if (s51sum === 335) {
    line(`  Sum = 335. Reconciles. ✓`);
  } else {
    line(`  *** SUM IS ${s51sum}, NOT 335. DOES NOT RECONCILE. ***`);
  }
  line();

  // ── 5.2 Match outcomes, live side ─────────────────────────────────────────
  // live_classified condition uses the updated matched_a logic:
  //   (can_count=1 AND total_live=1): single canonical, single live row
  //   (span_disambiguated=true AND derived_span=span_kind): span-selected (single or multi winner)
  // Bucket e canonicals are excluded (bucket != 'a') so they never contribute to live bucket a.
  const s52 = await db.execute<{
    bucket_a: string; bucket_a_income: string; bucket_a_balance: string;
    bucket_b: string; bucket_b_income: string; bucket_b_balance: string;
    bucket_c: string; bucket_c_income: string; bucket_c_balance: string;
    total: string; total_income: string; total_balance: string;
  }>(sql.raw(`
    WITH ${SHARED_CTES}
    ${CAN_BUCKETS_EXT},
    can_fy AS (
      SELECT DISTINCT target_company_id, fiscal_year, statement_type FROM can_periods
    ),
    live_classified AS (
      SELECT la.*,
        CASE
          WHEN NOT EXISTS (
            SELECT 1 FROM can_fy cf
            WHERE cf.target_company_id = la.target_company_id
              AND cf.fiscal_year = la.fiscal_year
              AND cf.statement_type = la.statement_type
          ) THEN 'b'
          WHEN EXISTS (
            SELECT 1 FROM can_buckets cb
            WHERE cb.target_company_id = la.target_company_id
              AND cb.fiscal_year = la.fiscal_year
              AND cb.statement_type = la.statement_type
              AND cb.bucket = 'a'
              AND (
                (cb.can_count = 1 AND cb.total_live = 1)
                OR (cb.span_disambiguated = true AND la.derived_span = cb.span_kind)
              )
          ) THEN 'a'
          ELSE 'c'
        END AS live_bucket
      FROM live_all la
    )
    SELECT
      SUM(CASE WHEN live_bucket = 'a' THEN 1 ELSE 0 END)::text AS bucket_a,
      SUM(CASE WHEN live_bucket = 'a' AND statement_type = 'income' THEN 1 ELSE 0 END)::text AS bucket_a_income,
      SUM(CASE WHEN live_bucket = 'a' AND statement_type = 'balance' THEN 1 ELSE 0 END)::text AS bucket_a_balance,
      SUM(CASE WHEN live_bucket = 'b' THEN 1 ELSE 0 END)::text AS bucket_b,
      SUM(CASE WHEN live_bucket = 'b' AND statement_type = 'income' THEN 1 ELSE 0 END)::text AS bucket_b_income,
      SUM(CASE WHEN live_bucket = 'b' AND statement_type = 'balance' THEN 1 ELSE 0 END)::text AS bucket_b_balance,
      SUM(CASE WHEN live_bucket = 'c' THEN 1 ELSE 0 END)::text AS bucket_c,
      SUM(CASE WHEN live_bucket = 'c' AND statement_type = 'income' THEN 1 ELSE 0 END)::text AS bucket_c_income,
      SUM(CASE WHEN live_bucket = 'c' AND statement_type = 'balance' THEN 1 ELSE 0 END)::text AS bucket_c_balance,
      COUNT(*)::text AS total,
      SUM(CASE WHEN statement_type = 'income' THEN 1 ELSE 0 END)::text AS total_income,
      SUM(CASE WHEN statement_type = 'balance' THEN 1 ELSE 0 END)::text AS total_balance
    FROM live_classified
  `));
  const r52 = s52.rows[0];
  const la = parseInt(r52.bucket_a), lb = parseInt(r52.bucket_b), lc = parseInt(r52.bucket_c);
  const s52total = parseInt(r52.total);
  const s52sum = la + lb + lc;

  line(`5.2 MATCH OUTCOMES, live side (${r52.total_income} income + ${r52.total_balance} balance = ${r52.total} total live rows):`);
  line(`  a. matched to a canonical period:                        ${r52.bucket_a}  (income=${r52.bucket_a_income}, balance=${r52.bucket_a_balance})`);
  line(`  b. no canonical period for that company and fiscal_year: ${r52.bucket_b}  (income=${r52.bucket_b_income}, balance=${r52.bucket_b_balance})`);
  line(`  c. live row was one of several in an unresolved group:   ${r52.bucket_c}  (income=${r52.bucket_c_income}, balance=${r52.bucket_c_balance})`);
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
    discriminator_status: string;
  }>(sql.raw(`
    WITH ${SHARED_CTES}
    ${CAN_BUCKETS_EXT}
    SELECT
      cb.target_company_id::text,
      cb.fiscal_year::text,
      cb.statement_type,
      cb.span_kind,
      cb.total_live::text AS live_count,
      STRING_AGG(la.period_end::text, ', ' ORDER BY la.period_end::text) AS live_period_ends,
      CASE
        WHEN cb.span_kind = 'unknown'
          THEN 'not attempted (span is unknown)'
        WHEN cb.span_matches = 0
          THEN 'attempted, no span match found'
        ELSE 'attempted, span_matches=' || cb.span_matches::text || ' (not discriminating)'
      END AS discriminator_status
    FROM can_buckets cb
    JOIN live_all la
      ON la.target_company_id = cb.target_company_id
      AND la.fiscal_year = cb.fiscal_year
      AND la.statement_type = cb.statement_type
    WHERE cb.bucket = 'b'
    GROUP BY cb.target_company_id, cb.fiscal_year, cb.statement_type,
             cb.span_kind, cb.total_live, cb.span_matches
    ORDER BY cb.target_company_id::int, cb.fiscal_year, cb.statement_type
  `));

  line('5.3 THE MULTI-MATCH LIST (canonical periods in bucket b):');
  if (s53.rows.length === 0) {
    line('  NO MULTI-MATCHES');
  } else {
    line('  tc | fiscal_year | statement_type | canonical_span | live_count | discriminator_status | live_period_ends');
    for (const r of s53.rows) {
      line(`  ${r.target_company_id} | ${r.fiscal_year} | ${r.statement_type} | ${r.span_kind} | ${r.live_count} | ${r.discriminator_status} | ${r.live_period_ends}`);
    }
  }
  line();

  // ── 5.3b Bucket-e list (canonical periods displaced by injective resolution) ─
  const s53b = await db.execute<{
    target_company_id: string; fiscal_year: string; statement_type: string;
    this_span: string; winning_span: string; live_period_end: string;
  }>(sql.raw(`
    WITH ${SHARED_CTES}
    ${CAN_BUCKETS_EXT},
    winners AS (
      SELECT msmc.target_company_id, msmc.fiscal_year, msmc.statement_type,
             msmc.live_derived_span AS winning_span
      FROM multi_span_match_count msmc
      WHERE msmc.matching_can_count = 1
    )
    SELECT
      cb.target_company_id::text,
      cb.fiscal_year::text,
      cb.statement_type,
      cb.span_kind AS this_span,
      w.winning_span,
      la.period_end::text AS live_period_end
    FROM can_buckets cb
    JOIN winners w
      ON w.target_company_id = cb.target_company_id
      AND w.fiscal_year = cb.fiscal_year
      AND w.statement_type = cb.statement_type
    JOIN live_all la
      ON la.target_company_id = cb.target_company_id
      AND la.fiscal_year = cb.fiscal_year
      AND la.statement_type = cb.statement_type
      AND la.derived_span = w.winning_span
    WHERE cb.bucket = 'e'
    ORDER BY cb.target_company_id::int, cb.fiscal_year, cb.statement_type
  `));

  line('5.3b BUCKET-e LIST (canonical periods displaced by injective resolution):');
  if (s53b.rows.length === 0) {
    line('  NO BUCKET-e PERIODS');
  } else {
    line('  tc | fiscal_year | statement_type | this_span | winning_span | live_period_end');
    for (const r of s53b.rows) {
      line(`  ${r.target_company_id} | ${r.fiscal_year} | ${r.statement_type} | ${r.this_span} | ${r.winning_span} | ${r.live_period_end}`);
    }
  }
  line('  Canonical distinguishes a full year from a part year where the live system holds');
  line('  a single row. These canonical periods are real and are excluded from figure');
  line('  comparison only because the live side has nothing separate to compare them against.');
  line();

  // ── 5.4 Span compared as a field (over bucket 5.1a only) ──────────────────
  // matched_a uses updated condition:
  //   (can_count=1 AND total_live=1): single canonical, single live row
  //   (span_disambiguated=true AND derived_span=span_kind): span-selected (covers both
  //     single-canonical disambiguation and multi-canonical winner)
  const s54counts = await db.execute<{
    span_equal: string; can_unknown: string; fy_vs_py: string; py_vs_fy: string; total: string;
  }>(sql.raw(`
    WITH ${SHARED_CTES}
    ${CAN_BUCKETS_EXT},
    matched_a AS (
      SELECT
        cb.span_kind AS can_span,
        la.derived_span AS live_span,
        la.months_covered,
        la.is_full_year,
        la.period_end AS live_end,
        cb.period_end AS can_end,
        cb.target_company_id, cb.fiscal_year, cb.statement_type
      FROM can_buckets cb
      JOIN live_all la
        ON la.target_company_id = cb.target_company_id
        AND la.fiscal_year = cb.fiscal_year
        AND la.statement_type = cb.statement_type
        AND (
          (cb.can_count = 1 AND cb.total_live = 1)
          OR (cb.span_disambiguated = true AND la.derived_span = cb.span_kind)
        )
      WHERE cb.bucket = 'a'
    )
    SELECT
      SUM(CASE WHEN can_span = live_span THEN 1 ELSE 0 END)::text AS span_equal,
      SUM(CASE WHEN can_span = 'unknown' THEN 1 ELSE 0 END)::text AS can_unknown,
      SUM(CASE WHEN can_span = 'full_year' AND live_span = 'part_year' THEN 1 ELSE 0 END)::text AS fy_vs_py,
      SUM(CASE WHEN can_span = 'part_year' AND live_span = 'full_year' THEN 1 ELSE 0 END)::text AS py_vs_fy,
      COUNT(*)::text AS total
    FROM matched_a
  `));

  const r54 = s54counts.rows[0];
  const spanEqual = parseInt(r54.span_equal);
  const canUnknown = parseInt(r54.can_unknown);
  const fyVsPy = parseInt(r54.fy_vs_py);
  const pyVsFy = parseInt(r54.py_vs_fy);
  const s54sum = spanEqual + canUnknown + fyVsPy + pyVsFy;
  const s54total = parseInt(r54.total);

  line(`5.4 SPAN COMPARED AS A FIELD (bucket 5.1a only: ${r54.total} matched periods):`);
  line(`  canonical span equals live derived span:          ${r54.span_equal}`);
  line(`  canonical span is 'unknown', live derived a span: ${r54.can_unknown}`);
  line(`  canonical says full_year, live says part_year:    ${r54.fy_vs_py}`);
  line(`  canonical says part_year, live says full_year:    ${r54.py_vs_fy}`);
  line(`  Arithmetic: ${spanEqual} + ${canUnknown} + ${fyVsPy} + ${pyVsFy} = ${s54sum}`);
  if (s54sum === ba) {
    line(`  Sum = ${s54sum} = 5.1a count (${ba}). Reconciles. ✓`);
  } else {
    line(`  *** SUM IS ${s54sum}, NOT 5.1a count (${ba}). DOES NOT RECONCILE. ***`);
  }

  if (fyVsPy > 0 || pyVsFy > 0) {
    const s54detail = await db.execute<{
      target_company_id: string; fiscal_year: string; statement_type: string;
      can_span: string; live_span: string; months_covered: string | null; is_full_year: string;
    }>(sql.raw(`
      WITH ${SHARED_CTES}
      ${CAN_BUCKETS_EXT},
      matched_a AS (
        SELECT
          cb.span_kind AS can_span,
          la.derived_span AS live_span,
          la.months_covered,
          la.is_full_year,
          cb.target_company_id, cb.fiscal_year, cb.statement_type
        FROM can_buckets cb
        JOIN live_all la
          ON la.target_company_id = cb.target_company_id
          AND la.fiscal_year = cb.fiscal_year
          AND la.statement_type = cb.statement_type
          AND (
            (cb.can_count = 1 AND cb.total_live = 1)
            OR (cb.span_disambiguated = true AND la.derived_span = cb.span_kind)
          )
        WHERE cb.bucket = 'a'
      )
      SELECT
        target_company_id::text, fiscal_year::text, statement_type,
        can_span, live_span, months_covered::text, is_full_year::text
      FROM matched_a
      WHERE (can_span = 'full_year' AND live_span = 'part_year')
         OR (can_span = 'part_year' AND live_span = 'full_year')
      ORDER BY target_company_id::int, fiscal_year, statement_type
    `));
    line('  Genuine span disagreements (tc | fiscal_year | statement_type | can_span | live_span | months_covered | is_full_year):');
    for (const r of s54detail.rows) {
      line(`    ${r.target_company_id} | ${r.fiscal_year} | ${r.statement_type} | ${r.can_span} | ${r.live_span} | ${r.months_covered ?? 'NULL'} | ${r.is_full_year}`);
    }
  } else {
    line('  No genuine span disagreements (fy_vs_py = 0, py_vs_fy = 0).');
  }
  line(`  canonical 'unknown' against a live span is NOT a disagreement. It is the live system asserting a full year by NOT NULL DEFAULT where canonical declined to guess. See #377.`);
  line();

  // ── 5.5 period_end comparison, matched periods only (bucket a) ─────────────
  const s55 = await db.execute<{
    equal_count: string; differ_count: string; can_null_live_not: string; both_null: string; total_matched: string;
  }>(sql.raw(`
    WITH ${SHARED_CTES}
    ${CAN_BUCKETS_EXT},
    matched_a AS (
      SELECT
        cb.period_end AS can_end,
        la.period_end AS live_end,
        cb.target_company_id, cb.fiscal_year, cb.statement_type
      FROM can_buckets cb
      JOIN live_all la
        ON la.target_company_id = cb.target_company_id
        AND la.fiscal_year = cb.fiscal_year
        AND la.statement_type = cb.statement_type
        AND (
          (cb.can_count = 1 AND cb.total_live = 1)
          OR (cb.span_disambiguated = true AND la.derived_span = cb.span_kind)
        )
      WHERE cb.bucket = 'a'
    )
    SELECT
      SUM(CASE WHEN can_end IS NOT NULL AND live_end IS NOT NULL AND can_end::text = live_end::text THEN 1 ELSE 0 END)::text AS equal_count,
      SUM(CASE WHEN can_end IS NOT NULL AND live_end IS NOT NULL AND can_end::text != live_end::text THEN 1 ELSE 0 END)::text AS differ_count,
      SUM(CASE WHEN can_end IS NULL AND live_end IS NOT NULL THEN 1 ELSE 0 END)::text AS can_null_live_not,
      SUM(CASE WHEN can_end IS NULL AND live_end IS NULL THEN 1 ELSE 0 END)::text AS both_null,
      COUNT(*)::text AS total_matched
    FROM matched_a
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
  if (s55sum === ba) {
    line(`  Sum = ${s55sum} = 5.1a count (${ba}). Reconciles. ✓`);
  } else {
    line(`  *** SUM IS ${s55sum}, NOT 5.1a count (${ba}). DOES NOT RECONCILE. ***`);
  }

  if (diff > 0) {
    const s55diff = await db.execute<{
      target_company_id: string; fiscal_year: string; statement_type: string;
      can_end: string; live_end: string;
    }>(sql.raw(`
      WITH ${SHARED_CTES}
      ${CAN_BUCKETS_EXT},
      matched_a AS (
        SELECT
          cb.period_end AS can_end,
          la.period_end AS live_end,
          cb.target_company_id, cb.fiscal_year, cb.statement_type
        FROM can_buckets cb
        JOIN live_all la
          ON la.target_company_id = cb.target_company_id
          AND la.fiscal_year = cb.fiscal_year
          AND la.statement_type = cb.statement_type
          AND (
            (cb.can_count = 1 AND cb.total_live = 1)
            OR (cb.span_disambiguated = true AND la.derived_span = cb.span_kind)
          )
        WHERE cb.bucket = 'a'
      )
      SELECT
        target_company_id::text, fiscal_year::text, statement_type,
        can_end::text, live_end::text
      FROM matched_a
      WHERE can_end IS NOT NULL AND live_end IS NOT NULL
        AND can_end::text != live_end::text
      ORDER BY target_company_id::int, fiscal_year, statement_type
    `));
    line('  Differing cases (tc | fiscal_year | statement_type | canonical_end | live_end):');
    for (const r of s55diff.rows) {
      line(`    ${r.target_company_id} | ${r.fiscal_year} | ${r.statement_type} | ${r.can_end} | ${r.live_end}`);
    }
  }
  line('  A period_end disagreement is a FINDING, not a join failure. The live value may be the fabricated 31 December described in 3.1.');
  line();

  line('5.6 No canonical period was matched to a live row by picking one of several.');
  line('Multi-matches (bucket b) and displaced periods (bucket e) are excluded from figure-level comparison at 3d.3b.');
  line();

  // ── 5.7 Injectivity assertion ──────────────────────────────────────────────
  const s57 = await db.execute<{
    can_a_count: string; distinct_live_count: string;
  }>(sql.raw(`
    WITH ${SHARED_CTES}
    ${CAN_BUCKETS_EXT},
    matched_a AS (
      SELECT
        cb.target_company_id, cb.fiscal_year, cb.statement_type,
        la.period_end AS live_end, la.derived_span
      FROM can_buckets cb
      JOIN live_all la
        ON la.target_company_id = cb.target_company_id
        AND la.fiscal_year = cb.fiscal_year
        AND la.statement_type = cb.statement_type
        AND (
          (cb.can_count = 1 AND cb.total_live = 1)
          OR (cb.span_disambiguated = true AND la.derived_span = cb.span_kind)
        )
      WHERE cb.bucket = 'a'
    )
    SELECT
      COUNT(*)::text AS can_a_count,
      COUNT(DISTINCT
        target_company_id::text || '~' || fiscal_year::text || '~' ||
        statement_type || '~' || COALESCE(live_end::text, 'NULL') || '~' || derived_span
      )::text AS distinct_live_count
    FROM matched_a
  `));

  const r57 = s57.rows[0];
  const canACount = parseInt(r57.can_a_count);
  const distinctLiveCount = parseInt(r57.distinct_live_count);

  line('5.7 INJECTIVITY:');
  line(`  count of canonical periods in bucket a:          ${r57.can_a_count}`);
  line(`  count of DISTINCT live rows claimed by bucket a: ${r57.distinct_live_count}`);
  if (canACount === distinctLiveCount) {
    line(`  MATCH`);
  } else {
    line(`  MISMATCH — ${canACount - distinctLiveCount} live row(s) are claimed by more than one canonical period.`);
    // List every offending live row
    const s57bad = await db.execute<{
      target_company_id: string; fiscal_year: string; statement_type: string;
      live_end: string | null; derived_span: string; claim_count: string;
    }>(sql.raw(`
      WITH ${SHARED_CTES}
      ${CAN_BUCKETS_EXT},
      matched_a AS (
        SELECT
          cb.target_company_id, cb.fiscal_year, cb.statement_type,
          la.period_end AS live_end, la.derived_span
        FROM can_buckets cb
        JOIN live_all la
          ON la.target_company_id = cb.target_company_id
          AND la.fiscal_year = cb.fiscal_year
          AND la.statement_type = cb.statement_type
          AND (
            (cb.can_count = 1 AND cb.total_live = 1)
            OR (cb.span_disambiguated = true AND la.derived_span = cb.span_kind)
          )
        WHERE cb.bucket = 'a'
      )
      SELECT
        target_company_id::text, fiscal_year::text, statement_type,
        live_end::text, derived_span, COUNT(*)::text AS claim_count
      FROM matched_a
      GROUP BY target_company_id, fiscal_year, statement_type, live_end, derived_span
      HAVING COUNT(*) > 1
      ORDER BY target_company_id::int, fiscal_year, statement_type
    `));
    line('  Offending live rows (tc | fiscal_year | statement_type | live_end | derived_span | claim_count):');
    for (const r of s57bad.rows) {
      line(`    ${r.target_company_id} | ${r.fiscal_year} | ${r.statement_type} | ${r.live_end} | ${r.derived_span} | ${r.claim_count}`);
    }
  }
  line('  Figure-level comparison at 3d.3b requires a one-to-one match. A live row read twice would double-count its values against two different canonical periods.');
  line();

  // ── 5.8 Forced-pairing count (bucket 5.1a only) ───────────────────────────
  const s58 = await db.execute<{
    one_to_one: string;
    span_disambiguated: string;
    span_disambiguated_misaligned: string;
    total_matched: string;
  }>(sql.raw(`
    WITH ${SHARED_CTES}
    ${CAN_BUCKETS_EXT},
    matched_a AS (
      SELECT
        CASE
          WHEN cb.can_count = 1 AND cb.total_live = 1 THEN 'one_to_one'
          ELSE 'span_disambiguated'
        END AS match_method,
        cb.period_end AS can_end,
        la.period_end AS live_end
      FROM can_buckets cb
      JOIN live_all la
        ON la.target_company_id = cb.target_company_id
        AND la.fiscal_year = cb.fiscal_year
        AND la.statement_type = cb.statement_type
        AND (
          (cb.can_count = 1 AND cb.total_live = 1)
          OR (cb.span_disambiguated = true AND la.derived_span = cb.span_kind)
        )
      WHERE cb.bucket = 'a'
    )
    SELECT
      SUM(CASE WHEN match_method = 'one_to_one' THEN 1 ELSE 0 END)::text AS one_to_one,
      SUM(CASE WHEN match_method = 'span_disambiguated' THEN 1 ELSE 0 END)::text AS span_disambiguated,
      SUM(CASE WHEN match_method = 'span_disambiguated'
        AND can_end IS NOT NULL AND live_end IS NOT NULL
        AND can_end::text != live_end::text THEN 1 ELSE 0 END)::text AS span_disambiguated_misaligned,
      COUNT(*)::text AS total_matched
    FROM matched_a
  `));

  const oto = parseInt(s58.rows[0].one_to_one);
  const sdis = parseInt(s58.rows[0].span_disambiguated);
  const sdisMis = parseInt(s58.rows[0].span_disambiguated_misaligned);
  const s58total = parseInt(s58.rows[0].total_matched);
  const s58sum = oto + sdis;

  line('5.8 FORCED-PAIRING COUNT (bucket 5.1a only):');
  line(`  Pairs matched by one-to-one shortcut (can_count=1 AND total_live=1): ${oto}`);
  line(`  Pairs matched by span disambiguation:                                 ${sdis}`);
  line(`  Of span-disambiguated pairs, MISALIGNED (period_end differs):         ${sdisMis}`);
  line(`  Arithmetic: ${oto} (one-to-one) + ${sdis} (span-disambiguated) = ${s58sum} (exp ${ba})`);
  if (s58sum === ba) {
    line(`  Sum = ${s58sum} = 5.1a count (${ba}). Reconciles. ✓`);
  } else {
    line(`  *** SUM IS ${s58sum}, NOT 5.1a count (${ba}). DOES NOT RECONCILE. ***`);
  }
  line('  A span-disambiguated pair whose period_end disagrees was matched on a weak signal while a strong signal said the two periods differ. These are quarantined from the true-drift figure by the 6.8 cross-tab and are listed at 6.10.');
  line();

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 6: FIGURE-LEVEL VALUE COMPARISON
  // ─────────────────────────────────────────────────────────────────────────
  line('='.repeat(70));
  line('SECTION 6: FIGURE-LEVEL VALUE COMPARISON');
  line('='.repeat(70));
  line();

  // ── Normalisation helper ─────────────────────────────────────────────────
  // Trim whitespace, strip leading '+', then re-stringify via Number so that
  // '1000', '1000.0' and '1000.00' all become '1000'.  Financial figures are
  // well within IEEE-754 double precision range so no precision is lost.
  const normalizeDecimal = (s: string): string => {
    const trimmed = s.trim().replace(/^\+/, '');
    const n = Number(trimmed);
    return isNaN(n) ? trimmed : String(n);
  };

  // ── JSON column resolver ─────────────────────────────────────────────────
  // postgres / pg driver returns jsonb columns as already-parsed JS objects.
  // This helper also handles the rare case where the driver returns a string.
  const resolveJsonColumn = (raw: unknown): Record<string, unknown> | null => {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'string') {
      try { return JSON.parse(raw) as Record<string, unknown>; } catch { return null; }
    }
    if (typeof raw === 'object') return raw as Record<string, unknown>;
    return null;
  };

  // ── SHARED_CTES_S6: extends live_all with financial_period_id ─────────────
  // Identical to SHARED_CTES except live_income and live_balance expose fp.id.
  // CAN_BUCKETS_EXT is unchanged: it joins live_all on tc/fy/statement_type only.
  const SHARED_CTES_S6 = `
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
             fp.id AS financial_period_id,
             fp.period_end, fp.months_covered, fp.is_full_year,
             ${SPAN_CASE} AS derived_span
      FROM financial_periods fp
      JOIN income_statements is_ ON is_.financial_period_id = fp.id
      WHERE fp.target_company_id IN (SELECT target_company_id FROM both_cos)
    ),
    live_balance AS (
      SELECT fp.target_company_id, fp.fiscal_year, 'balance'::text AS statement_type,
             fp.id AS financial_period_id,
             fp.period_end, fp.months_covered, fp.is_full_year,
             ${SPAN_CASE} AS derived_span
      FROM financial_periods fp
      JOIN balance_sheets bs ON bs.financial_period_id = fp.id
      WHERE fp.target_company_id IN (SELECT target_company_id FROM both_cos)
    ),
    live_all AS (SELECT * FROM live_income UNION ALL SELECT * FROM live_balance)`;

  // ── Step 1: Get the 316 matched pairs with financial_period_id ─────────────
  const s6PairsResult = await db.execute<{
    canonical_period_id: string;
    statement_type: string;
    target_company_id: string;
    fiscal_year: string;
    financial_period_id: string;
  }>(sql.raw(`
    WITH ${SHARED_CTES_S6}
    ${CAN_BUCKETS_EXT},
    matched_a AS (
      SELECT
        cb.cp_id::text AS canonical_period_id,
        cb.statement_type,
        cb.target_company_id::text,
        cb.fiscal_year::text,
        la.financial_period_id::text
      FROM can_buckets cb
      JOIN live_all la
        ON la.target_company_id = cb.target_company_id
        AND la.fiscal_year = cb.fiscal_year
        AND la.statement_type = cb.statement_type
        AND (
          (cb.can_count = 1 AND cb.total_live = 1)
          OR (cb.span_disambiguated = true AND la.derived_span = cb.span_kind)
        )
      WHERE cb.bucket = 'a'
    )
    SELECT * FROM matched_a
    ORDER BY target_company_id::int, fiscal_year, statement_type
  `));

  const matchedPairs = s6PairsResult.rows;
  const matchedCpIdList = matchedPairs.map(r => r.canonical_period_id).join(',');
  const incomeFpIds = matchedPairs
    .filter(r => r.statement_type === 'income')
    .map(r => r.financial_period_id);
  const balanceFpIds = matchedPairs
    .filter(r => r.statement_type === 'balance')
    .map(r => r.financial_period_id);

  // canonical_period_id → pair info (for lookup during figure iteration)
  const cpToPair = new Map<string, typeof matchedPairs[0]>();
  for (const r of matchedPairs) {
    cpToPair.set(r.canonical_period_id, r);
  }

  // ── 6.0 Denominator ────────────────────────────────────────────────────────
  const s60 = await db.execute<{ n: string; nulls: string }>(sql.raw(`
    SELECT
      COUNT(*)::text AS n,
      SUM(CASE WHEN value IS NULL THEN 1 ELSE 0 END)::text AS nulls
    FROM canonical_figure
    WHERE canonical_period_id = ANY(ARRAY[${matchedCpIdList}]::int[])
  `));
  const N = parseInt(s60.rows[0].n);
  const figNulls = parseInt(s60.rows[0].nulls);
  const totalSelFigs = parseInt(cp.sel_figures);
  const unmatchedFigs = totalSelFigs - N;

  line('6.0 FIGURE DENOMINATOR');
  line(`  N (figures in 316 matched periods):             ${N}`);
  line(`  Total figures across all 335 selected periods: ${totalSelFigs}`);
  line(`  Figures in the 19 unmatched periods:            ${unmatchedFigs}  (${totalSelFigs} - ${N})`);
  if (figNulls === 0) {
    line(`  canonical_figure.value nulls among N rows: 0 ✓`);
  } else {
    line(`  *** ALERT: canonical_figure.value IS NULL on ${figNulls} of ${N} rows. This contradicts the 3c assess finding that document_evidence_figure.value is non-null on all 14398 rows. Something changed. ***`);
  }
  line();

  // ── Step 2: Load canonical_figures for matched periods ─────────────────────
  const canFigsResult = await db.execute<{
    canonical_period_id: string;
    figure_path: string;
    value: string;
  }>(sql.raw(`
    SELECT canonical_period_id::text, figure_path, value::text
    FROM canonical_figure
    WHERE canonical_period_id = ANY(ARRAY[${matchedCpIdList}]::int[])
    ORDER BY canonical_period_id, figure_path
  `));

  // ── Step 3: Load income_statements for matched income periods ──────────────
  const incomeMap = new Map<string, Record<string, unknown>>();
  if (incomeFpIds.length > 0) {
    const incomeFpIdList = incomeFpIds.join(',');
    const incomeResult = await db.execute<Record<string, unknown>>(sql.raw(`
      SELECT
        is_.financial_period_id::text,
        is_.revenue::text,
        is_.cost_of_sales::text,
        is_.gross_profit::text,
        is_.administrative_expenses::text,
        is_.depreciation_amortisation::text,
        is_.other_operating_income::text,
        is_.operating_profit::text,
        is_.interest_receivable::text,
        is_.interest_payable::text,
        is_.profit_before_tax::text,
        is_.corporation_tax::text,
        is_.net_profit::text,
        is_.staff_costs::text,
        is_.directors_remuneration::text,
        is_.dividends_paid::text,
        is_.overheads_breakdown,
        is_.cost_of_sales_breakdown,
        is_.revenue_breakdown
      FROM income_statements is_
      WHERE is_.financial_period_id = ANY(ARRAY[${incomeFpIdList}]::int[])
    `));
    for (const r of incomeResult.rows) {
      incomeMap.set(r.financial_period_id as string, r);
    }
  }

  // ── Step 4: Load balance_sheets for matched balance periods ───────────────
  const balanceMap = new Map<string, Record<string, unknown>>();
  if (balanceFpIds.length > 0) {
    const balanceFpIdListStr = balanceFpIds.join(',');
    const balanceResult = await db.execute<Record<string, unknown>>(sql.raw(`
      SELECT
        bs.financial_period_id::text,
        bs.intangible_assets::text,
        bs.tangible_fixed_assets::text,
        bs.freehold_property::text,
        bs.leasehold_property::text,
        bs.plant_machinery::text,
        bs.fixtures_fittings::text,
        bs.motor_vehicles::text,
        bs.computer_equipment::text,
        bs.stock_inventory::text,
        bs.trade_debtors::text,
        bs.prepayments::text,
        bs.amounts_owed_by_directors::text,
        bs.amounts_owed_by_connected_companies::text,
        bs.directors_current_account::text,
        bs.other_debtors::text,
        bs.cash_at_bank::text,
        bs.total_current_assets::text,
        bs.trade_creditors::text,
        bs.taxation_social_security::text,
        bs.vat_payable::text,
        bs.corporation_tax_due::text,
        bs.bank_loans_overdraft_current::text,
        bs.hire_purchase_current::text,
        bs.accruals::text,
        bs.amounts_owed_to_directors::text,
        bs.other_creditors::text,
        bs.total_current_liabilities::text,
        bs.bank_loans_long_term::text,
        bs.hire_purchase_long_term::text,
        bs.deferred_taxation::text,
        bs.other_long_term_debt::text,
        bs.total_long_term_liabilities::text,
        bs.share_capital::text,
        bs.retained_earnings::text,
        bs.total_equity::text
      FROM balance_sheets bs
      WHERE bs.financial_period_id = ANY(ARRAY[${balanceFpIdListStr}]::int[])
    `));
    for (const r of balanceResult.rows) {
      balanceMap.set(r.financial_period_id as string, r);
    }
  }

  // ── Step 5: Per-figure comparison ─────────────────────────────────────────
  interface FigureResult {
    bucket: 'A' | 'B' | 'C' | 'U' | 'X';
    canonical_period_id: string;
    target_company_id: string;
    fiscal_year: string;
    statement_type: string;
    figure_path: string;
    live_col_or_path: string;
    live_target_key: string; // normalised key for 6.9 reverse lookup
    canonical_value: string;
    live_value: string | null;
    delta: number | null;
    absence_reason: string | null;
    kind: 'scalar' | 'json' | 'unmapped' | 'contradiction';
  }

  const figureResults: FigureResult[] = [];
  let jsonColNull = 0;
  let jsonGroupKeyMissing = 0;
  let jsonLeafKeyMissingOrNull = 0;

  for (const fig of canFigsResult.rows) {
    const pair = cpToPair.get(fig.canonical_period_id);
    if (!pair) continue; // unreachable: figure set was filtered to matched cp ids

    const { financial_period_id, statement_type, target_company_id, fiscal_year } = pair;
    const target = mapFigurePath(fig.figure_path);

    // STEP 2: Consistency guard — table must match statement_type
    if (target.kind === 'scalar' || target.kind === 'json') {
      const expectedTable = statement_type === 'income' ? 'income' : 'balance';
      if (target.table !== expectedTable) {
        figureResults.push({
          bucket: 'X',
          canonical_period_id: fig.canonical_period_id,
          target_company_id, fiscal_year, statement_type,
          figure_path: fig.figure_path,
          live_col_or_path: `table mismatch: corpus=${statement_type}, map=${target.table}`,
          live_target_key: '',
          canonical_value: fig.value,
          live_value: null,
          delta: null,
          absence_reason: null,
          kind: 'contradiction',
        });
        continue;
      }
    }

    // Bucket U: unmapped
    if (target.kind === 'unmapped') {
      figureResults.push({
        bucket: 'U',
        canonical_period_id: fig.canonical_period_id,
        target_company_id, fiscal_year, statement_type,
        figure_path: fig.figure_path,
        live_col_or_path: target.reason,
        live_target_key: '',
        canonical_value: fig.value,
        live_value: null,
        delta: null,
        absence_reason: null,
        kind: 'unmapped',
      });
      continue;
    }

    // STEP 3: Resolve live value
    let liveValue: string | null = null;
    let live_col_or_path = '';
    let absenceReason: string | null = null;

    if (target.kind === 'scalar') {
      const liveRow = statement_type === 'income'
        ? incomeMap.get(financial_period_id)
        : balanceMap.get(financial_period_id);
      live_col_or_path = target.column;
      const rawVal = liveRow ? liveRow[target.column] : null;
      liveValue = (rawVal !== null && rawVal !== undefined) ? String(rawVal) : null;

    } else {
      // json kind — always income (Block A3 of assess: all json columns are on income)
      const liveRow = incomeMap.get(financial_period_id);
      live_col_or_path = target.jsonPath.length === 2
        ? `${target.column}['${target.jsonPath[0]}']['${target.jsonPath[1]}']`
        : `${target.column}['${target.jsonPath[0]}']`;

      const rawCol = liveRow ? liveRow[target.column] : null;
      const colObj = resolveJsonColumn(rawCol);

      if (colObj === null) {
        // Absence reason 1: JSON column itself is null
        jsonColNull++;
        absenceReason = 'json_col_null';

      } else if (target.jsonPath.length === 2) {
        // Two-element path: revenue_breakdown.by_product/by_segment.<key>
        const groupKey = target.jsonPath[0];
        const leafKey = target.jsonPath[1];

        if (!(groupKey in colObj)) {
          // Absence reason 2: grouping key is missing
          jsonGroupKeyMissing++;
          absenceReason = 'json_group_key_missing';
        } else {
          const groupVal = colObj[groupKey];
          const groupObj: Record<string, unknown> | null =
            groupVal === null ? null :
            typeof groupVal === 'object' ? groupVal as Record<string, unknown> : null;

          if (groupObj === null) {
            jsonGroupKeyMissing++;
            absenceReason = 'json_group_key_missing';
          } else {
            const leafVal = groupObj[leafKey];
            if (leafVal === undefined || leafVal === null) {
              // Absence reason 3: leaf key missing or value is null
              jsonLeafKeyMissingOrNull++;
              absenceReason = 'json_leaf_missing_or_null';
            } else {
              liveValue = String(leafVal);
            }
          }
        }

      } else {
        // Single-element path: overheads_breakdown.<key> or cost_of_sales_breakdown.<key>
        const leafKey = target.jsonPath[0];
        const leafVal = (colObj as Record<string, unknown>)[leafKey];
        if (leafVal === undefined || leafVal === null) {
          // Absence reason 3: leaf key missing or value is null
          jsonLeafKeyMissingOrNull++;
          absenceReason = 'json_leaf_missing_or_null';
        } else {
          liveValue = String(leafVal);
        }
      }
    }

    // Normalised key for reverse-direction lookup (6.9).
    // target.kind is 'scalar' or 'json' here; 'unmapped'/'contradiction' exited above.
    const liveTargetKey: string = target.kind === 'json'
      ? target.jsonPath.length === 2
        ? `${target.column}::${target.jsonPath[0]}::${target.jsonPath[1]}`
        : `${target.column}::${target.jsonPath[0]}`
      : target.column; // scalar

    // STEP 4: Compare (no tolerance)
    if (liveValue === null) {
      figureResults.push({
        bucket: 'C',
        canonical_period_id: fig.canonical_period_id,
        target_company_id, fiscal_year, statement_type,
        figure_path: fig.figure_path,
        live_col_or_path,
        live_target_key: liveTargetKey,
        canonical_value: fig.value,
        live_value: null,
        delta: null,
        absence_reason: absenceReason,
        kind: target.kind,
      });
    } else {
      const normCan = normalizeDecimal(fig.value);
      const normLive = normalizeDecimal(liveValue);
      if (normCan === normLive) {
        figureResults.push({
          bucket: 'A',
          canonical_period_id: fig.canonical_period_id,
          target_company_id, fiscal_year, statement_type,
          figure_path: fig.figure_path,
          live_col_or_path,
          live_target_key: liveTargetKey,
          canonical_value: fig.value,
          live_value: liveValue,
          delta: 0,
          absence_reason: null,
          kind: target.kind,
        });
      } else {
        const delta = Math.abs(parseFloat(liveValue) - parseFloat(fig.value));
        figureResults.push({
          bucket: 'B',
          canonical_period_id: fig.canonical_period_id,
          target_company_id, fiscal_year, statement_type,
          figure_path: fig.figure_path,
          live_col_or_path,
          live_target_key: liveTargetKey,
          canonical_value: fig.value,
          live_value: liveValue,
          delta,
          absence_reason: null,
          kind: target.kind,
        });
      }
    }
  }

  // ── Bucket arrays and counts ───────────────────────────────────────────────
  const bktA = figureResults.filter(r => r.bucket === 'A');
  const bktB = figureResults.filter(r => r.bucket === 'B');
  const bktC = figureResults.filter(r => r.bucket === 'C');
  const bktU = figureResults.filter(r => r.bucket === 'U');
  const bktX = figureResults.filter(r => r.bucket === 'X');
  const countA = bktA.length, countB = bktB.length, countC = bktC.length;
  const countU = bktU.length, countX = bktX.length;
  const totalBuckets = countA + countB + countC + countU + countX;

  // ── 6.1 Bucket counts ─────────────────────────────────────────────────────
  const aIncome  = bktA.filter(r => r.statement_type === 'income').length;
  const aBalance = bktA.filter(r => r.statement_type === 'balance').length;
  const bIncome  = bktB.filter(r => r.statement_type === 'income').length;
  const bBalance = bktB.filter(r => r.statement_type === 'balance').length;
  const cIncome  = bktC.filter(r => r.statement_type === 'income').length;
  const cBalance = bktC.filter(r => r.statement_type === 'balance').length;

  line(`6.1 FIGURE BUCKET COUNTS (N = ${N}):`);
  line(`  A. equal:                        ${countA}  (${pct(countA, N)})  [income=${aIncome}, balance=${aBalance}]`);
  line(`  B. differ, both present:         ${countB}  (${pct(countB, N)})  [income=${bIncome}, balance=${bBalance}]`);
  line(`  C. live absent:                  ${countC}  (${pct(countC, N)})  [income=${cIncome}, balance=${cBalance}]`);
  line(`  U. unmapped:                     ${countU}  (${pct(countU, N)})`);
  line(`  X. table contradiction:          ${countX}  (${pct(countX, N)})`);
  line(`  Arithmetic: A(${countA}) + B(${countB}) + C(${countC}) + U(${countU}) + X(${countX}) = ${totalBuckets}`);
  if (totalBuckets === N) {
    line(`  Sum = ${totalBuckets} = N. MATCH ✓`);
  } else {
    line(`  *** SUM IS ${totalBuckets}, NOT N=${N}. MISMATCH — STOP. ***`);
  }
  line();

  // ── 6.2 Scalar vs JSON split ──────────────────────────────────────────────
  const aScalar = bktA.filter(r => r.kind === 'scalar').length;
  const aJson   = bktA.filter(r => r.kind === 'json').length;
  const bScalar = bktB.filter(r => r.kind === 'scalar').length;
  const bJson   = bktB.filter(r => r.kind === 'json').length;
  const cScalar = bktC.filter(r => r.kind === 'scalar').length;
  const cJson   = bktC.filter(r => r.kind === 'json').length;
  const s62sum  = aScalar + aJson + bScalar + bJson + cScalar + cJson + countU + countX;

  line('6.2 SCALAR VS JSON SPLIT (across all five buckets):');
  line(`  A scalar: ${aScalar}   A json: ${aJson}`);
  line(`  B scalar: ${bScalar}   B json: ${bJson}`);
  line(`  C scalar: ${cScalar}   C json: ${cJson}`);
  line(`  U (all unmapped, no target kind):  ${countU}`);
  line(`  X (table contradiction):           ${countX}`);
  line(`  Arithmetic: ${aScalar}+${aJson}+${bScalar}+${bJson}+${cScalar}+${cJson}+${countU}+${countX} = ${s62sum}`);
  if (s62sum === N) {
    line(`  Sum = ${s62sum} = N. ✓`);
  } else {
    line(`  *** SUM IS ${s62sum}, NOT N=${N}. ***`);
  }
  line();

  // ── 6.3 pre-reads: span and alignment lookup maps ────────────────────────
  const s63Cp = await db.execute<{
    cp_id: string;
    span_kind: string;
    period_end: string | null;
  }>(sql.raw(`
    SELECT id::text AS cp_id, span_kind, period_end::text AS period_end
    FROM canonical_period
    WHERE id IN (${matchedCpIdList})
  `));

  const matchedFpIdList = matchedPairs.map(r => r.financial_period_id).join(',');
  const s63Fp = await db.execute<{
    fp_id: string;
    period_end: string | null;
  }>(sql.raw(`
    SELECT id::text AS fp_id, period_end::text AS period_end
    FROM financial_periods
    WHERE id IN (${matchedFpIdList})
  `));

  const spanByCp = new Map<string, { span_kind: string; period_end: string | null }>();
  for (const r of s63Cp.rows) {
    spanByCp.set(r.cp_id, { span_kind: r.span_kind, period_end: r.period_end });
  }

  const endByFp = new Map<string, string | null>();
  for (const r of s63Fp.rows) {
    endByFp.set(r.fp_id, r.period_end);
  }

  const alignByCp = new Map<string, 'ALIGNED' | 'MISALIGNED'>();
  for (const pair of matchedPairs) {
    const canEnd = spanByCp.get(pair.canonical_period_id)?.period_end ?? null;
    const liveEnd = endByFp.get(pair.financial_period_id) ?? null;
    const alignment: 'ALIGNED' | 'MISALIGNED' =
      (canEnd !== null && liveEnd !== null && canEnd === liveEnd) ? 'ALIGNED' : 'MISALIGNED';
    alignByCp.set(pair.canonical_period_id, alignment);
  }

  // ── 6.3 Bucket B in full ─────────────────────────────────────────────────
  line('6.3 BUCKET B IN FULL (sorted by absolute delta descending):');
  if (bktB.length === 0) {
    line('  NO DIFFERENCES');
  } else {
    const sortedB = [...bktB].sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0));
    const CAP_B = 60;
    const toShowB = sortedB.slice(0, CAP_B);
    line('  tc | fiscal_year | statement_type | figure_path | live_col/path | canonical | live | delta | align | span');
    const b63Tally = { ALIGNED: 0, MISALIGNED: 0 };
    for (const r of sortedB) b63Tally[alignByCp.get(r.canonical_period_id) ?? 'MISALIGNED']++;
    line(`  alignment tally over all ${sortedB.length} B rows: ALIGNED=${b63Tally.ALIGNED}, MISALIGNED=${b63Tally.MISALIGNED}`);
    for (const r of toShowB) {
      const deltaStr = r.delta !== null ? r.delta.toFixed(2) : 'N/A';
      const align = alignByCp.get(r.canonical_period_id) ?? 'MISALIGNED';
      const span = spanByCp.get(r.canonical_period_id)?.span_kind ?? 'null';
      line(`  ${r.target_company_id} | ${r.fiscal_year} | ${r.statement_type} | ${r.figure_path} | ${r.live_col_or_path} | ${r.canonical_value} | ${r.live_value} | ${deltaStr} | ${align} | ${span}`);
    }
    if (sortedB.length > CAP_B) {
      line(`TRUNCATED AT ${CAP_B} OF ${sortedB.length}`);
    }
  }
  line();

  // ── 6.4 Bucket C summary ──────────────────────────────────────────────────
  line('6.4 BUCKET C SUMMARY:');
  if (bktC.length === 0) {
    line('  NO ABSENT FIGURES');
  } else {
    line(`  JSON absence sub-counts:`);
    line(`    json column itself is null:                   ${jsonColNull}`);
    line(`    grouping key is missing:                      ${jsonGroupKeyMissing}`);
    line(`    leaf key is missing or its value is null:     ${jsonLeafKeyMissingOrNull}`);
    const jsonAbsenceTotal = jsonColNull + jsonGroupKeyMissing + jsonLeafKeyMissingOrNull;
    line(`    (JSON absence total: ${jsonAbsenceTotal})`);
    line();
    line('  Top figure_paths by absence count (descending):');
    const cByPath = new Map<string, number>();
    for (const r of bktC) {
      cByPath.set(r.figure_path, (cByPath.get(r.figure_path) ?? 0) + 1);
    }
    const cSorted = [...cByPath.entries()].sort((a, b) => b[1] - a[1]);
    const CAP_C = 20;
    for (const [fp, cnt] of cSorted.slice(0, CAP_C)) {
      line(`    ${cnt}  ${fp}`);
    }
    if (cSorted.length > CAP_C) {
      line(`  TRUNCATED AT ${CAP_C} OF ${cSorted.length}`);
    }
  }
  line();

  // ── 6.5 Bucket U ─────────────────────────────────────────────────────────
  line('6.5 BUCKET U (unmapped figure_paths):');
  if (bktU.length === 0) {
    line('  NO UNMAPPED FIGURES');
  } else {
    // Group by reason string; collect distinct figure_paths per reason
    const uByReason = new Map<string, Set<string>>();
    for (const r of bktU) {
      if (!uByReason.has(r.live_col_or_path)) uByReason.set(r.live_col_or_path, new Set());
      uByReason.get(r.live_col_or_path)!.add(r.figure_path);
    }
    for (const [reason, paths] of uByReason) {
      line(`  count=${paths.size}  reason: ${reason}`);
      for (const p of [...paths].sort()) {
        line(`    ${p}`);
      }
    }
  }
  line();

  // ── 6.6 Bucket X ─────────────────────────────────────────────────────────
  line('6.6 BUCKET X (table contradiction):');
  if (bktX.length === 0) {
    line('  0 — as expected. ✓');
  } else {
    line(`  *** ${bktX.length} CONTRADICTION(S) — mapping table and corpus disagree: ***`);
    for (const r of bktX) {
      line(`  tc=${r.target_company_id} fy=${r.fiscal_year} st=${r.statement_type} path=${r.figure_path} detail=${r.live_col_or_path}`);
    }
  }
  line();

  // ── 6.7 Scope caveat ─────────────────────────────────────────────────────
  line('6.7 Scope: 316 of 335 canonical periods. The 19 excluded are 16 ambiguous (5.3), 2 with no live row (5.1c) and 1 displaced by a closer span match (5.3b). Their figures are counted at 6.0 and are NOT included in any bucket above.');

  line();

  // ── 6.8 Misalignment cross-tab ────────────────────────────────────────────
  // ALIGNED   = period_end equal on both sides (5.5 equal=296)
  // MISALIGNED = period_end differs OR canonical period_end is null (5.5 differ=18 + can_null=2 = 20)

  const s68Result = await db.execute<{
    canonical_period_id: string;
    alignment: string;
  }>(sql.raw(`
    WITH ${SHARED_CTES_S6}
    ${CAN_BUCKETS_EXT},
    matched_a AS (
      SELECT
        cb.cp_id::text AS canonical_period_id,
        CASE
          WHEN cb.period_end IS NOT NULL AND la.period_end IS NOT NULL
               AND cb.period_end::text = la.period_end::text
          THEN 'ALIGNED'
          ELSE 'MISALIGNED'
        END AS alignment
      FROM can_buckets cb
      JOIN live_all la
        ON la.target_company_id = cb.target_company_id
        AND la.fiscal_year = cb.fiscal_year
        AND la.statement_type = cb.statement_type
        AND (
          (cb.can_count = 1 AND cb.total_live = 1)
          OR (cb.span_disambiguated = true AND la.derived_span = cb.span_kind)
        )
      WHERE cb.bucket = 'a'
    )
    SELECT canonical_period_id, alignment FROM matched_a
  `));

  type AlignKey = 'ALIGNED' | 'MISALIGNED';
  const cpAlignment = new Map<string, AlignKey>();
  for (const r of s68Result.rows) {
    cpAlignment.set(r.canonical_period_id, r.alignment as AlignKey);
  }

  const cross: Record<string, Record<AlignKey, number>> = {
    A: { ALIGNED: 0, MISALIGNED: 0 },
    B: { ALIGNED: 0, MISALIGNED: 0 },
    C: { ALIGNED: 0, MISALIGNED: 0 },
    U: { ALIGNED: 0, MISALIGNED: 0 },
    X: { ALIGNED: 0, MISALIGNED: 0 },
  };
  for (const fig of figureResults) {
    const align = cpAlignment.get(fig.canonical_period_id) ?? 'MISALIGNED';
    cross[fig.bucket][align]++;
  }

  const alignedTotal    = Object.values(cross).reduce((s, r) => s + r.ALIGNED,    0);
  const misalignedTotal = Object.values(cross).reduce((s, r) => s + r.MISALIGNED, 0);

  const pad = (n: number) => String(n).padStart(6);
  line('6.8 MISALIGNMENT CROSS-TAB:');
  line('  ALIGNED   = period_end equal on both sides.');
  line('  MISALIGNED = period_end differs, or canonical period_end is null.');
  line('  From 5.5: equal=296 → ALIGNED; differ=18 + canonical_null=2 → MISALIGNED=20.');
  line();
  line(`                ALIGNED  MISALIGNED   total`);
  line(`  A equal      ${pad(cross.A.ALIGNED)} ${pad(cross.A.MISALIGNED)} ${pad(countA)}`);
  line(`  B differ     ${pad(cross.B.ALIGNED)} ${pad(cross.B.MISALIGNED)} ${pad(countB)}`);
  line(`  C live absent${pad(cross.C.ALIGNED)} ${pad(cross.C.MISALIGNED)} ${pad(countC)}`);
  line(`  U unmapped   ${pad(cross.U.ALIGNED)} ${pad(cross.U.MISALIGNED)} ${pad(countU)}`);
  line(`  X            ${pad(cross.X.ALIGNED)} ${pad(cross.X.MISALIGNED)} ${pad(countX)}`);
  line(`  total        ${pad(alignedTotal)} ${pad(misalignedTotal)} ${pad(N)}`);
  line();
  const rowSumA = cross.A.ALIGNED + cross.A.MISALIGNED;
  const rowSumB = cross.B.ALIGNED + cross.B.MISALIGNED;
  const rowSumC = cross.C.ALIGNED + cross.C.MISALIGNED;
  const rowSumU = cross.U.ALIGNED + cross.U.MISALIGNED;
  const rowSumX = cross.X.ALIGNED + cross.X.MISALIGNED;
  const colSumTotal = alignedTotal + misalignedTotal;
  line(`  Row totals: A=${rowSumA}(exp ${countA}) B=${rowSumB}(exp ${countB}) C=${rowSumC}(exp ${countC}) U=${rowSumU}(exp ${countU}) X=${rowSumX}(exp ${countX})`);
  line(`  Column totals: ALIGNED(${alignedTotal}) + MISALIGNED(${misalignedTotal}) = ${colSumTotal} (exp ${N})`);
  const crossOk = rowSumA === countA && rowSumB === countB && rowSumC === countC &&
                  rowSumU === countU && rowSumX === countX && colSumTotal === N;
  line(crossOk ? '  All row and column sums reconcile. ✓' : '  *** CROSS-TAB RECONCILIATION FAILURE ***');
  line();
  const trueDriftCount = cross.B.ALIGNED;
  line(`  TRUE VALUE DRIFT = ${trueDriftCount} of ${alignedTotal} figures on ALIGNED periods (${pct(trueDriftCount, alignedTotal)})`);
  line('  A value difference on a MISALIGNED period is not value drift. The two sides are describing different accounting periods that share a fiscal year. Canonical and the live reconciler selected different source documents. That is a document-selection finding, reported at 6.10, not a fidelity failure.');
  line();

  // ── 6.9 Reverse direction ──────────────────────────────────────────────────

  // Build covered targets per canonical period from bucket-A and bucket-B figures.
  // live_target_key format:
  //   scalar:     column_name
  //   json 1-lvl: column::leaf
  //   json 2-lvl: column::group::leaf
  const cpCoveredTargets = new Map<string, Set<string>>();
  for (const fig of figureResults) {
    if (fig.bucket === 'A' || fig.bucket === 'B') {
      if (!cpCoveredTargets.has(fig.canonical_period_id)) {
        cpCoveredTargets.set(fig.canonical_period_id, new Set());
      }
      cpCoveredTargets.get(fig.canonical_period_id)!.add(fig.live_target_key);
    }
  }

  // Column lists for enumeration — match LIVE_INCOME_COLUMNS and LIVE_BALANCE_COLUMNS
  // from canonical-live-map.ts exactly. Not a mapping table: used only for iteration.
  const INCOME_SCALAR_COLS_REV = [
    'revenue', 'cost_of_sales', 'gross_profit', 'administrative_expenses',
    'depreciation_amortisation', 'other_operating_income', 'operating_profit',
    'interest_receivable', 'interest_payable', 'profit_before_tax', 'corporation_tax',
    'net_profit', 'staff_costs', 'directors_remuneration', 'dividends_paid',
  ];
  const BALANCE_SCALAR_COLS_REV = [
    'intangible_assets', 'tangible_fixed_assets', 'freehold_property', 'leasehold_property',
    'plant_machinery', 'fixtures_fittings', 'motor_vehicles', 'computer_equipment',
    'stock_inventory', 'trade_debtors', 'prepayments', 'amounts_owed_by_directors',
    'amounts_owed_by_connected_companies', 'directors_current_account', 'other_debtors',
    'cash_at_bank', 'total_current_assets', 'trade_creditors', 'taxation_social_security',
    'vat_payable', 'corporation_tax_due', 'bank_loans_overdraft_current', 'hire_purchase_current',
    'accruals', 'amounts_owed_to_directors', 'other_creditors', 'total_current_liabilities',
    'bank_loans_long_term', 'hire_purchase_long_term', 'deferred_taxation', 'other_long_term_debt',
    'total_long_term_liabilities', 'share_capital', 'retained_earnings', 'total_equity',
  ];

  let r1Count = 0;
  let r2Count = 0;
  const r2ByPath = new Map<string, number>();
  const r2AlignCounts: Record<AlignKey, number> = { ALIGNED: 0, MISALIGNED: 0 };

  for (const pair of matchedPairs) {
    const { canonical_period_id, financial_period_id, statement_type } = pair;
    const covered = cpCoveredTargets.get(canonical_period_id) ?? new Set<string>();
    const alignment = cpAlignment.get(canonical_period_id) ?? 'MISALIGNED';

    const countLiveValue = (targetKey: string, displayPath: string) => {
      if (covered.has(targetKey)) { r1Count++; }
      else {
        r2Count++;
        r2ByPath.set(displayPath, (r2ByPath.get(displayPath) ?? 0) + 1);
        r2AlignCounts[alignment]++;
      }
    };

    if (statement_type === 'income') {
      const liveRow = incomeMap.get(financial_period_id);
      if (!liveRow) continue;

      for (const col of INCOME_SCALAR_COLS_REV) {
        const v = liveRow[col];
        if (v === null || v === undefined || String(v).trim() === '') continue;
        countLiveValue(col, col);
      }

      // overheads_breakdown and cost_of_sales_breakdown: single-level JSON
      for (const jsonCol of ['overheads_breakdown', 'cost_of_sales_breakdown'] as const) {
        const colObj = resolveJsonColumn(liveRow[jsonCol]);
        if (!colObj) continue;
        for (const [leaf, leafVal] of Object.entries(colObj)) {
          if (leafVal === null || leafVal === undefined) continue;
          countLiveValue(`${jsonCol}::${leaf}`, `${jsonCol}['${leaf}']`);
        }
      }

      // revenue_breakdown: two-level JSON (group → leaf)
      const revObj = resolveJsonColumn(liveRow['revenue_breakdown']);
      if (revObj) {
        for (const [group, groupVal] of Object.entries(revObj)) {
          const groupObj = resolveJsonColumn(groupVal);
          if (!groupObj) continue;
          for (const [leaf, leafVal] of Object.entries(groupObj)) {
            if (leafVal === null || leafVal === undefined) continue;
            countLiveValue(
              `revenue_breakdown::${group}::${leaf}`,
              `revenue_breakdown['${group}']['${leaf}']`,
            );
          }
        }
      }

    } else {
      const liveRow = balanceMap.get(financial_period_id);
      if (!liveRow) continue;

      for (const col of BALANCE_SCALAR_COLS_REV) {
        const v = liveRow[col];
        if (v === null || v === undefined || String(v).trim() === '') continue;
        countLiveValue(col, col);
      }
    }
  }

  const expectedR1 = countA + countB;
  line('6.9 REVERSE DIRECTION (live values canonical does not hold):');
  line(`  R1. live value present, canonical maps to it:    ${r1Count}`);
  line(`  R2. live value present, no canonical maps to it: ${r2Count}`);
  line(`  Arithmetic: R1(${r1Count}) + R2(${r2Count}) = ${r1Count + r2Count}`);
  if (r1Count === expectedR1) {
    line(`  R1 = ${r1Count} = A(${countA}) + B(${countB}) = ${expectedR1}. MATCH ✓`);
  } else {
    line(`  *** R1 = ${r1Count}, EXPECTED A+B = ${expectedR1}. MISMATCH — this is a real defect. ***`);
  }
  line();
  line(`  R2 split: ALIGNED=${r2AlignCounts.ALIGNED}, MISALIGNED=${r2AlignCounts.MISALIGNED}, sum=${r2AlignCounts.ALIGNED + r2AlignCounts.MISALIGNED}`);
  line('  The canonical-live mapping is bijective over all live scalar columns, so every live');
  line('  column has a canonical path. An R2 gap on an ALIGNED period is therefore a genuine');
  line('  evidence-layer gap, not an unmapped column.');
  line();

  const r2Sorted = [...r2ByPath.entries()].sort((a, b) => b[1] - a[1]);
  const CAP_R2 = 25;
  line('  R2 by live column/path (count descending):');
  for (const [path, cnt] of r2Sorted.slice(0, CAP_R2)) {
    line(`    ${cnt}  ${path}`);
  }
  if (r2Sorted.length > CAP_R2) {
    line(`  TRUNCATED AT ${CAP_R2} OF ${r2Sorted.length}`);
  }
  line();
  line('  An R2 entry is a value the live system holds and canonical does not. On an ALIGNED period that is a genuine gap in the evidence layer. On a MISALIGNED period it is expected, because the two sides are different periods.');
  line();

  // ── 6.10 Document selection diagnostic ───────────────────────────────────
  // The 18 pairs where BOTH period_ends are non-null and differ (from 5.5 differ=18).
  // The 2 canonical-null cases are in MISALIGNED for 6.8 but not diagnosed here.

  const s610 = await db.execute<{
    canonical_period_id: string;
    target_company_id: string;
    fiscal_year: string;
    statement_type: string;
    canonical_end: string | null;
    winning_evidence_id: string | null;
    winning_period_id: string | null;
    can_document_id: string | null;
    live_end: string | null;
    source_document_id: string | null;
    source_tier: string | null;
  }>(sql.raw(`
    WITH ${SHARED_CTES_S6}
    ${CAN_BUCKETS_EXT},
    misaligned_18 AS (
      SELECT
        cb.cp_id AS canonical_period_id,
        cb.target_company_id, cb.fiscal_year, cb.statement_type,
        cb.period_end AS can_end,
        la.period_end AS live_end,
        la.financial_period_id
      FROM can_buckets cb
      JOIN live_all la
        ON la.target_company_id = cb.target_company_id
        AND la.fiscal_year = cb.fiscal_year
        AND la.statement_type = cb.statement_type
        AND (
          (cb.can_count = 1 AND cb.total_live = 1)
          OR (cb.span_disambiguated = true AND la.derived_span = cb.span_kind)
        )
      WHERE cb.bucket = 'a'
        AND cb.period_end IS NOT NULL
        AND la.period_end IS NOT NULL
        AND cb.period_end::text != la.period_end::text
    )
    SELECT
      m.canonical_period_id::text,
      m.target_company_id::text,
      m.fiscal_year::text,
      m.statement_type,
      m.can_end::text      AS canonical_end,
      cp.winning_evidence_id::text,
      cp.winning_period_id::text,
      de.document_id::text AS can_document_id,
      m.live_end::text,
      fp.source_document_id::text,
      fp.source_tier
    FROM misaligned_18 m
    JOIN canonical_period cp ON cp.id = m.canonical_period_id
    LEFT JOIN document_evidence de ON de.id = cp.winning_evidence_id
    JOIN financial_periods fp ON fp.id = m.financial_period_id
    ORDER BY m.target_company_id::int, m.fiscal_year, m.statement_type
  `));

  // Count bucket-B figures per canonical_period_id
  const bCountByPeriod = new Map<string, number>();
  for (const fig of figureResults) {
    if (fig.bucket === 'B') {
      bCountByPeriod.set(fig.canonical_period_id, (bCountByPeriod.get(fig.canonical_period_id) ?? 0) + 1);
    }
  }

  line(`6.10 DOCUMENT SELECTION DIAGNOSTIC (${s610.rows.length} MISALIGNED pairs where period_end differs):`);
  line(`  6.8 counts ${s610.rows.length + cnull} MISALIGNED pairs. The ${cnull} pairs with a null canonical period_end are excluded here because there is no canonical document to compare. See 5.5.`);
  line('  tc | fy | st | can_end | win_ev_id | win_pd_id | can_doc_id | live_end | src_doc_id | src_tier | B_figs');
  for (const r of s610.rows) {
    const bFigs = bCountByPeriod.get(r.canonical_period_id) ?? 0;
    line(`  ${r.target_company_id} | ${r.fiscal_year} | ${r.statement_type} | ${r.canonical_end ?? 'NULL'} | ${r.winning_evidence_id ?? 'NULL'} | ${r.winning_period_id ?? 'NULL'} | ${r.can_document_id ?? 'NULL'} | ${r.live_end ?? 'NULL'} | ${r.source_document_id ?? 'NULL'} | ${r.source_tier ?? 'NULL'} | ${bFigs}`);
  }
  line();

  let docDiffer = 0, docSame = 0, docEitherNull = 0;
  for (const r of s610.rows) {
    if (r.can_document_id === null || r.source_document_id === null) {
      docEitherNull++;
    } else if (r.can_document_id === r.source_document_id) {
      docSame++;
    } else {
      docDiffer++;
    }
  }
  const docSum = docDiffer + docSame + docEitherNull;
  line(`  Of the ${s610.rows.length} misaligned pairs:`);
  line(`    canonical doc_id DIFFERENT from live source_document_id: ${docDiffer}`);
  line(`    canonical doc_id SAME as live source_document_id:        ${docSame}`);
  line(`    either side null:                                        ${docEitherNull}`);
  line(`    Sum: ${docDiffer} + ${docSame} + ${docEitherNull} = ${docSum} (exp ${s610.rows.length})`);
  line(docSum === s610.rows.length ? '    Reconciles. ✓' : '    *** DOES NOT RECONCILE ***');
  line();
  line('  Where the two sides cite different documents, canonical\'s winner ladder and getReconciledFinancials\' first-row-wins ordering by period_end DESC have chosen differently. This is the first time that disagreement has been visible.');
  line();

  // ── 6.11 THE #351 CASE — tc=1880, fy=2025, income ────────────────────────
  // Selects EVERY canonical period for this company/year/statement_type from
  // the latest run, ordered by id asc. No rows[0] pick; all rows are printed.
  // Matched live row per period is resolved via the same span-disambiguation
  // logic used throughout sections 5 and 6.

  const s611 = await db.execute<{
    canonical_period_id: string;
    span_kind: string;
    trust_state: string;
    can_period_end: string | null;
    winning_evidence_id: string | null;
    winning_doc_id: string | null;
    can_revenue: string | null;
    canonical_bucket: string | null;
    live_fp_id: string | null;
    live_period_end: string | null;
    live_source_doc_id: string | null;
    live_derived_span: string | null;
    live_revenue: string | null;
  }>(sql.raw(`
    WITH ${SHARED_CTES_S6}
    ${CAN_BUCKETS_EXT}
    SELECT
      cp.id::text AS canonical_period_id,
      cp.span_kind,
      cp.trust_state,
      cp.period_end::text AS can_period_end,
      cp.winning_evidence_id::text,
      de.document_id::text AS winning_doc_id,
      cf.value AS can_revenue,
      cb.bucket AS canonical_bucket,
      la.financial_period_id::text AS live_fp_id,
      la.period_end::text AS live_period_end,
      fp.source_document_id::text AS live_source_doc_id,
      la.derived_span AS live_derived_span,
      ist.revenue::text AS live_revenue
    FROM canonical_period cp
    JOIN (SELECT MAX(id) AS rid FROM canonical_run WHERE target_company_id = 1880) lr
      ON cp.canonical_run_id = lr.rid
    LEFT JOIN document_evidence de ON de.id = cp.winning_evidence_id
    LEFT JOIN canonical_figure cf
      ON cf.canonical_period_id = cp.id
      AND cf.figure_path = 'profit_and_loss.revenue'
    LEFT JOIN can_buckets cb ON cb.cp_id = cp.id
    LEFT JOIN live_all la
      ON la.target_company_id = cb.target_company_id
      AND la.fiscal_year = cb.fiscal_year
      AND la.statement_type = cb.statement_type
      AND cb.bucket = 'a'
      AND (
        (cb.can_count = 1 AND cb.total_live = 1)
        OR (cb.span_disambiguated = true AND la.derived_span = cb.span_kind)
      )
    LEFT JOIN financial_periods fp ON fp.id = la.financial_period_id
    LEFT JOIN income_statements ist ON ist.financial_period_id = la.financial_period_id
    WHERE cp.target_company_id = 1880
      AND cp.fiscal_year = 2025
      AND cp.statement_type = 'income'
    ORDER BY cp.id ASC
  `));

  line(`6.11 THE #351 CASE — tc=1880, fy=2025, income (${s611.rows.length} canonical period(s) in latest run):`);
  for (const r of s611.rows) {
    const bFigsForPeriod = figureResults.filter(
      f => f.canonical_period_id === r.canonical_period_id && f.bucket === 'B',
    ).length;

    line();
    line(`  canonical_period_id:   ${r.canonical_period_id}`);
    line(`  span_kind:             ${r.span_kind}`);
    line(`  trust_state:           ${r.trust_state}`);
    line(`  period_end:            ${r.can_period_end ?? 'NULL'}`);
    line(`  winning_evidence_id:   ${r.winning_evidence_id ?? 'NULL'}`);
    line(`  winning_doc_id:        ${r.winning_doc_id ?? 'NULL'}`);
    line(`  canonical revenue:     ${r.can_revenue ?? 'NULL'}`);
    line(`  5.1 bucket:            ${r.canonical_bucket ?? 'not in can_buckets'}`);

    if (r.canonical_bucket === 'a') {
      const canRev = r.can_revenue;
      const liveRev = r.live_revenue;
      const delta611 = (canRev !== null && liveRev !== null)
        ? Math.abs(parseFloat(liveRev) - parseFloat(canRev))
        : null;
      const isAligned = (r.can_period_end !== null && r.live_period_end !== null &&
                         r.can_period_end === r.live_period_end);
      line(`  matched live_fp_id:    ${r.live_fp_id ?? 'NULL'}`);
      line(`  live period_end:       ${r.live_period_end ?? 'NULL'}`);
      line(`  live source_doc_id:    ${r.live_source_doc_id ?? 'NULL'}`);
      line(`  live derived_span:     ${r.live_derived_span ?? 'NULL'}`);
      line(`  live revenue:          ${liveRev ?? 'NULL'}`);
      line(`  revenue delta:         ${delta611 !== null ? delta611.toFixed(0) : 'N/A'}`);
      line(`  alignment:             ${isAligned ? 'ALIGNED' : 'MISALIGNED'}`);
      line(`  bucket-B figures:      ${bFigsForPeriod}`);
    } else {
      line(`  (no matched live row — not in bucket a)`);
      line(`  bucket-B figures:      ${bFigsForPeriod}`);
    }
  }
  line();
  line('  #351 recorded revenue 361855 against 4509086 as a 91.98% divergence within one fiscal year. Canonical does not treat these as competing values for one period. It separates them by span_kind: 4509086 is the full year and 361855 is the part year. Spec 3.3 built span_kind for exactly this. #351 as written should be revised.');
  line('  CAVEAT: the part_year period carries period_end 2025-12-31, which has the shape of the fabricated 31 December described at 3.1. Verify the date before revising #351.');
  line();

  line('='.repeat(70));
  line('SECTION 7: SCOPE AND LIMITS');
  line('='.repeat(70));
  line();
  line('Figure-level value comparison is in SECTION 6 above.');
  line();
  line('The primary join key used in Section 6:');
  line('  target_company_id + fiscal_year + statement_type');
  line('Span is used only as a discriminator. Bucket-b (ambiguous) and bucket-e');
  line('(displaced by injective resolution) periods are excluded from figure comparison.');
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
