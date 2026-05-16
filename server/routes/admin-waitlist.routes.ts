import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { asyncHandler } from '../utils/async-handler';
import { sendSuccess } from '../utils/response';
import { db } from '../db';
import { waitlist, users, userCompanies, userCompanyMemberships, promoCodeCampaigns } from '@shared/schema';
import { waitlistRepository } from '../repositories/waitlist.repository';
import { emailApiService } from '../services/email.service';
import { getWaitlistPromoCopy, promoCodeService } from '../services/promo-code.service';
import { config } from '../config';
import { NotFoundError, ConflictError } from '../utils/errors';

const router = Router();

const listQuerySchema = z.object({
  status: z.enum(['new', 'approved', 'invited', 'declined']).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const filters = listQuerySchema.parse(req.query);
  const rows = await waitlistRepository.list(filters);
  sendSuccess(res, rows);
}));

router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const row = await waitlistRepository.getById(req.params.id);
  if (!row) {
    return res.status(404).json({ success: false, message: 'Waitlist entry not found' });
  }
  sendSuccess(res, row);
}));

router.post('/:id/approve', asyncHandler(async (req: Request, res: Response) => {
  const adminUserId = req.session.userId!;
  const row = await waitlistRepository.getById(req.params.id);
  if (!row) {
    return res.status(404).json({ success: false, message: 'Waitlist entry not found' });
  }
  if (row.status === 'invited') {
    return res.status(409).json({ success: false, message: 'Cannot approve an entry that has already been invited' });
  }
  const updated = await waitlistRepository.updateStatus(req.params.id, 'approved', adminUserId);
  console.log(`[admin-waitlist] action=approve waitlistId=${req.params.id} adminUserId=${adminUserId}`);
  sendSuccess(res, updated);
}));

router.post('/:id/decline', asyncHandler(async (req: Request, res: Response) => {
  const adminUserId = req.session.userId!;
  const row = await waitlistRepository.getById(req.params.id);
  if (!row) {
    return res.status(404).json({ success: false, message: 'Waitlist entry not found' });
  }
  if (row.status === 'invited') {
    return res.status(409).json({ success: false, message: 'Cannot decline an entry that has already been invited' });
  }
  const updated = await waitlistRepository.updateStatus(req.params.id, 'declined', adminUserId);
  console.log(`[admin-waitlist] action=decline waitlistId=${req.params.id} adminUserId=${adminUserId}`);
  sendSuccess(res, updated);
}));

const inviteWaitlistSchema = z.object({
  promoCodeCampaignId: z.number().int().positive().optional().nullable(),
});

router.post('/:id/invite', asyncHandler(async (req: Request, res: Response) => {
  const adminUserId = req.session.userId;
  if (!adminUserId) {
    return res.status(401).json({
      success: false,
      message: 'Admin session is missing user context',
    });
  }
  const body = inviteWaitlistSchema.parse(req.body ?? {});
  const promoCodeCampaignId = body.promoCodeCampaignId ?? null;
  const waitlistId = req.params.id;

  let campaignRow: typeof promoCodeCampaigns.$inferSelect | null = null;
  if (promoCodeCampaignId !== null) {
    const [found] = await db
      .select()
      .from(promoCodeCampaigns)
      .where(eq(promoCodeCampaigns.id, promoCodeCampaignId));
    if (!found) {
      return res.status(400).json({
        success: false,
        message: `Invalid promo campaign id: ${promoCodeCampaignId}`,
      });
    }
    campaignRow = found;
  }

  let result: { userId: number; userCompanyId: number; email: string; firstName: string };

  try {
    result = await db.transaction(async (tx) => {
      // Step 1: acquire row lock on the waitlist row
      await tx.execute(sql`SELECT 1 FROM waitlist WHERE id = ${waitlistId} FOR UPDATE`);

      // Step 2: read the now-locked waitlist row
      const [entry] = await tx.select().from(waitlist).where(eq(waitlist.id, waitlistId));

      if (!entry) {
        throw new NotFoundError('waitlist_not_found');
      }

      if (entry.status === 'invited') {
        const changedBy = entry.statusChangedBy;
        const changedAt = entry.statusChangedAt?.toISOString() ?? 'unknown time';
        throw new ConflictError(`already_invited:${changedBy}:${changedAt}:${entry.invitedUserId ?? 'unknown'}`);
      }

      // Step 3: check email not already in users
      const [existingUser] = await tx
        .select({ id: users.id })
        .from(users)
        .where(sql`LOWER(${users.email}) = LOWER(${entry.email.trim()})`);

      if (existingUser) {
        throw new ConflictError(`email_exists:${existingUser.id}`);
      }

      // Step 4: parse firstName and lastName from fullName
      const trimmed = entry.fullName.trim();
      const firstSpace = trimmed.indexOf(' ');
      let firstName: string;
      let lastName: string;
      if (firstSpace === -1) {
        firstName = trimmed.slice(0, 100);
        lastName = '';
      } else {
        firstName = trimmed.slice(0, firstSpace).slice(0, 100);
        lastName = trimmed.slice(firstSpace + 1).slice(0, 100);
      }

      // Step 5: insert user_company with placeholder companyName
      const [newCompany] = await tx
        .insert(userCompanies)
        .values({ companyName: 'Pending Setup' })
        .returning({ id: userCompanies.id });

      // Step 6: insert users row
      const [newUser] = await tx
        .insert(users)
        .values({
          email: entry.email,
          firstName,
          lastName,
          userCompanyId: newCompany.id,
          currentCompanyId: newCompany.id,
          role: 'user',
          userRole: 'company_admin',
          isCompanyAdmin: true,
          marketingConsent: entry.marketingConsent,
          marketingConsentAt: entry.marketingConsentAt,
        })
        .returning({ id: users.id });

      // Step 6b: assign promo campaign via service (single source of truth)
      if (promoCodeCampaignId !== null) {
        await promoCodeService.assignCampaignToUser(newUser.id, promoCodeCampaignId, adminUserId, tx);
      }

      // Step 7: insert user_company_membership
      await tx.insert(userCompanyMemberships).values({
        userId: newUser.id,
        userCompanyId: newCompany.id,
        isCompanyAdmin: true,
        membershipRole: 'company_admin',
      });

      // Step 8: mark waitlist row as invited with audit fields
      await tx
        .update(waitlist)
        .set({
          status: 'invited',
          statusChangedAt: new Date(),
          statusChangedBy: adminUserId,
          invitedUserId: newUser.id,
        })
        .where(eq(waitlist.id, waitlistId));

      // Step 9: return the created ids
      return {
        userId: newUser.id,
        userCompanyId: newCompany.id,
        email: entry.email,
        firstName,
      };
    });
  } catch (err: any) {
    if (err?.message?.startsWith('waitlist_not_found')) {
      return res.status(404).json({ success: false, message: 'Waitlist entry not found' });
    }
    if (err?.message?.startsWith('already_invited:')) {
      const parts = err.message.split(':');
      const byAdmin = parts[1];
      const atTime = parts[2];
      const userId = parts[3];
      return res.status(409).json({
        success: false,
        message: `This waitlist entry was already invited by admin ${byAdmin} at ${atTime}. Invited user id: ${userId}.`,
      });
    }
    if (err?.message?.startsWith('email_exists:')) {
      const existingUserId = err.message.split(':')[1];
      return res.status(409).json({
        success: false,
        message: `A user with this email already exists (id: ${existingUserId}). Investigate before proceeding.`,
      });
    }
    throw err;
  }

  // Step 10: send invitation email (OUTSIDE transaction)
  const inviteUrl = `${config.baseUrl}/sign-up`;
  const promoCopy = campaignRow ? getWaitlistPromoCopy(campaignRow) : null;
  try {
    await emailApiService.sendWaitlistInvitation({
      to: result.email,
      firstName: result.firstName || 'there',
      invitedEmail: result.email,
      inviteUrl,
      promoBenefitSentence: promoCopy?.benefitSentence ?? null,
      trialLineOverride: promoCopy?.trialLineOverride ?? null,
    });
  } catch (emailErr) {
    console.error(
      `[admin-waitlist] email delivery failed for waitlistId=${waitlistId} userId=${result.userId} email=${result.email}:`,
      emailErr
    );
    // Do not rollback; the user record is valid and can be resent via a future endpoint.
  }

  console.log(
    `[admin-waitlist] action=invite waitlistId=${waitlistId} adminUserId=${adminUserId} targetUserId=${result.userId} targetCompanyId=${result.userCompanyId} promoCodeCampaignId=${promoCodeCampaignId ?? 'none'}`
  );

  sendSuccess(res, {
    userId: result.userId,
    userCompanyId: result.userCompanyId,
    email: result.email,
    message: `Invitation sent to ${result.email}`,
  });
}));

export default router;
