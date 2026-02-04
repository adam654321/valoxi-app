import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Trash2, Calculator, DollarSign, TrendingUp, Building2, Users, CreditCard, FileText, Edit2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  ColumnDef,
} from '@tanstack/react-table';

interface FinancialPeriod {
  id: number;
  targetCompanyId: number;
  periodType: string;
  periodStart: string | null;
  periodEnd: string;
  fiscalYear: number | null;
  periodLabel: string | null;
  readOnly?: boolean;
  isHistoric?: boolean;
}

interface IncomeStatement {
  id: number;
  financialPeriodId: number;
  targetCompanyId: number;
  revenue: string | null;
  costOfSales: string | null;
  grossProfit: string | null;
  administrativeExpenses: string | null;
  depreciationAmortisation: string | null;
  operatingProfit: string | null;
  interestPayable: string | null;
  interestReceivable: string | null;
  profitBeforeTax: string | null;
  corporationTax: string | null;
  netProfit: string | null;
  staffCosts: string | null;
  directorsRemuneration: string | null;
  period: FinancialPeriod;
}

interface BalanceSheet {
  id: number;
  financialPeriodId: number;
  targetCompanyId: number;
  tangibleFixedAssets: string | null;
  totalCurrentAssets: string | null;
  cashAtBank: string | null;
  tradeDebtors: string | null;
  totalCurrentLiabilities: string | null;
  totalLongTermLiabilities: string | null;
  shareCapital: string | null;
  retainedEarnings: string | null;
  totalEquity: string | null;
  period: FinancialPeriod;
}

interface StaffDataRow {
  id: number;
  financialPeriodId: number;
  totalHeadcount: number | null;
  totalStaffCosts: string | null;
  directorCount: number | null;
  directorRemuneration: string | null;
  period: FinancialPeriod;
}

interface LoanFacility {
  id: number;
  lenderName: string | null;
  loanType: string | null;
  outstandingBalance: string | null;
  interestRate: string | null;
  monthlyRepayment: string | null;
}

interface EbitdaAdjustment {
  id: number;
  financialPeriodId: number;
  targetCompanyId: number;
  description: string;
  amount: string;
  category: string | null;
  notes: string | null;
  period: FinancialPeriod;
}

interface Valuation {
  id: number;
  targetCompanyId: number;
  calculationMethod: string;
  valuationMultiple: string;
  adjustedEbitda: string | null;
  enterpriseValue: string | null;
  netDebt: string | null;
  equityValue: string | null;
  fundingStructure: any;
  dealNotes: string | null;
}

interface FinancialsData {
  periods: FinancialPeriod[];
  incomeStatements: IncomeStatement[];
  balanceSheets: BalanceSheet[];
  staffData: StaffDataRow[];
  loans: LoanFacility[];
  agedDebtors: any[];
  adjustments: EbitdaAdjustment[];
}

function formatCurrency(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '-';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '-';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
}

function formatNumber(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '-';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '-';
  return new Intl.NumberFormat('en-GB').format(num);
}

export default function ValuationPage() {
  const { id } = useParams<{ id: string }>();
  const companyId = parseInt(id || '0');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false);
  const [valuationModalOpen, setValuationModalOpen] = useState(false);
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(null);
  const [adjustmentForm, setAdjustmentForm] = useState({
    description: '',
    amount: '',
    category: 'personal_expense',
    notes: '',
  });
  const [valuationForm, setValuationForm] = useState({
    calculationMethod: 'average_3yr',
    valuationMultiple: '4.0',
    dealNotes: '',
  });

  const { data: financialsResponse, isLoading } = useQuery<{ success: boolean; data: FinancialsData }>({
    queryKey: ['/api/v2/valuation/company', companyId, 'financials'],
    enabled: !!companyId,
  });

  const { data: valuationResponse } = useQuery<{ success: boolean; data: Valuation | null }>({
    queryKey: ['/api/v2/valuation/company', companyId, 'valuation'],
    enabled: !!companyId,
  });

  const { data: ebitdaResponse } = useQuery<{ success: boolean; data: { baseEbitda: number; totalAdjustments: number; adjustedEbitda: number; } }>({
    queryKey: ['/api/v2/valuation/company', companyId, 'calculate-ebitda'],
    enabled: !!companyId,
  });

  const financials = financialsResponse?.data;
  const valuation = valuationResponse?.data;
  const ebitdaCalc = ebitdaResponse?.data;

  const createAdjustmentMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', '/api/v2/valuation/adjustments', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/v2/valuation/company', companyId] });
      setAdjustmentModalOpen(false);
      setAdjustmentForm({ description: '', amount: '', category: 'personal_expense', notes: '' });
      toast({ title: 'Adjustment added successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to add adjustment', variant: 'destructive' });
    },
  });

  const deleteAdjustmentMutation = useMutation({
    mutationFn: async (adjustmentId: number) => {
      return apiRequest('DELETE', `/api/v2/valuation/adjustments/${adjustmentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/v2/valuation/company', companyId] });
      toast({ title: 'Adjustment deleted' });
    },
    onError: () => {
      toast({ title: 'Failed to delete adjustment', variant: 'destructive' });
    },
  });

  const calculateValuationMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', `/api/v2/valuation/company/${companyId}/valuation`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/v2/valuation/company', companyId] });
      setValuationModalOpen(false);
      toast({ title: 'Valuation calculated successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to calculate valuation', variant: 'destructive' });
    },
  });

  const handleAddAdjustment = () => {
    if (!selectedPeriodId) {
      toast({ title: 'Please select a financial period', variant: 'destructive' });
      return;
    }
    createAdjustmentMutation.mutate({
      financialPeriodId: selectedPeriodId,
      targetCompanyId: companyId,
      ...adjustmentForm,
    });
  };

  const handleCalculateValuation = () => {
    calculateValuationMutation.mutate(valuationForm);
  };

  const periods = financials?.periods || [];
  const incomeStatements = financials?.incomeStatements || [];
  const balanceSheets = financials?.balanceSheets || [];
  const staffData = financials?.staffData || [];
  const loans = financials?.loans || [];
  const adjustments = financials?.adjustments || [];

  const sortedPeriods = useMemo(() => {
    return [...periods].sort((a, b) => {
      const yearA = a.fiscalYear || 0;
      const yearB = b.fiscalYear || 0;
      return yearB - yearA;
    });
  }, [periods]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/target-companies/${companyId}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Company
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Valuation & Deal Structure</h1>
          <p className="text-muted-foreground">View financial data and model the deal</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Base EBITDA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(ebitdaCalc?.baseEbitda)}</div>
            <p className="text-xs text-muted-foreground">Before adjustments</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Adjustments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(ebitdaCalc?.totalAdjustments)}</div>
            <p className="text-xs text-muted-foreground">{adjustments.length} add-backs</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Adjusted EBITDA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{formatCurrency(ebitdaCalc?.adjustedEbitda)}</div>
            <p className="text-xs text-muted-foreground">Normalized earnings</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Enterprise Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{valuation ? formatCurrency(valuation.enterpriseValue) : '-'}</div>
            <p className="text-xs text-muted-foreground">
              {valuation ? `${valuation.valuationMultiple}x multiple` : 'Not calculated'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2">
        <Button onClick={() => setAdjustmentModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Adjustment
        </Button>
        <Button variant="outline" onClick={() => setValuationModalOpen(true)}>
          <Calculator className="h-4 w-4 mr-2" />
          Calculate Valuation
        </Button>
      </div>

      <Tabs defaultValue="pl" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="pl" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            P&L
          </TabsTrigger>
          <TabsTrigger value="balance" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Balance Sheet
          </TabsTrigger>
          <TabsTrigger value="debt" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Debt Profile
          </TabsTrigger>
          <TabsTrigger value="staff" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Staff
          </TabsTrigger>
          <TabsTrigger value="adjustments" className="flex items-center gap-2">
            <Edit2 className="h-4 w-4" />
            Adjustments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pl" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Profit & Loss</CardTitle>
              <CardDescription>Historic P&L data is read-only. Modify earnings via adjustments.</CardDescription>
            </CardHeader>
            <CardContent>
              <PLTable incomeStatements={incomeStatements} periods={sortedPeriods} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="balance" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Balance Sheet</CardTitle>
              <CardDescription>Assets, liabilities and equity position</CardDescription>
            </CardHeader>
            <CardContent>
              <BalanceSheetTable balanceSheets={balanceSheets} periods={sortedPeriods} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="debt" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Debt Profile</CardTitle>
              <CardDescription>Outstanding loans and facilities</CardDescription>
            </CardHeader>
            <CardContent>
              <DebtTable loans={loans} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="staff" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Staff Data</CardTitle>
              <CardDescription>Headcount and payroll information</CardDescription>
            </CardHeader>
            <CardContent>
              <StaffTable staffData={staffData} periods={sortedPeriods} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="adjustments" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>EBITDA Adjustments</CardTitle>
              <CardDescription>Personal expenses and other add-backs to normalize earnings</CardDescription>
            </CardHeader>
            <CardContent>
              <AdjustmentsTable 
                adjustments={adjustments} 
                onDelete={(id) => deleteAdjustmentMutation.mutate(id)} 
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={adjustmentModalOpen} onOpenChange={setAdjustmentModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add EBITDA Adjustment</DialogTitle>
            <DialogDescription>Add a personal expense or other add-back to normalize earnings</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Financial Period</Label>
              <Select value={selectedPeriodId?.toString()} onValueChange={(v) => setSelectedPeriodId(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  {periods.map((p) => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.periodLabel || `FY ${p.fiscalYear}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={adjustmentForm.description}
                onChange={(e) => setAdjustmentForm({ ...adjustmentForm, description: e.target.value })}
                placeholder="e.g., Personal car expenses"
              />
            </div>
            <div>
              <Label>Amount (£)</Label>
              <Input
                type="number"
                value={adjustmentForm.amount}
                onChange={(e) => setAdjustmentForm({ ...adjustmentForm, amount: e.target.value })}
                placeholder="0"
              />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={adjustmentForm.category} onValueChange={(v) => setAdjustmentForm({ ...adjustmentForm, category: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal_expense">Personal Expense</SelectItem>
                  <SelectItem value="one_off">One-Off / Non-Recurring</SelectItem>
                  <SelectItem value="related_party">Related Party Transaction</SelectItem>
                  <SelectItem value="discretionary">Discretionary</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={adjustmentForm.notes}
                onChange={(e) => setAdjustmentForm({ ...adjustmentForm, notes: e.target.value })}
                placeholder="Additional details..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustmentModalOpen(false)}>Cancel</Button>
            <Button onClick={handleAddAdjustment} disabled={createAdjustmentMutation.isPending}>
              {createAdjustmentMutation.isPending ? 'Adding...' : 'Add Adjustment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={valuationModalOpen} onOpenChange={setValuationModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Calculate Valuation</DialogTitle>
            <DialogDescription>Configure valuation parameters</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Calculation Method</Label>
              <Select value={valuationForm.calculationMethod} onValueChange={(v) => setValuationForm({ ...valuationForm, calculationMethod: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="average_3yr">3-Year Average</SelectItem>
                  <SelectItem value="latest_year">Latest Year</SelectItem>
                  <SelectItem value="weighted_average">Weighted Average</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valuation Multiple</Label>
              <Input
                type="number"
                step="0.1"
                value={valuationForm.valuationMultiple}
                onChange={(e) => setValuationForm({ ...valuationForm, valuationMultiple: e.target.value })}
              />
            </div>
            <div>
              <Label>Deal Notes</Label>
              <Textarea
                value={valuationForm.dealNotes}
                onChange={(e) => setValuationForm({ ...valuationForm, dealNotes: e.target.value })}
                placeholder="Notes about the valuation..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setValuationModalOpen(false)}>Cancel</Button>
            <Button onClick={handleCalculateValuation} disabled={calculateValuationMutation.isPending}>
              {calculateValuationMutation.isPending ? 'Calculating...' : 'Calculate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PLTable({ incomeStatements, periods }: { incomeStatements: IncomeStatement[], periods: FinancialPeriod[] }) {
  const rows = [
    { label: 'Revenue', key: 'revenue' },
    { label: 'Cost of Sales', key: 'costOfSales' },
    { label: 'Gross Profit', key: 'grossProfit' },
    { label: 'Administrative Expenses', key: 'administrativeExpenses' },
    { label: 'Depreciation & Amortisation', key: 'depreciationAmortisation' },
    { label: 'Operating Profit', key: 'operatingProfit' },
    { label: 'Interest Payable', key: 'interestPayable' },
    { label: 'Interest Receivable', key: 'interestReceivable' },
    { label: 'Profit Before Tax', key: 'profitBeforeTax' },
    { label: 'Corporation Tax', key: 'corporationTax' },
    { label: 'Net Profit', key: 'netProfit' },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="text-left p-2 border-b font-medium">Line Item</th>
            {periods.map((p) => (
              <th 
                key={p.id} 
                className={`text-right p-2 border-b font-medium ${p.readOnly ? 'bg-gray-50' : 'bg-blue-50'}`}
              >
                <div className="flex flex-col items-end">
                  <span>{p.periodLabel || `FY ${p.fiscalYear}`}</span>
                  <Badge variant={p.readOnly ? 'secondary' : 'default'} className="text-xs mt-1">
                    {p.readOnly ? 'Historic' : 'Forecast'}
                  </Badge>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="hover:bg-gray-50">
              <td className="p-2 border-b font-medium">{row.label}</td>
              {periods.map((p) => {
                const statement = incomeStatements.find((s) => s.financialPeriodId === p.id);
                const value = statement ? (statement as any)[row.key] : null;
                return (
                  <td 
                    key={p.id} 
                    className={`text-right p-2 border-b ${p.readOnly ? 'bg-gray-50 text-gray-600' : 'bg-blue-50'}`}
                  >
                    {formatCurrency(value)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BalanceSheetTable({ balanceSheets, periods }: { balanceSheets: BalanceSheet[], periods: FinancialPeriod[] }) {
  const rows = [
    { label: 'Fixed Assets', key: 'tangibleFixedAssets', section: 'assets' },
    { label: 'Current Assets', key: 'totalCurrentAssets', section: 'assets' },
    { label: 'Cash at Bank', key: 'cashAtBank', section: 'assets' },
    { label: 'Trade Debtors', key: 'tradeDebtors', section: 'assets' },
    { label: 'Current Liabilities', key: 'totalCurrentLiabilities', section: 'liabilities' },
    { label: 'Long-Term Liabilities', key: 'totalLongTermLiabilities', section: 'liabilities' },
    { label: 'Share Capital', key: 'shareCapital', section: 'equity' },
    { label: 'Retained Earnings', key: 'retainedEarnings', section: 'equity' },
    { label: 'Total Equity', key: 'totalEquity', section: 'equity' },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="text-left p-2 border-b font-medium">Line Item</th>
            {periods.map((p) => (
              <th 
                key={p.id} 
                className={`text-right p-2 border-b font-medium ${p.readOnly ? 'bg-gray-50' : 'bg-blue-50'}`}
              >
                {p.periodLabel || `FY ${p.fiscalYear}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="hover:bg-gray-50">
              <td className="p-2 border-b font-medium">{row.label}</td>
              {periods.map((p) => {
                const sheet = balanceSheets.find((s) => s.financialPeriodId === p.id);
                const value = sheet ? (sheet as any)[row.key] : null;
                return (
                  <td 
                    key={p.id} 
                    className={`text-right p-2 border-b ${p.readOnly ? 'bg-gray-50 text-gray-600' : 'bg-blue-50'}`}
                  >
                    {formatCurrency(value)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DebtTable({ loans }: { loans: LoanFacility[] }) {
  if (loans.length === 0) {
    return <p className="text-muted-foreground text-center py-8">No loan facilities recorded</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="text-left p-2 border-b font-medium">Lender</th>
            <th className="text-left p-2 border-b font-medium">Type</th>
            <th className="text-right p-2 border-b font-medium">Outstanding</th>
            <th className="text-right p-2 border-b font-medium">Interest Rate</th>
            <th className="text-right p-2 border-b font-medium">Monthly Repayment</th>
          </tr>
        </thead>
        <tbody>
          {loans.map((loan) => (
            <tr key={loan.id} className="hover:bg-gray-50">
              <td className="p-2 border-b">{loan.lenderName || '-'}</td>
              <td className="p-2 border-b">{loan.loanType || '-'}</td>
              <td className="text-right p-2 border-b">{formatCurrency(loan.outstandingBalance)}</td>
              <td className="text-right p-2 border-b">{loan.interestRate ? `${loan.interestRate}%` : '-'}</td>
              <td className="text-right p-2 border-b">{formatCurrency(loan.monthlyRepayment)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StaffTable({ staffData, periods }: { staffData: StaffDataRow[], periods: FinancialPeriod[] }) {
  const rows = [
    { label: 'Total Headcount', key: 'totalHeadcount', format: 'number' },
    { label: 'Total Staff Costs', key: 'totalStaffCosts', format: 'currency' },
    { label: 'Director Count', key: 'directorCount', format: 'number' },
    { label: 'Director Remuneration', key: 'directorRemuneration', format: 'currency' },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="text-left p-2 border-b font-medium">Metric</th>
            {periods.map((p) => (
              <th 
                key={p.id} 
                className={`text-right p-2 border-b font-medium ${p.readOnly ? 'bg-gray-50' : 'bg-blue-50'}`}
              >
                {p.periodLabel || `FY ${p.fiscalYear}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="hover:bg-gray-50">
              <td className="p-2 border-b font-medium">{row.label}</td>
              {periods.map((p) => {
                const data = staffData.find((s) => s.financialPeriodId === p.id);
                const value = data ? (data as any)[row.key] : null;
                return (
                  <td 
                    key={p.id} 
                    className={`text-right p-2 border-b ${p.readOnly ? 'bg-gray-50 text-gray-600' : 'bg-blue-50'}`}
                  >
                    {row.format === 'currency' ? formatCurrency(value) : formatNumber(value)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdjustmentsTable({ adjustments, onDelete }: { adjustments: EbitdaAdjustment[], onDelete: (id: number) => void }) {
  if (adjustments.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-8">
        No adjustments added yet. Add personal expenses and other add-backs to normalize EBITDA.
      </p>
    );
  }

  const categoryLabels: Record<string, string> = {
    personal_expense: 'Personal Expense',
    one_off: 'One-Off',
    related_party: 'Related Party',
    discretionary: 'Discretionary',
    other: 'Other',
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="text-left p-2 border-b font-medium">Period</th>
            <th className="text-left p-2 border-b font-medium">Description</th>
            <th className="text-left p-2 border-b font-medium">Category</th>
            <th className="text-right p-2 border-b font-medium">Amount</th>
            <th className="text-right p-2 border-b font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {adjustments.map((adj) => (
            <tr key={adj.id} className="hover:bg-gray-50">
              <td className="p-2 border-b">{adj.period?.periodLabel || `FY ${adj.period?.fiscalYear}`}</td>
              <td className="p-2 border-b">{adj.description}</td>
              <td className="p-2 border-b">
                <Badge variant="outline">{categoryLabels[adj.category || 'other'] || adj.category}</Badge>
              </td>
              <td className="text-right p-2 border-b text-green-600 font-medium">
                +{formatCurrency(adj.amount)}
              </td>
              <td className="text-right p-2 border-b">
                <Button variant="ghost" size="sm" onClick={() => onDelete(adj.id)}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </td>
            </tr>
          ))}
          <tr className="bg-gray-50 font-bold">
            <td colSpan={3} className="p-2 border-b text-right">Total Adjustments:</td>
            <td className="text-right p-2 border-b text-green-600">
              +{formatCurrency(adjustments.reduce((sum, adj) => sum + parseFloat(adj.amount || '0'), 0))}
            </td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
