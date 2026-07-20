#!/usr/bin/env node
/**
 * Read-only verification: prod ↔ dev clone audit
 * Pairs: 119↔137, 208↔138, 215↔139
 */

const pg = require('pg');
pg.types.setTypeParser(114,  v => v);
pg.types.setTypeParser(3802, v => v);
const { Pool } = pg;

const prod = new Pool({ connectionString: process.env.PROD_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 3 });
const dev  = new Pool({ connectionString: process.env.DATABASE_URL,      ssl: { rejectUnauthorized: false }, max: 3 });

const PAIRS = [
  { prodId: 119, devId: 137, name: 'Adventure Connection' },
  { prodId: 208, devId: 138, name: 'Timber Building Specialists Ltd' },
  { prodId: 215, devId: 139, name: 'Opem Security' },
];

// ─── formatting helpers ───────────────────────────────────────────────────────
function fmt(v) {
  if (v == null) return 'NULL';
  const n = parseFloat(v);
  if (isNaN(n)) return String(v);
  return n.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function match(a, b) {
  if (a == null && b == null) return '  ✓';
  if (a == null || b == null) return '  ✗ DIFF';
  const na = parseFloat(a), nb = parseFloat(b);
  if (!isNaN(na) && !isNaN(nb)) return Math.abs(na - nb) < 0.005 ? '  ✓' : '  ✗ DIFF';
  return String(a) === String(b) ? '  ✓' : '  ✗ DIFF';
}

function strMatch(a, b) {
  return String(a ?? 'NULL') === String(b ?? 'NULL') ? '  ✓' : '  ✗ DIFF';
}

let defects = 0;
function cell(a, b, label) {
  const m = match(a, b);
  if (m.includes('DIFF')) { defects++; return `${m}  ← ${label}: prod=${fmt(a)} dev=${fmt(b)}`; }
  return m;
}

function hdr(title) {
  console.log(`\n  ┌─ ${title}`);
}

// ─── 1. Row counts ────────────────────────────────────────────────────────────
async function rowCounts(pair) {
  const tables = [
    'documents','financial_periods','income_statements',
    'balance_sheets','staff_data','deal_models','deal_model_adjustments',
  ];
  hdr('ROW COUNTS');
  console.log(`  ${'Table'.padEnd(30)} ${'PROD'.padStart(8)} ${'DEV'.padStart(8)}  MATCH?`);
  console.log(`  ${'─'.repeat(60)}`);

  for (const t of tables) {
    let prodN, devN;
    if (t === 'deal_model_adjustments') {
      const pq = await prod.query(
        `SELECT COUNT(*) FROM deal_model_adjustments dma
         JOIN deal_models dm ON dm.id=dma.deal_model_id
         WHERE dm.target_company_id=$1`, [pair.prodId]);
      const dq = await dev.query(
        `SELECT COUNT(*) FROM deal_model_adjustments dma
         JOIN deal_models dm ON dm.id=dma.deal_model_id
         WHERE dm.target_company_id=$1`, [pair.devId]);
      prodN = parseInt(pq.rows[0].count);
      devN  = parseInt(dq.rows[0].count);
    } else {
      const col = t === 'deal_models' ? 'target_company_id' : 'target_company_id';
      const [pq, dq] = await Promise.all([
        prod.query(`SELECT COUNT(*) FROM ${t} WHERE target_company_id=$1`, [pair.prodId]),
        dev.query(`SELECT COUNT(*) FROM ${t} WHERE target_company_id=$1`, [pair.devId]),
      ]);
      prodN = parseInt(pq.rows[0].count);
      devN  = parseInt(dq.rows[0].count);
    }
    const m = prodN === devN ? '  ✓' : `  ✗ DIFF`;
    if (m.includes('DIFF')) defects++;
    console.log(`  ${t.padEnd(30)} ${String(prodN).padStart(8)} ${String(devN).padStart(8)}${m}`);
  }
}

// ─── 2. Per-period raw figures ────────────────────────────────────────────────
async function perPeriodFigures(pair) {
  hdr('PER-PERIOD RAW FIGURES  (keyed on fiscal_year | period_type | is_full_year)');

  const sql = `
    SELECT
      fp.fiscal_year, fp.period_type, fp.is_full_year, fp.months_covered,
      fp.period_start, fp.period_end,
      is_.revenue,
      is_.operating_profit,
      is_.depreciation_amortisation  AS depreciation,
      is_.gross_profit,
      is_.cost_of_sales,
      is_.administrative_expenses,
      is_.profit_before_tax,
      is_.net_profit,
      bs.total_equity,
      bs.total_current_assets,
      bs.total_current_liabilities,
      bs.total_long_term_liabilities,
      bs.cash_at_bank,
      bs.trade_debtors,
      bs.trade_creditors
    FROM financial_periods fp
    LEFT JOIN income_statements is_ ON is_.financial_period_id = fp.id
    LEFT JOIN balance_sheets    bs  ON bs.financial_period_id  = fp.id
    WHERE fp.target_company_id = $1
    ORDER BY fp.fiscal_year, fp.period_type, fp.is_full_year, fp.period_end
  `;

  const [pRows, dRows] = await Promise.all([
    prod.query(sql, [pair.prodId]).then(r => r.rows),
    dev.query(sql,  [pair.devId]).then(r => r.rows),
  ]);

  function key(r) { return `${r.fiscal_year}|${r.period_type}|${r.is_full_year}`; }
  const pMap = new Map(pRows.map(r => [key(r), r]));
  const dMap = new Map(dRows.map(r => [key(r), r]));
  const keys = [...new Set([...pMap.keys(), ...dMap.keys()])].sort();

  const numFields = [
    'revenue','operating_profit','depreciation','gross_profit',
    'cost_of_sales','administrative_expenses','profit_before_tax','net_profit',
    'total_equity','total_current_assets','total_current_liabilities',
    'total_long_term_liabilities','cash_at_bank','trade_debtors','trade_creditors',
  ];

  for (const k of keys) {
    const p = pMap.get(k) || {};
    const d = dMap.get(k) || {};
    console.log(`\n    Period: FY${p.fiscal_year??d.fiscal_year} | ${p.period_type??d.period_type} | full_year=${p.is_full_year??d.is_full_year} | months=${p.months_covered??d.months_covered} | end=${p.period_end??d.period_end}`);
    console.log(`    ${'Field'.padEnd(32)} ${'PROD'.padStart(16)} ${'DEV'.padStart(16)}  MATCH?`);
    console.log(`    ${'─'.repeat(75)}`);
    for (const f of numFields) {
      const m = cell(p[f], d[f], f);
      console.log(`    ${f.padEnd(32)} ${String(fmt(p[f])).padStart(16)} ${String(fmt(d[f])).padStart(16)}${m}`);
    }
  }
}

// ─── 3. fetchReportedEbitdaByYear ─────────────────────────────────────────────
async function reportedEbitdaByYear(pair) {
  hdr('fetchReportedEbitdaByYear  (operating_profit + depreciation, full-year periods only)');

  const sql = `
    SELECT
      fp.fiscal_year,
      fp.period_type,
      fp.is_full_year,
      COALESCE(is_.operating_profit,0) + COALESCE(is_.depreciation_amortisation,0) AS ebitda,
      is_.revenue
    FROM financial_periods fp
    LEFT JOIN income_statements is_ ON is_.financial_period_id = fp.id
    WHERE fp.target_company_id = $1
      AND fp.is_full_year = true
    ORDER BY fp.fiscal_year, fp.period_type
  `;

  const [pRows, dRows] = await Promise.all([
    prod.query(sql, [pair.prodId]).then(r => r.rows),
    dev.query(sql,  [pair.devId]).then(r => r.rows),
  ]);

  function key(r) { return `${r.fiscal_year}|${r.period_type}`; }
  const pMap = new Map(pRows.map(r => [key(r), r]));
  const dMap = new Map(dRows.map(r => [key(r), r]));
  const keys = [...new Set([...pMap.keys(), ...dMap.keys()])].sort();

  console.log(`\n    ${'FY'.padEnd(6)} ${'type'.padEnd(15)} ${'PROD ebitda'.padStart(16)} ${'DEV ebitda'.padStart(16)} ${'PROD rev'.padStart(16)} ${'DEV rev'.padStart(16)}  MATCH?`);
  console.log(`    ${'─'.repeat(95)}`);
  for (const k of keys) {
    const p = pMap.get(k) || {};
    const d = dMap.get(k) || {};
    const me = cell(p.ebitda, d.ebitda, 'ebitda');
    const mr = cell(p.revenue, d.revenue, 'revenue');
    const overall = (me + mr).includes('DIFF') ? '  ✗ DIFF' : '  ✓';
    console.log(
      `    ${String(p.fiscal_year??d.fiscal_year).padEnd(6)} ${String(p.period_type??d.period_type).padEnd(15)} ${String(fmt(p.ebitda)).padStart(16)} ${String(fmt(d.ebitda)).padStart(16)} ${String(fmt(p.revenue)).padStart(16)} ${String(fmt(d.revenue)).padStart(16)}${overall}${me.includes('DIFF')?me:''}${mr.includes('DIFF')?mr:''}`
    );
  }
}

// ─── 4. Deal models + adjustments ────────────────────────────────────────────
async function dealModels(pair) {
  hdr('DEAL MODELS');

  const dmSQL = `SELECT * FROM deal_models WHERE target_company_id=$1 ORDER BY id`;
  const adjSQL = `
    SELECT dma.* FROM deal_model_adjustments dma
    JOIN deal_models dm ON dm.id = dma.deal_model_id
    WHERE dm.target_company_id = $1 ORDER BY dma.deal_model_id, dma.description, dma.category
  `;

  const [pDMs, dDMs, pAdj, dAdj] = await Promise.all([
    prod.query(dmSQL, [pair.prodId]).then(r => r.rows),
    dev.query(dmSQL,  [pair.devId]).then(r => r.rows),
    prod.query(adjSQL, [pair.prodId]).then(r => r.rows),
    dev.query(adjSQL,  [pair.devId]).then(r => r.rows),
  ]);

  if (pDMs.length === 0 && dDMs.length === 0) {
    console.log(`    (no deal models)\n`);
    return;
  }

  // Build a prod-name → dev-name index map (match by name/sort order)
  const prodDmIdx = new Map(pDMs.map((m, i) => [i, m]));
  const devDmIdx  = new Map(dDMs.map((m, i) => [i, m]));
  const dmCount = Math.max(pDMs.length, dDMs.length);

  // Build adj maps keyed by (dm_index, description, category)
  // First we need to map prod dm_id → index and dev dm_id → index
  const prodDmIdToIdx = new Map(pDMs.map((m, i) => [m.id, i]));
  const devDmIdToIdx  = new Map(dDMs.map((m, i) => [m.id, i]));

  function adjKey(dmIdx, r) {
    return `${dmIdx}|||${r.description}|||${r.category}|||${r.adjustment_type}`;
  }
  const pAdjMap = new Map(pAdj.map(r => [adjKey(prodDmIdToIdx.get(r.deal_model_id), r), r]));
  const dAdjMap = new Map(dAdj.map(r => [adjKey(devDmIdToIdx.get(r.deal_model_id), r), r]));
  const adjKeys = [...new Set([...pAdjMap.keys(), ...dAdjMap.keys()])].sort();

  const dmFields = [
    'averaging_years','ebitda_multiple','calculated_ebitda','adjusted_ebitda',
    'enterprise_value','total_purchase_price','equity_required',
    'minus_primary_debt','minus_other_debt','plus_excess_cash',
    'working_capital_months',
  ];

  for (let i = 0; i < dmCount; i++) {
    const p = prodDmIdx.get(i) || {};
    const d = devDmIdx.get(i)  || {};
    console.log(`\n    Deal model [${i}]: "${p.name??'—'}" ↔ "${d.name??'—'}"`);
    console.log(`    ${'Field'.padEnd(35)} ${'PROD'.padStart(18)} ${'DEV'.padStart(18)}  MATCH?`);
    console.log(`    ${'─'.repeat(82)}`);
    for (const f of dmFields) {
      const m = cell(p[f], d[f], f);
      console.log(`    ${f.padEnd(35)} ${String(fmt(p[f])).padStart(18)} ${String(fmt(d[f])).padStart(18)}${m}`);
    }
  }

  // Adjustments
  console.log(`\n    ADJUSTMENTS (keyed on dm_index | description | category | type):`);
  console.log(`    ${'Key'.padEnd(55)} ${'PROD amt'.padStart(14)} ${'DEV amt'.padStart(14)} ${'PROD/yr'.padStart(22)} ${'DEV/yr'.padStart(22)}  MATCH?`);
  console.log(`    ${'─'.repeat(145)}`);
  for (const k of adjKeys) {
    const p = pAdjMap.get(k) || {};
    const d = dAdjMap.get(k) || {};
    const shortKey = k.replace(/\|\|\|/g,'|').slice(0,53);
    const am = cell(p.amount, d.amount, 'amount');
    // amounts_by_year — compare as strings (JSON)
    const pyStr = p.amounts_by_year ?? 'NULL';
    const dyStr = d.amounts_by_year ?? 'NULL';
    const ym = pyStr === dyStr ? '  ✓' : '  ✗ DIFF';
    if (ym.includes('DIFF')) defects++;
    const overall = (am + ym).includes('DIFF') ? '' : '';
    console.log(
      `    ${shortKey.padEnd(55)} ${String(fmt(p.amount)).padStart(14)} ${String(fmt(d.amount)).padStart(14)} ${String(pyStr).padEnd(22).slice(0,22)} ${String(dyStr).padEnd(22).slice(0,22)}${am}${ym.includes('DIFF')?' AMTSBYYEAR:'+ym:''}`
    );
  }
}

// ─── main ─────────────────────────────────────────────────────────────────────
async function main() {
  // Print hosts
  const [pHost, dHost] = await Promise.all([
    prod.query('SELECT current_setting(\'server_version\') AS v, inet_server_addr() AS addr').catch(async () => {
      // inet_server_addr may not be available; fall back to connection string
      const r = await prod.query('SELECT current_database() AS db, version() AS v');
      return { rows: [{ v: r.rows[0].v.slice(0,40), addr: '(see conn string)' }] };
    }),
    dev.query('SELECT current_setting(\'server_version\') AS v, inet_server_addr() AS addr').catch(async () => {
      const r = await dev.query('SELECT current_database() AS db, version() AS v');
      return { rows: [{ v: r.rows[0].v.slice(0,40), addr: '(see conn string)' }] };
    }),
  ]);

  // Extract host from connection strings for clarity
  function extractHost(url) {
    try { return new URL(url).hostname; } catch { return '?'; }
  }
  const prodHost = extractHost(process.env.PROD_DATABASE_URL);
  const devHost  = extractHost(process.env.DATABASE_URL);

  console.log('\n' + '═'.repeat(80));
  console.log('CONNECTION VERIFICATION');
  console.log('═'.repeat(80));
  console.log(`  PROD host: ${prodHost}`);
  console.log(`  DEV  host: ${devHost}`);
  console.log(`  prod is ep-old-recipe? ${prodHost.includes('ep-old-recipe') ? 'YES ✓' : 'NO — ' + prodHost}`);
  console.log(`  dev  is heliumdb?      ${devHost.includes('heliumdb') ? 'YES ✓' : 'NO — ' + devHost}`);

  for (const pair of PAIRS) {
    console.log('\n\n' + '█'.repeat(80));
    console.log(`█  PAIR: prod ${pair.prodId}  ↔  dev ${pair.devId}  —  ${pair.name}`);
    console.log('█'.repeat(80));
    defects = 0;

    await rowCounts(pair);
    await perPeriodFigures(pair);
    await reportedEbitdaByYear(pair);
    await dealModels(pair);

    console.log(`\n  ─── PAIR DEFECT COUNT: ${defects} ───`);
  }

  await prod.end();
  await dev.end();
}

main().catch(err => { console.error(err); process.exit(1); });
