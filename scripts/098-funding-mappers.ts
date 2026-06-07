import type {
  DealModelFundingLine,
  InsertDealModelSellerPayment,
  InsertDealModelContingentConsideration,
} from '@shared/schema';

// Maps a legacy seller_financing funding line to a seller-payment row.
// includeInDscr carries isDebt verbatim (zero-shift migration).
export function fundingLineToSellerPayment(line: DealModelFundingLine): InsertDealModelSellerPayment {
  return {
    dealModelId: line.dealModelId,
    paymentType: 'fixed_schedule',
    amount: line.amountUsed ?? '0',
    termMonths: line.termMonths ?? null,
    interestRate: line.interestRate ?? null,
    label: line.label ?? null,
    includeInDscr: line.isDebt ?? false,
    isActive: line.isActive ?? false,
    sortOrder: line.sortOrder ?? 0,
  };
}

// Maps a legacy earnout funding line to a contingent-consideration row.
// maximumAmount carries amountUsed; the contingent table has no interest column.
export function fundingLineToContingent(line: DealModelFundingLine): InsertDealModelContingentConsideration {
  return {
    dealModelId: line.dealModelId,
    considerationType: 'custom',
    maximumAmount: line.amountUsed ?? '0',
    termMonths: line.termMonths ?? null,
    triggerDescription: line.notes ?? null,
    includeInDscr: line.isDebt ?? false,
    isActive: line.isActive ?? false,
    sortOrder: line.sortOrder ?? 0,
  };
}
