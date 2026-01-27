import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { teamRepository, type InvitationWithDetails, type TeamMember } from '../repositories/team.repository';
import { BadRequestError, NotFoundError, ForbiddenError, UnauthorizedError } from '../utils/errors';
import { emailApiService } from './email.service';
import type { UserInvitation, UserRole, User } from '@shared/schema';

interface UserWithPermissions {
  permissions?: { canManageUsers?: boolean | null };
  isCompanyAdmin?: boolean | null;
}

export class TeamService {
  async createInvitation(
    userId: number, userCompanyId: number, email: string, role: string, message?: string, ipAddress?: string,
    getUserWithPermissions?: (id: number) => Promise<UserWithPermissions | undefined>,
    baseUrl?: string
  ): Promise<UserInvitation & { inviteUrl?: string }> {
    if (getUserWithPermissions) {
      const userPerms = await getUserWithPermissions(userId);
      if (!userPerms?.permissions?.canManageUsers && !userPerms?.isCompanyAdmin) {
        throw new ForbiddenError('Insufficient permissions to invite users');
      }
    }
    const existingUser = await teamRepository.getUserByEmail(email);
    if (existingUser && existingUser.userCompanyId === userCompanyId) {
      throw new BadRequestError('User already exists in your company');
    }
    const existingInvitations = await teamRepository.getInvitationsByCompany(userCompanyId);
    if (existingInvitations.find(inv => inv.email === email && inv.invitationStatus === 'pending')) {
      throw new BadRequestError('Invitation already sent to this email address');
    }
    const invitationToken = randomUUID();
    const invitation = await teamRepository.createInvitation({
      userCompanyId, email: email.toLowerCase(), invitedBy: userId, invitationToken,
      invitedRole: role, invitationMessage: message || '', invitationStatus: 'pending', ipAddressSent: ipAddress,
    });
    
    // Send invitation email asynchronously (don't block invitation creation)
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

  async acceptInvitation(token: string, firstName: string, lastName: string, password: string): Promise<User> {
    const invitation = await teamRepository.getInvitationByToken(token);
    if (!invitation || invitation.invitationStatus !== 'pending') {
      throw new BadRequestError('Invalid or expired invitation');
    }
    const existingUser = await teamRepository.getUserByEmail(invitation.email);
    if (existingUser) {
      throw new BadRequestError('An account with this email already exists');
    }
    const user = await teamRepository.acceptInvitation(token, {
      firstName, lastName, passwordHash: await bcrypt.hash(password, 10), isActive: true, emailVerified: true,
    });
    if (!user) throw new BadRequestError('Failed to accept invitation');
    return user;
  }

  async updateInvitation(id: number, userId: number, userCompanyId: number, status: string, getUserWithPermissions?: (id: number) => Promise<UserWithPermissions | undefined>): Promise<UserInvitation> {
    if (getUserWithPermissions) {
      const userPerms = await getUserWithPermissions(userId);
      if (!userPerms?.permissions?.canManageUsers && !userPerms?.isCompanyAdmin) {
        throw new ForbiddenError('Insufficient permissions');
      }
    }
    const updated = await teamRepository.updateInvitation(id, { invitationStatus: status });
    if (!updated) throw new NotFoundError('Invitation not found');
    return updated;
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
