import type { Request, Response } from 'express';
import { z } from 'zod';
import { emailApiService } from '../services/email.service';
import { sendSuccess } from '../utils/response';

const requestSchema = z.object({ email: z.string().trim().email() });

/** Mounted behind the existing authenticated, CSRF-protected system-admin router. */
export async function sendFiveDWelcome(req: Request, res: Response): Promise<void> {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_email', message: 'A valid email address is required.' });
    return;
  }
  try {
    const result = await emailApiService.sendFiveDNewMemberWelcome({ to: parsed.data.email });
    if (!result.success) {
      res.status(502).json({
        error: 'email_delivery_failed',
        message: 'The email provider did not confirm delivery. Check its send log before retrying.',
      });
      return;
    }
    sendSuccess(res, { success: true, message: result.message });
  } catch (error) {
    console.error('[Admin] 5D welcome email error', error);
    res.status(502).json({
      error: 'email_delivery_unconfirmed',
      message: 'Unable to confirm welcome email delivery. Check the email provider before retrying.',
    });
  }
}
