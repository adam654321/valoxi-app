import { Router, type Request, type Response } from 'express';
import { Webhook } from 'svix';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users, marketingUnsubscribes } from '@shared/schema';

const router = Router();
const WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET;

interface ResendWebhookEvent {
  type: string;
  created_at?: string;
  data?: {
    email?: string;
    id?: string;
    topic_id?: string;
    topic_name?: string;
    [key: string]: unknown;
  };
}

router.post('/resend-marketing', async (req: Request, res: Response) => {
  if (!WEBHOOK_SECRET) {
    console.error('[resend-webhook] RESEND_WEBHOOK_SECRET is not set');
    return res.status(500).json({ error: 'webhook_not_configured' });
  }

  const svixId = req.headers['svix-id'] as string | undefined;
  const svixTimestamp = req.headers['svix-timestamp'] as string | undefined;
  const svixSignature = req.headers['svix-signature'] as string | undefined;

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.warn('[resend-webhook] missing svix headers');
    return res.status(400).json({ error: 'missing_headers' });
  }

  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: ResendWebhookEvent;
  try {
    const payload = (req.body as Buffer).toString();
    evt = wh.verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ResendWebhookEvent;
  } catch (err) {
    console.error('[resend-webhook] signature verification failed:', err);
    return res.status(400).json({ error: 'invalid_signature' });
  }

  console.log(`[resend-webhook] received type=${evt.type} svix_id=${svixId}`);

  try {
    if (evt.type === 'contact.unsubscribed') {
      await handleContactUnsubscribed(evt, svixId);
    } else {
      console.log(`[resend-webhook] ignoring event type ${evt.type} (out of Build 4 scope)`);
    }
  } catch (err) {
    console.error(`[resend-webhook] handler error for ${evt.type}:`, err);
    return res.status(500).json({ error: 'handler_failed' });
  }

  return res.status(200).json({ received: true });
});

async function handleContactUnsubscribed(evt: ResendWebhookEvent, svixId: string): Promise<void> {
  const email = evt.data?.email;
  if (!email) {
    console.warn('[resend-webhook] contact.unsubscribed: missing email in payload');
    return;
  }

  const [user] = await db.select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const userId = user?.id ?? null;
  const resendContactId = evt.data?.id ?? null;
  const topicId = (evt.data?.topic_id as string | undefined) ?? null;
  const topicName = (evt.data?.topic_name as string | undefined) ?? null;
  const unsubscribedAt = evt.created_at ? new Date(evt.created_at) : new Date();

  await db.insert(marketingUnsubscribes).values({
    userId,
    email,
    topicId,
    topicName,
    resendEventId: svixId,
    resendContactId,
    payload: evt as object,
    unsubscribedAt,
    source: 'resend_webhook',
  }).onConflictDoNothing({ target: marketingUnsubscribes.resendEventId });

  console.log(`[resend-webhook] contact.unsubscribed recorded for ${email} (user=${userId ?? 'unlinked'}, topic=${topicName ?? 'global'})`);
}

export default router;
