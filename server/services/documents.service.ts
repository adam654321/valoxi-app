import { documentsRepository, type DocumentWithDetails } from '../repositories/documents.repository';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/errors';
import type { Document, DocumentCategory, InsertDocument } from '@shared/schema';

export class DocumentsService {
  async getDocumentCategories(): Promise<DocumentCategory[]> {
    return await documentsRepository.getDocumentCategories();
  }

  async createDocument(documentData: InsertDocument, userCompanyId: number): Promise<Document> {
    const hasAccess = await documentsRepository.targetCompanyBelongsToUser(
      documentData.targetCompanyId,
      userCompanyId
    );
    if (!hasAccess) {
      throw new NotFoundError('Company not found or access denied');
    }

    return await documentsRepository.createDocument(documentData);
  }

  async getCompanyDocuments(
    targetCompanyId: number,
    userCompanyId: number
  ): Promise<{ [category: string]: DocumentWithDetails[] }> {
    if (!targetCompanyId || isNaN(targetCompanyId)) {
      throw new BadRequestError('Invalid company ID');
    }

    const hasAccess = await documentsRepository.targetCompanyBelongsToUser(targetCompanyId, userCompanyId);
    if (!hasAccess) {
      throw new NotFoundError('Company not found or access denied');
    }

    const docs = await documentsRepository.getCompanyDocuments(targetCompanyId);
    
    const grouped = docs.reduce((acc: { [key: string]: DocumentWithDetails[] }, doc) => {
      const category = doc.documentCategory || 'Uncategorized';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(doc);
      return acc;
    }, {});

    return grouped;
  }

  async getDocument(documentId: number, userCompanyId: number): Promise<Document> {
    if (!documentId || isNaN(documentId)) {
      throw new BadRequestError('Invalid document ID');
    }

    const document = await documentsRepository.getDocument(documentId, userCompanyId);
    if (!document) {
      throw new NotFoundError('Document not found or access denied');
    }

    return document;
  }

  async getDocumentPublic(documentId: number): Promise<Document> {
    if (!documentId || isNaN(documentId)) {
      throw new BadRequestError('Invalid document ID');
    }

    const document = await documentsRepository.getDocumentByIdPublic(documentId);
    if (!document) {
      throw new NotFoundError('Document not found');
    }

    return document;
  }

  async updateDocument(
    documentId: number,
    updateData: Partial<InsertDocument>,
    userCompanyId: number
  ): Promise<Document> {
    if (!documentId || isNaN(documentId)) {
      throw new BadRequestError('Invalid document ID');
    }

    const existing = await documentsRepository.getDocument(documentId, userCompanyId);
    if (!existing) {
      throw new NotFoundError('Document not found or access denied');
    }

    const updated = await documentsRepository.updateDocument(documentId, updateData, userCompanyId);
    if (!updated) {
      throw new NotFoundError('Document not found');
    }

    return updated;
  }

  async deleteDocument(documentId: number, userCompanyId: number): Promise<boolean> {
    if (!documentId || isNaN(documentId)) {
      throw new BadRequestError('Invalid document ID');
    }

    const existing = await documentsRepository.getDocument(documentId, userCompanyId);
    if (!existing) {
      throw new NotFoundError('Document not found or access denied');
    }

    return await documentsRepository.deleteDocument(documentId, userCompanyId);
  }

  async logDocumentAccess(
    documentId: number,
    userId: number,
    accessType: string,
    ipAddress?: string
  ): Promise<void> {
    await documentsRepository.logDocumentAccess(documentId, userId, accessType, ipAddress);
  }
}

export const documentsService = new DocumentsService();
