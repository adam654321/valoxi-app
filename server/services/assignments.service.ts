import { assignmentsRepository, type DealAssignmentWithUser } from '../repositories/assignments.repository';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/errors';
import type { UserDealAssignment, InsertUserDealAssignment } from '@shared/schema';

interface UserWithPermissions {
  permissions?: { canManageUsers?: boolean | null };
  isCompanyAdmin?: boolean | null;
}

export class AssignmentsService {
  async assignToDeal(
    targetCompanyId: number, assigneeUserId: number, assignedByUserId: number, userCompanyId: number,
    role: string = 'analyst', canEditCompany = true, canUploadDocuments = true, canCreateActivities = true, canManageContacts = true,
    getUserWithPermissions?: (id: number) => Promise<UserWithPermissions | undefined>
  ): Promise<UserDealAssignment> {
    if (getUserWithPermissions) {
      const perms = await getUserWithPermissions(assignedByUserId);
      if (!perms?.permissions?.canManageUsers && !perms?.isCompanyAdmin) {
        throw new ForbiddenError('Insufficient permissions');
      }
    }
    return await assignmentsRepository.createAssignment({
      userId: assigneeUserId, targetCompanyId, assignedBy: assignedByUserId, assignmentRole: role,
      canEditCompany, canUploadDocuments, canCreateActivities, canManageContacts, isActive: true,
    });
  }

  async getByDeal(targetCompanyId: number): Promise<DealAssignmentWithUser[]> {
    return await assignmentsRepository.getByDeal(targetCompanyId);
  }

  async getByUser(userId: number): Promise<UserDealAssignment[]> {
    return await assignmentsRepository.getByUser(userId);
  }

  async removeFromDeal(
    targetCompanyId: number, assigneeUserId: number, requestUserId: number,
    getUserWithPermissions?: (id: number) => Promise<UserWithPermissions | undefined>
  ): Promise<void> {
    if (getUserWithPermissions) {
      const perms = await getUserWithPermissions(requestUserId);
      if (!perms?.permissions?.canManageUsers && !perms?.isCompanyAdmin) {
        throw new ForbiddenError('Insufficient permissions');
      }
    }
    const removed = await assignmentsRepository.remove(assigneeUserId, targetCompanyId);
    if (!removed) throw new NotFoundError('Assignment not found');
  }

  async updatePermissions(
    targetCompanyId: number, assigneeUserId: number, requestUserId: number,
    role?: string, canEditCompany?: boolean, canUploadDocuments?: boolean, canCreateActivities?: boolean, canManageContacts?: boolean,
    getUserWithPermissions?: (id: number) => Promise<UserWithPermissions | undefined>
  ): Promise<UserDealAssignment> {
    if (getUserWithPermissions) {
      const perms = await getUserWithPermissions(requestUserId);
      if (!perms?.permissions?.canManageUsers && !perms?.isCompanyAdmin) {
        throw new ForbiddenError('Insufficient permissions');
      }
    }
    const updated = await assignmentsRepository.update(assigneeUserId, targetCompanyId, {
      assignmentRole: role, canEditCompany, canUploadDocuments, canCreateActivities, canManageContacts,
    });
    if (!updated) throw new NotFoundError('Assignment not found');
    return updated;
  }
}

export const assignmentsService = new AssignmentsService();
