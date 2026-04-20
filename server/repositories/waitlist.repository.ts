import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import { waitlist, type Waitlist, type InsertWaitlist } from '@shared/schema';

export class WaitlistRepository {
  async getByEmail(email: string): Promise<Waitlist | undefined> {
    const [row] = await db.select().from(waitlist).where(eq(waitlist.email, email));
    return row || undefined;
  }

  async create(data: InsertWaitlist): Promise<Waitlist> {
    const [row] = await db.insert(waitlist).values(data).returning();
    return row;
  }

  async list(filters: { status?: string; limit?: number; offset?: number } = {}): Promise<Waitlist[]> {
    const conditions = [];
    if (filters.status) {
      conditions.push(eq(waitlist.status, filters.status));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const limit = Math.min(filters.limit ?? 50, 200);
    const offset = filters.offset ?? 0;
    return await db
      .select()
      .from(waitlist)
      .where(where)
      .orderBy(desc(waitlist.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getById(id: string): Promise<Waitlist | undefined> {
    const [row] = await db.select().from(waitlist).where(eq(waitlist.id, id));
    return row || undefined;
  }

  async updateStatus(
    id: string,
    status: 'new' | 'approved' | 'invited' | 'declined',
    adminUserId: number
  ): Promise<Waitlist | undefined> {
    if (status === 'invited') {
      throw new Error('Use markInvited to transition to invited status, not updateStatus');
    }
    const [row] = await db
      .update(waitlist)
      .set({
        status,
        statusChangedAt: new Date(),
        statusChangedBy: adminUserId,
      })
      .where(eq(waitlist.id, id))
      .returning();
    return row || undefined;
  }

  async markInvited(
    id: string,
    adminUserId: number,
    invitedUserId: number
  ): Promise<Waitlist | undefined> {
    const [row] = await db
      .update(waitlist)
      .set({
        status: 'invited',
        statusChangedAt: new Date(),
        statusChangedBy: adminUserId,
        invitedUserId,
      })
      .where(eq(waitlist.id, id))
      .returning();
    return row || undefined;
  }
}

export const waitlistRepository = new WaitlistRepository();
