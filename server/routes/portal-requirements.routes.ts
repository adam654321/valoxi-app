import { Router, Request, Response } from 'express';
import { portalRequirementsService } from '../services/portal-requirements.service';
import { sendSuccess, sendError } from '../utils/response';
import { BadRequestError, UnauthorizedError } from '../utils/errors';

const router = Router();

router.get('/company/:companyId', async (req: Request, res: Response) => {
  try {
    const targetCompanyId = parseInt(req.params.companyId);
    const userCompanyId = req.session.userCompanyId!;
    const stage = req.query.stage ? parseInt(req.query.stage as string) : null;
    if (isNaN(targetCompanyId)) throw new BadRequestError('Invalid company ID');
    const requirements = await portalRequirementsService.getRequirementsForCompany(targetCompanyId, userCompanyId, stage);
    sendSuccess(res, requirements);
  } catch (error) { sendError(res, error); }
});

router.post('/company/:companyId/initialize', async (req: Request, res: Response) => {
  try {
    const targetCompanyId = parseInt(req.params.companyId);
    const userCompanyId = req.session.userCompanyId!;
    const userId = req.session.userId!;
    if (isNaN(targetCompanyId)) throw new BadRequestError('Invalid company ID');
    const result = await portalRequirementsService.initializeRequirements(targetCompanyId, userCompanyId, userId);
    sendSuccess(res, result);
  } catch (error) { sendError(res, error); }
});

router.put('/company/:companyId/requirement/:requirementId', async (req: Request, res: Response) => {
  try {
    const targetCompanyId = parseInt(req.params.companyId);
    const requirementId = parseInt(req.params.requirementId);
    const userCompanyId = req.session.userCompanyId!;
    const userId = req.session.userId!;
    if (isNaN(targetCompanyId) || isNaN(requirementId)) throw new BadRequestError('Invalid ID');
    const updated = await portalRequirementsService.updateRequirement(requirementId, req.body, userCompanyId, userId);
    sendSuccess(res, updated);
  } catch (error) { sendError(res, error); }
});

router.get('/company/:companyId/progress', async (req: Request, res: Response) => {
  try {
    const targetCompanyId = parseInt(req.params.companyId);
    const userCompanyId = req.session.userCompanyId!;
    if (isNaN(targetCompanyId)) throw new BadRequestError('Invalid company ID');
    const progress = await portalRequirementsService.getDetailedProgress(targetCompanyId, userCompanyId);
    sendSuccess(res, progress);
  } catch (error) { sendError(res, error); }
});

router.get('/company/:companyId/overdue', async (req: Request, res: Response) => {
  try {
    const targetCompanyId = parseInt(req.params.companyId);
    const userCompanyId = req.session.userCompanyId!;
    if (isNaN(targetCompanyId)) throw new BadRequestError('Invalid company ID');
    const overdue = await portalRequirementsService.getOverdueRequirements(targetCompanyId, userCompanyId);
    sendSuccess(res, overdue);
  } catch (error) { sendError(res, error); }
});

router.get('/company/:companyId/submission-counts', async (req: Request, res: Response) => {
  try {
    const targetCompanyId = parseInt(req.params.companyId);
    const userCompanyId = req.session.userCompanyId!;
    if (isNaN(targetCompanyId)) throw new BadRequestError('Invalid company ID');
    const counts = await portalRequirementsService.getSubmissionCategoryCounts(targetCompanyId, userCompanyId);
    sendSuccess(res, counts);
  } catch (error) { sendError(res, error); }
});

const publicRouter = Router();

publicRouter.get('/:token/requirements', async (req: Request, res: Response) => {
  try {
    const data = await portalRequirementsService.getPortalRequirements(req.params.token);
    sendSuccess(res, data);
  } catch (error) { sendError(res, error); }
});

publicRouter.get('/:token/requirements/stage1', async (req: Request, res: Response) => {
  try {
    const data = await portalRequirementsService.getPortalRequirements(req.params.token);
    const stage1Only = data.requirements.filter(r => r.collectionStage === 1);
    sendSuccess(res, { requirements: stage1Only, progress: data.progress.stage1, companyName: data.companyName });
  } catch (error) { sendError(res, error); }
});

export default router;
export { publicRouter as portalRequirementsPublicRoutes };
