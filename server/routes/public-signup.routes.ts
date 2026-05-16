import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { asyncHandler } from '../utils/async-handler';
import { sendSuccess } from '../utils/response';
import { config } from '../config';
import { db } from '../db';
import { users, userCompanies, userCompanyMemberships } from '@shared/schema';
import { promoCodeService, getWaitlistPromoCopy } from '../services/promo-code.service';

const router = Router();

const signupSchema = z.object({
  email: z.string().email().max(255),
  firstName: z.string().min(1).max(100),
  lastName: z.string().max(100).optional().default(''),
  promoSlug: z.string().max(50).optional().nullable(),
  marketingConsent: z.boolean().optional().default(false),
});

/**
 * GET /api/v2/public/promo/:slug
 * Lightweight public resolver for the /welcome page benefit copy.
 * Returns campaign-safe fields only. Never returns Stripe coupon IDs or internal IDs.
 */
router.get('/promo/:slug', asyncHandler(async (req: Request, res: Response) => {
  const slug = String(req.params.slug || '').trim().toLowerCase();
  if (!slug) {
    return res.status(400).json({ error: 'invalid_slug', message: 'No promo slug supplied.' });
  }
  const campaign = await promoCodeService.resolveCampaignBySlug(slug);
  if (!campaign) {
    return res.status(404).json({ error: 'promo_not_found', message: 'This promo link is not valid.' });
  }
  // benefitLabel is the human-facing benefit sentence shown on /welcome.
  // Derived from getWaitlistPromoCopy (single source of truth for promo
  // copy, already used for invite emails). Null if the campaign has no
  // recognised copy mapping.
  const promoCopy = getWaitlistPromoCopy({
    referralSource: campaign.referralSource,
    freeMonthsTotal: campaign.freeMonthsTotal,
  });
  return sendSuccess(res, {
    slug: campaign.slug,
    name: campaign.name,
    freeMonthsTotal: campaign.freeMonthsTotal,
    benefitLabel: promoCopy?.benefitSentence ?? null,
  });
}));

/**
 * POST /api/v2/public/signup
 * Public self-serve signup. Creates the DB row set BEFORE Clerk signup so the
 * Clerk user.created webhook finds a match and does not orphan-revoke.
 * Trial creation is NOT done here — the webhook handles it (C.2).
 */
router.post('/signup', asyncHandler(async (req: Request, res: Response) => {
  if (!config.openAccessEnabled) {
    return res.status(400).json({
      error: 'open_access_disabled',
      message: 'Self-serve signup is not currently available.',
    });
  }

  const data = signupSchema.parse(req.body);
  const email = data.email.trim().toLowerCase();
  const firstName = data.firstName.trim().slice(0, 100);
  const lastName = (data.lastName || '').trim().slice(0, 100);

  let campaignId: number | null = null;
  if (data.promoSlug) {
    const campaign = await promoCodeService.resolveCampaignBySlug(data.promoSlug.trim().toLowerCase());
    if (!campaign) {
      return res.status(400).json({
        error: 'promo_not_found',
        message: 'This promo link is not valid.',
      });
    }
    campaignId = campaign.id;
  }

  const [existing] = await db
    .select({ id: users.id, isActive: users.isActive, clerkUserId: users.clerkUserId })
    .from(users)
    .where(sql`LOWER(${users.email}) = LOWER(${email})`);

  if (existing) {
    if (existing.isActive === false) {
      return res.status(409).json({
        error: 'account_inactive',
        message: 'An account with this email is deactivated. Please contact support.',
      });
    }
    return sendSuccess(res, {
      existingAccount: true,
      redirectUrl: `/sign-up?email_address=${encodeURIComponent(email)}`,
    });
  }

  const result = await db.transaction(async (tx) => {
    const [newCompany] = await tx
      .insert(userCompanies)
      .values({ companyName: 'Pending Setup' })
      .returning({ id: userCompanies.id });

    const [newUser] = await tx
      .insert(users)
      .values({
        email,
        firstName,
        lastName,
        userCompanyId: newCompany.id,
        currentCompanyId: newCompany.id,
        role: 'user',
        userRole: 'company_admin',
        isCompanyAdmin: true,
        marketingConsent: data.marketingConsent,
        marketingConsentAt: data.marketingConsent ? new Date() : null,
      })
      .returning({ id: users.id });

    if (campaignId !== null) {
      await promoCodeService.assignCampaignToUser(newUser.id, campaignId, null, tx);
    }

    await tx.insert(userCompanyMemberships).values({
      userId: newUser.id,
      userCompanyId: newCompany.id,
      isCompanyAdmin: true,
      membershipRole: 'company_admin',
    });

    return { userId: newUser.id, userCompanyId: newCompany.id };
  });

  return sendSuccess(res, {
    existingAccount: false,
    userId: result.userId,
    redirectUrl: `/sign-up?email_address=${encodeURIComponent(email)}`,
  });
}));

export default router;
