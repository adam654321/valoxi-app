/**
 * scripts/_c1-paper-sample-assess.ts
 * CONTRACT 1 (long_term_liabilities.total) — population assess before paper
 * verification. Mirrors deriveLongTermLiabilitiesTotal against balance_sheets.
 *
 * READ-ONLY on the database. No INSERT, UPDATE, DELETE, ALTER. No db:push.
 * R2 access is HEAD only. No object downloads.
 * Writes exactly one report file under docs/pipeline-fidelity-fix/.
 */
import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import { fileStorageService } from '../server/services/file-storage.service';
import fs from 'fs/promises';

const out: string[] = [];
const say = (s = '') => { console.log(s); out.push(s); };
const only = (s = '') => { out.push(s); };
const f2 = (v: number | null) => (v === null ? 'null' : v.toFixed(2));
const pad = (s: any, w: number) => String(s ?? '').padEnd(w).slice(0, w);
const rpad = (s: any, w: number) => String(s ?? '').padStart(w);

async function main() {
  // ── IDENTITY ──────────────────────────────────────────────────────────
  const ident = await db.execute<any>(sql`
    SELECT current_database() AS db,
           (SELECT count(*)::int FROM documents)      AS documents,
           (SELECT count(*)::int FROM balance_sheets) AS balance_sheets,
           (SELECT string_agg(last_name, ',') FROM users WHERE email ILIKE 'adam%')
             AS adam_last_names
  `);
  const i0: any = ident.rows[0];
  say('=== IDENTITY ===');
  say(`database=${i0.db}  documents=${i0.documents}  balance_sheets=${i0.balance_sheets}`);
  say(`adam last_name(s)=${i0.adam_last_names}   (prod expects Coxon, dev expects David)`);
  say('');

  // ── POPULATION COMPANION (never count without proving non-empty) ──────
  const pop = await db.execute<any>(sql`
    SELECT count(*)::int AS all_rows,
           (count(*) FILTER (WHERE total_long_term_liabilities IS NOT NULL))::int
             AS with_total,
           (count(*) FILTER (WHERE deferred_taxation IS NOT NULL))::int
             AS with_deferred,
           (count(*) FILTER (WHERE deferred_taxation IS NOT NULL
                               AND deferred_taxation::numeric <> 0))::int
             AS with_nonzero_deferred
    FROM balance_sheets
  `);
  const p0: any = pop.rows[0];
  say('=== POPULATION ===');
  say(`balance_sheets rows          : ${p0.all_rows}`);
  say(`with a long term total       : ${p0.with_total}`);
  say(`with a deferred figure       : ${p0.with_deferred}`);
  say(`with NON-ZERO deferred       : ${p0.with_nonzero_deferred}`);
  say('');

  // ── CANDIDATE SET ─────────────────────────────────────────────────────
  const rows = (await db.execute<any>(sql`
    SELECT bs.id                                        AS bs_id,
           bs.target_company_id                         AS company_id,
           tc.company_name,
           bs.financial_period_id                       AS period_id,
           fp.fiscal_year,
           fp.period_end,
           fp.period_type,
           fp.is_full_year,
           bs.source_document_id                        AS doc_id,
           d.document_category,
           d.original_filename,
           d.file_path                                  AS r2_key,
           bs.total_long_term_liabilities::numeric      AS total,
           bs.deferred_taxation::numeric                AS deferred,
           COALESCE(bs.bank_loans_long_term::numeric, 0)     AS bank,
           COALESCE(bs.hire_purchase_long_term::numeric, 0)  AS hp,
           COALESCE(bs.other_long_term_debt::numeric, 0)     AS other_debt,
           bs.total_current_liabilities::numeric        AS tcl,
           bs.total_equity::numeric                     AS equity
    FROM balance_sheets bs
    JOIN financial_periods fp   ON fp.id = bs.financial_period_id
    LEFT JOIN target_companies tc ON tc.id = bs.target_company_id
    LEFT JOIN documents d       ON d.id  = bs.source_document_id
    WHERE bs.total_long_term_liabilities IS NOT NULL
      AND bs.deferred_taxation IS NOT NULL
      AND bs.deferred_taxation::numeric <> 0
    ORDER BY bs.target_company_id, fp.fiscal_year, bs.id
  `)).rows as any[];

  const enriched = rows.map((r) => {
    const total = Number(r.total);
    const deferred = Number(r.deferred);
    const children = Number(r.bank) + Number(r.hp) + Number(r.other_debt);
    const tol = Math.max(1, Math.abs(total) * 0.0001);
    const wouldChange = Math.abs(total - (children + deferred)) <= tol;
    const corrected = total - deferred;
    return {
      ...r, total, deferred, children, corrected, wouldChange,
      goingToZero: wouldChange && Math.abs(corrected) < 0.005,
      degenerate: wouldChange && Math.abs(children) < 0.005,
    };
  });

  const wc = enriched.filter((r) => r.wouldChange);
  const residue = enriched.filter((r) => !r.wouldChange);
  const sumDeferred = wc.reduce((a, r) => a + r.deferred, 0);
  const zero = wc.filter((r) => r.goingToZero);
  const degen = wc.filter((r) => r.degenerate);

  say('=== SIZING REPRODUCTION (expect 281 / 9925991.99 / 98) ===');
  say(`would-change rows            : ${wc.length}   ${wc.length === 281 ? 'MATCH' : 'MISMATCH vs 281'}`);
  say(`deferred tax removed         : ${f2(sumDeferred)}   ${Math.abs(sumDeferred - 9925991.99) < 0.01 ? 'MATCH' : 'MISMATCH vs 9925991.99'}`);
  say(`rows going to exactly zero   : ${zero.length}   ${zero.length === 98 ? 'MATCH' : 'MISMATCH vs 98'}`);
  say(`DEGENERATE (children = 0)    : ${degen.length}`);
  say(`non-zero-deferred residue    : ${residue.length}  (predicate does not fire, left alone)`);
  say('');

  // ── SOURCE DOCUMENT COVERAGE ──────────────────────────────────────────
  const noDoc = wc.filter((r) => r.doc_id === null || r.doc_id === undefined);
  say('=== SOURCE DOCUMENT COVERAGE ===');
  say(`would-change rows with NO source_document_id : ${noDoc.length}  (cannot be paper-verified)`);
  say(`distinct source documents                    : ${new Set(wc.filter(r => r.doc_id).map(r => r.doc_id)).size}`);
  say(`distinct companies                           : ${new Set(wc.map(r => r.company_id)).size}`);
  say('');

  // ── PER COMPANY ───────────────────────────────────────────────────────
  const byCo = new Map<number, any[]>();
  for (const r of wc) {
    if (!byCo.has(r.company_id)) byCo.set(r.company_id, []);
    byCo.get(r.company_id)!.push(r);
  }
  const coStats = [...byCo.entries()].map(([cid, rs]) => ({
    cid,
    name: rs[0].company_name,
    rows: rs.length,
    sum: rs.reduce((a, r) => a + r.deferred, 0),
    zeros: rs.filter((r) => r.goingToZero).length,
    docs: new Set(rs.filter(r => r.doc_id).map(r => r.doc_id)).size,
    cats: [...new Set(rs.map((r) => r.document_category ?? 'NO DOC'))].join('|'),
  })).sort((a, b) => b.sum - a.sum);

  say('=== PER COMPANY (would-change rows, sorted by deferred at risk) ===');
  say(`${pad('co', 6)}${pad('name', 30)}${rpad('rows', 5)}${rpad('zeros', 6)}${rpad('docs', 5)}${rpad('deferred', 14)}  categories`);
  for (const c of coStats) {
    say(`${pad(c.cid, 6)}${pad(c.name, 30)}${rpad(c.rows, 5)}${rpad(c.zeros, 6)}${rpad(c.docs, 5)}${rpad(f2(c.sum), 14)}  ${c.cats}`);
  }
  say('');

  // ── COHORT x CATEGORY ─────────────────────────────────────────────────
  const matrix = new Map<string, { zero: number; multi: number; sum: number }>();
  for (const r of wc) {
    const k = r.document_category ?? 'NO DOC';
    if (!matrix.has(k)) matrix.set(k, { zero: 0, multi: 0, sum: 0 });
    const e = matrix.get(k)!;
    if (r.goingToZero) e.zero++; else e.multi++;
    e.sum += r.deferred;
  }
  say('=== COHORT x DOCUMENT CATEGORY (category used for SAMPLING only, never tiering) ===');
  say(`${pad('category', 32)}${rpad('to-zero', 9)}${rpad('multi', 8)}${rpad('deferred', 14)}`);
  for (const [k, v] of [...matrix.entries()].sort((a, b) => b[1].sum - a[1].sum)) {
    say(`${pad(k, 32)}${rpad(v.zero, 9)}${rpad(v.multi, 8)}${rpad(f2(v.sum), 14)}`);
  }
  say('');

  // ── SHORTLIST: largest row per company per cohort ─────────────────────
  say('=== SHORTLIST (largest deferred per company per cohort) ===');
  say(`${pad('bs', 7)}${pad('co', 6)}${pad('fy', 6)}${pad('doc', 7)}${pad('cohort', 9)}${rpad('total', 13)}${rpad('deferred', 13)}${rpad('children', 13)}${rpad('corrected', 13)}${rpad('tcl', 13)}${rpad('equity', 13)}  file`);
  const shortlist: any[] = [];
  for (const c of coStats) {
    const rs = byCo.get(c.cid)!;
    for (const cohort of ['ZERO', 'MULTI'] as const) {
      const subset = rs.filter((r) => (cohort === 'ZERO' ? r.goingToZero : !r.goingToZero));
      if (!subset.length) continue;
      const best = subset.reduce((a, r) => (r.deferred > a.deferred ? r : a));
      shortlist.push(best);
      say(`${pad(best.bs_id, 7)}${pad(best.company_id, 6)}${pad(best.fiscal_year, 6)}${pad(best.doc_id ?? 'NONE', 7)}${pad(cohort, 9)}${rpad(f2(best.total), 13)}${rpad(f2(best.deferred), 13)}${rpad(f2(best.children), 13)}${rpad(f2(best.corrected), 13)}${rpad(best.tcl === null ? 'null' : f2(Number(best.tcl)), 13)}${rpad(best.equity === null ? 'null' : f2(Number(best.equity)), 13)}  ${best.original_filename ?? 'NO DOC'}`);
    }
  }
  say('');

  // ── R2 HEAD CHECK on shortlist documents only ─────────────────────────
  const keys = [...new Map(shortlist.filter((r) => r.r2_key).map((r) => [r.doc_id, r])).values()];
  say('=== R2 HEAD CHECK (shortlist documents only, no downloads) ===');
  for (const r of keys) {
    let res: any = null;
    try { res = await fileStorageService.head(r.r2_key); } catch (_) { res = null; }
    say(`doc=${pad(r.doc_id, 7)}co=${pad(r.company_id, 6)}${res ? `OK  bytes=${rpad(res.size, 10)} type=${res.contentType}` : 'NOT FETCHABLE'}`);
    say(`     key=${r.r2_key}`);
  }
  say('');

  // ── FULL ROW LISTING goes to file only ────────────────────────────────
  only('=== FULL WOULD-CHANGE ROW LISTING ===');
  for (const r of wc) {
    only(`bs=${r.bs_id} co=${r.company_id} fy=${r.fiscal_year} pe=${r.period_end} doc=${r.doc_id ?? 'NONE'} cat=${r.document_category ?? '-'} total=${f2(r.total)} deferred=${f2(r.deferred)} children=${f2(r.children)} corrected=${f2(r.corrected)} zero=${r.goingToZero} file=${r.original_filename ?? '-'}`);
  }
  only('');
  only('=== NON-FIRING RESIDUE (non-zero deferred, predicate does not fire) ===');
  for (const r of residue) {
    only(`bs=${r.bs_id} co=${r.company_id} fy=${r.fiscal_year} doc=${r.doc_id ?? 'NONE'} total=${f2(r.total)} deferred=${f2(r.deferred)} children=${f2(r.children)} gap=${f2(r.total - (r.children + r.deferred))}`);
  }

  const path = 'docs/pipeline-fidelity-fix/c1-paper-sample-assess.txt';
  await fs.writeFile(path, out.join('\n'), 'utf8');
  console.log(`Full report written to ${path}`);
}

main().catch((e) => { console.error(e); process.exit(1); });