export interface DetailedAnalysisData {
  deal_snapshot?: DealSnapshot;
  sector_analysis?: any;
  growth_analysis?: any;
  valuation_analysis?: any;
  deal_structure?: any;
  acquisition_summary?: any;
  deal_sheet?: any;
}

export interface DealSnapshot {
  meta?: DealSnapshotMeta;
  size_profile?: SizeProfile;
  cashflow_liquidity?: CashflowLiquidity;
  leverage_balance_sheet?: LeverageBalanceSheet;
  asset_profile?: AssetProfile;
  customer_profile?: any;
  risk_scores?: RiskScore;
  [key: string]: any;
}

export interface DealSnapshotMeta {
  company_name?: string;
  industry?: string;
  latest_year?: string | number;
  data_quality?: Record<string, number>;
  key_limitations?: string[];
}

export interface SizeProfile {
  revenue_latest?: number;
  net_profit_latest?: number;
  gross_margin_pct?: number;
  net_margin_pct?: number;
  total_assets?: number;
  staff_count?: number;
}

export interface CashflowLiquidity {
  cash_at_bank?: number;
  working_capital?: number;
  current_ratio?: number;
  interest_coverage?: number;
}

export interface LeverageBalanceSheet {
  debt_to_equity?: number;
  debt_ratio?: number;
  net_assets?: number;
}

export interface AssetProfile {
  fixed_asset_turnover?: number;
  total_asset_turnover?: number;
  working_capital_turnover?: number;
  notable_asset_issues?: string[];
}

export interface RiskScore {
  [key: string]: 'green' | 'amber' | 'amber_red' | 'red';
}

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatNumber = (num: number) => {
  return new Intl.NumberFormat('en-US').format(num);
};

export const formatLabel = (text: string) => {
  return text
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const getRiskColor = (risk: string) => {
  const riskLower = risk?.toLowerCase() || '';
  if (riskLower.includes('red')) return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
  if (riskLower.includes('amber')) return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
  if (riskLower.includes('green')) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
  return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
};
