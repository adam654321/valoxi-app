import { eq, and, desc, asc, sql, inArray } from 'drizzle-orm';
import { db } from '../db';
import {
  targetContacts,
  targetCompanies,
  portalAccessTokens,
  externalDocumentSubmissions,
  portalDocumentRequirements,
  portalActivityLog,
  portalLinkShares,
  type TargetContact,
  type InsertTargetContact,
} from '@shared/schema';

export interface ContactWithCompany {
  id: number;
  targetCompanyId: number;
  firstName: string;
  lastName: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean | null;
  notes: string | null;
  createdAt: Date | null;
  company: {
    id: number;
    companyName: string;
    industry: string | null;
  };
}

export class ContactsRepository {
  async getContactsForTargetCompany(targetCompanyId: number): Promise<TargetContact[]> {
    return await db
      .select()
      .from(targetContacts)
      .where(eq(targetContacts.targetCompanyId, targetCompanyId))
      .orderBy(desc(targetContacts.isPrimary), asc(targetContacts.lastName));
  }

  async getTargetContact(contactId: number, userCompanyId: number): Promise<TargetContact | undefined> {
    const [existingContact] = await db
      .select()
      .from(targetContacts)
      .innerJoin(targetCompanies, eq(targetContacts.targetCompanyId, targetCompanies.id))
      .where(and(eq(targetContacts.id, contactId), eq(targetCompanies.userCompanyId, userCompanyId)));

    if (!existingContact) {
      return undefined;
    }

    return existingContact.target_contacts;
  }

  async createTargetContact(insertContact: InsertTargetContact): Promise<TargetContact> {
    if (insertContact.isPrimary) {
      await db
        .update(targetContacts)
        .set({ isPrimary: false })
        .where(eq(targetContacts.targetCompanyId, insertContact.targetCompanyId));
    }

    const [contact] = await db
      .insert(targetContacts)
      .values(insertContact)
      .returning();
    return contact;
  }

  async updateTargetContact(
    id: number,
    updateData: Partial<InsertTargetContact>,
    userCompanyId: number
  ): Promise<TargetContact | undefined> {
    const [existingContact] = await db
      .select()
      .from(targetContacts)
      .innerJoin(targetCompanies, eq(targetContacts.targetCompanyId, targetCompanies.id))
      .where(and(eq(targetContacts.id, id), eq(targetCompanies.userCompanyId, userCompanyId)));

    if (!existingContact) {
      return undefined;
    }

    if (updateData.isPrimary) {
      await db
        .update(targetContacts)
        .set({ isPrimary: false })
        .where(eq(targetContacts.targetCompanyId, existingContact.target_contacts.targetCompanyId));
    }

    const [contact] = await db
      .update(targetContacts)
      .set(updateData)
      .where(eq(targetContacts.id, id))
      .returning();
    return contact || undefined;
  }

  async deleteTargetContact(id: number, userCompanyId: number): Promise<boolean> {
    const [existingContact] = await db
      .select()
      .from(targetContacts)
      .innerJoin(targetCompanies, eq(targetContacts.targetCompanyId, targetCompanies.id))
      .where(and(eq(targetContacts.id, id), eq(targetCompanies.userCompanyId, userCompanyId)));

    if (!existingContact) {
      return false;
    }

    // Get portal token IDs for this contact
    const tokens = await db
      .select({ id: portalAccessTokens.id })
      .from(portalAccessTokens)
      .where(eq(portalAccessTokens.targetContactId, id));
    
    const tokenIds = tokens.map(t => t.id);

    if (tokenIds.length > 0) {
      // Delete child records that reference portal tokens first
      await db.delete(portalLinkShares).where(inArray(portalLinkShares.portalTokenId, tokenIds));
      await db.delete(portalActivityLog).where(inArray(portalActivityLog.portalTokenId, tokenIds));
      await db.delete(portalDocumentRequirements).where(inArray(portalDocumentRequirements.portalTokenId, tokenIds));
      await db.delete(externalDocumentSubmissions).where(inArray(externalDocumentSubmissions.portalTokenId, tokenIds));
      
      // Now delete the portal access tokens
      await db.delete(portalAccessTokens).where(inArray(portalAccessTokens.id, tokenIds));
    }

    // Delete records that directly reference the contact (not via tokens)
    await db.delete(portalActivityLog).where(eq(portalActivityLog.targetContactId, id));
    await db.delete(externalDocumentSubmissions).where(eq(externalDocumentSubmissions.targetContactId, id));

    const result = await db
      .delete(targetContacts)
      .where(eq(targetContacts.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getAllContactsForUserCompany(userCompanyId: number): Promise<ContactWithCompany[]> {
    const contacts = await db
      .select({
        id: targetContacts.id,
        targetCompanyId: targetContacts.targetCompanyId,
        firstName: targetContacts.firstName,
        lastName: targetContacts.lastName,
        title: targetContacts.title,
        email: targetContacts.email,
        phone: targetContacts.phone,
        isPrimary: targetContacts.isPrimary,
        notes: targetContacts.notes,
        createdAt: targetContacts.createdAt,
        company: {
          id: targetCompanies.id,
          companyName: targetCompanies.companyName,
          industry: targetCompanies.industry,
        },
      })
      .from(targetContacts)
      .innerJoin(targetCompanies, eq(targetContacts.targetCompanyId, targetCompanies.id))
      .where(eq(targetCompanies.userCompanyId, userCompanyId))
      .orderBy(
        sql`${targetContacts.isPrimary} DESC`,
        targetCompanies.companyName,
        targetContacts.lastName
      );

    return contacts;
  }

  async targetCompanyBelongsToUser(targetCompanyId: number, userCompanyId: number): Promise<boolean> {
    const [company] = await db
      .select({ id: targetCompanies.id })
      .from(targetCompanies)
      .where(and(eq(targetCompanies.id, targetCompanyId), eq(targetCompanies.userCompanyId, userCompanyId)));
    return !!company;
  }
}

export const contactsRepository = new ContactsRepository();
