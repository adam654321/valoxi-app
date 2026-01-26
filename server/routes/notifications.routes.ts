import { Router, Request, Response } from 'express';
import { notificationsService } from '../services/notifications.service';
import { sendSuccess, sendError } from '../utils/response';
import { UnauthorizedError } from '../utils/errors';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;

    if (!userId) {
      throw new UnauthorizedError();
    }

    const notifications = await notificationsService.getUserNotifications(userId);
    sendSuccess(res, notifications);
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/:id/read', async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;
    const notificationId = parseInt(req.params.id);

    if (!userId) {
      throw new UnauthorizedError();
    }

    await notificationsService.markNotificationRead(notificationId, userId);
    sendSuccess(res, { message: 'Notification marked as read' });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/mark-all-read', async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;

    if (!userId) {
      throw new UnauthorizedError();
    }

    const count = await notificationsService.markAllNotificationsRead(userId);
    sendSuccess(res, { message: 'All notifications marked as read', count });
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
