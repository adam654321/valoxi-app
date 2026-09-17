import { db } from '../db';
import { BadRequestError } from '../utils/errors';
import { dealDocuments, dealDocumentResponses, dealDocumentTemplates, currentOffers } from '@shared/schema/deal-documents';
import { documents } from '@shared/schema/documents';
import { dealModels, dealModelAdjustments, dealModelFundingLines, dealModelSellerPayments, dealModelContingentConsideration } from '@shared/schema/deal-models';
import { financialPeriods, incomeStatements, financialContributions } from '@shared/schema/financials';
import { isProvisionalFinancials } from '../../shared/utils/provisional-financials';
import { eq, and, desc, not, inArray, sql } from 'drizzle-orm';
import { getScreenEbitdaByYear } from './screen-ebitda.service';
import { isOfferPriceSupportable } from '@shared/calculators/deal-model.calc';
import { dealDocumentTemplateService, DocumentDataContext } from './deal-document-template.service';
import { extendPortalTokenForCompany } from './portal-token.service';
import { buildNdaHtml } from '../utils/document-html-builders';
import { fileStorageService } from './file-storage.service';
import { generatePdfFromHtml } from '../utils/pdf-generator';

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

  async sendDocument(documentId: number, triggeringUserId: number) {
    const doc = await this.getDocumentById(documentId);
    if (!doc) throw new Error('Document not found');
    if (doc.status !== 'draft') throw new Error(`Cannot send document in status: ${doc.status}`);
    if (!doc.generatedFileUrl) throw new Error('Document has not been generated yet');

    // Commercial guard #324, at the send boundary. An offer letter cannot leave the
    // building unless its stored price is above zero. A document carrying no verifiable
    // price is blocked too: the generic create path produces an offer letter with no
    // price fields at all, and an unverifiable price is not a sendable one.
    // Commercial guard #324, at the send boundary. This is the ONLY remaining gate in the
    // build. Everything upstream stores and displays the computed figures and warns.
    //
    // The gate exists because this document goes to the SELLER. An offer letter arriving
    // at a business owner reading "-£4,411" is not a negotiating position. Whether to send
    // it is still the acquirer's decision: it just has to be a deliberate one, and it is
    // recorded on the row so it survives a log rotation.
    if (doc.documentType === 'offer_letter') {
      const storedOfferPrice = (doc.documentData as any)?._raw?.offerPrice;
      if (!isOfferPriceSupportable(storedOfferPrice)) {
        if (!doc.unsupportedPriceAcknowledgedAt) {
          console.warn(
            `[DEAL_DOCS] Send blocked for document ${documentId}: stored offer price ${String(storedOfferPrice)} is not supportable and has not been acknowledged`,
          );
          throw new BadRequestError(
            'No offer supportable. This offer letter has no verifiable price above zero. Confirm explicitly that you want to send it, or regenerate it from the deal model.',
          );
        }
        console.warn(
          `[DEAL_DOCS] Sending acknowledged unsupportable offer, document ${documentId}, price ${String(storedOfferPrice)}, acknowledged by user ${String(doc.unsupportedPriceAcknowledgedBy)} at ${doc.unsupportedPriceAcknowledgedAt.toISOString()}`,
        );
      }
    }

    await this.markAsSent(documentId);

    if (doc.documentType === 'offer_letter') {
      try {
        await this.upsertCurrentOffer({
          targetCompanyId: doc.targetCompanyId,
          userCompanyId: doc.userCompanyId,
          dealDocumentId: doc.id,
          dealModelId: doc.dealModelId || null,
          documentData: doc.documentData,
          deliveryMethod: doc.deliveryMethod || 'portal',
          status: 'sent',
        });
      } catch (upsertErr) {
        console.error('[DEAL_DOCS] Failed to upsert current offer on send:', upsertErr);
      }
    }

    const docTypeLabels: Record<string, string> = {
      'nda': 'NDA',
      'offer_letter': 'Offer Letter',
      'heads_of_terms': 'Heads of Terms',
    };
    const docLabel = docTypeLabels[doc.documentType] || doc.documentType;

    let sellerSendResult: {
      success: boolean;
      sentVia: 'nylas' | 'resend';
      fromEmail: string;
      replyToEmail: string | null;
    } | null = null;

    try {
      const { users } = await import('@shared/schema/core');
      const { targetCompanies, targetContacts } = await import('@shared/schema/deals');
      const { portalAccessTokens } = await import('@shared/schema/portal');
      const { emailApiService } = await import('./email.service');

      const [creator] = await db.select().from(users)
        .where(eq(users.id, doc.createdBy));
      const [targetCompany] = await db.select().from(targetCompanies)
        .where(eq(targetCompanies.id, doc.targetCompanyId));
      const companyName = targetCompany?.companyName || 'Unknown Company';
      const buyerCompanyName = (doc.documentData as any)?.buyerCompanyName || 'the buyer';

      if (doc.portalTokenId) {
        const [token] = await db.select().from(portalAccessTokens)
          .where(eq(portalAccessTokens.id, doc.portalTokenId));

        if (token) {
          const [contact] = await db.select().from(targetContacts)
            .where(eq(targetContacts.id, token.targetContactId));

          if (contact?.email) {
            const _baseUrl = process.env.APP_URL || 'https://test.valoxi.ai';
            const portalUrl = `${_baseUrl}/portal/${token.accessToken}`;

            const sellerHtml = `
              <h2>You Have Received ${doc.documentType === 'offer_letter' ? 'an Offer' : `a ${docLabel}`}</h2>
              <p>Dear ${contact.firstName || 'Seller'},</p>
              <p>${buyerCompanyName} has sent you ${doc.documentType === 'offer_letter' ? 'an Offer Letter' : `a ${docLabel}`} regarding <strong>${companyName}</strong>.</p>
              <p>Please log in to your secure portal to review the document and provide your response.</p>
              <p style="margin: 24px 0;">
                <a href="${portalUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">View in Portal</a>
              </p>
              <p style="color: #666; font-size: 12px;">If the button above doesn't work, copy and paste this link into your browser: ${portalUrl}</p>
            `;

            const sellerSubject = `${doc.documentType === 'offer_letter' ? 'Offer Letter' : docLabel} Received — ${companyName}`;
            const sellerResult = await emailApiService.sendCustomerFacingEmail({
              to: contact.email,
              subject: sellerSubject,
              html: sellerHtml,
              userCompanyId: doc.userCompanyId,
              triggeringUserId,
            });
            sellerSendResult = {
              success: sellerResult.success,
              sentVia: sellerResult.sentVia,
              fromEmail: sellerResult.fromEmail,
              replyToEmail: sellerResult.replyToEmail,
            };
            console.log(`[DEAL_DOCS] Seller notification sent to ${contact.email} for ${docLabel} via ${sellerResult.sentVia}, from=${sellerResult.fromEmail}, replyTo=${sellerResult.replyToEmail || 'none'}`);
          }
        }
      }

      if (creator?.email) {
        const offerDetails = doc.documentType === 'offer_letter' && doc.documentData
          ? `<p><strong>Offer Price:</strong> ${(doc.documentData as any).offerPrice || 'N/A'}</p>` : '';

        const buyerHtml = `
          <h2>${docLabel} Sent</h2>
          <p>Your ${docLabel} for <strong>${companyName}</strong> has been sent to the portal successfully.</p>
          ${offerDetails}
          <p><strong>Sent:</strong> ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
          <p>You will receive a notification when the recipient responds.</p>
          <hr>
          <p style="color: #666; font-size: 12px;">Log in to your dashboard to view the document and track its status.</p>
        `;

        const buyerSubject = `${docLabel} Sent Successfully — ${companyName}`;
        await emailApiService.sendCustomEmail(creator.email, buyerSubject, buyerHtml);
        console.log(`[DEAL_DOCS] Send confirmation email sent to ${creator.email} for ${docLabel} to ${companyName}`);
      }
    } catch (emailErr) {
      console.error('[DEAL_DOCS] Failed to send document emails:', emailErr);
    }

    if (doc.documentType === 'offer_letter' || doc.documentType === 'heads_of_terms') {
      const docLabel = doc.documentType === 'offer_letter' ? 'Offer Letter' : 'Heads of Terms';
      await extendPortalTokenForCompany(
        doc.targetCompanyId,
        `${docLabel} sent to seller`
      );
    }

    const updatedDoc = await this.getDocumentById(documentId);
    return { document: updatedDoc, sendResult: sellerSendResult };
  }

  private async markAsSent(documentId: number): Promise<void> {
    await db.update(dealDocuments)
      .set({
        status: 'sent',
        sentAt: new Date(),
      })
      .where(eq(dealDocuments.id, documentId));
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

    if (params.responseType === 'accepted') {
      try {
        const { pipelineRepository } = await import('../repositories/pipeline.repository');
        const { targetCompanies } = await import('@shared/schema/deals');

        const [company] = await db.select({ stage: targetCompanies.stage })
          .from(targetCompanies)
          .where(eq(targetCompanies.id, doc.targetCompanyId));

        const stageOrder = ['New Target', 'Initial Contact', 'Documents Requested', 'Under Review', 'Offer Stage', 'Heads of Terms', 'Due Diligence', 'Legal & Accounting', 'Completion', 'Not Qualified'];
        const currentIdx = stageOrder.indexOf(company?.stage || '');

        if (doc.documentType === 'offer_letter') {
          const targetIdx = stageOrder.indexOf('Heads of Terms');
          if (currentIdx < targetIdx) {
            await pipelineRepository.updateCompanyStage(
              doc.targetCompanyId,
              'Heads of Terms',
              doc.createdBy,
              'Auto-progressed: Offer Letter accepted by seller'
            );
            console.log(`[DEAL_DOCS] Auto-progressed company ${doc.targetCompanyId} to Heads of Terms`);
          }
        } else if (doc.documentType === 'heads_of_terms') {
          const targetIdx = stageOrder.indexOf('Due Diligence');
          if (currentIdx < targetIdx) {
            await pipelineRepository.updateCompanyStage(
              doc.targetCompanyId,
              'Due Diligence',
              doc.createdBy,
              'Auto-progressed: Heads of Terms accepted by seller'
            );
            console.log(`[DEAL_DOCS] Auto-progressed company ${doc.targetCompanyId} to Due Diligence`);
          }
        }
      } catch (stageErr) {
        console.error('[DEAL_DOCS] Auto-stage-progression failed (non-critical):', stageErr);
      }

      if (doc.documentType === 'heads_of_terms') {
        await extendPortalTokenForCompany(
          doc.targetCompanyId,
          'Heads of Terms accepted — Stage 2 activated'
        );
      }

      if (doc.documentType === 'offer_letter') {
        await extendPortalTokenForCompany(
          doc.targetCompanyId,
          'Offer Letter accepted'
        );
      }

      if (doc.documentType === 'offer_letter') {
        try {
          await this.upsertCurrentOffer({
            targetCompanyId: doc.targetCompanyId,
            userCompanyId: doc.userCompanyId,
            dealDocumentId: doc.id,
            dealModelId: doc.dealModelId || null,
            documentData: doc.documentData,
            deliveryMethod: doc.deliveryMethod || 'portal',
            status: 'accepted',
            acceptedAt: new Date(),
            acceptedBy: params.respondentName,
          });
        } catch (upsertErr) {
          console.error('[DEAL_DOCS] Failed to upsert current offer on portal accept:', upsertErr);
        }
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
    if (!doc.documentData) throw new Error('Document data not found');

    const html = buildNdaHtml(doc.documentData as any);

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

    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await generatePdfFromHtml(signedHtml);
    } catch (puppeteerErr) {
      console.error('[DEAL_DOCS] Puppeteer PDF generation failed:', puppeteerErr);
      throw new Error('PDF generation not available on this platform');
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const pdfFilename = `signed_nda_${doc.targetCompanyId}_${timestamp}.pdf`;
    const r2Key = fileStorageService.generateKey('signed-ndas', pdfFilename);
    await fileStorageService.upload(r2Key, pdfBuffer);
    console.log(`[DEAL_DOCS] Signed NDA uploaded to R2: ${r2Key}`);

    await db.update(dealDocuments)
      .set({ generatedFileUrl: r2Key })
      .where(eq(dealDocuments.id, params.documentId));

    try {
      const sellerName = params.respondentName || 'Seller';
      const companyData = (doc.documentData as any);
      const sellerCompanyName = companyData?.sellerCompanyName || '';
      const docName = sellerCompanyName
        ? `Signed NDA - ${sellerCompanyName}`
        : `Signed NDA - ${sellerName}`;

      const { randomUUID } = await import('crypto');
      await db.insert(documents).values({
        targetCompanyId: doc.targetCompanyId,
        uploadedBy: doc.createdBy,
        documentName: docName,
        originalFilename: pdfFilename,
        filePath: r2Key,
        fileSize: pdfBuffer.length,
        fileType: 'application/pdf',
        documentCategory: 'Deal Documents',
        description: `Signed NDA accepted by ${sellerName} on ${signedDate}. Electronic acceptance with IP address and timestamp recorded.`,
        isConfidential: true,
        publicToken: randomUUID(),
      });
      console.log(`[DEAL_DOCS] Signed NDA saved to Document Library for target company ${doc.targetCompanyId}`);
    } catch (libErr) {
      console.error('[DEAL_DOCS] Failed to save signed PDF to Document Library:', libErr);
    }

    return r2Key;
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

  async getDocumentsForCompany(targetCompanyId: number, userCompanyId: number) {
    return db.select().from(dealDocuments)
      .where(and(
        eq(dealDocuments.targetCompanyId, targetCompanyId),
        eq(dealDocuments.userCompanyId, userCompanyId),
      ))
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

  async getVersionHistory(targetCompanyId: number, documentType: string, userCompanyId: number) {
    const docs = await db.select().from(dealDocuments)
      .where(
        and(
          eq(dealDocuments.targetCompanyId, targetCompanyId),
          eq(dealDocuments.documentType, documentType),
          eq(dealDocuments.userCompanyId, userCompanyId),
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

      await this.markAsSent(doc.id);

      console.log(`[DEAL_DOCS] NDA created and made available in portal ${params.portalTokenId} (doc id: ${doc.id})`);
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
    const [acceptedOffer] = await db.select({ id: dealDocuments.id })
      .from(dealDocuments)
      .where(and(
        eq(dealDocuments.targetCompanyId, params.targetCompanyId),
        eq(dealDocuments.documentType, 'offer_letter'),
        eq(dealDocuments.status, 'accepted')
      ))
      .limit(1);

    if (acceptedOffer) {
      throw new BadRequestError(
        'An offer letter has already been accepted for this company. To continue, proceed to Heads of Terms.'
      );
    }

    const offerData = await this.buildOfferDataContext(
      params.dealModelId,
      params.targetCompanyId,
      params.userCompanyId,
      params.createdBy
    );

    const existingOffer = await this.getLatestActiveDocument(params.targetCompanyId, 'offer_letter');

    let doc;
    if (existingOffer && ['sent', 'viewed', 'countered', 'rejected'].includes(existingOffer.status)) {
      doc = await this.createNewVersion(existingOffer.id, params.createdBy, {
        dealModelId: params.dealModelId,
      });
      if (params.portalTokenId && doc.portalTokenId !== params.portalTokenId) {
        await db.update(dealDocuments)
          .set({ portalTokenId: params.portalTokenId })
          .where(eq(dealDocuments.id, doc.id));
        doc = { ...doc, portalTokenId: params.portalTokenId };
      }
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

    await this.generateDocumentFile(doc.id, offerData);

    const { track } = await import('./funnel.service');
    track(params.userCompanyId, params.createdBy, 'document.generated', { documentType: 'offer_letter' });

    return doc;
  }

  async createOfflineOfferFromDealModel(params: {
    targetCompanyId: number;
    userCompanyId: number;
    dealModelId: number;
    createdBy: number;
  }) {
    const offerData = await this.buildOfferDataContext(
      params.dealModelId,
      params.targetCompanyId,
      params.userCompanyId,
      params.createdBy
    );

    const doc = await this.createDocument({
      targetCompanyId: params.targetCompanyId,
      userCompanyId: params.userCompanyId,
      documentType: 'offer_letter',
      createdBy: params.createdBy,
      dealModelId: params.dealModelId,
    });

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

    const sellerPaymentRows = await db.select().from(dealModelSellerPayments)
      .where(eq(dealModelSellerPayments.dealModelId, dealModelId));

    const contingentConsiderationRows = await db.select().from(dealModelContingentConsideration)
      .where(eq(dealModelContingentConsideration.dealModelId, dealModelId));

    const adjustments = await db.select().from(dealModelAdjustments)
      .where(eq(dealModelAdjustments.dealModelId, dealModelId));

    // The offer must use the same expert-derived EBITDA map the user saw on screen.
    const [reportedEbitdaByYear, contributionTiers] = await Promise.all([
      getScreenEbitdaByYear(targetCompanyId),
      db.select({ sourceTier: financialContributions.sourceTier })
        .from(financialContributions)
        .where(eq(financialContributions.targetCompanyId, targetCompanyId)),
    ]);
    if (Object.keys(reportedEbitdaByYear).length === 0) {
      throw new BadRequestError(
        'Cannot generate the offer letter because the deal model has no financial years with EBITDA.'
      );
    }
    const provisionalFinancials = isProvisionalFinancials(contributionTiers);

    const { calculateFullDealModel, assessOfferSupportability } = await import('@shared/calculators/deal-model.calc');

    const modelInput = {
      averagingYears: model.averagingYears || 3,
      ebitdaMultiple: model.ebitdaMultiple || '3.0',
      plusExcessCash: model.plusExcessCash || '0',
      minusPrimaryDebt: model.minusPrimaryDebt || '0',
      minusOtherDebt: model.minusOtherDebt || '0',
      minusCorpTaxDue: model.minusCorpTaxDue || '0',
      minusWorkingCapitalAdj: model.minusWorkingCapitalAdj || '0',
      plusPropertyValue: model.propertyValue || '0',
      feeLegalDdAmount: model.feeLegalDdAmount ?? '0',
      feeAccountingDdAmount: model.feeAccountingDdAmount ?? '0',
      feeLoanArrangementAmount: model.feeLoanArrangementAmount ?? '0',
      feeDealMakerAmount: model.feeDealMakerAmount ?? '0',
      customFees: (model.customFees as Array<{ label: string; amount: string | number }>) ?? [],
      offerDriver: model.offerDriver ?? 'ebitda',
      targetOfferPrice: model.targetOfferPrice ?? null,
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

    const sellerPaymentInputs = sellerPaymentRows.map(s => ({
      amount: s.amount,
      termMonths: s.termMonths,
      interestRate: s.interestRate,
      isActive: s.isActive ?? false,
    }));

    const contingentConsiderationInputs = contingentConsiderationRows.map(c => ({
      maximumAmount: c.maximumAmount,
      termMonths: c.termMonths,
      isActive: c.isActive ?? false,
    }));

    let calculations: any = {};
    try {
      calculations = calculateFullDealModel(
        reportedEbitdaByYear,
        adjustmentInputs,
        fundingLineInputs,
        modelInput,
        sellerPaymentInputs,
        contingentConsiderationInputs
      );
    } catch (err) {
      console.error('[DEAL_DOCS] Calculator error:', err);
    }

    // Commercial guards #296 and #324, at the compute boundary.
    // Deliberately OUTSIDE the try/catch above: that catch swallows calculator errors and
    // leaves calculations empty, so a guard placed inside it would fail OPEN. An absent
    // offerPrice, which is exactly the swallowed-error case, is not supportable and is
    // blocked here as well.
    const supportability = assessOfferSupportability(
      reportedEbitdaByYear,
      calculations.offerPrice,
    );
    if (!supportability.supportable) {
      // Warn, do not refuse. Building the document is the acquirer's decision and the
      // figures shown are the real computed ones. The gate is at the send boundary,
      // where the document would leave for the seller, and it is derived there from the
      // stored _raw.offerPrice rather than from a flag written here.
      console.warn(
        `[DEAL_DOCS] Unsupported offer for company ${targetCompanyId}, deal model ${dealModelId}: ${supportability.reason}. Document built as computed.`,
      );
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
    const propertyValue = Number(model.propertyValue) || 0;
    const primaryDebt = Number(model.minusPrimaryDebt) || 0;
    const otherDebt = Number(model.minusOtherDebt) || 0;
    const corpTaxDue = Number(model.minusCorpTaxDue) || 0;
    const workingCapitalAdj = Number(model.minusWorkingCapitalAdj) || 0;

    const activeSellerPayments = sellerPaymentRows.filter(s => s.isActive);
    const deferredAmount = activeSellerPayments.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
    const singleSeller = activeSellerPayments.length === 1 ? activeSellerPayments[0] : null;
    const deferredTermMonths = singleSeller ? (singleSeller.termMonths || 0) : 0;
    const deferredTerms = deferredTermMonths > 0
      ? `Payable over ${deferredTermMonths} months post-completion`
      : '';
    const monthlyInstalment = (principal: number, ratePct: number, months: number): number => {
      if (principal <= 0 || months <= 0) return 0;
      const r = ratePct / 100 / 12;
      if (r === 0) return principal / months;
      const f = Math.pow(1 + r, months);
      return (principal * r * f) / (f - 1);
    };
    const deferredInstalmentAmount = singleSeller && deferredTermMonths > 0
      ? Math.round(monthlyInstalment(Number(singleSeller.amount) || 0, Number(singleSeller.interestRate) || 0, deferredTermMonths) * 100) / 100
      : 0;
    const deferredInstalment = deferredInstalmentAmount > 0
      ? `${fmt(deferredInstalmentAmount)} per month over ${deferredTermMonths} months`
      : '';

    const activeEarnouts = contingentConsiderationRows.filter(c => c.isActive);
    const earnoutMaximum = activeEarnouts.reduce((sum, c) => sum + (Number(c.maximumAmount) || 0), 0);
    const singleEarnout = activeEarnouts.length === 1 ? activeEarnouts[0] : null;
    const earnoutTermMonths = singleEarnout ? (singleEarnout.termMonths || 0) : 0;
    const earnoutMetric = singleEarnout ? (singleEarnout.triggerDescription || '') : '';

    const dayOnePayment = offerPrice - deferredAmount - earnoutMaximum;
    const transactionType = (model as any).transactionType || 'share_sale';
    const transactionTypeLabel = transactionType === 'asset_sale' ? 'Asset Sale' : 'Share Sale';

    const breakdownLines: string[] = [];
    const ifCostForValuation = calculations.receivablesInterestAnnual || 0;
    const valuationEbitdaForDoc = calculations.valuationEbitda || calculations.averageAdjustedEbitda || 0;
    if (ifCostForValuation > 0) {
      // Seller-facing documents present the valuation EBITDA as the basis and do not expose the
      // invoice finance deduction (Adam, Jun 2026): showing the buyer's financing cost on the offer
      // invites seller questions. The buyer keeps the full breakdown on screen, not in the document.
      breakdownLines.push(`Valuation EBITDA: ${fmt(valuationEbitdaForDoc)}`);
      breakdownLines.push(`Enterprise Value (Valuation EBITDA × ${(Number(model.ebitdaMultiple) || 0).toFixed(2)} multiple): ${fmt(enterpriseValue)}`);
    } else {
      breakdownLines.push(`Average Adjusted EBITDA: ${fmt(calculations.averageAdjustedEbitda || 0)}`);
      breakdownLines.push(`Enterprise Value (Adjusted EBITDA × ${(Number(model.ebitdaMultiple) || 0).toFixed(2)} multiple): ${fmt(enterpriseValue)}`);
    }
    if (excessCash > 0) breakdownLines.push(`Plus Excess Cash: ${fmt(excessCash)}`);
    if (propertyValue > 0) breakdownLines.push(`Plus Property Value: ${fmt(propertyValue)}`);
    if (primaryDebt > 0) breakdownLines.push(`Less Primary Debt: (${fmt(primaryDebt)})`);
    if (otherDebt > 0) breakdownLines.push(`Less Other Debt: (${fmt(otherDebt)})`);
    if (corpTaxDue > 0) breakdownLines.push(`Less Corporation Tax Due: (${fmt(corpTaxDue)})`);
    if (workingCapitalAdj > 0) breakdownLines.push(`Less Working Capital Adjustment: (${fmt(workingCapitalAdj)})`);
    breakdownLines.push('');
    breakdownLines.push(`Total Offer Price: ${fmt(offerPrice)}`);

    const paymentLines: string[] = [];
    if (dayOnePayment > 0) {
      paymentLines.push(`Payment due to the seller at closing: ${fmt(dayOnePayment)}`);
    }
    if (deferredAmount > 0) {
      paymentLines.push('');
      paymentLines.push(`Deferred consideration: ${fmt(deferredAmount)}`);
      if (deferredInstalment) {
        paymentLines.push(`Payable at: ${deferredInstalment}`);
      } else if (deferredTerms) {
        paymentLines.push(`Deferred terms: ${deferredTerms}`);
      }
    }
    if (earnoutMaximum > 0) {
      paymentLines.push('');
      paymentLines.push(`Earnout: ${fmt(earnoutMaximum)}`);
      if (earnoutMetric) {
        paymentLines.push(`Earnout details: ${earnoutMetric}`);
      }
      if (earnoutTermMonths > 0) {
        paymentLines.push(`Earnout period: ${earnoutTermMonths} months`);
      }
    }

    return {
      ...baseContext,
      isProvisionalFinancials: provisionalFinancials,
      offerPrice: fmt(offerPrice),
      enterpriseValue: fmt(enterpriseValue),
      excessCash: fmt(excessCash),
      dayOnePayment: fmt(dayOnePayment),
      breakdownText: breakdownLines.join('\n'),
      paymentText: paymentLines.join('\n'),
      deferredTotal: fmt(deferredAmount),
      deferredInstalment,
      transactionType,
      transactionTypeLabel,
      transactionDescription: transactionType === 'asset_sale'
        ? 'the business and specified assets'
        : '100% of the share capital',
      _raw: {
        offerPrice,
        enterpriseValue,
        excessCash,
        propertyValue,
        primaryDebt,
        otherDebt,
        corpTaxDue,
        workingCapitalAdj,
        dayOnePayment,
        deferredAmount,
        deferredTerms,
        earnoutMaximum,
        earnoutMetric,
        earnoutTermMonths,
        deferredInstalment,
        deferredTermMonths,
        transactionType,
        transactionTypeLabel,
        averageEbitda: calculations.averageAdjustedEbitda || 0,
        valuationEbitda: calculations.valuationEbitda || 0,
        ebitdaMultiple: Number(model.ebitdaMultiple) || 0,
      },
    };
  }

  async createHoTFromAcceptedOffer(params: {
    targetCompanyId: number;
    userCompanyId: number;
    createdBy: number;
    portalTokenId?: number;
    generateFile?: boolean;
    hotTerms: {
      exclusivityPeriodDays?: number;
      nonCompetePeriodYears?: number;
      nonSolicitPeriodYears?: number;
      warrantyClaimPeriodMonths?: number;
      warrantyMinClaim?: number;
      additionalConditions?: string;
      targetCompletionWeeks?: number;
    };
  }) {
    const [acceptedOffer] = await db.select().from(dealDocuments)
      .where(
        and(
          eq(dealDocuments.targetCompanyId, params.targetCompanyId),
          eq(dealDocuments.documentType, 'offer_letter'),
          eq(dealDocuments.status, 'accepted')
        )
      )
      .orderBy(desc(dealDocuments.version))
      .limit(1);

    if (!acceptedOffer) {
      throw new Error('Cannot generate Heads of Terms without an accepted offer letter');
    }

    const existingHot = await this.getLatestActiveDocument(params.targetCompanyId, 'heads_of_terms');

    const shouldGenerateFile = params.generateFile !== false;

    let doc;
    if (existingHot && ['sent', 'viewed', 'countered', 'rejected'].includes(existingHot.status)) {
      doc = await this.createNewVersion(existingHot.id, params.createdBy, {
        dealModelId: acceptedOffer.dealModelId || undefined,
      });
    } else if (existingHot && existingHot.status === 'draft') {
      doc = existingHot;
    } else {
      const acceptedTransactionType = (acceptedOffer.documentData as any)?.transactionType || 'share_sale';
      const hotDocumentType = acceptedTransactionType === 'asset_sale'
        ? 'heads_of_terms_asset_sale'
        : 'heads_of_terms';
      const hotTemplate = await dealDocumentTemplateService.getSystemTemplate(hotDocumentType);
      if (!hotTemplate) {
        throw new Error(`No active Heads of Terms template found for transaction type: ${acceptedTransactionType}`);
      }

      let resolvedPortalTokenId = params.portalTokenId;
      if (!resolvedPortalTokenId) {
        const { portalRepository } = await import('../repositories/portal.repository');
        const activeToken = await portalRepository.getActiveTokenForCompany(params.targetCompanyId);
        if (activeToken) {
          resolvedPortalTokenId = activeToken.id;
        }
      }

      doc = await this.createDocument({
        targetCompanyId: params.targetCompanyId,
        userCompanyId: params.userCompanyId,
        documentType: 'heads_of_terms',
        createdBy: params.createdBy,
        dealModelId: acceptedOffer.dealModelId || undefined,
        portalTokenId: resolvedPortalTokenId,
        templateId: hotTemplate.id,
        sectionConfig: hotTemplate.sections as any,
      });
    }

    const acceptedOfferData = acceptedOffer.documentData as any;
    const raw = acceptedOfferData?._raw || {};

    const terms = {
      exclusivityPeriodDays: params.hotTerms.exclusivityPeriodDays ?? 90,
      nonCompetePeriodYears: params.hotTerms.nonCompetePeriodYears ?? 2,
      nonSolicitPeriodYears: params.hotTerms.nonSolicitPeriodYears ?? 2,
      warrantyClaimPeriodMonths: params.hotTerms.warrantyClaimPeriodMonths ?? 18,
      warrantyMinClaim: params.hotTerms.warrantyMinClaim ?? 5000,
      additionalConditions: params.hotTerms.additionalConditions || '',
      targetCompletionWeeks: params.hotTerms.targetCompletionWeeks ?? 12,
    };

    const fmt = (val: any) => {
      const num = Number(val) || 0;
      return new Intl.NumberFormat('en-GB', {
        style: 'currency', currency: 'GBP',
        minimumFractionDigits: 0, maximumFractionDigits: 0,
      }).format(num);
    };

    const documentData: Record<string, any> = {
      // Parties
      buyerCompanyName:          acceptedOfferData.buyerCompanyName,
      sellerCompanyName:         acceptedOfferData.sellerCompanyName,
      sellerContactName:         acceptedOfferData.sellerContactName,
      sellerAddress:             acceptedOfferData.sellerAddress,
      buyerSignatoryName:        acceptedOfferData.buyerSignatoryName,
      buyerSignatoryTitle:       acceptedOfferData.buyerSignatoryTitle,
      // Transaction type
      transactionType:           acceptedOfferData.transactionType || 'share_sale',
      transactionTypeLabel:      acceptedOfferData.transactionTypeLabel || 'Share Sale',
      transactionDescription:    acceptedOfferData.transactionDescription || '100% of the share capital',
      // Price — all pre-formatted strings, no £ prefix in template
      offerPrice:                acceptedOfferData.offerPrice,
      dayOnePayment:             acceptedOfferData.dayOnePayment,
      deferredTotal:             acceptedOfferData.deferredTotal,
      deferredInstalment:        acceptedOfferData.deferredInstalment || '',
      deferredTermMonths:        raw.deferredTermMonths ?? 0,
      earnoutMaximum:            raw.earnoutMaximum > 0 ? fmt(raw.earnoutMaximum) : '',
      earnoutMetric:             raw.earnoutMetric || '',
      earnoutTermMonths:         raw.earnoutTermMonths ?? 0,
      // Pre-assembled text blocks
      breakdownText:             acceptedOfferData.breakdownText || '',
      paymentText:               acceptedOfferData.paymentText || '',
      // Deal terms
      exclusivityPeriodDays:     terms.exclusivityPeriodDays,
      nonCompetePeriodYears:     terms.nonCompetePeriodYears,
      nonSolicitPeriodYears:     terms.nonSolicitPeriodYears,
      warrantyClaimPeriodMonths: terms.warrantyClaimPeriodMonths,
      warrantyMinClaim:          fmt(terms.warrantyMinClaim),
      targetCompletionWeeks:     terms.targetCompletionWeeks,
      additionalConditions:      terms.additionalConditions || '',
      currentDate:               new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      _raw: {
        ...raw,
        ...terms,
      },
    };

    if (shouldGenerateFile) {
      await this.generateDocumentFile(doc.id, documentData as Partial<DocumentDataContext>);
    } else {
      await db.update(dealDocuments)
        .set({ documentData })
        .where(eq(dealDocuments.id, doc.id));
    }

    const { track } = await import('./funnel.service');
    track(params.userCompanyId, params.createdBy, 'document.generated', { documentType: 'heads_of_terms' });

    return doc;
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

  /**
   * Records that a user has explicitly confirmed sending an offer whose computed price is
   * at or below zero. Written before the send, read by sendDocument.
   *
   * Deliberately NOT a boolean toggle: there is no un-acknowledge. If the document is
   * regenerated with a supportable price the guard stops applying anyway, and if it is
   * regenerated still unsupportable the acquirer should confirm again, so the caller
   * clears it on regeneration rather than this method offering a way to unset it.
   */
  async acknowledgeUnsupportedPrice(
    documentId: number,
    userId: number,
  ): Promise<{ acknowledgedAt: Date }> {
    const acknowledgedAt = new Date();
    await db
      .update(dealDocuments)
      .set({
        unsupportedPriceAcknowledgedAt: acknowledgedAt,
        unsupportedPriceAcknowledgedBy: userId,
      })
      .where(eq(dealDocuments.id, documentId));

    console.warn(
      `[DEAL_DOCS] Unsupportable price acknowledged for document ${documentId} by user ${userId}`,
    );

    return { acknowledgedAt };
  }

  async upsertCurrentOffer(params: {
    targetCompanyId: number;
    userCompanyId: number;
    dealDocumentId: number;
    dealModelId: number | null;
    documentData: any;
    deliveryMethod: string;
    status?: string;
    acceptedAt?: Date | null;
    acceptedBy?: string | null;
  }) {
    const status = params.status || 'sent';
    const data = params.documentData as any;

    // Commercial guard #324, at the store boundary. current_offers is the row the rest of
    // the application reads as "the price", so nothing at or below zero may land in it.
    // NOTE: three of this method's four callers wrap the call in a try/catch that only
    // logs. This throw therefore stops the WRITE but does not stop the caller, which is
    // why the send path and the manual-status route carry their own guards.
    if (!isOfferPriceSupportable(data?._raw?.offerPrice)) {
      // Stored as computed. current_offers must reflect what the model actually says,
      // including a negative price, or the record disagrees with the deal model.
      console.warn(
        `[DEAL_DOCS] Storing unsupportable offer price for target company ${params.targetCompanyId}, document ${params.dealDocumentId}: ${String(data?._raw?.offerPrice)}`,
      );
    }

    await db.insert(currentOffers).values({
      targetCompanyId: params.targetCompanyId,
      userCompanyId: params.userCompanyId,
      dealDocumentId: params.dealDocumentId,
      dealModelId: params.dealModelId,
      offerPrice: data?.offerPrice || null,
      enterpriseValue: data?.enterpriseValue || null,
      transactionType: data?.transactionType || null,
      documentData: params.documentData,
      deliveryMethod: params.deliveryMethod,
      status,
      sentAt: status === 'sent' ? new Date() : null,
      acceptedAt: params.acceptedAt || null,
      acceptedBy: params.acceptedBy || null,
    }).onConflictDoUpdate({
      target: currentOffers.targetCompanyId,
      set: {
        dealDocumentId: sql`excluded.deal_document_id`,
        dealModelId: sql`excluded.deal_model_id`,
        offerPrice: sql`excluded.offer_price`,
        enterpriseValue: sql`excluded.enterprise_value`,
        transactionType: sql`excluded.transaction_type`,
        documentData: sql`excluded.document_data`,
        deliveryMethod: sql`excluded.delivery_method`,
        status: sql`excluded.status`,
        sentAt: sql`excluded.sent_at`,
        acceptedAt: sql`excluded.accepted_at`,
        acceptedBy: sql`excluded.accepted_by`,
        updatedAt: new Date(),
      },
    });
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
