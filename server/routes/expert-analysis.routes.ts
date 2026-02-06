import { Router, Request, Response } from 'express';
import { expertAnalysisService } from '../services/expert-analysis.service';
import { sendSuccess, sendError } from '../utils/response';
import { UnauthorizedError } from '../utils/errors';

const router = Router();

router.post('/trigger-pipeline/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;
    if (!userId) throw new UnauthorizedError();

    const companyId = parseInt(req.params.id, 10);
    if (isNaN(companyId)) {
      return res.status(400).json({ success: false, message: 'Invalid company ID' });
    }

    expertAnalysisService.triggerExpertPipeline(companyId, userId).catch(err => {
      console.error(`[EXPERT_ANALYSIS_ROUTE] Pipeline failed for company ${companyId}:`, err.message);
    });

    sendSuccess(res, { message: 'Pipeline started' });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/results/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;
    if (!userId) throw new UnauthorizedError();

    const companyId = parseInt(req.params.id, 10);
    if (isNaN(companyId)) {
      return res.status(400).json({ success: false, message: 'Invalid company ID' });
    }

    const results = await expertAnalysisService.getExpertResults(companyId);
    sendSuccess(res, results);
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
