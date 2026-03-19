import crypto from 'crypto';
import { eq, and, isNull, lt, sql } from 'drizzle-orm';
import { db } from '../db';
import { magicLinks, resendRateLimits } from '@shared/schema/core';

class MagicLinkService {
  async generateMagicLink(userId: number, type: 'login' | 'welcome'): Promise<string> {
    await db
      .update(magicLinks)
      .set({ invalidatedAt: new Date() })
      .where(
        and(
          eq(magicLinks.userId, userId),
          eq(magicLinks.type, type),
          isNull(magicLinks.usedAt),
          isNull(magicLinks.invalidatedAt)
        )
      );

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    await db.insert(magicLinks).values({
      userId,
      token,
      type,
      expiresAt,
    });

    const appUrl = process.env.APP_URL || 'https://test.valoxi.ai';
    return `${appUrl}/auth/magic?token=${token}`;
  }

  async consumeMagicLink(token: string): Promise<
    | { valid: true; userId: number }
    | { valid: false; reason: 'not_found' | 'invalidated' | 'already_used' | 'expired' }
  > {
    const [row] = await db
      .select()
      .from(magicLinks)
      .where(eq(magicLinks.token, token));

    if (!row) {
      return { valid: false, reason: 'not_found' };
    }

    if (row.invalidatedAt) {
      return { valid: false, reason: 'invalidated' };
    }

    if (row.usedAt) {
      return { valid: false, reason: 'already_used' };
    }

    if (row.expiresAt < new Date()) {
      return { valid: false, reason: 'expired' };
    }

    await db
      .update(magicLinks)
      .set({ usedAt: new Date() })
      .where(eq(magicLinks.id, row.id));

    return { valid: true, userId: row.userId };
  }

  async checkResendRateLimit(email: string): Promise<{
    allowed: boolean;
    remainingRequests: number;
  }> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    await db
      .delete(resendRateLimits)
      .where(lt(resendRateLimits.windowStart, oneHourAgo));

    const [existing] = await db
      .select()
      .from(resendRateLimits)
      .where(eq(resendRateLimits.email, email));

    if (!existing) {
      await db.insert(resendRateLimits).values({
        email,
        requestCount: 1,
        windowStart: new Date(),
      });
      return { allowed: true, remainingRequests: 2 };
    }

    if ((existing.requestCount ?? 0) >= 3) {
      return { allowed: false, remainingRequests: 0 };
    }

    const newCount = (existing.requestCount ?? 0) + 1;
    await db
      .update(resendRateLimits)
      .set({ requestCount: newCount })
      .where(eq(resendRateLimits.id, existing.id));

    return { allowed: true, remainingRequests: 3 - newCount };
  }
}

export const magicLinkService = new MagicLinkService();
