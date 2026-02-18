import { Router, Request, Response } from 'express';
import { notificationsService } from '../services/notifications.service';
import { sendSuccess } from '../utils/response';
import { asyncHandler } from '../utils/async-handler';
import { UnauthorizedError } from '../utils/errors';

const router = Router();

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session?.userId;

  if (!userId) {
    throw new UnauthorizedError();
  }

  const notifications = await notificationsService.getUserNotifications(userId);
  sendSuccess(res, notifications);
}));

router.put('/:id/read', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  const notificationId = parseInt(req.params.id);

  if (!userId) {
    throw new UnauthorizedError();
  }

  await notificationsService.markNotificationRead(notificationId, userId);
  sendSuccess(res, { message: 'Notification marked as read' });
}));

router.post('/mark-all-read', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.session?.userId;

  if (!userId) {
    throw new UnauthorizedError();
  }

  const count = await notificationsService.markAllNotificationsRead(userId);
  sendSuccess(res, { message: 'All notifications marked as read', count });
}));

export default router;
