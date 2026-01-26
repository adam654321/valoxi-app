import { eq, and, sql, asc, desc, isNull } from 'drizzle-orm';
import { db } from '../db';
import {
  companyDocumentRequirements, portalDocumentRequirements, portalAccessTokens,
  externalDocumentSubmissions, targetCompanies, documents,
  type CompanyDocumentRequirement, type PortalAccessToken,
} from '@shared/schema';

export interface RequirementProgress {
  id: number;
  requirementName: string;
  requirementDescription: string | null;
  documentCategory: string | null;
  collectionStage: number;
  priorityLevel: string | null;
  isMandatory: boolean | null;
  requirementStatus: string | null;
  submissionStatus: string | null;
  submittedDocumentId: number | null;
  submittedAt: Date | null;
  reviewStatus: string | null;
  dueDate: Date | null;
  statusIndicator: string;
}

export class PortalRequirementsRepository {
  async getCompanyRequirements(targetCompanyId: number, stage?: number | null): Promise<RequirementProgress[]> {
    const whereClause = stage
      ? and(eq(companyDocumentRequirements.targetCompanyId, targetCompanyId), eq(companyDocumentRequirements.collectionStage, stage))
      : eq(companyDocumentRequirements.targetCompanyId, targetCompanyId);
    const results = await db.select({
      id: companyDocumentRequirements.id,
      requirementName: companyDocumentRequirements.requirementName,
      requirementDescription: companyDocumentRequirements.requirementDescription,
      documentCategory: companyDocumentRequirements.documentCategory,
      collectionStage: companyDocumentRequirements.collectionStage,
      priorityLevel: companyDocumentRequirements.priorityLevel,
      isMandatory: companyDocumentRequirements.isMandatory,
      requirementStatus: companyDocumentRequirements.requirementStatus,
      submissionStatus: companyDocumentRequirements.submissionStatus,
      submittedDocumentId: companyDocumentRequirements.submittedDocumentId,
      submittedAt: companyDocumentRequirements.submittedAt,
      reviewStatus: companyDocumentRequirements.reviewStatus,
      dueDate: companyDocumentRequirements.dueDate,
      statusIndicator: sql<string>`CASE
        WHEN ${companyDocumentRequirements.dueDate} < NOW() AND ${companyDocumentRequirements.requirementStatus} = 'outstanding' THEN 'overdue'
        WHEN ${companyDocumentRequirements.requirementStatus} = 'submitted' THEN 'submitted'
        WHEN ${companyDocumentRequirements.requirementStatus} = 'approved' THEN 'approved'
        WHEN ${companyDocumentRequirements.requirementStatus} = 'rejected' THEN 'rejected'
        ELSE 'outstanding'
      END`,
    }).from(companyDocumentRequirements)
      .where(whereClause)
      .orderBy(asc(companyDocumentRequirements.collectionStage), desc(companyDocumentRequirements.priorityLevel), asc(companyDocumentRequirements.requirementName));
    return results;
  }

  async getRequirementById(requirementId: number): Promise<CompanyDocumentRequirement | undefined> {
    const [result] = await db.select().from(companyDocumentRequirements).where(eq(companyDocumentRequirements.id, requirementId));
    return result || undefined;
  }

  async updateRequirement(requirementId: number, updates: Partial<CompanyDocumentRequirement>, userId: number): Promise<CompanyDocumentRequirement | undefined> {
    const [updated] = await db.update(companyDocumentRequirements)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(companyDocumentRequirements.id, requirementId))
      .returning();
    return updated || undefined;
  }

  async getRequirementCountByStage(targetCompanyId: number, stage: number): Promise<{ total: number; completed: number; outstanding: number; overdue: number }> {
    const results = await db.select({
      status: companyDocumentRequirements.requirementStatus,
      dueDate: companyDocumentRequirements.dueDate,
    }).from(companyDocumentRequirements)
      .where(and(eq(companyDocumentRequirements.targetCompanyId, targetCompanyId), eq(companyDocumentRequirements.collectionStage, stage)));
    const now = new Date();
    let completed = 0, outstanding = 0, overdue = 0;
    for (const r of results) {
      if (r.status === 'approved' || r.status === 'submitted') completed++;
      else if (r.dueDate && new Date(r.dueDate) < now) overdue++;
      else outstanding++;
    }
    return { total: results.length, completed, outstanding, overdue };
  }

  async initializeStandardRequirements(targetCompanyId: number): Promise<boolean> {
    await db.execute(sql`SELECT initialize_standard_requirements(${targetCompanyId})`);
    return true;
  }

  async hasRequirements(targetCompanyId: number): Promise<boolean> {
    const [result] = await db.select({ count: sql<number>`count(*)::int` }).from(companyDocumentRequirements)
      .where(eq(companyDocumentRequirements.targetCompanyId, targetCompanyId));
    return (result?.count || 0) > 0;
  }

  async getPortalRequirementsByToken(portalTokenId: number): Promise<any[]> {
    return await db.select().from(portalDocumentRequirements)
      .where(eq(portalDocumentRequirements.portalTokenId, portalTokenId))
      .orderBy(portalDocumentRequirements.collectionStage, portalDocumentRequirements.priorityLevel);
  }

  async getSubmissionProgress(targetCompanyId: number): Promise<{ category: string; count: number }[]> {
    const results = await db.select({
      category: documents.documentCategory,
      count: sql<number>`count(*)::int`,
    }).from(documents)
      .where(eq(documents.targetCompanyId, targetCompanyId))
      .groupBy(documents.documentCategory);
    return results;
  }

  async getPortalSubmissionProgress(portalTokenId: number): Promise<{ documentCategory: string | null; count: number }[]> {
    const results = await db.select({
      documentCategory: externalDocumentSubmissions.documentCategory,
      count: sql<number>`count(*)::int`,
    }).from(externalDocumentSubmissions)
      .where(eq(externalDocumentSubmissions.portalTokenId, portalTokenId))
      .groupBy(externalDocumentSubmissions.documentCategory);
    return results;
  }

  async getValidPortalToken(accessToken: string): Promise<PortalAccessToken | null> {
    const [token] = await db.select().from(portalAccessTokens)
      .where(and(eq(portalAccessTokens.accessToken, accessToken), eq(portalAccessTokens.isActive, true)));
    if (!token) return null;
    if (token.expiresAt && new Date(token.expiresAt) < new Date()) return null;
    return token;
  }

  async updateRequirementSubmission(requirementId: number, documentId: number, contactId: number): Promise<CompanyDocumentRequirement | undefined> {
    const [updated] = await db.update(companyDocumentRequirements)
      .set({ requirementStatus: 'submitted', submissionStatus: 'pending_review', submittedDocumentId: documentId, submittedAt: new Date(), submittedByContactId: contactId, updatedAt: new Date() })
      .where(eq(companyDocumentRequirements.id, requirementId))
      .returning();
    return updated || undefined;
  }

  async findRequirementByCategory(targetCompanyId: number, documentCategory: string, stage?: number): Promise<CompanyDocumentRequirement | undefined> {
    const whereClause = stage
      ? and(eq(companyDocumentRequirements.targetCompanyId, targetCompanyId), eq(companyDocumentRequirements.documentCategory, documentCategory), eq(companyDocumentRequirements.collectionStage, stage), eq(companyDocumentRequirements.requirementStatus, 'outstanding'))
      : and(eq(companyDocumentRequirements.targetCompanyId, targetCompanyId), eq(companyDocumentRequirements.documentCategory, documentCategory), eq(companyDocumentRequirements.requirementStatus, 'outstanding'));
    const [result] = await db.select().from(companyDocumentRequirements).where(whereClause).limit(1);
    return result || undefined;
  }

  async getOverdueRequirements(targetCompanyId: number): Promise<RequirementProgress[]> {
    const now = new Date();
    return await db.select({
      id: companyDocumentRequirements.id,
      requirementName: companyDocumentRequirements.requirementName,
      requirementDescription: companyDocumentRequirements.requirementDescription,
      documentCategory: companyDocumentRequirements.documentCategory,
      collectionStage: companyDocumentRequirements.collectionStage,
      priorityLevel: companyDocumentRequirements.priorityLevel,
      isMandatory: companyDocumentRequirements.isMandatory,
      requirementStatus: companyDocumentRequirements.requirementStatus,
      submissionStatus: companyDocumentRequirements.submissionStatus,
      submittedDocumentId: companyDocumentRequirements.submittedDocumentId,
      submittedAt: companyDocumentRequirements.submittedAt,
      reviewStatus: companyDocumentRequirements.reviewStatus,
      dueDate: companyDocumentRequirements.dueDate,
      statusIndicator: sql<string>`'overdue'`,
    }).from(companyDocumentRequirements)
      .where(and(eq(companyDocumentRequirements.targetCompanyId, targetCompanyId), eq(companyDocumentRequirements.requirementStatus, 'outstanding'), sql`${companyDocumentRequirements.dueDate} < ${now}`));
  }
}

export const portalRequirementsRepository = new PortalRequirementsRepository();
