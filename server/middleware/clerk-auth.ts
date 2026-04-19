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
  console.log('[clerk-auth DEBUG] CLERK_ENABLED at runtime:', CLERK_ENABLED, 'env value:', process.env.CLERK_ENABLED);
  console.log('[clerk-auth DEBUG] authorization header present:', !!req.headers.authorization);
  console.log('[clerk-auth DEBUG] authorization header first 40 chars:', String(req.headers.authorization ?? '').slice(0, 40));

  if (!CLERK_ENABLED) {
    console.log('[clerk-auth DEBUG] CLERK_ENABLED is false, returning null');
    return null;
  }

  const auth = getAuth(req);
  console.log('[clerk-auth DEBUG] getAuth result:', JSON.stringify({
    userId: auth?.userId,
    sessionId: (auth as any)?.sessionId,
    isAuthenticated: (auth as any)?.isAuthenticated
  }));

  const clerkUserId = auth?.userId;
  if (!clerkUserId) {
    console.log('[clerk-auth DEBUG] no clerk userId, returning null');
    return null;
  }

  const [user] = await db
    .select({ id: users.id, userCompanyId: users.userCompanyId, isActive: users.isActive })
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId));

  console.log('[clerk-auth DEBUG] DB lookup for clerk id', clerkUserId, 'found:', !!user, user ? { id: user.id, isActive: user.isActive } : null);

  if (!user) return { error: 'CLERK_USER_NOT_LINKED' };
  if (!user.isActive) return { error: 'CLERK_USER_INACTIVE' };

  return { localUserId: user.id, userCompanyId: user.userCompanyId };
}
