import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { sendSuccess } from '../utils/response';

const router = Router();

router.get(
  '/config',
  asyncHandler(async (_req, res) => {
    sendSuccess(res, {
      clerkEnabled: process.env.CLERK_ENABLED === 'true',
      nylasConnectGmailVisible: process.env.NYLAS_CONNECT_GMAIL_VISIBLE === 'true',
      nylasConnectOutlookVisible: process.env.NYLAS_CONNECT_OUTLOOK_VISIBLE === 'true',
      openAccessEnabled: process.env.OPEN_ACCESS_ENABLED === 'true',
    });
  }),
);

export default router;
