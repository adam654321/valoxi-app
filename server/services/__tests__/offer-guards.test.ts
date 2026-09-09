/**
 * Commercial guards, items #296 and #324. Slice 1: predicates only.
 * These prove the predicate behaviour. Nothing is wired to a call site yet.
 */
import { describe, it, expect } from 'vitest';
import {
  hasValuationEligibleYear,
  isOfferPriceSupportable,
  assessOfferSupportability,
  calculateFullDealModel,
  NO_VALUATION_ELIGIBLE_YEAR,
  OFFER_NOT_SUPPORTABLE,
} from '@shared/calculators/deal-model.calc';

describe('hasValuationEligibleYear (#296)', () => {
  it('empty map is not eligible', () => {
    expect(hasValuationEligibleYear({})).toBe(false);
  });

  it('null and undefined are not eligible', () => {
    expect(hasValuationEligibleYear(null)).toBe(false);
    expect(hasValuationEligibleYear(undefined)).toBe(false);
  });

  it('a single year is eligible', () => {
    expect(hasValuationEligibleYear({ '2024': 180000 })).toBe(true);
  });

  it('a year with zero EBITDA is still an eligible year', () => {
    expect(hasValuationEligibleYear({ '2024': 0 })).toBe(true);
  });

  it('multiple years are eligible', () => {
    expect(hasValuationEligibleYear({ '2023': 150000, '2024': 180000 })).toBe(true);
  });
});

describe('isOfferPriceSupportable (#324)', () => {
  it('a positive price is supportable', () => {
    expect(isOfferPriceSupportable(250000)).toBe(true);
    expect(isOfferPriceSupportable(1)).toBe(true);
  });

  it('zero is not supportable', () => {
    expect(isOfferPriceSupportable(0)).toBe(false);
  });

  it('tc228 at minus 4,411 is not supportable', () => {
    expect(isOfferPriceSupportable(-4411)).toBe(false);
  });

  it('tc89 at minus 771,213 is not supportable', () => {
    expect(isOfferPriceSupportable(-771213)).toBe(false);
  });

  it('null, undefined, NaN and Infinity are not supportable', () => {
    expect(isOfferPriceSupportable(null)).toBe(false);
    expect(isOfferPriceSupportable(undefined)).toBe(false);
    expect(isOfferPriceSupportable(NaN)).toBe(false);
    expect(isOfferPriceSupportable(Infinity)).toBe(false);
  });
});

describe('assessOfferSupportability', () => {
  it('passes when there is an eligible year and a positive price', () => {
    const result = assessOfferSupportability({ '2024': 100000 }, 250000);
    expect(result.supportable).toBe(true);
  });

  it('blocks on eligibility even when the price looks fine', () => {
    const result = assessOfferSupportability({}, 500000);
    expect(result.supportable).toBe(false);
    if (!result.supportable) expect(result.reason).toBe(NO_VALUATION_ELIGIBLE_YEAR);
  });

  it('blocks on price when there is an eligible year', () => {
    const result = assessOfferSupportability({ '2024': 100000 }, -4411);
    expect(result.supportable).toBe(false);
    if (!result.supportable) expect(result.reason).toBe(OFFER_NOT_SUPPORTABLE);
  });

  it('eligibility takes precedence when both fail', () => {
    const result = assessOfferSupportability({}, -4411);
    expect(result.supportable).toBe(false);
    if (!result.supportable) expect(result.reason).toBe(NO_VALUATION_ELIGIBLE_YEAR);
  });

  it('carries a non-empty message on every block', () => {
    const a = assessOfferSupportability({}, 1);
    const b = assessOfferSupportability({ '2024': 1 }, 0);
    if (!a.supportable) expect(a.message.length).toBeGreaterThan(0);
    if (!b.supportable) expect(b.message.length).toBeGreaterThan(0);
  });
});

describe('slice 1 is additive: the calculator still behaves exactly as before', () => {
  const emptyModel = {
    averagingYears: 3,
    ebitdaMultiple: '3.0',
    plusExcessCash: '0',
    minusPrimaryDebt: '100000',
    minusOtherDebt: '0',
    minusCorpTaxDue: '0',
    minusWorkingCapitalAdj: '0',
    plusPropertyValue: '0',
  };

  it('no eligible years still produces a negative offer price, unguarded', () => {
    const result = calculateFullDealModel({}, [], [], emptyModel);
    expect(result.averageAdjustedEbitda).toBe(0);
    expect(result.enterpriseValue).toBe(0);
    expect(result.offerPrice).toBe(-100000);
  });

  it('and the predicate would have caught it', () => {
    const result = calculateFullDealModel({}, [], [], emptyModel);
    const verdict = assessOfferSupportability({}, result.offerPrice);
    expect(verdict.supportable).toBe(false);
  });
});