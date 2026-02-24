import type { Request, Response, NextFunction } from "express";
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import type { UserRole } from '@shared/schema';
import { rolesService } from '../services/roles.service';

export async function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const [user] = await db
      .select({ id: users.id, isActive: users.isActive })
      .from(users)
      .where(eq(users.id, req.session.userId));

    if (!user || !user.isActive) {
      req.session.destroy(() => {});
      return res.status(401).json({ message: "Unauthorized" });
    }

    next();
  } catch (error) {
    console.error('Error verifying user session:', error);
    return res.status(500).json({ message: "Internal server error during authentication" });
  }
}

export async function isSystemAdmin(req: Request, res: Response, next: NextFunction) {
  if ((req as any).isSystemAdminVerified) {
    return next();
  }

  const [user] = await db.select({ isSystemAdmin: users.isSystemAdmin }).from(users).where(eq(users.id, req.session.userId!));

  if (!user || !user.isSystemAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. System administrator privileges required.',
      code: 'FORBIDDEN',
    });
  }

  (req as any).isSystemAdminVerified = true;
  next();
}

export function requirePermission(permission: keyof UserRole) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const [user] = await db.select({ isSystemAdmin: users.isSystemAdmin }).from(users).where(eq(users.id, userId));
    if (user?.isSystemAdmin) {
      return next();
    }

    const hasPermission = await rolesService.checkPermission(userId, permission);
    if (hasPermission) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'You do not have permission to perform this action',
      code: 'FORBIDDEN',
    });
  };
}
