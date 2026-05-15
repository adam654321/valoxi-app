import { eq } from 'drizzle-orm';
import { db } from '../db';
import {
  marketingConsentTokens,
  type MarketingConsentToken,
  type NewMarketingConsentToken,
} from '@shared/schema';

class MarketingConsentTokenRepository {
  async getByToken(token: string): Promise<MarketingConsentToken | undefined> {
    const [row] = await db
      .select()
      .from(marketingConsentTokens)
      .where(eq(marketingConsentTokens.token, token))
      .limit(1);
    return row;
  }

  async create(data: NewMarketingConsentToken): Promise<MarketingConsentToken> {
    const [row] = await db
      .insert(marketingConsentTokens)
      .values(data)
      .returning();
    return row;
  }

  async markConsentRecorded(
    id: number,
    ipAddress: string | null,
  ): Promise<MarketingConsentToken | undefined> {
    const [row] = await db
      .update(marketingConsentTokens)
      .set({
        consentRecordedAt: new Date(),
        ipAddress: ipAddress,
      })
      .where(eq(marketingConsentTokens.id, id))
      .returning();
    return row;
  }
}

export const marketingConsentTokenRepository = new MarketingConsentTokenRepository();
