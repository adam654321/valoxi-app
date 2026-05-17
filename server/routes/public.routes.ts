import { Router, type Request, type Response } from 'express';
import Stripe from 'stripe';
import { sql } from 'drizzle-orm';
import { asyncHandler } from '../utils/async-handler';
import { sendSuccess } from '../utils/response';
import { config } from '../config';
import { db } from '../db';
import { users } from '@shared/schema/core';

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

/**
 * GET /api/v2/public/checkout-status?session_id=...
 * C-new.3 — read-only poll endpoint for the /post-checkout page. Given a
 * Stripe Checkout session id, reports whether the self-serve account has been
 * provisioned yet by the checkout.session.completed webhook (C-new.2).
 * Unauthenticated and read-only. Lives here, not in the waitlistLimiter-bound
 * router, because the page polls it every few seconds.
 */
router.get(
  '/checkout-status',
  asyncHandler(async (req: Request, res: Response) => {
    const sessionId = String(req.query.session_id ?? '').trim();
    if (!sessionId) {
      return res.status(400).json({ error: 'missing_session_id' });
    }
    if (!config.stripe.secretKey) {
      return res.status(500).json({ error: 'stripe_not_configured' });
    }

    const stripe = new Stripe(config.stripe.secretKey);

    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId);
    } catch {
      return res.status(404).json({ error: 'session_not_found' });
    }

    const email = session.customer_details?.email?.trim().toLowerCase() ?? null;
    if (!email) {
      return res.status(200).json({ provisioned: false, email: null });
    }

    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`LOWER(${users.email}) = LOWER(${email})`);

    return res.status(200).json({ provisioned: !!existingUser, email });
  }),
);

export default router;
