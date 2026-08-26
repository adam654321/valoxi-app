/**
 * scripts/_d3-assess-readonly.ts
 * READ-ONLY ASSESS. D3 / debtors_total schema pass.
 * SELECT statements only. No writes. Not committed.
 *
 * NOTE ON SCHEMA DIVERGENCE FROM THE BRIEF'S SAMPLE QUERIES:
 * balance_sheets has no company_id / fiscal_year / period_end columns.
 * The actual columns are target_company_id and financial_period_id; fiscal_year
 * and period_end live on financial_periods, joined via financial_period_id.
 * financial_contributions DOES carry fiscal_year and target_company_id directly.
 * All queries below use the real column names and this substitution is called
 * out explicitly in the relevant section headers. Nothing has been reconciled
 * or fixed — this is reported only.
 */
import { db } from '../server/db';
import { sql } from 'drizzle-orm';

const say = (s: string = '') => console.log(s);
const j = (v: any) => JSON.stringify(v);

function safeIdent(k: string): string {
  if (!/^[A-Za-z0-9_]+$/.test(k)) throw new Error(`unsafe identifier: ${k}`);
  return k;
}
function safeLiteralKey(k: string): string {
  // permissive but still restricted charset for use inside a quoted SQL string literal
  if (!/^[A-Za-z0-9_.]+$/.test(k)) throw new Error(`unsafe key literal: ${k}`);
  return k;
}

async function main() {
  const isProd = process.env.DATABASE_URL === process.env.PROD_DATABASE_URL;
  const label = isProd ? 'PROD' : 'DEV';
  say('');
  say('##############################################################');
  say(`RUN LABEL: ${label}`);
  say('##############################################################');

  // ── SECTION 0 - IDENTITY ────────────────────────────────────────────────
  say('\n=== SECTION 0 - IDENTITY ===');
  say(`current_database: ${j((await db.execute(sql`SELECT current_database()`)).rows[0])}`);
  say(`balance_sheets_rows: ${j((await db.execute(sql`SELECT count(*) AS balance_sheets_rows FROM balance_sheets`)).rows[0])}`);
  say(`contributions_rows: ${j((await db.execute(sql`SELECT count(*) AS contributions_rows FROM financial_contributions`)).rows[0])}`);

  // ── SECTION 1 - balance_sheets schema as the database has it ───────────
  say('\n=== SECTION 1a - balance_sheets full column list ===');
  const cols = (await db.execute(sql`
    SELECT ordinal_position, column_name, data_type, numeric_precision, numeric_scale,
           is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'balance_sheets'
    ORDER BY ordinal_position
  `)).rows;
  for (const r of cols) say(j(r));

  say('\n=== SECTION 1b - constraints ===');
  const cons = (await db.execute(sql`
    SELECT conname, contype, pg_get_constraintdef(oid) AS def
    FROM pg_constraint WHERE conrelid = 'balance_sheets'::regclass ORDER BY conname
  `)).rows;
  for (const r of cons) say(j(r));

  say('\n=== SECTION 1c - indexes ===');
  const idx = (await db.execute(sql`
    SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'balance_sheets' ORDER BY indexname
  `)).rows;
  for (const r of idx) say(j(r));

  // ── SECTION 2 - debtors fields, db side ─────────────────────────────────
  say('\n=== SECTION 2a - every column mentioning debtors or prepayments ===');
  const debCols = (await db.execute(sql`
    SELECT table_name, column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE column_name ILIKE '%debtor%' OR column_name ILIKE '%prepay%'
    ORDER BY table_name, column_name
  `)).rows;
  for (const r of debCols) say(j(r));

  say('\n=== SECTION 2b - every JSON/JSONB column in the database ===');
  const jsonCols = (await db.execute(sql`
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE data_type IN ('json','jsonb')
    ORDER BY table_name, column_name
  `)).rows;
  for (const r of jsonCols) say(j(r));

  // ── SECTION 3 - population profile, null vs zero ───────────────────────
  say('\n=== SECTION 3a - population proof ===');
  say(j((await db.execute(sql`
    SELECT count(*) AS rows_total, count(trade_debtors) AS trade_debtors_non_null FROM balance_sheets
  `)).rows[0]));

  say('\n=== SECTION 3b - per debtors-related column on balance_sheets ===');
  const bsDebtorCols = debCols
    .filter((r: any) => r.table_name === 'balance_sheets')
    .map((r: any) => r.column_name as string);
  say(`balance_sheets debtors-related columns: ${j(bsDebtorCols)}`);
  const bsColTypes: Record<string, string> = {};
  for (const c of cols as any[]) bsColTypes[c.column_name] = c.data_type;
  for (const col of bsDebtorCols) {
    if (bsColTypes[col] === 'json' || bsColTypes[col] === 'jsonb') {
      say(`column=${col}: SKIPPED (data_type=${bsColTypes[col]}, not a scalar comparable with = 0 / > 0)`);
      continue;
    }
    const safeCol = safeIdent(col);
    const r = (await db.execute(sql.raw(`
      SELECT
        count(*) FILTER (WHERE ${safeCol} IS NULL) AS is_null,
        count(*) FILTER (WHERE ${safeCol} = 0) AS is_zero,
        count(*) FILTER (WHERE ${safeCol} > 0) AS is_positive,
        count(*) FILTER (WHERE ${safeCol} < 0) AS is_negative
      FROM balance_sheets
    `))).rows[0];
    say(`column=${col}: ${j(r)}`);
  }

  say('\n=== SECTION 3c - financial_contributions.figures: key-absent vs key-zero ===');
  say(j((await db.execute(sql`
    SELECT count(*) AS contributions_with_figures FROM financial_contributions WHERE figures IS NOT NULL
  `)).rows[0]));

  const keyInv = (await db.execute(sql`
    SELECT k, count(*) AS n
    FROM financial_contributions, jsonb_each(figures) AS t(k, v)
    WHERE k ILIKE '%debtor%' OR k ILIKE '%prepay%'
    GROUP BY k ORDER BY n DESC
  `)).rows as any[];
  say('key inventory:');
  for (const r of keyInv) say(j(r));

  const keyNames = keyInv.map((r) => r.k as string);
  const primaryKey = keyNames.includes('tradeDebtors') ? 'tradeDebtors' : keyNames[0];
  const secondaryKey = keyNames.includes('otherDebtors')
    ? 'otherDebtors'
    : keyNames.find((k) => k !== primaryKey);
  say(`KEYS USED: primary=${primaryKey ?? 'NONE'} secondary=${secondaryKey ?? 'NONE'}`);

  if (primaryKey && secondaryKey) {
    const pKey = safeLiteralKey(primaryKey);
    const sKey = safeLiteralKey(secondaryKey);
    const r = (await db.execute(sql.raw(`
      SELECT
        count(*) FILTER (WHERE figures ? '${pKey}' AND NOT (figures ? '${sKey}'))          AS ${pKey}_present_${sKey}_key_ABSENT,
        count(*) FILTER (WHERE figures ? '${pKey}' AND figures ? '${sKey}' AND figures->>'${sKey}' IS NULL) AS ${sKey}_key_present_value_NULL,
        count(*) FILTER (WHERE figures->>'${sKey}' IN ('0','0.00','0.0'))                    AS ${sKey}_value_ZERO,
        count(*) FILTER (WHERE (figures->>'${sKey}') ~ '^-?[0-9.]+$' AND (figures->>'${sKey}')::numeric > 0) AS ${sKey}_value_POSITIVE
      FROM financial_contributions
      WHERE figures ? '${pKey}'
    `))).rows[0];
    say(j(r));
  } else {
    say('Could not determine both a primary and secondary debtors key from the inventory; paired query skipped.');
  }

  say('\n=== SECTION 3d - evidence layer, same three-way split ===');
  const evTables = (await db.execute(sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_name ILIKE '%evidence%' ORDER BY table_name
  `)).rows as any[];
  say(`evidence tables: ${j(evTables)}`);

  say('--- columns: document_evidence_figure (the per-figure evidence table) ---');
  const defCols = (await db.execute(sql`
    SELECT column_name, data_type, is_nullable FROM information_schema.columns
    WHERE table_name = 'document_evidence_figure' ORDER BY ordinal_position
  `)).rows;
  for (const r of defCols) say(j(r));

  say('--- columns: document_evidence_period (the period anchor the figures hang off) ---');
  const depCols = (await db.execute(sql`
    SELECT column_name, data_type, is_nullable FROM information_schema.columns
    WHERE table_name = 'document_evidence_period' ORDER BY ordinal_position
  `)).rows;
  for (const r of depCols) say(j(r));

  say('--- field_key inventory on document_evidence_figure matching debtor/prepay ---');
  const fkInv = (await db.execute(sql`
    SELECT field_key, count(*) AS n FROM document_evidence_figure
    WHERE field_key ILIKE '%debtor%' OR field_key ILIKE '%prepay%'
    GROUP BY field_key ORDER BY n DESC
  `)).rows as any[];
  for (const r of fkInv) say(j(r));

  const totalPeriods = (await db.execute(sql`SELECT count(*) AS n FROM document_evidence_period`)).rows[0];
  say(`total document_evidence_period rows: ${j(totalPeriods)}`);

  for (const r of fkInv) {
    const fk = safeLiteralKey(r.field_key as string);
    const split = (await db.execute(sql.raw(`
      SELECT
        (SELECT count(*) FROM document_evidence_period p
           WHERE NOT EXISTS (SELECT 1 FROM document_evidence_figure f
                              WHERE f.document_evidence_period_id = p.id AND f.field_key = '${fk}')) AS key_absent,
        (SELECT count(*) FROM document_evidence_figure WHERE field_key = '${fk}' AND value IS NULL) AS value_null,
        (SELECT count(*) FROM document_evidence_figure WHERE field_key = '${fk}' AND value = 0)      AS value_zero,
        (SELECT count(*) FROM document_evidence_figure WHERE field_key = '${fk}' AND value > 0)      AS value_positive,
        (SELECT count(*) FROM document_evidence_figure WHERE field_key = '${fk}' AND value < 0)      AS value_negative
    `))).rows[0];
    say(`field_key=${r.field_key}: ${j(split)}`);
  }

  // ── SECTION 4 - PROD ONLY, companies 245/251 ─────────────────────────────
  if (isProd) {
    say('\n=== SECTION 4a - balance_sheets for companies 245,251 ===');
    say('NOTE: brief used company_id / fiscal_year / period_end; actual columns are');
    say('target_company_id (no fiscal_year/period_end on balance_sheets directly —');
    say('joined via financial_period_id -> financial_periods).');
    const s4a = (await db.execute(sql`
      SELECT bs.id, bs.target_company_id AS company_id, fp.fiscal_year, fp.period_end,
             bs.source_document_id, bs.trade_debtors, bs.updated_at
      FROM balance_sheets bs
      LEFT JOIN financial_periods fp ON fp.id = bs.financial_period_id
      WHERE bs.target_company_id IN (245, 251)
      ORDER BY bs.target_company_id, fp.fiscal_year
    `)).rows;
    for (const r of s4a) say(j(r));

    say('\n=== SECTION 4b - every contribution behind those company-years ===');
    const s4b = (await db.execute(sql`
      SELECT id, target_company_id AS company_id, fiscal_year, source_document_id,
             figures->>'tradeDebtors' AS trade_debtors,
             figures->>'otherDebtors' AS other_debtors,
             (figures ? 'otherDebtors') AS other_key_present
      FROM financial_contributions
      WHERE target_company_id IN (245, 251)
      ORDER BY target_company_id, fiscal_year, source_document_id
    `)).rows as any[];
    for (const r of s4b) say(j(r));

    say('\n=== SECTION 4c - source documents behind those rows (filename + category) ===');
    const docIds = Array.from(new Set([
      ...s4a.map((r: any) => r.source_document_id),
      ...s4b.map((r: any) => r.source_document_id),
    ].filter((x) => x != null)));
    say(`document ids referenced: ${j(docIds)}`);
    if (docIds.length) {
      const s4c = (await db.execute(sql`
        SELECT id, original_filename AS filename, document_category
        FROM documents WHERE id = ANY(${docIds as number[]}) ORDER BY id
      `)).rows;
      for (const r of s4c) say(j(r));
    } else {
      say('No source document ids found.');
    }
  } else {
    say('\n=== SECTION 4 - skipped (PROD ONLY per brief) ===');
  }

  // ── SECTION 6 - retrospective feasibility ────────────────────────────────
  say('\n=== SECTION 6a - does the ORIGINAL per-document extraction payload survive? ===');
  say('Candidate JSONB/JSON columns considered (from 2b), restricted to ones plausibly');
  say('holding a raw per-document model payload rather than a mapped subset:');
  const candidates: Array<{ table: string; column: string; docIdCol: string | null }> = [
    { table: 'document_analysis_results', column: 'analysis_data', docIdCol: 'document_id' },
    { table: 'expert_analysis_results', column: 'analysis_data', docIdCol: null },
    { table: 'stage1_analysis_events', column: 'concatenated_data', docIdCol: null },
    { table: 'stage1_analysis_events', column: 'detailed_analysis_data', docIdCol: null },
    { table: 'financial_contributions', column: 'figures', docIdCol: 'source_document_id' },
  ];
  for (const c of candidates) say(`  candidate: ${c.table}.${c.column}`);

  if (isProd) {
    for (const c of candidates) {
      const t = safeIdent(c.table);
      const col = safeIdent(c.column);
      try {
        if (c.docIdCol) {
          const dcol = safeIdent(c.docIdCol);
          const row1898 = (await db.execute(sql.raw(
            `SELECT * FROM ${t} WHERE ${dcol} = 1898 ORDER BY id LIMIT 1`
          ))).rows[0];
          say(`--- ${t}.${col} WHERE ${dcol}=1898 ---`);
          say(row1898 ? j(row1898) : '(no row found for document 1898 in this table)');
          if (row1898) {
            const text = JSON.stringify(row1898);
            const hasDebtor = /debtor/i.test(text);
            say(`  contains "debtor" (case-insensitive): ${hasDebtor}`);
          }
        } else {
          say(`--- ${t}.${col} — no direct document-id column; skipping doc-1898 lookup, population only ---`);
        }
      } catch (e: any) {
        say(`  error inspecting ${t}.${col}: ${e.message}`);
      }
    }

    say('--- whichever document backs company 251 FY2026 ---');
    const backing = (await db.execute(sql`
      SELECT id, target_company_id, fiscal_year, source_document_id
      FROM financial_contributions
      WHERE target_company_id = 251 AND fiscal_year = 2026
      ORDER BY id
    `)).rows as any[];
    say(j(backing));
    const backingDocIds = Array.from(new Set(backing.map((r) => r.source_document_id).filter((x) => x != null)));
    for (const docId of backingDocIds) {
      const row = (await db.execute(sql`
        SELECT * FROM document_analysis_results WHERE document_id = ${docId} ORDER BY id LIMIT 1
      `)).rows[0];
      say(`--- document_analysis_results WHERE document_id=${docId} (backs company 251 FY2026) ---`);
      say(row ? j(row) : '(no row found)');
      if (row) {
        const hasDebtor = /debtor/i.test(JSON.stringify(row));
        say(`  contains "debtor" (case-insensitive): ${hasDebtor}`);
      }
    }
  } else {
    say('(doc-1898 / company-251-FY2026 row inspection is PROD only per brief; skipped on DEV)');
  }

  say('\n=== SECTION 6b - population proof per candidate table ===');
  for (const c of candidates) {
    const t = safeIdent(c.table);
    const col = safeIdent(c.column);
    const r = (await db.execute(sql.raw(
      `SELECT count(*) AS rows_total, count(${col}) AS rows_with_payload FROM ${t}`
    ))).rows[0];
    say(`${t}.${col}: ${j(r)}`);
  }

  say('\n=== SECTION 6c - verdict (this run, ' + label + ') ===');
  say('See SECTION 6a for the doc-1898 / company-251-FY2026 row content and the');
  say('per-row "contains debtor" check; state RAW PAYLOAD RETAINED: YES/NO from that,');
  say('not from this line — this script does not assert a verdict without inspecting');
  say('actual row content.');

  say(`\n=== END OF RUN: ${label} ===`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
