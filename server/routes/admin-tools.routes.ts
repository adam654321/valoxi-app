import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { userCompanies } from '@shared/schema/core';
import { eq } from 'drizzle-orm';
import { asyncHandler } from '../utils/async-handler';
import { sendSuccess } from '../utils/response';

const router = Router();

const switchPlanSchema = z.object({
  tier: z.enum(['core', 'professional', 'expert']),
});

router.post('/switch-plan', asyncHandler(async (req, res) => {
  const body = switchPlanSchema.parse(req.body);
  const companyId = req.session.userCompanyId;

  if (!companyId) {
    return res.status(400).json({ success: false, message: 'No company associated with user' });
  }

  const overrideValue = body.tier.toUpperCase();

  await db
    .update(userCompanies)
    .set({ betaPlanOverride: overrideValue })
    .where(eq(userCompanies.id, companyId));

  sendSuccess(res, { tier: overrideValue, message: `Plan switched to ${body.tier}` });
}));

export default router;
