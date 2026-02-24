import type { Request, Response, NextFunction } from "express";
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import type { UserRole } from '@shared/schema';
import { rolesService } from '../services/roles.service';

const PERMISSIONS_TTL_MS = 5 * 60 * 1000;

export async function refreshSessionPermissions(req: Request): Promise<void> {
  const userId = req.session.userId;
  if (!userId) return;

  try {
    const [user] = await db
      .select({ isSystemAdmin: users.isSystemAdmin })
      .from(users)
      .where(eq(users.id, userId));

    req.session.isSystemAdmin = user?.isSystemAdmin ?? false;

    const userWithPerms = await rolesService.getUserWithPermissions(userId);
    const perms = userWithPerms?.permissions;
    if (perms) {
      const permMap: Record<string, boolean | null> = {};
      for (const [key, value] of Object.entries(perms)) {
        if (typeof value === 'boolean' || value === null) {
          permMap[key] = value;
        }
      }
      req.session.permissions = permMap;
    } else {
      req.session.permissions = {};
    }

    req.session.permissionsCachedAt = Date.now();
  } catch (error) {
    console.error('Error refreshing session permissions:', error);
  }
}

function isPermissionsCacheValid(req: Request): boolean {
  const cachedAt = req.session.permissionsCachedAt;
  if (!cachedAt) return false;
  return (Date.now() - cachedAt) < PERMISSIONS_TTL_MS;
}

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
  if (!isPermissionsCacheValid(req)) {
    await refreshSessionPermissions(req);
  }

  if (!req.session.isSystemAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. System administrator privileges required.',
      code: 'FORBIDDEN',
    });
  }

  next();
}

export function requirePermission(permission: keyof UserRole) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!isPermissionsCacheValid(req)) {
      await refreshSessionPermissions(req);
    }

    if (req.session.isSystemAdmin) {
      return next();
    }

    if (req.session.permissions && req.session.permissions[permission]) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'You do not have permission to perform this action',
      code: 'FORBIDDEN',
    });
  };
}
