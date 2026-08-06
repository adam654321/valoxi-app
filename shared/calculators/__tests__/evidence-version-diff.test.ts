import { describe, it, expect } from 'vitest';
import {
  buildFigureKey,
  diffEvidenceVersions,
  type EvidenceFigureRow,
} from '../evidence-version-diff';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function row(
  overrides: Partial<EvidenceFigureRow> & { payloadPath: string },
): EvidenceFigureRow {
  return {
    documentId: 1,
    documentType: 'profit_and_loss',
    extractionVersion: 1,
    fiscalYearStated: 2023,
    value: '1000',
    pageNumber: null,
    labelTextAsPrinted: null,
    statementType: 'profit_and_loss',
    ...overrides,
  };
}

const BASE_ROWS: EvidenceFigureRow[] = [
  row({ payloadPath: 'revenue', value: '500000' }),
  row({ payloadPath: 'gross_profit', value: '200000' }),
  row({ payloadPath: 'ebitda', value: '100000' }),
];

// ---------------------------------------------------------------------------
// T1. Identical sets — all EQUAL, zero differ, zero one-sided
// ---------------------------------------------------------------------------

describe('T1 – identical sets: all EQUAL', () => {
  it('produces equal=3, differ=0, baseOnly=0, compareOnly=0', () => {
    const result = diffEvidenceVersions(BASE_ROWS, [...BASE_ROWS]);
    expect(result.equal).toBe(3);
    expect(result.differ).toBe(0);
    expect(result.baseOnly).toBe(0);
    expect(result.compareOnly).toBe(0);
    expect(result.baseCount).toBe(3);
    expect(result.compareCount).toBe(3);
    expect(result.diffs.every((d) => d.bucket === 'EQUAL')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T2. One value changed — exactly one DIFFER, correct fields
// ---------------------------------------------------------------------------

describe('T2 – one value changed', () => {
  it('produces exactly one DIFFER with correct baseValue, compareValue, absoluteDifference', () => {
    const compare = BASE_ROWS.map((r) =>
      r.payloadPath === 'ebitda' ? { ...r, value: '95000' } : { ...r },
    );
    const result = diffEvidenceVersions(BASE_ROWS, compare);
    expect(result.equal).toBe(2);
    expect(result.differ).toBe(1);
    expect(result.baseOnly).toBe(0);
    expect(result.compareOnly).toBe(0);
    const diff = result.diffs.find((d) => d.bucket === 'DIFFER')!;
    expect(diff.payloadPath).toBe('ebitda');
    expect(diff.baseValue).toBe('100000');
    expect(diff.compareValue).toBe('95000');
    expect(diff.absoluteDifference).toBe(5000);
  });
});

// ---------------------------------------------------------------------------
// T3. Numeric equality: "100" vs "100.00" EQUAL; "100" vs "100.01" DIFFER
// ---------------------------------------------------------------------------

describe('T3 – numeric string equivalence', () => {
  const r1 = row({ payloadPath: 'a', value: '100' });

  it('"100" vs "100.00" is EQUAL', () => {
    const result = diffEvidenceVersions([r1], [{ ...r1, value: '100.00' }]);
    expect(result.equal).toBe(1);
    expect(result.differ).toBe(0);
    const diff = result.diffs[0];
    expect(diff.bucket).toBe('EQUAL');
    expect(diff.absoluteDifference).toBeNull();
  });

  it('"100" vs "100.01" is DIFFER with absoluteDifference 0.01', () => {
    const result = diffEvidenceVersions([r1], [{ ...r1, value: '100.01' }]);
    expect(result.equal).toBe(0);
    expect(result.differ).toBe(1);
    const diff = result.diffs[0];
    expect(diff.bucket).toBe('DIFFER');
    // IEEE 754: Math.abs(100.01 - 100) === 0.010000000000005116, not 0.01 exactly.
    // toBeCloseTo(0.01, 10) asserts agreement to 10 decimal places (tolerance < 1e-10),
    // which is the correct way to assert the result of IEEE 754 arithmetic.
    expect(diff.absoluteDifference).toBeCloseTo(0.01, 10);
  });
});

// ---------------------------------------------------------------------------
// T4. One row removed from compare — exactly one BASE_ONLY
// ---------------------------------------------------------------------------

describe('T4 – one row removed from compare', () => {
  it('produces exactly one BASE_ONLY with correct payloadPath', () => {
    const compare = BASE_ROWS.filter((r) => r.payloadPath !== 'ebitda');
    const result = diffEvidenceVersions(BASE_ROWS, compare);
    expect(result.baseOnly).toBe(1);
    expect(result.compareOnly).toBe(0);
    expect(result.equal).toBe(2);
    expect(result.differ).toBe(0);
    const diff = result.diffs.find((d) => d.bucket === 'BASE_ONLY')!;
    expect(diff.payloadPath).toBe('ebitda');
    expect(diff.baseValue).toBe('100000');
    expect(diff.compareValue).toBeNull();
    expect(diff.absoluteDifference).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// T5. One row added to compare — exactly one COMPARE_ONLY
// ---------------------------------------------------------------------------

describe('T5 – one row added to compare', () => {
  it('produces exactly one COMPARE_ONLY with correct payloadPath', () => {
    const extra = row({ payloadPath: 'depreciation', value: '20000' });
    const compare = [...BASE_ROWS, extra];
    const result = diffEvidenceVersions(BASE_ROWS, compare);
    expect(result.compareOnly).toBe(1);
    expect(result.baseOnly).toBe(0);
    expect(result.equal).toBe(3);
    expect(result.differ).toBe(0);
    const diff = result.diffs.find((d) => d.bucket === 'COMPARE_ONLY')!;
    expect(diff.payloadPath).toBe('depreciation');
    expect(diff.baseValue).toBeNull();
    expect(diff.compareValue).toBe('20000');
    expect(diff.absoluteDifference).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// T6. T2 + T4 + T5 combined, with both reconciliation identities asserted
// ---------------------------------------------------------------------------

describe('T6 – combined DIFFER + BASE_ONLY + COMPARE_ONLY with reconciliation', () => {
  it('both reconciliation identities hold', () => {
    // base: revenue(500000), gross_profit(200000), ebitda(100000)
    // compare:
    //   revenue → changed to 490000      (DIFFER)
    //   gross_profit → unchanged         (EQUAL)
    //   ebitda → removed                 (BASE_ONLY)
    //   depreciation → added             (COMPARE_ONLY)
    const base: EvidenceFigureRow[] = [
      row({ payloadPath: 'revenue',      value: '500000' }),
      row({ payloadPath: 'gross_profit', value: '200000' }),
      row({ payloadPath: 'ebitda',       value: '100000' }),
    ];
    const compare: EvidenceFigureRow[] = [
      row({ payloadPath: 'revenue',      value: '490000' }),
      row({ payloadPath: 'gross_profit', value: '200000' }),
      row({ payloadPath: 'depreciation', value: '20000'  }),
    ];

    const result = diffEvidenceVersions(base, compare);

    // Bucket counts
    expect(result.equal).toBe(1);      // gross_profit
    expect(result.differ).toBe(1);     // revenue
    expect(result.baseOnly).toBe(1);   // ebitda
    expect(result.compareOnly).toBe(1); // depreciation

    // Identity 1: baseCount === equal + differ + baseOnly
    // 1 + 1 + 1 = 3
    expect(result.baseCount).toBe(result.equal + result.differ + result.baseOnly);
    expect(result.baseCount).toBe(3);

    // Identity 2: compareCount === equal + differ + compareOnly
    // 1 + 1 + 1 = 3
    expect(result.compareCount).toBe(result.equal + result.differ + result.compareOnly);
    expect(result.compareCount).toBe(3);

    // Spot-check the DIFFER
    const differDiff = result.diffs.find((d) => d.bucket === 'DIFFER')!;
    expect(differDiff.payloadPath).toBe('revenue');
    expect(differDiff.absoluteDifference).toBe(10000);
  });
});

// ---------------------------------------------------------------------------
// T7. null vs null EQUAL; null vs 5 DIFFER; non-numeric string as null
// ---------------------------------------------------------------------------

describe('T7 – null and non-numeric value handling', () => {
  it('null vs null is EQUAL', () => {
    const b = [row({ payloadPath: 'x', value: null })];
    const c = [row({ payloadPath: 'x', value: null })];
    const result = diffEvidenceVersions(b, c);
    expect(result.equal).toBe(1);
    expect(result.differ).toBe(0);
    const diff = result.diffs[0];
    expect(diff.bucket).toBe('EQUAL');
    expect(diff.absoluteDifference).toBeNull();
  });

  it('null vs 5 is DIFFER with absoluteDifference null', () => {
    const b = [row({ payloadPath: 'x', value: null })];
    const c = [row({ payloadPath: 'x', value: '5' })];
    const result = diffEvidenceVersions(b, c);
    expect(result.differ).toBe(1);
    const diff = result.diffs[0];
    expect(diff.bucket).toBe('DIFFER');
    expect(diff.absoluteDifference).toBeNull();
  });

  it('non-numeric string is treated as null and pairs with null as EQUAL', () => {
    const b = [row({ payloadPath: 'x', value: 'n/a' })];
    const c = [row({ payloadPath: 'x', value: null })];
    const result = diffEvidenceVersions(b, c);
    // 'n/a' → null, null vs null → EQUAL
    expect(result.equal).toBe(1);
    const diff = result.diffs[0];
    expect(diff.bucket).toBe('EQUAL');
    expect(diff.absoluteDifference).toBeNull();
  });

  it('non-numeric string vs a number is DIFFER', () => {
    const b = [row({ payloadPath: 'x', value: 'n/a' })];
    const c = [row({ payloadPath: 'x', value: '42' })];
    const result = diffEvidenceVersions(b, c);
    expect(result.differ).toBe(1);
    const diff = result.diffs[0];
    expect(diff.bucket).toBe('DIFFER');
    expect(diff.absoluteDifference).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// T8. Key uniqueness: same payloadPath, different documentIds → two keys;
//     same payloadPath + documentId, different fiscal years → two keys
// ---------------------------------------------------------------------------

describe('T8 – key uniqueness', () => {
  it('same payloadPath on two different documentIds yields two distinct keys, both EQUAL', () => {
    const b: EvidenceFigureRow[] = [
      row({ documentId: 10, payloadPath: 'revenue', value: '1000' }),
      row({ documentId: 20, payloadPath: 'revenue', value: '2000' }),
    ];
    const c: EvidenceFigureRow[] = [
      row({ documentId: 10, payloadPath: 'revenue', value: '1000' }),
      row({ documentId: 20, payloadPath: 'revenue', value: '2000' }),
    ];
    const result = diffEvidenceVersions(b, c);
    expect(result.equal).toBe(2);
    expect(result.differ).toBe(0);
    expect(result.baseOnly).toBe(0);
    expect(result.compareOnly).toBe(0);
    const keys = result.diffs.map((d) => d.key);
    expect(new Set(keys).size).toBe(2);
  });

  it('same payloadPath + documentId, different fiscal years yields two distinct keys', () => {
    const b: EvidenceFigureRow[] = [
      row({ fiscalYearStated: 2022, payloadPath: 'revenue', value: '1000' }),
      row({ fiscalYearStated: 2023, payloadPath: 'revenue', value: '2000' }),
    ];
    const c: EvidenceFigureRow[] = [
      row({ fiscalYearStated: 2022, payloadPath: 'revenue', value: '1000' }),
      row({ fiscalYearStated: 2023, payloadPath: 'revenue', value: '2000' }),
    ];
    const result = diffEvidenceVersions(b, c);
    expect(result.equal).toBe(2);
    expect(result.differ).toBe(0);
    const keys = result.diffs.map((d) => d.key);
    expect(new Set(keys).size).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// T9. Duplicate key inside base: reported in duplicateBaseKeys, no throw,
//     first occurrence used
// ---------------------------------------------------------------------------

describe('T9 – duplicate key in base', () => {
  it('records the duplicate key, does not throw, first occurrence wins', () => {
    const b: EvidenceFigureRow[] = [
      row({ payloadPath: 'revenue', value: '500' }),   // first — wins
      row({ payloadPath: 'revenue', value: '999' }),   // duplicate — skipped
    ];
    const c: EvidenceFigureRow[] = [
      row({ payloadPath: 'revenue', value: '500' }),
    ];
    const result = diffEvidenceVersions(b, c);
    expect(result.duplicateBaseKeys).toHaveLength(1);
    expect(result.duplicateBaseKeys[0]).toContain('revenue');
    expect(result.duplicateCompareKeys).toHaveLength(0);
    // First occurrence (500) is compared; compare is also 500 → EQUAL
    expect(result.equal).toBe(1);
    expect(result.differ).toBe(0);
    // baseCount: only 1 unique base row participated
    expect(result.baseCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// T10. Anchor coverage: compare set of 4 rows, 2 with page, 3 with label, 1 with both
// ---------------------------------------------------------------------------

describe('T10 – anchor coverage', () => {
  it('counts withPage=2, withLabel=3, withBoth=1 over the compare set', () => {
    const makeCompareRow = (
      path: string,
      pageNumber: number | null,
      labelTextAsPrinted: string | null,
    ): EvidenceFigureRow =>
      row({ payloadPath: path, pageNumber, labelTextAsPrinted });

    // Row A: page ✓, label ✓ → withPage, withLabel, withBoth
    // Row B: page ✓, label ✗ → withPage only
    // Row C: page ✗, label ✓ → withLabel only
    // Row D: page ✗, label ✓ → withLabel only
    const compareRows: EvidenceFigureRow[] = [
      makeCompareRow('row_a', 1,    'Label A'),
      makeCompareRow('row_b', 2,    null),
      makeCompareRow('row_c', null, 'Label C'),
      makeCompareRow('row_d', null, 'Label D'),
    ];

    // base mirrors compare so all are EQUAL
    const baseRows: EvidenceFigureRow[] = compareRows.map((r) => ({ ...r }));

    const result = diffEvidenceVersions(baseRows, compareRows);

    expect(result.anchorCoverage.compareTotal).toBe(4);
    expect(result.anchorCoverage.withPage).toBe(2);
    expect(result.anchorCoverage.withLabel).toBe(3);
    expect(result.anchorCoverage.withBoth).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// T11. Hostile inputs — must not throw
// ---------------------------------------------------------------------------

describe('T11 – hostile inputs: no throw', () => {
  it('undefined base and compare', () => {
    expect(() => diffEvidenceVersions(undefined, undefined)).not.toThrow();
    const r = diffEvidenceVersions(undefined, undefined);
    expect(r.baseCount).toBe(0);
    expect(r.compareCount).toBe(0);
  });

  it('null base and compare', () => {
    expect(() => diffEvidenceVersions(null, null)).not.toThrow();
    const r = diffEvidenceVersions(null, null);
    expect(r.baseCount).toBe(0);
    expect(r.compareCount).toBe(0);
  });

  it('string inputs', () => {
    expect(() => diffEvidenceVersions('hello', 'world')).not.toThrow();
    const r = diffEvidenceVersions('hello', 'world');
    expect(r.baseCount).toBe(0);
    expect(r.compareCount).toBe(0);
  });

  it('number inputs', () => {
    expect(() => diffEvidenceVersions(42, 99)).not.toThrow();
    const r = diffEvidenceVersions(42, 99);
    expect(r.baseCount).toBe(0);
    expect(r.compareCount).toBe(0);
  });

  it('array containing null elements', () => {
    expect(() => diffEvidenceVersions([null, null], [null])).not.toThrow();
    const r = diffEvidenceVersions([null, null], [null]);
    expect(r.baseCount).toBe(0);
    expect(r.compareCount).toBe(0);
  });

  it('array containing object missing payloadPath', () => {
    const bad = [{ documentId: 1, documentType: 'p', extractionVersion: 1, fiscalYearStated: 2023, statementType: 'p' }];
    expect(() => diffEvidenceVersions(bad, bad)).not.toThrow();
    // missing payloadPath → invalid row → skipped
    const r = diffEvidenceVersions(bad, bad);
    expect(r.baseCount).toBe(0);
    expect(r.compareCount).toBe(0);
  });

  it('array of 5000 rows', () => {
    const big: EvidenceFigureRow[] = Array.from({ length: 5000 }, (_, i) =>
      row({ payloadPath: `path.${i}`, value: String(i * 100) }),
    );
    expect(() => diffEvidenceVersions(big, big)).not.toThrow();
    const r = diffEvidenceVersions(big, big);
    expect(r.equal).toBe(5000);
    expect(r.differ).toBe(0);
    expect(r.baseCount).toBe(5000);
    expect(r.compareCount).toBe(5000);
  });
});

// ---------------------------------------------------------------------------
// T12. Empty base and empty compare — all counters zero, diffs empty
// ---------------------------------------------------------------------------

describe('T12 – empty inputs', () => {
  it('all counters are zero and diffs is empty', () => {
    const result = diffEvidenceVersions([], []);
    expect(result.baseCount).toBe(0);
    expect(result.compareCount).toBe(0);
    expect(result.equal).toBe(0);
    expect(result.differ).toBe(0);
    expect(result.baseOnly).toBe(0);
    expect(result.compareOnly).toBe(0);
    expect(result.diffs).toHaveLength(0);
    expect(result.anchorCoverage.compareTotal).toBe(0);
    expect(result.anchorCoverage.withPage).toBe(0);
    expect(result.anchorCoverage.withLabel).toBe(0);
    expect(result.anchorCoverage.withBoth).toBe(0);
    expect(result.duplicateBaseKeys).toHaveLength(0);
    expect(result.duplicateCompareKeys).toHaveLength(0);
  });
});
