import { Router, Request, Response } from 'express';
import { expertAnalysisService } from '../services/expert-analysis.service';
import { billingService } from '../services/billing.service';
import type { PlanKey } from '@shared/schema/billing';
import { sendSuccess } from '../utils/response';
import { UnauthorizedError, NotFoundError, BadRequestError } from '../utils/errors';
import { asyncHandler } from '../utils/async-handler';
import { targetCompaniesRepository } from '../repositories/target-companies.repository';

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

// TODO: Gate display by tier in Stage 4 — analysis runs for all tiers, view differs
router.post('/trigger-pipeline/:id', asyncHandler(async (req: Request, res: Response) => {
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

// TODO: Gate display by tier in Stage 4 — analysis runs for all tiers, view differs
router.post('/retry/:id/:expertType', asyncHandler(async (req: Request, res: Response) => {
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

// TODO: Gate display by tier in Stage 4 — analysis runs for all tiers, view differs
router.post('/resume/:id', asyncHandler(async (req: Request, res: Response) => {
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

// Tier gating: CORE gets summary only; PROFESSIONAL+ gets full detail
router.get('/results/:id', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  const userCompanyId = req.session?.userCompanyId;
  if (!userId || !userCompanyId) throw new UnauthorizedError();

  const companyId = parseInt(req.params.id, 10);
  if (isNaN(companyId)) throw new BadRequestError('Invalid company ID');

  const company = await targetCompaniesRepository.getById(companyId, userCompanyId);
  if (!company) throw new NotFoundError('Company not found');

  const results = await expertAnalysisService.getExpertResults(companyId);

  let hasFullDetail = false;
  try {
    const entitlements = await billingService.getEntitlements(userCompanyId);
    hasFullDetail = entitlements?.features?.expertAnalysisFullDetail ?? false;
  } catch (err) {
    console.error('[EXPERT_ANALYSIS] Entitlements lookup failed, defaulting to summary view:', err);
    hasFullDetail = false;
  }

  if (hasFullDetail) {
    sendSuccess(res, results);
  } else {
    const UNGATED_TYPES = ['data_quality', 'screening'];

    const summaryResults = results.map((r: any) => {
      if (UNGATED_TYPES.includes(r.expertType)) {
        return r; // full payload — screening phase is visible to all tiers
      }
      return {
        id:         r.id,
        expertType: r.expertType,
        status:     r.status,
        score:      r.score,
        confidence: r.confidence,
        createdAt:  r.createdAt,
        updatedAt:  r.updatedAt,
      };
    });
    sendSuccess(res, summaryResults);
  }
}));

export default router;
