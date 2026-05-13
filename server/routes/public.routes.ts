import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { sendSuccess } from '../utils/response';

const router = Router();

router.get(
  '/config',
  asyncHandler(async (_req, res) => {
    sendSuccess(res, {
      clerkEnabled: process.env.CLERK_ENABLED === 'true',
      nylasConnectVisible: process.env.NYLAS_CONNECT_VISIBLE === 'true',
    });
  }),
);

export default router;
