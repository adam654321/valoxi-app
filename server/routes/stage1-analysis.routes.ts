import { Router, Request, Response } from 'express';
import { stage1AnalysisService } from '../services/stage1-analysis.service';
import { sendSuccess, sendError } from '../utils/response';
import { BadRequestError, ForbiddenError } from '../utils/errors';
import { storage } from '../storage';

const router = Router();

router.get('/:companyId/status', async (req: Request, res: Response) => {
  try {
    const targetCompanyId = parseInt(req.params.companyId);
    const userCompanyId = req.session.userCompanyId!;
    if (isNaN(targetCompanyId)) throw new BadRequestError('Invalid company ID');
    const company = await storage.getTargetCompany(targetCompanyId, userCompanyId);
    if (!company) throw new ForbiddenError('Company not found or access denied');
    const categoryCheck = await stage1AnalysisService.checkStage1RequirementsByCategory(targetCompanyId);
    const latestEvent = await stage1AnalysisService.getLatestStage1Analysis(targetCompanyId);
    sendSuccess(res, { requirements: categoryCheck, latestAnalysis: latestEvent ? { id: latestEvent.id, status: latestEvent.webhookStatus, createdAt: latestEvent.createdAt } : null });
  } catch (error) { sendError(res, error); }
});

router.get('/:companyId/events', async (req: Request, res: Response) => {
  try {
    const targetCompanyId = parseInt(req.params.companyId);
    const userCompanyId = req.session.userCompanyId!;
    if (isNaN(targetCompanyId)) throw new BadRequestError('Invalid company ID');
    const company = await storage.getTargetCompany(targetCompanyId, userCompanyId);
    if (!company) throw new ForbiddenError('Company not found or access denied');
    const events = await stage1AnalysisService.getStage1AnalysisEvents(targetCompanyId);
    sendSuccess(res, events);
  } catch (error) { sendError(res, error); }
});

router.get('/:companyId/latest', async (req: Request, res: Response) => {
  try {
    const targetCompanyId = parseInt(req.params.companyId);
    const userCompanyId = req.session.userCompanyId!;
    if (isNaN(targetCompanyId)) throw new BadRequestError('Invalid company ID');
    const company = await storage.getTargetCompany(targetCompanyId, userCompanyId);
    if (!company) throw new ForbiddenError('Company not found or access denied');
    const latestEvent = await stage1AnalysisService.getLatestStage1Analysis(targetCompanyId);
    if (!latestEvent) return res.status(404).json({ error: 'No Stage 1 analysis found' });
    sendSuccess(res, latestEvent);
  } catch (error) { sendError(res, error); }
});

router.post('/:companyId/trigger', async (req: Request, res: Response) => {
  try {
    const targetCompanyId = parseInt(req.params.companyId);
    const userCompanyId = req.session.userCompanyId!;
    const userId = req.session.userId!;
    if (isNaN(targetCompanyId)) throw new BadRequestError('Invalid company ID');
    const company = await storage.getTargetCompany(targetCompanyId, userCompanyId);
    if (!company) throw new ForbiddenError('Company not found or access denied');
    const bypass = req.body.bypassRequirements === true;
    const result = await stage1AnalysisService.checkAndTriggerStage1Analysis(targetCompanyId, userId, bypass);
    sendSuccess(res, result);
  } catch (error) { sendError(res, error); }
});

router.post('/:companyId/trigger-bypass', async (req: Request, res: Response) => {
  try {
    const targetCompanyId = parseInt(req.params.companyId);
    const userCompanyId = req.session.userCompanyId!;
    const userId = req.session.userId!;
    if (isNaN(targetCompanyId)) throw new BadRequestError('Invalid company ID');
    const company = await storage.getTargetCompany(targetCompanyId, userCompanyId);
    if (!company) throw new ForbiddenError('Company not found or access denied');
    const result = await stage1AnalysisService.checkAndTriggerStage1Analysis(targetCompanyId, userId, true);
    sendSuccess(res, result);
  } catch (error) { sendError(res, error); }
});

export default router;
