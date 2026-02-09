import { createReport } from 'docx-templates';
import mammoth from 'mammoth';
import fs from 'fs/promises';
import path from 'path';
import { db } from '../db';
import { dealDocumentTemplates } from '@shared/schema/deal-documents';
import { targetCompanies } from '@shared/schema/deals';
import { userCompanies, users } from '@shared/schema/core';
import { dealModels } from '@shared/schema/deal-models';
import { eq, and } from 'drizzle-orm';

const TEMPLATES_DIR = path.join(process.cwd(), 'data', 'templates');
const GENERATED_DIR = path.join(process.cwd(), 'data', 'generated-documents');

export interface DocumentDataContext {
  buyerCompanyName: string;
  buyerAddress?: string;
  buyerEmail?: string;
  buyerPhone?: string;
  buyerSignatoryName: string;
  buyerSignatoryTitle?: string;

  sellerCompanyName: string;
  sellerCompanyNumber?: string;
  sellerAddress?: string;
  sellerContactName?: string;
  sellerContactEmail?: string;

  currentDate: string;

  averagingYears?: number;
  averageEbitda?: number;
  ebitdaMultiple?: number;
  enterpriseValue?: number;
  offerPrice?: number;
  propertyValue?: number;
  excessCash?: number;
  primaryDebt?: number;
  otherDebt?: number;
  corpTaxDue?: number;
  workingCapitalAdj?: number;
  totalFees?: number;
  totalFundingRequired?: number;

  dayOnePayment?: number;
  deferredTotal?: number;
  deferredSchedule?: Array<{
    period: string;
    amount: number;
  }>;

  fundingLines?: Array<{
    name: string;
    amount: number;
    type: string;
    interestRate?: number;
    termMonths?: number;
  }>;

  ebitdaByYear?: Record<string, number>;

  feeLegalDd?: number;
  feeAccountingDd?: number;
  feeBroker?: number;
  feeLoanArrangement?: number;
  feeDealMaker?: number;

  exclusivityPeriodDays?: number;
  nonCompetePeriodYears?: number;
  nonSolicitPeriodYears?: number;
  warrantyClaimPeriodMonths?: number;
  warrantyMinClaim?: number;
  warrantyAggregateCap?: number;

  [key: string]: any;
}

export class DealDocumentTemplateService {

  async ensureDirectories(): Promise<void> {
    await fs.mkdir(TEMPLATES_DIR, { recursive: true });
    await fs.mkdir(GENERATED_DIR, { recursive: true });
  }

  async generateDocument(
    templatePath: string,
    data: DocumentDataContext
  ): Promise<Buffer> {
    const templateBuffer = await fs.readFile(templatePath);

    const buffer = await createReport({
      template: templateBuffer,
      data,
      cmdDelimiter: ['{{', '}}'],
      processLineBreaks: true,
      failFast: false,
    });

    return Buffer.from(buffer);
  }

  async buildDataContext(
    targetCompanyId: number,
    userCompanyId: number,
    createdBy: number,
    dealModelId?: number | null
  ): Promise<DocumentDataContext> {
    const [buyerCompany] = await db
      .select()
      .from(userCompanies)
      .where(eq(userCompanies.id, userCompanyId));

    const [buyerUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, createdBy));

    const [targetCompany] = await db
      .select()
      .from(targetCompanies)
      .where(eq(targetCompanies.id, targetCompanyId));

    const context: DocumentDataContext = {
      buyerCompanyName: buyerCompany?.companyName || '',
      buyerAddress: buyerCompany?.address || '',
      buyerEmail: buyerCompany?.email || '',
      buyerPhone: buyerCompany?.phone || '',
      buyerSignatoryName: buyerUser ? `${buyerUser.firstName} ${buyerUser.lastName}` : '',

      sellerCompanyName: targetCompany?.companyName || '',
      sellerAddress: targetCompany?.address || '',
      sellerContactName: '',

      currentDate: new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }),

      productOrService: targetCompany?.companyName
        ? `the business operations of ${targetCompany.companyName}`
        : 'the business operations of the Company',
    };

    if (dealModelId) {
      const [model] = await db
        .select()
        .from(dealModels)
        .where(eq(dealModels.id, dealModelId));

      if (model) {
        context.ebitdaMultiple = Number(model.ebitdaMultiple) || 0;
        context.averagingYears = model.averagingYears || 3;
        context.propertyValue = Number(model.propertyValue) || 0;
        context.excessCash = Number(model.plusExcessCash) || 0;
        context.primaryDebt = Number(model.minusPrimaryDebt) || 0;
        context.otherDebt = Number(model.minusOtherDebt) || 0;
        context.corpTaxDue = Number(model.minusCorpTaxDue) || 0;
        context.workingCapitalAdj = Number(model.minusWorkingCapitalAdj) || 0;
      }
    }

    return context;
  }

  async generateAndSave(
    templatePath: string,
    data: DocumentDataContext,
    filename: string
  ): Promise<string> {
    await this.ensureDirectories();

    const buffer = await this.generateDocument(templatePath, data);
    const outputPath = path.join(GENERATED_DIR, filename);
    await fs.writeFile(outputPath, buffer);

    return outputPath;
  }

  async getSystemTemplate(documentType: string): Promise<typeof dealDocumentTemplates.$inferSelect | null> {
    const [template] = await db
      .select()
      .from(dealDocumentTemplates)
      .where(
        and(
          eq(dealDocumentTemplates.documentType, documentType),
          eq(dealDocumentTemplates.isSystem, true),
          eq(dealDocumentTemplates.isActive, true)
        )
      );
    return template || null;
  }

  async convertToHtml(docxPath: string): Promise<string> {
    const result = await mammoth.convertToHtml(
      { path: docxPath },
      {
        styleMap: [
          "p[style-name='Heading 1'] => h1:fresh",
          "p[style-name='Heading 2'] => h2:fresh",
          "p[style-name='Heading 3'] => h3:fresh",
          "b => strong",
          "i => em",
          "u => u",
        ],
      }
    );
    return result.value;
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  formatCurrencyPrecise(amount: number): string {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }
}

export const dealDocumentTemplateService = new DealDocumentTemplateService();
