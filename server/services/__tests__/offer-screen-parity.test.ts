import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { users, userCompanies } from '@shared/schema/core';
import { targetCompanies } from '@shared/schema/deals';
import { expertAnalysisResults } from '@shared/schema/documents';
import {
  dealModels,
  dealModelFundingLines,
} from '@shared/schema/deal-models';
import {
  financialContributions,
  financialPeriods,
  incomeStatements,
} from '@shared/schema/financials';
import { dealDocuments } from '@shared/schema/deal-documents';
import { calculateFullDealModel } from '@shared/calculators/deal-model.calc';
import { buildOfferLetterHtml } from '../../utils/document-html-builders';
import { dealDocumentService } from '../deal-document.service';
import {
  buildScreenEbitdaByYear,
  getScreenEbitdaByYear,
} from '../screen-ebitda.service';

const dbUrl = process.env.DATABASE_URL ?? '';
const dbHost = dbUrl.match(/@([^/]+)\//)?.[1] ?? 'unknown';
if (dbHost.includes('ep-old-recipe') || dbHost.includes('.prod.')) {
  throw new Error(`OFFER PARITY ABORT: DATABASE_URL points at prod host (${dbHost}).`);
}

const stamp = Date.now();
let userCompanyId: number;
let userId: number;
const companyIds: number[] = [];
const modelIds: number[] = [];

async function seedCompany(
  label: string,
  sourceTier: 'information_memorandum' | 'statutory',
  ebitda: number,
) {
  const [company] = await db.insert(targetCompanies).values({
    userCompanyId,
    companyName: `${label} ${stamp}`,
    createdBy: userId,
  }).returning();
  companyIds.push(company.id);

  const [model] = await db.insert(dealModels).values({
    targetCompanyId: company.id,
    createdBy: userId,
    name: `${label} model ${stamp}`,
    averagingYears: 1,
    ebitdaMultiple: '3.0',
  }).returning();
  modelIds.push(model.id);

  const [period] = await db.insert(financialPeriods).values({
    targetCompanyId: company.id,
    periodType: 'statutory',
    periodEnd: '2025-12-31',
    fiscalYear: 2025,
    periodLabel: 'FY 2025',
    monthsCovered: 12,
    isFullYear: true,
    sourceTier,
  }).returning();

  await db.insert(incomeStatements).values({
    financialPeriodId: period.id,
    targetCompanyId: company.id,
    operatingProfit: String(ebitda),
    depreciationAmortisation: '0',
    isFullYear: true,
  });

  await db.insert(financialContributions).values({
    targetCompanyId: company.id,
    fiscalYear: 2025,
    statementType: 'income',
    sourceTier,
    isFullYear: true,
    isPrimaryYear: true,
    monthsCovered: 12,
    periodEnd: '2025-12-31',
    figures: { ebitda },
  });

  await db.insert(expertAnalysisResults).values({
    targetCompanyId: company.id,
    expertType: 'financial',
    status: 'success',
    analysisData: {
      yearly_metrics: {
        '2025': { ebitda },
      },
    },
    triggeredBy: userId,
  });

  return { companyId: company.id, modelId: model.id };
}

beforeAll(async () => {
  const [userCompany] = await db.insert(userCompanies).values({
    companyName: `OFFER PARITY BUYER ${stamp}`,
  }).returning();
  userCompanyId = userCompany.id;

  const [user] = await db.insert(users).values({
    email: `offer.parity.${stamp}@example.invalid`,
    firstName: 'Offer',
    lastName: 'Parity',
    userCompanyId,
  }).returning();
  userId = user.id;
});

afterAll(async () => {
  for (const companyId of companyIds) {
    await db.delete(dealDocuments).where(eq(dealDocuments.targetCompanyId, companyId));
    await db.delete(financialContributions).where(eq(financialContributions.targetCompanyId, companyId));
    await db.delete(incomeStatements).where(eq(incomeStatements.targetCompanyId, companyId));
    await db.delete(financialPeriods).where(eq(financialPeriods.targetCompanyId, companyId));
    await db.delete(expertAnalysisResults).where(eq(expertAnalysisResults.targetCompanyId, companyId));
  }
  for (const modelId of modelIds) {
    await db.delete(dealModelFundingLines).where(eq(dealModelFundingLines.dealModelId, modelId));
  }
  for (const companyId of companyIds) {
    await db.delete(dealModels).where(eq(dealModels.targetCompanyId, companyId));
    await db.delete(targetCompanies).where(eq(targetCompanies.id, companyId));
  }
  await db.delete(users).where(eq(users.id, userId));
  await db.delete(userCompanies).where(eq(userCompanies.id, userCompanyId));
});

describe('offer letter and deal-model screen valuation parity', () => {
  it('REGRESSION: IM-only Thor-CON expert EBITDA produces valuation EBITDA 101,172, not -3,000', async () => {
    const fixture = await seedCompany('THOR-CON SHAPE', 'information_memorandum', 104_172);
    await db.insert(dealModelFundingLines).values({
      dealModelId: fixture.modelId,
      fundingType: 'receivables_finance',
      label: 'Invoice finance',
      amountUsed: '30000',
      interestRate: '10',
      isDebt: true,
      repaymentStructure: 'interest_only',
      isActive: true,
    });

    const context = await (dealDocumentService as any).buildOfferDataContext(
      fixture.modelId,
      fixture.companyId,
      userCompanyId,
      userId,
    );

    expect(context._raw.averageEbitda).toBe(104_172);
    expect(context._raw.valuationEbitda).toBe(101_172);
    expect(context._raw.valuationEbitda).not.toBe(-3_000);
  });

  it('EQUALITY: server screen selector returns the same keys and values as the client algorithm', () => {
    const expertResults = [
      {
        expertType: 'financial',
        status: 'failed',
        analysisData: { yearly_metrics: { '2025': { ebitda: 1 } } },
      },
      {
        expertType: 'financial',
        status: 'success',
        analysisData: {
          yearly_metrics: {
            '2023': { ebitda: 80_000 },
            '2024': { ebitda: 90_000 },
            '2025': { ebitda: 104_172 },
          },
        },
      },
    ] as any;
    const periods = [
      { fiscalYear: 2023, monthsCovered: 12, isFullYear: true, documentCategory: null },
      { fiscalYear: 2024, monthsCovered: 6, isFullYear: false, documentCategory: 'YTD accounts' },
    ];

    const clientMap = { '2023': 80_000, '2024': 90_000, '2025': 104_172 };
    expect(buildScreenEbitdaByYear(expertResults, periods)).toEqual(clientMap);
  });

  it('NO-YEARS: empty screen map throws and creates no offer document', async () => {
    const [company] = await db.insert(targetCompanies).values({
      userCompanyId,
      companyName: `NO YEARS ${stamp}`,
      createdBy: userId,
    }).returning();
    companyIds.push(company.id);
    const [model] = await db.insert(dealModels).values({
      targetCompanyId: company.id,
      createdBy: userId,
      name: `NO YEARS MODEL ${stamp}`,
    }).returning();
    modelIds.push(model.id);

    expect(await getScreenEbitdaByYear(company.id)).toEqual({});
    await expect(dealDocumentService.createOfflineOfferFromDealModel({
      targetCompanyId: company.id,
      userCompanyId,
      dealModelId: model.id,
      createdBy: userId,
    })).rejects.toThrow(/no financial years with EBITDA/i);

    const documents = await db.select().from(dealDocuments)
      .where(eq(dealDocuments.targetCompanyId, company.id));
    expect(documents).toHaveLength(0);
  });

  it('POSITIVE CONTROL: matching statutory expert data preserves the existing offer price', async () => {
    const fixture = await seedCompany('STATUTORY CONTROL', 'statutory', 100_000);
    const screenMap = await getScreenEbitdaByYear(fixture.companyId);
    expect(screenMap).toEqual({ '2025': 100_000 });

    const previous = calculateFullDealModel({ '2025': 100_000 }, [], [], {
      averagingYears: 1,
      ebitdaMultiple: '3.0',
    });
    const context = await (dealDocumentService as any).buildOfferDataContext(
      fixture.modelId,
      fixture.companyId,
      userCompanyId,
      userId,
    );
    expect(context._raw.offerPrice).toBe(previous.offerPrice);
    expect(context._raw.offerPrice).toBe(300_000);
  });

  it('NO-LEAK: generated offer-letter body contains no provisional or Information Memorandum wording', () => {
    const html = buildOfferLetterHtml({
      sellerCompanyName: 'No Leak Ltd',
      buyerCompanyName: 'Buyer Ltd',
      offerPrice: '£300,000',
      enterpriseValue: '£300,000',
      breakdownText: 'Enterprise Value: £300,000\nTotal Offer Price: £300,000',
      paymentText: 'Payment at Completion: £300,000',
      isProvisionalFinancials: true,
      _raw: { offerPrice: 300_000, enterpriseValue: 300_000 },
    });
    expect(html).not.toMatch(/provisional/i);
    expect(html).not.toMatch(/information memorandum/i);
  });
});