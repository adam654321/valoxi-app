import type { Request } from 'express';
import { getAuth } from '@clerk/express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '@shared/schema';

// Must be exactly 'true' — see CLERK_ENABLED in Replit Secrets.
const CLERK_ENABLED = process.env.CLERK_ENABLED === 'true';

declare global {
  namespace Express {
    interface Request {
      clerkAuthenticated?: boolean;
    }
  }
}

export type ClerkAuthResult =
  | null
  | { localUserId: number; userCompanyId: number | null }
  | { error: 'CLERK_USER_NOT_LINKED' | 'CLERK_USER_INACTIVE' };

export async function tryClerkAuth(req: Request): Promise<ClerkAuthResult> {
  if (!CLERK_ENABLED) return null;

  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) return null;

  const [user] = await db
    .select({ id: users.id, userCompanyId: users.userCompanyId, isActive: users.isActive })
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId));

  if (!user) return { error: 'CLERK_USER_NOT_LINKED' };
  if (!user.isActive) return { error: 'CLERK_USER_INACTIVE' };

  return { localUserId: user.id, userCompanyId: user.userCompanyId };
}
