/**
 * scripts/replay-balance-sheets.ts
 *
 * Dry-run by default.  Pass --execute to write to DB.
 * Pass --company <id> to restrict to one target company.
 *
 * Scope: DARs of type balance_sheet or company_accounts whose stored years
 * contain ≥2 non-null six-field BS values for a fiscal year whose current
 * balance_sheets row fails the two-of-six usability rule or is absent.
 *
 * Execute order: oldest-first per company so newer docs win field conflicts.
 */

import { db } from '../server/db';
import { documentAnalysisResults, documents, balanceSheets, financialPeriods } from '../shared/schema';
import { eq, or, inArray } from 'drizzle-orm';
import { financialDataService } from '../server/services/financial-data.service';

const DRY_RUN = !process.argv.includes('--execute');
const companyArgIdx = process.argv.indexOf('--company');
const COMPANY_FILTER = companyArgIdx !== -1 ? parseInt(process.argv[companyArgIdx + 1], 10) : null;

const SIX_FIELDS = ['cashAtBank', 'tradeDebtors', 'tradeCreditors', 'totalCurrentAssets', 'totalCurrentLiabilities', 'totalEquity'] as const;

function isUsable(bs: Record<string, any> | null | undefined): boolean {
  if (!bs) return false;
  return SIX_FIELDS.filter(f => bs[f] != null).length >= 2;
}

function extractJsonSixValues(yearData: any): Record<string, number | null> {
  const ca = yearData?.balance_sheet?.current_assets ?? {};
  const cl = yearData?.balance_sheet?.current_liabilities ?? {};
  const eq_ = yearData?.balance_sheet?.equity ?? {};
  return {
    cashAtBank:            ca.cash_at_bank ?? ca.cash ?? null,
    tradeDebtors:          ca.trade_debtors ?? null,
    tradeCreditors:        cl.trade_creditors ?? null,
    totalCurrentAssets:    ca.total ?? null,
    totalCurrentLiabilities: cl.total ?? null,
    totalEquity:           eq_.total ?? null,
  };
}

function isJsonUsable(yearData: any): boolean {
  const vals = extractJsonSixValues(yearData);
  return Object.values(vals).filter(v => v != null).length >= 2;
}

async function main(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL ?? '';
  const hostMatch = dbUrl.match(/@([^/?]+)/);
  const dbHost = hostMatch ? hostMatch[1] : '(unknown)';

  console.log(`Mode    : ${DRY_RUN ? 'DRY-RUN (pass --execute to write)' : 'EXECUTE'}`);
  console.log(`DB host : ${dbHost}`);
  if (COMPANY_FILTER != null) console.log(`Company : ${COMPANY_FILTER}`);
  console.log('');

  // ── 1. Fetch all in-scope DARs ──────────────────────────────────────────
  const darRows = await db
    .select({
      id: documentAnalysisResults.id,
      documentId: documentAnalysisResults.documentId,
      documentType: documentAnalysisResults.documentType,
      analysisData: documentAnalysisResults.analysisData,
      createdAt: documentAnalysisResults.createdAt,
    })
    .from(documentAnalysisResults)
    .where(
      or(
        eq(documentAnalysisResults.documentType, 'balance_sheet'),
        eq(documentAnalysisResults.documentType, 'company_accounts'),
      )
    )
    .orderBy(documentAnalysisResults.createdAt);

  if (darRows.length === 0) {
    console.log('No balance_sheet or company_accounts DARs found.');
    process.exit(0);
  }

  // ── 2. Join with documents ──────────────────────────────────────────────
  const docIds = [...new Set(darRows.map(r => r.documentId))];
  const docRows = await db
    .select({
      id: documents.id,
      targetCompanyId: documents.targetCompanyId,
      originalFilename: documents.originalFilename,
      documentCategory: documents.documentCategory,
    })
    .from(documents)
    .where(inArray(documents.id, docIds));

  const docMap = new Map(docRows.map(d => [d.id, d]));

  // ── 3. Snapshot current BS state ────────────────────────────────────────
  const periodRows = await db.select().from(financialPeriods);
  const bsRows = await db
    .select({
      id: balanceSheets.id,
      financialPeriodId: balanceSheets.financialPeriodId,
      targetCompanyId: balanceSheets.targetCompanyId,
      cashAtBank: balanceSheets.cashAtBank,
      tradeDebtors: balanceSheets.tradeDebtors,
      tradeCreditors: balanceSheets.tradeCreditors,
      totalCurrentAssets: balanceSheets.totalCurrentAssets,
      totalCurrentLiabilities: balanceSheets.totalCurrentLiabilities,
      totalEquity: balanceSheets.totalEquity,
    })
    .from(balanceSheets);

  // Best BS per (targetCompanyId, fiscalYear): prefer usable > hollow > none
  const bsKey = (tcId: number, fy: number) => `${tcId}:${fy}`;
  const bestBs = new Map<string, { period: typeof periodRows[0]; bs: typeof bsRows[0] | null }>();
  for (const period of periodRows) {
    const fy = period.fiscalYear;
    if (fy == null) continue;
    const k = bsKey(period.targetCompanyId, fy);
    const bs = bsRows.find(b => b.financialPeriodId === period.id) ?? null;
    const existing = bestBs.get(k);
    const rank = (b: typeof bs) => isUsable(b as any) ? 2 : b ? 1 : 0;
    if (!existing || rank(bs) > rank(existing.bs)) {
      bestBs.set(k, { period, bs });
    }
  }

  // ── 4. Determine scope ───────────────────────────────────────────────────
  type ScopedDar = {
    darId: number;
    documentId: number;
    documentType: string;
    analysisData: any;
    targetCompanyId: number;
    docName: string;
    documentCategory: string;
    createdAt: Date | null;
    scopedYears: number[];
  };

  const scoped: ScopedDar[] = [];

  for (const dar of darRows) {
    const doc = docMap.get(dar.documentId);
    if (!doc) continue;
    if (COMPANY_FILTER != null && doc.targetCompanyId !== COMPANY_FILTER) continue;

    const ad = dar.analysisData as any;
    const years: Record<string, any> = ad?.years ?? {};
    const yearKeys = Object.keys(years);
    if (yearKeys.length === 0) continue;

    const scopedYears: number[] = [];
    for (const yk of yearKeys) {
      const year = parseInt(yk, 10);
      if (isNaN(year)) continue;
      const yearData = years[yk];
      if (!isJsonUsable(yearData)) continue;
      const k = bsKey(doc.targetCompanyId, year);
      const current = bestBs.get(k);
      if (!current || !isUsable(current.bs as any)) {
        scopedYears.push(year);
      }
    }

    if (scopedYears.length === 0) continue;

    scoped.push({
      darId: dar.id,
      documentId: dar.documentId,
      documentType: dar.documentType,
      analysisData: ad,
      targetCompanyId: doc.targetCompanyId,
      docName: doc.originalFilename,
      documentCategory: doc.documentCategory,
      createdAt: dar.createdAt,
      scopedYears,
    });
  }

  if (scoped.length === 0) {
    console.log('All fiscal years already have usable balance sheets. Nothing to replay.');
    process.exit(0);
  }

  const companies = new Set(scoped.map(d => d.targetCompanyId));
  console.log(`Found ${scoped.length} in-scope DAR(s) across ${companies.size} company(ies).\n`);

  // ── 5a. DRY-RUN: print comparison ───────────────────────────────────────
  if (DRY_RUN) {
    for (const dar of scoped) {
      console.log(`DAR ${dar.darId} | doc ${dar.documentId} "${dar.docName}" | tc ${dar.targetCompanyId} | ${dar.documentType} | ${dar.createdAt?.toISOString() ?? 'no date'}`);
      const years = dar.analysisData?.years ?? {};
      for (const year of dar.scopedYears) {
        const yearData = years[String(year)];
        const k = bsKey(dar.targetCompanyId, year);
        const current = bestBs.get(k);
        const existingBs = current?.bs ?? null;
        const status = !current ? 'NO PERIOD' : !existingBs ? 'NO BS ROW' : 'HOLLOW';
        const replay = extractJsonSixValues(yearData);
        const fmt = (v: any) => (v == null ? 'null' : String(v));
        console.log(`  FY ${year} — ${status}`);
        console.log(`    current : cash=${fmt(existingBs?.cashAtBank)} debtors=${fmt(existingBs?.tradeDebtors)} creditors=${fmt(existingBs?.tradeCreditors)} tcAssets=${fmt(existingBs?.totalCurrentAssets)} tcLiab=${fmt(existingBs?.totalCurrentLiabilities)} equity=${fmt(existingBs?.totalEquity)}`);
        console.log(`    replay  : cash=${fmt(replay.cashAtBank)} debtors=${fmt(replay.tradeDebtors)} creditors=${fmt(replay.tradeCreditors)} tcAssets=${fmt(replay.totalCurrentAssets)} tcLiab=${fmt(replay.totalCurrentLiabilities)} equity=${fmt(replay.totalEquity)}`);
      }
    }
    console.log('\nDry-run complete. Re-run with --execute to apply.');
  } else {
    // ── 5b. EXECUTE: replay oldest-first per company ────────────────────────
    const byCompany = new Map<number, ScopedDar[]>();
    for (const dar of scoped) {
      const list = byCompany.get(dar.targetCompanyId) ?? [];
      list.push(dar);
      byCompany.set(dar.targetCompanyId, list);
    }

    for (const [tcId, dars] of byCompany) {
      const sorted = [...dars].sort((a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0));
      console.log(`Company ${tcId}: replaying ${sorted.length} DAR(s) oldest-first…`);
      for (const dar of sorted) {
        try {
          const result = await financialDataService.processExtractedData(
            dar.documentType,
            dar.analysisData,
            dar.targetCompanyId,
            dar.documentId,
            dar.documentCategory,
          );
          const created = result.recordsCreated ?? 0;
          const updated = (result as any).recordsUpdated ?? 0;
          console.log(`  DAR ${dar.darId} "${dar.docName}": ${created} created, ${updated} updated`);
        } catch (err) {
          console.error(`  DAR ${dar.darId} ERROR: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      console.log(`  Company ${tcId} done.\n`);
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal:', err instanceof Error ? err.stack : err);
  process.exit(1);
});
