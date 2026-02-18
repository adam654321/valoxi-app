import bcrypt from 'bcrypt';
import { passwordResetRepository } from '../repositories/password-reset.repository';
import { usersRepository } from '../repositories/users.repository';
import { emailService as legacyEmailService } from '../email';
import { BadRequestError } from '../utils/errors';
import { db } from '../db';
import { users, userSessions } from '@shared/schema';
import { eq } from 'drizzle-orm';

class PasswordResetService {
  async requestReset(email: string, baseUrl: string): Promise<void> {
    const user = await usersRepository.getByEmail(email);
    if (!user) return;

    await passwordResetRepository.deleteUserTokens(user.id);
    const tokenRow = await passwordResetRepository.createToken(user.id);

    const resetUrl = `${baseUrl}/reset-password?token=${tokenRow.token}`;

    await (legacyEmailService as any).sendEmail({
      to: user.email,
      subject: 'Reset your password — M&A Platform',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="display: inline-block; background: #2563eb; color: white; width: 48px; height: 48px; border-radius: 12px; line-height: 48px; font-size: 24px;">⚡</div>
            <h1 style="margin: 16px 0 0; font-size: 24px; color: #111;">M&A Deal Pipeline</h1>
          </div>
          <h2 style="font-size: 20px; color: #111; margin-bottom: 16px;">Reset Your Password</h2>
          <p style="color: #555; line-height: 1.6; margin-bottom: 24px;">
            We received a request to reset your password. Click the button below to choose a new password.
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${resetUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
              Reset Password
            </a>
          </div>
          <p style="color: #888; font-size: 14px; line-height: 1.5;">
            This link will expire in <strong>1 hour</strong>. If you didn't request a password reset, you can safely ignore this email.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
          <p style="color: #aaa; font-size: 12px;">
            If the button doesn't work, copy and paste this link into your browser:<br/>
            <a href="${resetUrl}" style="color: #2563eb; word-break: break-all;">${resetUrl}</a>
          </p>
        </div>
      `,
    });
  }

  async validateToken(token: string): Promise<{ valid: boolean; userId?: number }> {
    const row = await passwordResetRepository.getValidToken(token);
    if (!row) return { valid: false };
    return { valid: true, userId: row.userId };
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const row = await passwordResetRepository.getValidToken(token);
    if (!row) {
      throw new BadRequestError('This reset link is invalid or has expired.');
    }

    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestError('Password must be at least 8 characters.');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await db.update(users).set({ passwordHash }).where(eq(users.id, row.userId));
    await passwordResetRepository.markUsed(row.id);

    try {
      await db.delete(userSessions).where(eq(userSessions.userId, row.userId));
    } catch {
    }
  }

  async adminResetPassword(userId: number, newPassword: string): Promise<void> {
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestError('Password must be at least 8 characters.');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db.update(users).set({ passwordHash }).where(eq(users.id, userId));

    try {
      await db.delete(userSessions).where(eq(userSessions.userId, userId));
    } catch {
    }
  }
}

export const passwordResetService = new PasswordResetService();
