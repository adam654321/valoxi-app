import { describe, it, expect } from 'vitest';

function parseDecimal(value: any): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'string') {
    const cleaned = value.replace(/[£$,\s]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed.toString();
  }
  return null;
}

describe('parseDecimal', () => {
  it('returns null for null, undefined, and empty string', () => {
    expect(parseDecimal(null)).toBeNull();
    expect(parseDecimal(undefined)).toBeNull();
    expect(parseDecimal('')).toBeNull();
  });

  it('converts a plain number to string', () => {
    expect(parseDecimal(1234.56)).toBe('1234.56');
    expect(parseDecimal(0)).toBe('0');
    expect(parseDecimal(-500)).toBe('-500');
  });

  it('parses clean numeric strings', () => {
    expect(parseDecimal('1000')).toBe('1000');
    expect(parseDecimal('99.99')).toBe('99.99');
  });

  it('strips pound signs', () => {
    expect(parseDecimal('£1234')).toBe('1234');
    expect(parseDecimal('£50.00')).toBe('50');
  });

  it('strips dollar signs', () => {
    expect(parseDecimal('$2500')).toBe('2500');
    expect(parseDecimal('$1,234.56')).toBe('1234.56');
  });

  it('strips commas from formatted numbers', () => {
    expect(parseDecimal('1,000,000')).toBe('1000000');
    expect(parseDecimal('12,345.67')).toBe('12345.67');
  });

  it('strips whitespace', () => {
    expect(parseDecimal(' 100 ')).toBe('100');
    expect(parseDecimal('£ 1,234')).toBe('1234');
  });

  it('handles combined currency + commas + spaces', () => {
    expect(parseDecimal('£ 1,234,567.89')).toBe('1234567.89');
    expect(parseDecimal('$ 99,000')).toBe('99000');
  });

  it('returns null for non-numeric strings', () => {
    expect(parseDecimal('N/A')).toBeNull();
    expect(parseDecimal('not a number')).toBeNull();
    expect(parseDecimal('-')).toBeNull();
  });

  it('returns null for non-string, non-number types', () => {
    expect(parseDecimal({})).toBeNull();
    expect(parseDecimal([])).toBeNull();
    expect(parseDecimal(true)).toBeNull();
  });

  it('handles negative string values', () => {
    expect(parseDecimal('-500')).toBe('-500');
    expect(parseDecimal('-1,234.56')).toBe('-1234.56');
  });
});
