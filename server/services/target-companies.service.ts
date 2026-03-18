import { targetCompaniesRepository, type TargetCompanyWithStats, type SearchParams, type FilterOptions } from '../repositories/target-companies.repository';
import { websiteAnalysisService } from './website-analysis.service';
import { billingService } from './billing.service';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/errors';
import { getMaxActiveTargets } from '@shared/entitlements';
import type { PlanKey } from '@shared/schema/billing';
import type { TargetCompany, InsertTargetCompany } from '@shared/schema';
import { db } from '../db';
import { 
  targetCompanies,
  targetContacts, 
  activities, 
  documents, 
  stageHistory,
  portalAccessTokens,
  portalActivityLog,
  externalDocumentSubmissions,
  fileUploadEvents,
  documentAnalysisResults,
  userDealAssignments,
  teamNotifications,
  dashboardAlerts,
  portalAnalytics,
  companyDocumentRequirements,
  documentStageProgression
} from '@shared/schema';
import { eq, sql, inArray, count } from 'drizzle-orm';

export class TargetCompaniesService {
  async getAll(userCompanyId: number): Promise<TargetCompanyWithStats[]> {
    if (!userCompanyId || isNaN(userCompanyId)) {
      throw new BadRequestError('Invalid user company ID');
    }
    return await targetCompaniesRepository.getAll(userCompanyId);
  }

  async getById(id: number, userCompanyId: number): Promise<TargetCompany> {
    if (!id || isNaN(id)) {
      throw new BadRequestError('Invalid target company ID');
    }

    const company = await targetCompaniesRepository.getById(id, userCompanyId);
    if (!company) {
      throw new NotFoundError('Target company not found');
    }
    return company;
  }

  async create(data: Omit<InsertTargetCompany, 'userCompanyId' | 'createdBy'>, userId: number, userCompanyId: number): Promise<TargetCompany> {
    const subscription = await billingService.getSubscription(userCompanyId);
    if (subscription) {
      const maxTargets = getMaxActiveTargets(
        subscription.planKey as PlanKey,
        subscription.addOnCompanySlots ?? 0,
        subscription.enterpriseOverrides as Record<string, unknown> | null
      );
      if (maxTargets !== null) {
        const [{ total }] = await db
          .select({ total: count() })
          .from(targetCompanies)
          .where(eq(targetCompanies.userCompanyId, userCompanyId));
        if (total >= maxTargets) {
          throw new ForbiddenError(
            `You have reached the limit of ${maxTargets} compan${maxTargets === 1 ? 'y' : 'ies'} on your current plan. Please upgrade to add more.`
          );
        }
      }
    }

    const processedData = {
      companyName: data.companyName,
      industry: data.industry || null,
      website: data.website || null,
      phone: data.phone || null,
      email: data.email || null,
      address: data.address || null,
      annualRevenue: data.annualRevenue || null,
      employeeCount: typeof data.employeeCount === 'string' && (data.employeeCount as string).trim()
        ? parseInt(data.employeeCount as string) || null
        : data.employeeCount || null,
      yearEstablished: typeof data.yearEstablished === 'string' && (data.yearEstablished as string).trim()
        ? parseInt(data.yearEstablished as string) || null
        : data.yearEstablished || null,
      description: data.description || null,
      stage: data.stage || 'New Target',
      userCompanyId,
      createdBy: userId,
    };

    const company = await targetCompaniesRepository.create(processedData as InsertTargetCompany);

    if (company.website) {
      websiteAnalysisService.triggerAnalysisIfNeeded(company.id, company.website, { userId, userCompanyId, dealId: company.id });
    }

    const { track } = await import('./funnel.service');
    track(userCompanyId, userId, 'target.created', { sector: company.industry });

    return company;
  }

  async update(id: number, updateData: Partial<InsertTargetCompany>, userCompanyId: number): Promise<TargetCompany> {
    if (!id || isNaN(id)) {
      throw new BadRequestError('Invalid target company ID');
    }

    const updated = await targetCompaniesRepository.update(id, updateData, userCompanyId);
    if (!updated) {
      throw new NotFoundError('Target company not found');
    }
    return updated;
  }

  async delete(id: number, userCompanyId: number): Promise<boolean> {
    if (!id || isNaN(id)) {
      throw new BadRequestError('Invalid target company ID');
    }

    // Verify the company exists and belongs to this user company first
    const company = await targetCompaniesRepository.getById(id, userCompanyId);
    if (!company) {
      throw new NotFoundError('Target company not found');
    }

    // Delete related records in dependency order (most dependent first)
    // Order matters due to foreign key constraints between related tables
    
    // Get file upload event IDs for this target company to delete document analysis results
    const uploadEvents = await db.select({ id: fileUploadEvents.id })
      .from(fileUploadEvents)
      .where(eq(fileUploadEvents.targetCompanyId, id));
    const uploadEventIds = uploadEvents.map(e => e.id);
    
    // Delete document analysis results (via file upload event IDs)
    if (uploadEventIds.length > 0) {
      await db.delete(documentAnalysisResults).where(inArray(documentAnalysisResults.fileUploadEventId, uploadEventIds));
    }
    
    // Delete file upload events
    await db.delete(fileUploadEvents).where(eq(fileUploadEvents.targetCompanyId, id));
    
    // Delete documents
    await db.delete(documents).where(eq(documents.targetCompanyId, id));
    
    // Delete document requirement submissions via raw SQL (table exists but not in schema)
    await db.execute(sql`DELETE FROM document_requirement_submissions WHERE target_company_id = ${id}`);
    
    // Delete document stage progression
    await db.delete(documentStageProgression).where(eq(documentStageProgression.targetCompanyId, id));
    
    // Delete company document requirements
    await db.delete(companyDocumentRequirements).where(eq(companyDocumentRequirements.targetCompanyId, id));
    
    // Delete external document submissions
    await db.delete(externalDocumentSubmissions).where(eq(externalDocumentSubmissions.targetCompanyId, id));
    
    // Delete portal analytics
    await db.delete(portalAnalytics).where(eq(portalAnalytics.targetCompanyId, id));
    
    // Get portal token IDs to delete portal activity log first
    const portalTokens = await db.select({ id: portalAccessTokens.id })
      .from(portalAccessTokens)
      .where(eq(portalAccessTokens.targetCompanyId, id));
    const portalTokenIds = portalTokens.map(t => t.id);
    
    // Delete portal activity log (references portal_access_tokens)
    if (portalTokenIds.length > 0) {
      await db.delete(portalActivityLog).where(inArray(portalActivityLog.portalTokenId, portalTokenIds));
    }
    
    // Delete portal access tokens
    await db.delete(portalAccessTokens).where(eq(portalAccessTokens.targetCompanyId, id));
    
    // Delete stage history
    await db.delete(stageHistory).where(eq(stageHistory.targetCompanyId, id));
    
    // Delete activities
    await db.delete(activities).where(eq(activities.targetCompanyId, id));
    
    // Delete contacts
    await db.delete(targetContacts).where(eq(targetContacts.targetCompanyId, id));
    
    // Delete team notifications
    await db.delete(teamNotifications).where(eq(teamNotifications.targetCompanyId, id));
    
    // Delete dashboard alerts
    await db.delete(dashboardAlerts).where(eq(dashboardAlerts.targetCompanyId, id));
    
    // Delete user deal assignments
    await db.delete(userDealAssignments).where(eq(userDealAssignments.targetCompanyId, id));

    // Now delete the target company itself
    const deleted = await targetCompaniesRepository.delete(id, userCompanyId);
    if (!deleted) {
      throw new NotFoundError('Target company not found');
    }
    return true;
  }

  async getFilterOptions(userCompanyId: number): Promise<FilterOptions> {
    if (!userCompanyId || isNaN(userCompanyId)) {
      throw new BadRequestError('Invalid user company ID');
    }
    return await targetCompaniesRepository.getFilterOptions(userCompanyId);
  }

  async search(userCompanyId: number, params: SearchParams): Promise<TargetCompanyWithStats[]> {
    if (!userCompanyId || isNaN(userCompanyId)) {
      throw new BadRequestError('Invalid user company ID');
    }
    return await targetCompaniesRepository.search(userCompanyId, params);
  }
}

export const targetCompaniesService = new TargetCompaniesService();
