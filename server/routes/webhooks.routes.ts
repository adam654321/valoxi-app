import { Router, type Request, type Response } from 'express';
import { Webhook } from 'svix';
import { eq, and, sql } from 'drizzle-orm';
import type { WebhookEvent, UserJSON, DeletedObjectJSON } from '@clerk/backend';
import { clerkClient } from '@clerk/express';
import { db } from '../db';
import { users, userInvitations } from '@shared/schema';
import { promoCodeCampaigns } from '@shared/schema/billing';
import { emailApiService } from '../services/email.service';
import { billingService } from '../services/billing.service';
import { marketingContactsService } from '../services/marketing-contacts.service';
import { isFiveDNewMember } from '../services/promo-code.service';
import { seedDefaultPipelineStages } from '../scripts/seed-pipeline-stages';

const router = Router();

const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SIGNING_SECRET;

function getPrimaryEmail(data: UserJSON): string | undefined {
  if (!data.primary_email_address_id) return undefined;
  const entry = data.email_addresses?.find((e) => e.id === data.primary_email_address_id);
  return entry?.email_address;
}

async function handleUserCreated(data: UserJSON): Promise<void> {
  const clerkUserId = data.id;
  const email = getPrimaryEmail(data);

  if (!email) {
    console.log(`[clerk-webhook] user.created: no primary email on payload for Clerk ${clerkUserId}, skipping`);
    return;
  }

  const revokeOrphanClerk = async (reason: string) => {
    try {
      await clerkClient.users.deleteUser(clerkUserId);
      console.log(`[clerk-webhook] orphan Clerk account ${clerkUserId} revoked (${reason}) for email ${email}`);
    } catch (err: any) {
      console.error(`[clerk-webhook] failed to revoke orphan Clerk account ${clerkUserId} (${reason}):`, err?.message || err);
    }
  };

  const [match] = await db
    .select({
      id: users.id,
      clerkUserId: users.clerkUserId,
      isActive: users.isActive,
      firstName: users.firstName,
      welcomeEmailSentAt: users.welcomeEmailSentAt,
      userCompanyId: users.userCompanyId,
      assignedPromoCampaignId: users.assignedPromoCampaignId,
    })
    .from(users)
    .where(sql`LOWER(${users.email}) = LOWER(${email.trim()})`);

  if (!match) {
    console.log(`[clerk-webhook] user.created: no matching user for ${email} (Clerk ${clerkUserId}), revoking orphan Clerk account`);
    await revokeOrphanClerk('no_matching_user_row');
    return;
  }

  if (!match.isActive) {
    console.log(`[clerk-webhook] user.created: matched user ${match.id} (${email}) is inactive, revoking Clerk account (Clerk ${clerkUserId})`);
    await revokeOrphanClerk('matched_user_inactive');
    return;
  }

  let linked = false;

  if (match.clerkUserId === null) {
    await db.update(users).set({ clerkUserId }).where(eq(users.id, match.id));
    console.log(`[clerk-webhook] user.created: linked user ${match.id} (${email}) to Clerk ${clerkUserId}`);
    linked = true;
  } else if (match.clerkUserId === clerkUserId) {
    console.log(`[clerk-webhook] user.created: user ${match.id} already linked to Clerk ${clerkUserId}`);
    linked = true;
  } else {
    console.log(`[clerk-webhook] user.created: user ${match.id} (${email}) already linked to different Clerk account ${match.clerkUserId}, revoking newer Clerk account ${clerkUserId}`);
    await revokeOrphanClerk('clerkUserId_conflict');
    return;
  }

  // #100 — flip pending team invitation to accepted on first link.
  // Idempotent: if invitation is already accepted (webhook re-delivery)
  // the WHERE clause matches zero rows and the UPDATE is a no-op.
  if (linked && match.userCompanyId !== null) {
    const flipResult = await db
      .update(userInvitations)
      .set({ invitationStatus: 'accepted', acceptedAt: new Date() })
      .where(and(
        eq(userInvitations.userCompanyId, match.userCompanyId),
        sql`LOWER(${userInvitations.email}) = LOWER(${email.trim()})`,
        eq(userInvitations.invitationStatus, 'pending')
      ))
      .returning({ id: userInvitations.id });
    if (flipResult.length > 0) {
      console.log(
        `[clerk-webhook] user.created: marked ${flipResult.length} invitation(s) ` +
        `accepted for user ${match.id} (${email})`
      );
    }
  }

  if (linked && match.userCompanyId !== null) {
    const existingSubscription = await billingService.getSubscription(match.userCompanyId);
    if (existingSubscription === null) {
      let use5DNewMemberTrial = false;
      if (match.assignedPromoCampaignId) {
        const [campaign] = await db
          .select()
          .from(promoCodeCampaigns)
          .where(eq(promoCodeCampaigns.id, match.assignedPromoCampaignId));
        if (campaign && isFiveDNewMember(campaign)) {
          use5DNewMemberTrial = true;
        }
      }

      if (use5DNewMemberTrial) {
        await billingService.createFiveDNewMemberTrial(match.userCompanyId);
      } else {
        await billingService.createTrialSubscription(match.userCompanyId, 1);
      }
      console.log(`[clerk-webhook] user.created: 24h trial subscription created for user ${match.id} (company ${match.userCompanyId})`);
      try {
        await seedDefaultPipelineStages();
        console.log(`[clerk-webhook] user.created: default pipeline stages seeded for company ${match.userCompanyId}`);
      } catch (err) {
        console.error(`[clerk-webhook] user.created: seedDefaultPipelineStages failed for company ${match.userCompanyId}:`, err);
      }
    } else {
      console.log(`[clerk-webhook] user.created: trial subscription already exists for user ${match.id} (company ${match.userCompanyId}), skipping`);
    }
  } else if (linked && match.userCompanyId === null) {
    console.warn(`[clerk-webhook] user.created: user ${match.id} has no userCompanyId, cannot create trial subscription`);
  }

  if (linked && match.welcomeEmailSentAt === null) {
    await emailApiService.sendOnboardingWelcome({
      to: email,
      firstName: match.firstName || 'there',
    });
    await db.update(users).set({ welcomeEmailSentAt: new Date() }).where(eq(users.id, match.id));
    console.log(`[clerk-webhook] user.created: welcome email sent to ${email} for user ${match.id}`);
  }

  if (linked) {
    await marketingContactsService.syncContactOnUserCreate(match.id);
  }
}

async function handleUserUpdated(data: UserJSON): Promise<void> {
  const clerkUserId = data.id;

  const [match] = await db
    .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId));

  if (!match) {
    console.log(`[clerk-webhook] user.updated: no user linked to Clerk ${clerkUserId}`);
    return;
  }

  const update: { firstName?: string; lastName?: string } = {};

  if (data.first_name !== null && data.first_name !== undefined && data.first_name !== match.firstName) {
    update.firstName = data.first_name;
  }
  if (data.last_name !== null && data.last_name !== undefined && data.last_name !== match.lastName) {
    update.lastName = data.last_name;
  }

  if (Object.keys(update).length === 0) {
    console.log(`[clerk-webhook] user.updated: no changes for user ${match.id} (Clerk ${clerkUserId})`);
    return;
  }

  await db.update(users).set(update).where(eq(users.id, match.id));
  console.log(`[clerk-webhook] user.updated: synced user ${match.id} (Clerk ${clerkUserId})`);
}

async function handleUserDeleted(data: DeletedObjectJSON): Promise<void> {
  const clerkUserId = data.id;

  if (!clerkUserId) {
    console.warn('[clerk-webhook] user.deleted: missing id on payload, skipping');
    return;
  }

  const [match] = await db
    .select({ id: users.id, isActive: users.isActive })
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId));

  if (!match) {
    console.log(`[clerk-webhook] user.deleted: no user linked to Clerk ${clerkUserId}`);
    return;
  }

  if (!match.isActive) {
    console.log(`[clerk-webhook] user.deleted: user ${match.id} already inactive, skipping`);
    return;
  }

  await db.update(users).set({ isActive: false }).where(eq(users.id, match.id));
  console.log(`[clerk-webhook] user.deleted: soft-deleted user ${match.id} (Clerk ${clerkUserId})`);
  await marketingContactsService.syncContactOnUserDelete(match.id);
}

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
  let evt: WebhookEvent;
  try {
    const payload = (req.body as Buffer).toString();
    evt = wh.verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as WebhookEvent;
  } catch (err) {
    console.error('[clerk-webhook] signature verification failed:', err);
    return res.status(400).json({ error: 'invalid_signature' });
  }

  console.log(`[clerk-webhook] received ${evt.type} for id ${(evt.data as { id?: string }).id ?? 'unknown'}`);

  try {
    switch (evt.type) {
      case 'user.created':
        await handleUserCreated(evt.data);
        break;
      case 'user.updated':
        await handleUserUpdated(evt.data);
        break;
      case 'user.deleted':
        await handleUserDeleted(evt.data);
        break;
      default:
        console.log(`[clerk-webhook] received unexpected event type ${(evt as { type: string }).type}, ignoring`);
    }
  } catch (err) {
    console.error(`[clerk-webhook] handler error for ${evt.type}:`, err);
    return res.status(500).json({ error: 'handler_failed' });
  }

  return res.status(200).json({ received: true });
});

export default router;
