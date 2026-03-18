import { db } from '../db';
import { userRoles, users } from '@shared/schema';
import { eq, isNull, sql } from 'drizzle-orm';

const DEFAULT_ROLES = [
  {
    roleName: 'company_admin',
    roleDescription: 'Full administrative access to all company features',
    canManageUsers: true,
    canManageCompany: true,
    canCreateDeals: true,
    canEditAllDeals: true,
    canDeleteDeals: true,
    canUploadDocuments: true,
    canCreateOffers: true,
    canViewFinancials: true,
    canAccessAnalytics: true,
    canExportData: true,
  },
  {
    roleName: 'deal_manager',
    roleDescription: 'Can manage deals and view all financial data',
    canManageUsers: true,
    canManageCompany: false,
    canCreateDeals: true,
    canEditAllDeals: true,
    canDeleteDeals: false,
    canUploadDocuments: true,
    canCreateOffers: true,
    canViewFinancials: true,
    canAccessAnalytics: true,
    canExportData: true,
  },
  {
    roleName: 'senior_analyst',
    roleDescription: 'Can create deals and view financial data',
    canManageUsers: false,
    canManageCompany: false,
    canCreateDeals: true,
    canEditAllDeals: false,
    canDeleteDeals: false,
    canUploadDocuments: true,
    canCreateOffers: false,
    canViewFinancials: true,
    canAccessAnalytics: true,
    canExportData: true,
  },
  {
    roleName: 'analyst',
    roleDescription: 'Can view financial data and upload documents',
    canManageUsers: false,
    canManageCompany: false,
    canCreateDeals: false,
    canEditAllDeals: false,
    canDeleteDeals: false,
    canUploadDocuments: true,
    canCreateOffers: false,
    canViewFinancials: true,
    canAccessAnalytics: false,
    canExportData: false,
  },
  {
    roleName: 'viewer',
    roleDescription: 'Read-only access to deals',
    canManageUsers: false,
    canManageCompany: false,
    canCreateDeals: false,
    canEditAllDeals: false,
    canDeleteDeals: false,
    canUploadDocuments: false,
    canCreateOffers: false,
    canViewFinancials: false,
    canAccessAnalytics: false,
    canExportData: false,
  },
];

export async function seedUserRoles(): Promise<void> {
  let seeded = 0;
  let updated = 0;

  for (const role of DEFAULT_ROLES) {
    const [existing] = await db
      .select({ roleName: userRoles.roleName, canViewFinancials: userRoles.canViewFinancials })
      .from(userRoles)
      .where(eq(userRoles.roleName, role.roleName));

    if (!existing) {
      await db.insert(userRoles).values(role);
      seeded++;
    } else if (existing.canViewFinancials !== role.canViewFinancials) {
      await db.update(userRoles)
        .set({ canViewFinancials: role.canViewFinancials })
        .where(eq(userRoles.roleName, role.roleName));
      updated++;
    }
  }

  if (seeded > 0 || updated > 0) {
    console.log(`[STARTUP] User roles: seeded ${seeded} new, updated ${updated} existing`);
  }

  const [nullRoleResult] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(users)
    .where(isNull(users.userRole));

  const nullCount = nullRoleResult?.count ?? 0;
  if (nullCount > 0) {
    await db.update(users)
      .set({ userRole: 'company_admin' })
      .where(isNull(users.userRole));
    console.log(`[STARTUP] Assigned company_admin role to ${nullCount} user(s) with no role`);
  }
}
