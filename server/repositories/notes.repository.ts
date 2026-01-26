import { eq, desc } from 'drizzle-orm';
import { db } from '../db';
import { dealNotes, type DealNote, type InsertDealNote } from '@shared/schema';

export class NotesRepository {
  async getByTargetCompany(targetCompanyId: number): Promise<DealNote[]> {
    return await db
      .select()
      .from(dealNotes)
      .where(eq(dealNotes.targetCompanyId, targetCompanyId))
      .orderBy(desc(dealNotes.createdAt));
  }

  async getById(noteId: number): Promise<DealNote | undefined> {
    const [note] = await db
      .select()
      .from(dealNotes)
      .where(eq(dealNotes.id, noteId));
    return note || undefined;
  }

  async create(note: InsertDealNote): Promise<DealNote> {
    const [result] = await db.insert(dealNotes).values([note]).returning();
    return result;
  }

  async update(noteId: number, updates: Partial<InsertDealNote>): Promise<DealNote | undefined> {
    const processedUpdates: any = { ...updates, updatedAt: new Date() };
    if (typeof updates.reminderDate === 'string') {
      processedUpdates.reminderDate = new Date(updates.reminderDate);
    }
    const [updated] = await db
      .update(dealNotes)
      .set(processedUpdates)
      .where(eq(dealNotes.id, noteId))
      .returning();
    return updated || undefined;
  }

  async delete(noteId: number): Promise<boolean> {
    const result = await db.delete(dealNotes).where(eq(dealNotes.id, noteId)).returning();
    return result.length > 0;
  }
}

export const notesRepository = new NotesRepository();
