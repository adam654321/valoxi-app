import { rolesRepository, type UserWithPermissions } from '../repositories/roles.repository';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/errors';
import type { UserRole, User } from '@shared/schema';

export class RolesService {
  async getUserRoles(): Promise<UserRole[]> {
    return await rolesRepository.getUserRoles();
  }

  async getUserRole(roleName: string): Promise<UserRole> {
    if (!roleName) {
      throw new BadRequestError('Role name is required');
    }

    const role = await rolesRepository.getUserRole(roleName);
    if (!role) {
      throw new NotFoundError(`Role "${roleName}" not found`);
    }

    return role;
  }

  async getUserWithPermissions(userId: number): Promise<UserWithPermissions> {
    if (!userId || isNaN(userId)) {
      throw new BadRequestError('Invalid user ID');
    }

    const user = await rolesRepository.getUserWithPermissions(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    return user;
  }

  async updateUserRole(
    userId: number,
    role: string,
    userCompanyId: number,
    requestingUserId: number
  ): Promise<User> {
    if (!userId || isNaN(userId)) {
      throw new BadRequestError('Invalid user ID');
    }

    if (!role) {
      throw new BadRequestError('Role is required');
    }

    const requestingUser = await rolesRepository.getUserWithPermissions(requestingUserId);
    if (!requestingUser?.permissions?.canManageUsers && !requestingUser?.isCompanyAdmin) {
      throw new ForbiddenError('Insufficient permissions to manage user roles');
    }

    const roleExists = await rolesRepository.getUserRole(role);
    if (!roleExists) {
      throw new BadRequestError(`Role "${role}" does not exist`);
    }

    const updatedUser = await rolesRepository.updateUserRole(userId, role, userCompanyId);
    if (!updatedUser) {
      throw new NotFoundError('User not found or access denied');
    }

    return updatedUser;
  }

  async checkPermission(userId: number, permission: keyof UserRole): Promise<boolean> {
    const user = await rolesRepository.getUserWithPermissions(userId);
    if (!user) return false;

    if (user.isCompanyAdmin) return true;

    if (!user.permissions) return false;

    return Boolean(user.permissions[permission]);
  }
}

export const rolesService = new RolesService();
