import { db } from '../db';
import { ddCategories, ddRequirements, ddRequirementStatus } from '@shared/schema/due-diligence';
import type { DdCategory, DdRequirement, DdRequirementStatus } from '@shared/schema/due-diligence';
import { eq, and, sql, asc } from 'drizzle-orm';
import { NotFoundError, BadRequestError } from '../utils/errors';

export interface DdCategoryWithStatus {
  category: DdCategory;
  requirements: Array<DdRequirement & { status: DdRequirementStatus | null }>;
  completedCount: number;
  totalCount: number;
  mandatoryCompletedCount: number;
  mandatoryTotalCount: number;
}

export interface DdCompletionSummary {
  total: number;
  completed: number;
  mandatory: { total: number; completed: number };
  advisory: { total: number; completed: number };
  addsValue: { total: number; completed: number };
  byCategory: Array<{
    categoryId: number;
    categoryName: string;
    total: number;
    completed: number;
    mandatoryTotal: number;
    mandatoryCompleted: number;
  }>;
}

class DueDiligenceService {
  async getAllCategories() {
    const categories = await db.select().from(ddCategories)
      .where(eq(ddCategories.isActive, true))
      .orderBy(asc(ddCategories.sortOrder));

    const requirements = await db.select().from(ddRequirements)
      .where(eq(ddRequirements.isActive, true))
      .orderBy(asc(ddRequirements.sortOrder));

    return categories.map(cat => ({
      ...cat,
      requirements: requirements.filter(r => r.categoryId === cat.id),
    }));
  }

  async getRequirementsByCategory(categoryId: number) {
    const [category] = await db.select().from(ddCategories)
      .where(eq(ddCategories.id, categoryId));

    if (!category) {
      throw new NotFoundError(`Category with id ${categoryId} not found`);
    }

    const requirements = await db.select().from(ddRequirements)
      .where(and(
        eq(ddRequirements.categoryId, categoryId),
        eq(ddRequirements.isActive, true),
      ))
      .orderBy(asc(ddRequirements.sortOrder));

    return { category, requirements };
  }

  async getDdStatusForCompany(targetCompanyId: number): Promise<DdCategoryWithStatus[]> {
    const categories = await db.select().from(ddCategories)
      .where(eq(ddCategories.isActive, true))
      .orderBy(asc(ddCategories.sortOrder));

    const requirementsWithStatus = await db
      .select({
        requirement: ddRequirements,
        status: ddRequirementStatus,
      })
      .from(ddRequirements)
      .leftJoin(
        ddRequirementStatus,
        and(
          eq(ddRequirementStatus.requirementId, ddRequirements.id),
          eq(ddRequirementStatus.targetCompanyId, targetCompanyId),
        )
      )
      .where(eq(ddRequirements.isActive, true))
      .orderBy(asc(ddRequirements.sortOrder));

    return categories.map(cat => {
      const catReqs = requirementsWithStatus
        .filter(r => r.requirement.categoryId === cat.id)
        .map(r => ({
          ...r.requirement,
          status: r.status,
        }));

      const isCompleted = (statusRow: DdRequirementStatus | null) => {
        if (!statusRow) return false;
        return statusRow.status === 'ready' || statusRow.status === 'na';
      };

      const completedCount = catReqs.filter(r => isCompleted(r.status)).length;
      const mandatoryReqs = catReqs.filter(r => r.priority === 'Mandatory');
      const mandatoryCompletedCount = mandatoryReqs.filter(r => isCompleted(r.status)).length;

      return {
        category: cat,
        requirements: catReqs,
        completedCount,
        totalCount: catReqs.length,
        mandatoryCompletedCount,
        mandatoryTotalCount: mandatoryReqs.length,
      };
    });
  }

  async updateRequirementStatus(data: {
    requirementId: number;
    targetCompanyId: number;
    status: string;
    notes?: string;
    documentId?: number;
    externalSubmissionId?: number;
    updatedBy: number;
  }) {
    const validStatuses = ['not_started', 'in_progress', 'ready', 'na'];
    if (!validStatuses.includes(data.status)) {
      throw new BadRequestError(`Invalid status: ${data.status}. Must be one of: ${validStatuses.join(', ')}`);
    }

    const [requirement] = await db.select().from(ddRequirements)
      .where(eq(ddRequirements.id, data.requirementId));
    if (!requirement) {
      throw new NotFoundError(`Requirement with id ${data.requirementId} not found`);
    }

    const [existing] = await db.select().from(ddRequirementStatus)
      .where(and(
        eq(ddRequirementStatus.requirementId, data.requirementId),
        eq(ddRequirementStatus.targetCompanyId, data.targetCompanyId),
      ));

    if (existing) {
      const [updated] = await db.update(ddRequirementStatus)
        .set({
          status: data.status,
          notes: data.notes ?? existing.notes,
          documentId: data.documentId ?? existing.documentId,
          externalSubmissionId: data.externalSubmissionId ?? existing.externalSubmissionId,
          updatedBy: data.updatedBy,
          updatedAt: new Date(),
          reviewedBy: (data.status === 'ready' || data.status === 'na') ? data.updatedBy : existing.reviewedBy,
          reviewedAt: (data.status === 'ready' || data.status === 'na') ? new Date() : existing.reviewedAt,
        })
        .where(eq(ddRequirementStatus.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(ddRequirementStatus).values({
        requirementId: data.requirementId,
        targetCompanyId: data.targetCompanyId,
        status: data.status,
        notes: data.notes || null,
        documentId: data.documentId || null,
        externalSubmissionId: data.externalSubmissionId || null,
        updatedBy: data.updatedBy,
        reviewedBy: (data.status === 'ready' || data.status === 'na') ? data.updatedBy : null,
        reviewedAt: (data.status === 'ready' || data.status === 'na') ? new Date() : null,
      }).returning();
      return created;
    }
  }

  async getCompletionSummary(targetCompanyId: number): Promise<DdCompletionSummary> {
    const categoryData = await this.getDdStatusForCompany(targetCompanyId);

    const isCompleted = (statusRow: DdRequirementStatus | null) => {
      if (!statusRow) return false;
      return statusRow.status === 'ready' || statusRow.status === 'na';
    };

    let total = 0;
    let completed = 0;
    const mandatory = { total: 0, completed: 0 };
    const advisory = { total: 0, completed: 0 };
    const addsValue = { total: 0, completed: 0 };

    const byCategory: DdCompletionSummary['byCategory'] = [];

    for (const cat of categoryData) {
      total += cat.totalCount;
      completed += cat.completedCount;

      let catMandatoryTotal = 0;
      let catMandatoryCompleted = 0;

      for (const req of cat.requirements) {
        const done = isCompleted(req.status);
        if (req.priority === 'Mandatory') {
          mandatory.total++;
          catMandatoryTotal++;
          if (done) {
            mandatory.completed++;
            catMandatoryCompleted++;
          }
        } else if (req.priority === 'Advisory') {
          advisory.total++;
          if (done) advisory.completed++;
        } else if (req.priority === 'Adds Value') {
          addsValue.total++;
          if (done) addsValue.completed++;
        }
      }

      byCategory.push({
        categoryId: cat.category.id,
        categoryName: cat.category.categoryName,
        total: cat.totalCount,
        completed: cat.completedCount,
        mandatoryTotal: catMandatoryTotal,
        mandatoryCompleted: catMandatoryCompleted,
      });
    }

    return { total, completed, mandatory, advisory, addsValue, byCategory };
  }
}

export const dueDiligenceService = new DueDiligenceService();
