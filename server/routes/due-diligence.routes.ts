import { Router } from 'express';
import { dueDiligenceService } from '../services/due-diligence.service';
import { z } from 'zod';
import { asyncHandler } from '../utils/async-handler';
import { requireFeature } from '../middleware/subscription';

const router = Router();

router.get('/categories', requireFeature('ddDataRoom'), asyncHandler(async (req, res) => {
  const categories = await dueDiligenceService.getAllCategories();
  res.json(categories);
}));

router.get('/company/:targetCompanyId/status', requireFeature('ddDataRoom'), asyncHandler(async (req, res) => {
  const targetCompanyId = parseInt(req.params.targetCompanyId);
  if (isNaN(targetCompanyId)) {
    return res.status(400).json({ message: 'Invalid targetCompanyId' });
  }

  const status = await dueDiligenceService.getDdStatusForCompany(targetCompanyId);
  res.json(status);
}));

router.get('/company/:targetCompanyId/summary', requireFeature('ddDataRoom'), asyncHandler(async (req, res) => {
  const targetCompanyId = parseInt(req.params.targetCompanyId);
  if (isNaN(targetCompanyId)) {
    return res.status(400).json({ message: 'Invalid targetCompanyId' });
  }

  const summary = await dueDiligenceService.getCompletionSummary(targetCompanyId);
  res.json(summary);
}));

const updateStatusSchema = z.object({
  status: z.enum(['not_submitted', 'submitted', 'approved', 'rejected', 'na']),
  notes: z.string().optional(),
  documentId: z.number().nullable().optional(),
  externalSubmissionId: z.number().optional(),
});

router.put('/company/:targetCompanyId/requirement/:requirementId/status', requireFeature('ddDataRoom'), asyncHandler(async (req, res) => {
  const targetCompanyId = parseInt(req.params.targetCompanyId);
  const requirementId = parseInt(req.params.requirementId);

  if (isNaN(targetCompanyId)) {
    return res.status(400).json({ message: 'Invalid targetCompanyId' });
  }
  if (isNaN(requirementId)) {
    return res.status(400).json({ message: 'Invalid requirementId' });
  }

  const userId = req.session.userId;
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const validated = updateStatusSchema.parse(req.body);

  const result = await dueDiligenceService.updateRequirementStatus({
    requirementId,
    targetCompanyId,
    status: validated.status,
    notes: validated.notes,
    documentId: validated.documentId,
    externalSubmissionId: validated.externalSubmissionId,
    updatedBy: userId,
  });

  res.json(result);
}));

router.get('/company/:targetCompanyId/requirement/:requirementId/documents', requireFeature('ddDataRoom'), asyncHandler(async (req, res) => {
  const targetCompanyId = parseInt(req.params.targetCompanyId);
  const requirementId = parseInt(req.params.requirementId);
  const docs = await dueDiligenceService.getRequirementDocuments(requirementId, targetCompanyId);
  res.json(docs);
}));

router.post('/company/:targetCompanyId/requirement/:requirementId/documents', requireFeature('ddDataRoom'), asyncHandler(async (req, res) => {
  const targetCompanyId = parseInt(req.params.targetCompanyId);
  const requirementId = parseInt(req.params.requirementId);
  const userId = req.session.userId;
  const userCompanyId = req.session.userCompanyId!;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  const { documentId, notes } = req.body;
  if (!documentId) return res.status(400).json({ message: 'documentId is required' });

  const result = await dueDiligenceService.linkDocumentToRequirement({
    requirementId, targetCompanyId, userCompanyId, documentId, notes, addedBy: userId,
  });
  res.json(result);
}));

router.delete('/company/:targetCompanyId/requirement/:requirementId/documents/:docLinkId', requireFeature('ddDataRoom'), asyncHandler(async (req, res) => {
  const targetCompanyId = parseInt(req.params.targetCompanyId);
  const docLinkId = parseInt(req.params.docLinkId);
  const userCompanyId = req.session.userCompanyId!;

  if (isNaN(targetCompanyId)) {
    return res.status(400).json({ message: 'Invalid targetCompanyId' });
  }

  await dueDiligenceService.unlinkDocumentFromRequirement(docLinkId, targetCompanyId, userCompanyId);
  res.json({ success: true });
}));

router.post('/company/:targetCompanyId/requirement/:requirementId/buyer-review', requireFeature('ddDataRoom'), asyncHandler(async (req, res) => {
  const targetCompanyId = parseInt(req.params.targetCompanyId);
  const requirementId = parseInt(req.params.requirementId);
  const userId = req.session.userId;
  const userCompanyId = req.session.userCompanyId!;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  const { reviewStatus, notes } = req.body;
  if (!['satisfied', 'more_needed'].includes(reviewStatus)) {
    return res.status(400).json({ message: 'reviewStatus must be satisfied or more_needed' });
  }

  const result = await dueDiligenceService.setBuyerReview({
    requirementId, targetCompanyId, userCompanyId, reviewStatus, notes, reviewedBy: userId,
  });
  res.json(result);
}));

export default router;
