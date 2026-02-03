import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { chaseUpService } from '../services/chase-up.service';
import { sendSuccess, sendCreated, sendError } from '../utils/response';
import { UnauthorizedError, BadRequestError } from '../utils/errors';

const router = Router();

router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    if (!userCompanyId) throw new UnauthorizedError();
    const dashboard = await chaseUpService.getChaseUpDashboard(userCompanyId);
    sendSuccess(res, dashboard);
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    if (!userCompanyId) throw new UnauthorizedError();
    const alerts = await chaseUpService.getHighPriorityAlerts(userCompanyId);
    sendSuccess(res, alerts);
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/tokens/:tokenId/status', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    if (!userCompanyId) throw new UnauthorizedError();
    const tokenId = parseInt(req.params.tokenId);
    if (isNaN(tokenId)) throw new BadRequestError('Invalid token ID');
    const status = await chaseUpService.getChaseUpStatus(tokenId);
    sendSuccess(res, status);
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/tokens/:tokenId/extend', async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;
    const userCompanyId = req.session?.userCompanyId;
    if (!userId || !userCompanyId) throw new UnauthorizedError();
    
    const tokenId = parseInt(req.params.tokenId);
    if (isNaN(tokenId)) throw new BadRequestError('Invalid token ID');
    
    const schema = z.object({
      additionalDays: z.number().min(1).max(90),
    });
    const { additionalDays } = schema.parse(req.body);
    
    const schedule = await chaseUpService.extendTimeframe(tokenId, additionalDays, userId);
    sendSuccess(res, { message: `Deadline extended by ${additionalDays} days`, schedule });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/tokens/:tokenId/stop', async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;
    const userCompanyId = req.session?.userCompanyId;
    if (!userId || !userCompanyId) throw new UnauthorizedError();
    
    const tokenId = parseInt(req.params.tokenId);
    if (isNaN(tokenId)) throw new BadRequestError('Invalid token ID');
    
    const schema = z.object({
      reason: z.string().optional(),
    });
    const { reason } = schema.parse(req.body);
    
    const schedule = await chaseUpService.stopChaseUp(tokenId, reason || 'manual_stop');
    sendSuccess(res, { message: 'Chase-up stopped successfully', schedule });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/process', async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;
    if (!userId) throw new UnauthorizedError();
    
    const result = await chaseUpService.processChaseUpSchedules();
    sendSuccess(res, { message: 'Chase-up processing complete', ...result });
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
