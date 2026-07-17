import { portalSubmissionsRepository } from '../repositories/portal-submissions.repository';
import { dueDiligenceService } from './due-diligence.service';
import { fileStorageService } from './file-storage.service';
import { NotFoundError, ForbiddenError, BadRequestError } from '../utils/errors';
import { sanitizeFilename } from '../utils/upload';
import type { PortalAccessToken, ExternalDocumentSubmission } from '@shared/schema';

import { db } from '../db';
import { ddRequirements, ddCategories } from '@shared/schema/due-diligence';
import { documents } from '@shared/schema/documents';
import { eq } from 'drizzle-orm';

const PORTAL_CATEGORY_MAP: Record<string, string> = {
  'company_accounts': 'Company Accounts',
  'company_accounts_1': 'Company Accounts', 'company_accounts_2': 'Company Accounts', 'company_accounts_3': 'Company Accounts',
  'company_accounts_4': 'Company Accounts', 'company_accounts_5': 'Company Accounts',
  'sales_ledger': 'Sales Ledger', 'balance_sheet': 'Balance Sheet',
  'profit_loss': 'Profit & Loss', 'p_and_l': 'Profit & Loss', 'profit_and_loss': 'Profit & Loss',
  'staff_matrix': 'Staff Matrix', 'asset_register': 'Asset Register',
  'legal_documents': 'Company Accounts', 'correspondence': 'Company Accounts', 'marketing': 'Company Accounts',
  'technical': 'Company Accounts', 'other': 'Company Accounts', 'general': 'Company Accounts',
  'due_diligence': 'Due Diligence',
};

export class PortalSubmissionsService {
  async validateToken(accessToken: string): Promise<PortalAccessToken> {
    if (!accessToken) throw new BadRequestError('Access token is required');
    const token = await portalSubmissionsRepository.validateToken(accessToken);
    if (!token) throw new NotFoundError('Invalid or expired portal token');
    return token;
  }

  async getPortalData(accessToken: string, ipAddress?: string, userAgent?: string) {
    const token = await this.validateToken(accessToken);
    await portalSubmissionsRepository.updateTokenAccess(token.id, ipAddress, userAgent);
    return await portalSubmissionsRepository.getSimplePortalData(token.id);
  }

  async submitDocument(accessToken: string, file: { originalname: string; size: number; mimetype: string }, r2Key: string, body: any, baseUrl: string, ipAddress?: string, userAgent?: string) {
    const token = await this.validateToken(accessToken);
    const allowedActions = JSON.parse(token.allowedActions || '{}');
    if (!allowedActions.upload) {
      throw new ForbiddenError('Document upload not permitted for this portal');
    }
    const submittedType = body.documentType || body.document_category || 'general';
    const mappedCategory = PORTAL_CATEGORY_MAP[submittedType] || 'Company Accounts';
    const originalFilename = sanitizeFilename(file.originalname);
    const submission = await portalSubmissionsRepository.createSubmission({
      portalTokenId: token.id, targetCompanyId: token.targetCompanyId, targetContactId: token.targetContactId,
      originalFilename: originalFilename, storedFilename: r2Key, filePath: r2Key,
      fileSize: file.size, fileType: file.mimetype, documentCategory: submittedType,
      submissionNotes: body.submissionNotes || body.submission_notes || null,
      submissionIp: ipAddress, submissionUserAgent: userAgent,
      documentRequirementId: body.requirement_id ? parseInt(body.requirement_id) : null,
    });
    const mainDocument = await portalSubmissionsRepository.createDocument({
      targetCompanyId: token.targetCompanyId, uploadedBy: 1, documentName: originalFilename,
      originalFilename: originalFilename, filePath: r2Key, fileSize: file.size, fileType: file.mimetype,
      documentCategory: mappedCategory, description: `Submitted via external portal${body.submissionNotes ? ': ' + body.submissionNotes : ''}`,
      isConfidential: false, externalSubmissionId: submission.id,
    });
    const uploadEvent = await portalSubmissionsRepository.createFileUploadEvent({
      documentId: mainDocument.id, targetCompanyId: token.targetCompanyId, uploadedBy: 1,
      fileName: originalFilename, fileUrl: `${baseUrl}/api/v2/public/documents/${mainDocument.publicToken}/download`,
      webhookSent: false, webhookStatus: 'pending',
    });
    await portalSubmissionsRepository.reviewSubmission(submission.id, token.createdBy, 'approved', 'Auto-approved - unified upload process');
    
    const { analysisQueue } = await import('./analysis-queue.service');
    analysisQueue.enqueue({
      eventId: uploadEvent.id,
      targetCompanyId: token.targetCompanyId,
    });
    if (submission.documentRequirementId) {
      try {
        const [reqCategory] = await db
          .select({ categoryName: ddCategories.categoryName })
          .from(ddRequirements)
          .innerJoin(ddCategories, eq(ddRequirements.categoryId, ddCategories.id))
          .where(eq(ddRequirements.id, submission.documentRequirementId));

        if (reqCategory) {
          await db.update(documents)
            .set({ secondaryCategory: reqCategory.categoryName })
            .where(eq(documents.id, mainDocument.id));
        }

        await dueDiligenceService.updateRequirementStatus({
          requirementId: submission.documentRequirementId,
          targetCompanyId: token.targetCompanyId,
          userCompanyId: token.userCompanyId,
          status: 'submitted',
          externalSubmissionId: submission.id,
          documentId: mainDocument.id,
          updatedBy: token.createdBy,
        });
        console.log(`[PORTAL_UPLOAD] Linked submission ${submission.id} to DD requirement ${submission.documentRequirementId}`);

        try {
          const { ddRequirementDocuments, ddRequirementStatus: ddReqStatus } = await import('@shared/schema/due-diligence');
          const { and: andOp, eq: eqOp } = await import('drizzle-orm');

          const [statusRow] = await db.select().from(ddReqStatus)
            .where(andOp(
              eqOp(ddReqStatus.requirementId, submission.documentRequirementId!),
              eqOp(ddReqStatus.targetCompanyId, token.targetCompanyId),
            ));

          if (statusRow) {
            await db.insert(ddRequirementDocuments).values({
              requirementStatusId: statusRow.id,
              targetCompanyId: token.targetCompanyId,
              documentSource: 'seller_uploaded',
              documentId: mainDocument.id,
              externalSubmissionId: submission.id,
              notes: body.submissionNotes || null,
            });
            console.log(`[PORTAL_UPLOAD] Created junction table entry for DD requirement ${submission.documentRequirementId}`);
          }
        } catch (junctionErr) {
          console.error('[PORTAL_UPLOAD] Failed to create junction table entry:', junctionErr);
        }
      } catch (ddError) {
        console.error('[PORTAL_UPLOAD] Failed to link DD requirement:', ddError);
      }
    }
    await portalSubmissionsRepository.logActivity({
      portalTokenId: token.id, targetContactId: token.targetContactId, activityType: 'document_submitted',
      activityDescription: `Document submitted: ${originalFilename}`, ipAddress, userAgent, relatedDocumentId: submission.id,
    });
    return { submissionId: submission.id, documentId: mainDocument.id, uploadEventId: uploadEvent.id, filename: originalFilename };
  }

  async getSubmissions(accessToken: string, ipAddress?: string, userAgent?: string): Promise<any[]> {
    const token = await this.validateToken(accessToken);
    const submissions = await portalSubmissionsRepository.getSubmissions(token.id);
    await portalSubmissionsRepository.logActivity({
      portalTokenId: token.id, targetContactId: token.targetContactId, activityType: 'submissions_viewed',
      activityDescription: 'Submission history viewed', ipAddress, userAgent,
    });
    return submissions.map(s => ({
      id: s.id, filename: s.originalFilename, category: s.documentCategory, submittedAt: s.submittedAt, status: s.processingStatus,
    }));
  }

  async getAnalysisStatus(accessToken: string, ipAddress?: string, userAgent?: string) {
    const token = await this.validateToken(accessToken);
    await portalSubmissionsRepository.logActivity({
      portalTokenId: token.id, targetContactId: token.targetContactId, activityType: 'analysis_status_viewed',
      activityDescription: 'Document analysis status viewed', ipAddress, userAgent,
    });
    return await portalSubmissionsRepository.getAnalysisCompletionStatus(token.targetCompanyId);
  }

  async getDocuments(accessToken: string): Promise<any[]> {
    const token = await this.validateToken(accessToken);
    return await portalSubmissionsRepository.getDocumentsForCompany(token.targetCompanyId);
  }

  async deleteDocument(accessToken: string, documentId: number): Promise<void> {
    const token = await this.validateToken(accessToken);
    const document = await portalSubmissionsRepository.getDocument(documentId);
    if (!document || document.targetCompanyId !== token.targetCompanyId) throw new NotFoundError('Document not found');
    try {
      const { financialDataRepository } = await import('../repositories/financial-data.repository');
      const { db } = await import('../db');
      const { financialContributions } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');
      const { reselect } = await import('./projection-reselect.service');
      // Non-projection financial data (staff, debtors, assets, loans) — delete directly
      await financialDataRepository.deleteNonProjectionByDocumentId(documentId);
      // Drop contributions then rebuild the projection via reselect
      await db.delete(financialContributions).where(eq(financialContributions.sourceDocumentId, documentId));
      await reselect(document.targetCompanyId);
    } catch (error) {
      console.error(`[PORTAL_DELETE] Error cleaning financial data for document ${documentId}:`, error);
    }
    const success = await portalSubmissionsRepository.deleteDocument(documentId);
    if (!success) throw new Error('Failed to delete document');
    await fileStorageService.delete(document.filePath);
  }
}

export const portalSubmissionsService = new PortalSubmissionsService();
