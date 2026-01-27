import { db } from "../db";
import {
  portalAccessTokens,
  externalDocumentSubmissions,
  portalDocumentRequirements,
  portalActivityLog,
  portalLinkCampaigns,
  portalEmailTemplates,
  portalCommunicationsLog,
  portalAnalytics,
  portalLinkShares,
  companyDocumentRequirements,
  documentStageProgression,
  targetCompanies,
  targetContacts,
  documents,
  users,
  userDealAssignments,
  activities,
  type PortalAccessToken,
  type InsertPortalAccessToken,
  type ExternalDocumentSubmission,
  type InsertExternalDocumentSubmission,
  type PortalDocumentRequirement,
  type InsertPortalDocumentRequirement,
  type PortalActivityLog,
  type InsertPortalActivityLog,
  type PortalLinkCampaign,
  type InsertPortalLinkCampaign,
  type PortalEmailTemplate,
  type InsertPortalEmailTemplate,
  type PortalCommunicationsLog,
  type InsertPortalCommunicationsLog,
  type PortalAnalytics,
  type InsertPortalAnalytics,
  type PortalLinkShare,
  type InsertPortalLinkShare,
  type CompanyDocumentRequirement,
  type DocumentStageProgression,
} from "@shared/schema";
import { eq, and, desc, asc, sql, gte, lte, isNull, gt } from "drizzle-orm";

type DbInstance = typeof db;

export class PortalStore {
  constructor(private db: DbInstance) {}

  async createPortalAccessToken(token: InsertPortalAccessToken): Promise<PortalAccessToken> {
    const [createdToken] = await this.db
      .insert(portalAccessTokens)
      .values(token)
      .returning();
    return createdToken;
  }

  async getPortalAccessToken(accessToken: string): Promise<PortalAccessToken | undefined> {
    const [token] = await this.db
      .select()
      .from(portalAccessTokens)
      .where(eq(portalAccessTokens.accessToken, accessToken));
    return token || undefined;
  }

  async validatePortalToken(accessToken: string): Promise<PortalAccessToken | undefined> {
    const [token] = await this.db
      .select()
      .from(portalAccessTokens)
      .where(and(
        eq(portalAccessTokens.accessToken, accessToken),
        eq(portalAccessTokens.isActive, true),
        sql`${portalAccessTokens.expiresAt} > NOW()`
      ));
    return token || undefined;
  }

  async updatePortalTokenAccess(tokenId: number, ipAddress?: string, userAgent?: string): Promise<void> {
    const updates: any = {
      lastAccessed: new Date(),
      accessCount: sql`${portalAccessTokens.accessCount} + 1`
    };

    if (ipAddress) {
      updates.ipAddressesUsed = sql`array_append(COALESCE(${portalAccessTokens.ipAddressesUsed}, '{}'), ${ipAddress})`;
    }

    if (userAgent) {
      updates.userAgentStrings = sql`array_append(COALESCE(${portalAccessTokens.userAgentStrings}, '{}'), ${userAgent})`;
    }

    await this.db
      .update(portalAccessTokens)
      .set(updates)
      .where(eq(portalAccessTokens.id, tokenId));
  }

  async deactivatePortalToken(tokenId: number): Promise<boolean> {
    const [updatedToken] = await this.db
      .update(portalAccessTokens)
      .set({ isActive: false })
      .where(eq(portalAccessTokens.id, tokenId))
      .returning();
    return !!updatedToken;
  }

  async deletePortalToken(tokenId: number): Promise<boolean> {
    await this.db
      .delete(externalDocumentSubmissions)
      .where(eq(externalDocumentSubmissions.portalTokenId, tokenId));
    
    const [deletedToken] = await this.db
      .delete(portalAccessTokens)
      .where(eq(portalAccessTokens.id, tokenId))
      .returning();
    return !!deletedToken;
  }

  async getActivePortalTokensForTargetCompany(targetCompanyId: number): Promise<PortalAccessToken[]> {
    const tokens = await this.db
      .select()
      .from(portalAccessTokens)
      .where(and(
        eq(portalAccessTokens.targetCompanyId, targetCompanyId),
        eq(portalAccessTokens.isActive, true),
        sql`${portalAccessTokens.expiresAt} > NOW()`
      ));
    return tokens;
  }

  async getPortalTokensForCompany(userCompanyId: number): Promise<any[]> {
    return await this.db
      .select({
        id: portalAccessTokens.id,
        accessToken: portalAccessTokens.accessToken,
        targetCompanyId: portalAccessTokens.targetCompanyId,
        contactId: portalAccessTokens.targetContactId,
        isActive: portalAccessTokens.isActive,
        expiresAt: portalAccessTokens.expiresAt,
        createdAt: portalAccessTokens.createdAt,
        lastAccessed: portalAccessTokens.lastAccessed,
        companyName: targetCompanies.companyName,
        contactName: sql<string>`${targetContacts.firstName} || ' ' || ${targetContacts.lastName}`,
        contactEmail: targetContacts.email,
        documentSubmissions: sql<number>`(
          SELECT COUNT(*)::int 
          FROM ${externalDocumentSubmissions} 
          WHERE ${externalDocumentSubmissions.portalTokenId} = ${portalAccessTokens.id}
        )`,
      })
      .from(portalAccessTokens)
      .innerJoin(targetCompanies, eq(portalAccessTokens.targetCompanyId, targetCompanies.id))
      .innerJoin(targetContacts, eq(portalAccessTokens.targetContactId, targetContacts.id))
      .where(eq(portalAccessTokens.userCompanyId, userCompanyId))
      .orderBy(desc(portalAccessTokens.createdAt));
  }

  async getPortalTokenByCompany(targetCompanyId: number): Promise<any | null> {
    const result = await this.db
      .select({
        id: portalAccessTokens.id,
        accessToken: portalAccessTokens.accessToken,
        targetCompanyId: portalAccessTokens.targetCompanyId,
        targetContactId: portalAccessTokens.targetContactId,
        isActive: portalAccessTokens.isActive,
        expiresAt: portalAccessTokens.expiresAt,
        createdAt: portalAccessTokens.createdAt,
      })
      .from(portalAccessTokens)
      .where(
        and(
          eq(portalAccessTokens.targetCompanyId, targetCompanyId),
          eq(portalAccessTokens.isActive, true)
        )
      )
      .limit(1);
    
    return result[0] || null;
  }

  async createExternalDocumentSubmission(submission: InsertExternalDocumentSubmission): Promise<ExternalDocumentSubmission> {
    const [createdSubmission] = await this.db
      .insert(externalDocumentSubmissions)
      .values(submission)
      .returning();
    return createdSubmission;
  }

  async getPortalSubmissions(portalTokenId: number): Promise<ExternalDocumentSubmission[]> {
    return await this.db
      .select()
      .from(externalDocumentSubmissions)
      .where(eq(externalDocumentSubmissions.portalTokenId, portalTokenId))
      .orderBy(desc(externalDocumentSubmissions.submittedAt));
  }

  async reviewDocumentSubmission(submissionId: number, reviewedBy: number, status: string, notes?: string): Promise<boolean> {
    const [updatedSubmission] = await this.db
      .update(externalDocumentSubmissions)
      .set({
        processingStatus: status,
        reviewedBy,
        reviewedAt: new Date(),
        reviewNotes: notes || null,
      })
      .where(eq(externalDocumentSubmissions.id, submissionId))
      .returning();
    return !!updatedSubmission;
  }

  async createPortalDocumentRequirement(requirement: InsertPortalDocumentRequirement): Promise<PortalDocumentRequirement> {
    const [createdRequirement] = await this.db
      .insert(portalDocumentRequirements)
      .values(requirement)
      .returning();
    return createdRequirement;
  }

  async getPortalDocumentRequirements(portalTokenId: number): Promise<PortalDocumentRequirement[]> {
    return await this.db
      .select()
      .from(portalDocumentRequirements)
      .where(eq(portalDocumentRequirements.portalTokenId, portalTokenId))
      .orderBy(portalDocumentRequirements.collectionStage, portalDocumentRequirements.priorityLevel);
  }

  async updatePortalDocumentRequirement(requirementId: number, requirement: Partial<InsertPortalDocumentRequirement>): Promise<PortalDocumentRequirement | undefined> {
    const [updatedRequirement] = await this.db
      .update(portalDocumentRequirements)
      .set({ ...requirement, updatedAt: new Date() })
      .where(eq(portalDocumentRequirements.id, requirementId))
      .returning();
    return updatedRequirement || undefined;
  }

  async logPortalActivity(activity: InsertPortalActivityLog): Promise<void> {
    await this.db
      .insert(portalActivityLog)
      .values(activity);
  }

  async getPortalActivityLog(portalTokenId: number): Promise<PortalActivityLog[]> {
    return await this.db
      .select()
      .from(portalActivityLog)
      .where(eq(portalActivityLog.portalTokenId, portalTokenId))
      .orderBy(desc(portalActivityLog.activityTimestamp))
      .limit(100);
  }

  async getDealTeamEmails(targetCompanyId: number): Promise<string[]> {
    const dealAssignments = await this.db
      .select({
        email: users.email
      })
      .from(userDealAssignments)
      .innerJoin(users, eq(userDealAssignments.userId, users.id))
      .where(eq(userDealAssignments.targetCompanyId, targetCompanyId));
    
    return dealAssignments.map(assignment => assignment.email);
  }

  async createPortalLinkCampaign(campaign: InsertPortalLinkCampaign): Promise<PortalLinkCampaign> {
    const [createdCampaign] = await this.db
      .insert(portalLinkCampaigns)
      .values(campaign)
      .returning();
    return createdCampaign;
  }

  async getPortalLinkCampaigns(userCompanyId: number): Promise<PortalLinkCampaign[]> {
    return await this.db
      .select()
      .from(portalLinkCampaigns)
      .where(eq(portalLinkCampaigns.userCompanyId, userCompanyId))
      .orderBy(desc(portalLinkCampaigns.createdAt));
  }

  async getPortalLinkCampaign(campaignId: number, userCompanyId: number): Promise<PortalLinkCampaign | undefined> {
    const [campaign] = await this.db
      .select()
      .from(portalLinkCampaigns)
      .where(and(
        eq(portalLinkCampaigns.id, campaignId),
        eq(portalLinkCampaigns.userCompanyId, userCompanyId)
      ));
    return campaign || undefined;
  }

  async updatePortalLinkCampaign(campaignId: number, userCompanyId: number, updates: Partial<InsertPortalLinkCampaign>): Promise<PortalLinkCampaign | undefined> {
    const [updatedCampaign] = await this.db
      .update(portalLinkCampaigns)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(
        eq(portalLinkCampaigns.id, campaignId),
        eq(portalLinkCampaigns.userCompanyId, userCompanyId)
      ))
      .returning();
    return updatedCampaign || undefined;
  }

  async deletePortalLinkCampaign(campaignId: number, userCompanyId: number): Promise<boolean> {
    const [deletedCampaign] = await this.db
      .delete(portalLinkCampaigns)
      .where(and(
        eq(portalLinkCampaigns.id, campaignId),
        eq(portalLinkCampaigns.userCompanyId, userCompanyId)
      ))
      .returning();
    return !!deletedCampaign;
  }

  async createPortalEmailTemplate(template: InsertPortalEmailTemplate): Promise<PortalEmailTemplate> {
    const [createdTemplate] = await this.db
      .insert(portalEmailTemplates)
      .values(template)
      .returning();
    return createdTemplate;
  }

  async getPortalEmailTemplates(userCompanyId: number): Promise<PortalEmailTemplate[]> {
    return await this.db
      .select()
      .from(portalEmailTemplates)
      .where(and(
        eq(portalEmailTemplates.userCompanyId, userCompanyId),
        eq(portalEmailTemplates.isActive, true)
      ))
      .orderBy(desc(portalEmailTemplates.createdAt));
  }

  async getPortalEmailTemplate(templateId: number, userCompanyId: number): Promise<PortalEmailTemplate | undefined> {
    const [template] = await this.db
      .select()
      .from(portalEmailTemplates)
      .where(and(
        eq(portalEmailTemplates.id, templateId),
        eq(portalEmailTemplates.userCompanyId, userCompanyId)
      ));
    return template || undefined;
  }

  async updatePortalEmailTemplate(templateId: number, userCompanyId: number, updates: Partial<InsertPortalEmailTemplate>): Promise<PortalEmailTemplate | undefined> {
    const [updatedTemplate] = await this.db
      .update(portalEmailTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(
        eq(portalEmailTemplates.id, templateId),
        eq(portalEmailTemplates.userCompanyId, userCompanyId)
      ))
      .returning();
    return updatedTemplate || undefined;
  }

  async deletePortalEmailTemplate(templateId: number, userCompanyId: number): Promise<boolean> {
    const [deletedTemplate] = await this.db
      .delete(portalEmailTemplates)
      .where(and(
        eq(portalEmailTemplates.id, templateId),
        eq(portalEmailTemplates.userCompanyId, userCompanyId)
      ))
      .returning();
    return !!deletedTemplate;
  }

  async getDefaultPortalEmailTemplate(userCompanyId: number, templateCategory: string): Promise<PortalEmailTemplate | undefined> {
    const [template] = await this.db
      .select()
      .from(portalEmailTemplates)
      .where(and(
        eq(portalEmailTemplates.userCompanyId, userCompanyId),
        eq(portalEmailTemplates.templateCategory, templateCategory),
        eq(portalEmailTemplates.isActive, true)
      ))
      .orderBy(desc(portalEmailTemplates.createdAt))
      .limit(1);
    return template || undefined;
  }

  async createPortalCommunicationsLog(communication: InsertPortalCommunicationsLog): Promise<PortalCommunicationsLog> {
    const [loggedCommunication] = await this.db
      .insert(portalCommunicationsLog)
      .values(communication)
      .returning();
    return loggedCommunication;
  }

  async getPortalCommunicationsLog(userCompanyId: number, filters?: {
    campaignId?: number;
    targetContactId?: number;
    communicationType?: string;
  }): Promise<PortalCommunicationsLog[]> {
    const conditions = [eq(targetCompanies.userCompanyId, userCompanyId)];
    
    if (filters?.campaignId) {
      conditions.push(eq(portalCommunicationsLog.campaignId, filters.campaignId));
    }
    if (filters?.targetContactId) {
      conditions.push(eq(portalCommunicationsLog.targetContactId, filters.targetContactId));
    }
    if (filters?.communicationType) {
      conditions.push(eq(portalCommunicationsLog.communicationType, filters.communicationType));
    }

    const results = await this.db
      .select()
      .from(portalCommunicationsLog)
      .innerJoin(targetContacts, eq(portalCommunicationsLog.targetContactId, targetContacts.id))
      .innerJoin(targetCompanies, eq(targetContacts.targetCompanyId, targetCompanies.id))
      .where(and(...conditions))
      .orderBy(desc(portalCommunicationsLog.createdAt));
      
    return results.map(result => result.portal_communications_log);
  }

  async createPortalAnalytics(analytics: InsertPortalAnalytics): Promise<PortalAnalytics> {
    const [existingAnalytics] = await this.db
      .select()
      .from(portalAnalytics)
      .where(and(
        eq(portalAnalytics.userCompanyId, analytics.userCompanyId),
        eq(portalAnalytics.analyticsDate, analytics.analyticsDate || sql`CURRENT_DATE`),
        analytics.targetCompanyId ? eq(portalAnalytics.targetCompanyId, analytics.targetCompanyId) : isNull(portalAnalytics.targetCompanyId),
        analytics.portalTokenId ? eq(portalAnalytics.portalTokenId, analytics.portalTokenId) : isNull(portalAnalytics.portalTokenId)
      ));

    if (existingAnalytics) {
      const [updatedAnalytics] = await this.db
        .update(portalAnalytics)
        .set({ ...analytics, updatedAt: new Date() })
        .where(eq(portalAnalytics.id, existingAnalytics.id))
        .returning();
      return updatedAnalytics;
    } else {
      const [createdAnalytics] = await this.db
        .insert(portalAnalytics)
        .values(analytics)
        .returning();
      return createdAnalytics;
    }
  }

  async getPortalAnalytics(userCompanyId: number, filters?: {
    startDate?: string;
    endDate?: string;
    targetCompanyId?: number;
    portalTokenId?: number;
  }): Promise<PortalAnalytics[]> {
    const conditions = [eq(portalAnalytics.userCompanyId, userCompanyId)];

    if (filters?.startDate) {
      conditions.push(gte(portalAnalytics.analyticsDate, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(portalAnalytics.analyticsDate, filters.endDate));
    }
    if (filters?.targetCompanyId) {
      conditions.push(eq(portalAnalytics.targetCompanyId, filters.targetCompanyId));
    }
    if (filters?.portalTokenId) {
      conditions.push(eq(portalAnalytics.portalTokenId, filters.portalTokenId));
    }

    return await this.db
      .select()
      .from(portalAnalytics)
      .where(and(...conditions))
      .orderBy(desc(portalAnalytics.analyticsDate));
  }

  async incrementPortalAnalytics(userCompanyId: number, field: string, targetCompanyId?: number, portalTokenId?: number): Promise<void> {
    const today = sql`CURRENT_DATE`;
    
    const conditions = [
      eq(portalAnalytics.userCompanyId, userCompanyId),
      eq(portalAnalytics.analyticsDate, today)
    ];
    
    if (targetCompanyId) {
      conditions.push(eq(portalAnalytics.targetCompanyId, targetCompanyId));
    } else {
      conditions.push(isNull(portalAnalytics.targetCompanyId));
    }
    
    if (portalTokenId) {
      conditions.push(eq(portalAnalytics.portalTokenId, portalTokenId));
    } else {
      conditions.push(isNull(portalAnalytics.portalTokenId));
    }

    const [existing] = await this.db
      .select()
      .from(portalAnalytics)
      .where(and(...conditions));

    if (existing) {
      const updateData: any = { updatedAt: new Date() };
      updateData[field] = sql`COALESCE(${portalAnalytics[field as keyof typeof portalAnalytics]}, 0) + 1`;
      
      await this.db
        .update(portalAnalytics)
        .set(updateData)
        .where(eq(portalAnalytics.id, existing.id));
    } else {
      const insertData: any = {
        userCompanyId,
        analyticsDate: today,
        targetCompanyId: targetCompanyId || null,
        portalTokenId: portalTokenId || null,
        [field]: 1
      };
      
      await this.db
        .insert(portalAnalytics)
        .values(insertData);
    }
  }

  async createPortalLinkShare(share: InsertPortalLinkShare): Promise<PortalLinkShare> {
    const [createdShare] = await this.db
      .insert(portalLinkShares)
      .values(share)
      .returning();
    return createdShare;
  }

  async getPortalLinkShares(portalTokenId: number): Promise<PortalLinkShare[]> {
    return await this.db
      .select()
      .from(portalLinkShares)
      .where(eq(portalLinkShares.portalTokenId, portalTokenId))
      .orderBy(desc(portalLinkShares.createdAt));
  }

  async updatePortalLinkShareUsage(shareId: number): Promise<void> {
    await this.db
      .update(portalLinkShares)
      .set({ 
        currentUses: sql`${portalLinkShares.currentUses} + 1`,
        lastAccessed: new Date()
      })
      .where(eq(portalLinkShares.id, shareId));
  }

  async deactivatePortalLinkShare(shareId: number): Promise<boolean> {
    const [updatedShare] = await this.db
      .update(portalLinkShares)
      .set({ isActive: false })
      .where(eq(portalLinkShares.id, shareId))
      .returning();
    return !!updatedShare;
  }

  async initializeStandardRequirements(targetCompanyId: number, userId: number): Promise<{ stage1Requirements: number; stage2Requirements: number; totalRequirements: number; message: string }> {
    await this.db.execute(sql`SELECT initialize_standard_requirements(${targetCompanyId})`);

    try {
      await this.db.insert(activities).values({
        targetCompanyId,
        userId,
        activityType: 'system_action',
        title: 'Document Requirements Initialized',
        description: 'Initialized 29 standard document requirements (6 Stage 1 + 23 Stage 2)',
        activityDate: new Date(),
        isCompleted: true,
      });
    } catch (error) {
      console.error('Failed to log requirements initialization activity:', error);
    }

    return {
      stage1Requirements: 6,
      stage2Requirements: 23,
      totalRequirements: 29,
      message: 'Standard document requirements initialized successfully'
    };
  }

  async getCompanyDocumentRequirements(targetCompanyId: number, userCompanyId: number, stage?: number | null): Promise<CompanyDocumentRequirement[]> {
    const [company] = await this.db
      .select()
      .from(targetCompanies)
      .where(and(
        eq(targetCompanies.id, targetCompanyId),
        eq(targetCompanies.userCompanyId, userCompanyId)
      ));
    
    if (!company) {
      return [];
    }

    const whereClause = stage !== null && stage !== undefined 
      ? and(
          eq(companyDocumentRequirements.targetCompanyId, targetCompanyId),
          eq(companyDocumentRequirements.collectionStage, stage)
        )
      : eq(companyDocumentRequirements.targetCompanyId, targetCompanyId);

    const query = this.db
      .select({
        id: companyDocumentRequirements.id,
        targetCompanyId: companyDocumentRequirements.targetCompanyId,
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
        submittedByContactId: companyDocumentRequirements.submittedByContactId,
        reviewedBy: companyDocumentRequirements.reviewedBy,
        reviewedAt: companyDocumentRequirements.reviewedAt,
        reviewStatus: companyDocumentRequirements.reviewStatus,
        reviewNotes: companyDocumentRequirements.reviewNotes,
        reviewScore: companyDocumentRequirements.reviewScore,
        dueDate: companyDocumentRequirements.dueDate,
        reminderSentCount: companyDocumentRequirements.reminderSentCount,
        lastReminderSent: companyDocumentRequirements.lastReminderSent,
        nextReminderDue: companyDocumentRequirements.nextReminderDue,
        createdAt: companyDocumentRequirements.createdAt,
        updatedAt: companyDocumentRequirements.updatedAt,
        displayStatus: sql<string>`
          CASE 
            WHEN ${companyDocumentRequirements.dueDate} < NOW() THEN 'overdue'
            WHEN ${companyDocumentRequirements.requirementStatus} = 'submitted' THEN 'submitted'
            WHEN ${companyDocumentRequirements.requirementStatus} = 'approved' THEN 'approved'
            ELSE 'outstanding'
          END
        `
      })
      .from(companyDocumentRequirements)
      .where(whereClause)
      .orderBy(
        asc(companyDocumentRequirements.collectionStage), 
        desc(companyDocumentRequirements.priorityLevel), 
        asc(companyDocumentRequirements.requirementName)
      );

    const results = await query;
    return results;
  }

  async getDocumentStageProgression(targetCompanyId: number, userCompanyId: number): Promise<DocumentStageProgression | undefined> {
    const [company] = await this.db
      .select()
      .from(targetCompanies)
      .where(and(
        eq(targetCompanies.id, targetCompanyId),
        eq(targetCompanies.userCompanyId, userCompanyId)
      ));
    
    if (!company) {
      return undefined;
    }

    const [progression] = await this.db
      .select()
      .from(documentStageProgression)
      .where(eq(documentStageProgression.targetCompanyId, targetCompanyId));

    return progression;
  }

  async updateCompanyRequirement(requirementId: number, updates: any, userId: number): Promise<CompanyDocumentRequirement> {
    const [requirement] = await this.db
      .update(companyDocumentRequirements)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(companyDocumentRequirements.id, requirementId))
      .returning();
    return requirement;
  }

  async getValidPortalToken(token: string): Promise<any> {
    const results = await this.db
      .select()
      .from(portalAccessTokens)
      .innerJoin(targetCompanies, eq(portalAccessTokens.targetCompanyId, targetCompanies.id))
      .where(and(
        eq(portalAccessTokens.accessToken, token),
        eq(portalAccessTokens.isActive, true),
        gt(portalAccessTokens.expiresAt, new Date())
      ))
      .limit(1);
    
    if (results.length === 0) return null;
    
    const result = results[0];
    return {
      id: result.portal_access_tokens.id,
      accessToken: result.portal_access_tokens.accessToken,
      targetCompanyId: result.portal_access_tokens.targetCompanyId,
      target_company_id: result.portal_access_tokens.targetCompanyId,
      targetContactId: result.portal_access_tokens.targetContactId,
      expiresAt: result.portal_access_tokens.expiresAt,
      expires_at: result.portal_access_tokens.expiresAt,
      isActive: result.portal_access_tokens.isActive,
      company_name: result.target_companies.companyName,
      user_company_id: result.target_companies.userCompanyId
    };
  }

  async getSimplePortalData(portalTokenId: number): Promise<any> {
    try {
      const [tokenInfo] = await this.db
        .select()
        .from(portalAccessTokens)
        .where(eq(portalAccessTokens.id, portalTokenId))
        .limit(1);
      
      if (!tokenInfo) {
        throw new Error('No active portal token found');
      }

      const portalSubmissions = await this.db
        .select({
          id: externalDocumentSubmissions.id,
          documentType: externalDocumentSubmissions.documentCategory,
          filename: externalDocumentSubmissions.originalFilename,
          submittedAt: externalDocumentSubmissions.createdAt,
          status: externalDocumentSubmissions.processingStatus,
          source: sql<string>`'portal'`
        })
        .from(externalDocumentSubmissions)
        .where(eq(externalDocumentSubmissions.portalTokenId, portalTokenId))
        .orderBy(sql`${externalDocumentSubmissions.createdAt} DESC`);

      const libraryUploads = await this.db
        .select({
          id: documents.id,
          documentType: sql<string>`CASE 
            WHEN ${documents.documentCategory} = 'Company Accounts' THEN 'company_accounts'
            WHEN ${documents.documentCategory} = 'Profit & Loss' THEN 'p_and_l'  
            WHEN ${documents.documentCategory} = 'Balance Sheet' THEN 'balance_sheet'
            WHEN ${documents.documentCategory} = 'Sales Ledger' THEN 'sales_ledger'
            WHEN ${documents.documentCategory} = 'Asset Register' THEN 'asset_register'
            WHEN ${documents.documentCategory} = 'Staff Matrix' THEN 'staff_matrix'
            ELSE LOWER(REPLACE(${documents.documentCategory}, ' ', '_'))
          END`,
          filename: documents.documentName,
          submittedAt: documents.uploadDate,
          status: sql<string>`'completed'`,
          source: sql<string>`'library'`
        })
        .from(documents)
        .where(
          and(
            eq(documents.targetCompanyId, tokenInfo.targetCompanyId),
            isNull(documents.externalSubmissionId)
          )
        )
        .orderBy(sql`${documents.uploadDate} DESC`);

      const submissions = [...portalSubmissions, ...libraryUploads];

      const [company] = await this.db
        .select({
          companyName: targetCompanies.companyName
        })
        .from(targetCompanies)
        .where(eq(targetCompanies.id, tokenInfo.targetCompanyId))
        .limit(1);

      const companyAccountsSubmissions = submissions.filter(s => 
        s.documentType === 'company_accounts'
      );

      const documentRequirements = [
        {
          type: 'company_accounts',
          label: 'Company Accounts',
          required: 5,
          submitted: companyAccountsSubmissions.length,
          isGroup: true,
          submissions: companyAccountsSubmissions
        },
        { type: 'p_and_l', label: 'P&L Statement', required: 1, isGroup: false },
        { type: 'balance_sheet', label: 'Balance Sheet', required: 1, isGroup: false },
        { type: 'sales_ledger', label: 'Sales Ledger', required: 1, isGroup: false },
        { type: 'asset_register', label: 'Asset Register', required: 1, isGroup: false },
        { type: 'staff_matrix', label: 'Staff Matrix', required: 1, isGroup: false }
      ];

      const documentStatus = documentRequirements.map(req => {
        if (req.isGroup) {
          return {
            type: req.type,
            label: req.label,
            required: req.required,
            submitted: req.submitted,
            isGroup: true,
            isComplete: (req.submitted || 0) >= req.required,
            submissions: req.submissions
          };
        } else {
          const submission = submissions.find(s => s.documentType === req.type);
          return {
            type: req.type,
            label: req.label,
            required: req.required,
            submitted: submission ? 1 : 0,
            isGroup: false,
            isComplete: !!submission,
            submission: submission ? {
              id: submission.id,
              filename: submission.filename,
              submittedAt: submission.submittedAt,
              status: submission.status
            } : null
          };
        }
      });

      const totalDocuments = submissions.length;
      const progressPercentage = Math.min(Math.round((totalDocuments / 10) * 100), 100);

      return {
        company_name: company?.companyName || 'Unknown Company',
        total_documents_required: 10,
        total_submitted: totalDocuments,
        progress_percentage: progressPercentage,
        document_status: documentStatus,
        portal_expires_at: tokenInfo.expiresAt,
        targetCompanyId: tokenInfo.targetCompanyId
      };
    } catch (error) {
      console.error('Error in getSimplePortalData:', error);
      throw error;
    }
  }

  async getSimplePortalProgress(portalTokenId: number): Promise<{ submittedTypes: string[], totalSubmissions: number }> {
    try {
      const submissions = await this.db
        .select({
          submissionNotes: externalDocumentSubmissions.submissionNotes
        })
        .from(externalDocumentSubmissions)
        .where(eq(externalDocumentSubmissions.portalTokenId, portalTokenId));
      
      const submittedTypes = submissions
        .map(s => s.submissionNotes)
        .filter((note): note is string => Boolean(note));
      
      return {
        submittedTypes,
        totalSubmissions: submittedTypes.length
      };
    } catch (error) {
      console.error('Error getting simple portal progress:', error);
      return { submittedTypes: [], totalSubmissions: 0 };
    }
  }
}

export const portalStore = new PortalStore(db);
