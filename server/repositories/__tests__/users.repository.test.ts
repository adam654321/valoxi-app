import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { usersRepository } from '../users.repository';
import { db } from '../../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

describe('UsersRepository', () => {
  const testEmail = `test-${Date.now()}@example.com`;
  let createdUserId: number | null = null;

  afterAll(async () => {
    if (createdUserId) {
      await db.delete(users).where(eq(users.id, createdUserId));
    }
  });

  describe('getById', () => {
    it('should return undefined for non-existent user', async () => {
      const result = await usersRepository.getById(999999);
      expect(result).toBeUndefined();
    });

    it('should return user when found by id', async () => {
      const newUser = await usersRepository.create({
        email: testEmail,
        passwordHash: 'hashed_password_123',
        firstName: 'Test',
        lastName: 'User',
        role: 'user',
      });
      createdUserId = newUser.id;

      const result = await usersRepository.getById(newUser.id);
      expect(result).toBeDefined();
      expect(result?.id).toBe(newUser.id);
      expect(result?.email).toBe(testEmail);
      expect(result?.firstName).toBe('Test');
      expect(result?.lastName).toBe('User');
    });
  });

  describe('getByEmail', () => {
    it('should return undefined for non-existent email', async () => {
      const result = await usersRepository.getByEmail('nonexistent@example.com');
      expect(result).toBeUndefined();
    });

    it('should return user when found by email', async () => {
      const result = await usersRepository.getByEmail(testEmail);
      expect(result).toBeDefined();
      expect(result?.email).toBe(testEmail);
      expect(result?.id).toBe(createdUserId);
    });

    it('should be case-sensitive for email lookup', async () => {
      const result = await usersRepository.getByEmail(testEmail.toUpperCase());
      expect(result).toBeUndefined();
    });
  });

  describe('create', () => {
    it('should create a new user with required fields', async () => {
      const uniqueEmail = `create-test-${Date.now()}@example.com`;
      const newUser = await usersRepository.create({
        email: uniqueEmail,
        passwordHash: 'test_hash',
        firstName: 'New',
        lastName: 'User',
        role: 'user',
      });

      expect(newUser).toBeDefined();
      expect(newUser.id).toBeGreaterThan(0);
      expect(newUser.email).toBe(uniqueEmail);
      expect(newUser.firstName).toBe('New');
      expect(newUser.lastName).toBe('User');

      await db.delete(users).where(eq(users.id, newUser.id));
    });
  });

  describe('update', () => {
    it('should update user fields', async () => {
      if (!createdUserId) return;

      const updated = await usersRepository.update(createdUserId, {
        firstName: 'Updated',
        lastName: 'Name',
      });

      expect(updated).toBeDefined();
      expect(updated?.firstName).toBe('Updated');
      expect(updated?.lastName).toBe('Name');
    });

    it('should return undefined for non-existent user', async () => {
      const result = await usersRepository.update(999999, { firstName: 'Test' });
      expect(result).toBeUndefined();
    });
  });
});
