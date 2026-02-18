import { Router, Request, Response } from 'express';
import { portalRequirementsService } from '../services/portal-requirements.service';
import { sendSuccess } from '../utils/response';
import { asyncHandler } from '../utils/async-handler';
import { BadRequestError, UnauthorizedError } from '../utils/errors';

const router = Router();

router.get('/company/:companyId', asyncHandler(async (req: Request, res: Response) => {
  const targetCompanyId = parseInt(req.params.companyId);
  const userCompanyId = req.session.userCompanyId!;
  const stage = req.query.stage ? parseInt(req.query.stage as string) : null;
  if (isNaN(targetCompanyId)) throw new BadRequestError('Invalid company ID');
  const requirements = await portalRequirementsService.getRequirementsForCompany(targetCompanyId, userCompanyId, stage);
  sendSuccess(res, requirements);
}));

router.post('/company/:companyId/initialize', asyncHandler(async (req: Request, res: Response) => {
  const targetCompanyId = parseInt(req.params.companyId);
  const userCompanyId = req.session.userCompanyId!;
  const userId = req.session.userId!;
  if (isNaN(targetCompanyId)) throw new BadRequestError('Invalid company ID');
  const result = await portalRequirementsService.initializeRequirements(targetCompanyId, userCompanyId, userId);
  sendSuccess(res, result);
}));

router.put('/company/:companyId/requirement/:requirementId', asyncHandler(async (req: Request, res: Response) => {
  const targetCompanyId = parseInt(req.params.companyId);
  const requirementId = parseInt(req.params.requirementId);
  const userCompanyId = req.session.userCompanyId!;
  const userId = req.session.userId!;
  if (isNaN(targetCompanyId) || isNaN(requirementId)) throw new BadRequestError('Invalid ID');
  const updated = await portalRequirementsService.updateRequirement(requirementId, req.body, userCompanyId, userId);
  sendSuccess(res, updated);
}));

router.get('/company/:companyId/progress', asyncHandler(async (req: Request, res: Response) => {
  const targetCompanyId = parseInt(req.params.companyId);
  const userCompanyId = req.session.userCompanyId!;
  if (isNaN(targetCompanyId)) throw new BadRequestError('Invalid company ID');
  const progress = await portalRequirementsService.getDetailedProgress(targetCompanyId, userCompanyId);
  sendSuccess(res, progress);
}));

router.get('/company/:companyId/overdue', asyncHandler(async (req: Request, res: Response) => {
  const targetCompanyId = parseInt(req.params.companyId);
  const userCompanyId = req.session.userCompanyId!;
  if (isNaN(targetCompanyId)) throw new BadRequestError('Invalid company ID');
  const overdue = await portalRequirementsService.getOverdueRequirements(targetCompanyId, userCompanyId);
  sendSuccess(res, overdue);
}));

router.get('/company/:companyId/submission-counts', asyncHandler(async (req: Request, res: Response) => {
  const targetCompanyId = parseInt(req.params.companyId);
  const userCompanyId = req.session.userCompanyId!;
  if (isNaN(targetCompanyId)) throw new BadRequestError('Invalid company ID');
  const counts = await portalRequirementsService.getSubmissionCategoryCounts(targetCompanyId, userCompanyId);
  sendSuccess(res, counts);
}));

const publicRouter = Router();

publicRouter.get('/:token/requirements', asyncHandler(async (req: Request, res: Response) => {
  const data = await portalRequirementsService.getPortalRequirements(req.params.token);
  sendSuccess(res, data);
}));

publicRouter.get('/:token/requirements/stage1', asyncHandler(async (req: Request, res: Response) => {
  const data = await portalRequirementsService.getPortalRequirements(req.params.token);
  const stage1Only = data.requirements.filter(r => r.collectionStage === 1);
  sendSuccess(res, { requirements: stage1Only, progress: data.progress.stage1, companyName: data.companyName });
}));

export default router;
export { publicRouter as portalRequirementsPublicRoutes };
