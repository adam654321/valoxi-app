import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  documents,
  documentCategories,
  documentAccessLog,
  documentAnalysisResults,
  fileUploadEvents,
  externalDocumentSubmissions,
  targetCompanies,
  users,
  type Document,
  type DocumentCategory,
  type InsertDocument,
  type FileUploadEvent,
  type InsertFileUploadEvent,
  type ExternalDocumentSubmission,
} from '@shared/schema';

export interface DocumentWithDetails extends Document {
  uploadedByName: string;
  categoryDescription?: string;
}

export class DocumentsRepository {
  async getDocumentCategories(): Promise<DocumentCategory[]> {
    return [
      { id: 1, categoryName: 'Company Accounts', description: 'Company annual accounts and financial statements (up to 5 files)', isRequired: true, sortOrder: 1, createdAt: new Date() },
      { id: 2, categoryName: 'Profit & Loss', description: 'Profit and loss statements', isRequired: true, sortOrder: 2, createdAt: new Date() },
      { id: 3, categoryName: 'Balance Sheet', description: 'Balance sheet documents', isRequired: true, sortOrder: 3, createdAt: new Date() },
      { id: 4, categoryName: 'Sales Ledger', description: 'Sales ledger and transaction records', isRequired: true, sortOrder: 4, createdAt: new Date() },
      { id: 5, categoryName: 'Asset Register', description: 'Asset register and fixed asset records', isRequired: true, sortOrder: 5, createdAt: new Date() },
      { id: 6, categoryName: 'Staff Matrix', description: 'Staff matrix and employee information', isRequired: true, sortOrder: 6, createdAt: new Date() },
      { id: 7, categoryName: 'Deal Documents', description: 'Legal and deal-related documents including signed NDAs, offer letters, and heads of terms', isRequired: false, sortOrder: 10, createdAt: new Date() }
    ];
  }

  async createDocument(document: InsertDocument): Promise<Document> {
    const [createdDocument] = await db
      .insert(documents)
      .values(document)
      .returning();
    return createdDocument;
  }

  async getCompanyDocuments(targetCompanyId: number): Promise<DocumentWithDetails[]> {
    const result = await db
      .select({
        id: documents.id,
        targetCompanyId: documents.targetCompanyId,
        uploadedBy: documents.uploadedBy,
        documentName: documents.documentName,
        originalFilename: documents.originalFilename,
        filePath: documents.filePath,
        fileSize: documents.fileSize,
        fileType: documents.fileType,
        documentCategory: documents.documentCategory,
        secondaryCategory: documents.secondaryCategory,
        description: documents.description,
        isConfidential: documents.isConfidential,
        uploadDate: documents.uploadDate,
        lastAccessed: documents.lastAccessed,
        accessCount: documents.accessCount,
        createdAt: documents.createdAt,
        externalSubmissionId: documents.externalSubmissionId,
        uploadedByName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
        categoryDescription: sql<string | undefined>`${documentCategories.description}`,
      })
      .from(documents)
      .leftJoin(users, eq(documents.uploadedBy, users.id))
      .leftJoin(documentCategories, eq(documents.documentCategory, documentCategories.categoryName))
      .where(eq(documents.targetCompanyId, targetCompanyId))
      .orderBy(documents.documentCategory, desc(documents.uploadDate));

    return result.sort((a, b) => {
      if (a.documentCategory !== b.documentCategory) {
        return (a.documentCategory || '').localeCompare(b.documentCategory || '');
      }
      const aDate = a.uploadDate ? new Date(a.uploadDate).getTime() : 0;
      const bDate = b.uploadDate ? new Date(b.uploadDate).getTime() : 0;
      return bDate - aDate;
    });
  }

  async getDocument(documentId: number, userCompanyId: number): Promise<Document | undefined> {
    const [document] = await db
      .select()
      .from(documents)
      .leftJoin(targetCompanies, eq(documents.targetCompanyId, targetCompanies.id))
      .where(and(
        eq(documents.id, documentId),
        eq(targetCompanies.userCompanyId, userCompanyId)
      ));
    return document?.documents;
  }

  async getDocumentByIdPublic(documentId: number): Promise<Document | undefined> {
    const [document] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId));
    return document || undefined;
  }

  async updateDocument(documentId: number, document: Partial<InsertDocument>): Promise<Document | undefined> {
    const [updatedDocument] = await db
      .update(documents)
      .set(document)
      .where(eq(documents.id, documentId))
      .returning();
    return updatedDocument;
  }

  async deleteDocument(documentId: number): Promise<boolean> {
    await db.delete(documentAnalysisResults).where(eq(documentAnalysisResults.documentId, documentId));
    await db.delete(fileUploadEvents).where(eq(fileUploadEvents.documentId, documentId));
    await db.delete(documentAccessLog).where(eq(documentAccessLog.documentId, documentId));

    const [deletedDocument] = await db
      .delete(documents)
      .where(eq(documents.id, documentId))
      .returning();
    return !!deletedDocument;
  }

  async logDocumentAccess(documentId: number, userId: number, accessType: string, ipAddress?: string): Promise<void> {
    await db.insert(documentAccessLog).values({
      documentId,
      accessedBy: userId,
      accessType,
      ipAddress: ipAddress || null,
    });

    await db.update(documents)
      .set({ 
        lastAccessed: new Date(),
        accessCount: sql`${documents.accessCount} + 1`
      })
      .where(eq(documents.id, documentId));
  }

  async targetCompanyBelongsToUser(targetCompanyId: number, userCompanyId: number): Promise<boolean> {
    const [company] = await db
      .select({ id: targetCompanies.id })
      .from(targetCompanies)
      .where(and(eq(targetCompanies.id, targetCompanyId), eq(targetCompanies.userCompanyId, userCompanyId)));
    return !!company;
  }

  async createFileUploadEvent(event: InsertFileUploadEvent): Promise<FileUploadEvent> {
    const [createdEvent] = await db.insert(fileUploadEvents).values(event).returning();
    return createdEvent;
  }

  async getFileUploadEvent(eventId: number): Promise<FileUploadEvent | undefined> {
    const [event] = await db.select().from(fileUploadEvents).where(eq(fileUploadEvents.id, eventId));
    return event || undefined;
  }

  async updateFileUploadEventWebhookStatus(eventId: number, status: string, response?: string, sentAt?: Date): Promise<FileUploadEvent | undefined> {
    const [updated] = await db.update(fileUploadEvents)
      .set({ webhookStatus: status, webhookResponse: response, webhookSentAt: sentAt, webhookSent: true })
      .where(eq(fileUploadEvents.id, eventId))
      .returning();
    return updated || undefined;
  }

  async getExternalSubmission(submissionId: number, userCompanyId: number): Promise<ExternalDocumentSubmission | undefined> {
    const [submission] = await db
      .select()
      .from(externalDocumentSubmissions)
      .innerJoin(targetCompanies, eq(externalDocumentSubmissions.targetCompanyId, targetCompanies.id))
      .where(and(
        eq(externalDocumentSubmissions.id, submissionId),
        eq(targetCompanies.userCompanyId, userCompanyId)
      ));
    return submission?.external_document_submissions;
  }

  async deleteExternalSubmission(submissionId: number): Promise<boolean> {
    const [deleted] = await db
      .delete(externalDocumentSubmissions)
      .where(eq(externalDocumentSubmissions.id, submissionId))
      .returning();
    return !!deleted;
  }

  async getTargetCompany(targetCompanyId: number, userCompanyId: number): Promise<{ id: number; userCompanyId: number } | undefined> {
    const [company] = await db
      .select({ id: targetCompanies.id, userCompanyId: targetCompanies.userCompanyId })
      .from(targetCompanies)
      .where(and(eq(targetCompanies.id, targetCompanyId), eq(targetCompanies.userCompanyId, userCompanyId)));
    return company;
  }

  async clearAllCompanyDocuments(userCompanyId: number): Promise<{ 
    deletedDocuments: number;
    deletedExternalSubmissions: number;
    deletedAnalysisResults: number;
    deletedUploadEvents: number;
    deletedDocumentAccessLogs: number;
    filesDeleted: string[];
    filesNotFound: string[];
  }> {
    console.log(`[REPOSITORY] Starting comprehensive document cleanup for user company ${userCompanyId}`);
    
    let deletedDocuments = 0;
    let deletedExternalSubmissions = 0;
    let deletedAnalysisResults = 0;
    let deletedUploadEvents = 0;
    let deletedDocumentAccessLogs = 0;
    const filesDeleted: string[] = [];
    const filesNotFound: string[] = [];

    try {
      const allDocuments = await db
        .select({ id: documents.id, filePath: documents.filePath, targetCompanyId: documents.targetCompanyId })
        .from(documents)
        .innerJoin(targetCompanies, eq(documents.targetCompanyId, targetCompanies.id))
        .where(eq(targetCompanies.userCompanyId, userCompanyId));

      const allExternalSubmissions = await db
        .select({ id: externalDocumentSubmissions.id, filePath: externalDocumentSubmissions.filePath, targetCompanyId: externalDocumentSubmissions.targetCompanyId })
        .from(externalDocumentSubmissions)
        .innerJoin(targetCompanies, eq(externalDocumentSubmissions.targetCompanyId, targetCompanies.id))
        .where(eq(targetCompanies.userCompanyId, userCompanyId));

      const allDocumentIds = allDocuments.map(doc => doc.id);
      const allFilePaths = [
        ...allDocuments.map(doc => doc.filePath),
        ...allExternalSubmissions.map(doc => doc.filePath)
      ];

      console.log(`[REPOSITORY] Found ${allDocuments.length} documents and ${allExternalSubmissions.length} external submissions to delete`);

      if (allDocumentIds.length > 0) {
        const analysisResultsDeleted = await db.delete(documentAnalysisResults)
          .where(sql`${documentAnalysisResults.documentId} IN (${sql.join(allDocumentIds.map(id => sql`${id}`), sql`, `)})`);
        deletedAnalysisResults = analysisResultsDeleted.rowCount || 0;

        const accessLogsDeleted = await db.delete(documentAccessLog)
          .where(sql`${documentAccessLog.documentId} IN (${sql.join(allDocumentIds.map(id => sql`${id}`), sql`, `)})`);
        deletedDocumentAccessLogs = accessLogsDeleted.rowCount || 0;

        const uploadEventsDeleted = await db.delete(fileUploadEvents)
          .where(sql`${fileUploadEvents.documentId} IN (${sql.join(allDocumentIds.map(id => sql`${id}`), sql`, `)})`);
        deletedUploadEvents = uploadEventsDeleted.rowCount || 0;

        const documentsDeleted = await db.delete(documents)
          .where(sql`${documents.id} IN (${sql.join(allDocumentIds.map(id => sql`${id}`), sql`, `)})`);
        deletedDocuments = documentsDeleted.rowCount || 0;
      }

      if (allExternalSubmissions.length > 0) {
        const externalSubmissionIds = allExternalSubmissions.map(sub => sub.id);
        const externalSubmissionsDeleted = await db.delete(externalDocumentSubmissions)
          .where(sql`${externalDocumentSubmissions.id} IN (${sql.join(externalSubmissionIds.map(id => sql`${id}`), sql`, `)})`);
        deletedExternalSubmissions = externalSubmissionsDeleted.rowCount || 0;
      }

      const fs = await import('fs/promises');
      for (const filePath of allFilePaths) {
        if (!filePath) continue;
        try {
          await fs.unlink(filePath);
          filesDeleted.push(filePath);
        } catch (err: any) {
          if (err.code === 'ENOENT') {
            filesNotFound.push(filePath);
          }
        }
      }

      return { deletedDocuments, deletedExternalSubmissions, deletedAnalysisResults, deletedUploadEvents, deletedDocumentAccessLogs, filesDeleted, filesNotFound };
    } catch (error) {
      console.error(`[REPOSITORY] Error during document cleanup:`, error);
      throw error;
    }
  }
}

export const documentsRepository = new DocumentsRepository();
