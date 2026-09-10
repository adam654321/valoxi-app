/**
 * Commercial guards, items #296 and #324 — CALL SITE proof.
 *
 * offer-guards.test.ts proves the predicates. This file proves the wiring: that neither
 * blocked state can produce a stored price or a sent offer at the real boundaries.
 *
 * Seeds its own throwaway company with NO financial periods, so it has zero
 * valuation-eligible years by construction.
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

  // No financial_periods rows are created for this company, so it has zero
  // valuation-eligible years by construction.
  const [tc] = await db.insert(targetCompanies).values({
    userCompanyId,
    companyName: `GUARD TEST TARGET ${STAMP}`,
    createdBy: userId,
  }).returning();
  companyId = tc.id;

  // A deal model carrying a STALE price, to prove recalculate clears it rather than
  // leaving it in place. Debt with no EBITDA drives offerPrice negative, the tc228 shape.
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

describe('#296 — no deal model without a valuation-eligible year', () => {
  it('createModel is rejected', async () => {
    await expect(
      dealModelService.createModel(companyId, userId, userCompanyId, 'Should Not Exist'),
    ).rejects.toThrow(/valuation-eligible year/i);
  });

  it('and no extra deal model row was created by the attempt', async () => {
    const rows = await db.select().from(dealModels)
      .where(eq(dealModels.targetCompanyId, companyId));
    expect(rows).toHaveLength(1); // only the fixture model
    expect(rows[0].id).toBe(modelId);
  });
});

describe('#324 — an unsupportable price cannot be stored on the deal model', () => {
  it('recalculate clears a stale price rather than storing an unsupportable one', async () => {
    const before = await db.select().from(dealModels).where(eq(dealModels.id, modelId));
    expect(before[0].totalPurchasePrice).not.toBeNull();

    await dealModelService.getModel(modelId, userCompanyId);

    const after = await db.select().from(dealModels).where(eq(dealModels.id, modelId));
    expect(after[0].totalPurchasePrice).toBeNull();
    expect(after[0].enterpriseValue).toBeNull();
  });

  it('but the EBITDA working is still written, so the screen keeps rendering', async () => {
    const rows = await db.select().from(dealModels).where(eq(dealModels.id, modelId));
    expect(rows[0].calculatedEbitda).not.toBeNull();
  });
});

describe('#324 — an unsupportable price cannot be stored in current_offers', () => {
  it('tc89 at minus 771,213 is refused', async () => {
    await expect(
      dealDocumentService.upsertCurrentOffer({
        targetCompanyId: companyId,
        userCompanyId,
        dealDocumentId: null as unknown as number,
        dealModelId: modelId,
        documentData: { offerPrice: '-£771,213', _raw: { offerPrice: -771213 } },
        deliveryMethod: 'offline',
        status: 'sent',
      }),
    ).rejects.toThrow(/unsupportable offer price/i);

    const rows = await db.select().from(currentOffers)
      .where(eq(currentOffers.targetCompanyId, companyId));
    expect(rows).toHaveLength(0);
  });

  it('zero is refused', async () => {
    await expect(
      dealDocumentService.upsertCurrentOffer({
        targetCompanyId: companyId,
        userCompanyId,
        dealDocumentId: null as unknown as number,
        dealModelId: modelId,
        documentData: { offerPrice: '£0', _raw: { offerPrice: 0 } },
        deliveryMethod: 'offline',
        status: 'sent',
      }),
    ).rejects.toThrow(/unsupportable offer price/i);

    const rows = await db.select().from(currentOffers)
      .where(eq(currentOffers.targetCompanyId, companyId));
    expect(rows).toHaveLength(0);
  });

  it('POSITIVE CONTROL: a supportable price is stored, so the guard is not blocking everything', async () => {
    await dealDocumentService.upsertCurrentOffer({
      targetCompanyId: companyId,
      userCompanyId,
      dealDocumentId: null as unknown as number,
      dealModelId: modelId,
      documentData: { offerPrice: '£250,000', _raw: { offerPrice: 250000 } },
      deliveryMethod: 'offline',
      status: 'sent',
    });

    const rows = await db.select().from(currentOffers)
      .where(eq(currentOffers.targetCompanyId, companyId));
    expect(rows).toHaveLength(1);
    expect(rows[0].offerPrice).toBe('£250,000');

    await db.delete(currentOffers).where(eq(currentOffers.targetCompanyId, companyId));
  });
});

describe('#324 — an unsupportable offer cannot be sent', () => {
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

  it('tc228 at minus 4,411 cannot be sent, and the document stays a draft', async () => {
    const docId = await seedDraftOffer({ offerPrice: '-£4,411', _raw: { offerPrice: -4411 } });

    await expect(dealDocumentService.sendDocument(docId, userId))
      .rejects.toThrow(/no offer supportable/i);

    const rows = await db.select().from(dealDocuments).where(eq(dealDocuments.id, docId));
    expect(rows[0].status).toBe('draft');
    expect(rows[0].sentAt).toBeNull();

    const offers = await db.select().from(currentOffers)
      .where(eq(currentOffers.targetCompanyId, companyId));
    expect(offers).toHaveLength(0);
  });

  it('an offer letter with no verifiable price cannot be sent', async () => {
    const docId = await seedDraftOffer({ offerPrice: '£250,000' }); // formatted only, no _raw

    await expect(dealDocumentService.sendDocument(docId, userId))
      .rejects.toThrow(/no offer supportable/i);

    const rows = await db.select().from(dealDocuments).where(eq(dealDocuments.id, docId));
    expect(rows[0].status).toBe('draft');
    expect(rows[0].sentAt).toBeNull();
  });

  it('an offer letter with no documentData at all cannot be sent', async () => {
    const docId = await seedDraftOffer(null);

    await expect(dealDocumentService.sendDocument(docId, userId))
      .rejects.toThrow(/no offer supportable/i);

    const rows = await db.select().from(dealDocuments).where(eq(dealDocuments.id, docId));
    expect(rows[0].status).toBe('draft');
    expect(rows[0].sentAt).toBeNull();
  });
});