/**
 * Slice 3d.1 - canonical figure_path to live column mapping.
 *
 * PURE. No database access, no imports from server/, no clock, no I/O.
 * NEVER THROWS. Unrecognised input returns { kind: 'unmapped' }.
 *
 * Keyed on the FULL figure_path string, NEVER on field_key. field_key is not
 * unique within a statement type: 'total' is the leaf on four different balance
 * paths, 'other_debtors' on both a current asset and a current liability path,
 * and 'corporation_tax' on both a P&L and a balance path. Keying on the leaf is
 * the #361 defect in the read direction.
 *
 * JSON sections are matched by PREFIX AND REMAINDER, never by split('.'), because
 * revenue breakdown keys are free text supplied by the document and are known to
 * contain spaces, hyphens, ampersands and parentheses, and may contain dots.
 */

export type LiveTable = 'income' | 'balance';

export interface LiveScalarTarget {
  kind: 'scalar';
  table: LiveTable;
  column: string;
}

/** All three JSON breakdown columns live on income_statements. */
export interface LiveJsonTarget {
  kind: 'json';
  table: 'income';
  column: string;
  jsonPath: string[];
}

export interface LiveUnmappedTarget {
  kind: 'unmapped';
  reason: string;
}

export type LiveTarget = LiveScalarTarget | LiveJsonTarget | LiveUnmappedTarget;

/** The 15 decimal columns on income_statements. Verified against schema at 3d.1. */
export const LIVE_INCOME_COLUMNS: readonly string[] = [
  'revenue',
  'cost_of_sales',
  'gross_profit',
  'administrative_expenses',
  'depreciation_amortisation',
  'other_operating_income',
  'operating_profit',
  'interest_receivable',
  'interest_payable',
  'profit_before_tax',
  'corporation_tax',
  'net_profit',
  'staff_costs',
  'directors_remuneration',
  'dividends_paid',
];

/** The 35 decimal columns on balance_sheets. Verified against schema at 3d.1. */
export const LIVE_BALANCE_COLUMNS: readonly string[] = [
  'intangible_assets',
  'tangible_fixed_assets',
  'freehold_property',
  'leasehold_property',
  'plant_machinery',
  'fixtures_fittings',
  'motor_vehicles',
  'computer_equipment',
  'stock_inventory',
  'trade_debtors',
  'prepayments',
  'amounts_owed_by_directors',
  'amounts_owed_by_connected_companies',
  'directors_current_account',
  'other_debtors',
  'cash_at_bank',
  'total_current_assets',
  'trade_creditors',
  'taxation_social_security',
  'vat_payable',
  'corporation_tax_due',
  'bank_loans_overdraft_current',
  'hire_purchase_current',
  'accruals',
  'amounts_owed_to_directors',
  'other_creditors',
  'total_current_liabilities',
  'bank_loans_long_term',
  'hire_purchase_long_term',
  'deferred_taxation',
  'other_long_term_debt',
  'total_long_term_liabilities',
  'share_capital',
  'retained_earnings',
  'total_equity',
];

/**
 * The 50 scalar figure_paths that resolve to a live column.
 * 15 income, 35 balance. Every live decimal column is hit exactly once.
 */
export const SCALAR_MAP: Readonly<Record<string, { table: LiveTable; column: string }>> = {
  'profit_and_loss.revenue': { table: 'income', column: 'revenue' },
  'profit_and_loss.cost_of_sales': { table: 'income', column: 'cost_of_sales' },
  'profit_and_loss.gross_profit': { table: 'income', column: 'gross_profit' },
  'profit_and_loss.administrative_expenses': { table: 'income', column: 'administrative_expenses' },
  'profit_and_loss.depreciation_amortisation': { table: 'income', column: 'depreciation_amortisation' },
  'profit_and_loss.other_operating_income': { table: 'income', column: 'other_operating_income' },
  'profit_and_loss.operating_profit': { table: 'income', column: 'operating_profit' },
  'profit_and_loss.interest_receivable': { table: 'income', column: 'interest_receivable' },
  'profit_and_loss.interest_payable': { table: 'income', column: 'interest_payable' },
  'profit_and_loss.profit_before_tax': { table: 'income', column: 'profit_before_tax' },
  'profit_and_loss.corporation_tax': { table: 'income', column: 'corporation_tax' },
  'profit_and_loss.net_profit': { table: 'income', column: 'net_profit' },
  'total_staff_costs': { table: 'income', column: 'staff_costs' },
  'total_directors_remuneration': { table: 'income', column: 'directors_remuneration' },
  'dividends_paid': { table: 'income', column: 'dividends_paid' },

  'balance_sheet.fixed_assets.intangible_assets': { table: 'balance', column: 'intangible_assets' },
  'balance_sheet.fixed_assets.tangible_assets': { table: 'balance', column: 'tangible_fixed_assets' },
  'balance_sheet.fixed_assets.freehold_property': { table: 'balance', column: 'freehold_property' },
  'balance_sheet.fixed_assets.leasehold_property': { table: 'balance', column: 'leasehold_property' },
  'balance_sheet.fixed_assets.plant_machinery': { table: 'balance', column: 'plant_machinery' },
  'balance_sheet.fixed_assets.fixtures_fittings': { table: 'balance', column: 'fixtures_fittings' },
  'balance_sheet.fixed_assets.motor_vehicles': { table: 'balance', column: 'motor_vehicles' },
  'balance_sheet.fixed_assets.computer_equipment': { table: 'balance', column: 'computer_equipment' },
  'balance_sheet.current_assets.stock': { table: 'balance', column: 'stock_inventory' },
  'balance_sheet.current_assets.trade_debtors': { table: 'balance', column: 'trade_debtors' },
  'balance_sheet.current_assets.prepayments': { table: 'balance', column: 'prepayments' },
  'balance_sheet.current_assets.amounts_owed_by_directors': { table: 'balance', column: 'amounts_owed_by_directors' },
  'balance_sheet.current_assets.amounts_owed_by_connected_companies': { table: 'balance', column: 'amounts_owed_by_connected_companies' },
  'balance_sheet.current_assets.directors_current_account': { table: 'balance', column: 'directors_current_account' },
  'balance_sheet.current_assets.other_debtors': { table: 'balance', column: 'other_debtors' },
  'balance_sheet.current_assets.cash_at_bank': { table: 'balance', column: 'cash_at_bank' },
  'balance_sheet.current_assets.total': { table: 'balance', column: 'total_current_assets' },
  'balance_sheet.current_liabilities.trade_creditors': { table: 'balance', column: 'trade_creditors' },
  'balance_sheet.current_liabilities.taxation_social_security': { table: 'balance', column: 'taxation_social_security' },
  'balance_sheet.current_liabilities.vat_payable': { table: 'balance', column: 'vat_payable' },
  'balance_sheet.current_liabilities.corporation_tax': { table: 'balance', column: 'corporation_tax_due' },
  'balance_sheet.current_liabilities.bank_loans_current': { table: 'balance', column: 'bank_loans_overdraft_current' },
  'balance_sheet.current_liabilities.hire_purchase_current': { table: 'balance', column: 'hire_purchase_current' },
  'balance_sheet.current_liabilities.accruals': { table: 'balance', column: 'accruals' },
  'balance_sheet.current_liabilities.amounts_owed_to_directors': { table: 'balance', column: 'amounts_owed_to_directors' },
  'balance_sheet.current_liabilities.other_creditors': { table: 'balance', column: 'other_creditors' },
  'balance_sheet.current_liabilities.total': { table: 'balance', column: 'total_current_liabilities' },
  'balance_sheet.long_term_liabilities.bank_loans': { table: 'balance', column: 'bank_loans_long_term' },
  'balance_sheet.long_term_liabilities.hire_purchase_long_term': { table: 'balance', column: 'hire_purchase_long_term' },
  'balance_sheet.long_term_liabilities.deferred_taxation': { table: 'balance', column: 'deferred_taxation' },
  'balance_sheet.long_term_liabilities.other_debt': { table: 'balance', column: 'other_long_term_debt' },
  'balance_sheet.long_term_liabilities.total': { table: 'balance', column: 'total_long_term_liabilities' },
  'balance_sheet.equity.share_capital': { table: 'balance', column: 'share_capital' },
  'balance_sheet.equity.retained_earnings': { table: 'balance', column: 'retained_earnings' },
  'balance_sheet.equity.total': { table: 'balance', column: 'total_equity' },
};

/**
 * The 3 scalar figure_paths that exist in the canonical corpus and have no live
 * column. One row each on dev as at 4 August 2026. Two look like extraction
 * misfiles and one is a concept the live schema never modelled.
 */
export const ORPHAN_PATHS: Readonly<Record<string, string>> = {
  'balance_sheet.fixed_assets.investments':
    'balance_sheets has no investments column; the concept was never modelled live',
  'balance_sheet.current_liabilities.other_debt':
    'only long_term_liabilities.other_debt has a live column (other_long_term_debt); the current-liability variant has none',
  'balance_sheet.current_liabilities.other_debtors':
    'a debtor filed under liabilities; no live column and probably an extraction misfile',
};

const JSON_PREFIX_RULES: ReadonlyArray<{
  prefix: string;
  column: string;
  group?: string;
}> = [
  { prefix: 'revenue_breakdown.by_product.', column: 'revenue_breakdown', group: 'by_product' },
  { prefix: 'revenue_breakdown.by_segment.', column: 'revenue_breakdown', group: 'by_segment' },
  { prefix: 'overheads_breakdown.', column: 'overheads_breakdown' },
  { prefix: 'cost_of_sales_breakdown.', column: 'cost_of_sales_breakdown' },
];

/**
 * Resolve a canonical figure_path to its live target.
 * Never throws. Never returns a partial object.
 */
export function mapFigurePath(figurePath: unknown): LiveTarget {
  if (typeof figurePath !== 'string' || figurePath.length === 0) {
    return { kind: 'unmapped', reason: 'figure_path is not a non-empty string' };
  }

  const orphanReason = ORPHAN_PATHS[figurePath];
  if (orphanReason !== undefined) {
    return { kind: 'unmapped', reason: orphanReason };
  }

  const scalar = SCALAR_MAP[figurePath];
  if (scalar !== undefined) {
    return { kind: 'scalar', table: scalar.table, column: scalar.column };
  }

  for (const rule of JSON_PREFIX_RULES) {
    if (figurePath.startsWith(rule.prefix)) {
      const remainder = figurePath.slice(rule.prefix.length);
      if (remainder.length === 0) {
        return {
          kind: 'unmapped',
          reason: `figure_path '${figurePath}' has prefix '${rule.prefix}' but an empty key`,
        };
      }
      return {
        kind: 'json',
        table: 'income',
        column: rule.column,
        jsonPath: rule.group ? [rule.group, remainder] : [remainder],
      };
    }
  }

  return { kind: 'unmapped', reason: `figure_path '${figurePath}' matches no scalar entry and no JSON prefix rule` };
}
