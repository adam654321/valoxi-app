#!/usr/bin/env node
/**
 * Phase 1 – COPY + MATCH
 * Clones prod target companies 119, 208, 215 (one at a time) into dev.
 * Remaps all IDs; preserves every period→statement, deal→adjustment,
 * and source_document link exactly.
 * Does NOT reselect and does NOT backfill financial_contributions.
 *
 * Usage: node scripts/clone-prod-to-dev.js [119|208|215]
 */

const { Pool } = require('pg');
const crypto = require('crypto');

const PROD_IDS = [119, 208, 215];
const DEV_USER_ID = 1;          // adam@shiftopsconsulting.com
const DEV_USER_COMPANY_ID = 5;  // Valoxi.ai

const prod = new Pool({ connectionString: process.env.PROD_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 3 });
const dev  = new Pool({ connectionString: process.env.DATABASE_URL,      ssl: { rejectUnauthorized: false }, max: 3 });

// ─── helpers ──────────────────────────────────────────────────────────────────
function remap(val, map) {
  if (val == null) return null;
  const r = map.get(val);
  if (r === undefined) throw new Error(`ID ${val} not found in remap map`);
  return r;
}

function remapSoft(val, map) {
  if (val == null) return null;
  return map.get(val) ?? null;
}

async function insertOne(client, table, row) {
  const cols = Object.keys(row);
  const vals = cols.map((_, i) => `$${i + 1}`);
  const res = await client.query(
    `INSERT INTO ${table} (${cols.join(',')}) VALUES (${vals.join(',')}) RETURNING id`,
    cols.map(c => row[c])
  );
  return res.rows[0].id;
}

function omit(obj, ...keys) {
  const out = { ...obj };
  keys.forEach(k => delete out[k]);
  return out;
}

// ─── clone one target company ─────────────────────────────────────────────────
async function cloneCompany(prodId) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`CLONING prod target_company ${prodId}`);
  console.log('='.repeat(70));

  const devClient = await dev.connect();
  try {
    await devClient.query('BEGIN');

    // ── 1. target_company ────────────────────────────────────────────────────
    const { rows: [src] } = await prod.query(
      'SELECT * FROM target_companies WHERE id = $1', [prodId]
    );
    if (!src) throw new Error(`Prod target_company ${prodId} not found`);

    const tcRow = {
      user_company_id:              DEV_USER_COMPANY_ID,
      company_name:                 `[DEV CLONE] ${src.company_name}`,
      industry:                     src.industry,
      sub_sector:                   src.sub_sector,
      website:                      src.website,
      phone:                        src.phone,
      email:                        src.email,
      address:                      src.address,
      annual_revenue:               src.annual_revenue,
      employee_count:               src.employee_count,
      year_established:             src.year_established,
      description:                  src.description,
      stage:                        src.stage,
      is_archived:                  false,
      created_by:                   DEV_USER_ID,
    };
    const devTcId = await insertOne(devClient, 'target_companies', tcRow);
    console.log(`  ✓ target_company  prod=${prodId}  dev=${devTcId}  (${src.company_name})`);

    // ── 2. documents ─────────────────────────────────────────────────────────
    const { rows: prodDocs } = await prod.query(
      'SELECT * FROM documents WHERE target_company_id = $1 ORDER BY id', [prodId]
    );
    const docMap = new Map(); // prod_doc_id → dev_doc_id
    for (const d of prodDocs) {
      const docRow = {
        target_company_id:   devTcId,
        uploaded_by:         DEV_USER_ID,
        document_name:       d.document_name,
        original_filename:   d.original_filename,
        file_path:           d.file_path,
        file_size:           d.file_size,
        file_type:           d.file_type,
        document_category:   d.document_category,
        secondary_category:  d.secondary_category,
        description:         d.description,
        is_confidential:     d.is_confidential,
        public_token:        crypto.randomBytes(32).toString('hex'),
      };
      const devDocId = await insertOne(devClient, 'documents', docRow);
      docMap.set(d.id, devDocId);
    }
    console.log(`  ✓ documents       ${prodDocs.length} rows`);

    // ── 3. financial_periods ─────────────────────────────────────────────────
    const { rows: prodPeriods } = await prod.query(
      'SELECT * FROM financial_periods WHERE target_company_id = $1 ORDER BY id', [prodId]
    );
    const periodMap = new Map(); // prod_period_id → dev_period_id
    for (const p of prodPeriods) {
      const pRow = {
        target_company_id:  devTcId,
        period_type:        p.period_type,
        period_start:       p.period_start,
        period_end:         p.period_end,
        fiscal_year:        p.fiscal_year,
        period_label:       p.period_label,
        months_covered:     p.months_covered,
        is_full_year:       p.is_full_year,
        source_tier:        p.source_tier,
        source_document_id: remapSoft(p.source_document_id, docMap),
      };
      const devPId = await insertOne(devClient, 'financial_periods', pRow);
      periodMap.set(p.id, devPId);
    }
    console.log(`  ✓ financial_periods ${prodPeriods.length} rows`);

    // ── 4. income_statements ─────────────────────────────────────────────────
    const { rows: prodIS } = await prod.query(
      'SELECT * FROM income_statements WHERE target_company_id = $1 ORDER BY id', [prodId]
    );
    for (const r of prodIS) {
      const row = {
        financial_period_id:      remap(r.financial_period_id, periodMap),
        target_company_id:        devTcId,
        revenue:                  r.revenue,
        cost_of_sales:            r.cost_of_sales,
        gross_profit:             r.gross_profit,
        administrative_expenses:  r.administrative_expenses,
        depreciation_amortisation:r.depreciation_amortisation,
        other_operating_income:   r.other_operating_income,
        operating_profit:         r.operating_profit,
        interest_receivable:      r.interest_receivable,
        interest_payable:         r.interest_payable,
        profit_before_tax:        r.profit_before_tax,
        corporation_tax:          r.corporation_tax,
        net_profit:               r.net_profit,
        staff_costs:              r.staff_costs,
        directors_remuneration:   r.directors_remuneration,
        dividends_paid:           r.dividends_paid,
        revenue_breakdown:        r.revenue_breakdown,
        cost_of_sales_breakdown:  r.cost_of_sales_breakdown,
        overheads_breakdown:      r.overheads_breakdown,
        exceptional_items:        r.exceptional_items,
        source_document_id:       remapSoft(r.source_document_id, docMap),
      };
      await insertOne(devClient, 'income_statements', row);
    }
    console.log(`  ✓ income_statements ${prodIS.length} rows`);

    // ── 5. balance_sheets ────────────────────────────────────────────────────
    const { rows: prodBS } = await prod.query(
      'SELECT * FROM balance_sheets WHERE target_company_id = $1 ORDER BY id', [prodId]
    );
    for (const r of prodBS) {
      const row = {
        financial_period_id:               remap(r.financial_period_id, periodMap),
        target_company_id:                 devTcId,
        intangible_assets:                 r.intangible_assets,
        tangible_fixed_assets:             r.tangible_fixed_assets,
        freehold_property:                 r.freehold_property,
        leasehold_property:                r.leasehold_property,
        plant_machinery:                   r.plant_machinery,
        fixtures_fittings:                 r.fixtures_fittings,
        motor_vehicles:                    r.motor_vehicles,
        computer_equipment:                r.computer_equipment,
        stock_inventory:                   r.stock_inventory,
        trade_debtors:                     r.trade_debtors,
        prepayments:                       r.prepayments,
        amounts_owed_by_directors:         r.amounts_owed_by_directors,
        amounts_owed_by_connected_companies: r.amounts_owed_by_connected_companies,
        directors_current_account:         r.directors_current_account,
        other_debtors:                     r.other_debtors,
        cash_at_bank:                      r.cash_at_bank,
        total_current_assets:              r.total_current_assets,
        trade_creditors:                   r.trade_creditors,
        taxation_social_security:          r.taxation_social_security,
        vat_payable:                       r.vat_payable,
        corporation_tax_due:               r.corporation_tax_due,
        bank_loans_overdraft_current:      r.bank_loans_overdraft_current,
        hire_purchase_current:             r.hire_purchase_current,
        accruals:                          r.accruals,
        amounts_owed_to_directors:         r.amounts_owed_to_directors,
        other_creditors:                   r.other_creditors,
        total_current_liabilities:         r.total_current_liabilities,
        bank_loans_long_term:              r.bank_loans_long_term,
        hire_purchase_long_term:           r.hire_purchase_long_term,
        deferred_taxation:                 r.deferred_taxation,
        other_long_term_debt:              r.other_long_term_debt,
        total_long_term_liabilities:       r.total_long_term_liabilities,
        share_capital:                     r.share_capital,
        retained_earnings:                 r.retained_earnings,
        total_equity:                      r.total_equity,
        debtors_list:                      r.debtors_list,
        creditors_list:                    r.creditors_list,
        fixed_assets_detail:               r.fixed_assets_detail,
        source_document_id:                remapSoft(r.source_document_id, docMap),
      };
      await insertOne(devClient, 'balance_sheets', row);
    }
    console.log(`  ✓ balance_sheets   ${prodBS.length} rows`);

    // ── 6. staff_data ────────────────────────────────────────────────────────
    const { rows: prodSD } = await prod.query(
      'SELECT * FROM staff_data WHERE target_company_id = $1 ORDER BY id', [prodId]
    );
    for (const r of prodSD) {
      const row = {
        financial_period_id:      remap(r.financial_period_id, periodMap),
        target_company_id:        devTcId,
        total_headcount:          r.total_headcount,
        total_staff_costs:        r.total_staff_costs,
        total_gross_salaries:     r.total_gross_salaries,
        total_employer_ni:        r.total_employer_ni,
        total_employer_pension:   r.total_employer_pension,
        director_count:           r.director_count,
        director_remuneration:    r.director_remuneration,
        working_director_count:   r.working_director_count,
        non_working_director_count: r.non_working_director_count,
        employee_count:           r.employee_count,
        employee_costs:           r.employee_costs,
        staff_records:            r.staff_records,
        source_document_id:       remapSoft(r.source_document_id, docMap),
      };
      await insertOne(devClient, 'staff_data', row);
    }
    console.log(`  ✓ staff_data       ${prodSD.length} rows`);

    // ── 7. ebitda_adjustments (period-level) ─────────────────────────────────
    const { rows: prodEA } = await prod.query(
      'SELECT * FROM ebitda_adjustments WHERE target_company_id = $1 ORDER BY id', [prodId]
    );
    for (const r of prodEA) {
      const row = {
        financial_period_id: remap(r.financial_period_id, periodMap),
        target_company_id:   devTcId,
        description:         r.description,
        amount:              r.amount,
        category:            r.category,
        notes:               r.notes,
        created_by:          DEV_USER_ID,
      };
      await insertOne(devClient, 'ebitda_adjustments', row);
    }
    console.log(`  ✓ ebitda_adjustments ${prodEA.length} rows`);

    // ── 8. valuations ────────────────────────────────────────────────────────
    const { rows: prodVals } = await prod.query(
      'SELECT * FROM valuations WHERE target_company_id = $1 ORDER BY id', [prodId]
    );
    const valMap = new Map();
    for (const r of prodVals) {
      const row = {
        target_company_id:    devTcId,
        calculation_method:   r.calculation_method,
        valuation_multiple:   r.valuation_multiple,
        adjusted_ebitda:      r.adjusted_ebitda,
        enterprise_value:     r.enterprise_value,
        net_debt:             r.net_debt,
        equity_value:         r.equity_value,
        funding_structure:    r.funding_structure,
        deal_notes:           r.deal_notes,
        created_by:           DEV_USER_ID,
      };
      const devValId = await insertOne(devClient, 'valuations', row);
      valMap.set(r.id, devValId);
    }
    console.log(`  ✓ valuations       ${prodVals.length} rows`);

    // ── 9. deal_models ───────────────────────────────────────────────────────
    const { rows: prodDMs } = await prod.query(
      'SELECT * FROM deal_models WHERE target_company_id = $1 ORDER BY id', [prodId]
    );
    const dmMap = new Map(); // prod_dm_id → dev_dm_id
    for (const r of prodDMs) {
      const row = {
        target_company_id:           devTcId,
        created_by:                  DEV_USER_ID,
        name:                        r.name,
        status:                      r.status,
        version:                     r.version,
        transaction_type:            r.transaction_type,
        parent_model_id:             null, // don't try to remap cross-model
        is_locked:                   r.is_locked,
        averaging_years:             r.averaging_years,
        ebitda_multiple:             r.ebitda_multiple,
        multiple_low:                r.multiple_low,
        multiple_high:               r.multiple_high,
        property_value:              r.property_value,
        cash_value:                  r.cash_value,
        other_assets:                r.other_assets,
        calculated_ebitda:           r.calculated_ebitda,
        adjusted_ebitda:             r.adjusted_ebitda,
        enterprise_value:            r.enterprise_value,
        plus_excess_cash:            r.plus_excess_cash,
        minus_primary_debt:          r.minus_primary_debt,
        minus_other_debt:            r.minus_other_debt,
        minus_corp_tax_due:          r.minus_corp_tax_due,
        minus_working_capital_adj:   r.minus_working_capital_adj,
        working_capital_months:      r.working_capital_months,
        working_capital_monthly_amount: r.working_capital_monthly_amount,
        total_purchase_price:        r.total_purchase_price,
        total_funding_available:     r.total_funding_available,
        equity_required:             r.equity_required,
        upfront_cash:                r.upfront_cash,
        deferred_amount:             r.deferred_amount,
        deferred_terms:              r.deferred_terms,
        earnout_maximum:             r.earnout_maximum,
        earnout_metric:              r.earnout_metric,
        earnout_period_months:       r.earnout_period_months,
        retention_escrow:            r.retention_escrow,
        fee_legal_dd_amount:         r.fee_legal_dd_amount,
        fee_accounting_dd_amount:    r.fee_accounting_dd_amount,
        fee_loan_arrangement_amount: r.fee_loan_arrangement_amount,
        fee_deal_maker_amount:       r.fee_deal_maker_amount,
        custom_fees:                 r.custom_fees,
        expert_data_snapshot:        r.expert_data_snapshot,
        financial_data_snapshot:     r.financial_data_snapshot,
        notes:                       r.notes,
      };
      const devDmId = await insertOne(devClient, 'deal_models', row);
      dmMap.set(r.id, devDmId);
    }
    console.log(`  ✓ deal_models      ${prodDMs.length} rows`);

    // ── 10. deal_model_adjustments ───────────────────────────────────────────
    const { rows: prodDMA } = await prod.query(
      `SELECT dma.* FROM deal_model_adjustments dma
       JOIN deal_models dm ON dm.id = dma.deal_model_id
       WHERE dm.target_company_id = $1 ORDER BY dma.id`, [prodId]
    );
    for (const r of prodDMA) {
      const row = {
        deal_model_id:           remap(r.deal_model_id, dmMap),
        source_expert_result_id: null, // expert_analysis_results not cloned
        adjustment_type:         r.adjustment_type,
        category:                r.category,
        description:             r.description,
        amount:                  r.amount,
        amounts_by_year:         r.amounts_by_year,
        source_expert:           r.source_expert,
        reasoning:               r.reasoning,
        confidence:              r.confidence,
        defensibility_score:     r.defensibility_score,
        case_for_inclusion:      r.case_for_inclusion,
        case_for_exclusion:      r.case_for_exclusion,
        status:                  r.status,
        is_accepted:             r.is_accepted,
        is_manual:               r.is_manual,
        sort_order:              r.sort_order,
      };
      await insertOne(devClient, 'deal_model_adjustments', row);
    }
    console.log(`  ✓ deal_model_adjustments ${prodDMA.length} rows`);

    // ── 11. deal_model_funding_lines ─────────────────────────────────────────
    const { rows: prodFLs } = await prod.query(
      `SELECT fl.* FROM deal_model_funding_lines fl
       JOIN deal_models dm ON dm.id = fl.deal_model_id
       WHERE dm.target_company_id = $1 ORDER BY fl.id`, [prodId]
    );
    for (const r of prodFLs) {
      const row = {
        deal_model_id:         remap(r.deal_model_id, dmMap),
        funding_type:          r.funding_type,
        label:                 r.label,
        asset_base_value:      r.asset_base_value,
        ltv_percent:           r.ltv_percent,
        available_amount:      r.available_amount,
        amount_used:           r.amount_used,
        interest_rate:         r.interest_rate,
        arrangement_fee_percent: r.arrangement_fee_percent,
        term_months:           r.term_months,
        monthly_repayment:     r.monthly_repayment,
        is_debt:               r.is_debt,
        repayment_structure:   r.repayment_structure,
        is_active:             r.is_active,
        notes:                 r.notes,
        sort_order:            r.sort_order,
      };
      await insertOne(devClient, 'deal_model_funding_lines', row);
    }
    console.log(`  ✓ deal_model_funding_lines ${prodFLs.length} rows`);

    // ── 12. deal_model_seller_payments ───────────────────────────────────────
    const { rows: prodSPs } = await prod.query(
      `SELECT sp.* FROM deal_model_seller_payments sp
       JOIN deal_models dm ON dm.id = sp.deal_model_id
       WHERE dm.target_company_id = $1 ORDER BY sp.id`, [prodId]
    ).catch(() => ({ rows: [] }));
    for (const r of prodSPs) {
      const row = {
        deal_model_id:    remap(r.deal_model_id, dmMap),
        payment_type:     r.payment_type,
        amount:           r.amount,
        term_months:      r.term_months,
        interest_rate:    r.interest_rate,
        label:            r.label,
        include_in_dscr:  r.include_in_dscr,
        is_active:        r.is_active,
        sort_order:       r.sort_order,
      };
      await insertOne(devClient, 'deal_model_seller_payments', row);
    }
    console.log(`  ✓ deal_model_seller_payments ${prodSPs.length} rows`);

    // ── 13. deal_model_contingent_consideration ──────────────────────────────
    const { rows: prodCCs } = await prod.query(
      `SELECT cc.* FROM deal_model_contingent_consideration cc
       JOIN deal_models dm ON dm.id = cc.deal_model_id
       WHERE dm.target_company_id = $1 ORDER BY cc.id`, [prodId]
    ).catch(() => ({ rows: [] }));
    for (const r of prodCCs) {
      const row = {
        deal_model_id:       remap(r.deal_model_id, dmMap),
        consideration_type:  r.consideration_type,
        maximum_amount:      r.maximum_amount,
        term_months:         r.term_months,
        trigger_description: r.trigger_description,
        include_in_dscr:     r.include_in_dscr,
        is_active:           r.is_active,
        sort_order:          r.sort_order,
      };
      await insertOne(devClient, 'deal_model_contingent_consideration', row);
    }
    console.log(`  ✓ deal_model_contingent_consideration ${prodCCs.length} rows`);

    // ── 14. financial_contributions ──────────────────────────────────────────
    const { rows: prodFCs } = await prod.query(
      'SELECT * FROM financial_contributions WHERE target_company_id = $1 ORDER BY id', [prodId]
    );
    for (const r of prodFCs) {
      const row = {
        target_company_id:  devTcId,
        fiscal_year:        r.fiscal_year,
        statement_type:     r.statement_type,
        source_document_id: remapSoft(r.source_document_id, docMap),
        source_tier:        r.source_tier,
        is_full_year:       r.is_full_year,
        is_primary_year:    r.is_primary_year,
        months_covered:     r.months_covered,
        period_end:         r.period_end,
        as_at_date:         r.as_at_date,
        figures:            r.figures,
      };
      await insertOne(devClient, 'financial_contributions', row);
    }
    console.log(`  ✓ financial_contributions ${prodFCs.length} rows`);

    await devClient.query('COMMIT');
    console.log(`\n  ✅ COMMITTED — dev target_company id = ${devTcId}`);
    return { prodId, devTcId, company_name: src.company_name };

  } catch (err) {
    await devClient.query('ROLLBACK');
    console.error(`  ❌ ROLLED BACK: ${err.message}`);
    throw err;
  } finally {
    devClient.release();
  }
}

// ─── comparison report ────────────────────────────────────────────────────────
async function compareCompany(prodId, devTcId, name) {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`COMPARISON  ${name}  (prod=${prodId}  dev=${devTcId})`);
  console.log('─'.repeat(70));

  // fiscal year summary from income + balance statements
  const summarySQL = `
    SELECT
      fp.fiscal_year,
      fp.period_type,
      fp.is_full_year,
      fp.months_covered,
      COUNT(*) OVER (PARTITION BY fp.fiscal_year) AS period_count,
      is_.revenue,
      is_.operating_profit,
      is_.depreciation_amortisation,
      COALESCE(is_.operating_profit,0) + COALESCE(is_.depreciation_amortisation,0) AS reported_ebitda,
      bs.total_equity                          AS net_assets
    FROM financial_periods fp
    LEFT JOIN income_statements is_ ON is_.financial_period_id = fp.id
    LEFT JOIN balance_sheets    bs  ON bs.financial_period_id  = fp.id
    WHERE fp.target_company_id = $1
    ORDER BY fp.fiscal_year, fp.period_end
  `;

  const [prodR, devR] = await Promise.all([
    prod.query(summarySQL, [prodId]),
    dev.query(summarySQL, [devTcId]),
  ]);

  // deal model summary
  const dmSQL = `
    SELECT name, status, adjusted_ebitda, enterprise_value, total_purchase_price
    FROM deal_models WHERE target_company_id = $1 ORDER BY id
  `;
  const [prodDM, devDM] = await Promise.all([
    prod.query(dmSQL, [prodId]),
    dev.query(dmSQL, [devTcId]),
  ]);

  function fmt(v) { return v == null ? 'NULL' : parseFloat(v).toLocaleString('en-GB', { maximumFractionDigits: 0 }); }

  // Build per-fiscal-year summary keyed by (fy, period_type)
  function buildMap(rows) {
    const m = new Map();
    for (const r of rows) {
      const key = `${r.fiscal_year}|${r.period_type}|${r.is_full_year}`;
      m.set(key, r);
    }
    return m;
  }

  const prodMap = buildMap(prodR.rows);
  const devMap  = buildMap(devR.rows);
  const allKeys = [...new Set([...prodMap.keys(), ...devMap.keys()])].sort();

  let allMatch = true;
  const rows = [];

  for (const key of allKeys) {
    const p = prodMap.get(key) || {};
    const d = devMap.get(key)  || {};

    const fields = ['revenue', 'reported_ebitda', 'net_assets'];
    for (const f of fields) {
      const pv = p[f] == null ? null : parseFloat(p[f]);
      const dv = d[f] == null ? null : parseFloat(d[f]);
      const match = pv === dv || (pv == null && dv == null) ||
                    (pv != null && dv != null && Math.abs(pv - dv) < 0.01);
      if (!match) allMatch = false;
      rows.push({
        fiscal_year: p.fiscal_year ?? d.fiscal_year,
        period_type: p.period_type ?? d.period_type,
        field:       f,
        prod:        fmt(p[f]),
        dev:         fmt(d[f]),
        match:       match ? '✓' : '✗ MISMATCH',
      });
    }
    // period count
    const pc_p = p.period_count ?? 0;
    const pc_d = d.period_count ?? 0;
    const countMatch = pc_p == pc_d;
    if (!countMatch) allMatch = false;
    rows.push({
      fiscal_year: p.fiscal_year ?? d.fiscal_year,
      period_type: p.period_type ?? d.period_type,
      field:       'period_count',
      prod:        pc_p,
      dev:         pc_d,
      match:       countMatch ? '✓' : '✗ MISMATCH',
    });
  }

  // Print table
  console.log('\nFinancial periods comparison:');
  console.log('  FY    | type              | field            | prod           | dev            | match');
  console.log('  ------|-------------------|------------------|----------------|----------------|------');
  for (const r of rows) {
    console.log(
      `  ${String(r.fiscal_year ?? '?').padEnd(5)} | ${String(r.period_type).padEnd(17)} | ${r.field.padEnd(16)} | ${String(r.prod).padStart(14)} | ${String(r.dev).padStart(14)} | ${r.match}`
    );
  }

  // Deal model comparison
  console.log('\nDeal models comparison:');
  if (prodDM.rows.length === 0 && devDM.rows.length === 0) {
    console.log('  (none)');
  } else {
    for (let i = 0; i < Math.max(prodDM.rows.length, devDM.rows.length); i++) {
      const p = prodDM.rows[i] || {};
      const d = devDM.rows[i]  || {};
      const aeMatch = p.adjusted_ebitda == null && d.adjusted_ebitda == null ? true :
                      Math.abs(parseFloat(p.adjusted_ebitda||0) - parseFloat(d.adjusted_ebitda||0)) < 0.01;
      const evMatch = p.enterprise_value == null && d.enterprise_value == null ? true :
                      Math.abs(parseFloat(p.enterprise_value||0) - parseFloat(d.enterprise_value||0)) < 0.01;
      if (!aeMatch || !evMatch) allMatch = false;
      console.log(`  [${i}] "${p.name ?? '?'}"  →  "${d.name ?? '?'}"`);
      console.log(`      adjusted_ebitda  prod=${fmt(p.adjusted_ebitda)}  dev=${fmt(d.adjusted_ebitda)}  ${aeMatch?'✓':'✗ MISMATCH'}`);
      console.log(`      enterprise_value prod=${fmt(p.enterprise_value)}  dev=${fmt(d.enterprise_value)}  ${evMatch?'✓':'✗ MISMATCH'}`);
    }
  }

  console.log(`\n  ${allMatch ? '✅ ALL FIGURES MATCH' : '❌ MISMATCHES FOUND'}`);
  return allMatch;
}

// ─── main ─────────────────────────────────────────────────────────────────────
async function main() {
  const arg = process.argv[2];
  const idsToRun = arg ? [parseInt(arg)] : PROD_IDS;

  const results = [];
  for (const prodId of idsToRun) {
    const { devTcId, company_name } = await cloneCompany(prodId);
    const ok = await compareCompany(prodId, devTcId, company_name);
    results.push({ prodId, devTcId, company_name, ok });
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log('PHASE 1 SUMMARY');
  console.log('='.repeat(70));
  for (const r of results) {
    console.log(`  prod=${r.prodId}  dev=${r.devTcId}  ${r.company_name.padEnd(40)}  ${r.ok ? '✅ MATCH' : '❌ MISMATCH'}`);
  }

  await prod.end();
  await dev.end();
}

main().catch(err => { console.error(err); process.exit(1); });
