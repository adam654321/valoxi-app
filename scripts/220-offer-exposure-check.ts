import pg from 'pg';
const { Pool } = pg;

// READ-ONLY script — SELECT + in-memory calculation only.
// No INSERT/UPDATE/DELETE/ALTER/DDL. No recalculate(). No .update().

import { calculateFullDealModel, toNum } from '../shared/calculators/deal-model.calc';
import type {
  AdjustmentInput,
  FundingLineInput,
  SellerPaymentInput,
  ContingentConsiderationInput,
  DealModelInput,
} from '../shared/calculators/deal-model.calc';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fetchReportedEbitdaByYear(
  client: pg.PoolClient,
  targetCompanyId: number
): Promise<Record<string, number>> {
  const res = await client.query(`
    SELECT fp.fiscal_year, fp.period_end, ist.operating_profit, ist.depreciation_amortisation
    FROM income_statements ist
    JOIN financial_periods fp ON ist.financial_period_id = fp.id
    WHERE ist.target_company_id = $1
    ORDER BY fp.period_end DESC
  `, [targetCompanyId]);
  const result: Record<string, number> = {};
  for (const row of res.rows) {
    const year = row.fiscal_year?.toString()
      || (row.period_end ? new Date(row.period_end).getFullYear().toString() : null);
    if (!year) continue;
    result[year] = toNum(row.operating_profit) + toNum(row.depreciation_amortisation);
  }
  return result;
}

function buildModelInput(model: any): DealModelInput {
  return {
    averagingYears: model.averaging_years ?? 3,
    ebitdaMultiple: model.ebitda_multiple ?? '3.0',
    plusExcessCash: model.cash_value ?? '0',
    minusPrimaryDebt: model.minus_primary_debt ?? '0',
    minusOtherDebt: model.minus_other_debt ?? '0',
    minusCorpTaxDue: model.minus_corp_tax_due ?? '0',
    minusWorkingCapitalAdj: model.minus_working_capital_adj ?? '0',
    plusPropertyValue: model.property_value ?? '0',
    otherAdjustments: null,
    feeLegalDdAmount: model.fee_legal_dd_amount ?? '0',
    feeAccountingDdAmount: model.fee_accounting_dd_amount ?? '0',
    feeLoanArrangementAmount: model.fee_loan_arrangement_amount ?? '0',
    feeDealMakerAmount: model.fee_deal_maker_amount ?? '0',
    customFees: (model.custom_fees as Array<{ label: string; amount: string | number }>) ?? [],
  };
}

async function computeOfferPrice(client: pg.PoolClient, model: any): Promise<number> {
  const [adjRes, flRes, spRes, ccRes] = await Promise.all([
    client.query(`SELECT * FROM deal_model_adjustments WHERE deal_model_id = $1`, [model.id]),
    client.query(`SELECT * FROM deal_model_funding_lines WHERE deal_model_id = $1`, [model.id]),
    client.query(`SELECT * FROM deal_model_seller_payments WHERE deal_model_id = $1`, [model.id]),
    client.query(`SELECT * FROM deal_model_contingent_consideration WHERE deal_model_id = $1`, [model.id]),
  ]);

  const reportedEbitda = await fetchReportedEbitdaByYear(client, model.target_company_id);

  const adjustments: AdjustmentInput[] = adjRes.rows.map(a => ({
    adjustmentType: a.adjustment_type as 'add_back' | 'deduction',
    amount: a.amount,
    amountsByYear: a.amounts_by_year as Record<string, number> | null,
    status: a.status || 'suggested',
    userOverrideAmount: null,
  }));

  const fundingLines: FundingLineInput[] = flRes.rows
    .filter((f: any) => f.funding_type !== 'seller_financing' && f.funding_type !== 'earnout')
    .map((f: any) => ({
      fundingType: f.funding_type,
      assetBaseValue: f.asset_base_value,
      ltvPercent: f.ltv_percent,
      amountUsed: f.amount_used,
      interestRate: f.interest_rate,
      termMonths: f.term_months,
      arrangementFeePercent: f.arrangement_fee_percent ?? null,
      isDebt: f.is_debt ?? false,
      repaymentStructure: f.repayment_structure ?? 'amortizing',
      isActive: f.is_active ?? false,
    }));

  const sellerPayments: SellerPaymentInput[] = spRes.rows.map((s: any) => ({
    amount: s.amount,
    termMonths: s.term_months,
    interestRate: s.interest_rate,
    includeInDscr: s.include_in_dscr ?? true,
    isActive: s.is_active ?? false,
  }));

  const contingentConsideration: ContingentConsiderationInput[] = ccRes.rows.map((c: any) => ({
    maximumAmount: c.maximum_amount,
    termMonths: c.term_months,
    interestRate: c.interest_rate,
    includeInDscr: c.include_in_dscr ?? true,
    isActive: c.is_active ?? false,
  }));

  const result = calculateFullDealModel(
    reportedEbitda, adjustments, fundingLines, buildModelInput(model),
    sellerPayments, contingentConsideration
  );
  return result.offerPrice;
}

function fmt(n: number | null | undefined): string {
  if (n == null) return 'NULL';
  return `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function isTestAccount(companyName: string, lastNames: string[]): boolean {
  const testPatterns = ['test', 'team test', 'acme', 'vivster', 'goodwin', 'batman', 'demo', 'sample'];
  const nameLower = companyName.toLowerCase();
  if (testPatterns.some(p => nameLower.includes(p))) return true;
  if (lastNames.some(n => ['david', 'test'].includes(n.toLowerCase()))) return true;
  return false;
}

async function main() {
  const client = await pool.connect();
  try {
    // Identity guard
    const guard = await client.query(
      `SELECT last_name FROM users WHERE last_name IN ('Coxon','David') LIMIT 3`
    );
    const names = guard.rows.map((r: any) => r.last_name);
    const env = names.includes('Coxon') ? 'PROD' : names.includes('David') ? 'DEV' : 'UNKNOWN';
    console.log(`\n=== IDENTITY GUARD: [${names.join(', ')}] — branch = ${env} ===`);

    // ── Load all unlocked models ──────────────────────────────────────────────
    const allModelsRes = await client.query(`
      SELECT dm.id, dm.name, dm.target_company_id,
             tc.user_company_id,
             dm.total_purchase_price, dm.is_locked, dm.updated_at,
             tc.company_name
      FROM deal_models dm
      JOIN target_companies tc ON tc.id = dm.target_company_id
      WHERE dm.is_locked = false
      ORDER BY dm.id
    `);
    const allModels = allModelsRes.rows;

    console.log(`\n=== STEP 1: Computing fresh offerPrice for ${allModels.length} unlocked models ===`);
    console.log(`  (This may take a moment — running in-memory calc for each model...)`);

    const THRESHOLD = 1;
    const divergent: Array<{
      model: any;
      stored: number | null;
      fresh: number;
      absDiff: number;
      pctDiff: number;
    }> = [];

    for (const model of allModels) {
      const fresh = await computeOfferPrice(client, model);
      const stored = model.total_purchase_price != null ? Number(model.total_purchase_price) : null;
      const absDiff = stored != null ? Math.abs(stored - fresh) : Math.abs(fresh);
      if (absDiff > THRESHOLD) {
        const pctDiff = stored != null && fresh !== 0
          ? (Math.abs(stored - fresh) / Math.abs(fresh)) * 100 : 0;
        divergent.push({ model, stored, fresh, absDiff, pctDiff });
      }
    }

    console.log(`  Divergent unlocked models (diff > £1): ${divergent.length}`);

    // ── Owner info & test flag ────────────────────────────────────────────────
    console.log(`\n=== STEP 2: Owner & test-account classification ===`);

    const ownerCache = new Map<number, { companyName: string; lastNames: string[] }>();

    for (const d of divergent) {
      const ucId: number = d.model.user_company_id;
      if (!ownerCache.has(ucId)) {
        const ucRes = await client.query(
          `SELECT uc.company_name, array_agg(u.last_name) AS last_names
           FROM user_companies uc
           LEFT JOIN users u ON u.user_company_id = uc.id
           WHERE uc.id = $1
           GROUP BY uc.id, uc.company_name`, [ucId]
        );
        const row = ucRes.rows[0];
        ownerCache.set(ucId, {
          companyName: row?.company_name ?? '(unknown)',
          lastNames: (row?.last_names ?? []).filter(Boolean),
        });
      }
      const owner = ownerCache.get(ucId)!;
      const testFlag = isTestAccount(owner.companyName, owner.lastNames)
        || isTestAccount(d.model.company_name, [])
        ? 'LIKELY_TEST' : 'REAL';
      (d as any).ownerCompanyName = owner.companyName;
      (d as any).ownerLastNames  = owner.lastNames;
      (d as any).testFlag        = testFlag;
    }

    // print table
    console.log(`\n  ${'ID'.padEnd(6)} ${'Target Company'.padEnd(40)} ${'Owner Account'.padEnd(30)} ${'Flag'.padEnd(12)} ${'Stored'.padEnd(16)} ${'Fresh'.padEnd(16)} ${'Diff%'.padEnd(10)} updatedAt`);
    console.log(`  ${'─'.repeat(150)}`);
    for (const d of divergent) {
      const co = d.model.company_name.substring(0, 38).padEnd(40);
      const ow = ((d as any).ownerCompanyName as string).substring(0, 28).padEnd(30);
      const fl = ((d as any).testFlag as string).padEnd(12);
      const st = (d.stored != null ? fmt(d.stored) : 'NULL').padEnd(16);
      const fr = fmt(d.fresh).padEnd(16);
      const pc = `${d.pctDiff.toFixed(1)}%`.padEnd(10);
      const upd = d.model.updated_at ? new Date(d.model.updated_at).toISOString().split('T')[0] : 'NULL';
      console.log(`  ${String(d.model.id).padEnd(6)} ${co} ${ow} ${fl} ${st} ${fr} ${pc} ${upd}`);
    }

    // ── Offer exposure ────────────────────────────────────────────────────────
    console.log(`\n=== STEP 3: Offer exposure per divergent model ===`);

    const modelsWithSentDoc: number[]  = [];
    const modelsWithOffer:   number[]  = [];
    const modelsWithResponse:number[]  = [];

    for (const d of divergent) {
      const mid = d.model.id;

      // sent deal_documents
      const sentDocsRes = await client.query(`
        SELECT id, document_type, status, sent_at, responded_at
        FROM deal_documents
        WHERE deal_model_id = $1 AND sent_at IS NOT NULL
        ORDER BY sent_at DESC
      `, [mid]);

      // all docs for response join
      const allDocsRes = await client.query(`
        SELECT id FROM deal_documents WHERE deal_model_id = $1`, [mid]);
      const docIds = allDocsRes.rows.map((r: any) => r.id);

      let responseCount = 0;
      if (docIds.length > 0) {
        const respRes = await client.query(
          `SELECT COUNT(*)::int AS cnt FROM deal_document_responses WHERE deal_document_id = ANY($1)`,
          [docIds]
        );
        responseCount = respRes.rows[0]?.cnt ?? 0;
      }

      // current_offers — match by deal_model_id OR via deal_document_id link
      const offersRes = await client.query(`
        SELECT co.id, co.offer_price, co.enterprise_value, co.status,
               co.sent_at, co.accepted_at, co.accepted_by, co.deal_model_id, co.deal_document_id
        FROM current_offers co
        WHERE co.deal_model_id = $1
           OR co.deal_document_id IN (
             SELECT id FROM deal_documents WHERE deal_model_id = $1
           )
        ORDER BY co.sent_at DESC
      `, [mid]);

      const hasSentDoc  = sentDocsRes.rows.length > 0;
      const hasOffer    = offersRes.rows.length > 0;
      const hasResponse = responseCount > 0;

      if (hasSentDoc)  modelsWithSentDoc.push(mid);
      if (hasOffer)    modelsWithOffer.push(mid);
      if (hasResponse) modelsWithResponse.push(mid);

      // Only print detail if there's actual exposure
      if (hasSentDoc || hasOffer || hasResponse) {
        console.log(`\n  ── Model ${mid} (${d.model.company_name}) — EXPOSURE FOUND ──`);
        console.log(`  testFlag: ${(d as any).testFlag}  |  owner: ${(d as any).ownerCompanyName}`);

        if (hasSentDoc) {
          console.log(`  Sent deal_documents (${sentDocsRes.rows.length}):`);
          for (const doc of sentDocsRes.rows) {
            console.log(`    docId=${doc.id}  type=${doc.document_type}  status=${doc.status}  sent_at=${doc.sent_at?.toISOString() ?? 'null'}  responded_at=${doc.responded_at?.toISOString() ?? 'null'}`);
          }
        } else {
          console.log(`  No sent deal_documents.`);
        }

        if (hasResponse) {
          console.log(`  Seller responses: ${responseCount}`);
        } else {
          console.log(`  Seller responses: 0`);
        }

        if (hasOffer) {
          console.log(`  current_offers rows (${offersRes.rows.length}):`);
          for (const off of offersRes.rows) {
            const frozenPrice = off.offer_price != null ? Number(off.offer_price) : null;
            const frozenEV    = off.enterprise_value != null ? Number(off.enterprise_value) : null;
            console.log(`    offerId=${off.id}  status=${off.status}`);
            console.log(`      sent_at=${off.sent_at?.toISOString() ?? 'null'}  accepted_at=${off.accepted_at?.toISOString() ?? 'null'}  accepted_by=${off.accepted_by ?? 'null'}`);
            console.log(`      frozen offer_price:    ${frozenPrice != null ? fmt(frozenPrice) : 'NULL'}`);
            console.log(`      frozen enterprise_value: ${frozenEV != null ? fmt(frozenEV) : 'NULL'}`);
            console.log(`      stored total_purchase_price (model): ${d.stored != null ? fmt(d.stored) : 'NULL'}`);
            console.log(`      fresh  offerPrice (runtime):         ${fmt(d.fresh)}`);
            if (frozenPrice != null && d.stored != null) {
              const frozenVsStored = Math.abs(frozenPrice - d.stored);
              const frozenVsFresh  = Math.abs(frozenPrice - d.fresh);
              console.log(`      frozen vs stored diff: ${fmt(frozenVsStored)} (${d.stored !== 0 ? ((frozenVsStored / Math.abs(d.stored)) * 100).toFixed(2) : '∞'}%)`);
              console.log(`      frozen vs fresh diff:  ${fmt(frozenVsFresh)}  (${d.fresh !== 0 ? ((frozenVsFresh / Math.abs(d.fresh)) * 100).toFixed(2) : '∞'}%)`);
            }
          }
        } else {
          console.log(`  No current_offers rows.`);
        }
      }
    }

    // models with no exposure — print briefly
    const noExposure = divergent.filter(d => !modelsWithSentDoc.includes(d.model.id) && !modelsWithOffer.includes(d.model.id) && !modelsWithResponse.includes(d.model.id));
    if (noExposure.length > 0) {
      console.log(`\n  Models with NO sent document, offer, or response (${noExposure.length}):`);
      console.log(`    IDs: ${noExposure.map(d => d.model.id).join(', ')}`);
    }

    // ── Summary ───────────────────────────────────────────────────────────────
    const realModels     = divergent.filter(d => (d as any).testFlag === 'REAL');
    const testModels     = divergent.filter(d => (d as any).testFlag === 'LIKELY_TEST');
    const backedByOffer  = divergent.filter(d => modelsWithSentDoc.includes(d.model.id) || modelsWithOffer.includes(d.model.id));

    console.log(`\n${'═'.repeat(70)}`);
    console.log(`=== STEP 4: SUMMARY ===`);
    console.log(`  Total divergent unlocked models:    ${divergent.length}`);
    console.log(`  LIKELY_TEST:                        ${testModels.length}`);
    console.log(`  REAL (non-test owner):              ${realModels.length}`);
    console.log(`  Have ANY sent document (sent_at):   ${modelsWithSentDoc.length}  — IDs: ${modelsWithSentDoc.length ? modelsWithSentDoc.join(', ') : 'none'}`);
    console.log(`  Have a current_offers row:          ${modelsWithOffer.length}  — IDs: ${modelsWithOffer.length ? modelsWithOffer.join(', ') : 'none'}`);
    console.log(`  Have a seller response:             ${modelsWithResponse.length}  — IDs: ${modelsWithResponse.length ? modelsWithResponse.join(', ') : 'none'}`);
    console.log(``);
    if (backedByOffer.length === 0) {
      console.log(`  *** HEADLINE: NO divergent model has a sent offer or seller response. ***`);
      console.log(`      The stored offer-price staleness is entirely in unsent / draft models.`);
      console.log(`      Document generation already uses a live recompute (confirmed in Part 2.2).`);
      console.log(`      No seller was ever shown a stale figure from these divergent models.`);
    } else {
      console.log(`  *** HEADLINE: ${backedByOffer.length} divergent model(s) backed a real sent offer. ***`);
      console.log(`      Model IDs: ${backedByOffer.map(d => d.model.id).join(', ')}`);
      console.log(`      Review the frozen offer_price vs fresh above for each.`);
    }
    console.log(`${'═'.repeat(70)}`);

    console.log(`\n=== WRITE-SAFETY CONFIRMATION ===`);
    console.log(`  SELECT + in-memory only. No INSERT/UPDATE/DELETE/ALTER/DDL.`);
    console.log(`  recalculate() and .update() were NOT called.`);

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Script error:', err);
  process.exit(1);
});
