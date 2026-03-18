import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  FileText,
  AlertCircle,
  Eye,
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Clock,
  Plus,
  Calendar,
  List,
  Code,
  Lock,
  ArrowUpRight,
  RefreshCw
} from "lucide-react";
import { Link } from "wouter";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { DocumentAnalysisResult } from "./types";

interface AnalysisDisplayProps {
  results: DocumentAnalysisResult[];
  isLoading: boolean;
  isRetryingAnalysis: boolean;
  onRetryAnalysis: () => void;
  documentUploadedAt?: string;
  isPendingAnalysis?: boolean;
  featureGated?: boolean;
  nonRetryableError?: string | null;
  pollExhausted?: boolean;
}

export function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function processObservationsText(text: string | string[] | null | undefined): string {
  if (!text) return '';
  // Handle array of observations
  if (Array.isArray(text)) {
    return text.map(t => typeof t === 'string' ? t : String(t)).join('\n• ');
  }
  // Handle non-string values
  if (typeof text !== 'string') {
    return String(text);
  }
  return text
    .replace(/\\n/g, '\n')
    .replace(/\n\*/g, '\n• ')
    .replace(/^\*/g, '• ');
}

export function formatDocumentType(documentType: string, analysisData?: any) {
  if (analysisData && analysisData.document === 'company_accounts') {
    return 'Company Accounts';
  }
  
  const typeMap: Record<string, string> = {
    'sales_ledger': 'Sales Ledger',
    'staff_matrix': 'Staff Matrix',
    'asset_register': 'Asset Register',
    'profit_and_loss': 'Profit & Loss',
    'balance_sheet': 'Balance Sheet'
  };
  return typeMap[documentType] || documentType;
}

export function getDocumentTypeColor(documentType: string, analysisData?: any) {
  if (analysisData && analysisData.document === 'company_accounts') {
    return 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200';
  }
  
  const colorMap: Record<string, string> = {
    'sales_ledger': 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
    'staff_matrix': 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
    'asset_register': 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200',
    'profit_and_loss': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200',
    'balance_sheet': 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200'
  };
  return colorMap[documentType] || 'bg-muted text-foreground';
}

function getInvoiceStatusColor(status: string) {
  const statusLower = status.toLowerCase();
  if (statusLower === 'paid') {
    return 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800/60';
  } else if (statusLower === 'part paid') {
    return 'bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800/60';
  } else if (statusLower === 'unpaid') {
    return 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800/60';
  }
  return 'bg-muted border-border';
}

function renderStaffMatrixAnalysis(analysisData: any) {
  // Support both flat format and nested summary format
  const summary = analysisData.summary || {};
  const totalEmployees = analysisData.total_employee_count || summary.total_headcount || 0;
  const totalPayroll = analysisData.total_annual_payroll || summary.total_staff_costs || summary.total_gross_salaries || 0;
  const avgSalary = analysisData.average_salary || (totalEmployees > 0 ? Math.round(totalPayroll / totalEmployees) : 0);
  const directorCount = summary.director_count || analysisData.director_count || 0;
  const employeeCount = summary.employee_count || analysisData.employee_count || (totalEmployees - directorCount);
  
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="w-4 h-4" />
              Total Employees
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEmployees}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Annual Payroll
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£{totalPayroll?.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              Average Salary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">£{avgSalary?.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-green-600" />
              Directors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {directorCount}
            </div>
          </CardContent>
        </Card>
      </div>

      {analysisData.employment_type_breakdown && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Employment Type Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(analysisData.employment_type_breakdown).map(([type, count]: [string, any]) => (
                <div key={type} className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-semibold">{count}</div>
                  <div className="text-sm text-muted-foreground">{type}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {analysisData.status_summary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Employee Status Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              {Object.entries(analysisData.status_summary).map(([status, count]: [string, any]) => (
                <div key={status} className="text-center p-4 border rounded-lg">
                  <div className="text-lg font-semibold">{count}</div>
                  <div className="text-sm text-muted-foreground">{status}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {analysisData.longest_tenured_employees && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Longest Tenured Employees
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="whitespace-pre-line text-sm font-mono bg-muted p-4 rounded-md">
              {analysisData.longest_tenured_employees}
            </div>
          </CardContent>
        </Card>
      )}

      {analysisData.observations && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Key Observations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="whitespace-pre-line text-sm">{analysisData.observations}</div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function renderSalesLedgerAnalysis(analysisData: any) {
  // Support both flat format and nested summary/aging format
  const summary = analysisData.summary || {};
  const aging = analysisData.aging || {};
  
  // Calculate totals from available data
  const totalOutstanding = analysisData.total_outstanding || summary.total_trade_debtors || 0;
  const totalInvoiceValue = analysisData.total_invoice_value || totalOutstanding;
  const totalAmountPaid = analysisData.total_amount_paid || 0;
  
  // Get invoice count from status summary if available
  let invoiceCount = analysisData.total_invoice_count || 0;
  if (!invoiceCount && analysisData.invoice_status_summary) {
    Object.values(analysisData.invoice_status_summary).forEach((status: any) => {
      if (status?.count) invoiceCount += status.count;
    });
  }
  if (!invoiceCount && analysisData.top_debtors?.length) {
    invoiceCount = analysisData.top_debtors.length;
  }
  
  // Get debtor days
  const debtorDays = summary.debtor_days || analysisData.debtor_days;
  
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="w-4 h-4" />
              {invoiceCount > 0 ? 'Total Invoices' : 'Total Debtors'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invoiceCount || analysisData.top_debtors?.length || '-'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Total Trade Debtors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£{totalOutstanding?.toLocaleString() || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              {debtorDays ? 'Debtor Days' : 'Amount Paid'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {debtorDays ? `${debtorDays} days` : (totalAmountPaid > 0 ? `£${totalAmountPaid.toLocaleString()}` : '-')}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              {aging.days_90_plus !== undefined ? '90+ Days Overdue' : 'Outstanding'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              £{(aging.days_90_plus ?? analysisData.total_outstanding ?? 0)?.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Aging Breakdown - for new format */}
      {(aging.current_0_to_30 !== undefined || aging.days_31_to_60 !== undefined) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Aging Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className={`text-center p-4 border rounded-lg bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800/60`}>
                <div className="text-2xl font-semibold text-green-600">£{(aging.current_0_to_30 || 0).toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Current (0-30 days)</div>
              </div>
              <div className={`text-center p-4 border rounded-lg bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800/60`}>
                <div className="text-2xl font-semibold text-yellow-600">£{(aging.days_31_to_60 || 0).toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">31-60 days</div>
              </div>
              <div className={`text-center p-4 border rounded-lg bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800/60`}>
                <div className="text-2xl font-semibold text-orange-600">£{(aging.days_61_to_90 || 0).toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">61-90 days</div>
              </div>
              <div className={`text-center p-4 border rounded-lg bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800/60`}>
                <div className="text-2xl font-semibold text-red-600">£{(aging.days_90_plus || 0).toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">90+ days</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {analysisData.invoice_status_summary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Invoice Status Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              {Object.entries(analysisData.invoice_status_summary).map(([status, data]: [string, any]) => (
                <div key={status} className={`text-center p-4 border rounded-lg ${getInvoiceStatusColor(status)}`}>
                  <div className="text-lg font-semibold">{data.count}</div>
                  <div className="text-sm text-muted-foreground">{status}</div>
                  <div className="text-sm font-medium">£{data.value?.toLocaleString()}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {(analysisData.top_5_customers || analysisData.customer_exposure) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              {analysisData.top_5_customers ? 'Top 5 Customers by Invoice Value' : 'Customer Exposure Analysis'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Customer</th>
                    <th className="text-right py-2">Total Invoiced</th>
                    <th className="text-right py-2">Total Paid</th>
                    <th className="text-right py-2">Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {(analysisData.top_5_customers || analysisData.customer_exposure).map((customer: any, index: number) => (
                    <tr key={index} className="border-b">
                      <td className="py-2 font-medium">{customer.customer_name}</td>
                      <td className="text-right py-2">£{customer.total_invoiced?.toLocaleString()}</td>
                      <td className="text-right py-2 text-green-600">£{customer.total_paid?.toLocaleString()}</td>
                      <td className={`text-right py-2 font-medium ${customer.total_outstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        £{customer.total_outstanding?.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {analysisData.observations && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Key Observations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="whitespace-pre-line text-sm">{processObservationsText(analysisData.observations)}</div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function renderProfitAndLossAnalysis(analysisData: any) {
  return (
    <div className="space-y-6">
      {analysisData.years_covered && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Years Covered
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="whitespace-pre-line text-sm font-mono bg-muted p-4 rounded-md">
              {Array.isArray(analysisData.years_covered) 
                ? analysisData.years_covered.join(', ')
                : String(analysisData.years_covered)}
            </div>
          </CardContent>
        </Card>
      )}

      {analysisData.years && (
        <div className="space-y-6">
          {Object.entries(analysisData.years).map(([year, yearData]: [string, any]) => (
            <Card key={year}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  {year} Financial Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">Revenue</div>
                    <div className="text-xl font-bold text-blue-600">
                      £{yearData.profit_and_loss?.revenue?.toLocaleString() || 0}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">Gross Profit</div>
                    <div className="text-xl font-bold text-green-600">
                      £{yearData.profit_and_loss?.gross_profit?.toLocaleString() || 0}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">Operating Profit</div>
                    <div className="text-xl font-bold text-orange-600">
                      £{yearData.profit_and_loss?.operating_profit?.toLocaleString() || 0}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">Profit Before Tax</div>
                    <div className="text-xl font-bold text-purple-600">
                      £{yearData.profit_and_loss?.profit_before_tax?.toLocaleString() || 0}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">Net Profit</div>
                    <div className={`text-xl font-bold ${(yearData.profit_and_loss?.net_profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      £{yearData.profit_and_loss?.net_profit?.toLocaleString() || 0}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">Tax</div>
                    <div className="text-xl font-bold text-muted-foreground">
                      £{yearData.profit_and_loss?.tax?.toLocaleString() || 0}
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="space-y-1">
                      <div className="text-muted-foreground">Cost of Sales</div>
                      <div className="font-medium">£{yearData.profit_and_loss?.cost_of_sales?.toLocaleString() || 0}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-muted-foreground">Admin Expenses</div>
                      <div className="font-medium">£{yearData.profit_and_loss?.administrative_expenses?.toLocaleString() || 0}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-muted-foreground">Other Operating Income</div>
                      <div className="font-medium">£{yearData.profit_and_loss?.other_operating_income?.toLocaleString() || 0}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-muted-foreground">Interest (Net)</div>
                      <div className="font-medium">
                        £{((yearData.profit_and_loss?.interest_receivable || 0) - (yearData.profit_and_loss?.interest_payable || 0)).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {analysisData.years && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Key Financial Ratios
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {Object.entries(analysisData.years).map(([year, yearData]: [string, any]) => (
                <div key={year} className="space-y-4">
                  <h4 className="text-lg font-semibold text-muted-foreground">{year}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg border border-blue-200 dark:border-blue-800/60">
                      <div className="text-sm text-blue-700 dark:text-blue-300 font-medium">Gross Margin %</div>
                      <div className="text-2xl font-bold text-blue-800 dark:text-blue-200">
                        {yearData.profit_and_loss?.revenue && yearData.profit_and_loss?.gross_profit
                          ? ((yearData.profit_and_loss.gross_profit / yearData.profit_and_loss.revenue) * 100).toFixed(1)
                          : 'N/A'
                        }%
                      </div>
                      <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                        (Gross Profit ÷ Revenue) × 100
                      </div>
                    </div>

                    <div className="bg-green-50 dark:bg-green-950/30 p-4 rounded-lg border border-green-200 dark:border-green-800/60">
                      <div className="text-sm text-green-700 dark:text-green-300 font-medium">Net Margin %</div>
                      <div className="text-2xl font-bold text-green-800 dark:text-green-200">
                        {yearData.profit_and_loss?.revenue && yearData.profit_and_loss?.net_profit
                          ? ((yearData.profit_and_loss.net_profit / yearData.profit_and_loss.revenue) * 100).toFixed(1)
                          : 'N/A'
                        }%
                      </div>
                      <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                        (Net Profit ÷ Revenue) × 100
                      </div>
                    </div>

                    <div className="bg-purple-50 dark:bg-purple-950/30 p-4 rounded-lg border border-purple-200 dark:border-purple-800/60">
                      <div className="text-sm text-purple-700 dark:text-purple-300 font-medium">Interest Coverage</div>
                      <div className="text-2xl font-bold text-purple-800 dark:text-purple-200">
                        {yearData.profit_and_loss?.operating_profit && yearData.profit_and_loss?.interest_payable
                          ? (yearData.profit_and_loss.operating_profit / yearData.profit_and_loss.interest_payable).toFixed(1)
                          : 'N/A'
                        }x
                      </div>
                      <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                        Operating Profit ÷ Interest Payable
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {analysisData.summary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Summary Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {analysisData.summary}
              </ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function renderAssetRegisterAnalysis(analysisData: any) {
  // Support both flat format and nested summary/categories format
  const summary = analysisData.summary || {};
  const categories = analysisData.categories || {};
  
  const totalAssetsCost = analysisData.total_assets_cost || summary.total_gross_book_value || 0;
  const totalDepreciation = analysisData.total_accumulated_depreciation || summary.total_accumulated_depreciation || 0;
  const totalNetBookValue = analysisData.total_net_book_value || summary.total_net_book_value || 0;
  
  // Convert categories object to array format for display
  const assetBreakdown = analysisData.asset_breakdown || (Object.keys(categories).length > 0 ? 
    Object.entries(categories).map(([key, value]: [string, any]) => ({
      category: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      cost: value.gross_value || value.cost || 0,
      accumulated_depreciation: value.accumulated_depreciation || 0,
      net_book_value: value.net_book_value || 0
    })).filter(cat => cat.cost > 0 || cat.net_book_value > 0) : []);
  
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Total Assets Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              £{totalAssetsCost?.toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingDown className="w-4 h-4" />
              Accumulated Depreciation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              £{totalDepreciation?.toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Net Book Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              £{totalNetBookValue?.toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {assetBreakdown && assetBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Asset Category Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {assetBreakdown.map((asset: any, index: number) => (
                <div key={index} className="border rounded-lg p-4">
                  <h4 className="font-semibold text-lg mb-3">{asset.category}</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-sm text-muted-foreground">Cost</div>
                      <div className="text-lg font-semibold text-blue-600">
                        £{asset.cost?.toLocaleString() || 0}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-muted-foreground">Depreciation</div>
                      <div className="text-lg font-semibold text-red-600">
                        £{asset.accumulated_depreciation?.toLocaleString() || 0}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-muted-foreground">Net Book Value</div>
                      <div className="text-lg font-semibold text-green-600">
                        £{asset.net_book_value?.toLocaleString() || 0}
                      </div>
                    </div>
                  </div>
                  
                  {asset.cost > 0 && (
                    <div className="mt-3 text-center">
                      <div className="text-sm text-muted-foreground">Depreciation Rate</div>
                      <div className="text-sm font-medium">
                        {((asset.accumulated_depreciation / asset.cost) * 100).toFixed(1)}%
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {analysisData.recent_additions_summary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Recent Additions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="whitespace-pre-line text-sm font-mono bg-muted p-4 rounded-md">
              {analysisData.recent_additions_summary}
            </div>
          </CardContent>
        </Card>
      )}

      {analysisData.depreciation_this_year && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Depreciation This Year
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              £{analysisData.depreciation_this_year?.toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>
      )}

      {analysisData.asset_breakdown_list && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <List className="w-5 h-5" />
              Asset Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="whitespace-pre-line text-sm font-mono bg-muted p-4 rounded-md">
              {analysisData.asset_breakdown_list}
            </div>
          </CardContent>
        </Card>
      )}

      {analysisData.observations && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Key Observations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="whitespace-pre-line text-sm">{analysisData.observations}</div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function renderBalanceSheetAnalysis(analysisData: any) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <div className="bg-orange-100 dark:bg-orange-900/40 px-4 py-2 rounded-full">
          <span className="text-orange-800 dark:text-orange-200 font-semibold text-base">Balance Sheet</span>
        </div>
        <span className="text-muted-foreground text-sm">Financial Position Analysis</span>
      </div>

      {analysisData.years_covered && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Years Covered
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none dark:prose-invert">
              {Array.isArray(analysisData.years_covered) 
                ? analysisData.years_covered.join(', ')
                : String(analysisData.years_covered)}
            </div>
          </CardContent>
        </Card>
      )}

      {analysisData.years && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Balance Sheet Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-12">
              {Object.entries(analysisData.years).map(([year, yearData]: [string, any]) => (
                <div key={year} className="space-y-4">
                  <h3 className="text-xl font-bold text-orange-600 dark:text-orange-400 border-b border-orange-200 dark:border-orange-800/60 pb-2">
                    {year}
                  </h3>
                  
                  {(() => {
                    const bs = yearData.balance_sheet;
                    const fixedAssets = bs?.fixed_assets;
                    const currentAssets = bs?.current_assets;
                    const currentLiabilities = bs?.current_liabilities;
                    const longTermLiabilities = bs?.long_term_liabilities;
                    const equity = bs?.equity;
                    const ratios = yearData.financial_ratios;
                    
                    const totalFixedAssets = (fixedAssets?.tangible_assets || 0) + (fixedAssets?.intangible_assets || 0);
                    const totalDebtors = (currentAssets?.trade_debtors || 0) + (currentAssets?.other_debtors || 0);
                    const netCurrentAssets = (currentAssets?.total || 0) - (currentLiabilities?.total || 0);
                    const totalAssetsLessCurrentLiabilities = totalFixedAssets + netCurrentAssets;
                    
                    return (
                      <>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <h4 className="text-lg font-semibold text-green-700 dark:text-green-300">Assets</h4>
                            
                            <div className="bg-green-50 dark:bg-green-950/30 p-4 rounded-lg">
                              <div className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">Fixed Assets</div>
                              <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                                £{totalFixedAssets ? totalFixedAssets.toLocaleString() : 'N/A'}
                              </div>
                              {fixedAssets && (
                                <div className="mt-2 text-xs text-green-700 dark:text-green-300 space-y-1">
                                  {fixedAssets.tangible_assets != null && <div>Tangible: £{fixedAssets.tangible_assets.toLocaleString()}</div>}
                                  {fixedAssets.intangible_assets != null && fixedAssets.intangible_assets > 0 && <div>Intangible: £{fixedAssets.intangible_assets.toLocaleString()}</div>}
                                </div>
                              )}
                            </div>

                            <div className="space-y-2">
                              <div className="text-sm font-medium text-green-800 dark:text-green-200">Current Assets</div>
                              <div className="grid grid-cols-1 gap-2">
                                <div className="flex justify-between items-center bg-green-25 p-2 rounded">
                                  <span className="text-sm">Trade Debtors</span>
                                  <span className="font-medium">£{currentAssets?.trade_debtors?.toLocaleString() || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between items-center bg-green-25 p-2 rounded">
                                  <span className="text-sm">Stock</span>
                                  <span className="font-medium">£{currentAssets?.stock?.toLocaleString() || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between items-center bg-green-25 p-2 rounded">
                                  <span className="text-sm">Cash at Bank</span>
                                  <span className="font-medium">£{currentAssets?.cash_at_bank?.toLocaleString() || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between items-center bg-green-100 dark:bg-green-900/40 p-2 rounded border-t border-green-200 dark:border-green-800/60">
                                  <span className="text-sm font-medium">Total Current Assets</span>
                                  <span className="font-bold">£{currentAssets?.total?.toLocaleString() || 'N/A'}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <h4 className="text-lg font-semibold text-red-700 dark:text-red-300">Liabilities & Equity</h4>
                            
                            <div className="bg-red-50 dark:bg-red-950/30 p-4 rounded-lg">
                              <div className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">Creditors (Within One Year)</div>
                              <div className="text-2xl font-bold text-red-900 dark:text-red-100">
                                £{currentLiabilities?.total?.toLocaleString() || 'N/A'}
                              </div>
                            </div>

                            <div className="bg-red-50 dark:bg-red-950/30 p-4 rounded-lg">
                              <div className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">Creditors (After One Year)</div>
                              <div className="text-2xl font-bold text-red-900 dark:text-red-100">
                                £{longTermLiabilities?.total?.toLocaleString() || 'N/A'}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className="text-sm font-medium text-blue-800 dark:text-blue-200">Shareholders' Equity</div>
                              <div className="grid grid-cols-1 gap-2">
                                <div className="flex justify-between items-center bg-blue-25 p-2 rounded">
                                  <span className="text-sm">Share Capital</span>
                                  <span className="font-medium">£{equity?.share_capital?.toLocaleString() || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between items-center bg-blue-25 p-2 rounded">
                                  <span className="text-sm">Retained Earnings</span>
                                  <span className="font-medium">£{equity?.retained_earnings?.toLocaleString() || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between items-center bg-blue-100 dark:bg-blue-900/40 p-2 rounded border-t border-blue-200 dark:border-blue-800/60">
                                  <span className="text-sm font-medium">Net Assets</span>
                                  <span className="font-bold">£{equity?.total?.toLocaleString() || 'N/A'}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                          <div className="bg-purple-50 dark:bg-purple-950/30 p-4 rounded-lg border border-purple-200 dark:border-purple-800/60">
                            <div className="text-sm text-purple-700 dark:text-purple-300 font-medium">Net Current Assets</div>
                            <div className="text-xl font-bold text-purple-800 dark:text-purple-200">
                              £{netCurrentAssets ? netCurrentAssets.toLocaleString() : 'N/A'}
                            </div>
                          </div>
                          <div className="bg-indigo-50 dark:bg-indigo-950/30 p-4 rounded-lg border border-indigo-200 dark:border-indigo-800/60">
                            <div className="text-sm text-indigo-700 dark:text-indigo-300 font-medium">Total Assets Less Current Liabilities</div>
                            <div className="text-xl font-bold text-indigo-800 dark:text-indigo-200">
                              £{totalAssetsLessCurrentLiabilities ? totalAssetsLessCurrentLiabilities.toLocaleString() : 'N/A'}
                            </div>
                          </div>
                          <div className="bg-orange-50 dark:bg-orange-950/30 p-4 rounded-lg border border-orange-200 dark:border-orange-800/60">
                            <div className="text-sm text-orange-700 dark:text-orange-300 font-medium">Current Ratio</div>
                            <div className="text-xl font-bold text-orange-800 dark:text-orange-200">
                              {ratios?.current_ratio?.toFixed(2) || (currentAssets?.total && currentLiabilities?.total
                                ? (currentAssets.total / currentLiabilities.total).toFixed(2)
                                : 'N/A'
                              )}
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {analysisData.summary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Summary Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {analysisData.summary}
              </ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function renderCompanyAccountsAnalysis(analysisData: any) {
  if (!analysisData) return null;

  // Current format: { document: 'company_accounts', profit_and_loss: {...}, balance_sheet: {...} }
  const plData = analysisData.profit_and_loss;
  const bsData = analysisData.balance_sheet;

  // Legacy format: { document: 'company_accounts', data: { document_type: '...', data: {...} } }
  const legacyData = analysisData.data;

  return (
    <div className="space-y-6">
      {plData && renderProfitAndLossAnalysis(plData)}
      {bsData && renderBalanceSheetAnalysis(bsData)}

      {legacyData && legacyData.document_type === 'sales_ledger' && renderSalesLedgerAnalysis(legacyData.data)}
      {legacyData && legacyData.document_type === 'staff_matrix' && renderStaffMatrixAnalysis(legacyData.data)}
      {legacyData && legacyData.document_type === 'asset_register' && renderAssetRegisterAnalysis(legacyData.data)}
      {legacyData && legacyData.document_type === 'profit_and_loss' && renderProfitAndLossAnalysis(legacyData.data)}
      {legacyData && legacyData.document_type === 'balance_sheet' && renderBalanceSheetAnalysis(legacyData.data)}

      {!plData && !bsData && !legacyData && (
        <Card>
          <CardHeader>
            <CardTitle>Company Accounts Data</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">No detailed financial data available for this document.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function AnalysisDisplay({ results, isLoading, isRetryingAnalysis, onRetryAnalysis, documentUploadedAt, isPendingAnalysis, featureGated, nonRetryableError, pollExhausted }: AnalysisDisplayProps) {
  // Check if document was uploaded recently (within 5 minutes)
  const isRecentUpload = documentUploadedAt ? 
    (Date.now() - new Date(documentUploadedAt).getTime()) < 5 * 60 * 1000 : false;
  
  // Show pending analysis state if document was recently uploaded or explicitly marked as pending
  const showPendingState = (isPendingAnalysis || isRecentUpload) && results.length === 0 && !featureGated && !nonRetryableError && !pollExhausted;

  if (featureGated) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 mb-4">
          <Lock className="w-8 h-8 text-amber-600 dark:text-amber-400" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">Analysis Complete</h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          Your document has been processed. Upgrade to Professional to view the full analysis results.
        </p>
        <Link href="/billing">
          <Button className="mt-6 gap-2">
            Upgrade to Professional
            <ArrowUpRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    );
  }

  if (nonRetryableError) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500 opacity-70" />
        <h3 className="text-lg font-semibold text-foreground mb-2">Unable to Load Analysis</h3>
        <p className="text-muted-foreground">{nonRetryableError}</p>
      </div>
    );
  }

  if (pollExhausted) {
    return (
      <div className="text-center py-12">
        <RefreshCw className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
        <h3 className="text-lg font-semibold text-foreground mb-2">Analysis is taking longer than expected</h3>
        <p className="text-muted-foreground">Please refresh the page to check for results.</p>
        <Button 
          variant="outline" 
          className="mt-4 gap-2" 
          onClick={() => window.location.reload()}
        >
          <RefreshCw className="w-4 h-4" />
          Refresh Page
        </Button>
      </div>
    );
  }
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Clock className="w-8 h-8 mx-auto mb-2 animate-spin" />
          <p className="text-muted-foreground">Loading analysis results...</p>
        </div>
      </div>
    );
  }

  if (showPendingState) {
    return (
      <div className="text-center py-8">
        <div className="relative inline-block mb-4">
          <BarChart3 className="w-12 h-12 text-blue-500" />
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full animate-pulse" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">Analysis in Progress</h3>
        <p className="text-muted-foreground">Your document is being analyzed by our AI system.</p>
        <p className="text-sm text-muted-foreground mt-1">This typically takes 30-90 seconds depending on document complexity.</p>
        <div className="mt-4 flex items-center justify-center gap-2 text-blue-600">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        <p className="text-xs text-muted-foreground mt-4">Results will appear automatically when ready</p>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No analysis results available for this document yet.</p>
        <p className="text-sm mt-2">Analysis results will appear here after processing.</p>
        <div className="mt-4">
          <Button 
            onClick={onRetryAnalysis}
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={isRetryingAnalysis}
          >
            {isRetryingAnalysis ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <TrendingUp className="w-4 h-4" />
                Retry Analysis
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {results.map((result) => (
        <div key={result.id}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold">Document Analysis</h3>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span>Type:</span>
                  <span className={`px-3 py-1 rounded-md text-sm font-medium ${getDocumentTypeColor(result.documentType, result.analysisData)}`}>
                    {formatDocumentType(result.documentType, result.analysisData)}
                  </span>
                </div>
                <span>•</span>
                <span>Processed: {formatDate(result.createdAt)}</span>
                {result.processingTime && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {(result.processingTime / 1000).toFixed(1)}s
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          
          {result.analysisData && result.analysisData.document === 'company_accounts' && renderCompanyAccountsAnalysis(result.analysisData)}
          
          {(!result.analysisData || result.analysisData.document !== 'company_accounts') && result.documentType === 'sales_ledger' && renderSalesLedgerAnalysis(result.analysisData)}
          {(!result.analysisData || result.analysisData.document !== 'company_accounts') && result.documentType === 'staff_matrix' && renderStaffMatrixAnalysis(result.analysisData)}
          {(!result.analysisData || result.analysisData.document !== 'company_accounts') && result.documentType === 'asset_register' && renderAssetRegisterAnalysis(result.analysisData)}
          {(!result.analysisData || result.analysisData.document !== 'company_accounts') && result.documentType === 'profit_and_loss' && renderProfitAndLossAnalysis(result.analysisData)}
          {(!result.analysisData || result.analysisData.document !== 'company_accounts') && result.documentType === 'balance_sheet' && renderBalanceSheetAnalysis(result.analysisData)}
          
          {(!result.analysisData || result.analysisData.document !== 'company_accounts') && !['sales_ledger', 'staff_matrix', 'asset_register', 'profit_and_loss', 'balance_sheet'].includes(result.documentType) && (
            <Card>
              <CardHeader>
                <CardTitle>Analysis Data</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-muted p-4 rounded-md overflow-auto">
                  {JSON.stringify(result.analysisData, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
          
        </div>
      ))}
    </div>
  );
}
