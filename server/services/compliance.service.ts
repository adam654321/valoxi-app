import { db } from '../db';
import { userAcceptances, type InsertUserAcceptance } from '@shared/schema/compliance';
import { and, eq, desc } from 'drizzle-orm';

export const TERMS_VERSION = '1.0';
export const DPA_VERSION = '1.0';

export type AcceptanceDocumentType = 'terms' | 'dpa';

export interface AcceptanceRecord {
  userId: number;
  documentType: AcceptanceDocumentType;
  version: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function recordAcceptance(record: AcceptanceRecord): Promise<void> {
  const data: InsertUserAcceptance = {
    userId: record.userId,
    documentType: record.documentType,
    version: record.version,
    ipAddress: record.ipAddress ?? null,
    userAgent: record.userAgent ?? null,
  };
  await db.insert(userAcceptances).values(data);
}

export async function hasAcceptedCurrent(
  userId: number,
  documentType: AcceptanceDocumentType
): Promise<boolean> {
  const currentVersion = documentType === 'terms' ? TERMS_VERSION : DPA_VERSION;
  const [latest] = await db
    .select({ version: userAcceptances.version })
    .from(userAcceptances)
    .where(and(
      eq(userAcceptances.userId, userId),
      eq(userAcceptances.documentType, documentType)
    ))
    .orderBy(desc(userAcceptances.acceptedAt))
    .limit(1);

  return latest?.version === currentVersion;
}

export async function hasAcceptedAllCurrent(userId: number): Promise<boolean> {
  const [termsOk, dpaOk] = await Promise.all([
    hasAcceptedCurrent(userId, 'terms'),
    hasAcceptedCurrent(userId, 'dpa'),
  ]);
  return termsOk && dpaOk;
}
