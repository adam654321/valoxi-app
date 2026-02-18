import { Router, Request, Response } from 'express';
import { expertAnalysisService } from '../services/expert-analysis.service';
import { sendSuccess } from '../utils/response';
import { UnauthorizedError } from '../utils/errors';
import { asyncHandler } from '../utils/async-handler';

const router = Router();

router.post('/trigger-stage1/:id', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  if (!userId) throw new UnauthorizedError();

  const companyId = parseInt(req.params.id, 10);
  if (isNaN(companyId)) {
    return res.status(400).json({ success: false, message: 'Invalid company ID' });
  }

  expertAnalysisService.triggerNewStage1Pipeline(companyId, userId).catch(err => {
    console.error(`[EXPERT_ANALYSIS_ROUTE] Stage 1 pipeline failed for company ${companyId}:`, err.message);
  });

  sendSuccess(res, { message: 'Screening pipeline started' });
}));

router.post('/trigger-pipeline/:id', asyncHandler(async (req: Request, res: Response) => {
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
}));

router.post('/retry/:id/:expertType', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  if (!userId) throw new UnauthorizedError();

  const companyId = parseInt(req.params.id, 10);
  if (isNaN(companyId)) {
    return res.status(400).json({ success: false, message: 'Invalid company ID' });
  }

  const { expertType } = req.params;

  expertAnalysisService.retryExpert(companyId, expertType, userId).catch(err => {
    console.error(`[EXPERT_ANALYSIS_ROUTE] Retry ${expertType} failed for company ${companyId}:`, err.message);
  });

  sendSuccess(res, { message: `${expertType} retry started` });
}));

router.post('/cancel/:id', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  if (!userId) throw new UnauthorizedError();

  const companyId = parseInt(req.params.id, 10);
  if (isNaN(companyId)) {
    return res.status(400).json({ success: false, message: 'Invalid company ID' });
  }

  await expertAnalysisService.cancelAnalysis(companyId);
  sendSuccess(res, { message: 'Analysis cancelled' });
}));

router.get('/results/:id', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  if (!userId) throw new UnauthorizedError();

  const companyId = parseInt(req.params.id, 10);
  if (isNaN(companyId)) {
    return res.status(400).json({ success: false, message: 'Invalid company ID' });
  }

  const results = await expertAnalysisService.getExpertResults(companyId);
  sendSuccess(res, results);
}));

export default router;
