import { db } from "../db";
import {
  documents,
  documentCategories,
  documentAccessLog,
  documentAnalysisResults,
  fileUploadEvents,
  stage1AnalysisEvents,
  externalDocumentSubmissions,
  targetCompanies,
  users,
  type Document,
  type DocumentCategory,
  type DocumentAccessLog,
  type DocumentAnalysisResult,
  type FileUploadEvent,
  type Stage1AnalysisEvent,
  type InsertDocument,
  type InsertDocumentAccessLog,
  type InsertDocumentAnalysisResult,
  type InsertFileUploadEvent,
  type InsertStage1AnalysisEvent,
} from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";

type DbInstance = typeof db;

export class DocumentStore {
  constructor(private db: DbInstance) {}

  async getDocumentCategories(): Promise<DocumentCategory[]> {
    return [
      { id: 1, categoryName: 'Company Accounts', description: 'Company annual accounts and financial statements (up to 5 files)', isRequired: true, sortOrder: 1, createdAt: new Date() },
      { id: 2, categoryName: 'Profit & Loss', description: 'Profit and loss statements', isRequired: true, sortOrder: 2, createdAt: new Date() },
      { id: 3, categoryName: 'Balance Sheet', description: 'Balance sheet documents', isRequired: true, sortOrder: 3, createdAt: new Date() },
      { id: 4, categoryName: 'Sales Ledger', description: 'Sales ledger and transaction records', isRequired: true, sortOrder: 4, createdAt: new Date() },
      { id: 5, categoryName: 'Asset Register', description: 'Asset register and fixed asset records', isRequired: true, sortOrder: 5, createdAt: new Date() },
      { id: 6, categoryName: 'Staff Matrix', description: 'Staff matrix and employee information', isRequired: true, sortOrder: 6, createdAt: new Date() }
    ];
  }

  async createDocument(document: InsertDocument): Promise<Document> {
    const [createdDocument] = await this.db
      .insert(documents)
      .values(document)
      .returning();
    return createdDocument;
  }

  async getCompanyDocuments(targetCompanyId: number, userCompanyId: number): Promise<(Document & { uploadedByName: string; categoryDescription?: string })[]> {
    const company = await this.getTargetCompany(targetCompanyId, userCompanyId);
    if (!company) {
      return [];
    }

    console.log(`[getCompanyDocuments] Fetching documents for targetCompanyId: ${targetCompanyId}, userCompanyId: ${userCompanyId}`);

    const regularDocuments = await this.db
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

    const externalDocuments: any[] = [];

    console.log(`[getCompanyDocuments] Regular documents found: ${regularDocuments.length}`);
    console.log(`[getCompanyDocuments] External unprocessed documents found: ${externalDocuments.length}`);
    
    regularDocuments.forEach((doc, index) => {
      console.log(`[getCompanyDocuments] Regular doc ${index + 1}: ID=${doc.id}, name="${doc.documentName}", category="${doc.documentCategory}", externalSubmissionId=${doc.externalSubmissionId}`);
    });

    const allDocuments = [...regularDocuments, ...externalDocuments];
    
    console.log(`[getCompanyDocuments] Total combined documents: ${allDocuments.length}`);
    
    return allDocuments.sort((a, b) => {
      if (a.documentCategory !== b.documentCategory) {
        return (a.documentCategory || '').localeCompare(b.documentCategory || '');
      }
      const aDate = a.uploadDate ? new Date(a.uploadDate).getTime() : 0;
      const bDate = b.uploadDate ? new Date(b.uploadDate).getTime() : 0;
      return bDate - aDate;
    });
  }

  async getDocument(documentId: number, userCompanyId: number): Promise<Document | undefined> {
    const [document] = await this.db
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
    const [document] = await this.db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId));
    return document || undefined;
  }

  async updateDocument(documentId: number, document: Partial<InsertDocument>, userCompanyId: number): Promise<Document | undefined> {
    const existingDocument = await this.getDocument(documentId, userCompanyId);
    if (!existingDocument) {
      return undefined;
    }

    const [updatedDocument] = await this.db
      .update(documents)
      .set(document)
      .where(eq(documents.id, documentId))
      .returning();
    return updatedDocument;
  }

  async deleteDocument(documentId: number, userCompanyId: number): Promise<boolean> {
    const existingDocument = await this.getDocument(documentId, userCompanyId);
    if (!existingDocument) {
      return false;
    }

    await this.db
      .delete(documentAnalysisResults)
      .where(eq(documentAnalysisResults.documentId, documentId));

    await this.db
      .delete(fileUploadEvents)
      .where(eq(fileUploadEvents.documentId, documentId));

    await this.db
      .delete(documentAccessLog)
      .where(eq(documentAccessLog.documentId, documentId));

    const [deletedDocument] = await this.db
      .delete(documents)
      .where(eq(documents.id, documentId))
      .returning();
    return !!deletedDocument;
  }

  async getExternalSubmission(submissionId: number, userCompanyId: number): Promise<any | null> {
    try {
      const result = await this.db
        .select()
        .from(externalDocumentSubmissions)
        .innerJoin(targetCompanies, eq(externalDocumentSubmissions.targetCompanyId, targetCompanies.id))
        .where(
          and(
            eq(externalDocumentSubmissions.id, submissionId),
            eq(targetCompanies.userCompanyId, userCompanyId)
          )
        )
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      return result[0].external_document_submissions;
    } catch (error) {
      console.error(`[STORAGE] Error getting external submission ${submissionId}:`, error);
      return null;
    }
  }

  async deleteExternalSubmission(submissionId: number, userCompanyId: number): Promise<boolean> {
    try {
      const existingSubmission = await this.db
        .select()
        .from(externalDocumentSubmissions)
        .innerJoin(targetCompanies, eq(externalDocumentSubmissions.targetCompanyId, targetCompanies.id))
        .where(
          and(
            eq(externalDocumentSubmissions.id, submissionId),
            eq(targetCompanies.userCompanyId, userCompanyId)
          )
        )
        .limit(1);

      if (existingSubmission.length === 0) {
        console.warn(`[STORAGE] External submission ${submissionId} not found or access denied for user company ${userCompanyId}`);
        return false;
      }

      const [deletedSubmission] = await this.db
        .delete(externalDocumentSubmissions)
        .where(eq(externalDocumentSubmissions.id, submissionId))
        .returning();

      console.log(`[STORAGE] Successfully deleted external submission ${submissionId}`);
      return !!deletedSubmission;
    } catch (error) {
      console.error(`[STORAGE] Error deleting external submission ${submissionId}:`, error);
      return false;
    }
  }

  async getStage1DocumentFiles(targetCompanyId: number): Promise<{ documentId: number; mimeType: string; category: string }[]> {
    const requiredCategories = ['Company Accounts', 'Asset Register', 'Balance Sheet', 'Profit & Loss', 'Sales Ledger', 'Staff Matrix'];
    
    const docs = await this.db
      .select({
        id: documents.id,
        fileType: documents.fileType,
        documentCategory: documents.documentCategory,
      })
      .from(documents)
      .where(
        and(
          eq(documents.targetCompanyId, targetCompanyId),
          sql`${documents.documentCategory} IN (${sql.join(requiredCategories.map(c => sql`${c}`), sql`, `)})`
        )
      )
      .orderBy(documents.documentCategory, desc(documents.uploadDate));

    console.log(`[STORAGE] Found ${docs.length} Stage 1 documents for company ${targetCompanyId}`);

    return docs.map(doc => ({
      documentId: doc.id,
      mimeType: doc.fileType,
      category: doc.documentCategory,
    }));
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
    console.log(`[STORAGE] Starting comprehensive document cleanup for user company ${userCompanyId}`);
    
    let deletedDocuments = 0;
    let deletedExternalSubmissions = 0;
    let deletedAnalysisResults = 0;
    let deletedUploadEvents = 0;
    let deletedDocumentAccessLogs = 0;
    const filesDeleted: string[] = [];
    const filesNotFound: string[] = [];

    try {
      const allDocuments = await this.db
        .select({
          id: documents.id,
          filePath: documents.filePath,
          targetCompanyId: documents.targetCompanyId,
        })
        .from(documents)
        .innerJoin(targetCompanies, eq(documents.targetCompanyId, targetCompanies.id))
        .where(eq(targetCompanies.userCompanyId, userCompanyId));

      const externalSubmissions = await this.db
        .select({
          id: externalDocumentSubmissions.id,
          filePath: externalDocumentSubmissions.filePath,
          targetCompanyId: externalDocumentSubmissions.targetCompanyId,
        })
        .from(externalDocumentSubmissions)
        .innerJoin(targetCompanies, eq(externalDocumentSubmissions.targetCompanyId, targetCompanies.id))
        .where(eq(targetCompanies.userCompanyId, userCompanyId));

      const allDocumentIds = allDocuments.map(doc => doc.id);
      const allFilePaths = [
        ...allDocuments.map(doc => doc.filePath),
        ...externalSubmissions.map(doc => doc.filePath)
      ];

      console.log(`[STORAGE] Found ${allDocuments.length} documents and ${externalSubmissions.length} external submissions to delete`);

      if (allDocumentIds.length > 0) {
        const analysisResultsDeleted = await this.db
          .delete(documentAnalysisResults)
          .where(sql`${documentAnalysisResults.documentId} IN (${sql.join(allDocumentIds.map(id => sql`${id}`), sql`, `)})`);
        deletedAnalysisResults = analysisResultsDeleted.rowCount || 0;
        console.log(`[STORAGE] Deleted ${deletedAnalysisResults} document analysis results`);
      }

      if (allDocumentIds.length > 0) {
        const accessLogsDeleted = await this.db
          .delete(documentAccessLog)
          .where(sql`${documentAccessLog.documentId} IN (${sql.join(allDocumentIds.map(id => sql`${id}`), sql`, `)})`);
        deletedDocumentAccessLogs = accessLogsDeleted.rowCount || 0;
        console.log(`[STORAGE] Deleted ${deletedDocumentAccessLogs} document access logs`);
      }

      if (allDocumentIds.length > 0) {
        const uploadEventsDeleted = await this.db
          .delete(fileUploadEvents)
          .where(sql`${fileUploadEvents.documentId} IN (${sql.join(allDocumentIds.map(id => sql`${id}`), sql`, `)})`);
        deletedUploadEvents = uploadEventsDeleted.rowCount || 0;
        console.log(`[STORAGE] Deleted ${deletedUploadEvents} file upload events`);
      }

      if (externalSubmissions.length > 0) {
        const externalSubmissionIds = externalSubmissions.map(sub => sub.id);
        const externalSubmissionsDeleted = await this.db
          .delete(externalDocumentSubmissions)
          .where(sql`${externalDocumentSubmissions.id} IN (${sql.join(externalSubmissionIds.map(id => sql`${id}`), sql`, `)})`);
        deletedExternalSubmissions = externalSubmissionsDeleted.rowCount || 0;
        console.log(`[STORAGE] Deleted ${deletedExternalSubmissions} external document submissions`);
      }

      if (allDocumentIds.length > 0) {
        const documentsDeleted = await this.db
          .delete(documents)
          .where(sql`${documents.id} IN (${sql.join(allDocumentIds.map(id => sql`${id}`), sql`, `)})`);
        deletedDocuments = documentsDeleted.rowCount || 0;
        console.log(`[STORAGE] Deleted ${deletedDocuments} documents from database`);
      }

      const fs = await import('fs/promises');
      for (const filePath of allFilePaths) {
        if (!filePath) continue;
        
        try {
          await fs.unlink(filePath);
          filesDeleted.push(filePath);
          console.log(`[STORAGE] Deleted file: ${filePath}`);
        } catch (err: any) {
          if (err.code === 'ENOENT') {
            filesNotFound.push(filePath);
            console.log(`[STORAGE] File not found (already deleted?): ${filePath}`);
          } else {
            console.error(`[STORAGE] Error deleting file ${filePath}:`, err);
            filesNotFound.push(filePath);
          }
        }
      }

      const path = await import('path');
      try {
        const companiesUploadPath = path.join(process.cwd(), 'uploads', 'companies');
        const companyIdsSet = new Set([...allDocuments.map(doc => doc.targetCompanyId), ...externalSubmissions.map(doc => doc.targetCompanyId)]);
        const companyIds = Array.from(companyIdsSet);
        
        for (const companyId of companyIds) {
          const companyDir = path.join(companiesUploadPath, companyId.toString());
          try {
            const dirContents = await fs.readdir(companyDir);
            if (dirContents.length === 0) {
              await fs.rmdir(companyDir);
              console.log(`[STORAGE] Deleted empty company directory: ${companyDir}`);
            }
          } catch (err) {
            console.log(`[STORAGE] Could not clean up directory ${companyDir}:`, err);
          }
        }
      } catch (err) {
        console.log(`[STORAGE] Could not clean up company directories:`, err);
      }

      const result = {
        deletedDocuments,
        deletedExternalSubmissions,
        deletedAnalysisResults,
        deletedUploadEvents,
        deletedDocumentAccessLogs,
        filesDeleted,
        filesNotFound,
      };

      console.log(`[STORAGE] Document cleanup completed:`, result);
      return result;

    } catch (error) {
      console.error(`[STORAGE] Error during document cleanup:`, error);
      throw error;
    }
  }

  async logDocumentAccess(documentId: number, userId: number, accessType: string, ipAddress?: string): Promise<void> {
    await this.db
      .insert(documentAccessLog)
      .values({
        documentId,
        accessedBy: userId,
        accessType,
        ipAddress: ipAddress || null,
      });

    await this.db
      .update(documents)
      .set({
        accessCount: sql`${documents.accessCount} + 1`,
        lastAccessed: new Date(),
      })
      .where(eq(documents.id, documentId));
  }

  async createFileUploadEvent(event: InsertFileUploadEvent): Promise<FileUploadEvent> {
    const [createdEvent] = await this.db
      .insert(fileUploadEvents)
      .values(event)
      .returning();
    return createdEvent;
  }

  async getFileUploadEventsWithDetails(userCompanyId: number): Promise<any[]> {
    return await this.db
      .select({
        id: fileUploadEvents.id,
        documentId: fileUploadEvents.documentId,
        targetCompanyId: fileUploadEvents.targetCompanyId,
        uploadedBy: fileUploadEvents.uploadedBy,
        fileName: fileUploadEvents.fileName,
        fileUrl: fileUploadEvents.fileUrl,
        webhookSent: fileUploadEvents.webhookSent,
        webhookResponse: fileUploadEvents.webhookResponse,
        webhookStatus: fileUploadEvents.webhookStatus,
        webhookSentAt: fileUploadEvents.webhookSentAt,
        uploadedAt: fileUploadEvents.uploadedAt,
        createdAt: fileUploadEvents.createdAt,
        targetCompanyName: targetCompanies.companyName,
        uploadedByName: sql<string>`COALESCE(${users.firstName} || ' ' || ${users.lastName}, 'Unknown User')`,
      })
      .from(fileUploadEvents)
      .leftJoin(targetCompanies, eq(fileUploadEvents.targetCompanyId, targetCompanies.id))
      .leftJoin(users, eq(fileUploadEvents.uploadedBy, users.id))
      .where(
        eq(targetCompanies.userCompanyId, userCompanyId)
      )
      .orderBy(desc(fileUploadEvents.createdAt));
  }

  async updateFileUploadEventWebhookStatus(eventId: number, status: string, response?: string, sentAt?: Date): Promise<FileUploadEvent | undefined> {
    const [updatedEvent] = await this.db
      .update(fileUploadEvents)
      .set({
        webhookSent: true,
        webhookStatus: status,
        webhookResponse: response,
        webhookSentAt: sentAt || new Date(),
      })
      .where(eq(fileUploadEvents.id, eventId))
      .returning();
    return updatedEvent || undefined;
  }

  async getFileUploadEvent(eventId: number): Promise<FileUploadEvent | undefined> {
    const [event] = await this.db
      .select()
      .from(fileUploadEvents)
      .where(eq(fileUploadEvents.id, eventId));
    return event || undefined;
  }

  async createDocumentAnalysisResult(result: InsertDocumentAnalysisResult): Promise<DocumentAnalysisResult> {
    const [newResult] = await this.db
      .insert(documentAnalysisResults)
      .values(result)
      .returning();
    return newResult;
  }

  async getDocumentAnalysisResults(documentId: number): Promise<DocumentAnalysisResult[]> {
    return await this.db
      .select()
      .from(documentAnalysisResults)
      .where(eq(documentAnalysisResults.documentId, documentId))
      .orderBy(desc(documentAnalysisResults.createdAt));
  }

  async getDocumentAnalysisResultsByType(documentType: string, userCompanyId: number): Promise<DocumentAnalysisResult[]> {
    const results = await this.db
      .select({
        id: documentAnalysisResults.id,
        documentId: documentAnalysisResults.documentId,
        fileUploadEventId: documentAnalysisResults.fileUploadEventId,
        documentType: documentAnalysisResults.documentType,
        analysisData: documentAnalysisResults.analysisData,
        processingTime: documentAnalysisResults.processingTime,
        usageMetadata: documentAnalysisResults.usageMetadata,
        createdAt: documentAnalysisResults.createdAt,
      })
      .from(documentAnalysisResults)
      .leftJoin(documents, eq(documentAnalysisResults.documentId, documents.id))
      .leftJoin(targetCompanies, eq(documents.targetCompanyId, targetCompanies.id))
      .where(
        and(
          eq(documentAnalysisResults.documentType, documentType),
          eq(targetCompanies.userCompanyId, userCompanyId)
        )
      )
      .orderBy(desc(documentAnalysisResults.createdAt));
    
    return results;
  }

  async getDocumentAnalysisResultsByTypeForCompany(documentType: string, targetCompanyId: number): Promise<DocumentAnalysisResult[]> {
    const results = await this.db
      .select({
        id: documentAnalysisResults.id,
        documentId: documentAnalysisResults.documentId,
        fileUploadEventId: documentAnalysisResults.fileUploadEventId,
        documentType: documentAnalysisResults.documentType,
        analysisData: documentAnalysisResults.analysisData,
        processingTime: documentAnalysisResults.processingTime,
        usageMetadata: documentAnalysisResults.usageMetadata,
        createdAt: documentAnalysisResults.createdAt,
      })
      .from(documentAnalysisResults)
      .leftJoin(documents, eq(documentAnalysisResults.documentId, documents.id))
      .where(
        and(
          eq(documentAnalysisResults.documentType, documentType),
          eq(documents.targetCompanyId, targetCompanyId)
        )
      )
      .orderBy(desc(documentAnalysisResults.createdAt));
    
    return results;
  }

  async getDocumentCountByCategory(targetCompanyId: number, categoryName: string): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(documents)
      .where(
        and(
          eq(documents.targetCompanyId, targetCompanyId),
          eq(documents.documentCategory, categoryName)
        )
      );
    
    return result[0]?.count || 0;
  }

  async getLatestStage1AnalysisEvent(targetCompanyId: number): Promise<Stage1AnalysisEvent | null> {
    const result = await this.db
      .select()
      .from(stage1AnalysisEvents)
      .where(eq(stage1AnalysisEvents.targetCompanyId, targetCompanyId))
      .orderBy(desc(stage1AnalysisEvents.createdAt))
      .limit(1);
    
    return result[0] || null;
  }

  async getLatestDocumentUploadTime(targetCompanyId: number): Promise<Date | null> {
    const result = await this.db
      .select({ createdAt: documents.createdAt })
      .from(documents)
      .where(eq(documents.targetCompanyId, targetCompanyId))
      .orderBy(desc(documents.createdAt))
      .limit(1);
    
    return result[0]?.createdAt || null;
  }

  async getPortalAnalysisCompletionStatus(targetCompanyId: number): Promise<{
    completedTypes: string[];
    missingTypes: string[];
    isComplete: boolean;
    completionPercentage: number;
    completedCount: number;
    totalCount: number;
  }> {
    return this._getAnalysisCompletionStatusCore(targetCompanyId);
  }

  async getAnalysisCompletionStatus(targetCompanyId: number, userCompanyId: number): Promise<{
    completedTypes: string[];
    missingTypes: string[];
    isComplete: boolean;
    completionPercentage: number;
    completedCount: number;
    totalCount: number;
  }> {
    const company = await this.getTargetCompany(targetCompanyId, userCompanyId);
    if (!company) {
      throw new Error('Company not found or access denied');
    }

    return this._getAnalysisCompletionStatusCore(targetCompanyId);
  }

  private async _getAnalysisCompletionStatusCore(targetCompanyId: number): Promise<{
    completedTypes: string[];
    missingTypes: string[];
    isComplete: boolean;
    completionPercentage: number;
    completedCount: number;
    totalCount: number;
  }> {
    const requiredTypes = ['asset_register', 'sales_ledger', 'staff_matrix', 'profit_and_loss', 'balance_sheet'];

    const analysisTypes = await this.db
      .selectDistinct({
        documentType: documentAnalysisResults.documentType,
        documentCategory: documents.documentCategory,
        externalSubmissionId: documents.externalSubmissionId
      })
      .from(documentAnalysisResults)
      .leftJoin(documents, eq(documentAnalysisResults.documentId, documents.id))
      .where(eq(documents.targetCompanyId, targetCompanyId));

    const completedTypes = Array.from(new Set(analysisTypes
      .filter(a => {
        if (a.documentCategory === 'Company Accounts') {
          return false;
        }
        return requiredTypes.includes(a.documentType);
      })
      .map(a => a.documentType)));
    
    const companyAccountsAnalysisResults = await this.db
      .select({
        documentId: documentAnalysisResults.documentId,
        analysisData: documentAnalysisResults.analysisData
      })
      .from(documentAnalysisResults)
      .leftJoin(documents, eq(documentAnalysisResults.documentId, documents.id))
      .where(eq(documents.targetCompanyId, targetCompanyId));

    const uniqueCompanyAccountsDocuments = new Set(
      companyAccountsAnalysisResults
        .filter(result => {
          if (result.analysisData && typeof result.analysisData === 'object') {
            const data = result.analysisData as any;
            return data.document === 'company_accounts';
          }
          return false;
        })
        .map(result => result.documentId)
    );
    
    const companyAccountsCount = uniqueCompanyAccountsDocuments.size;

    console.log('[DEBUG] Analysis completion status for company', targetCompanyId, 'at', new Date().toISOString());
    console.log('[DEBUG] completedTypes:', completedTypes);
    console.log('[DEBUG] companyAccountsCount:', companyAccountsCount);  
    console.log('[DEBUG] completedCount calculation:', completedTypes.length, '+', Math.min(companyAccountsCount, 5), '=', completedTypes.length + Math.min(companyAccountsCount, 5));
    console.log('[DEBUG] analysisTypes raw:', analysisTypes.map(a => ({type: a.documentType, category: a.documentCategory})));

    const totalRequired = 10;
    const completedCount = completedTypes.length + Math.min(companyAccountsCount, 5);
    const missingTypes = requiredTypes.filter(type => !completedTypes.includes(type));
    
    const missingCompanyAccounts = Math.max(0, 5 - companyAccountsCount);
    for (let i = 0; i < missingCompanyAccounts; i++) {
      missingTypes.push(`company_accounts_${i + 1}`);
    }

    return {
      completedTypes: [...completedTypes, ...Array(Math.min(companyAccountsCount, 5)).fill('company_accounts').map((_, i) => `company_accounts_${i + 1}`)],
      missingTypes,
      isComplete: completedCount === totalRequired,
      completionPercentage: Math.round((completedCount / totalRequired) * 100),
      completedCount,
      totalCount: totalRequired
    };
  }

  async createStage1AnalysisEvent(event: InsertStage1AnalysisEvent): Promise<Stage1AnalysisEvent> {
    const [result] = await this.db
      .insert(stage1AnalysisEvents)
      .values(event)
      .returning();
    return result;
  }

  async getStage1AnalysisEvent(eventId: number): Promise<Stage1AnalysisEvent | undefined> {
    const [event] = await this.db
      .select()
      .from(stage1AnalysisEvents)
      .where(eq(stage1AnalysisEvents.id, eventId));
    return event || undefined;
  }

  async getStage1AnalysisEventsByCompany(targetCompanyId: number, userCompanyId: number): Promise<Stage1AnalysisEvent[]> {
    const company = await this.getTargetCompany(targetCompanyId, userCompanyId);
    if (!company) {
      throw new Error('Company not found or access denied');
    }

    return await this.db
      .select()
      .from(stage1AnalysisEvents)
      .where(eq(stage1AnalysisEvents.targetCompanyId, targetCompanyId))
      .orderBy(desc(stage1AnalysisEvents.createdAt));
  }

  async updateStage1AnalysisEventWebhookStatus(eventId: number, status: string, response?: string, sentAt?: Date, processingTime?: number, usageMetadata?: any): Promise<Stage1AnalysisEvent | undefined> {
    const [updated] = await this.db
      .update(stage1AnalysisEvents)
      .set({
        webhookStatus: status,
        webhookResponse: response,
        webhookSentAt: sentAt,
        webhookSent: status === 'success',
        processingTime: processingTime,
        usageMetadata: usageMetadata
      })
      .where(eq(stage1AnalysisEvents.id, eventId))
      .returning();
    return updated || undefined;
  }

  async updateStage1AnalysisEventDetailedData(eventId: number, detailedData: any): Promise<Stage1AnalysisEvent | undefined> {
    const [updated] = await this.db
      .update(stage1AnalysisEvents)
      .set({
        detailedAnalysisData: detailedData
      })
      .where(eq(stage1AnalysisEvents.id, eventId))
      .returning();
    return updated || undefined;
  }

  async updateDetailedAnalysisStatus(eventId: number, status: string, markdown?: string, processingTime?: number, usageMetadata?: any, triggeredBy?: number): Promise<Stage1AnalysisEvent | undefined> {
    const updateData: Record<string, any> = {
      detailedAnalysisStatus: status,
    };
    
    if (markdown !== undefined) {
      updateData.detailedAnalysisMarkdown = markdown;
    }
    if (processingTime !== undefined) {
      updateData.detailedAnalysisProcessingTime = processingTime;
    }
    if (usageMetadata !== undefined) {
      updateData.detailedAnalysisUsageMetadata = usageMetadata;
    }
    if (triggeredBy !== undefined) {
      updateData.detailedAnalysisTriggeredBy = triggeredBy;
      updateData.detailedAnalysisTriggeredAt = new Date();
    }
    
    const [updated] = await this.db
      .update(stage1AnalysisEvents)
      .set(updateData)
      .where(eq(stage1AnalysisEvents.id, eventId))
      .returning();
    return updated || undefined;
  }

  private async getTargetCompany(targetCompanyId: number, userCompanyId: number): Promise<any | undefined> {
    const [company] = await this.db
      .select()
      .from(targetCompanies)
      .where(
        and(
          eq(targetCompanies.id, targetCompanyId),
          eq(targetCompanies.userCompanyId, userCompanyId)
        )
      );
    return company || undefined;
  }
}

export const documentStore = new DocumentStore(db);
