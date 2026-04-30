import { db } from '../db';
import { ddCategories, ddRequirements, ddRequirementStatus, ddRequirementDocuments } from '@shared/schema/due-diligence';
import type { DdCategory, DdRequirement, DdRequirementStatus } from '@shared/schema/due-diligence';
import { documents } from '@shared/schema/documents';
import { externalDocumentSubmissions } from '@shared/schema/portal';
import { eq, and, sql, asc } from 'drizzle-orm';
import { NotFoundError, BadRequestError, ForbiddenError } from '../utils/errors';
import { documentsRepository } from '../repositories/documents.repository';

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
        linkedDocumentName: documents.documentName,
        linkedDocumentFilename: documents.originalFilename,
      })
      .from(ddRequirements)
      .leftJoin(
        ddRequirementStatus,
        and(
          eq(ddRequirementStatus.requirementId, ddRequirements.id),
          eq(ddRequirementStatus.targetCompanyId, targetCompanyId),
        )
      )
      .leftJoin(
        documents,
        eq(documents.id, ddRequirementStatus.documentId),
      )
      .where(eq(ddRequirements.isActive, true))
      .orderBy(asc(ddRequirements.sortOrder));

    return categories.map(cat => {
      const catReqs = requirementsWithStatus
        .filter(r => r.requirement.categoryId === cat.id)
        .map(r => ({
          ...r.requirement,
          status: r.status ? {
            ...r.status,
            linkedDocumentName: r.linkedDocumentName,
            linkedDocumentFilename: r.linkedDocumentFilename,
          } : null,
        }));

      const isCompleted = (statusRow: DdRequirementStatus | null) => {
        if (!statusRow) return false;
        return statusRow.status === 'approved' || statusRow.status === 'na';
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
    documentId?: number | null;
    externalSubmissionId?: number;
    updatedBy: number;
  }) {
    const validStatuses = ['not_submitted', 'submitted', 'approved', 'rejected', 'na'];
    if (!validStatuses.includes(data.status)) {
      throw new BadRequestError(`Invalid status: ${data.status}. Must be one of: ${validStatuses.join(', ')}`);
    }

    const [requirement] = await db.select().from(ddRequirements)
      .where(eq(ddRequirements.id, data.requirementId));
    if (!requirement) {
      throw new NotFoundError(`Requirement with id ${data.requirementId} not found`);
    }

    if (data.documentId) {
      try {
        const [reqCategory] = await db
          .select({ categoryName: ddCategories.categoryName })
          .from(ddCategories)
          .where(eq(ddCategories.id, requirement.categoryId));

        if (reqCategory) {
          await db.update(documents)
            .set({ secondaryCategory: reqCategory.categoryName })
            .where(eq(documents.id, data.documentId));
        }
      } catch (err) {
        console.error('[DD] Failed to set secondary category:', err);
      }
    }

    const [existing] = await db.select().from(ddRequirementStatus)
      .where(and(
        eq(ddRequirementStatus.requirementId, data.requirementId),
        eq(ddRequirementStatus.targetCompanyId, data.targetCompanyId),
      ));

    if (existing) {
      const resolvedDocumentId = data.documentId === null ? null : (data.documentId ?? existing.documentId);
      const [updated] = await db.update(ddRequirementStatus)
        .set({
          status: data.status,
          notes: data.notes ?? existing.notes,
          documentId: resolvedDocumentId,
          externalSubmissionId: data.externalSubmissionId ?? existing.externalSubmissionId,
          updatedBy: data.updatedBy,
          updatedAt: new Date(),
          reviewedBy: (data.status === 'approved' || data.status === 'rejected' || data.status === 'na') ? data.updatedBy : existing.reviewedBy,
          reviewedAt: (data.status === 'approved' || data.status === 'rejected' || data.status === 'na') ? new Date() : existing.reviewedAt,
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
        reviewedBy: (data.status === 'approved' || data.status === 'rejected' || data.status === 'na') ? data.updatedBy : null,
        reviewedAt: (data.status === 'approved' || data.status === 'rejected' || data.status === 'na') ? new Date() : null,
      }).returning();
      return created;
    }
  }

  async getCompletionSummary(targetCompanyId: number): Promise<DdCompletionSummary> {
    const categoryData = await this.getDdStatusForCompany(targetCompanyId);

    const isCompleted = (statusRow: DdRequirementStatus | null) => {
      if (!statusRow) return false;
      return statusRow.status === 'approved' || statusRow.status === 'na';
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

  async getRequirementDocuments(requirementId: number, targetCompanyId: number) {
    const [statusRow] = await db.select().from(ddRequirementStatus)
      .where(and(
        eq(ddRequirementStatus.requirementId, requirementId),
        eq(ddRequirementStatus.targetCompanyId, targetCompanyId),
      ));

    if (!statusRow) return [];

    const links = await db.select({
      id: ddRequirementDocuments.id,
      documentSource: ddRequirementDocuments.documentSource,
      documentId: ddRequirementDocuments.documentId,
      externalSubmissionId: ddRequirementDocuments.externalSubmissionId,
      addedAt: ddRequirementDocuments.addedAt,
      notes: ddRequirementDocuments.notes,
      docName: documents.documentName,
      docFilename: documents.originalFilename,
      docFileType: documents.fileType,
      docFileSize: documents.fileSize,
      extFilename: externalDocumentSubmissions.originalFilename,
      extFileType: externalDocumentSubmissions.fileType,
      extFileSize: externalDocumentSubmissions.fileSize,
    })
      .from(ddRequirementDocuments)
      .leftJoin(documents, eq(documents.id, ddRequirementDocuments.documentId))
      .leftJoin(externalDocumentSubmissions, eq(externalDocumentSubmissions.id, ddRequirementDocuments.externalSubmissionId))
      .where(eq(ddRequirementDocuments.requirementStatusId, statusRow.id));

    return links.map(l => ({
      id: l.id,
      source: l.documentSource,
      documentId: l.documentId,
      externalSubmissionId: l.externalSubmissionId,
      filename: l.documentSource === 'buyer_linked' ? (l.docFilename || l.docName) : l.extFilename,
      fileType: l.documentSource === 'buyer_linked' ? l.docFileType : l.extFileType,
      fileSize: l.documentSource === 'buyer_linked' ? l.docFileSize : l.extFileSize,
      addedAt: l.addedAt,
      notes: l.notes,
    }));
  }

  async linkDocumentToRequirement(data: {
    requirementId: number;
    targetCompanyId: number;
    documentId: number;
    notes?: string;
    addedBy: number;
  }) {
    let [statusRow] = await db.select().from(ddRequirementStatus)
      .where(and(
        eq(ddRequirementStatus.requirementId, data.requirementId),
        eq(ddRequirementStatus.targetCompanyId, data.targetCompanyId),
      ));

    if (!statusRow) {
      [statusRow] = await db.insert(ddRequirementStatus).values({
        requirementId: data.requirementId,
        targetCompanyId: data.targetCompanyId,
        status: 'submitted',
        updatedBy: data.addedBy,
      }).returning();
    } else if (statusRow.status === 'not_submitted') {
      await db.update(ddRequirementStatus)
        .set({ status: 'submitted', updatedBy: data.addedBy, updatedAt: new Date() })
        .where(eq(ddRequirementStatus.id, statusRow.id));
    }

    const [link] = await db.insert(ddRequirementDocuments).values({
      requirementStatusId: statusRow.id,
      targetCompanyId: data.targetCompanyId,
      documentSource: 'buyer_linked',
      documentId: data.documentId,
      addedBy: data.addedBy,
      notes: data.notes || null,
    }).returning();

    return link;
  }

  async unlinkDocumentFromRequirement(docLinkId: number, targetCompanyId: number, userCompanyId: number) {
    const [link] = await db.select().from(ddRequirementDocuments)
      .where(eq(ddRequirementDocuments.id, docLinkId));

    if (!link) {
      throw new NotFoundError(`Document link with id ${docLinkId} not found`);
    }

    if (link.targetCompanyId !== targetCompanyId) {
      throw new ForbiddenError('Access denied');
    }

    const belongs = await documentsRepository.targetCompanyBelongsToUser(targetCompanyId, userCompanyId);
    if (!belongs) {
      throw new ForbiddenError('Access denied');
    }

    await db.delete(ddRequirementDocuments)
      .where(eq(ddRequirementDocuments.id, docLinkId));
  }

  async setBuyerReview(data: {
    requirementId: number;
    targetCompanyId: number;
    reviewStatus: string;
    notes?: string;
    reviewedBy: number;
  }) {
    const [statusRow] = await db.select().from(ddRequirementStatus)
      .where(and(
        eq(ddRequirementStatus.requirementId, data.requirementId),
        eq(ddRequirementStatus.targetCompanyId, data.targetCompanyId),
      ));

    if (!statusRow) throw new NotFoundError('Requirement status not found');

    const updateData: any = {
      buyerReviewStatus: data.reviewStatus,
      buyerReviewNotes: data.notes || null,
      buyerReviewedAt: new Date(),
      buyerReviewedBy: data.reviewedBy,
      updatedAt: new Date(),
    };

    if (data.reviewStatus === 'satisfied') {
      updateData.status = 'approved';
      updateData.reviewedBy = data.reviewedBy;
      updateData.reviewedAt = new Date();
    }

    if (data.reviewStatus === 'more_needed') {
      updateData.sellerMarkedComplete = false;
      updateData.sellerMarkedCompleteAt = null;
      updateData.status = 'submitted';
    }

    const [updated] = await db.update(ddRequirementStatus)
      .set(updateData)
      .where(eq(ddRequirementStatus.id, statusRow.id))
      .returning();

    return updated;
  }
}

export const dueDiligenceService = new DueDiligenceService();
