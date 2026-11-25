import { describe, it, expect } from 'vitest';
import { resolveCheckoutTrial, NO_TRIAL_PROMO_SLUGS, STANDARD_TRIAL_DAYS } from './checkout-trial';

describe('resolveCheckoutTrial', () => {
  const now = new Date('2026-11-26T09:00:00Z');

  it('gives the standard 7-day trial when there is no campaign', () => {
    expect(resolveCheckoutTrial(null, now)).toEqual({ kind: 'standard', trialDays: STANDARD_TRIAL_DAYS });
    expect(STANDARD_TRIAL_DAYS).toBe(7);
  });

  it('gives the standard 7-day trial to an ordinary coupon campaign', () => {
    expect(resolveCheckoutTrial({ slug: 'some-partner', freeMonthsTotal: 0 }, now)).toEqual({
      kind: 'standard',
      trialDays: 7,
    });
  });

  it('gives no trial to the Black Friday annual offer', () => {
    expect(NO_TRIAL_PROMO_SLUGS.has('bf26-annual')).toBe(true);
    expect(resolveCheckoutTrial({ slug: 'bf26-annual', freeMonthsTotal: 0 }, now)).toEqual({ kind: 'none' });
  });

  it('keeps the one-month trial for the Black Friday monthly offer', () => {
    // 26 Nov to 26 Dec is 30 days.
    expect(resolveCheckoutTrial({ slug: 'bf26-free-month', freeMonthsTotal: 1 }, now)).toEqual({
      kind: 'free_months',
      trialDays: 30,
    });
  });

  it('lets free months win over the no-trial list', () => {
    expect(resolveCheckoutTrial({ slug: 'bf26-annual', freeMonthsTotal: 6 }, now).kind).toBe('free_months');
  });
});
