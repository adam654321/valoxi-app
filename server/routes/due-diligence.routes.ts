import { Router } from 'express';
import { dueDiligenceService } from '../services/due-diligence.service';
import { z } from 'zod';
import { AppError } from '../utils/errors';

const router = Router();

router.get('/categories', async (req, res) => {
  try {
    const categories = await dueDiligenceService.getAllCategories();
    res.json(categories);
  } catch (error: any) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
});

router.get('/company/:targetCompanyId/status', async (req, res) => {
  try {
    const targetCompanyId = parseInt(req.params.targetCompanyId);
    if (isNaN(targetCompanyId)) {
      return res.status(400).json({ message: 'Invalid targetCompanyId' });
    }

    const status = await dueDiligenceService.getDdStatusForCompany(targetCompanyId);
    res.json(status);
  } catch (error: any) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
});

router.get('/company/:targetCompanyId/summary', async (req, res) => {
  try {
    const targetCompanyId = parseInt(req.params.targetCompanyId);
    if (isNaN(targetCompanyId)) {
      return res.status(400).json({ message: 'Invalid targetCompanyId' });
    }

    const summary = await dueDiligenceService.getCompletionSummary(targetCompanyId);
    res.json(summary);
  } catch (error: any) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
});

const updateStatusSchema = z.object({
  status: z.enum(['not_started', 'in_progress', 'ready', 'na']),
  notes: z.string().optional(),
  documentId: z.number().nullable().optional(),
  externalSubmissionId: z.number().optional(),
});

router.put('/company/:targetCompanyId/requirement/:requirementId/status', async (req, res) => {
  try {
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
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ message: 'Validation error', errors: error.errors });
    }
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
});

export default router;
