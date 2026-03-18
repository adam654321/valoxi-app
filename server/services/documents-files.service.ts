import { documentsRepository } from '../repositories/documents.repository';
import { financialDataRepository } from '../repositories/financial-data.repository';
import { documentAnalysisRepository } from '../repositories/document-analysis.repository';
import { fileStorageService } from './file-storage.service';
import { NotFoundError, ForbiddenError, BadRequestError } from '../utils/errors';
import type { Document, InsertDocument } from '@shared/schema';

export class DocumentsFilesService {
  async verifyCompanyAccess(targetCompanyId: number, userCompanyId: number): Promise<void> {
    const hasAccess = await documentsRepository.targetCompanyBelongsToUser(targetCompanyId, userCompanyId);
    if (!hasAccess) {
      throw new ForbiddenError('Company not found or access denied');
    }
  }

  async createDocument(data: {
    targetCompanyId: number;
    uploadedBy: number;
    documentName: string;
    originalFilename: string;
    filePath: string;
    fileSize: number;
    fileType: string;
    documentCategory: string;
    description?: string;
    isConfidential?: boolean;
  }): Promise<Document> {
    const documentData: InsertDocument = {
      targetCompanyId: data.targetCompanyId,
      uploadedBy: data.uploadedBy,
      documentName: data.documentName,
      originalFilename: data.originalFilename,
      filePath: data.filePath,
      fileSize: data.fileSize,
      fileType: data.fileType,
      documentCategory: data.documentCategory,
      description: data.description || '',
      isConfidential: data.isConfidential ?? true,
    };
    return await documentsRepository.createDocument(documentData);
  }

  async createFileUploadEvent(data: {
    documentId: number;
    targetCompanyId: number;
    uploadedBy: number;
    fileName: string;
    fileUrl: string;
  }) {
    return await documentsRepository.createFileUploadEvent({
      documentId: data.documentId,
      targetCompanyId: data.targetCompanyId,
      uploadedBy: data.uploadedBy,
      fileName: data.fileName,
      fileUrl: data.fileUrl,
      webhookSent: false,
      webhookStatus: 'pending',
    });
  }

  async getCompanyDocuments(targetCompanyId: number, userCompanyId: number) {
    await this.verifyCompanyAccess(targetCompanyId, userCompanyId);
    const documents = await documentsRepository.getCompanyDocuments(targetCompanyId);
    const grouped = documents.reduce((acc: Record<string, typeof documents>, doc) => {
      const category = doc.documentCategory || 'Uncategorized';
      if (!acc[category]) acc[category] = [];
      acc[category].push(doc);
      return acc;
    }, {});
    return { documents, grouped };
  }

  async getDocument(documentId: number, userCompanyId: number): Promise<Document> {
    const document = await documentsRepository.getDocument(documentId, userCompanyId);
    if (!document) throw new NotFoundError('Document not found or access denied');
    return document;
  }

  async getDocumentPublic(documentId: number): Promise<Document> {
    const document = await documentsRepository.getDocumentByIdPublic(documentId);
    if (!document) throw new NotFoundError('Document not found');
    return document;
  }

  async getDocumentByPublicToken(token: string): Promise<Document> {
    const document = await documentsRepository.getDocumentByPublicToken(token);
    if (!document) throw new NotFoundError('Document not found');
    return document;
  }

  async logAccess(documentId: number, userId: number, accessType: 'view' | 'download', ipAddress?: string): Promise<void> {
    await documentsRepository.logDocumentAccess(documentId, userId, accessType, ipAddress);
  }

  async updateDocument(documentId: number, userCompanyId: number, updates: {
    documentName?: string;
    documentCategory?: string;
    description?: string;
    isConfidential?: boolean;
  }): Promise<Document> {
    const document = await documentsRepository.getDocument(documentId, userCompanyId);
    if (!document) throw new NotFoundError('Document not found or access denied');
    const updated = await documentsRepository.updateDocument(documentId, updates, userCompanyId);
    if (!updated) throw new NotFoundError('Failed to update document');
    return updated;
  }

  async deleteDocument(documentId: number, userCompanyId: number): Promise<void> {
    const document = await documentsRepository.getDocument(documentId, userCompanyId);
    if (document) {
      try {
        await financialDataRepository.deleteByDocumentId(documentId);
      } catch (error) {
        console.error(`[DELETE_DOCUMENT] Error deleting financial data for document ${documentId}:`, error);
      }
      
      try {
        await documentAnalysisRepository.deleteByDocumentId(documentId);
      } catch (error) {
        console.error(`[DELETE_DOCUMENT] Error deleting analysis results for document ${documentId}:`, error);
      }
      
      const success = await documentsRepository.deleteDocument(documentId, userCompanyId);
      if (!success) throw new Error('Failed to delete document');
      if (document.externalSubmissionId) {
        try {
          const externalSubmission = await documentsRepository.getExternalSubmission(document.externalSubmissionId, userCompanyId);
          if (externalSubmission) {
            await fileStorageService.delete(externalSubmission.filePath);
          }
          await documentsRepository.deleteExternalSubmission(document.externalSubmissionId);
        } catch { }
      }
      await fileStorageService.delete(document.filePath);
      return;
    }
    const externalSubmission = await documentsRepository.getExternalSubmission(documentId, userCompanyId);
    if (!externalSubmission) throw new NotFoundError('Document not found or access denied');
    const success = await documentsRepository.deleteExternalSubmission(documentId);
    if (!success) throw new Error('Failed to delete external submission');
    await fileStorageService.delete(externalSubmission.filePath);
  }

  async getDocumentCategories() {
    return await documentsRepository.getDocumentCategories();
  }

  async clearAllCompanyDocuments(userCompanyId: number) {
    return await documentsRepository.clearAllCompanyDocuments(userCompanyId);
  }
}

export const documentsFilesService = new DocumentsFilesService();
