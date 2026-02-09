import { db } from '../db';
import { dealDocuments, dealDocumentResponses, dealDocumentTemplates } from '@shared/schema/deal-documents';
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

    return response;
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
