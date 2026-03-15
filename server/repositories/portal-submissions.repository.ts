import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db';
import { subscriptions } from '@shared/schema/billing';
import { userCompanies } from '@shared/schema/core';
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
    const [subscription] = await db
      .select({ planKey: subscriptions.planKey })
      .from(subscriptions)
      .where(eq(subscriptions.userCompanyId, token.userCompanyId));

    const [buyerCompany] = await db
      .select({ betaPlanOverride: userCompanies.betaPlanOverride })
      .from(userCompanies)
      .where(eq(userCompanies.id, token.userCompanyId));

    const validOverrides = ['CORE', 'PROFESSIONAL', 'EXPERT', 'ENTERPRISE'];
    const override = buyerCompany?.betaPlanOverride?.toUpperCase();
    const buyerPlanKey = (override && validOverrides.includes(override))
      ? override
      : (subscription?.planKey ?? 'CORE');
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
      buyerPlanKey,
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
    const { randomUUID } = await import('crypto');
    const docWithToken = { ...doc, publicToken: randomUUID() };
    const [created] = await db.insert(documents).values(docWithToken).returning();
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

  async getAnalysisCompletionStatus(targetCompanyId: number): Promise<{
    completedTypes: string[];
    missingTypes: string[];
    isComplete: boolean;
    completionPercentage: number;
    completedCount: number;
    totalCount: number;
  }> {
    const requiredTypes = ['asset_register', 'sales_ledger', 'staff_matrix', 'profit_and_loss', 'balance_sheet'];
    const categoryToType: Record<string, string> = {
      'Asset Register': 'asset_register',
      'Sales Ledger': 'sales_ledger', 
      'Staff Matrix': 'staff_matrix',
      'Profit & Loss': 'profit_and_loss',
      'Balance Sheet': 'balance_sheet',
    };
    
    // Get ALL documents for this company (immediate feedback on upload)
    const allDocuments = await db
      .select({
        id: documents.id,
        documentCategory: documents.documentCategory,
      })
      .from(documents)
      .where(eq(documents.targetCompanyId, targetCompanyId));
    
    // Get analysis results to verify/override categorization
    const analysisResults = await db
      .select({
        documentType: documentAnalysisResults.documentType,
        documentCategory: documents.documentCategory,
        documentId: documentAnalysisResults.documentId,
      })
      .from(documentAnalysisResults)
      .leftJoin(documents, eq(documentAnalysisResults.documentId, documents.id))
      .where(eq(documents.targetCompanyId, targetCompanyId));

    // Build a map of document ID to its effective type
    const analyzedDocTypes = new Map<number, string>();
    for (const result of analysisResults) {
      if (result.documentId && result.documentType) {
        analyzedDocTypes.set(result.documentId, result.documentType);
      }
    }

    // Count completed types - use analysis result if available, otherwise use document category
    const completedTypesSet = new Set<string>();
    let companyAccountsCount = 0;
    
    for (const doc of allDocuments) {
      const analyzedType = analyzedDocTypes.get(doc.id);
      
      if (doc.documentCategory === 'Company Accounts') {
        // Company Accounts - count towards the 5 company accounts slots
        companyAccountsCount++;
      } else if (analyzedType && requiredTypes.includes(analyzedType)) {
        // Has analysis - use the analyzed type
        completedTypesSet.add(analyzedType);
      } else if (doc.documentCategory) {
        // No analysis yet - use document category for immediate feedback
        const mappedType = categoryToType[doc.documentCategory];
        if (mappedType && requiredTypes.includes(mappedType)) {
          completedTypesSet.add(mappedType);
        }
      }
    }

    const completedTypes = Array.from(completedTypesSet);

    // Total = 5 regular types + 5 company accounts slots = 10
    const totalRequired = 10;
    const completedCount = completedTypes.length + Math.min(companyAccountsCount, 5);

    // Build missing types
    const missingTypes = requiredTypes.filter(type => !completedTypes.includes(type));
    const missingCompanyAccounts = Math.max(0, 5 - companyAccountsCount);
    for (let i = 0; i < missingCompanyAccounts; i++) {
      missingTypes.push(`company_accounts_${i + 1}`);
    }

    // Build all completed types including company accounts
    const allCompletedTypes = [
      ...completedTypes,
      ...Array(Math.min(companyAccountsCount, 5)).fill('company_accounts').map((_, i) => `company_accounts_${i + 1}`)
    ];

    return {
      completedTypes: allCompletedTypes,
      missingTypes,
      isComplete: completedCount === totalRequired,
      completionPercentage: Math.round((completedCount / totalRequired) * 100),
      completedCount,
      totalCount: totalRequired,
    };
  }
}

export const portalSubmissionsRepository = new PortalSubmissionsRepository();
