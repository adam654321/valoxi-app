import { contactsRepository, type ContactWithCompany } from '../repositories/contacts.repository';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/errors';
import type { TargetContact, InsertTargetContact } from '@shared/schema';

export class ContactsService {
  async getContactsForTargetCompany(
    targetCompanyId: number,
    userCompanyId: number
  ): Promise<TargetContact[]> {
    if (!targetCompanyId || isNaN(targetCompanyId)) {
      throw new BadRequestError('Invalid target company ID');
    }

    const hasAccess = await contactsRepository.targetCompanyBelongsToUser(targetCompanyId, userCompanyId);
    if (!hasAccess) {
      throw new NotFoundError('Target company not found');
    }

    return await contactsRepository.getContactsForTargetCompany(targetCompanyId);
  }

  async getTargetContact(contactId: number, userCompanyId: number): Promise<TargetContact> {
    if (!contactId || isNaN(contactId)) {
      throw new BadRequestError('Invalid contact ID');
    }

    const contact = await contactsRepository.getTargetContact(contactId, userCompanyId);
    if (!contact) {
      throw new NotFoundError('Contact not found');
    }

    return contact;
  }

  async createTargetContact(
    targetCompanyId: number,
    contactData: Omit<InsertTargetContact, 'targetCompanyId'>,
    userCompanyId: number
  ): Promise<TargetContact> {
    if (!targetCompanyId || isNaN(targetCompanyId)) {
      throw new BadRequestError('Invalid target company ID');
    }

    const hasAccess = await contactsRepository.targetCompanyBelongsToUser(targetCompanyId, userCompanyId);
    if (!hasAccess) {
      throw new NotFoundError('Target company not found');
    }

    return await contactsRepository.createTargetContact({
      ...contactData,
      targetCompanyId,
    });
  }

  async updateTargetContact(
    contactId: number,
    updateData: Partial<InsertTargetContact>,
    userCompanyId: number
  ): Promise<TargetContact> {
    if (!contactId || isNaN(contactId)) {
      throw new BadRequestError('Invalid contact ID');
    }

    const updatedContact = await contactsRepository.updateTargetContact(contactId, updateData, userCompanyId);
    if (!updatedContact) {
      throw new NotFoundError('Contact not found');
    }

    return updatedContact;
  }

  async deleteTargetContact(contactId: number, userCompanyId: number): Promise<boolean> {
    if (!contactId || isNaN(contactId)) {
      throw new BadRequestError('Invalid contact ID');
    }

    const deleted = await contactsRepository.deleteTargetContact(contactId, userCompanyId);
    if (!deleted) {
      throw new NotFoundError('Contact not found');
    }

    return true;
  }

  async getAllContactsForUserCompany(userCompanyId: number): Promise<ContactWithCompany[]> {
    if (!userCompanyId || isNaN(userCompanyId)) {
      throw new BadRequestError('Invalid user company ID');
    }

    return await contactsRepository.getAllContactsForUserCompany(userCompanyId);
  }
}

export const contactsService = new ContactsService();
