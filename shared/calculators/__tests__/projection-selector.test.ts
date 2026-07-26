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

describe('selectProjectionWinners — balance fall-through guard', () => {
  it('T1: balance group — statutory all-null loses to management with real figures', () => {
    // Statutory ranks above management, but its figures are all-null.
    // The balance guard must skip it and return the management candidate instead.
    const allNull = contrib({
      id: 1,
      sourceTier: 'statutory',
      statementType: 'balance',
      figures: { tangibleFixedAssets: null, cashAtBank: null, totalCurrentAssets: null },
    });
    const withData = contrib({
      id: 2,
      sourceTier: 'management',
      statementType: 'balance',
      figures: { tangibleFixedAssets: '150000', cashAtBank: '20000' },
    });
    const winners = selectProjectionWinners([allNull, withData]);
    expect(winners).toHaveLength(1);
    expect(winners[0].id).toBe(2);
    expect(winners[0].sourceTier).toBe('management');
  });

  it('T2: balance group — all candidates all-null falls back to top-ranked (statutory)', () => {
    // When every candidate in the group has no core balance value, the guard
    // falls back to sorted[0] (the top-ranked by tier / createdAt / doc id).
    const nullStatutory = contrib({
      id: 1,
      sourceTier: 'statutory',
      statementType: 'balance',
      figures: { tangibleFixedAssets: null },
    });
    const nullManagement = contrib({
      id: 2,
      sourceTier: 'management',
      statementType: 'balance',
      figures: {},
    });
    const winners = selectProjectionWinners([nullStatutory, nullManagement]);
    expect(winners).toHaveLength(1);
    expect(winners[0].id).toBe(1);
    expect(winners[0].sourceTier).toBe('statutory');
  });

  it('T3: income group unchanged — statutory all-null loses to management with figures (Slice 22 regression guard)', () => {
    // Confirms the existing income fall-through behaviour is unaffected by the
    // balance guard change.
    const allNull = contrib({
      id: 1,
      sourceTier: 'statutory',
      statementType: 'income',
      figures: { revenue: null, operatingProfit: null },
    });
    const withData = contrib({
      id: 2,
      sourceTier: 'management',
      statementType: 'income',
      figures: { revenue: '500000', operatingProfit: '80000' },
    });
    const winners = selectProjectionWinners([allNull, withData]);
    expect(winners).toHaveLength(1);
    expect(winners[0].id).toBe(2);
    expect(winners[0].sourceTier).toBe('management');
  });
});

describe('selectProjectionWinners — is_primary_year precedence (Slice 10)', () => {
  it('primary (doc B) beats comparative (doc A) within the same tier, regardless of createdAt/id order', () => {
    // doc A: comparative (FY2023 appeared as prior-year in FY2024 accounts), uploaded first
    // doc B: primary FY2023 filing, uploaded earlier but is the authoritative source
    const docA = contrib({ id: 1, sourceTier: 'statutory', sourceDocumentId: 481, isPrimaryYear: false, createdAt: new Date('2024-01-01') });
    const docB = contrib({ id: 2, sourceTier: 'statutory', sourceDocumentId: 482, isPrimaryYear: true,  createdAt: new Date('2023-06-01') });

    const winners1 = selectProjectionWinners([docA, docB]);
    expect(winners1).toHaveLength(1);
    expect(winners1[0].sourceDocumentId).toBe(482);

    // Order in input must not affect the result
    const winners2 = selectProjectionWinners([docB, docA]);
    expect(winners2).toHaveLength(1);
    expect(winners2[0].sourceDocumentId).toBe(482);
  });

  it('comparative wins as fallback when the primary contribution is removed', () => {
    const docA = contrib({ id: 1, sourceTier: 'statutory', sourceDocumentId: 481, isPrimaryYear: false, createdAt: new Date('2024-01-01') });

    const winners = selectProjectionWinners([docA]);
    expect(winners).toHaveLength(1);
    expect(winners[0].sourceDocumentId).toBe(481);
  });

  it('FY2022 present only as a comparative still produces a projection (only source)', () => {
    const comparative = contrib({
      id: 3,
      sourceTier: 'statutory',
      fiscalYear: 2022,
      sourceDocumentId: 482,
      isPrimaryYear: false,
      createdAt: new Date('2023-06-01'),
    });

    const winners = selectProjectionWinners([comparative]);
    expect(winners).toHaveLength(1);
    expect(winners[0].fiscalYear).toBe(2022);
    expect(winners[0].sourceDocumentId).toBe(482);
  });

  it('null/undefined isPrimaryYear treated as true — legacy rows are not demoted', () => {
    const legacy   = contrib({ id: 1, sourceTier: 'statutory', sourceDocumentId: 100, isPrimaryYear: undefined, createdAt: new Date('2023-01-01') });
    const explicit = contrib({ id: 2, sourceTier: 'statutory', sourceDocumentId: 200, isPrimaryYear: false,     createdAt: new Date('2024-01-01') });

    const winners = selectProjectionWinners([legacy, explicit]);
    expect(winners).toHaveLength(1);
    expect(winners[0].sourceDocumentId).toBe(100);
  });
});
