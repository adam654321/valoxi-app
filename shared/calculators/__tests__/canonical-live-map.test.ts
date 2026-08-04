import { describe, it, expect } from 'vitest';
import {
  mapFigurePath,
  SCALAR_MAP,
  ORPHAN_PATHS,
  LIVE_INCOME_COLUMNS,
  LIVE_BALANCE_COLUMNS,
} from '../canonical-live-map';

// ─── Group 1: Income scalars ──────────────────────────────────────────────────

describe('Group 1 — income scalars', () => {
  const incomeEntries = Object.entries(SCALAR_MAP).filter(([, v]) => v.table === 'income');

  it('every income entry resolves to kind scalar, table income, and the declared column', () => {
    for (const [path, { column }] of incomeEntries) {
      const result = mapFigurePath(path);
      expect(result.kind, `path: ${path}`).toBe('scalar');
      if (result.kind === 'scalar') {
        expect(result.table, `path: ${path}`).toBe('income');
        expect(result.column, `path: ${path}`).toBe(column);
      }
    }
  });
});

// ─── Group 2: Balance scalars ─────────────────────────────────────────────────

describe('Group 2 — balance scalars', () => {
  const balanceEntries = Object.entries(SCALAR_MAP).filter(([, v]) => v.table === 'balance');

  it('every balance entry resolves to kind scalar, table balance, and the declared column', () => {
    for (const [path, { column }] of balanceEntries) {
      const result = mapFigurePath(path);
      expect(result.kind, `path: ${path}`).toBe('scalar');
      if (result.kind === 'scalar') {
        expect(result.table, `path: ${path}`).toBe('balance');
        expect(result.column, `path: ${path}`).toBe(column);
      }
    }
  });
});

// ─── Group 3: The bijection ───────────────────────────────────────────────────

describe('Group 3 — THE BIJECTION', () => {
  it('SCALAR_MAP has exactly 50 keys', () => {
    expect(Object.keys(SCALAR_MAP).length).toBe(50);
  });

  it('income columns in SCALAR_MAP equal LIVE_INCOME_COLUMNS exactly, with 15 members each', () => {
    const mapIncomeColumns = Object.values(SCALAR_MAP)
      .filter((v) => v.table === 'income')
      .map((v) => v.column);

    expect(mapIncomeColumns.length).toBe(15);
    expect(LIVE_INCOME_COLUMNS.length).toBe(15);

    const mapSet = new Set(mapIncomeColumns);
    const liveSet = new Set(LIVE_INCOME_COLUMNS);

    // No column appears twice
    expect(mapSet.size).toBe(15);

    // Sets are equal
    for (const col of liveSet) {
      expect(mapSet.has(col), `LIVE_INCOME_COLUMNS column '${col}' missing from SCALAR_MAP`).toBe(true);
    }
    for (const col of mapSet) {
      expect(liveSet.has(col), `SCALAR_MAP income column '${col}' not in LIVE_INCOME_COLUMNS`).toBe(true);
    }
  });

  it('balance columns in SCALAR_MAP equal LIVE_BALANCE_COLUMNS exactly, with 35 members each', () => {
    const mapBalanceColumns = Object.values(SCALAR_MAP)
      .filter((v) => v.table === 'balance')
      .map((v) => v.column);

    expect(mapBalanceColumns.length).toBe(35);
    expect(LIVE_BALANCE_COLUMNS.length).toBe(35);

    const mapSet = new Set(mapBalanceColumns);
    const liveSet = new Set(LIVE_BALANCE_COLUMNS);

    // No column appears twice
    expect(mapSet.size).toBe(35);

    // Sets are equal
    for (const col of liveSet) {
      expect(mapSet.has(col), `LIVE_BALANCE_COLUMNS column '${col}' missing from SCALAR_MAP`).toBe(true);
    }
    for (const col of mapSet) {
      expect(liveSet.has(col), `SCALAR_MAP balance column '${col}' not in LIVE_BALANCE_COLUMNS`).toBe(true);
    }
  });

  it('no key of SCALAR_MAP also appears in ORPHAN_PATHS', () => {
    const orphanKeys = new Set(Object.keys(ORPHAN_PATHS));
    for (const key of Object.keys(SCALAR_MAP)) {
      expect(orphanKeys.has(key), `key '${key}' appears in both SCALAR_MAP and ORPHAN_PATHS`).toBe(false);
    }
  });
});

// ─── Group 4: Orphans ─────────────────────────────────────────────────────────

describe('Group 4 — orphans', () => {
  it('ORPHAN_PATHS has exactly 3 keys', () => {
    expect(Object.keys(ORPHAN_PATHS).length).toBe(3);
  });

  it('every ORPHAN_PATHS key returns kind unmapped with a non-empty reason', () => {
    for (const path of Object.keys(ORPHAN_PATHS)) {
      const result = mapFigurePath(path);
      expect(result.kind, `path: ${path}`).toBe('unmapped');
      if (result.kind === 'unmapped') {
        expect(result.reason.length, `path: ${path} — reason is empty`).toBeGreaterThan(0);
      }
    }
  });
});

// ─── Group 5: JSON rules, happy path ──────────────────────────────────────────

describe('Group 5 — JSON rules, happy path', () => {
  it('overheads_breakdown.rent_rates → json, income, overheads_breakdown, ["rent_rates"]', () => {
    const r = mapFigurePath('overheads_breakdown.rent_rates');
    expect(r.kind).toBe('json');
    if (r.kind === 'json') {
      expect(r.table).toBe('income');
      expect(r.column).toBe('overheads_breakdown');
      expect(r.jsonPath).toEqual(['rent_rates']);
    }
  });

  it('cost_of_sales_breakdown.direct_labour → json, income, cost_of_sales_breakdown, ["direct_labour"]', () => {
    const r = mapFigurePath('cost_of_sales_breakdown.direct_labour');
    expect(r.kind).toBe('json');
    if (r.kind === 'json') {
      expect(r.table).toBe('income');
      expect(r.column).toBe('cost_of_sales_breakdown');
      expect(r.jsonPath).toEqual(['direct_labour']);
    }
  });

  it('revenue_breakdown.by_product.Sales → json, income, revenue_breakdown, ["by_product", "Sales"]', () => {
    const r = mapFigurePath('revenue_breakdown.by_product.Sales');
    expect(r.kind).toBe('json');
    if (r.kind === 'json') {
      expect(r.table).toBe('income');
      expect(r.column).toBe('revenue_breakdown');
      expect(r.jsonPath).toEqual(['by_product', 'Sales']);
    }
  });

  it('revenue_breakdown.by_segment.UK → json, income, revenue_breakdown, ["by_segment", "UK"]', () => {
    const r = mapFigurePath('revenue_breakdown.by_segment.UK');
    expect(r.kind).toBe('json');
    if (r.kind === 'json') {
      expect(r.table).toBe('income');
      expect(r.column).toBe('revenue_breakdown');
      expect(r.jsonPath).toEqual(['by_segment', 'UK']);
    }
  });
});

// ─── Group 6: JSON rules, awkward keys ────────────────────────────────────────

describe('Group 6 — JSON rules, awkward keys', () => {
  const cases: Array<{ path: string; column: string; jsonPath: string[] }> = [
    {
      path: 'revenue_breakdown.by_product.Sales of goods',
      column: 'revenue_breakdown',
      jsonPath: ['by_product', 'Sales of goods'],
    },
    {
      path: 'revenue_breakdown.by_product.Installation - AIR CONDITIONING',
      column: 'revenue_breakdown',
      jsonPath: ['by_product', 'Installation - AIR CONDITIONING'],
    },
    {
      path: 'revenue_breakdown.by_segment.L&E Research',
      column: 'revenue_breakdown',
      jsonPath: ['by_segment', 'L&E Research'],
    },
    {
      path: 'revenue_breakdown.by_product.AliDeck (B2B specification-led)',
      column: 'revenue_breakdown',
      jsonPath: ['by_product', 'AliDeck (B2B specification-led)'],
    },
    {
      path: 'revenue_breakdown.by_product.3.5 inch panels',
      column: 'revenue_breakdown',
      jsonPath: ['by_product', '3.5 inch panels'],
    },
    {
      path: 'revenue_breakdown.by_segment.Candex Solutions (Flora)',
      column: 'revenue_breakdown',
      jsonPath: ['by_segment', 'Candex Solutions (Flora)'],
    },
    {
      path: 'overheads_breakdown.it_support_hosting',
      column: 'overheads_breakdown',
      jsonPath: ['it_support_hosting'],
    },
  ];

  for (const { path, column, jsonPath } of cases) {
    it(`'${path}' resolves correctly with key preserved byte-for-byte`, () => {
      const r = mapFigurePath(path);
      expect(r.kind, `path: ${path}`).toBe('json');
      if (r.kind === 'json') {
        expect(r.table).toBe('income');
        expect(r.column).toBe(column);
        expect(r.jsonPath).toEqual(jsonPath);
      }
    });
  }
});

// ─── Group 7: Unmapped ────────────────────────────────────────────────────────

describe('Group 7 — unmapped', () => {
  const unmappedPaths = [
    '',
    'nonsense',
    'profit_and_loss.does_not_exist',
    'balance_sheet.current_assets.does_not_exist',
    'revenue_breakdown.by_region.North',
    'revenue_breakdown.',
    'overheads_breakdown.',
    'cost_of_sales_breakdown.',
  ];

  for (const path of unmappedPaths) {
    it(`'${path || "(empty string)"}' returns kind unmapped`, () => {
      const r = mapFigurePath(path);
      expect(r.kind).toBe('unmapped');
    });
  }
});

// ─── Group 8: Never throws ────────────────────────────────────────────────────

describe('Group 8 — never throws', () => {
  const weirdInputs: unknown[] = [
    undefined,
    null,
    0,
    123,
    true,
    {},
    [],
    'x'.repeat(5000),
  ];

  for (const input of weirdInputs) {
    it(`mapFigurePath(${JSON.stringify(input)?.slice(0, 30)}) returns unmapped and does not throw`, () => {
      let result: ReturnType<typeof mapFigurePath> | undefined;
      expect(() => {
        result = mapFigurePath(input);
      }).not.toThrow();
      expect(result?.kind).toBe('unmapped');
    });
  }
});

// ─── Group 9: Completeness ────────────────────────────────────────────────────

describe('Group 9 — COMPLETENESS', () => {
  const allScalarPaths = [
    ...Object.keys(SCALAR_MAP),
    ...Object.keys(ORPHAN_PATHS),
  ];

  it('fixture array has exactly 53 entries (50 SCALAR_MAP + 3 ORPHAN_PATHS)', () => {
    expect(allScalarPaths.length).toBe(53);
  });

  it('every path classifies as scalar or unmapped-with-a-reason; count of paths classifying as neither is exactly 0', () => {
    let neitherCount = 0;
    for (const path of allScalarPaths) {
      const r = mapFigurePath(path);
      const isScalar = r.kind === 'scalar';
      const isUnmappedWithReason = r.kind === 'unmapped' && r.reason.length > 0;
      if (!isScalar && !isUnmappedWithReason) {
        neitherCount += 1;
      }
    }
    expect(neitherCount).toBe(0);
  });
});
