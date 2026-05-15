import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/async-handler';
import { sendSuccess, sendCreated } from '../utils/response';
import { waitlistRepository } from '../repositories/waitlist.repository';

const router = Router();

const waitlistSubmissionSchema = z.object({
  full_name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  phone: z.string().max(50).optional().nullable(),
  acquisition_journey: z.string().min(1).max(100),
  target_deal_size: z.string().min(1).max(100),
  sectors: z.array(z.string().max(100)).max(30),
  sectors_other: z.string().max(500).optional().nullable(),
  acquisitions_completed: z.string().min(1).max(100),
  marketing_consent: z.boolean().optional().default(false),
});

router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const data = waitlistSubmissionSchema.parse(req.body);
  const normalisedEmail = data.email.trim().toLowerCase();

  const existing = await waitlistRepository.getByEmail(normalisedEmail);
  if (existing) {
    return sendSuccess(res, { alreadyRegistered: true, message: 'This email is already on the waitlist.' });
  }

  try {
    const created = await waitlistRepository.create({
      fullName: data.full_name.trim(),
      email: normalisedEmail,
      phone: data.phone?.trim() || null,
      acquisitionJourney: data.acquisition_journey,
      targetDealSize: data.target_deal_size,
      sectors: data.sectors,
      sectorsOther: data.sectors_other?.trim() || null,
      acquisitionsCompleted: data.acquisitions_completed,
      marketingConsent: data.marketing_consent,
      marketingConsentAt: data.marketing_consent ? new Date() : null,
    });
    return sendCreated(res, { id: created.id, alreadyRegistered: false });
  } catch (err: any) {
    if (err?.code === '23505' && err?.constraint === 'waitlist_email_unique') {
      return sendSuccess(res, { alreadyRegistered: true, message: 'This email is already on the waitlist.' });
    }
    throw err;
  }
}));

export default router;
