import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { chaseUpService } from '../services/chase-up.service';
import { sendSuccess } from '../utils/response';
import { UnauthorizedError, BadRequestError } from '../utils/errors';
import { asyncHandler } from '../utils/async-handler';
import { isSystemAdmin } from '../middleware/auth';

const router = Router();

router.get('/dashboard', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  if (!userCompanyId) throw new UnauthorizedError();
  const dashboard = await chaseUpService.getChaseUpDashboard(userCompanyId);
  sendSuccess(res, dashboard);
}));

router.get('/alerts', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  if (!userCompanyId) throw new UnauthorizedError();
  const alerts = await chaseUpService.getHighPriorityAlerts(userCompanyId);
  sendSuccess(res, alerts);
}));

router.get('/tokens/:tokenId/status', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  if (!userCompanyId) throw new UnauthorizedError();
  const tokenId = parseInt(req.params.tokenId);
  if (isNaN(tokenId)) throw new BadRequestError('Invalid token ID');
  const status = await chaseUpService.getChaseUpStatus(tokenId);
  sendSuccess(res, status);
}));

router.post('/tokens/:tokenId/extend', asyncHandler(async (req: Request, res: Response) => {
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
}));

router.post('/tokens/:tokenId/stop', asyncHandler(async (req: Request, res: Response) => {
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
}));

router.post('/process', isSystemAdmin, asyncHandler(async (req: Request, res: Response) => {
  const result = await chaseUpService.processChaseUpSchedules();
  sendSuccess(res, { message: 'Chase-up processing complete', ...result });
}));

export default router;
