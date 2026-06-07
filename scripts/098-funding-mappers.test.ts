import { describe, it, expect } from 'vitest';
import { fundingLineToSellerPayment, fundingLineToContingent } from './098-funding-mappers';
import type { DealModelFundingLine } from '@shared/schema';

const line = (over: Partial<DealModelFundingLine>): DealModelFundingLine => ({
  id: 1, dealModelId: 8, fundingType: 'seller_financing', label: null,
  assetBaseValue: null, ltvPercent: null, availableAmount: null,
  amountUsed: '150000', interestRate: null, arrangementFeePercent: null,
  termMonths: 48, monthlyRepayment: null, isDebt: true, isActive: true,
  notes: null, sortOrder: 4, repaymentStructure: 'amortizing',
  interestAsEbitdaAdjustment: false, createdAt: null, updatedAt: null,
  ...over,
} as DealModelFundingLine);

describe('098 funding mappers', () => {
  it('seller 0% maps amount/term, includeInDscr from isDebt, interest null', () => {
    const r = fundingLineToSellerPayment(line({}));
    expect(r.amount).toBe('150000');
    expect(r.termMonths).toBe(48);
    expect(r.interestRate).toBeNull();
    expect(r.includeInDscr).toBe(true);
    expect(r.isActive).toBe(true);
    expect(r.paymentType).toBe('fixed_schedule');
  });

  it('interest-bearing seller carries the rate', () => {
    const r = fundingLineToSellerPayment(line({ interestRate: '6' }));
    expect(r.interestRate).toBe('6');
  });

  it('is_debt=false seller maps includeInDscr false', () => {
    const r = fundingLineToSellerPayment(line({ isDebt: false }));
    expect(r.includeInDscr).toBe(false);
  });

  it('seller carries label and sortOrder', () => {
    const r = fundingLineToSellerPayment(line({ label: 'Deferred', sortOrder: 3 }));
    expect(r.label).toBe('Deferred');
    expect(r.sortOrder).toBe(3);
  });

  it('inactive seller carries isActive false', () => {
    const r = fundingLineToSellerPayment(line({ isActive: false }));
    expect(r.isActive).toBe(false);
  });

  it('earnout maps amountUsed to maximumAmount, includeInDscr from isDebt', () => {
    const r = fundingLineToContingent(line({ fundingType: 'earnout', amountUsed: '200000', isDebt: true }));
    expect(r.maximumAmount).toBe('200000');
    expect(r.considerationType).toBe('custom');
    expect(r.includeInDscr).toBe(true);
  });

  it('is_debt=false earnout maps includeInDscr false', () => {
    const r = fundingLineToContingent(line({ fundingType: 'earnout', isDebt: false }));
    expect(r.includeInDscr).toBe(false);
  });

  it('earnout carries notes to triggerDescription', () => {
    const r = fundingLineToContingent(line({ fundingType: 'earnout', notes: 'EBITDA target' }));
    expect(r.triggerDescription).toBe('EBITDA target');
  });
});
