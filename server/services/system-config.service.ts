import { eq } from 'drizzle-orm';
import { db } from '../db';
import { systemConfig } from '@shared/schema/core';

const CACHE_TTL_MS = 30_000;

type CacheEntry = { value: string | null; expiresAt: number };

/**
 * system_config access with a short-TTL in-memory read cache.
 *
 * - getConfig: serves from cache within TTL, else reads the DB and caches.
 * - setConfig: writes the DB, then updates this process's cache entry
 *   immediately (cache-bust-on-write) so an admin flip is instant locally.
 *
 * Multi-instance note: cache-bust-on-write only updates the cache in the
 * process that handled the write. On a multi-instance deployment, other
 * instances catch up within CACHE_TTL_MS. Acceptable for config flags — a
 * deliberate flip propagates across instances within the TTL window.
 */
class SystemConfigService {
  private cache = new Map<string, CacheEntry>();

  async getConfig(key: string): Promise<string | null> {
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }
    const [row] = await db
      .select()
      .from(systemConfig)
      .where(eq(systemConfig.key, key));
    const value = row?.value ?? null;
    this.cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  }

  async setConfig(key: string, value: string, adminUserId: number): Promise<void> {
    await db
      .insert(systemConfig)
      .values({ key, value, updatedAt: new Date(), updatedByUserId: adminUserId })
      .onConflictDoUpdate({
        target: systemConfig.key,
        set: { value, updatedAt: new Date(), updatedByUserId: adminUserId },
      });
    // cache-bust-on-write: refresh this process's entry so a flip is instant locally
    this.cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  }

  async getAllConfig(): Promise<{ key: string; value: string }[]> {
    const rows = await db.select().from(systemConfig);
    return rows.map((r) => ({ key: r.key, value: r.value }));
  }
}

export const systemConfigService = new SystemConfigService();
