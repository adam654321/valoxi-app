/**
 * scripts/_c1-backfill-dryrun.ts
 * CONTRACT 1 backfill DRY RUN. Compute only.
 *
 * Issues SELECT statements only. Contains no write statement, opens no
 * transaction, and touches no row. Produces two files on disk:
 *   docs/pipeline-fidelity-fix/c1-backfill-dryrun.txt   human report
 *   docs/pipeline-fidelity-fix/c1-backfill-plan.json    before/after, and the
 *                                                       rollback artefact
 *
 * Mirrors deriveLongTermLiabilitiesTotal for both targets independently.
 */
import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import fs from 'fs/promises';

const out: string[] = [];
const say = (s = '') => { console.log(s); out.push(s); };
const only = (s = '') => { out.push(s); };
const f2 = (v: number | null) => (v === null ? 'null' : v.toFixed(2));
const pad = (s: any, w: number) => String(s ?? '').padEnd(w).slice(0, w);
const rp  = (s: any, w: number) => String(s ?? '').padStart(w);

function num(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[£$,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

// The shipped predicate, applied to a five-value shape.
function fold(total: number | null, deferred: number | null, kids: (number | null)[]) {
  if (total === null) return null;
  if (deferred === null || deferred === 0) return null;
  const children = kids.reduce<number>((a, v) => a + (v ?? 0), 0);
  const tol = Math.max(1, Math.abs(total) * 0.0001);
  if (Math.abs(total - (children + deferred)) > tol) return null;
  const corrected = Number((total - deferred).toFixed(2));
  return { children, corrected, goingToZero: Math.abs(corrected) < 0.005 };
}

async function main() {
  const ident = await db.execute<any>(sql`
    SELECT current_database() AS db,
           (SELECT count(*)::int FROM balance_sheets) AS bs,
           (SELECT count(*)::int FROM financial_contributions
              WHERE statement_type = 'balance') AS fc
  `);
  const i0: any = ident.rows[0];
  say('=== IDENTITY ===');
  say(`database=${i0.db}  balance_sheets=${i0.bs}  (prod=697, dev=216)`);
  say(`financial_contributions balance rows=${i0.fc}`);
  if (i0.bs !== 697) say('*** NOT PROD. STOP AND REPORT. ***');
  say('');

  // ── TARGET 1: balance_sheets ────────────────────────────────────────────
  const t1raw = (await db.execute<any>(sql`
    SELECT bs.id, bs.target_company_id AS co, tc.company_name,
           fp.fiscal_year, fp.period_end, bs.source_document_id AS doc,
           d.original_filename,
           bs.total_long_term_liabilities::numeric AS total,
           bs.deferred_taxation::numeric           AS deferred,
           bs.bank_loans_long_term::numeric        AS bank,
           bs.hire_purchase_long_term::numeric     AS hp,
           bs.other_long_term_debt::numeric        AS other_debt
    FROM balance_sheets bs
    JOIN financial_periods fp     ON fp.id = bs.financial_period_id
    LEFT JOIN target_companies tc ON tc.id = bs.target_company_id
    LEFT JOIN documents d         ON d.id  = bs.source_document_id
    ORDER BY bs.target_company_id, fp.fiscal_year, bs.id
  `)).rows as any[];

  const t1: any[] = [];
  for (const r of t1raw) {
    const total = num(r.total), deferred = num(r.deferred);
    const f = fold(total, deferred, [num(r.bank), num(r.hp), num(r.other_debt)]);
    if (!f) continue;
    t1.push({ ...r, total, deferred, ...f });
  }
  const t1sum   = t1.reduce((a, r) => a + r.deferred, 0);
  const t1zero  = t1.filter((r) => r.goingToZero);
  const t1drift = t1.filter((r) => Math.abs(r.corrected - r.children) > 0.005);

  say('=== TARGET 1  balance_sheets.total_long_term_liabilities ===');
  say(`rows to change        : ${t1.length}   ${t1.length === 281 ? 'MATCH 281' : 'MISMATCH vs 281'}`);
  say(`deferred removed      : ${f2(t1sum)}   ${Math.abs(t1sum - 9925991.99) < 0.01 ? 'MATCH' : 'MISMATCH vs 9925991.99'}`);
  say(`rows going to zero    : ${t1zero.length}   ${t1zero.length === 98 ? 'MATCH 98' : 'MISMATCH vs 98'}`);
  say(`subtraction vs children disagree by >0.005 : ${t1drift.length}`);
  for (const r of t1drift) say(`   bs=${r.id} co=${r.co} fy=${r.fiscal_year} corrected=${f2(r.corrected)} children=${f2(r.children)}`);
  say('');

  // ── TARGET 2: financial_contributions.figures ───────────────────────────
  const t2raw = (await db.execute<any>(sql`
    SELECT fc.id, fc.target_company_id AS co, fc.fiscal_year, fc.period_end,
           fc.source_document_id AS doc, fc.source_tier, fc.is_full_year,
           fc.figures->>'totalLongTermLiabilities' AS total,
           fc.figures->>'deferredTaxation'         AS deferred,
           fc.figures->>'bankLoansLongTerm'        AS bank,
           fc.figures->>'hirePurchaseLongTerm'     AS hp,
           fc.figures->>'otherLongTermDebt'        AS other_debt
    FROM financial_contributions fc
    WHERE fc.statement_type = 'balance'
    ORDER BY fc.target_company_id, fc.fiscal_year, fc.id
  `)).rows as any[];

  const withTotal = t2raw.filter((r) => num(r.total) !== null).length;
  const t2: any[] = [];
  for (const r of t2raw) {
    const total = num(r.total), deferred = num(r.deferred);
    const f = fold(total, deferred, [num(r.bank), num(r.hp), num(r.other_debt)]);
    if (!f) continue;
    t2.push({ ...r, total, deferred, ...f });
  }
  const t2sum  = t2.reduce((a, r) => a + r.deferred, 0);
  const t2zero = t2.filter((r) => r.goingToZero);

  say('=== TARGET 2  financial_contributions.figures->totalLongTermLiabilities ===');
  say(`balance rows                 : ${t2raw.length}`);
  say(`carrying a long term total   : ${withTotal}   (v81.2 recorded 818)`);
  say(`rows to change               : ${t2.length}`);
  say(`deferred removed             : ${f2(t2sum)}`);
  say(`rows going to zero           : ${t2zero.length}`);
  say('');

  // ── CROSS-CHECK the two populations ─────────────────────────────────────
  const key = (co: any, fy: any, doc: any) => `${co}|${fy}|${doc ?? 'NONE'}`;
  const t1by = new Map<string, any[]>();
  for (const r of t1) {
    const k = key(r.co, r.fiscal_year, r.doc);
    if (!t1by.has(k)) t1by.set(k, []);
    t1by.get(k)!.push(r);
  }
  const t1AllBy = new Map<string, any>();
  for (const r of t1raw) t1AllBy.set(key(r.target_company_id, r.fiscal_year, r.source_document_id), r);

  let matched = 0; const orphans: any[] = []; const drift: any[] = [];
  for (const r of t2) {
    const k = key(r.co, r.fiscal_year, r.doc);
    if (t1by.has(k)) {
      matched++;
      const bs = t1by.get(k)![0];
      if (Math.abs(bs.total - r.total) > 0.005) drift.push({ fc: r, bs });
    } else {
      const anyBs = t1AllBy.get(k);
      orphans.push({ r, bsExistsButDoesNotChange: !!anyBs });
    }
  }
  const t2keys = new Set(t2.map((r) => key(r.co, r.fiscal_year, r.doc)));
  const uncovered = t1.filter((r) => !t2keys.has(key(r.co, r.fiscal_year, r.doc)));

  say('=== CROSS-CHECK (join on company + fiscal_year + source_document_id) ===');
  say(`target 2 rows matching a changing target 1 row : ${matched}`);
  say(`target 2 rows with NO matching target 1 change : ${orphans.length}`);
  say(`   of those, a balance_sheets row exists but does not change : ${orphans.filter((o) => o.bsExistsButDoesNotChange).length}`);
  say(`target 1 rows with NO matching target 2 row    : ${uncovered.length}`);
  say(`STORED TOTALS DISAGREE between the two tables  : ${drift.length}`);
  for (const d of drift.slice(0, 25)) {
    say(`   co=${d.fc.co} fy=${d.fc.fiscal_year} doc=${d.fc.doc}  fc=${f2(d.fc.total)}  bs=${f2(d.bs.total)}`);
  }
  if (drift.length > 25) say(`   ... ${drift.length - 25} more, see the report file`);
  say('');

  // ── canonical_figure, expected 0 on prod ────────────────────────────────
  const cf = await db.execute<any>(sql`
    SELECT COALESCE((SELECT count(*)::int FROM canonical_figure
                     WHERE figure_path LIKE '%long_term_liabilities.total'), 0) AS c
  `);
  say(`=== canonical_figure on the LTL path: ${cf.rows[0].c}   (v81.2 recorded prod 0) ===`);
  say('');

  // ── THE 98, PRINTED IN FULL FOR EYEBALL ─────────────────────────────────
  say('=== COHORT EYEBALL: every target 1 row going to ZERO ===');
  say(`${pad('bs', 7)}${pad('co', 6)}${pad('company', 26)}${pad('fy', 6)}${pad('doc', 7)}${rp('current', 14)}  file`);
  for (const r of t1zero.sort((a, b) => b.deferred - a.deferred)) {
    say(`${pad(r.id, 7)}${pad(r.co, 6)}${pad(r.company_name, 26)}${pad(r.fiscal_year, 6)}${pad(r.doc ?? 'NONE', 7)}${rp(f2(r.total), 14)}  ${r.original_filename ?? 'NO DOC'}`);
  }
  say('');

  say('=== TOP 20 BY VALUE REMOVED, all target 1 rows ===');
  say(`${pad('bs', 7)}${pad('co', 6)}${pad('company', 26)}${pad('fy', 6)}${rp('before', 14)}${rp('after', 14)}${rp('removed', 14)}`);
  for (const r of [...t1].sort((a, b) => b.deferred - a.deferred).slice(0, 20)) {
    say(`${pad(r.id, 7)}${pad(r.co, 6)}${pad(r.company_name, 26)}${pad(r.fiscal_year, 6)}${rp(f2(r.total), 14)}${rp(f2(r.corrected), 14)}${rp(f2(r.deferred), 14)}`);
  }
  say('');

  say('=== PLANNED APPLY, NOT RUN ===');
  say(`one transaction, target 1 first (${t1.length} rows), then target 2 (${t2.length} rows)`);
  say(`total deferred removed: target 1 ${f2(t1sum)}, target 2 ${f2(t2sum)}`);
  say('NOTHING WAS WRITTEN. This run issued SELECT statements only.');

  only('');
  only('=== FULL TARGET 1 PLAN ===');
  for (const r of t1) only(`bs=${r.id} co=${r.co} fy=${r.fiscal_year} doc=${r.doc ?? 'NONE'} before=${f2(r.total)} after=${f2(r.corrected)} removed=${f2(r.deferred)} zero=${r.goingToZero}`);
  only('');
  only('=== FULL TARGET 2 PLAN ===');
  for (const r of t2) only(`fc=${r.id} co=${r.co} fy=${r.fiscal_year} doc=${r.doc ?? 'NONE'} tier=${r.source_tier} before=${f2(r.total)} after=${f2(r.corrected)} removed=${f2(r.deferred)} zero=${r.goingToZero}`);
  only('');
  only('=== FULL DRIFT LIST ===');
  for (const d of drift) only(`co=${d.fc.co} fy=${d.fc.fiscal_year} doc=${d.fc.doc} fc=${f2(d.fc.total)} bs=${f2(d.bs.total)}`);

  await fs.writeFile('docs/pipeline-fidelity-fix/c1-backfill-dryrun.txt', out.join('\n'), 'utf8');
  await fs.writeFile('docs/pipeline-fidelity-fix/c1-backfill-plan.json', JSON.stringify({
    generatedAgainst: i0.db,
    balanceSheetsRowCount: i0.bs,
    target1: t1.map((r) => ({ id: r.id, co: r.co, fy: r.fiscal_year, before: r.total, after: r.corrected })),
    target2: t2.map((r) => ({ id: r.id, co: r.co, fy: r.fiscal_year, before: r.total, after: r.corrected })),
  }, null, 2), 'utf8');

  console.log('Report:   docs/pipeline-fidelity-fix/c1-backfill-dryrun.txt');
  console.log('Plan and rollback artefact: docs/pipeline-fidelity-fix/c1-backfill-plan.json');
}

main().catch((e) => { console.error(e); process.exit(1); });