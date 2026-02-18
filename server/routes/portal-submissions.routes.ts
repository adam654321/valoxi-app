import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs/promises';
import multer from 'multer';
import { portalSubmissionsService } from '../services/portal-submissions.service';
import { dueDiligenceService } from '../services/due-diligence.service';
import { sendSuccess, sendError } from '../utils/response';
import { asyncHandler } from '../utils/async-handler';
import { BadRequestError } from '../utils/errors';
import { db } from '../db';
import { ddRequirementStatus } from '@shared/schema/due-diligence';
import { and, eq } from 'drizzle-orm';

const router = Router();

const portalUpload = multer({
  storage: multer.diskStorage({
    destination: async (req, file, cb) => {
      const uploadPath = path.join(process.cwd(), 'uploads', 'portal');
      try {
        await fs.mkdir(uploadPath, { recursive: true });
        cb(null, uploadPath);
      } catch (error) { cb(error as Error, ''); }
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  }),
  fileFilter: (req, file, cb) => {
    const allowedExtensions = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|jpg|jpeg|png|gif)$/i;
    if (allowedExtensions.test(file.originalname)) cb(null, true);
    else cb(new Error('Only PDF, Office documents, text files and images are allowed'));
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});

router.get('/:token', asyncHandler(async (req: Request, res: Response) => {
  if (req.params.token.includes('/')) return res.status(404).json({ message: 'Not found' });
  const data = await portalSubmissionsService.getPortalData(req.params.token, req.ip, req.get('User-Agent'));
  sendSuccess(res, data);
}));

router.post('/:token/submit', (req: Request, res: Response) => {
  portalUpload.single('document')(req, res, async (err) => {
    try {
      if (err) {
        if ((err as any).code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File too large. Max 10MB.' });
        return res.status(400).json({ error: err.message });
      }
      if (!req.file) throw new BadRequestError('No document uploaded');
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const result = await portalSubmissionsService.submitDocument(req.params.token, req.file, req.body, baseUrl, req.ip, req.get('User-Agent'));
      sendSuccess(res, { success: true, submissionId: result.submissionId, message: 'Document submitted successfully', filename: result.filename });
    } catch (error) {
      if (req.file) try { await fs.unlink(req.file.path); } catch { }
      sendError(res, error);
    }
  });
});

router.get('/:token/submissions', asyncHandler(async (req: Request, res: Response) => {
  const submissions = await portalSubmissionsService.getSubmissions(req.params.token, req.ip, req.get('User-Agent'));
  sendSuccess(res, submissions);
}));

router.get('/:token/analysis-completion', asyncHandler(async (req: Request, res: Response) => {
  const status = await portalSubmissionsService.getAnalysisStatus(req.params.token, req.ip, req.get('User-Agent'));
  sendSuccess(res, status);
}));

router.get('/:token/documents', asyncHandler(async (req: Request, res: Response) => {
  const documents = await portalSubmissionsService.getDocuments(req.params.token);
  sendSuccess(res, documents);
}));

router.delete('/:token/documents/:id', asyncHandler(async (req: Request, res: Response) => {
  const documentId = parseInt(req.params.id);
  if (isNaN(documentId)) throw new BadRequestError('Invalid document ID');
  await portalSubmissionsService.deleteDocument(req.params.token, documentId);
  sendSuccess(res, { success: true });
}));

router.get('/:token/dd-requirements', asyncHandler(async (req: Request, res: Response) => {
  const token = await portalSubmissionsService.validateToken(req.params.token);

  const categoriesWithStatus = await dueDiligenceService.getDdStatusForCompany(token.targetCompanyId);
  const summary = await dueDiligenceService.getCompletionSummary(token.targetCompanyId);

  const categories = await Promise.all(categoriesWithStatus.map(async cat => ({
    ...cat.category,
    requirements: await Promise.all(cat.requirements.map(async req => {
      const statusData = req.status as any;
      const linkedDocs = await dueDiligenceService.getRequirementDocuments(req.id, token.targetCompanyId);
      return {
        id: req.id,
        refNumber: req.refNumber,
        documentName: req.documentName,
        description: req.guidance,
        priority: req.priority,
        category: cat.category.categoryName,
        status: statusData?.status || 'not_submitted',
        notes: statusData?.notes || null,
        documentId: statusData?.documentId || null,
        linkedDocumentName: statusData?.linkedDocumentName || null,
        linkedDocumentFilename: statusData?.linkedDocumentFilename || null,
        externalSubmissionId: statusData?.externalSubmissionId || null,
        linkedDocuments: linkedDocs,
        sellerMarkedComplete: statusData?.sellerMarkedComplete || false,
        buyerReviewStatus: statusData?.buyerReviewStatus || 'not_reviewed',
        buyerReviewNotes: statusData?.buyerReviewNotes || null,
      };
    })),
    completedCount: cat.completedCount,
    totalCount: cat.totalCount,
  })));

  sendSuccess(res, { categories, summary });
}));

router.post('/:token/dd-requirements/:requirementId/mark-complete', asyncHandler(async (req: Request, res: Response) => {
  const token = await portalSubmissionsService.validateToken(req.params.token);
  const requirementId = parseInt(req.params.requirementId);

  const docs = await dueDiligenceService.getRequirementDocuments(requirementId, token.targetCompanyId);
  if (docs.length === 0) {
    return res.status(400).json({ error: 'Cannot mark complete — no documents linked to this requirement' });
  }

  const [statusRow] = await db.select().from(ddRequirementStatus)
    .where(and(
      eq(ddRequirementStatus.requirementId, requirementId),
      eq(ddRequirementStatus.targetCompanyId, token.targetCompanyId),
    ));

  if (!statusRow) {
    return res.status(404).json({ error: 'Requirement status not found' });
  }

  await db.update(ddRequirementStatus)
    .set({
      sellerMarkedComplete: true,
      sellerMarkedCompleteAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(ddRequirementStatus.id, statusRow.id));

  sendSuccess(res, { success: true });
}));

router.post('/:token/dd-requirements/:requirementId/unmark-complete', asyncHandler(async (req: Request, res: Response) => {
  const token = await portalSubmissionsService.validateToken(req.params.token);
  const requirementId = parseInt(req.params.requirementId);

  const [statusRow] = await db.select().from(ddRequirementStatus)
    .where(and(
      eq(ddRequirementStatus.requirementId, requirementId),
      eq(ddRequirementStatus.targetCompanyId, token.targetCompanyId),
    ));

  if (!statusRow) {
    return res.status(404).json({ error: 'Requirement status not found' });
  }

  await db.update(ddRequirementStatus)
    .set({
      sellerMarkedComplete: false,
      sellerMarkedCompleteAt: null,
      updatedAt: new Date(),
    })
    .where(eq(ddRequirementStatus.id, statusRow.id));

  sendSuccess(res, { success: true });
}));

router.delete('/:token/dd-requirements/:requirementId/documents/:docLinkId', asyncHandler(async (req: Request, res: Response) => {
  const token = await portalSubmissionsService.validateToken(req.params.token);
  const docLinkId = parseInt(req.params.docLinkId);

  const { ddRequirementDocuments } = await import('@shared/schema/due-diligence');
  const [link] = await db.select().from(ddRequirementDocuments)
    .where(and(
      eq(ddRequirementDocuments.id, docLinkId),
      eq(ddRequirementDocuments.targetCompanyId, token.targetCompanyId),
      eq(ddRequirementDocuments.documentSource, 'seller_uploaded'),
    ));

  if (!link) {
    return res.status(404).json({ error: 'Document link not found or cannot be removed' });
  }

  await db.delete(ddRequirementDocuments).where(eq(ddRequirementDocuments.id, docLinkId));
  sendSuccess(res, { success: true });
}));

export default router;
