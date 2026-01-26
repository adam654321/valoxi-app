import { Router, Request, Response } from 'express';
import { pipelineService } from '../services/pipeline.service';
import { sendSuccess, sendError } from '../utils/response';
import { UnauthorizedError, NotFoundError } from '../utils/errors';
import { storage } from '../storage';

const router = Router();

router.get('/stages', async (req: Request, res: Response) => {
  try {
    const stages = await pipelineService.getPipelineStages();
    sendSuccess(res, stages);
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/overview', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;

    if (!userCompanyId) {
      throw new UnauthorizedError();
    }

    const overview = await pipelineService.getPipelineOverview(userCompanyId);
    sendSuccess(res, overview);
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/companies/:id/stage', async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;
    const userCompanyId = req.session?.userCompanyId;
    const companyId = parseInt(req.params.id);
    const { stage, notes = '' } = req.body;

    if (!userId || !userCompanyId) {
      throw new UnauthorizedError();
    }

    const company = await storage.getTargetCompany(companyId, userCompanyId);
    if (!company) {
      throw new NotFoundError('Company not found or access denied');
    }

    const result = await pipelineService.updateCompanyStage(companyId, stage, userId, notes);
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/companies/:id/stage-history', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    const companyId = parseInt(req.params.id);

    if (!userCompanyId) {
      throw new UnauthorizedError();
    }

    const company = await storage.getTargetCompany(companyId, userCompanyId);
    if (!company) {
      throw new NotFoundError('Company not found or access denied');
    }

    const history = await pipelineService.getStageHistory(companyId);
    sendSuccess(res, history);
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
