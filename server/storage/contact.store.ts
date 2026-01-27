import { db } from "../db";
import {
  targetContacts,
  targetCompanies,
  type TargetContact,
  type InsertTargetContact,
} from "@shared/schema";
import { eq, and, desc, asc, sql } from "drizzle-orm";

type DbInstance = typeof db;

export class ContactStore {
  constructor(private db: DbInstance) {}

  async getContactsForTargetCompany(targetCompanyId: number, userCompanyId: number): Promise<TargetContact[]> {
    const [targetCompany] = await this.db
      .select()
      .from(targetCompanies)
      .where(
        and(
          eq(targetCompanies.id, targetCompanyId),
          eq(targetCompanies.userCompanyId, userCompanyId)
        )
      );

    if (!targetCompany) {
      return [];
    }

    return await this.db
      .select()
      .from(targetContacts)
      .where(eq(targetContacts.targetCompanyId, targetCompanyId))
      .orderBy(desc(targetContacts.isPrimary), asc(targetContacts.lastName));
  }

  async createTargetContact(insertContact: InsertTargetContact): Promise<TargetContact> {
    if (insertContact.isPrimary) {
      await this.db
        .update(targetContacts)
        .set({ isPrimary: false })
        .where(eq(targetContacts.targetCompanyId, insertContact.targetCompanyId));
    }

    const [contact] = await this.db
      .insert(targetContacts)
      .values(insertContact)
      .returning();
    return contact;
  }

  async updateTargetContact(id: number, updateData: Partial<InsertTargetContact>, userCompanyId: number): Promise<TargetContact | undefined> {
    const [existingContact] = await this.db
      .select()
      .from(targetContacts)
      .innerJoin(targetCompanies, eq(targetContacts.targetCompanyId, targetCompanies.id))
      .where(and(eq(targetContacts.id, id), eq(targetCompanies.userCompanyId, userCompanyId)));

    if (!existingContact) {
      return undefined;
    }

    if (updateData.isPrimary) {
      await this.db
        .update(targetContacts)
        .set({ isPrimary: false })
        .where(eq(targetContacts.targetCompanyId, existingContact.target_contacts.targetCompanyId));
    }

    const [contact] = await this.db
      .update(targetContacts)
      .set(updateData)
      .where(eq(targetContacts.id, id))
      .returning();
    return contact || undefined;
  }

  async getTargetContact(contactId: number, userCompanyId: number): Promise<TargetContact | undefined> {
    const [existingContact] = await this.db
      .select()
      .from(targetContacts)
      .innerJoin(targetCompanies, eq(targetContacts.targetCompanyId, targetCompanies.id))
      .where(and(eq(targetContacts.id, contactId), eq(targetCompanies.userCompanyId, userCompanyId)));

    if (!existingContact) {
      return undefined;
    }

    return existingContact.target_contacts;
  }

  async deleteTargetContact(id: number, userCompanyId: number): Promise<boolean> {
    const [existingContact] = await this.db
      .select()
      .from(targetContacts)
      .innerJoin(targetCompanies, eq(targetContacts.targetCompanyId, targetCompanies.id))
      .where(and(eq(targetContacts.id, id), eq(targetCompanies.userCompanyId, userCompanyId)));

    if (!existingContact) {
      return false;
    }

    const result = await this.db
      .delete(targetContacts)
      .where(eq(targetContacts.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getAllContactsForUserCompany(userCompanyId: number) {
    const contacts = await this.db
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

  async getContactsByCompany(targetCompanyId: number, userCompanyId: number): Promise<TargetContact[]> {
    const contacts = await this.db
      .select()
      .from(targetContacts)
      .innerJoin(targetCompanies, eq(targetContacts.targetCompanyId, targetCompanies.id))
      .where(
        and(
          eq(targetContacts.targetCompanyId, targetCompanyId),
          eq(targetCompanies.userCompanyId, userCompanyId)
        )
      )
      .orderBy(sql`${targetContacts.isPrimary} DESC`, targetContacts.lastName);

    return contacts.map(row => row.target_contacts);
  }
}

export const contactStore = new ContactStore(db);
