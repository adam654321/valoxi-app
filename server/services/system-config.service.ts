import { eq } from 'drizzle-orm';
import { db } from '../db';
import { systemConfig } from '@shared/schema/core';

class SystemConfigService {
  async getConfig(key: string): Promise<string | null> {
    const [row] = await db
      .select()
      .from(systemConfig)
      .where(eq(systemConfig.key, key));
    return row?.value ?? null;
  }

  async setConfig(key: string, value: string, adminUserId: number): Promise<void> {
    await db
      .insert(systemConfig)
      .values({ key, value, updatedAt: new Date(), updatedByUserId: adminUserId })
      .onConflictDoUpdate({
        target: systemConfig.key,
        set: { value, updatedAt: new Date(), updatedByUserId: adminUserId },
      });
  }

  async getAllConfig(): Promise<{ key: string; value: string }[]> {
    const rows = await db.select().from(systemConfig);
    return rows.map((r) => ({ key: r.key, value: r.value }));
  }
}

export const systemConfigService = new SystemConfigService();
