import { eq } from 'drizzle-orm';
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
}

export const waitlistRepository = new WaitlistRepository();
