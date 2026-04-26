import { randomUUID } from 'crypto';
import { teamRepository, type InvitationWithDetails, type TeamMember } from '../repositories/team.repository';
import { BadRequestError, NotFoundError, ForbiddenError, UnauthorizedError } from '../utils/errors';
import { emailApiService } from './email.service';
import { billingService } from './billing.service';
import { getMaxSeats, hasFeature } from '@shared/entitlements';
import type { PlanKey } from '@shared/schema/billing';
import type { UserInvitation, UserRole, User } from '@shared/schema';

interface UserWithPermissions {
  permissions?: { canManageUsers?: boolean | null };
  isCompanyAdmin?: boolean | null;
}

export class TeamService {
  async createInvitation(params: {
    inviterUserId: number;
    userCompanyId: number;
    email: string;
    firstName: string;
    lastName: string;
    jobTitle?: string;
    role: string;
    message?: string;
    ipAddress?: string;
    getUserWithPermissions?: (id: number) => Promise<UserWithPermissions | undefined>;
    baseUrl?: string;
  }): Promise<UserInvitation & { inviteUrl?: string }> {
    const {
      inviterUserId, userCompanyId, email, firstName, lastName, jobTitle,
      role, message, ipAddress, getUserWithPermissions, baseUrl
    } = params;

    if (getUserWithPermissions) {
      const userPerms = await getUserWithPermissions(inviterUserId);
      if (!userPerms?.permissions?.canManageUsers && !userPerms?.isCompanyAdmin) {
        throw new ForbiddenError('Insufficient permissions to invite users');
      }
    }

    // Cross-company email guard: users.email is UNIQUE, so an email already
    // present in any users row blocks creation here (not just same-company).
    // The legacy check only blocked same-company; the pre-create needs a
    // hard guard because the users row INSERT inside the transaction will
    // hit the unique constraint otherwise.
    const existingUser = await teamRepository.getUserByEmail(email);
    if (existingUser) {
      if (existingUser.userCompanyId === userCompanyId) {
        throw new BadRequestError('User already exists in your company');
      }
      throw new BadRequestError('A user with this email already exists');
    }

    const existingInvitations = await teamRepository.getInvitationsByCompany(userCompanyId);
    if (existingInvitations.find(inv => inv.email === email && inv.invitationStatus === 'pending')) {
      throw new BadRequestError('Invitation already sent to this email address');
    }

    const subscription = await billingService.getSubscription(userCompanyId);
    if (subscription) {
      const planKey = subscription.planKey as PlanKey;
      const effectiveMaxSeats = getMaxSeats(planKey, subscription.additionalSeats, subscription.enterpriseOverrides as Record<string, unknown> | null);

      if (effectiveMaxSeats !== null) {
        const { db } = await import('../db');
        const { users } = await import('@shared/schema/core');
        const { eq, or, and, sql: sqlTag } = await import('drizzle-orm');
        const activeUsers = await db.select({ count: sqlTag<number>`count(*)::int` })
          .from(users)
          .where(and(
            or(eq(users.userCompanyId, userCompanyId), eq(users.currentCompanyId, userCompanyId)),
            eq(users.isActive, true)
          ));
        // Seat-count fix for #100: pre-created invitee shells are now in
        // activeUsers (isActive=true with userCompanyId set at invite time).
        // Dropping pendingInvitations from the sum to prevent double-counting.
        const consumedSeats = activeUsers[0]?.count ?? 0;

        if (consumedSeats >= effectiveMaxSeats) {
          const canPurchaseMore = hasFeature(planKey, 'additionalSeatPurchasing');
          const error = new ForbiddenError('Seat limit reached');
          (error as any).seatLimitData = {
            error: 'seat_limit_reached',
            currentSeats: consumedSeats,
            maxSeats: effectiveMaxSeats,
            canPurchaseMore,
          };
          throw error;
        }
      }
    }

    const invitationToken = randomUUID();
    const invitation = await teamRepository.createInvitationWithUserShell({
      userCompanyId,
      email,
      firstName,
      lastName,
      jobTitle,
      invitedBy: inviterUserId,
      invitationToken,
      invitedRole: role,
      invitationMessage: message || '',
      ipAddressSent: ipAddress,
    });

    if (baseUrl) {
      emailApiService.sendTeamInvitation(invitation.id, baseUrl).catch(err => {
        console.error(`[TEAM] Failed to send invitation email for invitation ${invitation.id}:`, err.message);
      });
    }

    return invitation;
  }

  async getInvitationByToken(token: string): Promise<InvitationWithDetails> {
    if (!token) throw new BadRequestError('Token is required');
    const invitation = await teamRepository.getInvitationByToken(token);
    if (!invitation) throw new NotFoundError('Invitation not found or expired');
    return invitation;
  }

  async getInvitationsByCompany(userId: number, userCompanyId: number, getUserWithPermissions?: (id: number) => Promise<UserWithPermissions | undefined>): Promise<InvitationWithDetails[]> {
    if (getUserWithPermissions) {
      const userPerms = await getUserWithPermissions(userId);
      if (!userPerms?.permissions?.canManageUsers && !userPerms?.isCompanyAdmin) {
        throw new ForbiddenError('Insufficient permissions');
      }
    }
    return await teamRepository.getInvitationsByCompany(userCompanyId);
  }

  async resendInvitation(
    invitationId: number,
    userId: number,
    userCompanyId: number,
    baseUrl: string,
    getUserWithPermissions?: (id: number) => Promise<UserWithPermissions | undefined>
  ): Promise<UserInvitation> {
    if (getUserWithPermissions) {
      const userPerms = await getUserWithPermissions(userId);
      if (!userPerms?.permissions?.canManageUsers && !userPerms?.isCompanyAdmin) {
        throw new ForbiddenError('Insufficient permissions');
      }
    }
    const existing = await teamRepository.getInvitationByIdAndCompany(invitationId, userCompanyId);
    if (!existing) throw new NotFoundError('Invitation not found');
    if (existing.invitationStatus !== 'pending') {
      throw new BadRequestError('Only pending invitations can be resent');
    }
    const newToken = randomUUID();
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const updated = await teamRepository.updateInvitation(invitationId, {
      invitationToken: newToken,
      expiresAt: newExpiresAt,
    });
    if (!updated) throw new NotFoundError('Invitation not found');
    emailApiService.sendTeamInvitation(invitationId, baseUrl).catch(err => {
      console.error(`[TEAM] Failed to re-send invitation email for invitation ${invitationId}:`, err.message);
    });
    return updated;
  }

  async cancelInvitation(
    invitationId: number,
    userId: number,
    userCompanyId: number,
    getUserWithPermissions?: (id: number) => Promise<UserWithPermissions | undefined>
  ): Promise<UserInvitation> {
    if (getUserWithPermissions) {
      const userPerms = await getUserWithPermissions(userId);
      if (!userPerms?.permissions?.canManageUsers && !userPerms?.isCompanyAdmin) {
        throw new ForbiddenError('Insufficient permissions');
      }
    }
    const existing = await teamRepository.getInvitationByIdAndCompany(invitationId, userCompanyId);
    if (!existing) throw new NotFoundError('Invitation not found');
    const cancelled = await teamRepository.cancelInvitationAndDeleteShell(
      invitationId, userCompanyId, existing.email
    );
    if (!cancelled) throw new NotFoundError('Invitation not found');
    return cancelled;
  }

  async getTeamMembers(userCompanyId: number): Promise<TeamMember[]> {
    return await teamRepository.getTeamMembers(userCompanyId);
  }

  async updateTeamMember(memberId: number, userId: number, userCompanyId: number, role?: string, status?: string, getUserWithPermissions?: (id: number) => Promise<UserWithPermissions | undefined>): Promise<void> {
    if (getUserWithPermissions) {
      const userPerms = await getUserWithPermissions(userId);
      if (!userPerms?.permissions?.canManageUsers && !userPerms?.isCompanyAdmin) {
        throw new ForbiddenError('Insufficient permissions');
      }
    }
    if (role) {
      const updated = await teamRepository.updateUserRole(memberId, role, userCompanyId);
      if (!updated) throw new NotFoundError('Team member not found');
    }
    if (status === 'inactive') {
      const deactivated = await teamRepository.deactivateUser(memberId, userCompanyId);
      if (!deactivated) throw new NotFoundError('Team member not found');
    }
  }

  async removeTeamMember(memberId: number, userId: number, userCompanyId: number, getUserWithPermissions?: (id: number) => Promise<UserWithPermissions | undefined>): Promise<void> {
    if (getUserWithPermissions) {
      const userPerms = await getUserWithPermissions(userId);
      if (!userPerms?.isCompanyAdmin) throw new ForbiddenError('Only company admins can remove team members');
    }
    if (memberId === userId) throw new BadRequestError('Cannot remove yourself');
    const deactivated = await teamRepository.deactivateUser(memberId, userCompanyId);
    if (!deactivated) throw new NotFoundError('Team member not found');
  }

  async getRoles(): Promise<UserRole[]> {
    return await teamRepository.getRoles();
  }

  async getUser(id: number): Promise<User | undefined> {
    return await teamRepository.getUser(id);
  }

  async getUserCompany(id: number) {
    return await teamRepository.getUserCompany(id);
  }
}

export const teamService = new TeamService();
