import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  portalAccessTokens, externalDocumentSubmissions, portalActivityLog, documents,
  documentAnalysisResults, targetCompanies, targetContacts, fileUploadEvents,
  type PortalAccessToken, type ExternalDocumentSubmission, type InsertExternalDocumentSubmission,
  type InsertPortalActivityLog, type Document, type InsertDocument, type InsertFileUploadEvent, type FileUploadEvent,
} from '@shared/schema';

export class PortalSubmissionsRepository {
  async validateToken(accessToken: string): Promise<PortalAccessToken | undefined> {
    const [token] = await db.select().from(portalAccessTokens)
      .where(and(eq(portalAccessTokens.accessToken, accessToken), eq(portalAccessTokens.isActive, true), sql`${portalAccessTokens.expiresAt} > NOW()`));
    return token || undefined;
  }

  async updateTokenAccess(tokenId: number, ipAddress?: string, userAgent?: string): Promise<void> {
    const updates: any = { lastAccessed: new Date(), accessCount: sql`${portalAccessTokens.accessCount} + 1` };
    if (ipAddress) updates.ipAddressesUsed = sql`array_append(COALESCE(${portalAccessTokens.ipAddressesUsed}, '{}'), ${ipAddress})`;
    if (userAgent) updates.userAgentStrings = sql`array_append(COALESCE(${portalAccessTokens.userAgentStrings}, '{}'), ${userAgent})`;
    await db.update(portalAccessTokens).set(updates).where(eq(portalAccessTokens.id, tokenId));
  }

  async getSimplePortalData(portalTokenId: number): Promise<any> {
    const [token] = await db.select().from(portalAccessTokens).where(eq(portalAccessTokens.id, portalTokenId));
    if (!token) return null;
    const [company] = await db.select().from(targetCompanies).where(eq(targetCompanies.id, token.targetCompanyId));
    const [contact] = await db.select().from(targetContacts).where(eq(targetContacts.id, token.targetContactId));
    const submissions = await db.select().from(externalDocumentSubmissions)
      .where(eq(externalDocumentSubmissions.portalTokenId, portalTokenId)).orderBy(desc(externalDocumentSubmissions.submittedAt));
    const documentTypes = [
      { value: 'p_and_l', label: 'P&L Statement', category: 'financial', maxFiles: 1 },
      { value: 'balance_sheet', label: 'Balance Sheet', category: 'financial', maxFiles: 1 },
      { value: 'cash_flow', label: 'Cash Flow Statement', category: 'financial', maxFiles: 1 },
      { value: 'tax_returns', label: 'Tax Returns', category: 'financial', maxFiles: 1 },
      { value: 'management_accounts', label: 'Management Accounts', category: 'financial', maxFiles: 1 },
      { value: 'company_accounts_1', label: 'Company Accounts 1', category: 'company_accounts', maxFiles: 1 },
      { value: 'company_accounts_2', label: 'Company Accounts 2', category: 'company_accounts', maxFiles: 1 },
      { value: 'company_accounts_3', label: 'Company Accounts 3', category: 'company_accounts', maxFiles: 1 },
      { value: 'company_accounts_4', label: 'Company Accounts 4', category: 'company_accounts', maxFiles: 1 },
      { value: 'company_accounts_5', label: 'Company Accounts 5', category: 'company_accounts', maxFiles: 1 },
    ];
    const uploadedTypes = submissions.map(s => s.documentCategory);
    return {
      token: { id: token.id, expiresAt: token.expiresAt, customMessage: token.customMessage },
      company: company ? { id: company.id, name: company.companyName } : null,
      contact: contact ? { id: contact.id, name: `${contact.firstName} ${contact.lastName}`, email: contact.email } : null,
      documentTypes: documentTypes.map(dt => ({ ...dt, uploaded: uploadedTypes.includes(dt.value) })),
      submissions: submissions.map(s => ({ id: s.id, filename: s.originalFilename, category: s.documentCategory, submittedAt: s.submittedAt, status: s.processingStatus })),
      allowedActions: JSON.parse(token.allowedActions || '{}'),
    };
  }

  async createSubmission(submission: InsertExternalDocumentSubmission): Promise<ExternalDocumentSubmission> {
    const [created] = await db.insert(externalDocumentSubmissions).values(submission).returning();
    return created;
  }

  async getSubmissions(portalTokenId: number): Promise<ExternalDocumentSubmission[]> {
    return await db.select().from(externalDocumentSubmissions)
      .where(eq(externalDocumentSubmissions.portalTokenId, portalTokenId)).orderBy(desc(externalDocumentSubmissions.submittedAt));
  }

  async reviewSubmission(submissionId: number, reviewedBy: number, status: string, notes?: string): Promise<boolean> {
    const [updated] = await db.update(externalDocumentSubmissions)
      .set({ processingStatus: status }).where(eq(externalDocumentSubmissions.id, submissionId)).returning();
    return !!updated;
  }

  async createDocument(doc: InsertDocument): Promise<Document> {
    const [created] = await db.insert(documents).values(doc).returning();
    return created;
  }

  async createFileUploadEvent(event: InsertFileUploadEvent): Promise<FileUploadEvent> {
    const [created] = await db.insert(fileUploadEvents).values(event).returning();
    return created;
  }

  async logActivity(activity: InsertPortalActivityLog): Promise<void> {
    await db.insert(portalActivityLog).values(activity);
  }

  async getDocumentsForCompany(targetCompanyId: number): Promise<Document[]> {
    return await db.select().from(documents).where(eq(documents.targetCompanyId, targetCompanyId)).orderBy(desc(documents.uploadDate));
  }

  async deleteDocument(documentId: number): Promise<boolean> {
    await db.delete(documentAnalysisResults).where(eq(documentAnalysisResults.documentId, documentId));
    await db.delete(fileUploadEvents).where(eq(fileUploadEvents.documentId, documentId));
    const [deleted] = await db.delete(documents).where(eq(documents.id, documentId)).returning();
    return !!deleted;
  }

  async getDocument(documentId: number): Promise<Document | undefined> {
    const [doc] = await db.select().from(documents).where(eq(documents.id, documentId));
    return doc || undefined;
  }

  async getAnalysisCompletionStatus(targetCompanyId: number): Promise<{ complete: boolean; analyzed: number; total: number; categories: Record<string, boolean> }> {
    const docs = await db.select().from(documents).where(eq(documents.targetCompanyId, targetCompanyId));
    const analysisResults = await db.select().from(documentAnalysisResults)
      .where(sql`${documentAnalysisResults.documentId} IN (SELECT id FROM documents WHERE target_company_id = ${targetCompanyId})`);
    const analyzedDocIds = new Set(analysisResults.map(r => r.documentId));
    const categories = ['Company Accounts', 'Profit & Loss', 'Balance Sheet', 'Sales Ledger', 'Staff Matrix', 'Asset Register'];
    const categoryStatus: Record<string, boolean> = {};
    for (const cat of categories) {
      const catDocs = docs.filter(d => d.documentCategory === cat);
      categoryStatus[cat] = catDocs.length > 0 && catDocs.every(d => analyzedDocIds.has(d.id));
    }
    return { complete: Object.values(categoryStatus).every(Boolean), analyzed: analyzedDocIds.size, total: docs.length, categories: categoryStatus };
  }
}

export const portalSubmissionsRepository = new PortalSubmissionsRepository();
