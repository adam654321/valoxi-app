import type { Request, Response, NextFunction } from "express";
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import type { UserRole } from '@shared/schema';
import { rolesService } from '../services/roles.service';

const PERMISSIONS_TTL_MS = 5 * 60 * 1000;

// Default permissions granted to any authenticated user with role='user' and active subscription.
// The subscription gate (requireActiveSubscription) is enforced separately upstream.
const USER_ROLE_PERMISSIONS: Record<string, boolean> = {
  canViewFinancials: true,
  canUploadDocuments: true,
  canCreateDeals: true,
  canEditAllDeals: false,
  canDeleteDeals: false,
  canCreateOffers: false,
  canManageUsers: false,
  canManageCompany: false,
  canAccessAnalytics: true,
  canExportData: true,
};

const ADMIN_ROLE_PERMISSIONS: Record<string, boolean> = {
  canViewFinancials: true,
  canUploadDocuments: true,
  canCreateDeals: true,
  canEditAllDeals: true,
  canDeleteDeals: true,
  canCreateOffers: true,
  canManageUsers: true,
  canManageCompany: true,
  canAccessAnalytics: true,
  canExportData: true,
};

export function blockWritesInViewAsMode(req: Request, res: Response, next: NextFunction) {
  if (req.session.adminViewingAsUserId && req.method !== 'GET') {
    return res.status(403).json({
      success: false,
      message: 'Write operations are disabled while viewing as another user.',
    });
  }
  next();
}

export function injectViewAsIdentity(req: Request, _res: Response, next: NextFunction) {
  if (!req.session.adminViewingAsUserId) return next();

  // Snapshot ALL identity and permission fields from the real admin session.
  // We restore them via session.save wrapping so the session store always
  // persists the real admin's values — the swap is request-scoped only.
  const snapshot = {
    userId: req.session.userId,
    userCompanyId: req.session.userCompanyId,
    isSystemAdmin: req.session.isSystemAdmin,
    permissions: req.session.permissions,
    permissionsCachedAt: req.session.permissionsCachedAt,
  };

  // Inject viewed user identity for this request.
  req.session.userId = req.session.adminViewingAsUserId;
  req.session.userCompanyId = req.session.adminViewingAsCompanyId;
  // Clear admin privileges so the viewed user's permissions are fetched fresh.
  req.session.isSystemAdmin = false;
  req.session.permissions = undefined;
  req.session.permissionsCachedAt = undefined;

  // Wrap session.save so that the real admin values are restored before any
  // write to the session store. express-session calls session.save() when
  // the response ends, so this runs before the session is persisted.
  type SaveCallback = Parameters<typeof req.session.save>[0];
  const origSave: typeof req.session.save = req.session.save.bind(req.session);
  req.session.save = function (callback?: SaveCallback) {
    req.session.userId = snapshot.userId;
    req.session.userCompanyId = snapshot.userCompanyId;
    req.session.isSystemAdmin = snapshot.isSystemAdmin;
    req.session.permissions = snapshot.permissions;
    req.session.permissionsCachedAt = snapshot.permissionsCachedAt;
    return origSave(callback);
  };

  next();
}

export async function refreshSessionPermissions(req: Request): Promise<void> {
  const userId = req.session.userId;
  if (!userId) return;

  try {
    const [user] = await db
      .select({ isSystemAdmin: users.isSystemAdmin, role: users.role })
      .from(users)
      .where(eq(users.id, userId));

    req.session.isSystemAdmin = user?.isSystemAdmin ?? false;

    const userWithPerms = await rolesService.getUserWithPermissions(userId);
    const perms = userWithPerms?.permissions;
    if (perms) {
      // user_role matched an RBAC entry — use those permissions
      const permMap: Record<string, boolean | null> = {};
      for (const [key, value] of Object.entries(perms)) {
        if (typeof value === 'boolean' || value === null) {
          permMap[key] = value;
        }
      }
      req.session.permissions = permMap;
    } else {
      // user_role is a job title (e.g. "MD", "Broker") with no RBAC entry —
      // fall back to permissions derived from the system `role` column.
      if (user?.role === 'admin') {
        req.session.permissions = { ...ADMIN_ROLE_PERMISSIONS };
      } else {
        req.session.permissions = { ...USER_ROLE_PERMISSIONS };
      }
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
