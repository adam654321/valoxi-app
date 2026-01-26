import { Router, Request, Response } from 'express';
import { dashboardService } from '../services/dashboard.service';
import { sendSuccess, sendError } from '../utils/response';
import { UnauthorizedError } from '../utils/errors';

const router = Router();

router.get('/stats', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    if (!userCompanyId) throw new UnauthorizedError();
    const stats = await dashboardService.getStats(userCompanyId);
    sendSuccess(res, stats);
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/data/:widget', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    const userId = req.session?.userId;
    if (!userCompanyId || !userId) throw new UnauthorizedError();
    const data = await dashboardService.getWidgetData(userCompanyId, userId, req.params.widget);
    sendSuccess(res, data);
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/widgets', async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;
    if (!userId) throw new UnauthorizedError();
    const preferences = await dashboardService.getPreferences(userId);
    sendSuccess(res, preferences);
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/widgets', async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;
    if (!userId) throw new UnauthorizedError();
    await dashboardService.updatePreferences(userId, req.body);
    sendSuccess(res, { message: 'Dashboard preferences updated' });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    if (!userCompanyId) throw new UnauthorizedError();
    const alerts = await dashboardService.getAlerts(userCompanyId);
    sendSuccess(res, alerts);
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/alerts/:id/dismiss', async (req: Request, res: Response) => {
  try {
    const userCompanyId = req.session?.userCompanyId;
    const alertId = parseInt(req.params.id);
    if (!userCompanyId) throw new UnauthorizedError();
    const success = await dashboardService.dismissAlert(alertId, userCompanyId);
    sendSuccess(res, { success, message: success ? 'Alert dismissed' : 'Alert not found' });
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
