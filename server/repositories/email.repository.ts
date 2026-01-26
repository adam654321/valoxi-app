import { eq, desc, and, sql } from 'drizzle-orm';
import { db } from '../db';
import { users, targetContacts, targetCompanies, userInvitations, portalAccessTokens } from '@shared/schema';

export interface EmailRecipient {
  email: string;
  name: string;
}

export class EmailRepository {
  async getTeamMemberEmails(userCompanyId: number): Promise<EmailRecipient[]> {
    const results = await db.select({ email: users.email, firstName: users.firstName, lastName: users.lastName })
      .from(users).where(eq(users.userCompanyId, userCompanyId));
    return results.map(u => ({ email: u.email, name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email }));
  }

  async getContactById(contactId: number): Promise<{ email: string | null; firstName: string | null; lastName: string | null; targetCompanyId: number } | undefined> {
    const [contact] = await db.select({ email: targetContacts.email, firstName: targetContacts.firstName, lastName: targetContacts.lastName, targetCompanyId: targetContacts.targetCompanyId })
      .from(targetContacts).where(eq(targetContacts.id, contactId));
    return contact || undefined;
  }

  async getTargetCompanyById(companyId: number): Promise<{ companyName: string; userCompanyId: number } | undefined> {
    const [company] = await db.select({ companyName: targetCompanies.companyName, userCompanyId: targetCompanies.userCompanyId })
      .from(targetCompanies).where(eq(targetCompanies.id, companyId));
    return company || undefined;
  }

  async getInvitationById(invitationId: number): Promise<any | undefined> {
    const [invitation] = await db.select().from(userInvitations).where(eq(userInvitations.id, invitationId));
    return invitation || undefined;
  }

  async getInvitationByToken(token: string): Promise<any | undefined> {
    const [invitation] = await db.select().from(userInvitations).where(eq(userInvitations.invitationToken, token));
    return invitation || undefined;
  }

  async getPortalTokenById(tokenId: number): Promise<any | undefined> {
    const [token] = await db.select().from(portalAccessTokens).where(eq(portalAccessTokens.id, tokenId));
    return token || undefined;
  }

  async getUserById(userId: number): Promise<{ firstName: string | null; lastName: string | null; email: string } | undefined> {
    const [user] = await db.select({ firstName: users.firstName, lastName: users.lastName, email: users.email })
      .from(users).where(eq(users.id, userId));
    return user || undefined;
  }

  async getUserCompanyName(userCompanyId: number): Promise<string | undefined> {
    const [result] = await db.select({ name: sql<string>`COALESCE((SELECT company_name FROM user_companies WHERE id = ${userCompanyId}), 'Company')` }).from(sql`(SELECT 1)`);
    return result?.name;
  }
}

export const emailRepository = new EmailRepository();
