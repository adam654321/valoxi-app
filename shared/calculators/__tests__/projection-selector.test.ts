import { describe, it, expect } from 'vitest';
import { selectProjectionWinners, type Contribution } from '../projection-selector';

function contrib(overrides: Partial<Contribution> & Pick<Contribution, 'sourceTier'>): Contribution {
  return {
    id: Math.floor(Math.random() * 100_000),
    targetCompanyId: 1,
    fiscalYear: 2023,
    statementType: 'income',
    isFullYear: true,
    figures: {},
    createdAt: new Date('2024-01-01T00:00:00Z'),
    sourceDocumentId: null,
    ...overrides,
  };
}

describe('selectProjectionWinners', () => {
  it('statutory full-year beats information_memorandum full-year (same year/statement)', () => {
    const contribs = [
      contrib({ id: 1, sourceTier: 'information_memorandum' }),
      contrib({ id: 2, sourceTier: 'statutory' }),
    ];
    const winners = selectProjectionWinners(contribs);
    expect(winners).toHaveLength(1);
    expect(winners[0].sourceTier).toBe('statutory');
  });

  it('newer statutory beats older statutory (createdAt tie-break)', () => {
    const contribs = [
      contrib({ id: 1, sourceTier: 'statutory', createdAt: new Date('2024-01-01T00:00:00Z') }),
      contrib({ id: 2, sourceTier: 'statutory', createdAt: new Date('2024-06-01T00:00:00Z') }),
    ];
    const winners = selectProjectionWinners(contribs);
    expect(winners).toHaveLength(1);
    expect(winners[0].id).toBe(2);
  });

  it('user_override beats statutory', () => {
    const contribs = [
      contrib({ id: 1, sourceTier: 'statutory' }),
      contrib({ id: 2, sourceTier: 'user_override' }),
    ];
    const winners = selectProjectionWinners(contribs);
    expect(winners).toHaveLength(1);
    expect(winners[0].sourceTier).toBe('user_override');
  });

  it('management beats information_memorandum', () => {
    const contribs = [
      contrib({ id: 1, sourceTier: 'information_memorandum' }),
      contrib({ id: 2, sourceTier: 'management' }),
    ];
    const winners = selectProjectionWinners(contribs);
    expect(winners).toHaveLength(1);
    expect(winners[0].sourceTier).toBe('management');
  });

  it('full-year and part-year for the same year BOTH survive as separate winners', () => {
    const contribs = [
      contrib({ id: 1, sourceTier: 'statutory', isFullYear: true }),
      contrib({ id: 2, sourceTier: 'statutory', isFullYear: false }),
    ];
    const winners = selectProjectionWinners(contribs);
    expect(winners).toHaveLength(2);
    const fullYear = winners.find(w => w.isFullYear);
    const partYear = winners.find(w => !w.isFullYear);
    expect(fullYear).toBeDefined();
    expect(partYear).toBeDefined();
  });

  it('multiple fiscal years each yield their own winner', () => {
    const contribs = [
      contrib({ id: 1, sourceTier: 'statutory', fiscalYear: 2021 }),
      contrib({ id: 2, sourceTier: 'management', fiscalYear: 2021 }),
      contrib({ id: 3, sourceTier: 'management', fiscalYear: 2022 }),
      contrib({ id: 4, sourceTier: 'statutory', fiscalYear: 2022 }),
      contrib({ id: 5, sourceTier: 'information_memorandum', fiscalYear: 2023 }),
    ];
    const winners = selectProjectionWinners(contribs);
    expect(winners).toHaveLength(3);

    const w2021 = winners.find(w => w.fiscalYear === 2021);
    const w2022 = winners.find(w => w.fiscalYear === 2022);
    const w2023 = winners.find(w => w.fiscalYear === 2023);

    expect(w2021?.sourceTier).toBe('statutory');
    expect(w2022?.sourceTier).toBe('statutory');
    expect(w2023?.sourceTier).toBe('information_memorandum');
  });

  it('income and balance for the same year are selected independently', () => {
    const contribs = [
      contrib({ id: 1, sourceTier: 'statutory',              statementType: 'income'  }),
      contrib({ id: 2, sourceTier: 'information_memorandum', statementType: 'income'  }),
      contrib({ id: 3, sourceTier: 'management',             statementType: 'balance' }),
      contrib({ id: 4, sourceTier: 'statutory',              statementType: 'balance' }),
    ];
    const winners = selectProjectionWinners(contribs);
    expect(winners).toHaveLength(2);

    const incomeWinner  = winners.find(w => w.statementType === 'income');
    const balanceWinner = winners.find(w => w.statementType === 'balance');

    expect(incomeWinner?.sourceTier).toBe('statutory');
    expect(balanceWinner?.sourceTier).toBe('statutory');
  });

  it('tie on tier and createdAt: highest sourceDocumentId wins', () => {
    const ts = new Date('2024-01-01T00:00:00Z');
    const contribs = [
      contrib({ id: 1, sourceTier: 'statutory', createdAt: ts, sourceDocumentId: 10 }),
      contrib({ id: 2, sourceTier: 'statutory', createdAt: ts, sourceDocumentId: 20 }),
    ];
    const winners = selectProjectionWinners(contribs);
    expect(winners).toHaveLength(1);
    expect(winners[0].sourceDocumentId).toBe(20);
  });

  it('returns empty array for empty input', () => {
    expect(selectProjectionWinners([])).toHaveLength(0);
  });
});
