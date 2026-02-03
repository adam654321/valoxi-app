import { eq, and, sql, desc } from 'drizzle-orm';
import { db } from '../db';
import {
  documentAnalysisResults, documents, targetCompanies,
  type DocumentAnalysisResult, type InsertDocumentAnalysisResult,
} from '@shared/schema';

export class DocumentAnalysisRepository {
  async getAnalysisResultsByDocumentId(documentId: number): Promise<DocumentAnalysisResult[]> {
    return await db.select().from(documentAnalysisResults)
      .where(eq(documentAnalysisResults.documentId, documentId))
      .orderBy(desc(documentAnalysisResults.createdAt));
  }

  async getAnalysisResultsByType(documentType: string, userCompanyId: number): Promise<DocumentAnalysisResult[]> {
    return await db.select({
      id: documentAnalysisResults.id,
      documentId: documentAnalysisResults.documentId,
      fileUploadEventId: documentAnalysisResults.fileUploadEventId,
      documentType: documentAnalysisResults.documentType,
      analysisData: documentAnalysisResults.analysisData,
      processingTime: documentAnalysisResults.processingTime,
      usageMetadata: documentAnalysisResults.usageMetadata,
      createdAt: documentAnalysisResults.createdAt,
    }).from(documentAnalysisResults)
      .innerJoin(documents, eq(documentAnalysisResults.documentId, documents.id))
      .innerJoin(targetCompanies, eq(documents.targetCompanyId, targetCompanies.id))
      .where(and(eq(documentAnalysisResults.documentType, documentType), eq(targetCompanies.userCompanyId, userCompanyId)))
      .orderBy(desc(documentAnalysisResults.createdAt));
  }

  async getAnalysisResultsByTypeForCompany(documentType: string, targetCompanyId: number): Promise<DocumentAnalysisResult[]> {
    return await db.select({
      id: documentAnalysisResults.id,
      documentId: documentAnalysisResults.documentId,
      fileUploadEventId: documentAnalysisResults.fileUploadEventId,
      documentType: documentAnalysisResults.documentType,
      analysisData: documentAnalysisResults.analysisData,
      processingTime: documentAnalysisResults.processingTime,
      usageMetadata: documentAnalysisResults.usageMetadata,
      createdAt: documentAnalysisResults.createdAt,
    }).from(documentAnalysisResults)
      .innerJoin(documents, eq(documentAnalysisResults.documentId, documents.id))
      .where(and(eq(documents.targetCompanyId, targetCompanyId), eq(documentAnalysisResults.documentType, documentType)))
      .orderBy(desc(documentAnalysisResults.createdAt));
  }

  async getAllAnalysisResultsForCompany(targetCompanyId: number): Promise<DocumentAnalysisResult[]> {
    return await db.select({
      id: documentAnalysisResults.id,
      documentId: documentAnalysisResults.documentId,
      fileUploadEventId: documentAnalysisResults.fileUploadEventId,
      documentType: documentAnalysisResults.documentType,
      analysisData: documentAnalysisResults.analysisData,
      processingTime: documentAnalysisResults.processingTime,
      usageMetadata: documentAnalysisResults.usageMetadata,
      createdAt: documentAnalysisResults.createdAt,
    }).from(documentAnalysisResults)
      .innerJoin(documents, eq(documentAnalysisResults.documentId, documents.id))
      .where(eq(documents.targetCompanyId, targetCompanyId))
      .orderBy(desc(documentAnalysisResults.createdAt));
  }

  async getDistinctAnalysisTypesForCompany(targetCompanyId: number): Promise<{ documentType: string; documentCategory: string | null; documentId: number | null }[]> {
    return await db.selectDistinct({
      documentType: documentAnalysisResults.documentType,
      documentCategory: documents.documentCategory,
      documentId: documentAnalysisResults.documentId,
    }).from(documentAnalysisResults)
      .leftJoin(documents, eq(documentAnalysisResults.documentId, documents.id))
      .where(eq(documents.targetCompanyId, targetCompanyId));
  }

  async getAllDocumentsForCompany(targetCompanyId: number): Promise<{ id: number; documentCategory: string | null }[]> {
    return await db.select({
      id: documents.id,
      documentCategory: documents.documentCategory,
    }).from(documents)
      .where(eq(documents.targetCompanyId, targetCompanyId));
  }

  async getDocumentById(documentId: number): Promise<{ id: number; targetCompanyId: number } | undefined> {
    const [doc] = await db.select({ id: documents.id, targetCompanyId: documents.targetCompanyId })
      .from(documents).where(eq(documents.id, documentId));
    return doc || undefined;
  }

  async createAnalysisResult(result: InsertDocumentAnalysisResult): Promise<DocumentAnalysisResult> {
    const [created] = await db.insert(documentAnalysisResults).values(result).returning();
    return created;
  }

  async getCompanyAccountsAnalysisCount(targetCompanyId: number): Promise<number> {
    // Count unique documents with document_category='Company Accounts' that have analysis results
    // The analysis_data.document field may be 'profit_and_loss' or 'balance_sheet' (what was detected inside),
    // but we want to count documents that were uploaded as Company Accounts and have been analyzed
    const results = await db
      .select({
        documentId: documentAnalysisResults.documentId,
        documentCategory: documents.documentCategory
      })
      .from(documentAnalysisResults)
      .innerJoin(documents, eq(documentAnalysisResults.documentId, documents.id))
      .where(
        and(
          eq(documents.targetCompanyId, targetCompanyId),
          eq(documents.documentCategory, 'Company Accounts')
        )
      );

    // Count unique documents that have been analyzed
    const uniqueDocuments = new Set(results.map(result => result.documentId));

    return uniqueDocuments.size;
  }

  async deleteByDocumentId(documentId: number): Promise<void> {
    await db.delete(documentAnalysisResults).where(eq(documentAnalysisResults.documentId, documentId));
    console.log(`[DOCUMENT_ANALYSIS] Deleted analysis results for document ${documentId}`);
  }
}

export const documentAnalysisRepository = new DocumentAnalysisRepository();
