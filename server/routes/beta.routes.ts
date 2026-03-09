import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { userCompanies } from '@shared/schema/core';
import { eq } from 'drizzle-orm';
import { systemConfigService } from '../services/system-config.service';
import { asyncHandler } from '../utils/async-handler';
import { sendSuccess } from '../utils/response';

const router = Router();

const switchPlanSchema = z.object({
  tier: z.enum(['core', 'professional', 'expert']),
});

router.post('/switch-plan', asyncHandler(async (req, res) => {
  if (process.env.BETA_MODE !== 'true') {
    return res.status(403).json({ success: false, message: 'Beta mode is not enabled' });
  }

  const tierSwitchEnabled = await systemConfigService.getConfig('beta_tier_switch_enabled');
  if (tierSwitchEnabled === 'false') {
    return res.status(403).json({ success: false, message: 'Tier switching is currently disabled' });
  }

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

router.get('/config', asyncHandler(async (_req, res) => {
  const [tierSwitchEnabled, feedbackEnabled] = await Promise.all([
    systemConfigService.getConfig('beta_tier_switch_enabled'),
    systemConfigService.getConfig('beta_feedback_enabled'),
  ]);

  sendSuccess(res, {
    tierSwitchEnabled: tierSwitchEnabled !== 'false',
    feedbackEnabled: feedbackEnabled !== 'false',
  });
}));

export default router;
