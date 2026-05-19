import { Router, type Request, type Response } from 'express';
import Stripe from 'stripe';
import { sql } from 'drizzle-orm';
import { asyncHandler } from '../utils/async-handler';
import { sendSuccess } from '../utils/response';
import { config } from '../config';
import { db } from '../db';
import { users, webhookEvents } from '@shared/schema/core';
import { systemConfigService } from '../services/system-config.service';

const router = Router();

router.get(
  '/config',
  asyncHandler(async (_req, res) => {
    const openAccess = (await systemConfigService.getConfig('open_access_enabled')) === 'true';
    sendSuccess(res, {
      clerkEnabled: process.env.CLERK_ENABLED === 'true',
      nylasConnectGmailVisible: process.env.NYLAS_CONNECT_GMAIL_VISIBLE === 'true',
      nylasConnectOutlookVisible: process.env.NYLAS_CONNECT_OUTLOOK_VISIBLE === 'true',
      openAccessEnabled: openAccess,
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
      return res.status(200).json({ state: 'pending', email: null });
    }

    const collisionRows = await db.execute(sql`
      SELECT 1 FROM webhook_events
      WHERE event_type = 'checkout.session.completed'
        AND payload->>'id' = ${sessionId}
        AND error = 'duplicate_checkout_existing_subscription'
      LIMIT 1
    `);
    if (collisionRows.rows.length > 0) {
      const [collisionUser] = await db
        .select({ clerkUserId: users.clerkUserId })
        .from(users)
        .where(sql`LOWER(${users.email}) = LOWER(${email})`);
      return res.status(200).json({
        state: 'collision',
        email,
        hasClerkAccount: !!collisionUser?.clerkUserId,
      });
    }

    const processedRows = await db.execute(sql`
      SELECT 1 FROM webhook_events
      WHERE event_type = 'checkout.session.completed'
        AND payload->>'id' = ${sessionId}
        AND status = 'processed'
      LIMIT 1
    `);
    if (processedRows.rows.length > 0) {
      return res.status(200).json({ state: 'provisioned', email });
    }

    return res.status(200).json({ state: 'pending', email });
  }),
);

export default router;
