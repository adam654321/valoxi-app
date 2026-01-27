import { eq } from 'drizzle-orm';
import { db } from '../db';
import { portalRequirementsRepository, type RequirementProgress } from '../repositories/portal-requirements.repository';
import { targetCompaniesRepository } from '../repositories/target-companies.repository';
import { activitiesRepository } from '../repositories/activities.repository';
import { NotFoundError, ForbiddenError, BadRequestError } from '../utils/errors';
import { targetCompanies, type CompanyDocumentRequirement } from '@shared/schema';

interface DetailedProgress {
  stage1: { total: number; completed: number; outstanding: number; overdue: number; percentage: number };
  stage2: { total: number; completed: number; outstanding: number; overdue: number; percentage: number };
  overall: { total: number; completed: number; outstanding: number; overdue: number; percentage: number };
}

export class PortalRequirementsService {
  async getRequirementsForCompany(targetCompanyId: number, userCompanyId: number, stage?: number | null): Promise<RequirementProgress[]> {
    const company = await targetCompaniesRepository.getById(targetCompanyId, userCompanyId);
    if (!company) throw new ForbiddenError('Company not found or access denied');
    return await portalRequirementsRepository.getCompanyRequirements(targetCompanyId, stage);
  }

  async initializeRequirements(targetCompanyId: number, userCompanyId: number, userId: number): Promise<{ stage1Requirements: number; stage2Requirements: number; totalRequirements: number; message: string }> {
    const company = await targetCompaniesRepository.getById(targetCompanyId, userCompanyId);
    if (!company) throw new ForbiddenError('Company not found or access denied');
    const hasExisting = await portalRequirementsRepository.hasRequirements(targetCompanyId);
    if (hasExisting) {
      const requirements = await portalRequirementsRepository.getCompanyRequirements(targetCompanyId);
      const stage1 = requirements.filter(r => r.collectionStage === 1).length;
      const stage2 = requirements.filter(r => r.collectionStage === 2).length;
      return { stage1Requirements: stage1, stage2Requirements: stage2, totalRequirements: requirements.length, message: 'Requirements already initialized' };
    }
    await portalRequirementsRepository.initializeStandardRequirements(targetCompanyId);
    const requirements = await portalRequirementsRepository.getCompanyRequirements(targetCompanyId);
    const stage1 = requirements.filter(r => r.collectionStage === 1).length;
    const stage2 = requirements.filter(r => r.collectionStage === 2).length;
    try { await activitiesRepository.createActivity({ targetCompanyId, userId, activityType: 'document_requirement', title: 'Document Requirements Initialized', description: `Initialized ${requirements.length} standard document requirements`, activityDate: new Date() }); } catch {}
    return { stage1Requirements: stage1, stage2Requirements: stage2, totalRequirements: requirements.length, message: 'Standard requirements initialized successfully' };
  }

  async updateRequirement(requirementId: number, updates: Partial<CompanyDocumentRequirement>, userCompanyId: number, userId: number): Promise<CompanyDocumentRequirement> {
    const requirement = await portalRequirementsRepository.getRequirementById(requirementId);
    if (!requirement) throw new NotFoundError('Requirement not found');
    const company = await targetCompaniesRepository.getById(requirement.targetCompanyId, userCompanyId);
    if (!company) throw new ForbiddenError('Not authorized to update this requirement');
    const allowedUpdates: Partial<CompanyDocumentRequirement> = {};
    if (updates.requirementStatus !== undefined) allowedUpdates.requirementStatus = updates.requirementStatus;
    if (updates.submissionStatus !== undefined) allowedUpdates.submissionStatus = updates.submissionStatus;
    if (updates.reviewStatus !== undefined) allowedUpdates.reviewStatus = updates.reviewStatus;
    if (updates.reviewNotes !== undefined) allowedUpdates.reviewNotes = updates.reviewNotes;
    if (updates.dueDate !== undefined) allowedUpdates.dueDate = updates.dueDate;
    if (updates.priorityLevel !== undefined) allowedUpdates.priorityLevel = updates.priorityLevel;
    if (updates.reviewedBy !== undefined) allowedUpdates.reviewedBy = updates.reviewedBy;
    if (updates.reviewedAt !== undefined) allowedUpdates.reviewedAt = updates.reviewedAt;
    const updated = await portalRequirementsRepository.updateRequirement(requirementId, allowedUpdates, userId);
    if (!updated) throw new NotFoundError('Failed to update requirement');
    return updated;
  }

  async getDetailedProgress(targetCompanyId: number, userCompanyId: number): Promise<DetailedProgress> {
    const company = await targetCompaniesRepository.getById(targetCompanyId, userCompanyId);
    if (!company) throw new ForbiddenError('Company not found or access denied');
    const [stage1Stats, stage2Stats] = await Promise.all([
      portalRequirementsRepository.getRequirementCountByStage(targetCompanyId, 1),
      portalRequirementsRepository.getRequirementCountByStage(targetCompanyId, 2),
    ]);
    const overall = {
      total: stage1Stats.total + stage2Stats.total,
      completed: stage1Stats.completed + stage2Stats.completed,
      outstanding: stage1Stats.outstanding + stage2Stats.outstanding,
      overdue: stage1Stats.overdue + stage2Stats.overdue,
      percentage: 0,
    };
    overall.percentage = overall.total > 0 ? Math.round((overall.completed / overall.total) * 100) : 0;
    return {
      stage1: { ...stage1Stats, percentage: stage1Stats.total > 0 ? Math.round((stage1Stats.completed / stage1Stats.total) * 100) : 0 },
      stage2: { ...stage2Stats, percentage: stage2Stats.total > 0 ? Math.round((stage2Stats.completed / stage2Stats.total) * 100) : 0 },
      overall,
    };
  }

  async getPortalRequirements(accessToken: string): Promise<{ requirements: RequirementProgress[]; progress: DetailedProgress; companyName: string }> {
    const token = await portalRequirementsRepository.getValidPortalToken(accessToken);
    if (!token) throw new NotFoundError('Invalid or expired portal token');
    const [company] = await db.select().from(targetCompanies).where(eq(targetCompanies.id, token.targetCompanyId));
    if (!company) throw new NotFoundError('Company not found');
    const requirements = await portalRequirementsRepository.getCompanyRequirements(token.targetCompanyId, 1);
    const [stage1Stats, stage2Stats] = await Promise.all([
      portalRequirementsRepository.getRequirementCountByStage(token.targetCompanyId, 1),
      portalRequirementsRepository.getRequirementCountByStage(token.targetCompanyId, 2),
    ]);
    const overall = { total: stage1Stats.total + stage2Stats.total, completed: stage1Stats.completed + stage2Stats.completed, outstanding: stage1Stats.outstanding + stage2Stats.outstanding, overdue: stage1Stats.overdue + stage2Stats.overdue, percentage: 0 };
    overall.percentage = overall.total > 0 ? Math.round((overall.completed / overall.total) * 100) : 0;
    return {
      requirements,
      progress: {
        stage1: { ...stage1Stats, percentage: stage1Stats.total > 0 ? Math.round((stage1Stats.completed / stage1Stats.total) * 100) : 0 },
        stage2: { ...stage2Stats, percentage: stage2Stats.total > 0 ? Math.round((stage2Stats.completed / stage2Stats.total) * 100) : 0 },
        overall,
      },
      companyName: company.companyName,
    };
  }

  async getOverdueRequirements(targetCompanyId: number, userCompanyId: number): Promise<RequirementProgress[]> {
    const company = await targetCompaniesRepository.getById(targetCompanyId, userCompanyId);
    if (!company) throw new ForbiddenError('Company not found or access denied');
    return await portalRequirementsRepository.getOverdueRequirements(targetCompanyId);
  }

  async markRequirementAsFulfilled(targetCompanyId: number, documentCategory: string, documentId: number, contactId?: number): Promise<CompanyDocumentRequirement | null> {
    const requirement = await portalRequirementsRepository.findRequirementByCategory(targetCompanyId, documentCategory);
    if (!requirement) return null;
    const updated = await portalRequirementsRepository.updateRequirementSubmission(requirement.id, documentId, contactId || 0);
    return updated || null;
  }

  async getSubmissionCategoryCounts(targetCompanyId: number, userCompanyId: number): Promise<{ category: string; count: number }[]> {
    const company = await targetCompaniesRepository.getById(targetCompanyId, userCompanyId);
    if (!company) throw new ForbiddenError('Company not found or access denied');
    return await portalRequirementsRepository.getSubmissionProgress(targetCompanyId);
  }
}

export const portalRequirementsService = new PortalRequirementsService();
