import bcrypt from 'bcrypt';
import { passwordResetRepository } from '../repositories/password-reset.repository';
import { usersRepository } from '../repositories/users.repository';
import { emailService as legacyEmailService } from '../email';
import { renderBrandedEmail, type EmailBlock } from './email-template';
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

    const blocks: EmailBlock[] = [
      { type: 'paragraph', text: 'Hi,' },
      { type: 'paragraph', text: 'We received a request to reset the password for your Valoxi account. Click the button below to choose a new password.' },
      { type: 'cta', cta: { label: 'Reset password', href: resetUrl } },
      { type: 'paragraph', text: 'This link expires in <strong style="color:#FFFFFF;">1 hour</strong>. If you did not request a password reset, you can safely ignore this email.' },
    ];

    const html = renderBrandedEmail({
      preheader: 'A request was made to reset your Valoxi password.',
      eyebrow: 'Password reset',
      heading: 'Reset your Valoxi password',
      blocks,
      footerLine: 'You are receiving this because a password reset was requested for your Valoxi account.',
    });

    await (legacyEmailService as any).sendEmail({
      to: user.email,
      subject: 'Reset your password — Valoxi',
      html,
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
