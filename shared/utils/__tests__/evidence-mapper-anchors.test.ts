import { describe, it, expect } from 'vitest';
import { mapPayloadToEvidence } from '../evidence-mapper';

const BASE = {
  targetCompanyId: 1,
  documentId: 1,
  documentAnalysisResultId: null,
  documentType: 'profit_and_loss',
  extractionVersion: 1,
};

// ─── 1. root shape with period_starts ───────────────────────────────────────

describe('mapPayloadToEvidence — period_starts', () => {
  it('root shape: periodStart set per year from period_starts', () => {
    const payload: Record<string, unknown> = {
      period_starts:  { '2022': '2022-04-01', '2023': '2023-04-01' },
      period_ends:    { '2022': '2023-03-31', '2023': '2024-03-31' },
      months_covered: { '2022': 12, '2023': 12 },
      years: {
        '2022': { year: 2022, profit_and_loss: { revenue: 100000 } },
        '2023': { year: 2023, profit_and_loss: { revenue: 120000 } },
      },
    };
    const { periods } = mapPayloadToEvidence({ ...BASE, payload });
    expect(periods.find(p => p.fiscalYearStated === 2022)?.periodStart).toBe('2022-04-01');
    expect(periods.find(p => p.fiscalYearStated === 2023)?.periodStart).toBe('2023-04-01');
  });

  it('period_starts absent: periodStart null on every period', () => {
    const payload: Record<string, unknown> = {
      period_ends:    { '2022': '2023-03-31' },
      months_covered: { '2022': 12 },
      years: {
        '2022': { year: 2022, profit_and_loss: { revenue: 100000 } },
      },
    };
    const { periods } = mapPayloadToEvidence({ ...BASE, payload });
    expect(periods).toHaveLength(1);
    expect(periods[0].periodStart).toBeNull();
  });

  it('wrapped shape conflict: balance_sheet wins, one period_start_conflict anomaly (trust_blocking)', () => {
    const payload: Record<string, unknown> = {
      balance_sheet: {
        period_starts:  { '2022': '2022-04-01' },
        period_ends:    { '2022': '2023-03-31' },
        months_covered: { '2022': 12 },
        years: { '2022': { year: 2022, balance_sheet: { equity: { total: 50000 } } } },
      },
      profit_and_loss: {
        period_starts:  { '2022': '2022-05-01' },
        period_ends:    { '2022': '2023-03-31' },
        months_covered: { '2022': 12 },
        years: { '2022': { year: 2022, profit_and_loss: { revenue: 100000 } } },
      },
    };
    const { periods } = mapPayloadToEvidence({ ...BASE, documentType: 'company_accounts', payload });
    expect(periods[0].periodStart).toBe('2022-04-01');
    const conflicts = periods[0].anomalies.filter(a => a.type === 'period_start_conflict');
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].severity).toBe('trust_blocking');
    expect(conflicts[0].detail).toMatchObject({
      fiscalYear: '2022',
      used: '2022-04-01',
      usedSource: 'balance_sheet',
      discarded: '2022-05-01',
      discardedSource: 'profit_and_loss',
    });
  });
});

// ─── figure anchors ──────────────────────────────────────────────────────────

describe('mapPayloadToEvidence — figure anchors (1c.2b)', () => {
  const ROOT_PAYLOAD: Record<string, unknown> = {
    period_ends:    { '2022': '2023-03-31' },
    months_covered: { '2022': 12 },
    years: {
      '2022': { year: 2022, profit_and_loss: { revenue: 100000, cost_of_sales: 40000 } },
    },
  };

  it('1. anchor with page and label lands on the matching figure', () => {
    const payload = {
      ...ROOT_PAYLOAD,
      anchors: { 'years.2022.profit_and_loss.revenue': { page: 4, label: 'Turnover' } },
    };
    const { periods } = mapPayloadToEvidence({ ...BASE, payload });
    const fig = periods[0].figures.find(f => f.fieldKey === 'revenue');
    expect(fig?.pageNumber).toBe(4);
    expect(fig?.labelTextAsPrinted).toBe('Turnover');
  });

  it('2. figure with no anchor entry: both null', () => {
    const payload = {
      ...ROOT_PAYLOAD,
      anchors: { 'years.2022.profit_and_loss.revenue': { page: 4, label: 'Turnover' } },
    };
    const { periods } = mapPayloadToEvidence({ ...BASE, payload });
    const fig = periods[0].figures.find(f => f.fieldKey === 'cost_of_sales');
    expect(fig?.pageNumber).toBeNull();
    expect(fig?.labelTextAsPrinted).toBeNull();
  });

  it('3. anchor with page only: label null, page set', () => {
    const payload = {
      ...ROOT_PAYLOAD,
      anchors: { 'years.2022.profit_and_loss.revenue': { page: 5 } },
    };
    const { periods } = mapPayloadToEvidence({ ...BASE, payload });
    const fig = periods[0].figures.find(f => f.fieldKey === 'revenue');
    expect(fig?.pageNumber).toBe(5);
    expect(fig?.labelTextAsPrinted).toBeNull();
  });

  it('4. anchor with label only: page null, label set', () => {
    const payload = {
      ...ROOT_PAYLOAD,
      anchors: { 'years.2022.profit_and_loss.revenue': { label: 'Turnover' } },
    };
    const { periods } = mapPayloadToEvidence({ ...BASE, payload });
    const fig = periods[0].figures.find(f => f.fieldKey === 'revenue');
    expect(fig?.pageNumber).toBeNull();
    expect(fig?.labelTextAsPrinted).toBe('Turnover');
  });

  it('5. anchor page as string "12": pageNumber null (no coercion), label still applied', () => {
    const payload = {
      ...ROOT_PAYLOAD,
      anchors: { 'years.2022.profit_and_loss.revenue': { page: '12', label: 'Turnover' } },
    };
    const { periods } = mapPayloadToEvidence({ ...BASE, payload });
    const fig = periods[0].figures.find(f => f.fieldKey === 'revenue');
    expect(fig?.pageNumber).toBeNull();
    expect(fig?.labelTextAsPrinted).toBe('Turnover');
  });

  it('6. anchors present but no key matches any figure: every figure null, figure count unchanged', () => {
    const payloadWithAnchors = {
      ...ROOT_PAYLOAD,
      anchors: { 'years.2022.profit_and_loss.nonexistent': { page: 1, label: 'Whatever' } },
    };
    const payloadWithout = { ...ROOT_PAYLOAD };
    const { periods: pWith } = mapPayloadToEvidence({ ...BASE, payload: payloadWithAnchors });
    const { periods: pWithout } = mapPayloadToEvidence({ ...BASE, payload: payloadWithout });
    expect(pWith[0].figures.length).toBe(pWithout[0].figures.length);
    for (const fig of pWith[0].figures) {
      expect(fig.pageNumber).toBeNull();
      expect(fig.labelTextAsPrinted).toBeNull();
    }
  });

  it('7. wrapped shape: balance_sheet anchor applies at prefixed path', () => {
    const payload: Record<string, unknown> = {
      balance_sheet: {
        period_ends:    { '2022': '2023-03-31' },
        months_covered: { '2022': 12 },
        anchors: { 'years.2022.balance_sheet.equity.total': { page: 7, label: 'Net Assets' } },
        years: { '2022': { year: 2022, balance_sheet: { equity: { total: 50000 } } } },
      },
    };
    const { periods } = mapPayloadToEvidence({ ...BASE, documentType: 'company_accounts', payload });
    const fig = periods[0].figures.find(f => f.payloadPath === 'balance_sheet.years.2022.balance_sheet.equity.total');
    expect(fig?.pageNumber).toBe(7);
    expect(fig?.labelTextAsPrinted).toBe('Net Assets');
  });

  it('8. wrapped shape: profit_and_loss anchor applies at prefixed path', () => {
    const payload: Record<string, unknown> = {
      profit_and_loss: {
        period_ends:    { '2022': '2023-03-31' },
        months_covered: { '2022': 12 },
        anchors: { 'years.2022.profit_and_loss.revenue': { page: 3, label: 'Revenue' } },
        years: { '2022': { year: 2022, profit_and_loss: { revenue: 100000 } } },
      },
    };
    const { periods } = mapPayloadToEvidence({ ...BASE, documentType: 'company_accounts', payload });
    const fig = periods[0].figures.find(f => f.payloadPath === 'profit_and_loss.years.2022.profit_and_loss.revenue');
    expect(fig?.pageNumber).toBe(3);
    expect(fig?.labelTextAsPrinted).toBe('Revenue');
  });
});

describe('mapPayloadToEvidence — identity block (1c.2b-A3)', () => {
  it('root identity block: all eight fields mapped, identityVerdict remains null', () => {
    const payload = {
      identity: {
        company_names_found: ['Acme Ltd'],
        registered_numbers_found: ['12345678'],
        year_end_stated: '2023-03-31',
        directors_named: ['Jane Smith', 'Bob Jones'],
        accountant_name: 'Big Four LLP',
        is_draft: false,
        is_abridged: false,
        is_signed: true,
      },
    };
    const { evidence } = mapPayloadToEvidence({ ...BASE, documentType: 'company_accounts', payload });
    expect(evidence.companyNamesFound).toEqual(['Acme Ltd']);
    expect(evidence.registeredNumbersFound).toEqual(['12345678']);
    expect(evidence.yearEndStated).toBe('2023-03-31');
    expect(evidence.directorsNamed).toEqual(['Jane Smith', 'Bob Jones']);
    expect(evidence.accountantName).toBe('Big Four LLP');
    expect(evidence.isDraft).toBe(false);
    expect(evidence.isAbridged).toBe(false);
    expect(evidence.isSigned).toBe(true);
    expect(evidence.identityVerdict).toBeNull();
  });

  it('identity absent: all eight fields null', () => {
    const payload = {};
    const { evidence } = mapPayloadToEvidence({ ...BASE, documentType: 'company_accounts', payload });
    expect(evidence.companyNamesFound).toBeNull();
    expect(evidence.registeredNumbersFound).toBeNull();
    expect(evidence.yearEndStated).toBeNull();
    expect(evidence.directorsNamed).toBeNull();
    expect(evidence.accountantName).toBeNull();
    expect(evidence.isDraft).toBeNull();
    expect(evidence.isAbridged).toBeNull();
    expect(evidence.isSigned).toBeNull();
  });

  it('wrapped shape: identity on balance_sheet resolved via precedence; junk filtered', () => {
    const payload = {
      balance_sheet: {
        identity: {
          company_names_found: ['Beta Corp', '', 42],
          registered_numbers_found: [],
          year_end_stated: '',
          directors_named: ['Alice'],
          accountant_name: 'Small Firm',
          is_draft: true,
          is_abridged: false,
          is_signed: 'true',
        },
      },
    };
    const { evidence } = mapPayloadToEvidence({ ...BASE, documentType: 'company_accounts', payload });
    // Non-strings and empty strings dropped; 42 and '' removed → ['Beta Corp']
    expect(evidence.companyNamesFound).toEqual(['Beta Corp']);
    // Empty array → null
    expect(evidence.registeredNumbersFound).toBeNull();
    // Empty string → null
    expect(evidence.yearEndStated).toBeNull();
    expect(evidence.directorsNamed).toEqual(['Alice']);
    expect(evidence.accountantName).toBe('Small Firm');
    expect(evidence.isDraft).toBe(true);
    expect(evidence.isAbridged).toBe(false);
    // String 'true' is not a boolean → null
    expect(evidence.isSigned).toBeNull();
  });
});
