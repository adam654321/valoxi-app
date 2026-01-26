import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  userRoles,
  users,
  userDealAssignments,
  type UserRole,
  type User,
} from '@shared/schema';

export interface UserWithPermissions {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  userCompanyId: number | null;
  role: string | null;
  userRole: string | null;
  isCompanyAdmin: boolean | null;
  lastLogin: Date | null;
  isActive: boolean | null;
  emailVerified: boolean | null;
  createdAt: Date | null;
  roleDescription?: string;
  assignedDealsCount?: number;
  permissions?: UserRole;
}

export class RolesRepository {
  async getUserRoles(): Promise<UserRole[]> {
    return await db.select().from(userRoles).orderBy(userRoles.roleName);
  }

  async getUserRole(roleName: string): Promise<UserRole | undefined> {
    const [role] = await db
      .select()
      .from(userRoles)
      .where(eq(userRoles.roleName, roleName));
    return role || undefined;
  }

  async getUserWithPermissions(userId: number): Promise<UserWithPermissions | undefined> {
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        userCompanyId: users.userCompanyId,
        role: users.role,
        userRole: users.userRole,
        isCompanyAdmin: users.isCompanyAdmin,
        lastLogin: users.lastLogin,
        isActive: users.isActive,
        emailVerified: users.emailVerified,
        createdAt: users.createdAt,
        roleDescription: userRoles.roleDescription,
        assignedDealsCount: sql<number>`COALESCE((
          SELECT COUNT(*)::int 
          FROM ${userDealAssignments} 
          WHERE ${userDealAssignments.userId} = ${users.id} 
          AND ${userDealAssignments.isActive} = true
        ), 0)`,
        permissions: {
          id: userRoles.id,
          roleName: userRoles.roleName,
          roleDescription: userRoles.roleDescription,
          canManageUsers: userRoles.canManageUsers,
          canManageCompany: userRoles.canManageCompany,
          canCreateDeals: userRoles.canCreateDeals,
          canEditAllDeals: userRoles.canEditAllDeals,
          canDeleteDeals: userRoles.canDeleteDeals,
          canUploadDocuments: userRoles.canUploadDocuments,
          canCreateOffers: userRoles.canCreateOffers,
          canViewFinancials: userRoles.canViewFinancials,
          canAccessAnalytics: userRoles.canAccessAnalytics,
          canExportData: userRoles.canExportData,
          createdAt: userRoles.createdAt,
        },
      })
      .from(users)
      .leftJoin(userRoles, eq(users.userRole, userRoles.roleName))
      .where(and(eq(users.id, userId), eq(users.isActive, true)));

    if (!user) return undefined;

    return {
      ...user,
      roleDescription: user.roleDescription ?? undefined,
      permissions: user.permissions?.id ? user.permissions as UserRole : undefined,
    };
  }

  async updateUserRole(userId: number, role: string, userCompanyId: number): Promise<User | undefined> {
    const [updated] = await db
      .update(users)
      .set({ userRole: role })
      .where(and(eq(users.id, userId), eq(users.userCompanyId, userCompanyId)))
      .returning();
    return updated;
  }
}

export const rolesRepository = new RolesRepository();
