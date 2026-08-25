/**
 * scripts/_c1-paper-read-cvc.ts
 * CONTRACT 1 paper verification, company 114, docs 650 and 652.
 * SELECT statements only. R2 download only. Writes one report file.
 * Fixes two defects in _c1-paper-read.ts: year-to-column matching, and a
 * determinism check that compared column shape rather than figures.
 */
import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import { geminiClient } from '../server/services/gemini-client';
import { fileStorageService } from '../server/services/file-storage.service';
import fs from 'fs/promises';

const DOC_IDS = [650, 652];

const out: string[] = [];
const say = (s = '') => { console.log(s); out.push(s); };
const f2 = (v: number | null) => (v === null ? 'null' : v.toFixed(2));
const near = (a: number, b: number) => Math.abs(a - b) <= Math.max(1, Math.abs(b) * 0.0001);

function money(s: any): number | null {
  if (s === null || s === undefined) return null;
  const t = String(s).trim();
  if (t === '' || t === '-' || t === '—' || t === '–') return null;
  const neg = /^\(.*\)$/.test(t);
  const c = t.replace(/[()£$,\s]/g, '');
  if (c === '') return null;
  const n = parseFloat(c);
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}

// FIX 1: derive candidate fiscal years from a printed column heading.
function headingYears(h: any): Set<number> {
  const s = String(h ?? '');
  const years = new Set<number>();
  for (const m of s.matchAll(/(?:19|20)\d{2}/g)) years.add(Number(m[0]));
  const dm = [...s.matchAll(/\b\d{1,2}[./-]\d{1,2}[./-](\d{2})\b/g)];
  if (dm.length) { for (const m of dm) years.add(2000 + Number(m[1])); return years; }
  if (years.size) return years;
  for (const m of s.matchAll(/\b(?:FY|Y)?(\d{2})\b/gi)) {
    const n = Number(m[1]);
    if (n >= 15 && n <= 40) years.add(2000 + n);
  }
  return years;
}

// FIX 2: hash the FIGURES, not the column shape.
function figureHash(p: any): string {
  const grab = (a: any) => (Array.isArray(a) ? a.map(money).filter((v) => v !== null).map((v) => Math.abs(v as number)).sort((x, y) => x - y) : []);
  return JSON.stringify({
    c: grab(p?.creditors_due_after_more_than_one_year?.values),
    v: grab(p?.provisions_for_liabilities?.values),
    t: grab(p?.total_assets_less_current_liabilities),
    n: grab(p?.net_assets),
  });
}

const TRANSCRIBE_PROMPT = `
You are transcribing a printed UK company balance sheet. You are NOT extracting
financial data, NOT classifying anything, and NOT calculating anything.

Find the BALANCE SHEET page. If more than one balance sheet appears, use the one
that forms part of the financial statements, not a detailed or non-statutory page,
and say which you used.

Transcribe EXACTLY what is printed. Copy labels character for character. Copy
figures character for character INCLUDING brackets, commas and any dash used for
a nil or absent line. Never substitute, never round, never add a figure that is
not printed. Where a line is not printed at all, use null.

Return ONLY this JSON:

{
  "balance_sheet_page": <number>,
  "page_footer_text": <string or null>,
  "is_marked_not_part_of_statutory_statements": <true or false>,
  "column_headings": [<string>, ...],
  "total_assets_less_current_liabilities": [<string or null>, ...],
  "creditors_due_after_more_than_one_year": {
    "line_is_printed": <true or false>,
    "label_as_printed": <string or null>,
    "note_ref": <string or null>,
    "values": [<string or null>, ...]
  },
  "provisions_for_liabilities": {
    "line_is_printed": <true or false>,
    "label_as_printed": <string or null>,
    "values": [<string or null>, ...]
  },
  "net_assets": [<string or null>, ...],
  "all_lines_between_total_assets_less_current_liabilities_and_net_assets": [
    { "label_as_printed": <string>, "values": [<string or null>, ...] }
  ],
  "creditors_over_one_year_note": {
    "note_is_present": <true or false>,
    "note_number": <string or null>,
    "components": [ { "label_as_printed": <string>, "values": [<string or null>, ...] } ],
    "note_total": [<string or null>, ...]
  },
  "where_deferred_tax_appears": "own_line_on_balance_sheet_face" | "inside_the_creditors_over_one_year_note" | "in_a_note_only" | "not_present_anywhere"
}

Every "values" array must have one entry per entry in column_headings, in the same
order. Use null for a blank cell.
`.trim();

async function transcribe(base64: string, label: string) {
  const res = await geminiClient.generateContent({
    prompt: TRANSCRIBE_PROMPT,
    temperature: 0,
    responseMimeType: 'application/json',
    thinkingLevel: 'MINIMAL',
    inlineData: { mimeType: 'application/pdf', data: base64 },
    service: 'c1_paper_read_cvc',
  });
  console.log(`[C1-CVC] ${label}: ${res.text.length} chars`);
  return res.json ?? null;
}

async function main() {
  const i0: any = (await db.execute<any>(sql`
    SELECT current_database() AS db, (SELECT count(*)::int FROM balance_sheets) AS bs
  `)).rows[0];
  say(`database=${i0.db}  balance_sheets=${i0.bs}   (prod=697, dev=216)`);
  if (i0.bs !== 697) { say('*** NOT PROD. STOP. ***'); return; }
  say('');

  for (const docId of DOC_IDS) {
    const d: any = (await db.execute<any>(sql`
      SELECT id, target_company_id, original_filename, file_path, document_category
      FROM documents WHERE id = ${docId}
    `)).rows[0];
    if (!d) { say(`doc=${docId} NOT FOUND`); continue; }

    const rows = (await db.execute<any>(sql`
      SELECT bs.id AS bs_id, fp.fiscal_year, fp.period_end,
             bs.total_long_term_liabilities::numeric AS total,
             bs.deferred_taxation::numeric           AS deferred,
             COALESCE(bs.bank_loans_long_term::numeric,0)
               + COALESCE(bs.hire_purchase_long_term::numeric,0)
               + COALESCE(bs.other_long_term_debt::numeric,0) AS children
      FROM balance_sheets bs
      JOIN financial_periods fp ON fp.id = bs.financial_period_id
      WHERE bs.source_document_id = ${docId}
        AND bs.total_long_term_liabilities IS NOT NULL
        AND bs.deferred_taxation IS NOT NULL
        AND bs.deferred_taxation::numeric <> 0
      ORDER BY fp.fiscal_year
    `)).rows as any[];

    say('='.repeat(78));
    say(`doc=${docId}  co=${d.target_company_id}  cat=${d.document_category}`);
    say(`file=${d.original_filename}`);

    const buf = await fileStorageService.download(d.file_path);
    const base64 = buf.toString('base64');
    say(`bytes=${buf.length}`);

    const p1 = await transcribe(base64, `doc ${docId} pass 1`);
    const p2 = await transcribe(base64, `doc ${docId} pass 2`);
    const deterministic = figureHash(p1) === figureHash(p2);

    say(`two-pass figure agreement: ${deterministic ? 'IDENTICAL' : 'MISMATCH — verdicts VOID'}`);
    if (p1?.is_marked_not_part_of_statutory_statements) say('WARNING: page footed as NOT part of the statutory statements');
    say(`page=${p1?.balance_sheet_page}  footer=${p1?.page_footer_text ?? '-'}`);
    say(`deferred tax appears: ${p1?.where_deferred_tax_appears}`);
    say(`columns: ${JSON.stringify(p1?.column_headings)}`);
    say(`creditors>1yr printed: ${p1?.creditors_due_after_more_than_one_year?.line_is_printed}  label="${p1?.creditors_due_after_more_than_one_year?.label_as_printed ?? '-'}"  values=${JSON.stringify(p1?.creditors_due_after_more_than_one_year?.values)}`);
    say(`provisions printed:    ${p1?.provisions_for_liabilities?.line_is_printed}  label="${p1?.provisions_for_liabilities?.label_as_printed ?? '-'}"  values=${JSON.stringify(p1?.provisions_for_liabilities?.values)}`);
    say('EVERY LINE BETWEEN TOTAL ASSETS LESS CURRENT LIABILITIES AND NET ASSETS:');
    for (const l of (p1?.all_lines_between_total_assets_less_current_liabilities_and_net_assets ?? [])) {
      say(`   "${l.label_as_printed}"  ${JSON.stringify(l.values)}`);
    }
    say(`creditors note present: ${p1?.creditors_over_one_year_note?.note_is_present}  components=${JSON.stringify(p1?.creditors_over_one_year_note?.components ?? [])}`);
    say('');

    const headings: string[] = p1?.column_headings ?? [];
    const credVals = p1?.creditors_due_after_more_than_one_year?.values ?? [];
    const provVals = p1?.provisions_for_liabilities?.values ?? [];

    for (const r of rows) {
      const total = Number(r.total), deferred = Number(r.deferred), children = Number(r.children);
      const corrected = total - deferred;
      const fy = Number(r.fiscal_year);

      say(`-- bs=${r.bs_id} fy=${fy} pe=${r.period_end}`);
      say(`   stored    total=${f2(total)} deferred=${f2(deferred)} children=${f2(children)} corrected=${f2(corrected)}`);

      const candidates: number[] = [];
      headings.forEach((h, i) => { if (headingYears(h).has(fy)) candidates.push(i); });
      let idx = -1;
      if (candidates.length === 1) idx = candidates[0];
      else if (candidates.length > 1) {
        idx = candidates.find((i) => money(credVals[i]) !== null || money(provVals[i]) !== null) ?? candidates[0];
      }
      if (idx < 0) { say(`   VERDICT   NO COLUMN MATCHED for ${fy} in ${JSON.stringify(headings)}`); say(''); continue; }

      const credRaw = credVals[idx] ?? null, provRaw = provVals[idx] ?? null;
      const talcl = money(p1?.total_assets_less_current_liabilities?.[idx] ?? null);
      const na = money(p1?.net_assets?.[idx] ?? null);
      const cred = money(credRaw), prov = money(provRaw);
      const credAbs = cred === null ? 0 : Math.abs(cred);
      const provAbs = prov === null ? 0 : Math.abs(prov);

      say(`   column    [${idx}] "${headings[idx]}"`);
      say(`   printed   creditors>1yr="${credRaw ?? '-'}" (${f2(cred)})   provisions="${provRaw ?? '-'}" (${f2(prov)})`);

      let reconOk: boolean | null = null;
      if (talcl !== null && na !== null) {
        reconOk = near(Math.abs(talcl) - credAbs - provAbs, na);
        say(`   recon     ${f2(Math.abs(talcl))} - ${f2(credAbs)} - ${f2(provAbs)} = ${f2(Math.abs(talcl) - credAbs - provAbs)}   net assets ${f2(na)}   ${reconOk ? 'OK' : 'FAILS'}`);
      } else {
        say('   recon     NOT POSSIBLE, TALCL or net assets not transcribed');
      }

      let verdict: string;
      if (!deterministic) verdict = 'VOID — two passes disagree on the figures';
      else if (reconOk === false) verdict = 'VOID — transcription does not reconcile';
      else if (near(credAbs, corrected)) verdict = 'CONTRACT 1 HOLDS — printed creditors equals total minus deferred';
      else if (near(credAbs, total)) verdict = '*** CONTRACT 1 FALSIFIED — printed creditors equals the STORED TOTAL ***';
      else if (Math.abs(corrected) < 0.005 && credAbs > 1) verdict = `*** CHILDREN DROPPED — backfill would write 0 over a printed ${f2(credAbs)} ***`;
      else verdict = 'UNRESOLVED — printed creditors matches neither corrected nor total';

      say(`   VERDICT   ${verdict}`);
      say(`             provisions ${near(provAbs, deferred) ? 'match stored deferred' : `${f2(provAbs)} vs stored deferred ${f2(deferred)}`}`);
      say('');
    }
  }

  await fs.writeFile('docs/pipeline-fidelity-fix/c1-paper-read-cvc.txt', out.join('\n'), 'utf8');
  console.log('Report: docs/pipeline-fidelity-fix/c1-paper-read-cvc.txt');
}

main().catch((e) => { console.error(e); process.exit(1); });