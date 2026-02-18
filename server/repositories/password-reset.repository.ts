import { randomBytes } from 'crypto';
import { db } from '../db';
import { passwordResetTokens } from '@shared/schema';
import { eq, lt, and, isNull } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

class PasswordResetRepository {
  async createToken(userId: number) {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    const [row] = await db.insert(passwordResetTokens).values({
      userId,
      token,
      expiresAt,
    }).returning();
    return row;
  }

  async getValidToken(token: string) {
    const [row] = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.token, token),
          isNull(passwordResetTokens.usedAt),
          sql`${passwordResetTokens.expiresAt} > now()`
        )
      );
    return row || undefined;
  }

  async markUsed(id: number) {
    await db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, id));
  }

  async deleteExpiredTokens() {
    await db
      .delete(passwordResetTokens)
      .where(lt(passwordResetTokens.expiresAt, new Date()));
  }

  async deleteUserTokens(userId: number) {
    await db
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, userId));
  }
}

export const passwordResetRepository = new PasswordResetRepository();
