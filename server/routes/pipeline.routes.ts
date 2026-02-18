import { Router, Request, Response } from 'express';
import { pipelineService } from '../services/pipeline.service';
import { sendSuccess } from '../utils/response';
import { asyncHandler } from '../utils/async-handler';
import { UnauthorizedError, NotFoundError } from '../utils/errors';
import { targetCompaniesRepository } from '../repositories/target-companies.repository';

const router = Router();

router.get('/stages', asyncHandler(async (req: Request, res: Response) => {
  const stages = await pipelineService.getPipelineStages();
  sendSuccess(res, stages);
}));

router.get('/overview', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;

  if (!userCompanyId) {
    throw new UnauthorizedError();
  }

  const overview = await pipelineService.getPipelineOverview(userCompanyId);
  sendSuccess(res, overview);
}));

router.put('/companies/:id/stage', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  const userCompanyId = req.session?.userCompanyId;
  const companyId = parseInt(req.params.id);
  const { stage, notes = '' } = req.body;

  if (!userId || !userCompanyId) {
    throw new UnauthorizedError();
  }

  const company = await targetCompaniesRepository.getById(companyId, userCompanyId);
  if (!company) {
    throw new NotFoundError('Company not found or access denied');
  }

  const result = await pipelineService.updateCompanyStage(companyId, stage, userId, notes);
  sendSuccess(res, result);
}));

router.get('/companies/:id/stage-history', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  const companyId = parseInt(req.params.id);

  if (!userCompanyId) {
    throw new UnauthorizedError();
  }

  const company = await targetCompaniesRepository.getById(companyId, userCompanyId);
  if (!company) {
    throw new NotFoundError('Company not found or access denied');
  }

  const history = await pipelineService.getStageHistory(companyId);
  sendSuccess(res, history);
}));

export default router;
