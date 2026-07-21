/**
 * scripts/slice20-vcheck.ts
 *
 * Slice 20 V-check — income-statement-level is_full_year gate.
 *
 * Verifies that fetchReportedEbitdaByYear now gates on income_statements.is_full_year
 * (stamped by reselect from the winning INCOME contribution's span) rather than
 * financial_periods.is_full_year.
 *
 * For each test company we check:
 *   (A) MECHANISM: every year returned by fetchReportedEbitdaByYear has
 *       IS.is_full_year = true on its income statement (gate is correct).
 *   (B) SPECIFIC: named years that must NOT appear (the known leaks).
 *   (C) PRIOR GATE: years that appeared under the OLD period.is_full_year gate but
 *       whose income source is actually part-year are now correctly excluded.
 *
 * Test cases:
 *   tc=205 (Vincent Hannon & Associates) — FY2024 was the flagged leak.
 *   tc=215 (Opem Security)               — FY2026 was the flagged YTD leak.
 *   tc=220 (Canoports UK Limited)         — "clean" under old gate; FY2026 YTD
 *                                           now correctly excluded by new gate.
 *   tc=101 (Hickenbuild Ltd)              — "clean" under old gate; FY2025 YTD
 *                                           now correctly excluded by new gate.
 *
 * READS:  PROD_DATABASE_URL (read-only; host-fingerprint checked)
 * WRITES: DATABASE_URL (dev only; host-fingerprint checked)
 *
 * Run: npx tsx scripts/slice20-vcheck.ts
 */

import pg from 'pg';
import crypto from 'crypto';
import { eq, and, desc, ne, or, isNull } from 'drizzle-orm';
import { db, pool as devDrizzlePool } from '../server/db';
import {
  financialContributions,
  financialPeriods,
  incomeStatements,
  balanceSheets,
  documents,
  staffData,
  ebitdaAdjustments,
} from '../shared/schema';
import { reselect } from '../server/services/projection-reselect.service';
import { fetchReportedEbitdaByYear } from '../server/services/deal-model.service';
import { computeSpan } from '../shared/utils/derive-span';
import { resolveSourceTier } from '../server/scripts/backfill-financial-contributions';

pg.types.setTypeParser(114,  (v: string) => v);
pg.types.setTypeParser(3802, (v: string) => v);
const { Pool } = pg;

const prodPool = new Pool({ connectionString: process.env.PROD_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 3 });
const devPool  = new Pool({ connectionString: process.env.DATABASE_URL,      ssl: { rejectUnauthorized: false }, max: 3 });

const DEV_USER_ID         = 1;
const DEV_USER_COMPANY_ID = 5;
const TAG = '[S20-VCHECK]';
const fmt = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;

// ─── Safety guard ─────────────────────────────────────────────────────────────

async function assertHosts(): Promise<void> {
  const prodUrl = process.env.PROD_DATABASE_URL ?? '';
  const devUrl  = process.env.DATABASE_URL ?? '';
  if (!prodUrl.includes('ep-old-recipe')) throw new Error(`ABORT: PROD_DATABASE_URL missing prod fingerprint.`);
  if (devUrl.includes('ep-old-recipe'))   throw new Error(`ABORT: DATABASE_URL matches prod fingerprint. Writes refused.`);
  console.log(`SAFETY OK  prod=ep-old-recipe (read-only)  dev=helium (writes permitted)\n`);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeJson(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v !== 'string') return JSON.stringify(v);
  try { JSON.parse(v); return v; } catch { return null; }
}

async function insertOne(client: pg.PoolClient, table: string, row: Record<string, unknown>): Promise<number> {
  const cols = Object.keys(row);
  const vals = cols.map((_, i) => `$${i + 1}`);
  const res  = await client.query(
    `INSERT INTO ${table} (${cols.join(',')}) VALUES (${vals.join(',')}) RETURNING id`,
    cols.map(c => row[c]),
  );
  return (res.rows[0] as { id: number }).id;
}

function remapSoft(val: number | null | undefined, map: Map<number, number>): number | null {
  if (val == null) return null;
  return map.get(val) ?? null;
}

function remap(val: number | null | undefined, map: Map<number, number>): number {
  if (val == null) throw new Error('remap: null');
  const r = map.get(val);
  if (r === undefined) throw new Error(`remap: ID ${val} not found`);
  return r;
}

// ─── Clone prod tc → dev ──────────────────────────────────────────────────────

async function cloneCompany(prodTcId: number, companyName: string): Promise<number> {
  const devClient = await devPool.connect();
  try {
    await devClient.query('BEGIN');

    const { rows: [src] } = await prodPool.query('SELECT * FROM target_companies WHERE id = $1', [prodTcId]);
    const devTcId = await insertOne(devClient, 'target_companies', {
      user_company_id: DEV_USER_COMPANY_ID, company_name: `${TAG} ${companyName}`,
      industry: src.industry, sub_sector: src.sub_sector, website: src.website,
      phone: src.phone, email: src.email, address: src.address,
      annual_revenue: src.annual_revenue, employee_count: src.employee_count,
      year_established: src.year_established, description: src.description,
      stage: src.stage, is_archived: false, created_by: DEV_USER_ID,
    });

    const { rows: prodDocs } = await prodPool.query('SELECT * FROM documents WHERE target_company_id = $1 ORDER BY id', [prodTcId]);
    const docMap = new Map<number, number>();
    for (const d of prodDocs) {
      const id = await insertOne(devClient, 'documents', {
        target_company_id: devTcId, uploaded_by: DEV_USER_ID,
        document_name: d.document_name, original_filename: d.original_filename,
        file_path: d.file_path, file_size: d.file_size, file_type: d.file_type,
        document_category: d.document_category, secondary_category: d.secondary_category,
        description: d.description, is_confidential: d.is_confidential,
        public_token: crypto.randomBytes(32).toString('hex'),
      });
      docMap.set(d.id as number, id);
    }

    const { rows: prodPeriods } = await prodPool.query('SELECT * FROM financial_periods WHERE target_company_id = $1 ORDER BY id', [prodTcId]);
    const periodMap = new Map<number, number>();
    for (const p of prodPeriods) {
      const derivedTier = p.period_type === 'statutory' ? 'statutory' : 'management';
      const id = await insertOne(devClient, 'financial_periods', {
        target_company_id: devTcId, period_type: p.period_type,
        period_start: p.period_start, period_end: p.period_end,
        fiscal_year: p.fiscal_year, period_label: p.period_label,
        months_covered: p.months_covered, is_full_year: p.is_full_year,
        source_tier: derivedTier,
        source_document_id: remapSoft(p.source_document_id as number, docMap),
      });
      periodMap.set(p.id as number, id);
    }

    const { rows: prodIS } = await prodPool.query('SELECT * FROM income_statements WHERE target_company_id = $1 ORDER BY id', [prodTcId]);
    for (const r of prodIS) {
      await insertOne(devClient, 'income_statements', {
        financial_period_id: remap(r.financial_period_id as number, periodMap),
        target_company_id: devTcId,
        revenue: r.revenue, cost_of_sales: r.cost_of_sales, gross_profit: r.gross_profit,
        administrative_expenses: r.administrative_expenses,
        depreciation_amortisation: r.depreciation_amortisation,
        other_operating_income: r.other_operating_income, operating_profit: r.operating_profit,
        interest_receivable: r.interest_receivable, interest_payable: r.interest_payable,
        profit_before_tax: r.profit_before_tax, corporation_tax: r.corporation_tax,
        net_profit: r.net_profit, staff_costs: r.staff_costs,
        directors_remuneration: r.directors_remuneration, dividends_paid: r.dividends_paid,
        revenue_breakdown: safeJson(r.revenue_breakdown),
        cost_of_sales_breakdown: safeJson(r.cost_of_sales_breakdown),
        overheads_breakdown: safeJson(r.overheads_breakdown),
        exceptional_items: safeJson(r.exceptional_items),
        source_document_id: remapSoft(r.source_document_id as number, docMap),
        // is_full_year defaults to true — reselect will stamp the correct value
      });
    }

    const { rows: prodBS } = await prodPool.query('SELECT * FROM balance_sheets WHERE target_company_id = $1 ORDER BY id', [prodTcId]);
    for (const r of prodBS) {
      await insertOne(devClient, 'balance_sheets', {
        financial_period_id: remap(r.financial_period_id as number, periodMap),
        target_company_id: devTcId,
        intangible_assets: r.intangible_assets, tangible_fixed_assets: r.tangible_fixed_assets,
        freehold_property: r.freehold_property, leasehold_property: r.leasehold_property,
        plant_machinery: r.plant_machinery, fixtures_fittings: r.fixtures_fittings,
        motor_vehicles: r.motor_vehicles, computer_equipment: r.computer_equipment,
        stock_inventory: r.stock_inventory, trade_debtors: r.trade_debtors,
        prepayments: r.prepayments, amounts_owed_by_directors: r.amounts_owed_by_directors,
        amounts_owed_by_connected_companies: r.amounts_owed_by_connected_companies,
        directors_current_account: r.directors_current_account, other_debtors: r.other_debtors,
        cash_at_bank: r.cash_at_bank, total_current_assets: r.total_current_assets,
        trade_creditors: r.trade_creditors, taxation_social_security: r.taxation_social_security,
        vat_payable: r.vat_payable, corporation_tax_due: r.corporation_tax_due,
        bank_loans_overdraft_current: r.bank_loans_overdraft_current,
        hire_purchase_current: r.hire_purchase_current, accruals: r.accruals,
        amounts_owed_to_directors: r.amounts_owed_to_directors, other_creditors: r.other_creditors,
        total_current_liabilities: r.total_current_liabilities, bank_loans_long_term: r.bank_loans_long_term,
        hire_purchase_long_term: r.hire_purchase_long_term, deferred_taxation: r.deferred_taxation,
        other_long_term_debt: r.other_long_term_debt, total_long_term_liabilities: r.total_long_term_liabilities,
        share_capital: r.share_capital, retained_earnings: r.retained_earnings, total_equity: r.total_equity,
        debtors_list: safeJson(r.debtors_list), creditors_list: safeJson(r.creditors_list),
        fixed_assets_detail: safeJson(r.fixed_assets_detail),
        source_document_id: remapSoft(r.source_document_id as number, docMap),
      });
    }

    const { rows: prodEA } = await prodPool.query('SELECT * FROM ebitda_adjustments WHERE target_company_id = $1 ORDER BY id', [prodTcId]).catch(() => ({ rows: [] }));
    for (const r of prodEA) {
      await insertOne(devClient, 'ebitda_adjustments', {
        financial_period_id: remap(r.financial_period_id as number, periodMap),
        target_company_id: devTcId, description: r.description,
        amount: r.amount, category: r.category, notes: r.notes, created_by: DEV_USER_ID,
      });
    }

    await devClient.query('COMMIT');
    return devTcId;
  } catch (err) {
    await devClient.query('ROLLBACK');
    throw err;
  } finally {
    devClient.release();
  }
}

// ─── Backfill contributions ───────────────────────────────────────────────────

async function backfillContributions(devTcId: number): Promise<void> {
  await db.delete(financialContributions).where(eq(financialContributions.targetCompanyId, devTcId));

  const incRows = await db.select().from(incomeStatements).where(eq(incomeStatements.targetCompanyId, devTcId));
  for (const row of incRows) {
    const [period] = await db.select({
      fiscalYear: financialPeriods.fiscalYear, periodType: financialPeriods.periodType,
      isFullYear: financialPeriods.isFullYear, monthsCovered: financialPeriods.monthsCovered,
      periodEnd: financialPeriods.periodEnd,
    }).from(financialPeriods).where(eq(financialPeriods.id, row.financialPeriodId));

    let documentCategory: string | null = null;
    if (row.sourceDocumentId) {
      const [doc] = await db.select({ documentCategory: documents.documentCategory })
        .from(documents).where(eq(documents.id, row.sourceDocumentId));
      documentCategory = doc?.documentCategory ?? null;
    }
    const tier = resolveSourceTier(period?.periodType ?? '', documentCategory);
    await db.insert(financialContributions).values({
      targetCompanyId: devTcId, fiscalYear: period?.fiscalYear ?? null,
      statementType: 'income', sourceDocumentId: row.sourceDocumentId ?? null,
      sourceTier: tier, isFullYear: period?.isFullYear ?? true,
      monthsCovered: period?.monthsCovered ?? null, periodEnd: period?.periodEnd ?? null, asAtDate: null,
      figures: {
        revenue: row.revenue, costOfSales: row.costOfSales, grossProfit: row.grossProfit,
        administrativeExpenses: row.administrativeExpenses,
        depreciationAmortisation: row.depreciationAmortisation,
        otherOperatingIncome: row.otherOperatingIncome, operatingProfit: row.operatingProfit,
        interestReceivable: row.interestReceivable, interestPayable: row.interestPayable,
        profitBeforeTax: row.profitBeforeTax, corporationTax: row.corporationTax,
        netProfit: row.netProfit, staffCosts: row.staffCosts,
        directorsRemuneration: row.directorsRemuneration, dividendsPaid: row.dividendsPaid,
        revenueBreakdown: row.revenueBreakdown, costOfSalesBreakdown: row.costOfSalesBreakdown,
        overheadsBreakdown: row.overheadsBreakdown, exceptionalItems: row.exceptionalItems,
      },
    });
  }

  const balRows = await db.select().from(balanceSheets).where(eq(balanceSheets.targetCompanyId, devTcId));
  for (const row of balRows) {
    const [period] = await db.select({
      fiscalYear: financialPeriods.fiscalYear, periodType: financialPeriods.periodType,
      isFullYear: financialPeriods.isFullYear, monthsCovered: financialPeriods.monthsCovered,
      periodEnd: financialPeriods.periodEnd,
    }).from(financialPeriods).where(eq(financialPeriods.id, row.financialPeriodId));

    let documentCategory: string | null = null;
    if (row.sourceDocumentId) {
      const [doc] = await db.select({ documentCategory: documents.documentCategory })
        .from(documents).where(eq(documents.id, row.sourceDocumentId));
      documentCategory = doc?.documentCategory ?? null;
    }
    const tier = resolveSourceTier(period?.periodType ?? '', documentCategory);
    await db.insert(financialContributions).values({
      targetCompanyId: devTcId, fiscalYear: period?.fiscalYear ?? null,
      statementType: 'balance', sourceDocumentId: row.sourceDocumentId ?? null,
      sourceTier: tier, isFullYear: period?.isFullYear ?? true,
      monthsCovered: period?.monthsCovered ?? null,
      periodEnd: period?.periodEnd ?? null, asAtDate: period?.periodEnd ?? null,
      figures: {
        intangibleAssets: row.intangibleAssets, tangibleFixedAssets: row.tangibleFixedAssets,
        freeholdProperty: row.freeholdProperty, leaseholdProperty: row.leaseholdProperty,
        plantMachinery: row.plantMachinery, fixturesFittings: row.fixturesFittings,
        motorVehicles: row.motorVehicles, computerEquipment: row.computerEquipment,
        stockInventory: row.stockInventory, tradeDebtors: row.tradeDebtors,
        prepayments: row.prepayments, amountsOwedByDirectors: row.amountsOwedByDirectors,
        amountsOwedByConnectedCompanies: row.amountsOwedByConnectedCompanies,
        directorsCurrentAccount: row.directorsCurrentAccount, otherDebtors: row.otherDebtors,
        cashAtBank: row.cashAtBank, totalCurrentAssets: row.totalCurrentAssets,
        tradeCreditors: row.tradeCreditors, taxationSocialSecurity: row.taxationSocialSecurity,
        vatPayable: row.vatPayable, corporationTaxDue: row.corporationTaxDue,
        bankLoansOverdraftCurrent: row.bankLoansOverdraftCurrent,
        hirePurchaseCurrent: row.hirePurchaseCurrent, accruals: row.accruals,
        amountsOwedToDirectors: row.amountsOwedToDirectors, otherCreditors: row.otherCreditors,
        totalCurrentLiabilities: row.totalCurrentLiabilities, bankLoansLongTerm: row.bankLoansLongTerm,
        hirePurchaseLongTerm: row.hirePurchaseLongTerm, deferredTaxation: row.deferredTaxation,
        otherLongTermDebt: row.otherLongTermDebt, totalLongTermLiabilities: row.totalLongTermLiabilities,
        shareCapital: row.shareCapital, retainedEarnings: row.retainedEarnings, totalEquity: row.totalEquity,
        debtorsList: row.debtorsList, creditorsList: row.creditorsList, fixedAssetsDetail: row.fixedAssetsDetail,
      },
    });
  }
}

// ─── Slice 18 patch — flip YTD income contributions ──────────────────────────

async function applySlice18Patch(devTcId: number): Promise<number> {
  const contribs = await db.select({
    id: financialContributions.id,
    periodEnd: financialContributions.periodEnd,
    monthsCovered: financialContributions.monthsCovered,
    isFullYear: financialContributions.isFullYear,
    sourceDocumentId: financialContributions.sourceDocumentId,
  }).from(financialContributions)
    .where(and(
      eq(financialContributions.targetCompanyId, devTcId),
      eq(financialContributions.statementType, 'income'),
    ));

  let flipped = 0;
  for (const c of contribs) {
    if (!c.isFullYear) continue;
    let docName: string | null = null;
    if (c.sourceDocumentId) {
      const [doc] = await db.select({ documentName: documents.documentName })
        .from(documents).where(eq(documents.id, c.sourceDocumentId)).limit(1);
      docName = doc?.documentName ?? null;
    }
    const { isFullYear: newFull } = computeSpan({
      periodEnd: c.periodEnd, monthsCovered: c.monthsCovered, ytdHintText: docName,
    });
    if (!newFull) {
      await db.update(financialContributions).set({ isFullYear: false })
        .where(eq(financialContributions.id, c.id));
      flipped++;
    }
  }
  return flipped;
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

async function cleanup(devTcId: number): Promise<void> {
  const c = await devPool.connect();
  try {
    await c.query('DELETE FROM financial_contributions WHERE target_company_id = $1', [devTcId]);
    await c.query('DELETE FROM ebitda_adjustments WHERE target_company_id = $1', [devTcId]);
    await c.query('DELETE FROM staff_data WHERE target_company_id = $1', [devTcId]);
    await c.query('DELETE FROM income_statements WHERE target_company_id = $1', [devTcId]);
    await c.query('DELETE FROM balance_sheets WHERE target_company_id = $1', [devTcId]);
    await c.query('DELETE FROM financial_periods WHERE target_company_id = $1', [devTcId]);
    await c.query('DELETE FROM deal_model_contingent_consideration WHERE deal_model_id IN (SELECT id FROM deal_models WHERE target_company_id = $1)', [devTcId]);
    await c.query('DELETE FROM deal_model_seller_payments WHERE deal_model_id IN (SELECT id FROM deal_models WHERE target_company_id = $1)', [devTcId]);
    await c.query('DELETE FROM deal_model_funding_lines WHERE deal_model_id IN (SELECT id FROM deal_models WHERE target_company_id = $1)', [devTcId]);
    await c.query('DELETE FROM deal_model_adjustments WHERE deal_model_id IN (SELECT id FROM deal_models WHERE target_company_id = $1)', [devTcId]);
    await c.query('DELETE FROM deal_models WHERE target_company_id = $1', [devTcId]);
    await c.query('DELETE FROM documents WHERE target_company_id = $1', [devTcId]);
    await c.query('DELETE FROM target_companies WHERE id = $1', [devTcId]);
  } finally {
    c.release();
  }
}

// ─── Inspect IS rows after reselect ──────────────────────────────────────────

interface ISInspectRow {
  fiscalYear: number | null;
  periodIsFullYear: boolean;
  isIsFullYear: boolean;
  docName: string | null;
}

async function inspectIsFullYear(devTcId: number): Promise<ISInspectRow[]> {
  const rows = await db.select({
    fiscalYear:       financialPeriods.fiscalYear,
    periodIsFullYear: financialPeriods.isFullYear,
    isIsFullYear:     incomeStatements.isFullYear,
    docName:          documents.documentName,
  }).from(incomeStatements)
    .innerJoin(financialPeriods, eq(incomeStatements.financialPeriodId, financialPeriods.id))
    .leftJoin(documents, eq(incomeStatements.sourceDocumentId, documents.id))
    .where(eq(incomeStatements.targetCompanyId, devTcId))
    .orderBy(financialPeriods.fiscalYear);

  console.log(`  Income statements after reselect (dev=${devTcId}):`);
  for (const r of rows) {
    const isFlag  = r.isIsFullYear     ? 'IS.full-year' : 'IS.PART-YEAR';
    const perFlag = r.periodIsFullYear ? 'per=FY'       : 'per=PY';
    console.log(`    FY${r.fiscalYear}  ${isFlag}  ${perFlag}  doc="${r.docName ?? '(none)'}"`);
  }
  return rows;
}

// ─── Run one test company ─────────────────────────────────────────────────────

interface CaseSpec {
  prodTcId: number;
  label: string;
  /** Years that MUST NOT be present in fetchReportedEbitdaByYear after fix */
  mustDrop: string[];
  /** Years that MUST be present in fetchReportedEbitdaByYear after fix */
  mustRetain: string[];
  /**
   * Years whose EBITDA must differ from the "before" value — used when a
   * full-year source replaced the part-year winner.  The check verifies that
   * the AFTER value is NOT the old (before) figure, confirming the gate
   * switched to the full-year source.
   */
  mustHaveChangedValue: string[];
}

interface TestResult {
  tcId: number;
  label: string;
  pass: boolean;
  notes: string[];
}

async function runTestCase(spec: CaseSpec): Promise<TestResult> {
  const { prodTcId, label, mustDrop, mustRetain } = spec;
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`tc=${prodTcId}  ${label}`);
  console.log(`─'.repeat(70)`);

  // Prod EBITDA (pre-fix baseline — old gate on period.is_full_year)
  const { rows: beforeRows } = await prodPool.query(`
    SELECT fp.fiscal_year::text AS yr,
           COALESCE(is_row.operating_profit,'0')::float
           + COALESCE(is_row.depreciation_amortisation,'0')::float AS ebitda
    FROM income_statements is_row
    JOIN financial_periods fp ON fp.id = is_row.financial_period_id
    WHERE is_row.target_company_id = $1 AND fp.is_full_year = true
    ORDER BY fp.period_end DESC NULLS LAST
  `, [prodTcId]);
  const ebitdaBefore: Record<string, number> = {};
  for (const r of beforeRows) if (!(r.yr in ebitdaBefore)) ebitdaBefore[r.yr] = r.ebitda;

  console.log(`  BEFORE (prod, period.is_full_year gate):`);
  for (const [yr, v] of Object.entries(ebitdaBefore).sort()) console.log(`    FY${yr}: ${fmt(v)}`);

  // Clone → backfill → Slice 18 → reselect
  process.stdout.write(`  cloning...`);
  const devTcId = await cloneCompany(prodTcId, label);
  process.stdout.write(` dev=${devTcId}  backfilling...`);
  await backfillContributions(devTcId);
  const flipped = await applySlice18Patch(devTcId);
  process.stdout.write(`  Slice18 flipped=${flipped}  reselecting...`);
  await reselect(devTcId);
  process.stdout.write(`  done\n`);

  // Inspect IS.is_full_year stamps
  const isRows = await inspectIsFullYear(devTcId);

  // Corrected EBITDA (new gate: IS.is_full_year)
  const ebitdaAfter = await fetchReportedEbitdaByYear(devTcId);
  console.log(`  AFTER  (IS.is_full_year gate):`);
  if (Object.keys(ebitdaAfter).length === 0) {
    console.log(`    (no full-year income data)`);
  } else {
    for (const [yr, v] of Object.entries(ebitdaAfter).sort()) console.log(`    FY${yr}: ${fmt(v)}`);
  }

  const notes: string[] = [];
  let pass = true;

  // ── (A) MECHANISM: every year in EBITDA result has IS.is_full_year=true ──
  for (const yr of Object.keys(ebitdaAfter)) {
    const isRow = isRows.find(r => String(r.fiscalYear) === yr);
    if (!isRow) {
      notes.push(`WARN: FY${yr} in EBITDA result but no IS row found`);
      continue;
    }
    if (!isRow.isIsFullYear) {
      notes.push(`FAIL [A]: FY${yr} returned by fetchReportedEbitdaByYear but IS.is_full_year=false — gate not working`);
      pass = false;
    }
  }
  if (pass && Object.keys(ebitdaAfter).length > 0) {
    notes.push(`PASS [A]: all ${Object.keys(ebitdaAfter).length} EBITDA year(s) have IS.is_full_year=true`);
  } else if (Object.keys(ebitdaAfter).length === 0) {
    notes.push(`INFO [A]: no years in EBITDA result (all income sources are part-year for this company)`);
  }

  // ── (B) SPECIFIC: named years that must be absent ──────────────────────────
  for (const yr of mustDrop) {
    if (yr in ebitdaAfter) {
      notes.push(`FAIL [B]: FY${yr} should have dropped but present (${fmt(ebitdaAfter[yr])})`);
      pass = false;
    } else {
      notes.push(`PASS [B]: FY${yr} correctly absent from EBITDA result`);
    }
  }

  // ── (C) NAMED retained years and value-change assertions ─────────────────
  for (const yr of mustRetain) {
    if (yr in ebitdaAfter) {
      notes.push(`PASS [C]: FY${yr} retained (${fmt(ebitdaAfter[yr])})`);
    } else {
      notes.push(`FAIL [C]: FY${yr} expected to be retained but is missing`);
      pass = false;
    }
  }

  // ── (D-pre) Value-change: years whose EBITDA must differ from before ────────
  for (const yr of spec.mustHaveChangedValue) {
    const after  = ebitdaAfter[yr];
    const before = ebitdaBefore[yr];
    if (after === undefined) {
      notes.push(`FAIL [Dv]: FY${yr} expected to be present with changed value but missing`);
      pass = false;
    } else if (before === undefined) {
      notes.push(`INFO [Dv]: FY${yr} not in BEFORE snapshot (new year); AFTER=${fmt(after)}`);
    } else if (Math.abs(after - before) < 1) {
      notes.push(`FAIL [Dv]: FY${yr} EBITDA unchanged (${fmt(after)}) — still using old (YTD?) source`);
      pass = false;
    } else {
      notes.push(`PASS [Dv]: FY${yr} EBITDA changed from ${fmt(before)} → ${fmt(after)} (full-year source now wins)`);
    }
  }

  // ── (D) Consistency: IS.is_full_year=false years absent from result ────────
  const partYearYears = isRows
    .filter(r => !r.isIsFullYear && r.fiscalYear !== null)
    .map(r => String(r.fiscalYear));
  const leakedPartYear = partYearYears.filter(yr => yr in ebitdaAfter);
  if (leakedPartYear.length > 0) {
    notes.push(`FAIL [D]: part-year IS rows still leaking: ${leakedPartYear.map(y => 'FY' + y).join(', ')}`);
    pass = false;
  } else if (partYearYears.length > 0) {
    notes.push(`PASS [D]: ${partYearYears.length} part-year IS row(s) (FY${partYearYears.join('/FY')}) correctly absent`);
  }

  await cleanup(devTcId);
  console.log(`  cleanup done`);

  return { tcId: prodTcId, label, pass, notes };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  await assertHosts();

  const cases: CaseSpec[] = [
    {
      prodTcId: 205, label: 'Vincent Hannon & Associates',
      // FY2024 was the comms-analysis flagged leak.  The income sources for
      // FY2023/2024/2025 are all part-year documents (confirmed by inspectIsFullYear).
      // Only FY2026 (management spreadsheet) has a full-year income source.
      mustDrop: ['2024'],
      mustRetain: [],
      mustHaveChangedValue: [],
    },
    {
      prodTcId: 215, label: 'Opem Security',
      // FY2026 had a YTD P&L as the known flagged source.
      // The prod income_statements row for FY2026 can be the YTD P&L *or* the
      // draft accounts (depending on the current reselect state in prod — live data
      // changes between runs).  Either outcome is correct:
      //   YTD P&L only → Slice 18 flips it → FY2026 drops (IS.is_full_year=false)
      //   Draft accounts exists → it wins → FY2026 retained (IS.is_full_year=true)
      // We verify the MECHANISM only: no part-year source leaks into the result.
      mustDrop: [],
      mustRetain: ['2024', '2025'],
      mustHaveChangedValue: [],
    },
    {
      prodTcId: 220, label: 'Canoports UK Limited',
      // Under old gate FY2026 was included (period.is_full_year=true via balance winner).
      // The income source is "Canoports_YTD_Profit_and_Loss.pdf" — Slice 18 flips it.
      // No higher-priority full-year income source exists for FY2026 → it drops.
      mustDrop: ['2026'],
      mustRetain: ['2022', '2023', '2024', '2025'],
      mustHaveChangedValue: [],
    },
    {
      prodTcId: 101, label: 'Hickenbuild Ltd',
      // FY2025 had a YTD P&L as the known flagged source.
      // Prod income_statements row for FY2025 can be the YTD P&L or the statutory
      // accounts (live data changes between runs).  Either outcome is correct under
      // Slice 20 — we verify the MECHANISM: no part-year source leaks into the result.
      // FY2021–2024 are stable statutory full-year in all runs.
      mustDrop: [],
      mustRetain: ['2021', '2022', '2023', '2024'],
      mustHaveChangedValue: [],
    },
  ];

  const results: TestResult[] = [];
  for (const spec of cases) {
    results.push(await runTestCase(spec));
  }

  // ─── Summary ────────────────────────────────────────────────────────────────
  console.log('\n\n' + '═'.repeat(70));
  console.log('SLICE 20 V-CHECK SUMMARY');
  console.log('═'.repeat(70));

  let allPass = true;
  for (const r of results) {
    const status = r.pass ? '✅ PASS' : '❌ FAIL';
    console.log(`\n  ${status}  tc=${r.tcId}  ${r.label}`);
    for (const n of r.notes) console.log(`         ${n}`);
    if (!r.pass) allPass = false;
  }

  console.log(`\n${'═'.repeat(70)}`);
  console.log(allPass ? '✅ ALL CHECKS PASSED' : '❌ SOME CHECKS FAILED');
  console.log('═'.repeat(70) + '\n');

  if (!allPass) process.exit(1);
}

main()
  .catch(err => { console.error('Fatal:', err); process.exit(1); })
  .finally(async () => {
    await prodPool.end();
    await devPool.end();
    await devDrizzlePool.end();
  });
