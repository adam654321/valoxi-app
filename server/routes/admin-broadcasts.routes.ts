import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/async-handler';
import { sendSuccess } from '../utils/response';
import { broadcastsService } from '../services/broadcasts.service';

const router = Router();

router.get('/segments', asyncHandler(async (_req: Request, res: Response) => {
  const segments = await broadcastsService.listSegments();
  sendSuccess(res, segments);
}));

const sendBroadcastSchema = z.object({
  subject: z.string().min(1).max(255),
  bodyMarkdown: z.string().min(1).max(50000),
  segmentKey: z.enum(['all_users', 'active_subscribers', 'cancelled_subscribers', 'past_due', 'trialing', 'test_internal']),
  isTest: z.boolean(),
  composerSessionId: z.string().min(8).max(64),
});

router.post('/send', asyncHandler(async (req: Request, res: Response) => {
  const input = sendBroadcastSchema.parse(req.body);
  const sentByUserId = req.session?.userId;
  if (!sentByUserId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const result = await broadcastsService.sendBroadcast({ ...input, sentByUserId });

  if (result.status === 'failed') {
    return res.status(400).json({ success: false, message: result.error || 'Broadcast send failed' });
  }
  sendSuccess(res, result);
}));

router.get('/history', asyncHandler(async (_req: Request, res: Response) => {
  const history = await broadcastsService.listHistory();
  sendSuccess(res, history);
}));

export default router;
