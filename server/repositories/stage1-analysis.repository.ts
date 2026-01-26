import { eq, desc, and, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  stage1AnalysisEvents, documents, documentAnalysisResults, targetCompanies,
  type Stage1AnalysisEvent, type InsertStage1AnalysisEvent, type TargetCompany,
} from '@shared/schema';

export interface Stage1DocumentFile {
  documentId: number;
  mimeType: string;
  category: string;
}

export class Stage1AnalysisRepository {
  async getTargetCompany(targetCompanyId: number): Promise<TargetCompany | undefined> {
    const [company] = await db.select().from(targetCompanies).where(eq(targetCompanies.id, targetCompanyId));
    return company || undefined;
  }

  async getDocumentCountByCategory(targetCompanyId: number, categoryName: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` }).from(documents)
      .where(and(eq(documents.targetCompanyId, targetCompanyId), eq(documents.documentCategory, categoryName)));
    return result[0]?.count || 0;
  }

  async getDocumentAnalysisResultsByType(documentType: string, targetCompanyId: number): Promise<any[]> {
    const results = await db.select({
      id: documentAnalysisResults.id,
      documentId: documentAnalysisResults.documentId,
      documentType: documentAnalysisResults.documentType,
      analysisData: documentAnalysisResults.analysisData,
    }).from(documentAnalysisResults)
      .innerJoin(documents, eq(documentAnalysisResults.documentId, documents.id))
      .where(and(eq(documents.targetCompanyId, targetCompanyId), eq(documentAnalysisResults.documentType, documentType)));
    return results;
  }

  async getStage1DocumentFiles(targetCompanyId: number): Promise<Stage1DocumentFile[]> {
    const requiredCategories = ['Company Accounts', 'Asset Register', 'Balance Sheet', 'Profit & Loss', 'Sales Ledger', 'Staff Matrix'];
    const docs = await db.select({ id: documents.id, fileType: documents.fileType, documentCategory: documents.documentCategory })
      .from(documents)
      .where(and(eq(documents.targetCompanyId, targetCompanyId), sql`${documents.documentCategory} IN (${sql.join(requiredCategories.map(c => sql`${c}`), sql`, `)})`))
      .orderBy(documents.documentCategory, desc(documents.uploadDate));
    return docs.map(doc => ({ documentId: doc.id, mimeType: doc.fileType, category: doc.documentCategory }));
  }

  async getLatestStage1AnalysisEvent(targetCompanyId: number): Promise<Stage1AnalysisEvent | null> {
    const [result] = await db.select().from(stage1AnalysisEvents)
      .where(eq(stage1AnalysisEvents.targetCompanyId, targetCompanyId)).orderBy(desc(stage1AnalysisEvents.createdAt)).limit(1);
    return result || null;
  }

  async getLatestDocumentUploadTime(targetCompanyId: number): Promise<Date | null> {
    const [result] = await db.select({ createdAt: documents.createdAt }).from(documents)
      .where(eq(documents.targetCompanyId, targetCompanyId)).orderBy(desc(documents.createdAt)).limit(1);
    return result?.createdAt || null;
  }

  async createStage1AnalysisEvent(event: InsertStage1AnalysisEvent): Promise<Stage1AnalysisEvent> {
    const [result] = await db.insert(stage1AnalysisEvents).values(event).returning();
    return result;
  }

  async getStage1AnalysisEvent(eventId: number): Promise<Stage1AnalysisEvent | undefined> {
    const [event] = await db.select().from(stage1AnalysisEvents).where(eq(stage1AnalysisEvents.id, eventId));
    return event || undefined;
  }

  async getStage1AnalysisEventsByCompany(targetCompanyId: number): Promise<Stage1AnalysisEvent[]> {
    return await db.select().from(stage1AnalysisEvents)
      .where(eq(stage1AnalysisEvents.targetCompanyId, targetCompanyId)).orderBy(desc(stage1AnalysisEvents.createdAt));
  }

  async updateStage1AnalysisEventStatus(eventId: number, status: string, response?: string, sentAt?: Date, processingTime?: number, usageMetadata?: any): Promise<Stage1AnalysisEvent | undefined> {
    const [updated] = await db.update(stage1AnalysisEvents)
      .set({ webhookStatus: status, webhookResponse: response, webhookSentAt: sentAt, webhookSent: status === 'success', processingTime, usageMetadata })
      .where(eq(stage1AnalysisEvents.id, eventId)).returning();
    return updated || undefined;
  }

  async updateDetailedAnalysisStatus(eventId: number, status: string, markdown?: string, processingTime?: number, usageMetadata?: any, triggeredBy?: number): Promise<Stage1AnalysisEvent | undefined> {
    const updateData: Record<string, any> = { detailedAnalysisStatus: status };
    if (markdown !== undefined) updateData.detailedAnalysisMarkdown = markdown;
    if (processingTime !== undefined) updateData.detailedAnalysisProcessingTime = processingTime;
    if (usageMetadata !== undefined) updateData.detailedAnalysisUsageMetadata = usageMetadata;
    if (triggeredBy !== undefined) { updateData.detailedAnalysisTriggeredBy = triggeredBy; updateData.detailedAnalysisTriggeredAt = new Date(); }
    const [updated] = await db.update(stage1AnalysisEvents).set(updateData).where(eq(stage1AnalysisEvents.id, eventId)).returning();
    return updated || undefined;
  }
}

export const stage1AnalysisRepository = new Stage1AnalysisRepository();
