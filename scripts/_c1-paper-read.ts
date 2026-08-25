/**
 * scripts/_c1-paper-read.ts
 * CONTRACT 1 — paper verification across seven documents from seven companies.
 *
 * READ-ONLY on the database. No INSERT, UPDATE, DELETE, ALTER. No db:push.
 * R2 download only. Gemini is asked to TRANSCRIBE printed lines, never to
 * classify, compute or infer, and is never given a stored figure.
 * Two passes per document; any disagreement voids the document.
 * Writes exactly one report file under docs/pipeline-fidelity-fix/.
 */
import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import { geminiClient } from '../server/services/gemini-client';
import { fileStorageService } from '../server/services/file-storage.service';
import fs from 'fs/promises';

const DOC_IDS = [534, 1782, 1599, 1424, 711, 697, 383];

const out: string[] = [];
const say = (s = '') => { console.log(s); out.push(s); };
const only = (s = '') => { out.push(s); };
const f2 = (v: number | null) => (v === null ? 'null' : v.toFixed(2));
const near = (a: number, b: number) => Math.abs(a - b) <= Math.max(1, Math.abs(b) * 0.0001);

// Parse a printed money string. Brackets mean negative. Dash or blank means absent.
function money(s: any): number | null {
  if (s === null || s === undefined) return null;
  const t = String(s).trim();
  if (t === '' || t === '-' || t === '—' || t === '–') return null;
  const neg = /^\(.*\)$/.test(t);
  const cleaned = t.replace(/[()£$,\s]/g, '');
  if (cleaned === '') return null;
  const n = parseFloat(cleaned);
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
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

type Pass = any;

function keyNumbers(p: Pass): string {
  if (!p) return 'NULL';
  return JSON.stringify({
    h: p.column_headings,
    t: p.total_assets_less_current_liabilities,
    c: p.creditors_due_after_more_than_one_year?.values,
    v: p.provisions_for_liabilities?.values,
    n: p.net_assets,
  });
}

async function transcribe(base64: string, label: string): Promise<Pass> {
  const res = await geminiClient.generateContent({
    prompt: TRANSCRIBE_PROMPT,
    temperature: 0,
    responseMimeType: 'application/json',
    thinkingLevel: 'MINIMAL',
    inlineData: { mimeType: 'application/pdf', data: base64 },
    service: 'c1_paper_read',
  });
  console.log(`[C1-PAPER] ${label}: ${res.text.length} chars`);
  return res.json ?? null;
}

async function main() {
  const ident = await db.execute<any>(sql`
    SELECT current_database() AS db, (SELECT count(*)::int FROM balance_sheets) AS bs
  `);
  say('=== IDENTITY ===');
  say(`database=${ident.rows[0].db}  balance_sheets=${ident.rows[0].bs}   (prod=697, dev=216)`);
  say('');

  for (const docId of DOC_IDS) {
    const d = (await db.execute<any>(sql`
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
    say(`key=${d.file_path}`);

    const buf = await fileStorageService.download(d.file_path);
    const base64 = buf.toString('base64');
    say(`bytes=${buf.length}`);

    const p1 = await transcribe(base64, `doc ${docId} pass 1`);
    const p2 = await transcribe(base64, `doc ${docId} pass 2`);

    const deterministic = keyNumbers(p1) === keyNumbers(p2);
    say(`two-pass determinism: ${deterministic ? 'IDENTICAL' : 'MISMATCH — verdicts VOID for this document'}`);
    if (p1?.is_marked_not_part_of_statutory_statements) {
      say('WARNING: page is footed as NOT part of the statutory financial statements (D7 shape)');
    }
    say(`page=${p1?.balance_sheet_page}  footer=${p1?.page_footer_text ?? '-'}`);
    say(`deferred tax appears: ${p1?.where_deferred_tax_appears}`);
    say(`columns: ${JSON.stringify(p1?.column_headings)}`);
    say(`creditors>1yr printed: ${p1?.creditors_due_after_more_than_one_year?.line_is_printed}  label="${p1?.creditors_due_after_more_than_one_year?.label_as_printed ?? '-'}"  values=${JSON.stringify(p1?.creditors_due_after_more_than_one_year?.values)}`);
    say(`provisions printed:    ${p1?.provisions_for_liabilities?.line_is_printed}  label="${p1?.provisions_for_liabilities?.label_as_printed ?? '-'}"  values=${JSON.stringify(p1?.provisions_for_liabilities?.values)}`);
    say('');

    const headings: string[] = p1?.column_headings ?? [];

    for (const r of rows) {
      const total = Number(r.total), deferred = Number(r.deferred), children = Number(r.children);
      const corrected = total - deferred;
      const fy = String(r.fiscal_year);

      const idx = headings.findIndex((h) => String(h).includes(fy));
      say(`-- bs=${r.bs_id} fy=${fy} pe=${r.period_end}`);
      say(`   stored    total=${f2(total)} deferred=${f2(deferred)} children=${f2(children)} corrected=${f2(corrected)}`);

      if (idx < 0) { say(`   VERDICT   NO COLUMN MATCHED for ${fy} in ${JSON.stringify(headings)}`); say(''); continue; }

      const credRaw = p1?.creditors_due_after_more_than_one_year?.values?.[idx] ?? null;
      const provRaw = p1?.provisions_for_liabilities?.values?.[idx] ?? null;
      const talclRaw = p1?.total_assets_less_current_liabilities?.[idx] ?? null;
      const naRaw = p1?.net_assets?.[idx] ?? null;

      const cred = money(credRaw), prov = money(provRaw);
      const talcl = money(talclRaw), na = money(naRaw);
      const credAbs = cred === null ? 0 : Math.abs(cred);
      const provAbs = prov === null ? 0 : Math.abs(prov);

      say(`   printed   creditors>1yr="${credRaw ?? '-'}" (${f2(cred)})   provisions="${provRaw ?? '-'}" (${f2(prov)})`);

      let reconOk: boolean | null = null;
      if (talcl !== null && na !== null) {
        reconOk = near(Math.abs(talcl) - credAbs - provAbs, na);
        say(`   recon     TALCL ${f2(Math.abs(talcl))} - ${f2(credAbs)} - ${f2(provAbs)} = ${f2(Math.abs(talcl) - credAbs - provAbs)}   net assets ${f2(na)}   ${reconOk ? 'OK' : 'FAILS'}`);
      } else {
        say('   recon     NOT POSSIBLE, TALCL or net assets not transcribed');
      }

      let verdict: string;
      if (!deterministic) verdict = 'VOID — two passes disagree';
      else if (reconOk === false) verdict = 'VOID — transcription does not reconcile';
      else if (near(credAbs, corrected)) verdict = 'CONTRACT 1 HOLDS — printed creditors equals total minus deferred';
      else if (near(credAbs, total) && deferred !== 0) verdict = '*** CONTRACT 1 FALSIFIED — printed creditors equals the STORED TOTAL, deferred is inside it ***';
      else if (Math.abs(corrected) < 0.005 && credAbs > 1) verdict = `*** CHILDREN DROPPED — backfill would write 0 over a printed ${f2(credAbs)} ***`;
      else verdict = 'UNRESOLVED — printed creditors matches neither corrected nor total';

      const provNote = near(provAbs, deferred) ? 'provisions match stored deferred' : `provisions ${f2(provAbs)} vs stored deferred ${f2(deferred)}`;
      say(`   VERDICT   ${verdict}`);
      say(`             ${provNote}`);
      say('');
    }

    only('--- FULL PASS 1 JSON ---');
    only(JSON.stringify(p1, null, 2));
    only('--- FULL PASS 2 JSON ---');
    only(JSON.stringify(p2, null, 2));
    only('');
  }

  const path = 'docs/pipeline-fidelity-fix/c1-paper-read.txt';
  await fs.writeFile(path, out.join('\n'), 'utf8');
  console.log(`Full report written to ${path}`);
}

main().catch((e) => { console.error(e); process.exit(1); });