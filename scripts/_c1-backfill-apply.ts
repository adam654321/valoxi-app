/**
 * scripts/_c1-backfill-apply.ts
 * CONTRACT 1 backfill. Writes to exactly two tables, in one transaction.
 * Refuses to write unless --fire is passed. Aborts before the transaction if
 * any plan assertion misses. Never touches updated_at. Never touches
 * deferred_taxation. Never touches document_evidence_figure.
 */
import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import fs from 'fs/promises';

const FIRE = process.argv.includes('--fire');

const out: string[] = [];
const say = (s = '') => { console.log(s); out.push(s); };
const f2 = (v: number) => v.toFixed(2);
const near = (a: number, b: number) => Math.abs(a - b) < 0.005;

function num(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[£$,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}
function fold(total: number | null, deferred: number | null, kids: (number | null)[]) {
  if (total === null || deferred === null || deferred === 0) return null;
  const children = kids.reduce<number>((a, v) => a + (v ?? 0), 0);
  if (Math.abs(total - (children + deferred)) > Math.max(1, Math.abs(total) * 0.0001)) return null;
  return Number((total - deferred).toFixed(2));
}
// Preserve each row's own textual convention inside the JSONB payload.
function sameShape(existingRaw: string, corrected: number): string {
  const hasPoint = String(existingRaw).includes('.');
  if (!hasPoint && Number.isInteger(corrected)) return String(corrected);
  return corrected.toFixed(2);
}

async function main() {
  say(`MODE: ${FIRE ? '*** FIRE, WILL WRITE ***' : 'rehearsal, will NOT write'}`);
  say('');

  const i0: any = (await db.execute<any>(sql`
    SELECT current_database() AS db,
           (SELECT count(*)::int FROM balance_sheets) AS bs,
           (SELECT count(*)::int FROM financial_contributions WHERE statement_type='balance') AS fc,
           (SELECT COALESCE(sum(total_long_term_liabilities::numeric),0) FROM balance_sheets) AS ltl_before,
           (SELECT COALESCE(sum(deferred_taxation::numeric),0) FROM balance_sheets) AS def_before
  `)).rows[0];
  say('=== IDENTITY ===');
  say(`database=${i0.db}  balance_sheets=${i0.bs}  fc_balance=${i0.fc}`);
  say(`SUM total_long_term_liabilities BEFORE : ${i0.ltl_before}`);
  say(`SUM deferred_taxation BEFORE           : ${i0.def_before}`);
  if (i0.db !== 'neondb' || i0.bs !== 697) { say('*** IDENTITY GUARD FAILED. ABORT. ***'); process.exit(1); }
  say('');

  // ── PLAN, recomputed from live data ─────────────────────────────────────
  const t1src = (await db.execute<any>(sql`
    SELECT id, total_long_term_liabilities::numeric AS total, deferred_taxation::numeric AS deferred,
           bank_loans_long_term::numeric AS bank, hire_purchase_long_term::numeric AS hp,
           other_long_term_debt::numeric AS other_debt
    FROM balance_sheets ORDER BY id
  `)).rows as any[];
  const t1: any[] = [];
  for (const r of t1src) {
    const total = num(r.total), deferred = num(r.deferred);
    const corrected = fold(total, deferred, [num(r.bank), num(r.hp), num(r.other_debt)]);
    if (corrected === null) continue;
    t1.push({ id: r.id, before: total as number, after: corrected, removed: (total as number) - corrected });
  }

  const t2src = (await db.execute<any>(sql`
    SELECT id,
           figures->>'totalLongTermLiabilities' AS total,
           figures->>'deferredTaxation'         AS deferred,
           figures->>'bankLoansLongTerm'        AS bank,
           figures->>'hirePurchaseLongTerm'     AS hp,
           figures->>'otherLongTermDebt'        AS other_debt
    FROM financial_contributions WHERE statement_type='balance' ORDER BY id
  `)).rows as any[];
  const t2: any[] = [];
  let withPoint = 0, withoutPoint = 0;
  for (const r of t2src) {
    const total = num(r.total), deferred = num(r.deferred);
    const corrected = fold(total, deferred, [num(r.bank), num(r.hp), num(r.other_debt)]);
    if (corrected === null) continue;
    if (String(r.total).includes('.')) withPoint++; else withoutPoint++;
    t2.push({ id: r.id, beforeRaw: String(r.total), before: total as number, after: corrected,
              newStr: sameShape(String(r.total), corrected), removed: (total as number) - corrected });
  }

  const t1sum = t1.reduce((a, r) => a + r.removed, 0);
  const t2sum = t2.reduce((a, r) => a + r.removed, 0);
  const t1zero = t1.filter((r) => Math.abs(r.after) < 0.005).length;
  const t2zero = t2.filter((r) => Math.abs(r.after) < 0.005).length;

  say('=== PLAN ASSERTIONS ===');
  const checks: [string, boolean, string][] = [
    ['target 1 rows        281', t1.length === 281, String(t1.length)],
    ['target 1 sum  9925991.99', near(t1sum, 9925991.99), f2(t1sum)],
    ['target 1 zeros        98', t1zero === 98, String(t1zero)],
    ['target 2 rows        312', t2.length === 312, String(t2.length)],
    ['target 2 sum 10609336.94', near(t2sum, 10609336.94), f2(t2sum)],
    ['target 2 zeros       113', t2zero === 113, String(t2zero)],
  ];
  for (const [label, ok, actual] of checks) say(`  ${ok ? 'PASS' : 'FAIL'}  ${label}   actual ${actual}`);
  say(`  JSONB format: ${withoutPoint} bare integer, ${withPoint} with a decimal point`);
  say('');
  if (checks.some(([, ok]) => !ok)) { say('*** AN ASSERTION FAILED. NOTHING WRITTEN. ABORT. ***'); process.exit(1); }

  // ── ROLLBACK ARTEFACT, written before any transaction ───────────────────
  await fs.writeFile('docs/pipeline-fidelity-fix/c1-backfill-rollback.json', JSON.stringify({
    database: i0.db, ltlSumBefore: String(i0.ltl_before), deferredSumBefore: String(i0.def_before),
    balanceSheets: t1.map((r) => ({ id: r.id, priorValue: r.before })),
    contributions: t2.map((r) => ({ id: r.id, priorValueRaw: r.beforeRaw })),
  }, null, 2), 'utf8');
  say('rollback artefact written: docs/pipeline-fidelity-fix/c1-backfill-rollback.json');
  say('');

  if (!FIRE) {
    say('REHEARSAL COMPLETE. All assertions passed. Nothing was written.');
    say('Re-run with --fire to apply.');
    await fs.writeFile('docs/pipeline-fidelity-fix/c1-backfill-apply.txt', out.join('\n'), 'utf8');
    return;
  }

  // ── THE WRITE ───────────────────────────────────────────────────────────
  let n1 = 0, n2 = 0;
  await db.transaction(async (tx) => {
    for (const r of t1) {
      const res: any = await tx.execute(sql`
UPDATE balance_sheets SET total_long_term_liabilities = ${r.after}::numeric WHERE id = ${r.id}
      `);
      const c = res.rowCount ?? res.rowsAffected ?? 1;
      if (c !== 1) throw new Error(`target 1 id ${r.id} affected ${c} rows, expected 1`);
      n1++;
    }
    for (const r of t2) {
      const res: any = await tx.execute(sql`
UPDATE financial_contributions SET figures = jsonb_set(figures, '{totalLongTermLiabilities}', to_jsonb(${r.newStr}::text), false) WHERE id = ${r.id}
      `);
      const c = res.rowCount ?? res.rowsAffected ?? 1;
      if (c !== 1) throw new Error(`target 2 id ${r.id} affected ${c} rows, expected 1`);
      n2++;
    }
    if (n1 !== 281 || n2 !== 312) throw new Error(`row counts ${n1}/${n2}, expected 281/312`);
  });
  say(`TRANSACTION COMMITTED. target 1 ${n1} rows, target 2 ${n2} rows.`);
  say('');

  // ── POST-WRITE VERIFICATION ─────────────────────────────────────────────
  const p: any = (await db.execute<any>(sql`
    SELECT (SELECT count(*)::int FROM balance_sheets) AS bs,
           (SELECT count(*)::int FROM financial_contributions WHERE statement_type='balance') AS fc,
           (SELECT COALESCE(sum(total_long_term_liabilities::numeric),0) FROM balance_sheets) AS ltl_after,
           (SELECT COALESCE(sum(deferred_taxation::numeric),0) FROM balance_sheets) AS def_after,
           (SELECT count(*)::int FROM financial_contributions
              WHERE statement_type='balance'
                AND jsonb_typeof(figures->'totalLongTermLiabilities')='string') AS str_keys
  `)).rows[0];

  const ltlDelta = Number(i0.ltl_before) - Number(p.ltl_after);
  say('=== POST-WRITE VERIFICATION ===');
  say(`  ${p.bs === 697 ? 'PASS' : 'FAIL'}  balance_sheets row count unchanged: ${p.bs}`);
  say(`  ${p.fc === 818 ? 'PASS' : 'FAIL'}  fc balance row count unchanged: ${p.fc}`);
  say(`  ${near(ltlDelta, 9925991.99) ? 'PASS' : 'FAIL'}  LTL sum fell by exactly 9925991.99: fell by ${f2(ltlDelta)}`);
  say(`        before ${i0.ltl_before}   after ${p.ltl_after}`);
  say(`  ${near(Number(i0.def_before), Number(p.def_after)) ? 'PASS' : 'FAIL'}  deferred_taxation sum UNCHANGED: ${p.def_before} then ${p.def_after}`);
  say(`  ${p.str_keys === 759 ? 'PASS' : 'FAIL'}  JSONB key still a string on 759 rows: ${p.str_keys}`);

  // The predicate must no longer fire anywhere.
  const again1 = (await db.execute<any>(sql`
    SELECT id, total_long_term_liabilities::numeric AS total, deferred_taxation::numeric AS deferred,
           bank_loans_long_term::numeric AS bank, hire_purchase_long_term::numeric AS hp,
           other_long_term_debt::numeric AS other_debt FROM balance_sheets
  `)).rows.filter((r: any) => fold(num(r.total), num(r.deferred), [num(r.bank), num(r.hp), num(r.other_debt)]) !== null);
  const again2 = (await db.execute<any>(sql`
    SELECT id, figures->>'totalLongTermLiabilities' AS total, figures->>'deferredTaxation' AS deferred,
           figures->>'bankLoansLongTerm' AS bank, figures->>'hirePurchaseLongTerm' AS hp,
           figures->>'otherLongTermDebt' AS other_debt
    FROM financial_contributions WHERE statement_type='balance'
  `)).rows.filter((r: any) => fold(num(r.total), num(r.deferred), [num(r.bank), num(r.hp), num(r.other_debt)]) !== null);
  say(`  ${again1.length === 0 ? 'PASS' : 'FAIL'}  predicate now fires on 0 balance_sheets rows: ${again1.length}`);
  say(`  ${again2.length === 0 ? 'PASS' : 'FAIL'}  predicate now fires on 0 contribution rows: ${again2.length}`);
  say('');
  say('Rollback: docs/pipeline-fidelity-fix/c1-backfill-rollback.json holds every prior value.');

  await fs.writeFile('docs/pipeline-fidelity-fix/c1-backfill-apply.txt', out.join('\n'), 'utf8');
}

main().catch((e) => { console.error(e); process.exit(1); });
