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
    isAdmin?: boolean;
  }) {
    const existingPersonal = await db.select().from(nylasGrants)
      .where(and(
        eq(nylasGrants.userId, data.userId),
        eq(nylasGrants.isPersonalDefault, true),
        ne(nylasGrants.status, 'revoked'),
      ))
      .limit(1);
    const shouldBePersonalDefault = existingPersonal.length === 0;

    let shouldBeCompanyDefault = false;
    if (data.isAdmin) {
      const existingCompany = await db.select().from(nylasGrants)
        .where(and(
          eq(nylasGrants.userCompanyId, data.userCompanyId),
          eq(nylasGrants.isCompanyDefault, true),
          ne(nylasGrants.status, 'revoked'),
        ))
        .limit(1);
      shouldBeCompanyDefault = existingCompany.length === 0;
    }

    const [row] = await db.insert(nylasGrants).values({
      userId: data.userId,
      userCompanyId: data.userCompanyId,
      grantId: data.grantId,
      email: data.email,
      provider: data.provider,
      scopes: data.scopes,
      status: 'active',
      isPersonalDefault: shouldBePersonalDefault,
      isCompanyDefault: shouldBeCompanyDefault,
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
      isCompanyDefault: false,
      isPersonalDefault: false,
      lastErrorAt: new Date(),
      lastErrorMessage: errorMessage.slice(0, 500),
      updatedAt: new Date(),
    }).where(eq(nylasGrants.grantId, grantId));
  },

  async markRevoked(grantId: string) {
    await db.update(nylasGrants).set({
      status: 'revoked',
      isCompanyDefault: false,
      isPersonalDefault: false,
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

  async getCompanyDefaultGrant(userCompanyId: number) {
    const [row] = await db.select().from(nylasGrants).where(
      and(
        eq(nylasGrants.userCompanyId, userCompanyId),
        eq(nylasGrants.isCompanyDefault, true),
        eq(nylasGrants.status, 'active'),
      )
    ).limit(1);
    return row ?? null;
  },

  async getPersonalDefaultGrant(userId: number) {
    const [row] = await db.select().from(nylasGrants).where(
      and(
        eq(nylasGrants.userId, userId),
        eq(nylasGrants.isPersonalDefault, true),
        eq(nylasGrants.status, 'active'),
      )
    ).limit(1);
    return row ?? null;
  },

  async setCompanyDefaultGrant(grantRowId: number, userCompanyId: number) {
    await db.transaction(async (tx) => {
      await tx.update(nylasGrants).set({
        isCompanyDefault: false,
        updatedAt: new Date(),
      }).where(
        and(
          eq(nylasGrants.userCompanyId, userCompanyId),
          eq(nylasGrants.isCompanyDefault, true),
        )
      );
      await tx.update(nylasGrants).set({
        isCompanyDefault: true,
        updatedAt: new Date(),
      }).where(eq(nylasGrants.id, grantRowId));
    });
  },

  async setPersonalDefaultGrant(grantRowId: number, userId: number) {
    await db.transaction(async (tx) => {
      await tx.update(nylasGrants).set({
        isPersonalDefault: false,
        updatedAt: new Date(),
      }).where(
        and(
          eq(nylasGrants.userId, userId),
          eq(nylasGrants.isPersonalDefault, true),
        )
      );
      await tx.update(nylasGrants).set({
        isPersonalDefault: true,
        updatedAt: new Date(),
      }).where(eq(nylasGrants.id, grantRowId));
    });
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
