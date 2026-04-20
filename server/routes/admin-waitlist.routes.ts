import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/async-handler';
import { sendSuccess } from '../utils/response';
import { waitlistRepository } from '../repositories/waitlist.repository';

const router = Router();

const listQuerySchema = z.object({
  status: z.enum(['new', 'approved', 'invited', 'declined']).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const filters = listQuerySchema.parse(req.query);
  const rows = await waitlistRepository.list(filters);
  sendSuccess(res, rows);
}));

router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const row = await waitlistRepository.getById(req.params.id);
  if (!row) {
    return res.status(404).json({ success: false, message: 'Waitlist entry not found' });
  }
  sendSuccess(res, row);
}));

router.post('/:id/approve', asyncHandler(async (req: Request, res: Response) => {
  const adminUserId = req.session.userId!;
  const row = await waitlistRepository.getById(req.params.id);
  if (!row) {
    return res.status(404).json({ success: false, message: 'Waitlist entry not found' });
  }
  if (row.status === 'invited') {
    return res.status(409).json({ success: false, message: 'Cannot approve an entry that has already been invited' });
  }
  const updated = await waitlistRepository.updateStatus(req.params.id, 'approved', adminUserId);
  console.log(`[admin-waitlist] action=approve waitlistId=${req.params.id} adminUserId=${adminUserId}`);
  sendSuccess(res, updated);
}));

router.post('/:id/decline', asyncHandler(async (req: Request, res: Response) => {
  const adminUserId = req.session.userId!;
  const row = await waitlistRepository.getById(req.params.id);
  if (!row) {
    return res.status(404).json({ success: false, message: 'Waitlist entry not found' });
  }
  if (row.status === 'invited') {
    return res.status(409).json({ success: false, message: 'Cannot decline an entry that has already been invited' });
  }
  const updated = await waitlistRepository.updateStatus(req.params.id, 'declined', adminUserId);
  console.log(`[admin-waitlist] action=decline waitlistId=${req.params.id} adminUserId=${adminUserId}`);
  sendSuccess(res, updated);
}));

export default router;
