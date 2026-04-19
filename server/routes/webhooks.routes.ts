import { Router, type Request, type Response } from 'express';
import { Webhook } from 'svix';

const router = Router();

const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SIGNING_SECRET;

router.post('/clerk', async (req: Request, res: Response) => {
  if (!WEBHOOK_SECRET) {
    console.error('[clerk-webhook] CLERK_WEBHOOK_SIGNING_SECRET is not set');
    return res.status(500).json({ error: 'webhook_not_configured' });
  }

  const svixId = req.headers['svix-id'] as string | undefined;
  const svixTimestamp = req.headers['svix-timestamp'] as string | undefined;
  const svixSignature = req.headers['svix-signature'] as string | undefined;

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.warn('[clerk-webhook] missing svix headers');
    return res.status(400).json({ error: 'missing_headers' });
  }

  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: any;
  try {
    const payload = (req.body as Buffer).toString();
    evt = wh.verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    });
  } catch (err) {
    console.error('[clerk-webhook] signature verification failed:', err);
    return res.status(400).json({ error: 'invalid_signature' });
  }

  const eventType = evt?.type ?? 'unknown';
  const userId = evt?.data?.id ?? 'unknown';
  console.log(`[clerk-webhook] received ${eventType} for user ${userId}`);

  // Event handlers will be added in Phase 4B-3.
  // For now, acknowledge all events.
  return res.status(200).json({ received: true });
});

export default router;
