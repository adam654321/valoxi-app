/**
 * Commercial guards, items #296 and #324 — CALL SITE behaviour.
 *
 * Design after Adam's ruling of 14 September: the app stores and displays the real
 * computed figures and warns. Creating a model, building a document and storing a price
 * are the acquirer's decisions. The ONLY gate is the send boundary, because that document
 * goes to the seller.
 *
 * Seeds a throwaway company with NO financial_periods, so zero eligible years by
 * construction.
 *
 * Run: npx vitest run server/services/__tests__/offer-guard-call-sites.test.ts
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { users, userCompanies } from '@shared/schema/core';
import { targetCompanies } from '@shared/schema/deals';
import { dealModels } from '@shared/schema/deal-models';
import { dealDocuments, currentOffers } from '@shared/schema/deal-documents';
import { dealModelService, fetchReportedEbitdaByYear } from '../deal-model.service';
import { dealDocumentService } from '../deal-document.service';

// ─── HOST GUARD ──────────────────────────────────────────────────────────────
const dbUrl = process.env.DATABASE_URL ?? '';
const dbHost = dbUrl.match(/@([^/]+)\//)?.[1] ?? 'unknown';
if (dbHost.includes('ep-old-recipe') || dbHost.includes('.prod.')) {
  throw new Error(`OFFER GUARD ABORT: DATABASE_URL points at prod host (${dbHost}). Tests must run on dev.`);
}

const STAMP = Date.now();

let userCompanyId: number;
let userId: number;
let companyId: number;
let modelId: number;

beforeAll(async () => {
  const [uc] = await db.insert(userCompanies).values({
    companyName: `GUARD TEST BUYER ${STAMP}`,
  }).returning();
  userCompanyId = uc.id;

  const [u] = await db.insert(users).values({
    email: `guard.test.${STAMP}@example.invalid`,
    firstName: 'Guard',
    lastName: 'Test',
    userCompanyId,
  }).returning();
  userId = u.id;

  const [tc] = await db.insert(targetCompanies).values({
    userCompanyId,
    companyName: `GUARD TEST TARGET ${STAMP}`,
    createdBy: userId,
  }).returning();
  companyId = tc.id;

  const [dm] = await db.insert(dealModels).values({
    targetCompanyId: companyId,
    createdBy: userId,
    name: `GUARD TEST MODEL ${STAMP}`,
    averagingYears: 3,
    ebitdaMultiple: '3.0',
    minusPrimaryDebt: '100000',
    enterpriseValue: '999999',
    totalPurchasePrice: '888888',
  }).returning();
  modelId = dm.id;
});

afterAll(async () => {
  await db.delete(currentOffers).where(eq(currentOffers.targetCompanyId, companyId));
  await db.delete(dealDocuments).where(eq(dealDocuments.targetCompanyId, companyId));
  await db.delete(dealModels).where(eq(dealModels.targetCompanyId, companyId));
  await db.delete(targetCompanies).where(eq(targetCompanies.id, companyId));
  await db.delete(users).where(eq(users.id, userId));
  await db.delete(userCompanies).where(eq(userCompanies.id, userCompanyId));
});

describe('fixture sanity', () => {
  it('the seeded company genuinely has zero valuation-eligible years', async () => {
    const ebitda = await fetchReportedEbitdaByYear(companyId);
    expect(Object.keys(ebitda)).toHaveLength(0);
  });
});

describe('#296 no longer blocks creating a deal model', () => {
  it('createModel is not rejected for want of a valuation-eligible year', async () => {
    let message = '';
    try {
      await dealModelService.createModel(companyId, userId, userCompanyId, `Eligibility Probe ${STAMP}`);
    } catch (err: any) {
      message = String(err?.message ?? '');
    }
    // It may still fail for unrelated reasons on a bare fixture (no expert analysis).
    // What must NOT happen is a refusal on eligibility grounds.
    expect(message).not.toMatch(/valuation-eligible year/i);
  });
});

describe('the deal model stores the computed figures, negative or not', () => {
  it('recalculate stores the real negative price rather than nulling it', async () => {
    await dealModelService.getModel(modelId, userCompanyId);
    const after = await db.select().from(dealModels).where(eq(dealModels.id, modelId));
    expect(after[0].totalPurchasePrice).not.toBeNull();
    expect(Number(after[0].totalPurchasePrice)).toBe(-100000);
  });

  it('and stores the enterprise value, which ValueCreationModeller reads directly', async () => {
    const rows = await db.select().from(dealModels).where(eq(dealModels.id, modelId));
    expect(rows[0].enterpriseValue).not.toBeNull();
    expect(Number(rows[0].enterpriseValue)).toBe(0);
  });

  it('and the EBITDA working is written as before', async () => {
    const rows = await db.select().from(dealModels).where(eq(dealModels.id, modelId));
    expect(rows[0].calculatedEbitda).not.toBeNull();
  });
});

describe('current_offers records the real price', () => {
  async function upsert(offerPrice: number, display: string) {
    await dealDocumentService.upsertCurrentOffer({
      targetCompanyId: companyId,
      userCompanyId,
      dealDocumentId: null as unknown as number,
      dealModelId: modelId,
      documentData: { offerPrice: display, _raw: { offerPrice } },
      deliveryMethod: 'offline',
      status: 'sent',
    });
    const rows = await db.select().from(currentOffers)
      .where(eq(currentOffers.targetCompanyId, companyId));
    return rows;
  }

  it('stores tc89 at minus 771,213 as computed', async () => {
    const rows = await upsert(-771213, '-£771,213');
    expect(rows).toHaveLength(1);
    expect(rows[0].offerPrice).toBe('-£771,213');
    await db.delete(currentOffers).where(eq(currentOffers.targetCompanyId, companyId));
  });

  it('stores a zero price as computed', async () => {
    const rows = await upsert(0, '£0');
    expect(rows).toHaveLength(1);
    expect(rows[0].offerPrice).toBe('£0');
    await db.delete(currentOffers).where(eq(currentOffers.targetCompanyId, companyId));
  });

  it('stores a supportable price as before', async () => {
    const rows = await upsert(250000, '£250,000');
    expect(rows).toHaveLength(1);
    expect(rows[0].offerPrice).toBe('£250,000');
    await db.delete(currentOffers).where(eq(currentOffers.targetCompanyId, companyId));
  });
});

describe('#324 — the SEND boundary is still gated (acknowledgement lands in slice 2c)', () => {
  async function seedDraftOffer(documentData: unknown): Promise<number> {
    const [doc] = await db.insert(dealDocuments).values({
      targetCompanyId: companyId,
      userCompanyId,
      documentType: 'offer_letter',
      status: 'draft',
      version: 1,
      createdBy: userId,
      dealModelId: modelId,
      deliveryMethod: 'offline',
      documentData,
      generatedFileUrl: 'generated-documents/guard-test-not-a-real-file.docx',
    }).returning();
    return doc.id;
  }

  it('tc228 at minus 4,411 cannot be sent unacknowledged, and stays a draft', async () => {
    const docId = await seedDraftOffer({ offerPrice: '-£4,411', _raw: { offerPrice: -4411 } });
    await expect(dealDocumentService.sendDocument(docId, userId))
      .rejects.toThrow(/no offer supportable/i);
    const rows = await db.select().from(dealDocuments).where(eq(dealDocuments.id, docId));
    expect(rows[0].status).toBe('draft');
    expect(rows[0].sentAt).toBeNull();
    expect(rows[0].unsupportedPriceAcknowledgedAt).toBeNull();
  });

  it('an offer letter with no verifiable price cannot be sent unacknowledged', async () => {
    const docId = await seedDraftOffer({ offerPrice: '£250,000' });
    await expect(dealDocumentService.sendDocument(docId, userId))
      .rejects.toThrow(/no offer supportable/i);
    const rows = await db.select().from(dealDocuments).where(eq(dealDocuments.id, docId));
    expect(rows[0].status).toBe('draft');
  });
});