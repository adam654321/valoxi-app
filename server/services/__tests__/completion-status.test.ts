/**
 * Unit tests for Slice 8 — document-requirement coverage counts real
 * primary documents, not extracted types from Information Memoranda.
 *
 * All tests call the pure computeCompletionStatus() helper directly so
 * they run without any database or service infrastructure.
 */
import { describe, it, expect } from 'vitest';
import { computeCompletionStatus, CATEGORY_TO_TYPE } from '../../../shared/utils/completion-status';

describe('computeCompletionStatus — IM filtering and categoryToType fixes', () => {
  it("Company whose ONLY financial document is an IM → P&L and BS requirements NOT satisfied, upload slots remain open", () => {
    // An IM document has been analysed and its extracted type is profit_and_loss,
    // but it is flagged as an IM.  Coverage must NOT mark P&L complete.
    const docs = [
      { id: 1, documentCategory: 'YTD Profit & Loss' },
    ];
    const analysis = [
      { documentId: 1, documentType: 'profit_and_loss', isIM: true },
    ];

    const result = computeCompletionStatus(docs, analysis);

    expect(result.completedTypes).not.toContain('profit_and_loss');
    expect(result.missingTypes).toContain('profit_and_loss');
    expect(result.completedCount).toBe(0);
  });

  it('Company with a real, non-IM P&L document → P&L requirement satisfied', () => {
    const docs = [
      { id: 2, documentCategory: 'YTD Profit & Loss' },
    ];
    const analysis = [
      { documentId: 2, documentType: 'profit_and_loss', isIM: false },
    ];

    const result = computeCompletionStatus(docs, analysis);

    expect(result.completedTypes).toContain('profit_and_loss');
    expect(result.missingTypes).not.toContain('profit_and_loss');
    expect(result.completedCount).toBeGreaterThan(0);
  });

  it("categoryToType resolves 'YTD Profit & Loss' → profit_and_loss (category fallback, no analysis yet)", () => {
    // Document has been uploaded to the YTD P&L slot but not yet analysed.
    // The old categoryToType map was missing this key, so this was a no-op.
    const docs = [{ id: 3, documentCategory: 'YTD Profit & Loss' }];
    const analysis: { documentId: number; documentType: string; isIM: boolean }[] = [];

    const result = computeCompletionStatus(docs, analysis);

    expect(result.completedTypes).toContain('profit_and_loss');
    expect(result.missingTypes).not.toContain('profit_and_loss');
  });

  it("categoryToType resolves 'YTD Balance Sheet' → balance_sheet (was previously a no-op)", () => {
    const docs = [{ id: 4, documentCategory: 'YTD Balance Sheet' }];
    const analysis: { documentId: number; documentType: string; isIM: boolean }[] = [];

    const result = computeCompletionStatus(docs, analysis);

    expect(result.completedTypes).toContain('balance_sheet');
    expect(result.missingTypes).not.toContain('balance_sheet');
  });

  it('IM document alongside a real P&L — the real one wins', () => {
    // Two documents for the same company: one is IM (extracted P&L), one is real.
    const docs = [
      { id: 5, documentCategory: 'Deal Documents' },   // IM
      { id: 6, documentCategory: 'YTD Profit & Loss' }, // real
    ];
    const analysis = [
      { documentId: 5, documentType: 'profit_and_loss', isIM: true },
      { documentId: 6, documentType: 'profit_and_loss', isIM: false },
    ];

    const result = computeCompletionStatus(docs, analysis);

    expect(result.completedTypes).toContain('profit_and_loss');
    expect(result.missingTypes).not.toContain('profit_and_loss');
  });
});

describe('CATEGORY_TO_TYPE map completeness', () => {
  it.each([
    ['Asset Register', 'asset_register'],
    ['Sales Ledger', 'sales_ledger'],
    ['Staff Matrix', 'staff_matrix'],
    ['Profit & Loss', 'profit_and_loss'],
    ['YTD Profit & Loss', 'profit_and_loss'],
    ['Balance Sheet', 'balance_sheet'],
    ['YTD Balance Sheet', 'balance_sheet'],
  ])('%s → %s', (category, expected) => {
    expect(CATEGORY_TO_TYPE[category]).toBe(expected);
  });
});
