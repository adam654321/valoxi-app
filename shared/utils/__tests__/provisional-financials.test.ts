import { describe, it, expect } from 'vitest';
import { isProvisionalFinancials } from '../provisional-financials';

describe('isProvisionalFinancials — IM-only provisional flag (Item B)', () => {
  it('returns TRUE when company has ONLY information_memorandum contributions', () => {
    expect(isProvisionalFinancials([
      { sourceTier: 'information_memorandum' },
      { sourceTier: 'information_memorandum' },
    ])).toBe(true);
  });

  it('returns FALSE when company has any statutory contribution', () => {
    expect(isProvisionalFinancials([
      { sourceTier: 'information_memorandum' },
      { sourceTier: 'statutory' },
    ])).toBe(false);
  });

  it('returns FALSE when company has any management contribution', () => {
    expect(isProvisionalFinancials([
      { sourceTier: 'management' },
    ])).toBe(false);
  });

  it('returns FALSE when company has a user_override contribution', () => {
    expect(isProvisionalFinancials([
      { sourceTier: 'user_override' },
    ])).toBe(false);
  });

  it('returns TRUE when there are no contributions at all (nothing real to base figures on)', () => {
    expect(isProvisionalFinancials([])).toBe(true);
  });
});
