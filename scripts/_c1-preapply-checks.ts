/**
 * scripts/_c1-preapply-checks.ts
 * CONTRACT 1 pre-apply checks. Compute only, SELECT statements only.
 * 1. Classify the 32 changing contributions that have no balance_sheets match.
 * 2. Identify the 1 changing balance_sheets row with no contribution.
 * 3. Report the JSON value type stored inside figures for the five LTL keys.
 */
import { db } from '../server/db';
import { sql } from 'drizzle-orm';

const f2 = (v: number | null) => (v === null ? 'null' : v.toFixed(2));
const pad = (s: any, w: number) => String(s ?? '').padEnd(w).slice(0, w);
const rp  = (s: any, w: number) => String(s ?? '').padStart(w);

function num(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[£$,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}
function fold(total: number | null, deferred: number | null, kids: (number | null)[]) {
  if (total === null || deferred === null || deferred === 0) return null;
  const children = kids.reduce<number>((a, v) => a + (v ?? 0), 0);
  if (Math.abs(total - (children + deferred)) > Math.max(1, Math.abs(total) * 0.0001)) return null;
  return { children, corrected: Number((total - deferred).toFixed(2)) };
}

async function main() {
  const id0: any = (await db.execute<any>(sql`
    SELECT current_database() AS db, (SELECT count(*)::int FROM balance_sheets) AS bs
  `)).rows[0];
  console.log(`database=${id0.db}  balance_sheets=${id0.bs}   (prod=697)`);
  if (id0.bs !== 697) { console.log('*** NOT PROD. STOP. ***'); return; }
  console.log('');

  const bsRows = (await db.execute<any>(sql`
    SELECT bs.id, bs.target_company_id AS co, fp.fiscal_year AS fy,
           bs.source_document_id AS doc,
           bs.total_long_term_liabilities::numeric AS total,
           bs.deferred_taxation::numeric           AS deferred,
           bs.bank_loans_long_term::numeric        AS bank,
           bs.hire_purchase_long_term::numeric     AS hp,
           bs.other_long_term_debt::numeric        AS other_debt
    FROM balance_sheets bs
    JOIN financial_periods fp ON fp.id = bs.financial_period_id
  `)).rows as any[];

  const fcRows = (await db.execute<any>(sql`
    SELECT fc.id, fc.target_company_id AS co, fc.fiscal_year AS fy,
           fc.source_document_id AS doc, fc.source_tier, fc.is_full_year,
           fc.figures->>'totalLongTermLiabilities' AS total,
           fc.figures->>'deferredTaxation'         AS deferred,
           fc.figures->>'bankLoansLongTerm'        AS bank,
           fc.figures->>'hirePurchaseLongTerm'     AS hp,
           fc.figures->>'otherLongTermDebt'        AS other_debt
    FROM financial_contributions fc
    WHERE fc.statement_type = 'balance'
  `)).rows as any[];

  const changes = (r: any) => fold(num(r.total), num(r.deferred), [num(r.bank), num(r.hp), num(r.other_debt)]);

  const bsChanging = bsRows.filter(changes);
  const fcChanging = fcRows.filter(changes);

  const kDoc = (co: any, fy: any, doc: any) => `${co}|${fy}|${doc ?? 'NONE'}`;
  const kYear = (co: any, fy: any) => `${co}|${fy}`;

  const bsChangingByDoc = new Set(bsChanging.map((r) => kDoc(r.co, r.fy, r.doc)));
  const bsAllByYear = new Map<string, any[]>();
  for (const r of bsRows) {
    const k = kYear(r.co, r.fy);
    if (!bsAllByYear.has(k)) bsAllByYear.set(k, []);
    bsAllByYear.get(k)!.push(r);
  }
  const bsChangingIds = new Set(bsChanging.map((r) => r.id));

  console.log(`changing: balance_sheets ${bsChanging.length} (expect 281), contributions ${fcChanging.length} (expect 312)`);
  console.log('');

  // ── 1. the 32 ───────────────────────────────────────────────────────────
  const unmatched = fcChanging.filter((r) => !bsChangingByDoc.has(kDoc(r.co, r.fy, r.doc)));
  console.log(`=== 1. CHANGING CONTRIBUTIONS WITH NO MATCHING balance_sheets CHANGE: ${unmatched.length} ===`);
  console.log(`${pad('fc', 7)}${pad('co', 6)}${pad('fy', 6)}${pad('doc', 7)}${pad('tier', 22)}${rp('total', 14)}  verdict`);
  const tally: Record<string, number> = {};
  for (const r of unmatched.sort((a, b) => (num(b.total) ?? 0) - (num(a.total) ?? 0))) {
    const siblings = bsAllByYear.get(kYear(r.co, r.fy)) ?? [];
    let verdict: string;
    if (siblings.length === 0) {
      verdict = 'NO balance_sheets ROW FOR THIS COMPANY-YEAR AT ALL';
    } else {
      const docs = siblings.map((s) => `${s.doc ?? 'NONE'}${bsChangingIds.has(s.id) ? '*' : ''}`).join(',');
      const anyChanging = siblings.some((s) => bsChangingIds.has(s.id));
      verdict = `winner elsewhere, bs doc(s)=${docs}${anyChanging ? ' (starred = also changing)' : ' (none changing)'}`;
    }
    tally[verdict.split(',')[0]] = (tally[verdict.split(',')[0]] ?? 0) + 1;
    console.log(`${pad(r.id, 7)}${pad(r.co, 6)}${pad(r.fy, 6)}${pad(r.doc ?? 'NONE', 7)}${pad(r.source_tier, 22)}${rp(f2(num(r.total)), 14)}  ${verdict}`);
  }
  console.log('');
  console.log('tally:'); for (const [k, v] of Object.entries(tally)) console.log(`  ${v}  ${k}`);
  console.log('');

  // ── 2. the 1 ────────────────────────────────────────────────────────────
  const fcChangingByDoc = new Set(fcChanging.map((r) => kDoc(r.co, r.fy, r.doc)));
  const lonely = bsChanging.filter((r) => !fcChangingByDoc.has(kDoc(r.co, r.fy, r.doc)));
  console.log(`=== 2. CHANGING balance_sheets ROWS WITH NO CONTRIBUTION: ${lonely.length} ===`);
  for (const r of lonely) {
    const fcAny = fcRows.filter((f) => f.co === r.co && f.fy === r.fy);
    console.log(`bs=${r.id} co=${r.co} fy=${r.fy} doc=${r.doc ?? 'NONE'} total=${f2(num(r.total))} deferred=${f2(num(r.deferred))}`);
    console.log(`   contributions for that company-year: ${fcAny.length ? fcAny.map((f) => `fc=${f.id} doc=${f.doc ?? 'NONE'}`).join('  ') : 'NONE'}`);
  }
  console.log('');

  // ── 3. JSON value types ─────────────────────────────────────────────────
  const types = (await db.execute<any>(sql`
    SELECT jsonb_typeof(figures->'totalLongTermLiabilities') AS t_total,
           jsonb_typeof(figures->'deferredTaxation')         AS t_deferred,
           jsonb_typeof(figures->'bankLoansLongTerm')        AS t_bank,
           count(*)::int AS n
    FROM financial_contributions
    WHERE statement_type = 'balance'
    GROUP BY 1,2,3 ORDER BY n DESC
  `)).rows as any[];
  console.log('=== 3. JSON VALUE TYPES INSIDE figures ===');
  console.log(`${pad('total', 12)}${pad('deferred', 12)}${pad('bankLoans', 12)}${rp('rows', 7)}`);
  for (const t of types) console.log(`${pad(t.t_total, 12)}${pad(t.t_deferred, 12)}${pad(t.t_bank, 12)}${rp(t.n, 7)}`);
  console.log('');

  const samples = (await db.execute<any>(sql`
    SELECT id, figures->'totalLongTermLiabilities' AS raw_total,
               figures->'deferredTaxation'         AS raw_deferred
    FROM financial_contributions
    WHERE statement_type = 'balance'
      AND figures->>'totalLongTermLiabilities' IS NOT NULL
    ORDER BY id LIMIT 5
  `)).rows as any[];
  console.log('raw samples, exact stored form:');
  for (const s of samples) console.log(`  fc=${s.id}  total=${JSON.stringify(s.raw_total)}  deferred=${JSON.stringify(s.raw_deferred)}`);
  console.log('');
  console.log('Nothing was written. SELECT statements only.');
}

main().catch((e) => { console.error(e); process.exit(1); });