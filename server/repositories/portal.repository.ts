import { eq, and, sql, desc } from 'drizzle-orm';
import { db } from '../db';
import {
  portalAccessTokens, externalDocumentSubmissions, portalActivityLog, targetCompanies, targetContacts, documents,
  type PortalAccessToken, type InsertPortalAccessToken, type ExternalDocumentSubmission,
  type InsertExternalDocumentSubmission, type InsertPortalActivityLog,
} from '@shared/schema';

export class PortalRepository {
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

  async createToken(token: InsertPortalAccessToken): Promise<PortalAccessToken> {
    const [newToken] = await db.insert(portalAccessTokens).values(token).returning();
    return newToken;
  }

  async deactivateToken(tokenId: number): Promise<boolean> {
    const [updated] = await db.update(portalAccessTokens).set({ isActive: false }).where(eq(portalAccessTokens.id, tokenId)).returning();
    return !!updated;
  }

  async deleteToken(tokenId: number): Promise<boolean> {
    return await db.transaction(async (tx) => {
      // Get all submissions for this token
      const submissions = await tx.select({ id: externalDocumentSubmissions.id })
        .from(externalDocumentSubmissions)
        .where(eq(externalDocumentSubmissions.portalTokenId, tokenId));
      
      // Unlink documents from submissions (set externalSubmissionId to null)
      for (const sub of submissions) {
        await tx.update(documents).set({ externalSubmissionId: null }).where(eq(documents.externalSubmissionId, sub.id));
      }
      
      // Delete portal activity logs
      await tx.delete(portalActivityLog).where(eq(portalActivityLog.portalTokenId, tokenId));
      
      // Delete external document submissions
      await tx.delete(externalDocumentSubmissions).where(eq(externalDocumentSubmissions.portalTokenId, tokenId));
      
      // Delete the portal access token
      const [deleted] = await tx.delete(portalAccessTokens).where(eq(portalAccessTokens.id, tokenId)).returning();
      return !!deleted;
    });
  }

  async getTokensForCompany(userCompanyId: number): Promise<any[]> {
    return await db.select({
      id: portalAccessTokens.id, accessToken: portalAccessTokens.accessToken,
      targetCompanyId: portalAccessTokens.targetCompanyId, contactId: portalAccessTokens.targetContactId,
      isActive: portalAccessTokens.isActive, expiresAt: portalAccessTokens.expiresAt,
      createdAt: portalAccessTokens.createdAt, lastAccessed: portalAccessTokens.lastAccessed,
      companyName: targetCompanies.companyName,
      contactName: sql<string>`${targetContacts.firstName} || ' ' || ${targetContacts.lastName}`,
      contactEmail: targetContacts.email,
      documentSubmissions: sql<number>`(SELECT COUNT(*)::int FROM ${externalDocumentSubmissions} WHERE ${externalDocumentSubmissions.portalTokenId} = ${portalAccessTokens.id})`,
    }).from(portalAccessTokens)
      .innerJoin(targetCompanies, eq(portalAccessTokens.targetCompanyId, targetCompanies.id))
      .innerJoin(targetContacts, eq(portalAccessTokens.targetContactId, targetContacts.id))
      .where(eq(portalAccessTokens.userCompanyId, userCompanyId))
      .orderBy(desc(portalAccessTokens.createdAt));
  }

  async getTokensByTargetCompany(targetCompanyId: number): Promise<PortalAccessToken[]> {
    return await db.select().from(portalAccessTokens)
      .where(and(eq(portalAccessTokens.targetCompanyId, targetCompanyId), eq(portalAccessTokens.isActive, true), sql`${portalAccessTokens.expiresAt} > NOW()`));
  }

  async createSubmission(submission: InsertExternalDocumentSubmission): Promise<ExternalDocumentSubmission> {
    const [newSubmission] = await db.insert(externalDocumentSubmissions).values(submission).returning();
    return newSubmission;
  }

  async getSubmissionsByToken(portalTokenId: number): Promise<ExternalDocumentSubmission[]> {
    return await db.select().from(externalDocumentSubmissions)
      .where(eq(externalDocumentSubmissions.portalTokenId, portalTokenId)).orderBy(desc(externalDocumentSubmissions.createdAt));
  }

  async getSubmissionById(id: number): Promise<ExternalDocumentSubmission | undefined> {
    const [submission] = await db.select().from(externalDocumentSubmissions).where(eq(externalDocumentSubmissions.id, id));
    return submission || undefined;
  }

  async updateSubmissionStatus(id: number, status: string, reviewedBy?: number): Promise<ExternalDocumentSubmission | undefined> {
    const [updated] = await db.update(externalDocumentSubmissions).set({ processingStatus: status }).where(eq(externalDocumentSubmissions.id, id)).returning();
    return updated || undefined;
  }

  async logActivity(activity: InsertPortalActivityLog): Promise<void> {
    await db.insert(portalActivityLog).values(activity);
  }

  async getTokenById(tokenId: number): Promise<PortalAccessToken | undefined> {
    const [token] = await db.select().from(portalAccessTokens).where(eq(portalAccessTokens.id, tokenId));
    return token || undefined;
  }
}

export const portalRepository = new PortalRepository();
