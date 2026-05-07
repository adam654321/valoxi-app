import { and, desc, eq, ne } from 'drizzle-orm';
import { db } from '../db';
import { nylasGrants } from '@shared/schema';

export const nylasRepository = {
  async createGrant(data: {
    userId: number;
    userCompanyId: number;
    grantId: string;
    email: string;
    provider: 'google' | 'microsoft';
    scopes: string[];
  }) {
    const [row] = await db.insert(nylasGrants).values({
      ...data,
      status: 'active',
    }).returning();
    return row;
  },

  async getActiveGrantsForUser(userId: number) {
    return db.select().from(nylasGrants).where(
      and(eq(nylasGrants.userId, userId), eq(nylasGrants.status, 'active'))
    ).orderBy(desc(nylasGrants.lastUsedAt));
  },

  async getGrantById(id: number) {
    const [row] = await db.select().from(nylasGrants).where(eq(nylasGrants.id, id)).limit(1);
    return row ?? null;
  },

  async getGrantByGrantId(grantId: string) {
    const [row] = await db.select().from(nylasGrants).where(eq(nylasGrants.grantId, grantId)).limit(1);
    return row ?? null;
  },

  async markBroken(grantId: string, errorMessage: string) {
    await db.update(nylasGrants).set({
      status: 'broken',
      lastErrorAt: new Date(),
      lastErrorMessage: errorMessage.slice(0, 500),
      updatedAt: new Date(),
    }).where(eq(nylasGrants.grantId, grantId));
  },

  async markRevoked(grantId: string) {
    await db.update(nylasGrants).set({
      status: 'revoked',
      updatedAt: new Date(),
    }).where(eq(nylasGrants.grantId, grantId));
  },

  async markActive(grantId: string) {
    await db.update(nylasGrants).set({
      status: 'active',
      lastErrorAt: null,
      lastErrorMessage: null,
      updatedAt: new Date(),
    }).where(eq(nylasGrants.grantId, grantId));
  },

  async bumpLastUsed(grantId: string) {
    await db.update(nylasGrants).set({
      lastUsedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(nylasGrants.grantId, grantId));
  },

  async getGrantsForUser(userId: number, options: { includeRevoked?: boolean } = {}) {
    const baseConditions = [eq(nylasGrants.userId, userId)];
    if (!options.includeRevoked) {
      baseConditions.push(ne(nylasGrants.status, 'revoked'));
    }
    return db.select().from(nylasGrants)
      .where(and(...baseConditions))
      .orderBy(desc(nylasGrants.lastUsedAt), desc(nylasGrants.createdAt));
  },
};
