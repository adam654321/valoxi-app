/**
 * scripts/comms-analysis.ts
 *
 * Definitive customer-communications analysis — Slices 17/18/19 live.
 *
 * READS:  PROD_DATABASE_URL (prod — never written to, host-fingerprint verified)
 * WRITES: DATABASE_URL (dev heliumdb only — asserted before every write)
 *
 * STEP 1 — Re-identify affected companies FRESH from current prod.
 *           Four flags:
 *             A) Duplicate full-year periods for the same fiscal year
 *             B) Management full-year period coexisting with statutory for same year
 *             C) Any period fiscal_year > 2026
 *             D) Accounting documents uploaded with zero resulting statutory full-year periods
 *           Excludes known test company ids: 45,76,77,78,120,71
 *
 * STEP 2 — For each affected company:
 *             a) Capture CURRENT state from prod (reportedEbitdaByYear + deal model EV)
 *             b) Clone prod → fresh dev company
 *             c) Backfill financial_contributions on dev clone
 *             d) Apply Slice 18 patch (rerun computeSpan with document filename
 *                to flip YTD income contributions to is_full_year=false)
 *             e) Run reselect() on dev clone  (Slices 17/18/19 live)
 *             f) Capture CORRECTED state from dev
 *             g) Compute delta; determine materiality
 *             h) Check for any issued offer/HoT (frozen snapshot)
 *             i) Self-validate ACTIVE+MATERIAL companies (3 leak checks)
 *             j) Delete dev clone
 *
 * STEP 3 — Self-validate every ACTIVE+MATERIAL company:
 *             i)  no fiscal_year > current year feeds the averaging window
 *             ii) no YTD/part-year income contribution wins valuation (is_full_year=true)
 *             iii) no is_full_year=true IS period has income sourced from a YTD document
 *           Flag if any check fails — residual leak, not an email.
 *
 * STEP 4 — Output one table sorted:
 *             ACTIVE+MATERIAL first (the email list),
 *             then ACTIVE+IMMATERIAL, then non-active.
 *           Columns: company, owner, email, status, flags, what-moved,
 *                    current→corrected EV, up/down, material?, offer-affected?,
 *                    leak-check (clean / FLAG)
 *
 * Run: npx tsx scripts/comms-analysis.ts
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
  dealModels,
  dealModelAdjustments,
  dealModelFundingLines,
  dealModelSellerPayments,
  dealModelContingentConsideration,
  documents,
  staffData,
  ebitdaAdjustments,
} from '../shared/schema';
import { reselect } from '../server/services/projection-reselect.service';
import {
  calculateFullDealModel,
  toNum,
  type AdjustmentInput,
  type FundingLineInput,
  type SellerPaymentInput,
  type ContingentConsiderationInput,
  type DealModelInput,
} from '../shared/calculators/deal-model.calc';
import { resolveSourceTier } from '../server/scripts/backfill-financial-contributions';
import { computeSpan } from '../shared/utils/derive-span';

// ─── pg setup — keep JSON as raw strings for cross-DB clone ──────────────────
pg.types.setTypeParser(114,  (v: string) => v);   // json
pg.types.setTypeParser(3802, (v: string) => v);   // jsonb
const { Pool } = pg;

// ─── Connections ──────────────────────────────────────────────────────────────
const prodPool = new Pool({ connectionString: process.env.PROD_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 3 });
const devPool  = new Pool({ connectionString: process.env.DATABASE_URL,      ssl: { rejectUnauthorized: false }, max: 3 });

// ─── Constants ────────────────────────────────────────────────────────────────
const EXCLUDED_TC_IDS = [45, 76, 77, 78, 120, 71];
const DEV_USER_ID         = 1;
const DEV_USER_COMPANY_ID = 5;
const MATERIAL_ABS        = 1000;   // £1,000 absolute threshold
const MATERIAL_PCT        = 0.01;   // 1% relative threshold
const TODAY_YEAR          = new Date().getFullYear();

// ─── Types ───────────────────────────────────────────────────────────────────

interface AffectedCompany {
  tcId: number;
  companyName: string;
  userCompanyId: number;
  flags: string[];
}

interface AccountInfo {
  ownerName: string;
  ownerEmail: string;
  status: string;   // active | trialing | past_due | canceled | incomplete | admin_comped | unknown
  isActive: boolean;
}

interface EbitdaByYear {
  [year: string]: number;
}

interface DealModelCalc {
  modelId: number;
  name: string;
  averagingYears: number;
  multiple: number;
  avgAdjEbitda: number;
  enterpriseValue: number;
}

interface IssuedOffer {
  docId: number;
  docType: string;
  frozenEV: number | null;
  frozenOffer: number | null;
  sentAt: string | null;
}

interface SelfValidationResult {
  pass: boolean;
  leaks: string[];
}

interface CompanyResult {
  prodTcId: number;
  companyName: string;
  userCompanyId: number;
  flags: string[];
  account: AccountInfo;
  currentEbitdaByYear: EbitdaByYear;
  correctedEbitdaByYear: EbitdaByYear;
  currentDealModel: DealModelCalc | null;
  correctedDealModel: DealModelCalc | null;
  issuedOffers: IssuedOffer[];
  ebitdaChanged: boolean;
  evChanged: boolean;
  offerAffected: boolean;
  material: boolean;
  whatMoved: string;
  direction: string;
  deltaEV: number | null;
  slice18Flipped: number;
  validation: SelfValidationResult;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function remap(val: number | null | undefined, map: Map<number, number>): number {
  if (val == null) throw new Error(`remap: null value`);
  const r = map.get(val);
  if (r === undefined) throw new Error(`ID ${val} not found in remap map`);
  return r;
}

function remapSoft(val: number | null | undefined, map: Map<number, number>): number | null {
  if (val == null) return null;
  return map.get(val) ?? null;
}

function safeJson(value: string | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value !== 'string') return JSON.stringify(value);
  try { JSON.parse(value); return value; }
  catch { return null; }
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

const fmt = (n: number | null | undefined) =>
  n == null ? 'n/a' : `£${Math.round(n).toLocaleString('en-GB')}`;

const pct = (n: number | null | undefined) =>
  n == null ? '' : ` (${(n * 100).toFixed(1)}%)`;

// ─── 0. Safety guards ─────────────────────────────────────────────────────────

async function assertHosts(): Promise<void> {
  console.log('═'.repeat(70));
  console.log('SAFETY CHECK — asserting both hosts before any writes');
  console.log('═'.repeat(70));

  const prodUrl = process.env.PROD_DATABASE_URL ?? '';
  const devUrl  = process.env.DATABASE_URL ?? '';

  console.log(`  PROD_DATABASE_URL host fragment: ${prodUrl.split('@')[1]?.split('/')[0] ?? '(parse error)'}`);
  if (!prodUrl.includes('ep-old-recipe')) {
    throw new Error(`ABORT: PROD_DATABASE_URL does not contain expected prod fingerprint (ep-old-recipe). Got: ${prodUrl.substring(0, 60)}`);
  }
  console.log('  PROD: ✓ recognised prod URL — treating as READ-ONLY');

  console.log(`  DATABASE_URL host fragment:      ${devUrl.split('@')[1]?.split('/')[0] ?? '(parse error)'}`);
  if (devUrl.includes('ep-old-recipe')) {
    throw new Error(`ABORT: DATABASE_URL contains prod fingerprint. Writes refused.`);
  }
  console.log('  DEV:  ✓ NOT prod — dev writes permitted');

  const prodDb = (await prodPool.query('SELECT current_database() AS db')).rows[0].db;
  console.log(`  PROD db name: ${prodDb}`);
  const devDb = (await devPool.query('SELECT current_database() AS db')).rows[0].db;
  console.log(`  DEV  db name: ${devDb}`);
  console.log(`  Today year: ${TODAY_YEAR}\n`);
}

// ─── 1. Identify affected companies from prod ─────────────────────────────────

async function identifyAffectedCompanies(): Promise<AffectedCompany[]> {
  console.log('STEP 1 — Identifying affected companies from prod');
  console.log('─'.repeat(70));

  const excludeList = EXCLUDED_TC_IDS.join(',');

  // Flag A: Duplicate full-year periods for the same fiscal year
  const { rows: flagA } = await prodPool.query(`
    SELECT DISTINCT target_company_id
    FROM financial_periods
    WHERE is_full_year = true AND fiscal_year IS NOT NULL
      AND target_company_id NOT IN (${excludeList})
    GROUP BY target_company_id, fiscal_year
    HAVING COUNT(*) > 1
  `);
  const setA = new Set(flagA.map(r => r.target_company_id as number));
  console.log(`  Flag A (duplicate full-year periods):          ${setA.size} companies`);

  // Flag B: Management full-year coexisting with statutory for same year
  const { rows: flagB } = await prodPool.query(`
    SELECT DISTINCT fp1.target_company_id
    FROM financial_periods fp1
    WHERE fp1.is_full_year = true
      AND fp1.period_type = 'management'
      AND fp1.target_company_id NOT IN (${excludeList})
      AND EXISTS (
        SELECT 1 FROM financial_periods fp2
        WHERE fp2.target_company_id = fp1.target_company_id
          AND fp2.fiscal_year = fp1.fiscal_year
          AND fp2.is_full_year = true
          AND fp2.period_type = 'statutory'
      )
  `);
  const setB = new Set(flagB.map(r => r.target_company_id as number));
  console.log(`  Flag B (management+statutory conflict):        ${setB.size} companies`);

  // Flag C: Any period fiscal_year > TODAY_YEAR
  const { rows: flagC } = await prodPool.query(`
    SELECT DISTINCT target_company_id
    FROM financial_periods
    WHERE fiscal_year > ${TODAY_YEAR}
      AND target_company_id NOT IN (${excludeList})
  `);
  const setC = new Set(flagC.map(r => r.target_company_id as number));
  console.log(`  Flag C (fiscal_year > ${TODAY_YEAR}):              ${setC.size} companies`);

  // Flag D: Accounting docs uploaded, zero statutory full-year income statements resulting
  const { rows: flagD } = await prodPool.query(`
    SELECT DISTINCT d.target_company_id
    FROM documents d
    WHERE d.document_category != 'Deal Documents'
      AND d.target_company_id NOT IN (${excludeList})
      AND EXISTS (
        SELECT 1 FROM income_statements i
        JOIN financial_periods fp ON fp.id = i.financial_period_id
        WHERE fp.target_company_id = d.target_company_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM financial_periods fp2
        WHERE fp2.target_company_id = d.target_company_id
          AND fp2.is_full_year = true
          AND fp2.period_type = 'statutory'
      )
  `);
  const setD = new Set(flagD.map(r => r.target_company_id as number));
  console.log(`  Flag D (docs exist, zero stat full-year IS):   ${setD.size} companies`);

  const allIds = new Set([...setA, ...setB, ...setC, ...setD]);
  console.log(`  TOTAL unique affected companies: ${allIds.size}\n`);

  if (allIds.size === 0) return [];

  const idList = [...allIds].join(',');
  const { rows: companies } = await prodPool.query(`
    SELECT tc.id AS tc_id, tc.company_name, tc.user_company_id
    FROM target_companies tc
    WHERE tc.id IN (${idList})
    ORDER BY tc.id
  `);

  return companies.map(c => ({
    tcId: c.tc_id as number,
    companyName: c.company_name as string,
    userCompanyId: c.user_company_id as number,
    flags: [
      setA.has(c.tc_id) ? 'dup-fy'      : null,
      setB.has(c.tc_id) ? 'mgmt-v-stat' : null,
      setC.has(c.tc_id) ? 'forecast-yr' : null,
      setD.has(c.tc_id) ? 'zero-stat'   : null,
    ].filter(Boolean) as string[],
  }));
}

// ─── Account info (owner + subscription status) ───────────────────────────────

async function getAccountInfo(userCompanyId: number): Promise<AccountInfo> {
  const { rows } = await prodPool.query(`
    SELECT
      u.first_name || ' ' || u.last_name AS owner_name,
      u.email                             AS owner_email,
      COALESCE(s.status::text, 'unknown') AS status
    FROM user_company_memberships ucm
    JOIN users u ON u.id = ucm.user_id
    LEFT JOIN subscriptions s ON s.user_company_id = ucm.user_company_id
    WHERE ucm.user_company_id = $1
      AND ucm.is_company_admin = true
    ORDER BY u.id
    LIMIT 1
  `, [userCompanyId]);

  if (rows.length === 0) {
    return { ownerName: '(unknown)', ownerEmail: '(unknown)', status: 'unknown', isActive: false };
  }

  const status: string = rows[0].status;
  const isActive = ['active', 'trialing', 'past_due', 'admin_comped'].includes(status);
  return {
    ownerName:  rows[0].owner_name,
    ownerEmail: rows[0].owner_email,
    status,
    isActive,
  };
}

// ─── Current EBITDA from prod (mimics fetchReportedEbitdaByYear) ──────────────

async function getProdEbitdaByYear(tcId: number): Promise<EbitdaByYear> {
  // prod has period_type (not source_tier). We exclude IM by checking document_category.
  const { rows } = await prodPool.query(`
    SELECT fp.fiscal_year, fp.period_end,
           COALESCE(is_val.operating_profit, '0')::float            AS op,
           COALESCE(is_val.depreciation_amortisation, '0')::float   AS da
    FROM income_statements is_val
    JOIN financial_periods fp ON fp.id = is_val.financial_period_id
    LEFT JOIN documents d ON d.id = fp.source_document_id
    WHERE is_val.target_company_id = $1
      AND fp.is_full_year = true
      AND (d.document_category IS NULL OR d.document_category != 'Deal Documents')
    ORDER BY fp.period_end DESC NULLS LAST
  `, [tcId]);

  const result: EbitdaByYear = {};
  for (const row of rows) {
    const year = row.fiscal_year
      ? String(row.fiscal_year)
      : (row.period_end ? String(new Date(row.period_end).getFullYear()) : null);
    if (!year) continue;
    if (year in result) continue;
    result[year] = (row.op as number) + (row.da as number);
  }
  return result;
}

// ─── Corrected EBITDA from dev (after reselect) — via Drizzle ────────────────

async function getDevEbitdaByYear(devTcId: number): Promise<EbitdaByYear> {
  const rows = await db
    .select({
      fiscalYear:               financialPeriods.fiscalYear,
      periodEnd:                financialPeriods.periodEnd,
      operatingProfit:          incomeStatements.operatingProfit,
      depreciationAmortisation: incomeStatements.depreciationAmortisation,
    })
    .from(incomeStatements)
    .innerJoin(financialPeriods, eq(incomeStatements.financialPeriodId, financialPeriods.id))
    .where(
      and(
        eq(incomeStatements.targetCompanyId, devTcId),
        // Slice 20: gate on income_statements.is_full_year (stamped by reselect
        // from the winning income contribution's span) not the period container.
        eq(incomeStatements.isFullYear, true),
        or(
          isNull(financialPeriods.sourceTier),
          ne(financialPeriods.sourceTier, 'information_memorandum'),
        ),
      ),
    )
    .orderBy(desc(financialPeriods.periodEnd));

  const result: EbitdaByYear = {};
  for (const row of rows) {
    const year = row.fiscalYear?.toString()
      || (row.periodEnd ? String(new Date(row.periodEnd).getFullYear()) : null);
    if (!year) continue;
    if (year in result) continue;
    result[year] = toNum(row.operatingProfit) + toNum(row.depreciationAmortisation);
  }
  return result;
}

// ─── Deal model calculation ───────────────────────────────────────────────────

async function computeDealModel(
  devTcId: number,
  ebitdaByYear: EbitdaByYear,
): Promise<DealModelCalc | null> {
  const dms = await db
    .select()
    .from(dealModels)
    .where(eq(dealModels.targetCompanyId, devTcId))
    .orderBy(dealModels.id);

  if (dms.length === 0) return null;

  const dm = dms[0];

  const adjs = await db.select().from(dealModelAdjustments)
    .where(eq(dealModelAdjustments.dealModelId, dm.id));
  const fls  = await db.select().from(dealModelFundingLines)
    .where(eq(dealModelFundingLines.dealModelId, dm.id));
  const sps  = await db.select().from(dealModelSellerPayments)
    .where(eq(dealModelSellerPayments.dealModelId, dm.id));
  const ccs  = await db.select().from(dealModelContingentConsideration)
    .where(eq(dealModelContingentConsideration.dealModelId, dm.id));

  const adjustments: AdjustmentInput[] = adjs.map(a => ({
    adjustmentType:     a.adjustmentType as 'add_back' | 'deduction',
    amount:             a.amount,
    amountsByYear:      a.amountsByYear as Record<string, number> | null,
    status:             a.status || 'suggested',
    userOverrideAmount: null,
  }));

  const fundingLines: FundingLineInput[] = fls
    .filter(f => f.fundingType !== 'seller_financing' && f.fundingType !== 'earnout')
    .map(f => ({
      fundingType:           f.fundingType,
      assetBaseValue:        f.assetBaseValue,
      ltvPercent:            f.ltvPercent,
      amountUsed:            f.amountUsed,
      interestRate:          f.interestRate,
      termMonths:            f.termMonths,
      arrangementFeePercent: f.arrangementFeePercent ?? null,
      isDebt:                f.isDebt ?? false,
      repaymentStructure:    f.repaymentStructure ?? 'amortizing',
      isActive:              f.isActive ?? false,
    }));

  const sellerPayments: SellerPaymentInput[] = sps.map(s => ({
    amount:        s.amount,
    termMonths:    s.termMonths,
    interestRate:  s.interestRate,
    includeInDscr: s.includeInDscr ?? true,
    isActive:      s.isActive ?? false,
  }));

  const contingent: ContingentConsiderationInput[] = ccs.map(c => ({
    maximumAmount:      c.maximumAmount,
    termMonths:         c.termMonths,
    triggerDescription: c.triggerDescription,
    includeInDscr:      c.includeInDscr ?? false,
    isActive:           c.isActive ?? false,
  }));

  const modelInput: DealModelInput = {
    averagingYears:           dm.averagingYears ?? 3,
    ebitdaMultiple:           dm.ebitdaMultiple ?? '3.0',
    plusExcessCash:           dm.plusExcessCash ?? '0',
    minusPrimaryDebt:         dm.minusPrimaryDebt ?? '0',
    minusOtherDebt:           dm.minusOtherDebt ?? '0',
    minusCorpTaxDue:          dm.minusCorpTaxDue ?? '0',
    minusWorkingCapitalAdj:   dm.minusWorkingCapitalAdj ?? '0',
    plusPropertyValue:        dm.propertyValue ?? '0',
    otherAdjustments:         null,
    feeLegalDdAmount:         dm.feeLegalDdAmount ?? '0',
    feeAccountingDdAmount:    dm.feeAccountingDdAmount ?? '0',
    feeLoanArrangementAmount: dm.feeLoanArrangementAmount ?? '0',
    feeDealMakerAmount:       dm.feeDealMakerAmount ?? '0',
    customFees:               (dm.customFees as Array<{ label: string; amount: string | number }>) ?? [],
  };

  const calc = calculateFullDealModel(ebitdaByYear, adjustments, fundingLines, modelInput, sellerPayments, contingent);

  return {
    modelId:         dm.id,
    name:            dm.name ?? '(unnamed)',
    averagingYears:  dm.averagingYears ?? 3,
    multiple:        toNum(dm.ebitdaMultiple),
    avgAdjEbitda:    calc.averageAdjustedEbitda,
    enterpriseValue: calc.enterpriseValue,
  };
}

// ─── Issued offers ────────────────────────────────────────────────────────────

async function getIssuedOffers(prodTcId: number): Promise<IssuedOffer[]> {
  const { rows } = await prodPool.query(`
    SELECT id, document_type, status, sent_at, document_data
    FROM deal_documents
    WHERE target_company_id = $1
      AND document_type IN ('offer_letter', 'heads_of_terms')
      AND status != 'draft'
    ORDER BY id
  `, [prodTcId]);

  const parseCurrency = (v: unknown): number | null => {
    if (v == null) return null;
    const n = parseFloat(String(v).replace(/[£,\s]/g, ''));
    return isNaN(n) ? null : n;
  };

  const offers: IssuedOffer[] = [];
  for (const r of rows) {
    let data: Record<string, any> = {};
    if (r.document_data) {
      try { data = typeof r.document_data === 'string' ? JSON.parse(r.document_data) : r.document_data; }
      catch { /* ignore */ }
    }
    const ev    = data.enterpriseValue ?? data.enterprise_value ?? data.calculatedEV ?? null;
    const offer = data.offerPrice ?? data.offer_price ?? data.totalPurchasePrice ?? null;
    offers.push({
      docId:       r.id as number,
      docType:     r.document_type as string,
      frozenEV:    parseCurrency(ev),
      frozenOffer: parseCurrency(offer),
      sentAt:      r.sent_at ? String(r.sent_at) : null,
    });
  }

  // Also check current_offers table
  const { rows: cos } = await prodPool.query(`
    SELECT id, enterprise_value, offer_price, sent_at
    FROM current_offers
    WHERE target_company_id = $1
    ORDER BY id
  `, [prodTcId]).catch(() => ({ rows: [] }));

  for (const r of cos) {
    const ev    = parseCurrency(r.enterprise_value);
    const offer = parseCurrency(r.offer_price);
    if (ev != null || offer != null) {
      offers.push({
        docId:       r.id as number,
        docType:     'current_offer',
        frozenEV:    ev,
        frozenOffer: offer,
        sentAt:      r.sent_at ? String(r.sent_at) : null,
      });
    }
  }

  return offers;
}

// ─── Clone prod company → fresh dev company ───────────────────────────────────

async function cloneCompany(prodTcId: number, companyName: string): Promise<{
  devTcId: number;
  docMap: Map<number, number>;
  periodMap: Map<number, number>;
  dmMap: Map<number, number>;
}> {
  const devClient = await devPool.connect();
  try {
    await devClient.query('BEGIN');

    const { rows: [src] } = await prodPool.query('SELECT * FROM target_companies WHERE id = $1', [prodTcId]);
    const tcRow = {
      user_company_id:  DEV_USER_COMPANY_ID,
      company_name:     `[COMMS-ANALYSIS] ${companyName}`,
      industry:         src.industry,
      sub_sector:       src.sub_sector,
      website:          src.website,
      phone:            src.phone,
      email:            src.email,
      address:          src.address,
      annual_revenue:   src.annual_revenue,
      employee_count:   src.employee_count,
      year_established: src.year_established,
      description:      src.description,
      stage:            src.stage,
      is_archived:      false,
      created_by:       DEV_USER_ID,
    };
    const devTcId = await insertOne(devClient, 'target_companies', tcRow);

    // documents
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

    // financial_periods — prod does NOT have source_tier; derive from period_type
    const { rows: prodPeriods } = await prodPool.query('SELECT * FROM financial_periods WHERE target_company_id = $1 ORDER BY id', [prodTcId]);
    const periodMap = new Map<number, number>();
    for (const p of prodPeriods) {
      const derivedTier = p.period_type === 'statutory' ? 'statutory' : 'management';
      const id = await insertOne(devClient, 'financial_periods', {
        target_company_id:  devTcId,
        period_type:        p.period_type,
        period_start:       p.period_start,
        period_end:         p.period_end,
        fiscal_year:        p.fiscal_year,
        period_label:       p.period_label,
        months_covered:     p.months_covered,
        is_full_year:       p.is_full_year,
        source_tier:        derivedTier,
        source_document_id: remapSoft(p.source_document_id as number, docMap),
      });
      periodMap.set(p.id as number, id);
    }

    // income_statements
    const { rows: prodIS } = await prodPool.query('SELECT * FROM income_statements WHERE target_company_id = $1 ORDER BY id', [prodTcId]);
    for (const r of prodIS) {
      await insertOne(devClient, 'income_statements', {
        financial_period_id:        remap(r.financial_period_id as number, periodMap),
        target_company_id:          devTcId,
        revenue:                    r.revenue,
        cost_of_sales:              r.cost_of_sales,
        gross_profit:               r.gross_profit,
        administrative_expenses:    r.administrative_expenses,
        depreciation_amortisation:  r.depreciation_amortisation,
        other_operating_income:     r.other_operating_income,
        operating_profit:           r.operating_profit,
        interest_receivable:        r.interest_receivable,
        interest_payable:           r.interest_payable,
        profit_before_tax:          r.profit_before_tax,
        corporation_tax:            r.corporation_tax,
        net_profit:                 r.net_profit,
        staff_costs:                r.staff_costs,
        directors_remuneration:     r.directors_remuneration,
        dividends_paid:             r.dividends_paid,
        revenue_breakdown:          safeJson(r.revenue_breakdown),
        cost_of_sales_breakdown:    safeJson(r.cost_of_sales_breakdown),
        overheads_breakdown:        safeJson(r.overheads_breakdown),
        exceptional_items:          safeJson(r.exceptional_items),
        source_document_id:         remapSoft(r.source_document_id as number, docMap),
      });
    }

    // balance_sheets
    const { rows: prodBS } = await prodPool.query('SELECT * FROM balance_sheets WHERE target_company_id = $1 ORDER BY id', [prodTcId]);
    for (const r of prodBS) {
      await insertOne(devClient, 'balance_sheets', {
        financial_period_id:              remap(r.financial_period_id as number, periodMap),
        target_company_id:                devTcId,
        intangible_assets:                r.intangible_assets,
        tangible_fixed_assets:            r.tangible_fixed_assets,
        freehold_property:                r.freehold_property,
        leasehold_property:               r.leasehold_property,
        plant_machinery:                  r.plant_machinery,
        fixtures_fittings:                r.fixtures_fittings,
        motor_vehicles:                   r.motor_vehicles,
        computer_equipment:               r.computer_equipment,
        stock_inventory:                  r.stock_inventory,
        trade_debtors:                    r.trade_debtors,
        prepayments:                      r.prepayments,
        amounts_owed_by_directors:        r.amounts_owed_by_directors,
        amounts_owed_by_connected_companies: r.amounts_owed_by_connected_companies,
        directors_current_account:        r.directors_current_account,
        other_debtors:                    r.other_debtors,
        cash_at_bank:                     r.cash_at_bank,
        total_current_assets:             r.total_current_assets,
        trade_creditors:                  r.trade_creditors,
        taxation_social_security:         r.taxation_social_security,
        vat_payable:                      r.vat_payable,
        corporation_tax_due:              r.corporation_tax_due,
        bank_loans_overdraft_current:     r.bank_loans_overdraft_current,
        hire_purchase_current:            r.hire_purchase_current,
        accruals:                         r.accruals,
        amounts_owed_to_directors:        r.amounts_owed_to_directors,
        other_creditors:                  r.other_creditors,
        total_current_liabilities:        r.total_current_liabilities,
        bank_loans_long_term:             r.bank_loans_long_term,
        hire_purchase_long_term:          r.hire_purchase_long_term,
        deferred_taxation:                r.deferred_taxation,
        other_long_term_debt:             r.other_long_term_debt,
        total_long_term_liabilities:      r.total_long_term_liabilities,
        share_capital:                    r.share_capital,
        retained_earnings:                r.retained_earnings,
        total_equity:                     r.total_equity,
        debtors_list:                     safeJson(r.debtors_list),
        creditors_list:                   safeJson(r.creditors_list),
        fixed_assets_detail:              safeJson(r.fixed_assets_detail),
        source_document_id:               remapSoft(r.source_document_id as number, docMap),
      });
    }

    // staff_data
    const { rows: prodSD } = await prodPool.query('SELECT * FROM staff_data WHERE target_company_id = $1 ORDER BY id', [prodTcId]).catch(() => ({ rows: [] }));
    for (const r of prodSD) {
      await insertOne(devClient, 'staff_data', {
        financial_period_id:        remap(r.financial_period_id as number, periodMap),
        target_company_id:          devTcId,
        total_headcount:            r.total_headcount,
        total_staff_costs:          r.total_staff_costs,
        total_gross_salaries:       r.total_gross_salaries,
        total_employer_ni:          r.total_employer_ni,
        total_employer_pension:     r.total_employer_pension,
        director_count:             r.director_count,
        director_remuneration:      r.director_remuneration,
        working_director_count:     r.working_director_count,
        non_working_director_count: r.non_working_director_count,
        employee_count:             r.employee_count,
        employee_costs:             r.employee_costs,
        staff_records:              safeJson(r.staff_records),
        source_document_id:         remapSoft(r.source_document_id as number, docMap),
      });
    }

    // ebitda_adjustments
    const { rows: prodEA } = await prodPool.query('SELECT * FROM ebitda_adjustments WHERE target_company_id = $1 ORDER BY id', [prodTcId]).catch(() => ({ rows: [] }));
    for (const r of prodEA) {
      await insertOne(devClient, 'ebitda_adjustments', {
        financial_period_id: remap(r.financial_period_id as number, periodMap),
        target_company_id:   devTcId,
        description:         r.description,
        amount:              r.amount,
        category:            r.category,
        notes:               r.notes,
        created_by:          DEV_USER_ID,
      });
    }

    // deal_models
    const { rows: prodDMs } = await prodPool.query('SELECT * FROM deal_models WHERE target_company_id = $1 ORDER BY id', [prodTcId]);
    const dmMap = new Map<number, number>();
    for (const r of prodDMs) {
      const id = await insertOne(devClient, 'deal_models', {
        target_company_id:              devTcId,
        created_by:                     DEV_USER_ID,
        name:                           r.name,
        status:                         r.status,
        version:                        r.version,
        transaction_type:               r.transaction_type,
        parent_model_id:                null,
        is_locked:                      r.is_locked,
        averaging_years:                r.averaging_years,
        ebitda_multiple:                r.ebitda_multiple,
        multiple_low:                   r.multiple_low,
        multiple_high:                  r.multiple_high,
        property_value:                 r.property_value,
        cash_value:                     r.cash_value,
        other_assets:                   r.other_assets,
        calculated_ebitda:              r.calculated_ebitda,
        adjusted_ebitda:                r.adjusted_ebitda,
        enterprise_value:               r.enterprise_value,
        plus_excess_cash:               r.plus_excess_cash,
        minus_primary_debt:             r.minus_primary_debt,
        minus_other_debt:               r.minus_other_debt,
        minus_corp_tax_due:             r.minus_corp_tax_due,
        minus_working_capital_adj:      r.minus_working_capital_adj,
        working_capital_months:         r.working_capital_months,
        working_capital_monthly_amount: r.working_capital_monthly_amount,
        total_purchase_price:           r.total_purchase_price,
        total_funding_available:        r.total_funding_available,
        equity_required:                r.equity_required,
        upfront_cash:                   r.upfront_cash,
        deferred_amount:                r.deferred_amount,
        deferred_terms:                 r.deferred_terms,
        earnout_maximum:                r.earnout_maximum,
        earnout_metric:                 r.earnout_metric,
        earnout_period_months:          r.earnout_period_months,
        retention_escrow:               r.retention_escrow,
        fee_legal_dd_amount:            r.fee_legal_dd_amount,
        fee_accounting_dd_amount:       r.fee_accounting_dd_amount,
        fee_loan_arrangement_amount:    r.fee_loan_arrangement_amount,
        fee_deal_maker_amount:          r.fee_deal_maker_amount,
        custom_fees:                    safeJson(r.custom_fees),
        expert_data_snapshot:           safeJson(r.expert_data_snapshot),
        financial_data_snapshot:        safeJson(r.financial_data_snapshot),
        notes:                          r.notes,
      });
      dmMap.set(r.id as number, id);
    }

    // deal_model_adjustments
    const { rows: prodDMA } = await prodPool.query(`
      SELECT dma.* FROM deal_model_adjustments dma
      JOIN deal_models dm ON dm.id = dma.deal_model_id
      WHERE dm.target_company_id = $1 ORDER BY dma.id`, [prodTcId]);
    for (const r of prodDMA) {
      await insertOne(devClient, 'deal_model_adjustments', {
        deal_model_id:           remap(r.deal_model_id as number, dmMap),
        source_expert_result_id: null,
        adjustment_type:         r.adjustment_type,
        category:                r.category,
        description:             r.description,
        amount:                  r.amount,
        amounts_by_year:         safeJson(r.amounts_by_year),
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
      });
    }

    // deal_model_funding_lines
    const { rows: prodFLs } = await prodPool.query(`
      SELECT fl.* FROM deal_model_funding_lines fl
      JOIN deal_models dm ON dm.id = fl.deal_model_id
      WHERE dm.target_company_id = $1 ORDER BY fl.id`, [prodTcId]).catch(() => ({ rows: [] }));
    for (const r of prodFLs) {
      await insertOne(devClient, 'deal_model_funding_lines', {
        deal_model_id:           remap(r.deal_model_id as number, dmMap),
        funding_type:            r.funding_type,
        label:                   r.label,
        asset_base_value:        r.asset_base_value,
        ltv_percent:             r.ltv_percent,
        available_amount:        r.available_amount,
        amount_used:             r.amount_used,
        interest_rate:           r.interest_rate,
        arrangement_fee_percent: r.arrangement_fee_percent,
        term_months:             r.term_months,
        monthly_repayment:       r.monthly_repayment,
        is_debt:                 r.is_debt,
        repayment_structure:     r.repayment_structure,
        is_active:               r.is_active,
        notes:                   r.notes,
        sort_order:              r.sort_order,
      });
    }

    // deal_model_seller_payments
    const { rows: prodSPs } = await prodPool.query(`
      SELECT sp.* FROM deal_model_seller_payments sp
      JOIN deal_models dm ON dm.id = sp.deal_model_id
      WHERE dm.target_company_id = $1 ORDER BY sp.id`, [prodTcId]).catch(() => ({ rows: [] }));
    for (const r of prodSPs) {
      await insertOne(devClient, 'deal_model_seller_payments', {
        deal_model_id:   remap(r.deal_model_id as number, dmMap),
        payment_type:    r.payment_type,
        amount:          r.amount,
        term_months:     r.term_months,
        interest_rate:   r.interest_rate,
        label:           r.label,
        include_in_dscr: r.include_in_dscr,
        is_active:       r.is_active,
        sort_order:      r.sort_order,
      });
    }

    // deal_model_contingent_consideration
    const { rows: prodCCs } = await prodPool.query(`
      SELECT cc.* FROM deal_model_contingent_consideration cc
      JOIN deal_models dm ON dm.id = cc.deal_model_id
      WHERE dm.target_company_id = $1 ORDER BY cc.id`, [prodTcId]).catch(() => ({ rows: [] }));
    for (const r of prodCCs) {
      await insertOne(devClient, 'deal_model_contingent_consideration', {
        deal_model_id:       remap(r.deal_model_id as number, dmMap),
        consideration_type:  r.consideration_type,
        maximum_amount:      r.maximum_amount,
        term_months:         r.term_months,
        trigger_description: r.trigger_description,
        include_in_dscr:     r.include_in_dscr,
        is_active:           r.is_active,
        sort_order:          r.sort_order,
      });
    }

    await devClient.query('COMMIT');
    return { devTcId, docMap, periodMap, dmMap };

  } catch (err) {
    await devClient.query('ROLLBACK');
    throw err;
  } finally {
    devClient.release();
  }
}

// ─── Backfill contributions on dev clone ──────────────────────────────────────

async function backfillContributions(devTcId: number): Promise<void> {
  await db.delete(financialContributions).where(eq(financialContributions.targetCompanyId, devTcId));

  // Income statements
  const incRows = await db.select().from(incomeStatements)
    .where(eq(incomeStatements.targetCompanyId, devTcId));

  for (const row of incRows) {
    const [period] = await db.select({
      fiscalYear:    financialPeriods.fiscalYear,
      periodType:    financialPeriods.periodType,
      isFullYear:    financialPeriods.isFullYear,
      monthsCovered: financialPeriods.monthsCovered,
      periodEnd:     financialPeriods.periodEnd,
    }).from(financialPeriods).where(eq(financialPeriods.id, row.financialPeriodId));

    let documentCategory: string | null = null;
    if (row.sourceDocumentId) {
      const [doc] = await db.select({ documentCategory: documents.documentCategory })
        .from(documents).where(eq(documents.id, row.sourceDocumentId));
      documentCategory = doc?.documentCategory ?? null;
    }

    const tier = resolveSourceTier(period?.periodType ?? '', documentCategory);
    const figures = {
      revenue:                  row.revenue,
      costOfSales:              row.costOfSales,
      grossProfit:              row.grossProfit,
      administrativeExpenses:   row.administrativeExpenses,
      depreciationAmortisation: row.depreciationAmortisation,
      otherOperatingIncome:     row.otherOperatingIncome,
      operatingProfit:          row.operatingProfit,
      interestReceivable:       row.interestReceivable,
      interestPayable:          row.interestPayable,
      profitBeforeTax:          row.profitBeforeTax,
      corporationTax:           row.corporationTax,
      netProfit:                row.netProfit,
      staffCosts:               row.staffCosts,
      directorsRemuneration:    row.directorsRemuneration,
      dividendsPaid:            row.dividendsPaid,
      revenueBreakdown:         row.revenueBreakdown,
      costOfSalesBreakdown:     row.costOfSalesBreakdown,
      overheadsBreakdown:       row.overheadsBreakdown,
      exceptionalItems:         row.exceptionalItems,
    };
    await db.insert(financialContributions).values({
      targetCompanyId:  devTcId,
      fiscalYear:       period?.fiscalYear ?? null,
      statementType:    'income',
      sourceDocumentId: row.sourceDocumentId ?? null,
      sourceTier:       tier,
      isFullYear:       period?.isFullYear ?? true,
      monthsCovered:    period?.monthsCovered ?? null,
      periodEnd:        period?.periodEnd ?? null,
      asAtDate:         null,
      figures,
    });
  }

  // Balance sheets
  const balRows = await db.select().from(balanceSheets)
    .where(eq(balanceSheets.targetCompanyId, devTcId));

  for (const row of balRows) {
    const [period] = await db.select({
      fiscalYear:    financialPeriods.fiscalYear,
      periodType:    financialPeriods.periodType,
      isFullYear:    financialPeriods.isFullYear,
      monthsCovered: financialPeriods.monthsCovered,
      periodEnd:     financialPeriods.periodEnd,
    }).from(financialPeriods).where(eq(financialPeriods.id, row.financialPeriodId));

    let documentCategory: string | null = null;
    if (row.sourceDocumentId) {
      const [doc] = await db.select({ documentCategory: documents.documentCategory })
        .from(documents).where(eq(documents.id, row.sourceDocumentId));
      documentCategory = doc?.documentCategory ?? null;
    }

    const tier = resolveSourceTier(period?.periodType ?? '', documentCategory);
    const figures = {
      intangibleAssets:                row.intangibleAssets,
      tangibleFixedAssets:             row.tangibleFixedAssets,
      freeholdProperty:                row.freeholdProperty,
      leaseholdProperty:               row.leaseholdProperty,
      plantMachinery:                  row.plantMachinery,
      fixturesFittings:                row.fixturesFittings,
      motorVehicles:                   row.motorVehicles,
      computerEquipment:               row.computerEquipment,
      stockInventory:                  row.stockInventory,
      tradeDebtors:                    row.tradeDebtors,
      prepayments:                     row.prepayments,
      amountsOwedByDirectors:          row.amountsOwedByDirectors,
      amountsOwedByConnectedCompanies: row.amountsOwedByConnectedCompanies,
      directorsCurrentAccount:         row.directorsCurrentAccount,
      otherDebtors:                    row.otherDebtors,
      cashAtBank:                      row.cashAtBank,
      totalCurrentAssets:              row.totalCurrentAssets,
      tradeCreditors:                  row.tradeCreditors,
      taxationSocialSecurity:          row.taxationSocialSecurity,
      vatPayable:                      row.vatPayable,
      corporationTaxDue:               row.corporationTaxDue,
      bankLoansOverdraftCurrent:       row.bankLoansOverdraftCurrent,
      hirePurchaseCurrent:             row.hirePurchaseCurrent,
      accruals:                        row.accruals,
      amountsOwedToDirectors:          row.amountsOwedToDirectors,
      otherCreditors:                  row.otherCreditors,
      totalCurrentLiabilities:         row.totalCurrentLiabilities,
      bankLoansLongTerm:               row.bankLoansLongTerm,
      hirePurchaseLongTerm:            row.hirePurchaseLongTerm,
      deferredTaxation:                row.deferredTaxation,
      otherLongTermDebt:               row.otherLongTermDebt,
      totalLongTermLiabilities:        row.totalLongTermLiabilities,
      shareCapital:                    row.shareCapital,
      retainedEarnings:                row.retainedEarnings,
      totalEquity:                     row.totalEquity,
      debtorsList:                     row.debtorsList,
      creditorsList:                   row.creditorsList,
      fixedAssetsDetail:               row.fixedAssetsDetail,
    };
    await db.insert(financialContributions).values({
      targetCompanyId:  devTcId,
      fiscalYear:       period?.fiscalYear ?? null,
      statementType:    'balance',
      sourceDocumentId: row.sourceDocumentId ?? null,
      sourceTier:       tier,
      isFullYear:       period?.isFullYear ?? true,
      monthsCovered:    period?.monthsCovered ?? null,
      periodEnd:        period?.periodEnd ?? null,
      asAtDate:         period?.periodEnd ?? null,
      figures,
    });
  }
}

// ─── Slice 18 patch — apply computeSpan with document filename ────────────────
//
// On prod, YTD income contributions have is_full_year=true because the period
// container was stamped with is_full_year=true by another (non-YTD) document.
// This patch re-runs computeSpan with the source document's filename as the
// ytdHintText, and flips is_full_year to false when the YTD pattern fires.
// Slice 19 in reselect then evicts the stale income from the full-year container.

async function applySlice18Patch(devTcId: number): Promise<number> {
  const contribs = await db.select({
    id:              financialContributions.id,
    periodEnd:       financialContributions.periodEnd,
    monthsCovered:   financialContributions.monthsCovered,
    isFullYear:      financialContributions.isFullYear,
    sourceDocumentId: financialContributions.sourceDocumentId,
  }).from(financialContributions)
    .where(and(
      eq(financialContributions.targetCompanyId, devTcId),
      eq(financialContributions.statementType, 'income'),
    ));

  let flipped = 0;
  for (const c of contribs) {
    if (!c.isFullYear) continue; // already part-year, nothing to check

    let docName: string | null = null;
    if (c.sourceDocumentId) {
      const [doc] = await db.select({ documentName: documents.documentName })
        .from(documents).where(eq(documents.id, c.sourceDocumentId)).limit(1);
      docName = doc?.documentName ?? null;
    }

    const { isFullYear: newFull } = computeSpan({
      periodEnd:    c.periodEnd,
      monthsCovered: c.monthsCovered,
      ytdHintText:  docName,
    });

    if (!newFull) {
      await db.update(financialContributions)
        .set({ isFullYear: false })
        .where(eq(financialContributions.id, c.id));
      flipped++;
    }
  }
  return flipped;
}

// ─── Cleanup dev clone ────────────────────────────────────────────────────────

async function cleanupDevClone(devTcId: number): Promise<void> {
  const devClient = await devPool.connect();
  try {
    await devClient.query('DELETE FROM financial_contributions WHERE target_company_id = $1', [devTcId]);
    await devClient.query('DELETE FROM ebitda_adjustments WHERE target_company_id = $1', [devTcId]);
    await devClient.query('DELETE FROM staff_data WHERE target_company_id = $1', [devTcId]);
    await devClient.query('DELETE FROM income_statements WHERE target_company_id = $1', [devTcId]);
    await devClient.query('DELETE FROM balance_sheets WHERE target_company_id = $1', [devTcId]);
    await devClient.query('DELETE FROM financial_periods WHERE target_company_id = $1', [devTcId]);
    await devClient.query('DELETE FROM deal_model_contingent_consideration WHERE deal_model_id IN (SELECT id FROM deal_models WHERE target_company_id = $1)', [devTcId]);
    await devClient.query('DELETE FROM deal_model_seller_payments WHERE deal_model_id IN (SELECT id FROM deal_models WHERE target_company_id = $1)', [devTcId]);
    await devClient.query('DELETE FROM deal_model_funding_lines WHERE deal_model_id IN (SELECT id FROM deal_models WHERE target_company_id = $1)', [devTcId]);
    await devClient.query('DELETE FROM deal_model_adjustments WHERE deal_model_id IN (SELECT id FROM deal_models WHERE target_company_id = $1)', [devTcId]);
    await devClient.query('DELETE FROM deal_models WHERE target_company_id = $1', [devTcId]);
    await devClient.query('DELETE FROM documents WHERE target_company_id = $1', [devTcId]);
    await devClient.query('DELETE FROM target_companies WHERE id = $1', [devTcId]);
  } finally {
    devClient.release();
  }
}

// ─── Materiality check ────────────────────────────────────────────────────────

function isMaterial(
  currentEbitda: EbitdaByYear,
  correctedEbitda: EbitdaByYear,
  currentDM: DealModelCalc | null,
  correctedDM: DealModelCalc | null,
  issuedOffers: IssuedOffer[],
  correctedEV: number | null,
): { material: boolean; whatMoved: string; direction: string; deltaEV: number | null } {
  const movements: string[] = [];
  let anyUp = false, anyDown = false;
  let deltaEV: number | null = null;

  const allYears = new Set([...Object.keys(currentEbitda), ...Object.keys(correctedEbitda)]);
  for (const year of allYears) {
    const cur  = currentEbitda[year]  ?? null;
    const corr = correctedEbitda[year] ?? null;
    if (cur == null || corr == null) {
      if (cur == null && corr != null) {
        movements.push(`FY${year} EBITDA appeared (→${fmt(corr)})`);
        anyUp = corr > 0; anyDown = corr < 0;
      } else if (cur != null && corr == null) {
        movements.push(`FY${year} EBITDA removed (was ${fmt(cur)})`);
        anyDown = true;
      }
      continue;
    }
    const delta = corr - cur;
    if (Math.abs(delta) < 0.01) continue;
    const rel = cur !== 0 ? Math.abs(delta) / Math.abs(cur) : 1;
    if (Math.abs(delta) >= MATERIAL_ABS || rel >= MATERIAL_PCT) {
      const sign = delta > 0 ? '↑' : '↓';
      movements.push(`FY${year} EBITDA ${sign} ${fmt(delta)} (${fmt(cur)}→${fmt(corr)})`);
      if (delta > 0) anyUp = true; else anyDown = true;
    }
  }

  if (currentDM && correctedDM) {
    const cur  = currentDM.enterpriseValue;
    const corr = correctedDM.enterpriseValue;
    const d    = corr - cur;
    deltaEV = d;
    const rel = cur !== 0 ? Math.abs(d) / Math.abs(cur) : 1;
    if (Math.abs(d) >= MATERIAL_ABS || rel >= MATERIAL_PCT) {
      const sign = d > 0 ? '↑' : '↓';
      movements.push(`EV ${sign} ${fmt(d)} (${fmt(cur)}→${fmt(corr)})`);
      if (d > 0) anyUp = true; else anyDown = true;
    }
  } else if (currentDM || correctedDM) {
    deltaEV = null;
  }

  if (issuedOffers.length > 0 && correctedEV != null) {
    for (const offer of issuedOffers) {
      if (offer.frozenEV != null) {
        const d = Math.abs(offer.frozenEV - correctedEV);
        if (d >= 0.01) {
          movements.push(`issued ${offer.docType} frozen EV ${fmt(offer.frozenEV)} ≠ corrected ${fmt(correctedEV)}`);
        }
      }
    }
  }

  const material =
    movements.length > 0 ||
    (issuedOffers.length > 0 && correctedEV != null &&
      issuedOffers.some(o => o.frozenEV != null && Math.abs(o.frozenEV - correctedEV!) >= 0.01));

  const direction = anyUp && anyDown ? 'mixed' : anyUp ? 'UP' : anyDown ? 'DOWN' : '—';
  const whatMoved = movements.length > 0 ? movements.join('; ') : 'no material change';

  return { material, whatMoved, direction, deltaEV };
}

// ─── Self-validation (Slice 19 leak checks) ───────────────────────────────────
//
// Runs three independent leak checks on the dev clone AFTER reselect:
//
//   CHECK 1: No fiscal_year > TODAY_YEAR appears in the corrected averaging window.
//
//   CHECK 2: For every fiscal year present in correctedEbitdaByYear, the best-tier
//            income contribution for that year has is_full_year=true.
//            (A part-year winner here means a YTD doc leaked into valuation.)
//
//   CHECK 3: No is_full_year=true income period has its income_statement sourced
//            from a document whose name matches the YTD pattern.
//            (Catches split-source contamination that Slice 19 should have cleared.)

const YTD_PAT = /(?<![a-zA-Z])YTD(?![a-zA-Z])|\byear[\s\-]?to[\s\-]?date\b|\binterim\b/i;
const TIER_RANK: Record<string, number> = { statutory: 0, management: 1, information_memorandum: 2 };

async function selfValidate(
  devTcId: number,
  correctedEbitdaByYear: EbitdaByYear,
): Promise<SelfValidationResult> {
  const leaks: string[] = [];

  // ── CHECK 1: no future fiscal year in averaging window ──────────────────────
  for (const year of Object.keys(correctedEbitdaByYear)) {
    if (Number(year) > TODAY_YEAR) {
      leaks.push(`CHECK1: FY${year} (>${TODAY_YEAR}) in averaging window`);
    }
  }

  // ── CHECK 2: winning income contribution is is_full_year=true for each year ─
  const incContribs = await db.select({
    fiscalYear:      financialContributions.fiscalYear,
    sourceTier:      financialContributions.sourceTier,
    isFullYear:      financialContributions.isFullYear,
    sourceDocumentId: financialContributions.sourceDocumentId,
  }).from(financialContributions)
    .where(and(
      eq(financialContributions.targetCompanyId, devTcId),
      eq(financialContributions.statementType, 'income'),
    ));

  for (const year of Object.keys(correctedEbitdaByYear)) {
    const fyNum      = Number(year);
    const yearConts  = incContribs.filter(c => c.fiscalYear === fyNum);
    if (yearConts.length === 0) continue;

    const sorted = [...yearConts].sort(
      (a, b) => (TIER_RANK[a.sourceTier ?? ''] ?? 99) - (TIER_RANK[b.sourceTier ?? ''] ?? 99),
    );
    const winner = sorted[0];
    if (winner && !winner.isFullYear) {
      // Fetch doc name for context
      let docName = '(unknown)';
      if (winner.sourceDocumentId) {
        const [d] = await db.select({ documentName: documents.documentName })
          .from(documents).where(eq(documents.id, winner.sourceDocumentId)).limit(1);
        docName = d?.documentName ?? docName;
      }
      leaks.push(`CHECK2: FY${year} income winner is part-year (is_full_year=false) doc="${docName}"`);
    }
  }

  // ── CHECK 3: no is_full_year=true IS period sourced from YTD document ───────
  const fullYearPeriods = await db.select({
    id:        financialPeriods.id,
    fiscalYear: financialPeriods.fiscalYear,
  }).from(financialPeriods)
    .where(and(
      eq(financialPeriods.targetCompanyId, devTcId),
      eq(financialPeriods.isFullYear, true),
    ));

  for (const period of fullYearPeriods) {
    const [isRow] = await db.select({ sourceDocumentId: incomeStatements.sourceDocumentId })
      .from(incomeStatements)
      .where(eq(incomeStatements.financialPeriodId, period.id))
      .limit(1);
    if (!isRow) continue;

    const docId = isRow.sourceDocumentId;
    if (!docId) continue;

    const [doc] = await db.select({ documentName: documents.documentName })
      .from(documents).where(eq(documents.id, docId)).limit(1);
    if (doc?.documentName && YTD_PAT.test(doc.documentName)) {
      leaks.push(`CHECK3: FY${period.fiscalYear} full-year IS still sourced from YTD doc "${doc.documentName}"`);
    }
  }

  return { pass: leaks.length === 0, leaks };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  await assertHosts();

  const affected = await identifyAffectedCompanies();
  if (affected.length === 0) {
    console.log('No affected companies found. Exiting.');
    return;
  }

  console.log(`\nSTEP 2 — Processing ${affected.length} companies`);
  console.log('  (clone → backfill → Slice 18 patch → reselect → measure → self-validate → cleanup)');
  console.log('─'.repeat(70));

  const results: CompanyResult[] = [];

  for (let i = 0; i < affected.length; i++) {
    const company = affected[i];
    console.log(`\n[${i + 1}/${affected.length}] prod tc=${company.tcId}  "${company.companyName}"  flags=[${company.flags.join(',')}]`);

    let devTcId: number | null = null;
    try {
      // a. Current state from prod
      const currentEbitdaByYear = await getProdEbitdaByYear(company.tcId);
      const issuedOffers        = await getIssuedOffers(company.tcId);
      const account             = await getAccountInfo(company.userCompanyId);

      // b. Clone prod → dev
      process.stdout.write(`    cloning...`);
      const { devTcId: newTcId } = await cloneCompany(company.tcId, company.companyName);
      devTcId = newTcId;
      process.stdout.write(` dev=${devTcId}\n`);

      // c. Backfill contributions
      process.stdout.write(`    backfilling contributions...`);
      await backfillContributions(devTcId);
      process.stdout.write(` done\n`);

      // d. Slice 18 patch — flip YTD income contributions to is_full_year=false
      process.stdout.write(`    applying Slice 18 patch (YTD detection)...`);
      const slice18Flipped = await applySlice18Patch(devTcId);
      process.stdout.write(` ${slice18Flipped} contrib(s) flipped\n`);

      // Current deal model — computed from CURRENT prod EBITDA using dev model structure
      const currentDealModel = await computeDealModel(devTcId, currentEbitdaByYear);

      // e. Reselect (Slices 17/18/19 live)
      process.stdout.write(`    reselecting (Slices 17/18/19)...`);
      await reselect(devTcId);
      process.stdout.write(` done\n`);

      // f. Corrected state
      const correctedEbitdaByYear = await getDevEbitdaByYear(devTcId);
      const correctedDealModel    = await computeDealModel(devTcId, correctedEbitdaByYear);

      // g. Measure delta + materiality
      const correctedEV = correctedDealModel?.enterpriseValue ?? null;
      const { material, whatMoved, direction, deltaEV } = isMaterial(
        currentEbitdaByYear, correctedEbitdaByYear,
        currentDealModel, correctedDealModel,
        issuedOffers, correctedEV,
      );

      const ebitdaChanged = JSON.stringify(currentEbitdaByYear) !== JSON.stringify(correctedEbitdaByYear);
      const evChanged = currentDealModel != null && correctedDealModel != null &&
        Math.abs(currentDealModel.enterpriseValue - correctedDealModel.enterpriseValue) >= 0.01;
      const offerAffected = issuedOffers.length > 0 && correctedEV != null &&
        issuedOffers.some(o => o.frozenEV != null && Math.abs(o.frozenEV - correctedEV!) >= 0.01);

      process.stdout.write(`    ${material ? '⚠  MATERIAL' : '✓  immaterial'} | ${direction} | EV delta=${deltaEV != null ? fmt(deltaEV) : 'n/a'}\n`);

      // i. Self-validate (all companies, not just material — cheap to run, informative)
      process.stdout.write(`    self-validating...`);
      const validation = await selfValidate(devTcId, correctedEbitdaByYear);
      process.stdout.write(` ${validation.pass ? 'clean' : `⚠ LEAK (${validation.leaks.length})`}\n`);
      if (!validation.pass) {
        for (const leak of validation.leaks) {
          process.stdout.write(`      ↳ ${leak}\n`);
        }
      }

      results.push({
        prodTcId:             company.tcId,
        companyName:          company.companyName,
        userCompanyId:        company.userCompanyId,
        flags:                company.flags,
        account,
        currentEbitdaByYear,
        correctedEbitdaByYear,
        currentDealModel,
        correctedDealModel,
        issuedOffers,
        ebitdaChanged,
        evChanged,
        offerAffected,
        material,
        whatMoved,
        direction,
        deltaEV,
        slice18Flipped,
        validation,
      });

      // j. Cleanup
      await cleanupDevClone(devTcId);
      devTcId = null;
      process.stdout.write(`    cleanup done\n`);

    } catch (err) {
      console.error(`    ❌ FAILED: ${(err as Error).message}`);
      if (devTcId != null) {
        try { await cleanupDevClone(devTcId); console.log(`    cleanup done (after error)`); }
        catch { console.error(`    WARNING: cleanup also failed for dev=${devTcId}`); }
      }
    }
  }

  // ─── STEP 3: Self-validation summary for ACTIVE+MATERIAL ────────────────────

  const activeMaterialResults = results.filter(r => r.account.isActive && r.material);
  console.log('\n\n' + '═'.repeat(100));
  console.log('STEP 3 — SELF-VALIDATION (ACTIVE+MATERIAL companies)');
  console.log('═'.repeat(100));

  if (activeMaterialResults.length === 0) {
    console.log('  No ACTIVE+MATERIAL companies to validate.');
  } else {
    for (const r of activeMaterialResults) {
      const label = r.validation.pass ? '✅ clean' : '❌ FLAG';
      console.log(`  tc=${r.prodTcId}  "${r.companyName}":  ${label}`);
      if (!r.validation.pass) {
        for (const leak of r.validation.leaks) {
          console.log(`     ↳ ${leak}`);
        }
      }
    }
  }

  const leakyActive = activeMaterialResults.filter(r => !r.validation.pass);
  if (leakyActive.length > 0) {
    console.log(`\n  ⚠  ${leakyActive.length} ACTIVE+MATERIAL company/ies have residual leaks — DO NOT EMAIL, fix first.`);
  } else if (activeMaterialResults.length > 0) {
    console.log(`\n  ✅ All ${activeMaterialResults.length} ACTIVE+MATERIAL companies passed leak checks.`);
  }

  // ─── STEP 4: Output table ────────────────────────────────────────────────────

  console.log('\n\n' + '═'.repeat(160));
  console.log('STEP 4 — FINAL TABLE  (Slices 17/18/19 live)');
  console.log('Sorted: ACTIVE+MATERIAL first | ACTIVE+IMMATERIAL | non-active');
  console.log('═'.repeat(160));

  const sorted = [...results].sort((a, b) => {
    const aScore = (a.account.isActive ? 2 : 0) + (a.material ? 1 : 0);
    const bScore = (b.account.isActive ? 2 : 0) + (b.material ? 1 : 0);
    if (bScore !== aScore) return bScore - aScore;
    return a.prodTcId - b.prodTcId;
  });

  const COL = {
    tcId:      6,
    company:   28,
    owner:     22,
    email:     34,
    status:    12,
    flags:     16,
    whatMoved: 50,
    currentEV: 14,
    corrEV:    14,
    dir:        6,
    mat:        8,
    offer:      8,
    leak:      10,
  };

  const row = (vals: string[]) => {
    const [tcId, company, owner, email, status, flags, whatMoved, curEV, corrEV, dir, mat, offer, leak] = vals;
    return [
      tcId.padEnd(COL.tcId),
      company.substring(0, COL.company - 1).padEnd(COL.company),
      owner.substring(0, COL.owner - 1).padEnd(COL.owner),
      email.substring(0, COL.email - 1).padEnd(COL.email),
      status.padEnd(COL.status),
      flags.substring(0, COL.flags - 1).padEnd(COL.flags),
      whatMoved.substring(0, COL.whatMoved - 1).padEnd(COL.whatMoved),
      curEV.padStart(COL.currentEV),
      corrEV.padStart(COL.corrEV),
      dir.padEnd(COL.dir),
      mat.padEnd(COL.mat),
      offer.padEnd(COL.offer),
      leak.padEnd(COL.leak),
    ].join(' | ');
  };

  const header = row(['TC', 'Company', 'Owner', 'Email', 'Status', 'Flags', 'What moved', 'Current EV', 'Corrected EV', 'Dir', 'Material', 'Offer?', 'Leak-check']);
  console.log(header);
  console.log('─'.repeat(header.length));

  let sectionLabel = '';
  for (const r of sorted) {
    const sectionKey = r.account.isActive
      ? (r.material ? 'ACTIVE+MATERIAL (EMAIL LIST)' : 'ACTIVE+IMMATERIAL')
      : 'NOT ACTIVE';
    if (sectionKey !== sectionLabel) {
      console.log(`\n  *** ${sectionKey} ***`);
      sectionLabel = sectionKey;
    }

    // Leak-check label: only meaningful for active+material; others marked n/a
    const leakLabel = (r.account.isActive && r.material)
      ? (r.validation.pass ? 'clean' : `FLAG(${r.validation.leaks.length})`)
      : 'n/a';

    console.log(row([
      String(r.prodTcId),
      r.companyName,
      r.account.ownerName,
      r.account.ownerEmail,
      r.account.status,
      r.flags.join(','),
      r.whatMoved,
      r.currentDealModel  ? fmt(r.currentDealModel.enterpriseValue)  : '(no model)',
      r.correctedDealModel ? fmt(r.correctedDealModel.enterpriseValue) : '(no model)',
      r.direction,
      r.material  ? 'YES' : 'no',
      r.issuedOffers.length > 0 ? (r.offerAffected ? 'YES ⚠' : 'yes') : 'none',
      leakLabel,
    ]));

    // Per-year EBITDA detail
    if (r.ebitdaChanged) {
      const curY  = Object.entries(r.currentEbitdaByYear).sort((a,b)=>a[0].localeCompare(b[0])).map(([y,v])=>`${y}:${fmt(v)}`).join('  ');
      const corrY = Object.entries(r.correctedEbitdaByYear).sort((a,b)=>a[0].localeCompare(b[0])).map(([y,v])=>`${y}:${fmt(v)}`).join('  ');
      console.log(`        CURRENT   EBITDA: ${curY  || '(none)'}`);
      console.log(`        CORRECTED EBITDA: ${corrY || '(none)'}`);
    }

    // Slice 18 flipped
    if (r.slice18Flipped > 0) {
      console.log(`        Slice18: ${r.slice18Flipped} income contribution(s) flipped to part-year`);
    }

    // Issued offers detail
    for (const offer of r.issuedOffers) {
      const corrEV = r.correctedDealModel?.enterpriseValue ?? null;
      const evNote = offer.frozenEV != null && corrEV != null
        ? (Math.abs(offer.frozenEV - corrEV) < 0.01 ? ' [MATCHES corrected]' : ` [DIFFERS from corrected ${fmt(corrEV)}]`)
        : '';
      console.log(`        issued ${offer.docType} (id=${offer.docId}, sent=${offer.sentAt ?? 'n/a'}): frozen EV=${fmt(offer.frozenEV)} offer=${fmt(offer.frozenOffer)}${evNote}`);
    }

    // Leak details inline
    if (r.account.isActive && r.material && !r.validation.pass) {
      for (const leak of r.validation.leaks) {
        console.log(`        ⚠ LEAK: ${leak}`);
      }
    }
  }

  console.log('\n' + '═'.repeat(160));

  // Summary counts
  const activeMaterial   = sorted.filter(r => r.account.isActive && r.material);
  const activeImmaterial = sorted.filter(r => r.account.isActive && !r.material);
  const inactive         = sorted.filter(r => !r.account.isActive);
  const offerAffected    = sorted.filter(r => r.offerAffected);
  const cleanForEmail    = activeMaterial.filter(r => r.validation.pass);
  const flagged          = activeMaterial.filter(r => !r.validation.pass);

  console.log(`\nSUMMARY`);
  console.log(`  Total affected companies processed: ${results.length}`);
  console.log(`  ACTIVE + MATERIAL (email candidates): ${activeMaterial.length}`);
  console.log(`    ✅ leak-check clean (safe to email): ${cleanForEmail.length}`);
  console.log(`    ❌ leak-check FLAG  (fix first):     ${flagged.length}`);
  console.log(`  ACTIVE + IMMATERIAL (quiet fix):      ${activeImmaterial.length}`);
  console.log(`  NOT ACTIVE (quiet fix):               ${inactive.length}`);
  console.log(`  Issued offer/HoT affected:            ${offerAffected.length}`);

  if (cleanForEmail.length > 0) {
    console.log(`\n  EMAIL LIST (clean, active, material):`);
    for (const r of cleanForEmail) {
      const curEV  = r.currentDealModel  ? fmt(r.currentDealModel.enterpriseValue)  : 'n/a';
      const corrEV = r.correctedDealModel ? fmt(r.correctedDealModel.enterpriseValue) : 'n/a';
      console.log(`    tc=${r.prodTcId}  ${r.companyName.padEnd(35)} ${r.account.ownerEmail.padEnd(40)} [${r.account.status}]  ${r.direction}  EV ${curEV}→${corrEV}  ${r.whatMoved.substring(0, 70)}`);
    }
  }

  if (flagged.length > 0) {
    console.log(`\n  FLAGGED (do NOT email — residual leaks):`);
    for (const r of flagged) {
      console.log(`    tc=${r.prodTcId}  ${r.companyName}`);
      for (const leak of r.validation.leaks) {
        console.log(`      ↳ ${leak}`);
      }
    }
  }
}

main()
  .catch(err => { console.error('Fatal:', err); process.exit(1); })
  .finally(async () => {
    await prodPool.end();
    await devPool.end();
    await devDrizzlePool.end();
  });
