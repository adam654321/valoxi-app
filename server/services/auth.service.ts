import bcrypt from 'bcrypt';
import { usersRepository } from '../repositories/users.repository';
import { BadRequestError, NotFoundError, UnauthorizedError } from '../utils/errors';
import type { User, UserCompany, InsertUser, InsertUserCompany } from '@shared/schema';

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  companyName: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthResult {
  user: {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
    isSystemAdmin?: boolean;
    onboardingCompleted?: boolean;
  };
  company: UserCompany | null;
}

export class AuthService {
  private readonly SALT_ROUNDS = 10;

  async register(data: RegisterData): Promise<AuthResult> {
    const existingUser = await usersRepository.getByEmail(data.email);
    if (existingUser) {
      throw new BadRequestError('User already exists with this email');
    }

    const hashedPassword = await bcrypt.hash(data.password, this.SALT_ROUNDS);

    const userCompany = await usersRepository.createUserCompany({
      companyName: data.companyName,
    });

    const user = await usersRepository.create({
      email: data.email,
      passwordHash: hashedPassword,
      firstName: data.firstName,
      lastName: data.lastName,
      userCompanyId: userCompany.id,
      role: 'user',
      isCompanyAdmin: true,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      company: userCompany,
    };
  }

  async login(data: LoginData): Promise<AuthResult> {
    const user = await usersRepository.getByEmail(data.email);
    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const isValidPassword = await bcrypt.compare(data.password, user.passwordHash);
    if (!isValidPassword) {
      throw new UnauthorizedError('Invalid credentials');
    }

    let userCompany = user.userCompanyId 
      ? await usersRepository.getUserCompany(user.userCompanyId)
      : null;

    if (!userCompany) {
      const memberships = await usersRepository.getUserCompanies(user.id);
      const activeMembership = memberships.find((m: any) => m.isActive);
      if (activeMembership) {
        userCompany = await usersRepository.getUserCompany(activeMembership.userCompanyId) ?? null;
        if (userCompany) {
          await usersRepository.update(user.id, { userCompanyId: userCompany.id });
        }
      }
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      company: userCompany || null,
    };
  }

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
        betaNdaSigned: user.betaNdaSigned ?? false,
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
