import { notesRepository } from '../repositories/notes.repository';
import { targetCompaniesRepository } from '../repositories/target-companies.repository';
import { BadRequestError, NotFoundError } from '../utils/errors';
import type { DealNote, InsertDealNote } from '@shared/schema';

export class NotesService {
  async getByTargetCompany(targetCompanyId: number, userCompanyId: number): Promise<DealNote[]> {
    const company = await targetCompaniesRepository.getById(targetCompanyId, userCompanyId);
    if (!company) {
      throw new NotFoundError('Company not found or access denied');
    }
    return await notesRepository.getByTargetCompany(targetCompanyId);
  }

  async create(
    targetCompanyId: number,
    data: { noteType?: string; title: string; content?: string; reminderDate?: string },
    userId: number,
    userCompanyId: number
  ): Promise<DealNote> {
    if (!data.title) {
      throw new BadRequestError('Title is required');
    }

    const company = await targetCompaniesRepository.getById(targetCompanyId, userCompanyId);
    if (!company) {
      throw new NotFoundError('Company not found or access denied');
    }

    const note = await notesRepository.create({
      targetCompanyId,
      noteType: data.noteType || 'General',
      title: data.title,
      content: data.content || null,
      reminderDate: data.reminderDate ? new Date(data.reminderDate) : null,
      reminderCompleted: false,
      createdBy: userId,
    });

    // Auto-move to Initial Contact stage when Initial Discussion note is added
    if (data.noteType === 'Initial Discussion' && company.stage === 'New Target') {
      await targetCompaniesRepository.update(targetCompanyId, { stage: 'Initial Contact' }, userCompanyId);
    }

    return note;
  }

  async update(
    noteId: number,
    updates: { noteType?: string; title?: string; content?: string; reminderDate?: string; reminderCompleted?: boolean }
  ): Promise<DealNote> {
    if (!noteId || isNaN(noteId)) {
      throw new BadRequestError('Invalid note ID');
    }

    const updateData: Partial<InsertDealNote> = {};
    if (updates.noteType !== undefined) updateData.noteType = updates.noteType;
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.content !== undefined) updateData.content = updates.content;
    if (updates.reminderDate !== undefined) updateData.reminderDate = updates.reminderDate ? new Date(updates.reminderDate) : null;
    if (updates.reminderCompleted !== undefined) updateData.reminderCompleted = updates.reminderCompleted;

    const note = await notesRepository.update(noteId, updateData);
    if (!note) {
      throw new NotFoundError('Note not found');
    }
    return note;
  }

  async delete(noteId: number): Promise<boolean> {
    if (!noteId || isNaN(noteId)) {
      throw new BadRequestError('Invalid note ID');
    }

    const deleted = await notesRepository.delete(noteId);
    if (!deleted) {
      throw new NotFoundError('Note not found');
    }
    return true;
  }
}

export const notesService = new NotesService();
