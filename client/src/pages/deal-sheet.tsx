import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Check, X, Lightbulb, TrendingUp, Building2, Banknote, PiggyBank } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface FinancialPeriod {
  id: number;
  targetCompanyId: number;
  periodType: string;
  periodEnd: string;
  fiscalYear: number | null;
  periodLabel: string | null;
  readOnly?: boolean;
}

interface IncomeStatement {
  id: number;
  financialPeriodId: number;
  revenue: string | null;
  costOfSales: string | null;
  grossProfit: string | null;
  administrativeExpenses: string | null;
  depreciationAmortisation: string | null;
  operatingProfit: string | null;
  interestPayable: string | null;
  profitBeforeTax: string | null;
  netProfit: string | null;
  staffCosts: string | null;
  directorsRemuneration: string | null;
  period: FinancialPeriod;
}

interface BalanceSheet {
  id: number;
  financialPeriodId: number;
  cashAtBank: string | null;
  tangibleFixedAssets: string | null;
  period: FinancialPeriod;
}

interface SuggestedAddback {
  id: string;
  category: string;
  description: string;
  reasoning: string;
  amounts: { [year: number]: number };
  accepted: boolean;
}

interface FinancialsData {
  periods: FinancialPeriod[];
  incomeStatements: IncomeStatement[];
  balanceSheets: BalanceSheet[];
  staffData: any[];
  loans: any[];
  agedDebtors: any[];
  adjustments: any[];
}

function parseNum(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(num) ? 0 : num;
}

function formatCurrency(value: number): string {
  if (value === 0) return '-';
  const isNegative = value < 0;
  const formatted = new Intl.NumberFormat('en-GB', { 
    style: 'currency', 
    currency: 'GBP', 
    minimumFractionDigits: 0, 
    maximumFractionDigits: 0 
  }).format(Math.abs(value));
  return isNegative ? `(${formatted})` : formatted;
}

function formatPercent(value: number): string {
  if (isNaN(value) || !isFinite(value)) return '-';
  return `${(value * 100).toFixed(1)}%`;
}

export default function DealSheetPage() {
  const { id: companyId } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Valuation inputs (blue - user adjustable)
  const [multiple, setMultiple] = useState(3.0);
  const [propertyValue, setPropertyValue] = useState(0);
  const [cashValue, setCashValue] = useState(0);
  const [otherAssets, setOtherAssets] = useState(0);
  const [yearsForAverage, setYearsForAverage] = useState(3);

  // Suggested addbacks (AI-generated, user confirms)
  const [suggestedAddbacks, setSuggestedAddbacks] = useState<SuggestedAddback[]>([]);

  // Fetch financial data
  const { data: financialsData, isLoading } = useQuery<FinancialsData>({
    queryKey: ['/api/v2/financial-data/company', companyId, 'financials'],
    queryFn: async () => {
      const response = await fetch(`/api/v2/financial-data/company/${companyId}/financials`);
      const result = await response.json();
      return result.data;
    },
    enabled: !!companyId,
  });

  // Fetch company name
  const { data: company } = useQuery({
    queryKey: ['/api/v2/target-companies', companyId],
    enabled: !!companyId,
  });

  // Filter to statutory periods with data, sorted by year
  const validPeriods = useMemo(() => {
    if (!financialsData) return [];
    return financialsData.periods
      .filter(p => p.periodType === 'statutory' && p.fiscalYear)
      .sort((a, b) => (a.fiscalYear || 0) - (b.fiscalYear || 0));
  }, [financialsData]);

  // Build P&L data by year
  const plData = useMemo(() => {
    if (!financialsData || !validPeriods.length) return [];
    
    return validPeriods.map(period => {
      const income = financialsData.incomeStatements.find(i => i.financialPeriodId === period.id);
      const balance = financialsData.balanceSheets.find(b => b.financialPeriodId === period.id);
      
      const revenue = parseNum(income?.revenue);
      const cos = parseNum(income?.costOfSales);
      const grossProfit = parseNum(income?.grossProfit) || (revenue - cos);
      const adminExpenses = parseNum(income?.administrativeExpenses);
      const depreciation = parseNum(income?.depreciationAmortisation);
      const operatingProfit = parseNum(income?.operatingProfit);
      const interestPayable = parseNum(income?.interestPayable);
      const profitBeforeTax = parseNum(income?.profitBeforeTax);
      
      // Calculate EBIT and EBITDA
      const ebit = operatingProfit || (grossProfit - adminExpenses);
      const ebitda = ebit + depreciation;

      return {
        year: period.fiscalYear!,
        periodId: period.id,
        hasData: revenue > 0,
        revenue,
        costOfSales: cos,
        grossProfit,
        grossProfitMargin: revenue > 0 ? grossProfit / revenue : 0,
        operatingCosts: adminExpenses,
        ebit,
        depreciation,
        ebitda,
        interestPayable,
        profitBeforeTax,
        cash: parseNum(balance?.cashAtBank),
        property: parseNum(balance?.tangibleFixedAssets),
      };
    }).filter(p => p.hasData);
  }, [financialsData, validPeriods]);

  // Initialize suggested addbacks based on data (simulate AI suggestions)
  useEffect(() => {
    if (plData.length > 0 && suggestedAddbacks.length === 0) {
      // Simulate AI-suggested addbacks based on the data
      const suggestions: SuggestedAddback[] = [];
      
      // Director Remuneration suggestion (common addback)
      const directorAmounts: { [year: number]: number } = {};
      plData.forEach(p => {
        // Assume director remuneration is ~5% of revenue as a typical addback
        directorAmounts[p.year] = Math.round(p.revenue * 0.05);
      });
      suggestions.push({
        id: 'director_remuneration',
        category: 'Director Remuneration',
        description: 'Directors Remuneration',
        reasoning: 'Owner-managed business typically has above-market director compensation that can be added back for valuation purposes.',
        amounts: directorAmounts,
        accepted: false,
      });

      // Director Pension suggestion
      const pensionAmounts: { [year: number]: number } = {};
      plData.forEach(p => {
        pensionAmounts[p.year] = Math.round(p.revenue * 0.02);
      });
      suggestions.push({
        id: 'director_pension',
        category: 'Director Pension',
        description: 'Directors Pension Contributions',
        reasoning: 'Personal pension contributions for owner-directors are typically added back.',
        amounts: pensionAmounts,
        accepted: false,
      });

      // One-off / Non-recurring (e.g., Covid impact, legal fees)
      const oneOffAmounts: { [year: number]: number } = {};
      plData.forEach(p => {
        // Only suggest for certain years (e.g., 2021 had Covid impact)
        if (p.year === 2021) {
          oneOffAmounts[p.year] = 25000;
        } else {
          oneOffAmounts[p.year] = 0;
        }
      });
      if (Object.values(oneOffAmounts).some(v => v > 0)) {
        suggestions.push({
          id: 'covid_one_off',
          category: 'One-Off Items',
          description: 'Covid-Related Costs',
          reasoning: 'Non-recurring costs related to Covid-19 that will not repeat in future trading.',
          amounts: oneOffAmounts,
          accepted: false,
        });
      }

      setSuggestedAddbacks(suggestions);
    }
  }, [plData, suggestedAddbacks.length]);

  // Set initial cash/property values from latest balance sheet
  useEffect(() => {
    if (plData.length > 0 && cashValue === 0 && propertyValue === 0) {
      const latest = plData[plData.length - 1];
      setCashValue(latest.cash);
      setPropertyValue(latest.property);
    }
  }, [plData, cashValue, propertyValue]);

  // Calculate accepted addbacks total per year
  const acceptedAddbacksByYear = useMemo(() => {
    const totals: { [year: number]: number } = {};
    plData.forEach(p => {
      totals[p.year] = suggestedAddbacks
        .filter(a => a.accepted)
        .reduce((sum, a) => sum + (a.amounts[p.year] || 0), 0);
    });
    return totals;
  }, [suggestedAddbacks, plData]);

  // Calculate Adjusted EBITDA per year
  const adjustedEbitdaByYear = useMemo(() => {
    const result: { [year: number]: number } = {};
    plData.forEach(p => {
      result[p.year] = p.ebitda + (acceptedAddbacksByYear[p.year] || 0);
    });
    return result;
  }, [plData, acceptedAddbacksByYear]);

  // Calculate averages
  const calculations = useMemo(() => {
    if (plData.length === 0) return null;

    const recentYears = plData.slice(-yearsForAverage);
    const avgEbitda = recentYears.reduce((sum, p) => sum + (adjustedEbitdaByYear[p.year] || p.ebitda), 0) / recentYears.length;
    const avgEbit = recentYears.reduce((sum, p) => sum + p.ebit, 0) / recentYears.length;
    
    const enterpriseValue = avgEbitda * multiple;
    const totalPurchasePrice = enterpriseValue + propertyValue + cashValue + otherAssets;

    return {
      avgEbitda,
      avgEbit,
      ebitPerMonth: avgEbit / 12,
      enterpriseValue,
      totalPurchasePrice,
    };
  }, [plData, yearsForAverage, multiple, propertyValue, cashValue, otherAssets, adjustedEbitdaByYear]);

  const toggleAddback = (id: string) => {
    setSuggestedAddbacks(prev => 
      prev.map(a => a.id === id ? { ...a, accepted: !a.accepted } : a)
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!plData.length) {
    return (
      <div className="p-6">
        <Link href={`/target-companies/${companyId}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Company
          </Button>
        </Link>
        <Card className="mt-6">
          <CardContent className="py-12 text-center text-muted-foreground">
            No financial data available for this company.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/target-companies/${companyId}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Deal Sheet</h1>
          <p className="text-muted-foreground">{(company as any)?.name || 'Loading...'}</p>
        </div>
      </div>

      {/* P&L Grid */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Profit & Loss Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 font-semibold bg-slate-50">P&L</th>
                  {plData.map(p => (
                    <th key={p.year} className="text-right py-2 px-3 font-semibold bg-slate-50 min-w-[100px]">
                      {p.year}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Revenue - static data */}
                <tr className="border-b hover:bg-slate-50/50">
                  <td className="py-2 px-3 font-medium">Turnover</td>
                  {plData.map(p => (
                    <td key={p.year} className="text-right py-2 px-3">{formatCurrency(p.revenue)}</td>
                  ))}
                </tr>
                {/* Cost of Sales - static data (shown as negative) */}
                <tr className="border-b hover:bg-slate-50/50">
                  <td className="py-2 px-3 font-medium">Cost of Sales</td>
                  {plData.map(p => (
                    <td key={p.year} className="text-right py-2 px-3 text-red-600">{formatCurrency(-p.costOfSales)}</td>
                  ))}
                </tr>
                {/* Gross Profit - calculated */}
                <tr className="border-b bg-slate-50">
                  <td className="py-2 px-3 font-semibold">Gross Profit</td>
                  {plData.map(p => (
                    <td key={p.year} className="text-right py-2 px-3 font-semibold">{formatCurrency(p.grossProfit)}</td>
                  ))}
                </tr>
                {/* GP Margin - calculated */}
                <tr className="border-b hover:bg-slate-50/50">
                  <td className="py-2 px-3 text-muted-foreground">Gross Profit Margin</td>
                  {plData.map(p => (
                    <td key={p.year} className="text-right py-2 px-3 text-muted-foreground">{formatPercent(p.grossProfitMargin)}</td>
                  ))}
                </tr>
                {/* Operating Costs */}
                <tr className="border-b hover:bg-slate-50/50">
                  <td className="py-2 px-3 font-medium">Operating Costs</td>
                  {plData.map(p => (
                    <td key={p.year} className="text-right py-2 px-3 text-red-600">{formatCurrency(-p.operatingCosts)}</td>
                  ))}
                </tr>
                {/* EBIT - calculated */}
                <tr className="border-b bg-slate-50">
                  <td className="py-2 px-3 font-semibold">EBIT</td>
                  {plData.map(p => (
                    <td key={p.year} className="text-right py-2 px-3 font-semibold">{formatCurrency(p.ebit)}</td>
                  ))}
                </tr>
                {/* D&A */}
                <tr className="border-b hover:bg-slate-50/50">
                  <td className="py-2 px-3 font-medium">D&A</td>
                  {plData.map(p => (
                    <td key={p.year} className="text-right py-2 px-3">{formatCurrency(p.depreciation)}</td>
                  ))}
                </tr>
                {/* EBITDA - calculated */}
                <tr className="border-b-2 border-slate-300 bg-slate-100">
                  <td className="py-2 px-3 font-bold">EBITDA</td>
                  {plData.map(p => (
                    <td key={p.year} className="text-right py-2 px-3 font-bold">{formatCurrency(p.ebitda)}</td>
                  ))}
                </tr>

                {/* Adjustments Section */}
                <tr>
                  <td colSpan={plData.length + 1} className="py-3">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Adjustments</span>
                  </td>
                </tr>
                {suggestedAddbacks.filter(a => a.accepted).map(addback => (
                  <tr key={addback.id} className="border-b hover:bg-amber-50/50 bg-amber-50/30">
                    <td className="py-2 px-3 font-medium flex items-center gap-2">
                      <button 
                        onClick={() => toggleAddback(addback.id)}
                        className="text-amber-600 hover:text-amber-800"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      {addback.description}
                    </td>
                    {plData.map(p => (
                      <td key={p.year} className="text-right py-2 px-3 text-amber-700">
                        {formatCurrency(addback.amounts[p.year] || 0)}
                      </td>
                    ))}
                  </tr>
                ))}

                {/* Adjusted EBITDA - calculated */}
                <tr className="border-t-2 border-slate-300 bg-emerald-50">
                  <td className="py-2 px-3 font-bold text-emerald-800">Adjusted EBITDA</td>
                  {plData.map(p => (
                    <td key={p.year} className="text-right py-2 px-3 font-bold text-emerald-800">
                      {formatCurrency(adjustedEbitdaByYear[p.year] || p.ebitda)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* AI Suggested Addbacks */}
      {suggestedAddbacks.filter(a => !a.accepted).length > 0 && (
        <Card className="border-amber-200 bg-amber-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-amber-800">
              <Lightbulb className="h-5 w-5" />
              Suggested Addbacks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {suggestedAddbacks.filter(a => !a.accepted).map(addback => (
                <div key={addback.id} className="flex items-start gap-4 p-3 bg-white rounded-lg border">
                  <Checkbox
                    id={addback.id}
                    checked={addback.accepted}
                    onCheckedChange={() => toggleAddback(addback.id)}
                  />
                  <div className="flex-1">
                    <label htmlFor={addback.id} className="font-medium cursor-pointer">
                      {addback.description}
                    </label>
                    <p className="text-sm text-muted-foreground mt-1">{addback.reasoning}</p>
                    <div className="flex gap-4 mt-2 text-sm">
                      {plData.map(p => (
                        <span key={p.year} className="text-amber-700">
                          {p.year}: {formatCurrency(addback.amounts[p.year] || 0)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                    onClick={() => toggleAddback(addback.id)}
                  >
                    <Check className="h-4 w-4 mr-1" /> Accept
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Valuation Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Valuation Controls */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Valuation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Average EBITDA */}
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-muted-foreground">Avg EBITDA ({yearsForAverage} Yrs)</span>
                <div className="flex gap-1">
                  {[2, 3, 4, 5].map(y => (
                    <Button
                      key={y}
                      size="sm"
                      variant={yearsForAverage === y ? "default" : "outline"}
                      className="h-7 w-7 p-0"
                      onClick={() => setYearsForAverage(y)}
                    >
                      {y}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="text-2xl font-bold">{formatCurrency(calculations?.avgEbitda || 0)}</div>
            </div>

            {/* Multiple */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label>Multiple</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={multiple}
                    onChange={(e) => setMultiple(parseFloat(e.target.value) || 0)}
                    className="w-20 text-right font-semibold bg-blue-50 border-blue-200"
                  />
                  <span className="text-muted-foreground">x</span>
                </div>
              </div>
              <Slider
                value={[multiple]}
                onValueChange={([v]) => setMultiple(v)}
                min={1}
                max={8}
                step={0.1}
                className="w-full"
              />
            </div>

            {/* Enterprise Value */}
            <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
              <span className="text-sm text-emerald-700">Enterprise Value</span>
              <div className="text-3xl font-bold text-emerald-800">{formatCurrency(calculations?.enterpriseValue || 0)}</div>
            </div>
          </CardContent>
        </Card>

        {/* Purchase Price Adjustments */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5" />
              Purchase Price
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Asset Adjustments */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="flex items-center gap-2">
                  <span className="text-muted-foreground">(+)</span> Property
                </Label>
                <Input
                  type="number"
                  value={propertyValue || ''}
                  onChange={(e) => setPropertyValue(parseFloat(e.target.value) || 0)}
                  className="w-32 text-right bg-blue-50 border-blue-200"
                  placeholder="0"
                />
              </div>
              <div className="flex justify-between items-center">
                <Label className="flex items-center gap-2">
                  <span className="text-muted-foreground">(+)</span> Cash
                </Label>
                <Input
                  type="number"
                  value={cashValue || ''}
                  onChange={(e) => setCashValue(parseFloat(e.target.value) || 0)}
                  className="w-32 text-right bg-blue-50 border-blue-200"
                  placeholder="0"
                />
              </div>
              <div className="flex justify-between items-center">
                <Label className="flex items-center gap-2">
                  <span className="text-muted-foreground">(+)</span> Other
                </Label>
                <Input
                  type="number"
                  value={otherAssets || ''}
                  onChange={(e) => setOtherAssets(parseFloat(e.target.value) || 0)}
                  className="w-32 text-right bg-blue-50 border-blue-200"
                  placeholder="0"
                />
              </div>
            </div>

            {/* Total Purchase Price */}
            <div className="p-4 bg-slate-800 rounded-lg text-white mt-4">
              <span className="text-sm text-slate-300">Total Purchase Price</span>
              <div className="text-3xl font-bold">{formatCurrency(calculations?.totalPurchasePrice || 0)}</div>
            </div>

            {/* EBIT Summary */}
            <div className="grid grid-cols-2 gap-3 pt-4 border-t">
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-xs text-muted-foreground">EBIT p/y (Avg {yearsForAverage} yrs)</span>
                <div className="text-lg font-semibold">{formatCurrency(calculations?.avgEbit || 0)}</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-xs text-muted-foreground">EBIT p/m</span>
                <div className="text-lg font-semibold">{formatCurrency(calculations?.ebitPerMonth || 0)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
