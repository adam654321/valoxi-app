import { db } from '../db';
import { dealDocuments, dealDocumentResponses, dealDocumentTemplates } from '@shared/schema/deal-documents';
import { documents } from '@shared/schema/documents';
import { dealModels, dealModelAdjustments, dealModelFundingLines } from '@shared/schema/deal-models';
import { financialPeriods, incomeStatements } from '@shared/schema/financials';
import { eq, and, desc, not, inArray } from 'drizzle-orm';
import { dealDocumentTemplateService, DocumentDataContext } from './deal-document-template.service';

export class DealDocumentService {

  async createDocument(params: {
    targetCompanyId: number;
    userCompanyId: number;
    documentType: 'nda' | 'offer_letter' | 'heads_of_terms';
    createdBy: number;
    dealModelId?: number;
    portalTokenId?: number;
    templateId?: number;
    sectionConfig?: any;
    documentData?: any;
  }) {
    const [doc] = await db.insert(dealDocuments).values({
      targetCompanyId: params.targetCompanyId,
      userCompanyId: params.userCompanyId,
      documentType: params.documentType,
      status: 'draft',
      version: 1,
      createdBy: params.createdBy,
      dealModelId: params.dealModelId || null,
      portalTokenId: params.portalTokenId || null,
      templateId: params.templateId || null,
      sectionConfig: params.sectionConfig || null,
      documentData: params.documentData || null,
    }).returning();

    return doc;
  }

  async generateDocumentFile(
    documentId: number,
    dataOverrides?: Partial<DocumentDataContext>
  ) {
    const doc = await this.getDocumentById(documentId);
    if (!doc) throw new Error('Document not found');

    let templatePath: string;
    if (doc.templateId) {
      const [template] = await db.select().from(dealDocumentTemplates)
        .where(eq(dealDocumentTemplates.id, doc.templateId));
      if (!template) throw new Error('Template not found');
      templatePath = template.templateFileUrl;
    } else {
      const template = await dealDocumentTemplateService.getSystemTemplate(doc.documentType);
      if (!template) throw new Error(`No system template found for ${doc.documentType}`);
      templatePath = template.templateFileUrl;
    }

    const context = await dealDocumentTemplateService.buildDataContext(
      doc.targetCompanyId,
      doc.userCompanyId,
      doc.createdBy,
      doc.dealModelId
    );

    const mergedData = { ...context, ...dataOverrides };

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${doc.documentType}_v${doc.version}_${doc.targetCompanyId}_${timestamp}.docx`;

    const outputPath = await dealDocumentTemplateService.generateAndSave(
      templatePath,
      mergedData,
      filename
    );

    await db.update(dealDocuments)
      .set({
        generatedFileUrl: outputPath,
        documentData: mergedData,
      })
      .where(eq(dealDocuments.id, documentId));

    return { outputPath, filename };
  }

  async sendDocument(documentId: number) {
    const doc = await this.getDocumentById(documentId);
    if (!doc) throw new Error('Document not found');
    if (doc.status !== 'draft') throw new Error(`Cannot send document in status: ${doc.status}`);
    if (!doc.generatedFileUrl) throw new Error('Document has not been generated yet');

    await db.update(dealDocuments)
      .set({
        status: 'sent',
        sentAt: new Date(),
      })
      .where(eq(dealDocuments.id, documentId));

    return this.getDocumentById(documentId);
  }

  async markViewed(documentId: number) {
    const doc = await this.getDocumentById(documentId);
    if (!doc) return;

    if (!doc.viewedAt) {
      await db.update(dealDocuments)
        .set({
          status: doc.status === 'sent' ? 'viewed' : doc.status,
          viewedAt: new Date(),
        })
        .where(eq(dealDocuments.id, documentId));
    }
  }

  async recordResponse(params: {
    documentId: number;
    responseType: 'accepted' | 'rejected' | 'countered';
    comments?: string;
    respondentName: string;
    respondentEmail?: string;
    respondentIp?: string;
    respondentUserAgent?: string;
  }) {
    const doc = await this.getDocumentById(params.documentId);
    if (!doc) throw new Error('Document not found');
    if (!['sent', 'viewed'].includes(doc.status)) {
      throw new Error(`Cannot respond to document in status: ${doc.status}`);
    }

    const [response] = await db.insert(dealDocumentResponses).values({
      dealDocumentId: params.documentId,
      responseType: params.responseType,
      comments: params.comments || null,
      respondentName: params.respondentName,
      respondentEmail: params.respondentEmail || null,
      respondentIp: params.respondentIp || null,
      respondentUserAgent: params.respondentUserAgent || null,
    }).returning();

    await db.update(dealDocuments)
      .set({
        status: params.responseType,
        respondedAt: new Date(),
      })
      .where(eq(dealDocuments.id, params.documentId));

    if (doc.documentType === 'nda' && params.responseType === 'accepted') {
      try {
        await this.generateSignedPdf({
          documentId: params.documentId,
          respondentName: params.respondentName,
          respondentEmail: params.respondentEmail,
          acceptedAt: new Date(),
          ipAddress: params.respondentIp,
        });
      } catch (pdfErr) {
        console.error('[DEAL_DOCS] Failed to generate signed PDF:', pdfErr);
      }
    } else {
      try {
        const { users } = await import('@shared/schema/core');
        const [creator] = await db.select().from(users)
          .where(eq(users.id, doc.createdBy));

        const { targetCompanies } = await import('@shared/schema/deals');
        const [targetCompany] = await db.select().from(targetCompanies)
          .where(eq(targetCompanies.id, doc.targetCompanyId));

        if (creator?.email) {
          const { emailApiService } = await import('./email.service');

          const responseLabels: Record<string, string> = {
            'accepted': 'Accepted',
            'rejected': 'Rejected',
            'countered': 'Counter-Proposal Submitted',
          };

          const docTypeLabels: Record<string, string> = {
            'nda': 'NDA',
            'offer_letter': 'Offer Letter',
            'heads_of_terms': 'Heads of Terms',
          };

          const subject = `${docTypeLabels[doc.documentType] || doc.documentType}: ${responseLabels[params.responseType] || params.responseType} — ${targetCompany?.companyName || 'Unknown Company'}`;

          const html = `
            <h2>${docTypeLabels[doc.documentType]} Response</h2>
            <p><strong>Company:</strong> ${targetCompany?.companyName || 'Unknown'}</p>
            <p><strong>Response:</strong> ${responseLabels[params.responseType]}</p>
            <p><strong>From:</strong> ${params.respondentName}</p>
            ${params.comments ? `<p><strong>Comments:</strong></p><p>${params.comments}</p>` : ''}
            <p><strong>Date:</strong> ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
            <hr>
            <p style="color: #666; font-size: 12px;">Log in to your dashboard to view the full details and take action.</p>
          `;

          await emailApiService.sendCustomEmail(creator.email, subject, html);
          console.log(`[DEAL_DOCS] Notification sent to ${creator.email} for ${doc.documentType} ${params.responseType}`);
        }
      } catch (emailErr) {
        console.error('[DEAL_DOCS] Failed to send response notification:', emailErr);
      }
    }

    return response;
  }

  async generateSignedPdf(params: {
    documentId: number;
    respondentName: string;
    respondentEmail?: string;
    acceptedAt: Date;
    ipAddress?: string;
  }): Promise<string> {
    const doc = await this.getDocumentById(params.documentId);
    if (!doc) throw new Error('Document not found');
    if (!doc.generatedFileUrl) throw new Error('Document not generated');

    const { dealDocumentTemplateService } = await import('./deal-document-template.service');
    const originalDocxPath = doc.generatedFileUrl;
    const html = await dealDocumentTemplateService.convertToHtml(originalDocxPath);

    const buyerName = (doc.documentData as any)?.buyerSignatoryName || 'Buyer';
    const buyerCompany = (doc.documentData as any)?.buyerCompanyName || '';
    const sellerCompany = (doc.documentData as any)?.sellerCompanyName || '';
    const signedDate = params.acceptedAt.toLocaleDateString('en-GB', {
      day: '2-digit', month: 'long', year: 'numeric'
    });

    const signedHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Times New Roman', Times, serif; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.6; color: #333; }
          h1 { font-size: 18px; text-align: center; margin-bottom: 20px; }
          h2 { font-size: 16px; margin-top: 24px; }
          h3 { font-size: 14px; margin-top: 20px; }
          p { margin: 8px 0; font-size: 12px; }
          .signature-block { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ccc; }
          .signature-row { display: flex; justify-content: space-between; margin-top: 30px; }
          .signature-party { width: 45%; }
          .signature-party .sig-name { font-weight: bold; font-size: 14px; border-bottom: 1px solid #333; padding-bottom: 4px; margin-bottom: 4px; }
          .signature-party .sig-detail { font-size: 11px; color: #555; margin: 2px 0; }
          .acceptance-stamp { margin-top: 20px; padding: 12px; background: #f0f9f0; border: 1px solid #c0e0c0; border-radius: 4px; font-size: 11px; }
        </style>
      </head>
      <body>
        ${html}
        <div class="signature-block">
          <h3>SIGNATURES</h3>
          <div class="signature-row">
            <div class="signature-party">
              <p style="font-size: 11px; color: #777; margin-bottom: 8px;">Disclosing Party / Buyer:</p>
              <div class="sig-name">${buyerName}</div>
              <div class="sig-detail">${buyerCompany}</div>
              <div class="sig-detail">Date: ${(doc.documentData as any)?.currentDate || ''}</div>
            </div>
            <div class="signature-party">
              <p style="font-size: 11px; color: #777; margin-bottom: 8px;">Receiving Party / Seller:</p>
              <div class="sig-name">${params.respondentName}</div>
              <div class="sig-detail">${sellerCompany}</div>
              <div class="sig-detail">Date: ${signedDate}</div>
            </div>
          </div>
          <div class="acceptance-stamp">
            <strong>Electronic Acceptance Record</strong><br>
            Accepted by: ${params.respondentName}<br>
            Date &amp; Time: ${params.acceptedAt.toISOString()}<br>
            IP Address: ${params.ipAddress || 'Not recorded'}<br>
            This document was electronically accepted via the secure document portal.
          </div>
        </div>
      </body>
      </html>
    `;

    const fsModule = await import('fs/promises');
    const pathModule = await import('path');

    let pdfBuffer: Buffer;
    try {
      const puppeteer = await import('puppeteer');
      const browser = await puppeteer.default.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      const page = await browser.newPage();
      await page.setContent(signedHtml, { waitUntil: 'networkidle0' });
      pdfBuffer = Buffer.from(await page.pdf({
        format: 'A4',
        margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
      }));
      await browser.close();
    } catch (puppeteerErr) {
      console.error('[DEAL_DOCS] Puppeteer PDF generation failed:', puppeteerErr);
      throw new Error('PDF generation not available on this platform');
    }

    const GENERATED_DIR = pathModule.join(process.cwd(), 'data', 'generated-documents');
    await fsModule.mkdir(GENERATED_DIR, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const pdfFilename = `signed_nda_${doc.targetCompanyId}_${timestamp}.pdf`;
    const pdfPath = pathModule.join(GENERATED_DIR, pdfFilename);
    await fsModule.writeFile(pdfPath, pdfBuffer);

    

    try {
      const stat = await fsModule.stat(pdfPath);
      const sellerName = params.respondentName || 'Seller';
      const companyData = (doc.documentData as any);
      const sellerCompanyName = companyData?.sellerCompanyName || '';
      const docName = sellerCompanyName
        ? `Signed NDA - ${sellerCompanyName}`
        : `Signed NDA - ${sellerName}`;

      await db.insert(documents).values({
        targetCompanyId: doc.targetCompanyId,
        uploadedBy: doc.createdBy,
        documentName: docName,
        originalFilename: pdfFilename,
        filePath: pdfPath,
        fileSize: stat.size,
        fileType: 'application/pdf',
        documentCategory: 'Deal Documents',
        description: `Signed NDA accepted by ${sellerName} on ${signedDate}. Electronic acceptance with IP address and timestamp recorded.`,
        isConfidential: true,
      });
      console.log(`[DEAL_DOCS] Signed NDA saved to Document Library for target company ${doc.targetCompanyId}`);
    } catch (libErr) {
      console.error('[DEAL_DOCS] Failed to save signed PDF to Document Library:', libErr);
    }

    console.log(`[DEAL_DOCS] Signed NDA PDF generated: ${pdfPath}`);
    return pdfPath;
  }

  async createNewVersion(
    parentDocumentId: number,
    createdBy: number,
    params?: {
      dealModelId?: number;
      sectionConfig?: any;
      documentData?: any;
    }
  ) {
    const parent = await this.getDocumentById(parentDocumentId);
    if (!parent) throw new Error('Parent document not found');

    await db.update(dealDocuments)
      .set({ status: 'superseded' })
      .where(eq(dealDocuments.id, parentDocumentId));

    const [newDoc] = await db.insert(dealDocuments).values({
      targetCompanyId: parent.targetCompanyId,
      userCompanyId: parent.userCompanyId,
      documentType: parent.documentType,
      status: 'draft',
      version: parent.version + 1,
      parentDocumentId: parent.id,
      createdBy,
      dealModelId: params?.dealModelId || parent.dealModelId,
      portalTokenId: parent.portalTokenId,
      templateId: parent.templateId,
      sectionConfig: params?.sectionConfig || parent.sectionConfig,
      documentData: params?.documentData || null,
    }).returning();

    return newDoc;
  }

  async withdrawDocument(documentId: number) {
    const doc = await this.getDocumentById(documentId);
    if (!doc) throw new Error('Document not found');
    if (!['draft', 'sent', 'viewed'].includes(doc.status)) {
      throw new Error(`Cannot withdraw document in status: ${doc.status}`);
    }

    await db.update(dealDocuments)
      .set({ status: 'withdrawn' })
      .where(eq(dealDocuments.id, documentId));

    return this.getDocumentById(documentId);
  }

  async getDocumentById(id: number) {
    const [doc] = await db.select().from(dealDocuments)
      .where(eq(dealDocuments.id, id));
    return doc || null;
  }

  async getDocumentsForCompany(targetCompanyId: number) {
    return db.select().from(dealDocuments)
      .where(eq(dealDocuments.targetCompanyId, targetCompanyId))
      .orderBy(desc(dealDocuments.createdAt));
  }

  async getDocumentsByType(targetCompanyId: number, documentType: string) {
    return db.select().from(dealDocuments)
      .where(
        and(
          eq(dealDocuments.targetCompanyId, targetCompanyId),
          eq(dealDocuments.documentType, documentType)
        )
      )
      .orderBy(desc(dealDocuments.version));
  }

  async getLatestActiveDocument(targetCompanyId: number, documentType: string) {
    const [doc] = await db.select().from(dealDocuments)
      .where(
        and(
          eq(dealDocuments.targetCompanyId, targetCompanyId),
          eq(dealDocuments.documentType, documentType)
        )
      )
      .orderBy(desc(dealDocuments.version))
      .limit(1);

    if (doc && ['superseded', 'withdrawn'].includes(doc.status)) {
      return null;
    }
    return doc || null;
  }

  async getDocumentResponses(documentId: number) {
    return db.select().from(dealDocumentResponses)
      .where(eq(dealDocumentResponses.dealDocumentId, documentId))
      .orderBy(desc(dealDocumentResponses.createdAt));
  }

  async getVersionHistory(targetCompanyId: number, documentType: string) {
    const docs = await db.select().from(dealDocuments)
      .where(
        and(
          eq(dealDocuments.targetCompanyId, targetCompanyId),
          eq(dealDocuments.documentType, documentType)
        )
      )
      .orderBy(dealDocuments.version);

    const history = await Promise.all(
      docs.map(async (doc) => {
        const responses = await this.getDocumentResponses(doc.id);
        return { ...doc, responses };
      })
    );

    return history;
  }

  async createNdaForPortal(params: {
    targetCompanyId: number;
    userCompanyId: number;
    portalTokenId: number;
    createdBy: number;
  }) {
    const existing = await this.getLatestActiveDocument(params.targetCompanyId, 'nda');
    if (existing && existing.portalTokenId === params.portalTokenId) {
      return existing;
    }

    const template = await dealDocumentTemplateService.getSystemTemplate('nda');

    const doc = await this.createDocument({
      targetCompanyId: params.targetCompanyId,
      userCompanyId: params.userCompanyId,
      documentType: 'nda',
      createdBy: params.createdBy,
      portalTokenId: params.portalTokenId,
      templateId: template?.id,
    });

    try {
      const context = await dealDocumentTemplateService.buildDataContext(
        params.targetCompanyId,
        params.userCompanyId,
        params.createdBy
      );

      await this.generateDocumentFile(doc.id, context);

      await this.sendDocument(doc.id);

      console.log(`[DEAL_DOCS] NDA created and sent for portal ${params.portalTokenId} (doc id: ${doc.id})`);
      return doc;
    } catch (err) {
      console.error(`[DEAL_DOCS] Failed to generate NDA for portal ${params.portalTokenId}:`, err);
      return doc;
    }
  }

  async createOfferFromDealModel(params: {
    targetCompanyId: number;
    userCompanyId: number;
    dealModelId: number;
    portalTokenId: number;
    createdBy: number;
  }) {
    const existingOffer = await this.getLatestActiveDocument(params.targetCompanyId, 'offer_letter');

    let doc;
    if (existingOffer && ['sent', 'viewed', 'countered', 'rejected'].includes(existingOffer.status)) {
      doc = await this.createNewVersion(existingOffer.id, params.createdBy, {
        dealModelId: params.dealModelId,
      });
    } else {
      const template = await dealDocumentTemplateService.getSystemTemplate('offer_letter');

      doc = await this.createDocument({
        targetCompanyId: params.targetCompanyId,
        userCompanyId: params.userCompanyId,
        documentType: 'offer_letter',
        createdBy: params.createdBy,
        dealModelId: params.dealModelId,
        portalTokenId: params.portalTokenId,
        templateId: template?.id,
      });
    }

    const offerData = await this.buildOfferDataContext(params.dealModelId, params.targetCompanyId, params.userCompanyId, params.createdBy);

    await this.generateDocumentFile(doc.id, offerData);

    return doc;
  }

  private async buildOfferDataContext(
    dealModelId: number,
    targetCompanyId: number,
    userCompanyId: number,
    createdBy: number
  ): Promise<Record<string, any>> {
    const baseContext = await dealDocumentTemplateService.buildDataContext(
      targetCompanyId, userCompanyId, createdBy, dealModelId
    );

    const [model] = await db.select().from(dealModels)
      .where(eq(dealModels.id, dealModelId));

    if (!model) throw new Error('Deal model not found');

    const fundingLines = await db.select().from(dealModelFundingLines)
      .where(eq(dealModelFundingLines.dealModelId, dealModelId));

    const adjustments = await db.select().from(dealModelAdjustments)
      .where(eq(dealModelAdjustments.dealModelId, dealModelId));

    const periods = await db.select().from(financialPeriods)
      .where(and(
        eq(financialPeriods.targetCompanyId, targetCompanyId),
        inArray(financialPeriods.periodType, ['statutory', 'historic'])
      ));

    const reportedEbitdaByYear: Record<string, number> = {};
    for (const period of periods) {
      if (!period.fiscalYear) continue;
      const [income] = await db.select().from(incomeStatements)
        .where(eq(incomeStatements.financialPeriodId, period.id));
      if (income) {
        const opProfit = Number(income.operatingProfit) || 0;
        const depAmort = Number(income.depreciationAmortisation) || 0;
        reportedEbitdaByYear[String(period.fiscalYear)] = opProfit + depAmort;
      }
    }

    const { calculateFullDealModel } = await import('@shared/calculators/deal-model.calc');

    const modelInput = {
      averagingYears: model.averagingYears || 3,
      ebitdaMultiple: model.ebitdaMultiple || '3.0',
      plusExcessCash: model.plusExcessCash || '0',
      minusPrimaryDebt: model.minusPrimaryDebt || '0',
      minusOtherDebt: model.minusOtherDebt || '0',
      minusCorpTaxDue: model.minusCorpTaxDue || '0',
      minusWorkingCapitalAdj: model.minusWorkingCapitalAdj || '0',
      plusPropertyValue: model.propertyValue || '0',
      feeLegalDdPercent: model.feeLegalDdPercent || '2.5',
      feeAccountingDdPercent: model.feeAccountingDdPercent || '1.5',
      feeBrokerPercent: model.feeBrokerPercent || '2.0',
      feeLoanArrangementPercent: model.feeLoanArrangementPercent || '1.0',
      feeDealMakerPercent: model.feeDealMakerPercent || '5.0',
      feeLegalDdType: (model.feeLegalDdType as any) || 'percent',
      feeAccountingDdType: (model.feeAccountingDdType as any) || 'percent',
      feeBrokerType: (model.feeBrokerType as any) || 'percent',
      feeLoanArrangementType: (model.feeLoanArrangementType as any) || 'percent',
      feeDealMakerType: (model.feeDealMakerType as any) || 'percent',
    };

    const adjustmentInputs = adjustments.map(a => ({
      adjustmentType: a.adjustmentType as 'add_back' | 'deduction',
      amount: a.amount,
      amountsByYear: a.amountsByYear as Record<string, number> | null,
      status: a.status || 'suggested',
      userOverrideAmount: null,
    }));

    const fundingLineInputs = fundingLines.map(fl => ({
      fundingType: fl.fundingType,
      assetBaseValue: fl.assetBaseValue,
      ltvPercent: fl.ltvPercent,
      amountUsed: fl.amountUsed,
      interestRate: fl.interestRate,
      termMonths: fl.termMonths,
      arrangementFeePercent: fl.arrangementFeePercent,
      isDebt: fl.isDebt ?? false,
      isActive: fl.isActive ?? false,
    }));

    let calculations: any = {};
    try {
      calculations = calculateFullDealModel(reportedEbitdaByYear, adjustmentInputs, fundingLineInputs, modelInput);
    } catch (err) {
      console.error('[DEAL_DOCS] Calculator error:', err);
    }

    const fmt = (val: any) => {
      const num = Number(val) || 0;
      return new Intl.NumberFormat('en-GB', {
        style: 'currency', currency: 'GBP',
        minimumFractionDigits: 0, maximumFractionDigits: 0,
      }).format(num);
    };

    const offerPrice = calculations.offerPrice || 0;
    const enterpriseValue = calculations.enterpriseValue || 0;
    const excessCash = Number(model.plusExcessCash) || 0;
    const dayOnePayment = Number(model.upfrontCash) || 0;

    const deferredTotal = Math.max(0, offerPrice - dayOnePayment - excessCash);

    const deferredYears = 5;
    const deferredInstalment = deferredTotal > 0 ? Math.round(deferredTotal / deferredYears) : 0;

    return {
      ...baseContext,
      offerPrice: fmt(offerPrice),
      enterpriseValue: fmt(enterpriseValue),
      excessCash: fmt(excessCash),
      dayOnePayment: fmt(dayOnePayment),
      deferredTotal: fmt(deferredTotal),
      deferredInstalment: fmt(deferredInstalment),
      _raw: {
        offerPrice,
        enterpriseValue,
        excessCash,
        dayOnePayment,
        deferredTotal,
        deferredInstalment,
        deferredYears,
        averageEbitda: calculations.averageAdjustedEbitda || 0,
        ebitdaMultiple: Number(model.ebitdaMultiple) || 0,
      },
    };
  }

  async getDocumentsForPortal(portalTokenId: number) {
    return db.select().from(dealDocuments)
      .where(
        and(
          eq(dealDocuments.portalTokenId, portalTokenId),
          not(inArray(dealDocuments.status, ['draft', 'withdrawn', 'superseded']))
        )
      )
      .orderBy(desc(dealDocuments.createdAt));
  }

  async isNdaAccepted(portalTokenId: number): Promise<boolean> {
    const [nda] = await db.select().from(dealDocuments)
      .where(
        and(
          eq(dealDocuments.portalTokenId, portalTokenId),
          eq(dealDocuments.documentType, 'nda'),
          eq(dealDocuments.status, 'accepted')
        )
      )
      .limit(1);
    return !!nda;
  }
}

export const dealDocumentService = new DealDocumentService();
