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
  documentAccessLog,
  stageHistory,
  portalAccessTokens,
  portalActivityLog,
  portalDocumentRequirements,
  portalLinkShares,
  chaseUpSchedules,
  chaseUpEmails,
  externalDocumentSubmissions,
  fileUploadEvents,
  documentAnalysisResults,
  stage1AnalysisEvents,
  expertAnalysisResults,
  userDealAssignments,
  teamNotifications,
  dashboardAlerts,
  portalAnalytics,
  companyDocumentRequirements,
  documentStageProgression,
  dealDocuments,
  dealDocumentResponses,
  financialPeriods,
  incomeStatements,
  balanceSheets,
  staffData,
  agedDebtors,
  fixedAssetsRegister,
  loanFacilities,
  ebitdaAdjustments,
  valuations,
  dealModels,
  dealModelAdjustments,
  dealModelFundingLines,
  dealMetricsSnapshots,
} from '@shared/schema';
import { eq, sql, inArray, count, and } from 'drizzle-orm';
import { portalRepository } from '../repositories/portal.repository';

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
          .where(and(eq(targetCompanies.userCompanyId, userCompanyId), eq(targetCompanies.isArchived, false)));
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
      subSector: data.subSector || null,
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

    const existing = await targetCompaniesRepository.getById(id, userCompanyId);

    const updated = await targetCompaniesRepository.update(id, updateData, userCompanyId);
    if (!updated) {
      throw new NotFoundError('Target company not found');
    }

    if (
      updateData.website !== undefined &&
      updateData.website &&
      updateData.website !== existing?.website
    ) {
      console.log(`[TARGET_COMPANIES] Website changed for company ${id}: "${existing?.website}" → "${updateData.website}" — triggering re-analysis`);
      websiteAnalysisService.triggerAnalysisIfNeeded(id, updateData.website, { userCompanyId, dealId: id });
    }

    return updated;
  }

  async delete(id: number, userCompanyId: number): Promise<boolean> {
    if (!id || isNaN(id)) {
      throw new BadRequestError('Invalid target company ID');
    }

    const company = await targetCompaniesRepository.getById(id, userCompanyId);
    if (!company) {
      throw new NotFoundError('Target company not found');
    }

    // 1. Get child IDs needed for cascading deletes
    const uploadEvents = await db.select({ id: fileUploadEvents.id })
      .from(fileUploadEvents)
      .where(eq(fileUploadEvents.targetCompanyId, id));
    const uploadEventIds = uploadEvents.map(e => e.id);

    const portalTokens = await db.select({ id: portalAccessTokens.id })
      .from(portalAccessTokens)
      .where(eq(portalAccessTokens.targetCompanyId, id));
    const portalTokenIds = portalTokens.map(t => t.id);

    const dealModelRows = await db.select({ id: dealModels.id })
      .from(dealModels)
      .where(eq(dealModels.targetCompanyId, id));
    const dealModelIds = dealModelRows.map(m => m.id);

    // 2. Document analysis results (depend on fileUploadEvents)
    if (uploadEventIds.length > 0) {
      await db.delete(documentAnalysisResults).where(inArray(documentAnalysisResults.fileUploadEventId, uploadEventIds));
    }
    await db.delete(fileUploadEvents).where(eq(fileUploadEvents.targetCompanyId, id));

    // 3. Document access log (depends on documents)
    await db.execute(sql`
      DELETE FROM document_access_log
      WHERE document_id IN (
        SELECT id FROM documents WHERE target_company_id = ${id}
      )
    `);

    // 4. Null out source_document_id on financial tables before deleting documents
    await db.execute(sql`UPDATE financial_periods SET source_document_id = NULL WHERE target_company_id = ${id}`);
    await db.execute(sql`UPDATE income_statements SET source_document_id = NULL WHERE target_company_id = ${id}`);
    await db.execute(sql`UPDATE balance_sheets SET source_document_id = NULL WHERE target_company_id = ${id}`);
    await db.execute(sql`UPDATE staff_data SET source_document_id = NULL WHERE target_company_id = ${id}`);
    await db.execute(sql`UPDATE aged_debtors SET source_document_id = NULL WHERE target_company_id = ${id}`);
    await db.execute(sql`UPDATE fixed_assets_register SET source_document_id = NULL WHERE target_company_id = ${id}`);
    await db.execute(sql`UPDATE loan_facilities SET source_document_id = NULL WHERE target_company_id = ${id}`);

    // 5. Deal document responses and deal documents (deal_documents references portal_access_tokens)
    await db.execute(sql`
      DELETE FROM deal_document_responses
      WHERE deal_document_id IN (
        SELECT id FROM deal_documents WHERE target_company_id = ${id}
      )
    `);
    await db.delete(dealDocuments).where(eq(dealDocuments.targetCompanyId, id));

    // 6. Documents
    await db.delete(documents).where(eq(documents.targetCompanyId, id));

    // 8. Document stage progression and company document requirements
    await db.delete(documentStageProgression).where(eq(documentStageProgression.targetCompanyId, id));
    await db.delete(companyDocumentRequirements).where(eq(companyDocumentRequirements.targetCompanyId, id));

    // 9. External document submissions
    await db.delete(externalDocumentSubmissions).where(eq(externalDocumentSubmissions.targetCompanyId, id));

    // 10. Portal analytics
    await db.delete(portalAnalytics).where(eq(portalAnalytics.targetCompanyId, id));

    // 11. Portal child records (depend on portal_access_tokens)
    if (portalTokenIds.length > 0) {
      await db.delete(portalActivityLog).where(inArray(portalActivityLog.portalTokenId, portalTokenIds));
      await db.delete(portalDocumentRequirements).where(inArray(portalDocumentRequirements.portalTokenId, portalTokenIds));
      await db.delete(portalLinkShares).where(inArray(portalLinkShares.portalTokenId, portalTokenIds));
      await db.delete(chaseUpEmails).where(inArray(chaseUpEmails.portalTokenId, portalTokenIds));
      await db.delete(chaseUpSchedules).where(inArray(chaseUpSchedules.portalTokenId, portalTokenIds));
    }
    await db.delete(portalAccessTokens).where(eq(portalAccessTokens.targetCompanyId, id));

    // 12. Financial data
    await db.delete(ebitdaAdjustments).where(eq(ebitdaAdjustments.targetCompanyId, id));
    await db.execute(sql`
      DELETE FROM income_statements WHERE financial_period_id IN (
        SELECT id FROM financial_periods WHERE target_company_id = ${id}
      )
    `);
    await db.execute(sql`
      DELETE FROM balance_sheets WHERE financial_period_id IN (
        SELECT id FROM financial_periods WHERE target_company_id = ${id}
      )
    `);
    await db.execute(sql`
      DELETE FROM staff_data WHERE financial_period_id IN (
        SELECT id FROM financial_periods WHERE target_company_id = ${id}
      )
    `);
    await db.delete(agedDebtors).where(eq(agedDebtors.targetCompanyId, id));
    await db.delete(fixedAssetsRegister).where(eq(fixedAssetsRegister.targetCompanyId, id));
    await db.delete(loanFacilities).where(eq(loanFacilities.targetCompanyId, id));
    await db.delete(valuations).where(eq(valuations.targetCompanyId, id));
    await db.delete(financialPeriods).where(eq(financialPeriods.targetCompanyId, id));

    // 13. Deal model data
    if (dealModelIds.length > 0) {
      await db.delete(dealMetricsSnapshots).where(inArray(dealMetricsSnapshots.dealModelId, dealModelIds));
      await db.delete(dealModelAdjustments).where(inArray(dealModelAdjustments.dealModelId, dealModelIds));
      await db.delete(dealModelFundingLines).where(inArray(dealModelFundingLines.dealModelId, dealModelIds));
    }
    await db.delete(dealMetricsSnapshots).where(eq(dealMetricsSnapshots.targetCompanyId, id));
    await db.delete(dealModels).where(eq(dealModels.targetCompanyId, id));

    // 14. Expert analysis
    await db.delete(stage1AnalysisEvents).where(eq(stage1AnalysisEvents.targetCompanyId, id));
    await db.delete(expertAnalysisResults).where(eq(expertAnalysisResults.targetCompanyId, id));

    // 15. Remaining target company child records
    await db.delete(stageHistory).where(eq(stageHistory.targetCompanyId, id));
    await db.delete(activities).where(eq(activities.targetCompanyId, id));
    await db.delete(targetContacts).where(eq(targetContacts.targetCompanyId, id));
    await db.delete(teamNotifications).where(eq(teamNotifications.targetCompanyId, id));
    await db.delete(dashboardAlerts).where(eq(dashboardAlerts.targetCompanyId, id));
    await db.delete(userDealAssignments).where(eq(userDealAssignments.targetCompanyId, id));

    // 16. Finally delete the target company itself
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

  async getArchived(userCompanyId: number): Promise<TargetCompanyWithStats[]> {
    return await targetCompaniesRepository.getArchived(userCompanyId);
  }

  async archive(id: number, userCompanyId: number): Promise<TargetCompany> {
    if (!id || isNaN(id)) throw new BadRequestError('Invalid target company ID');

    const existing = await targetCompaniesRepository.getById(id, userCompanyId);
    if (!existing) throw new NotFoundError('Target company not found');
    if (existing.isArchived) throw new BadRequestError('Company is already archived');

    const company = await targetCompaniesRepository.archive(id, userCompanyId);
    if (!company) throw new NotFoundError('Target company not found');
    await portalRepository.deactivateTokensForCompany(id);
    return company;
  }

  async unarchive(id: number, userCompanyId: number): Promise<TargetCompany> {
    if (!id || isNaN(id)) throw new BadRequestError('Invalid target company ID');

    const existing = await targetCompaniesRepository.getById(id, userCompanyId);
    if (!existing) throw new NotFoundError('Target company not found');
    if (!existing.isArchived) throw new BadRequestError('Company is not archived');

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
          .where(and(eq(targetCompanies.userCompanyId, userCompanyId), eq(targetCompanies.isArchived, false)));
        if (total >= maxTargets) {
          throw new ForbiddenError(
            `You have reached the limit of ${maxTargets} active compan${maxTargets === 1 ? 'y' : 'ies'} on your current plan. Please upgrade or archive another company before reinstating this one.`
          );
        }
      }
    }

    const company = await targetCompaniesRepository.unarchive(id, userCompanyId);
    if (!company) throw new NotFoundError('Target company not found');
    return company;
  }
}

export const targetCompaniesService = new TargetCompaniesService();
