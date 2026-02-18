import { Router, Request, Response } from 'express';
import { dashboardService } from '../services/dashboard.service';
import { sendSuccess } from '../utils/response';
import { UnauthorizedError } from '../utils/errors';
import { asyncHandler } from '../utils/async-handler';

const router = Router();

router.get('/stats', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  if (!userCompanyId) throw new UnauthorizedError();
  const stats = await dashboardService.getStats(userCompanyId);
  sendSuccess(res, stats);
}));

router.get('/data/:widget', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  const userId = req.session?.userId;
  if (!userCompanyId || !userId) throw new UnauthorizedError();
  const data = await dashboardService.getWidgetData(userCompanyId, userId, req.params.widget);
  sendSuccess(res, data);
}));

router.get('/widgets', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  if (!userId) throw new UnauthorizedError();
  const preferences = await dashboardService.getPreferences(userId);
  sendSuccess(res, preferences);
}));

router.put('/widgets', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  if (!userId) throw new UnauthorizedError();
  await dashboardService.updatePreferences(userId, req.body);
  sendSuccess(res, { message: 'Dashboard preferences updated' });
}));

router.get('/alerts', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  if (!userCompanyId) throw new UnauthorizedError();
  const alerts = await dashboardService.getAlerts(userCompanyId);
  sendSuccess(res, alerts);
}));

router.put('/alerts/:id/dismiss', asyncHandler(async (req: Request, res: Response) => {
  const userCompanyId = req.session?.userCompanyId;
  const alertId = parseInt(req.params.id);
  if (!userCompanyId) throw new UnauthorizedError();
  const success = await dashboardService.dismissAlert(alertId, userCompanyId);
  sendSuccess(res, { success, message: success ? 'Alert dismissed' : 'Alert not found' });
}));

export default router;
