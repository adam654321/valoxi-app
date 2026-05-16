import { usersRepository } from '../repositories/users.repository';
import { NotFoundError } from '../utils/errors';
import type { User, UserCompany } from '@shared/schema';

export interface AuthResult {
  user: {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
    isSystemAdmin?: boolean;
    onboardingCompleted?: boolean;
    checklistCompleted?: boolean;
  };
  company: UserCompany | null;
}

export class AuthService {
  async getCurrentUser(userId: number): Promise<AuthResult> {
    const user = await usersRepository.getById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const userCompany = user.userCompanyId 
      ? await usersRepository.getUserCompany(user.userCompanyId)
      : null;

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isSystemAdmin: user.isSystemAdmin ?? false,
        onboardingCompleted: user.onboardingCompleted ?? false,
        checklistCompleted: user.checklistCompleted ?? false,
      },
      company: userCompany || null,
    };
  }

  async getUserById(userId: number): Promise<User> {
    const user = await usersRepository.getById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return user;
  }

  async getUserCompany(companyId: number): Promise<UserCompany | undefined> {
    return await usersRepository.getUserCompany(companyId);
  }
}

export const authService = new AuthService();
