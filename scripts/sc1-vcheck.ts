#!/usr/bin/env tsx
/**
 * Sc-1 isolated V-check — Canoports YTD P&L through the real pipeline.
 * Confirms Slice 21: months_covered=12 + YTD filename → isFullYear=false,
 * years excluded from reportedEbitdaByYear.
 * Dev only — host guard enforced.
 */

import { eq, and } from 'drizzle-orm';
import { db } from '../server/db';
import {
  targetCompanies,
  financialContributions,
  financialPeriods,
  incomeStatements,
} from '../shared/schema';
import { financialDataService } from '../server/services/financial-data.service';
import { fetchReportedEbitdaByYear } from '../server/services/deal-model.service';
import { classifyDocumentWithGemini } from '../server/services/gemini-document-classification-service';
import { runStep2AnalysisForTypes } from '../server/services/gemini-step2-analysis-service';

const dbUrl = process.env.DATABASE_URL ?? '';
const dbHost = dbUrl.match(/@([^\/]+)\//)?.[1] ?? 'unknown';
if (dbHost.includes('ep-old-recipe') || dbHost.includes('.prod.')) {
  console.error(`\nABORT: DATABASE_URL points at prod (${dbHost}). Dev only.\n`);
  process.exit(1);
}

const USER_COMPANY_ID = 71;
const DOC = {
  fileName: 'Canoports_YTD_Profit_and_Loss.pdf',
  key: 'companies/220/doc-1783154915000-431657599.pdf',
  mimeType: 'application/pdf',
  docCategory: 'YTD Profit & Loss',
};

async function main() {
  console.log('\nSc-1 V-check — Canoports YTD P&L (Slice 21)');
  console.log(`DB host: ${dbHost}\n`);

  const [co] = await db
    .insert(targetCompanies)
    .values({ userCompanyId: USER_COMPANY_ID, companyName: 'LB-Sc1-Vcheck-Sl21' })
    .returning();
  const coId = co.id;

  try {
    // Step 1: Classify
    const cls = await classifyDocumentWithGemini({
      filePath: DOC.key,
      mimeType: DOC.mimeType,
      fileName: DOC.fileName,
    });
    const isIM = cls.isInformationMemorandum ?? false;
    let types = cls.documentTypes ?? [];
    if (types.includes('company_accounts')) {
      if (!types.includes('profit_and_loss')) types = [...types, 'profit_and_loss'];
      if (!types.includes('balance_sheet'))   types = [...types, 'balance_sheet'];
    }
    console.log(`  Gemini types: [${types.join(', ')}]   isIM: ${isIM}`);

    // Step 2: Extract
    const step2 = await runStep2AnalysisForTypes(
      'http://localhost/sc1-vcheck',
      DOC.key, DOC.mimeType, DOC.fileName, types,
    );

    // Step 3: processExtractedData with real category + filename
    for (const r of step2) {
      if (r.success && r.analysisData) {
        await financialDataService.processExtractedData(
          r.documentType, r.analysisData, coId,
          undefined, DOC.docCategory, { llmIsIM: isIM }, DOC.fileName,
        );
      }
    }

    // Read back results
    const contribs = await db.select().from(financialContributions)
      .where(and(
        eq(financialContributions.targetCompanyId, coId),
        eq(financialContributions.statementType, 'income'),
      ));
    const incomes = await db.select().from(incomeStatements)
      .where(eq(incomeStatements.targetCompanyId, coId));
    const ebitda = await fetchReportedEbitdaByYear(coId);

    // ── Raw values ──────────────────────────────────────────────────────────
    console.log('\n  Raw values:');
    console.log(`    income contributions: ${contribs.length}`);
    for (const c of contribs) {
      console.log(`      FY${c.fiscalYear}  isFullYear=${c.isFullYear}  months=${c.monthsCovered}  tier=${c.sourceTier}`);
    }
    console.log(`    income statements: ${incomes.length}`);
    for (const i of incomes) {
      console.log(`      FY${i.fiscalYear}  isFullYear=${i.isFullYear}`);
    }
    console.log(`    EBITDA keys: [${Object.keys(ebitda).join(', ')}]`);
    console.log(`    EBITDA values: ${JSON.stringify(ebitda)}`);

    // ── Assertions ──────────────────────────────────────────────────────────
    const checks = [
      { label: 'income contribs >= 1',         ok: contribs.length >= 1 },
      { label: 'contrib[0].isFullYear = false', ok: contribs[0]?.isFullYear === false },
      { label: 'incomeStatements >= 1',         ok: incomes.length >= 1 },
      { label: 'IS[0].isFullYear = false',      ok: incomes[0]?.isFullYear === false },
      { label: 'EBITDA = {} (no full-year)',     ok: Object.keys(ebitda).length === 0 },
    ];

    console.log('\n  Assertions:');
    for (const c of checks) {
      console.log(`    ${c.ok ? '✓' : '✗'} ${c.label}`);
    }

    const allPass = checks.every(c => c.ok);
    console.log(`\n  Sc-1 result: ${allPass ? '✓ PASS' : '✗ FAIL'}\n`);
    process.exitCode = allPass ? 0 : 1;

  } finally {
    try {
      await db.delete(incomeStatements).where(eq(incomeStatements.targetCompanyId, coId));
      await db.delete(financialContributions).where(eq(financialContributions.targetCompanyId, coId));
      await db.delete(financialPeriods).where(eq(financialPeriods.targetCompanyId, coId));
      await db.delete(targetCompanies).where(eq(targetCompanies.id, coId));
    } catch { /* best-effort cleanup */ }
  }
}

main().catch(err => { console.error('\nFatal:', err); process.exit(1); });
