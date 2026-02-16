import { db } from '../db';
import { portalAccessTokens, portalActivityLog } from '@shared/schema/portal';
import { eq, and, sql } from 'drizzle-orm';

export async function extendPortalTokenForCompany(
  targetCompanyId: number, 
  reason: string,
  daysToExtend: number = 30
): Promise<void> {
  try {
    const tokens = await db.select()
      .from(portalAccessTokens)
      .where(
        and(
          eq(portalAccessTokens.targetCompanyId, targetCompanyId),
          eq(portalAccessTokens.isActive, true)
        )
      );

    if (tokens.length === 0) {
      console.log(`[PORTAL_TOKEN] No active tokens found for company ${targetCompanyId}, skipping extension`);
      return;
    }

    for (const token of tokens) {
      const newExpiry = new Date();
      newExpiry.setDate(newExpiry.getDate() + daysToExtend);

      await db.update(portalAccessTokens)
        .set({
          expiresAt: newExpiry,
        })
        .where(eq(portalAccessTokens.id, token.id));

      await db.insert(portalActivityLog).values({
        portalTokenId: token.id,
        targetContactId: token.targetContactId,
        activityType: 'token_auto_extended',
        activityDescription: `Token automatically extended by ${daysToExtend} days. Reason: ${reason}`,
      });

      console.log(`[PORTAL_TOKEN] Extended token ${token.id} by ${daysToExtend} days — ${reason}`);
    }
  } catch (err) {
    console.error('[PORTAL_TOKEN] Failed to extend token:', err);
  }
}
