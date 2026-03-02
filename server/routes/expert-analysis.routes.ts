import { Router, Request, Response } from 'express';
import { expertAnalysisService } from '../services/expert-analysis.service';
import { sendSuccess } from '../utils/response';
import { UnauthorizedError, NotFoundError, BadRequestError } from '../utils/errors';
import { asyncHandler } from '../utils/async-handler';
import { targetCompaniesRepository } from '../repositories/target-companies.repository';
import { requireFeature } from '../middleware/subscription';

const router = Router();

router.post('/trigger-stage1/:id', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  const userCompanyId = req.session?.userCompanyId;
  if (!userId || !userCompanyId) throw new UnauthorizedError();

  const companyId = parseInt(req.params.id, 10);
  if (isNaN(companyId)) throw new BadRequestError('Invalid company ID');

  const company = await targetCompaniesRepository.getById(companyId, userCompanyId);
  if (!company) throw new NotFoundError('Company not found');

  expertAnalysisService.triggerNewStage1Pipeline(companyId, userId).catch(err => {
    console.error(`[EXPERT_ANALYSIS_ROUTE] Stage 1 pipeline failed for company ${companyId}:`, err.message);
  });

  sendSuccess(res, { message: 'Screening pipeline started' });
}));

router.post('/trigger-pipeline/:id', requireFeature('expertAnalysisFullDetail'), asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  const userCompanyId = req.session?.userCompanyId;
  if (!userId || !userCompanyId) throw new UnauthorizedError();

  const companyId = parseInt(req.params.id, 10);
  if (isNaN(companyId)) throw new BadRequestError('Invalid company ID');

  const company = await targetCompaniesRepository.getById(companyId, userCompanyId);
  if (!company) throw new NotFoundError('Company not found');

  expertAnalysisService.triggerExpertPipeline(companyId, userId).catch(err => {
    console.error(`[EXPERT_ANALYSIS_ROUTE] Pipeline failed for company ${companyId}:`, err.message);
  });

  sendSuccess(res, { message: 'Pipeline started' });
}));

router.post('/retry/:id/:expertType', requireFeature('expertAnalysisFullDetail'), asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  const userCompanyId = req.session?.userCompanyId;
  if (!userId || !userCompanyId) throw new UnauthorizedError();

  const companyId = parseInt(req.params.id, 10);
  if (isNaN(companyId)) throw new BadRequestError('Invalid company ID');

  const company = await targetCompaniesRepository.getById(companyId, userCompanyId);
  if (!company) throw new NotFoundError('Company not found');

  const { expertType } = req.params;

  expertAnalysisService.retryExpert(companyId, expertType, userId).catch(err => {
    console.error(`[EXPERT_ANALYSIS_ROUTE] Retry ${expertType} failed for company ${companyId}:`, err.message);
  });

  sendSuccess(res, { message: `${expertType} retry started` });
}));

router.post('/resume/:id', requireFeature('expertAnalysisFullDetail'), asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  const userCompanyId = req.session?.userCompanyId;
  if (!userId || !userCompanyId) throw new UnauthorizedError();

  const companyId = parseInt(req.params.id, 10);
  if (isNaN(companyId)) throw new BadRequestError('Invalid company ID');

  const company = await targetCompaniesRepository.getById(companyId, userCompanyId);
  if (!company) throw new NotFoundError('Company not found');

  expertAnalysisService.processNextSteps(companyId).catch(err => {
    console.error(`[EXPERT_ANALYSIS_ROUTE] Resume failed for company ${companyId}:`, err.message);
  });

  sendSuccess(res, { message: 'Pipeline resumed' });
}));

router.post('/cancel/:id', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  const userCompanyId = req.session?.userCompanyId;
  if (!userId || !userCompanyId) throw new UnauthorizedError();

  const companyId = parseInt(req.params.id, 10);
  if (isNaN(companyId)) throw new BadRequestError('Invalid company ID');

  const company = await targetCompaniesRepository.getById(companyId, userCompanyId);
  if (!company) throw new NotFoundError('Company not found');

  await expertAnalysisService.cancelAnalysis(companyId);
  sendSuccess(res, { message: 'Analysis cancelled' });
}));

router.get('/results/:id', requireFeature('expertAnalysisFullDetail'), asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  const userCompanyId = req.session?.userCompanyId;
  if (!userId || !userCompanyId) throw new UnauthorizedError();

  const companyId = parseInt(req.params.id, 10);
  if (isNaN(companyId)) throw new BadRequestError('Invalid company ID');

  const company = await targetCompaniesRepository.getById(companyId, userCompanyId);
  if (!company) throw new NotFoundError('Company not found');

  const results = await expertAnalysisService.getExpertResults(companyId);
  sendSuccess(res, results);
}));

export default router;
