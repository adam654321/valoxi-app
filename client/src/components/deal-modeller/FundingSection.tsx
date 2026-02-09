import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { formatCurrency } from '@/lib/format-utils';
import { toNum, type CalculationResult, type FundingLineInput } from '@shared/calculators/deal-model.calc';
import type { DealModelFundingLine } from '@shared/schema';
import {
  CreditCard,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Check,
  Loader2,
  Building2,
  Landmark,
  FileText,
  Wallet,
  Users,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';

interface FundingSectionProps {
  modelId: number;
  fundingLines: DealModelFundingLine[];
  calculations: CalculationResult | null;
  totalFundingRequired: number;
  isLocked: boolean;
  onDataChange: () => void;
}

const FUNDING_TYPE_CONFIG: Record<string, { label: string; icon: typeof CreditCard }> = {
  receivables_finance: { label: 'Receivables Finance', icon: FileText },
  asset_finance: { label: 'Asset Finance', icon: Building2 },
  property_finance: { label: 'Property Finance', icon: Landmark },
  deferred_consideration: { label: 'Deferred Consideration', icon: TrendingUp },
  new_senior_debt: { label: 'Senior Debt', icon: Landmark },
  cash_equity: { label: 'Cash Equity', icon: Wallet },
  investor_equity: { label: 'Investor Equity', icon: Users },
  mezzanine: { label: 'Mezzanine Finance', icon: TrendingUp },
};

const ASSET_BACKED_TYPES = ['receivables_finance', 'asset_finance', 'property_finance'];

const DEBT_DEFAULT_TYPES = ['receivables_finance', 'asset_finance', 'property_finance', 'new_senior_debt', 'mezzanine', 'deferred_consideration'];

function getDefaultIsDebt(fundingType: string): boolean {
  return DEBT_DEFAULT_TYPES.includes(fundingType);
}

function getFundingLabel(type: string, customLabel?: string | null): string {
  if (customLabel) return customLabel;
  return FUNDING_TYPE_CONFIG[type]?.label || type;
}

function getFundingIcon(type: string) {
  return FUNDING_TYPE_CONFIG[type]?.icon || CreditCard;
}

function pmt(principal: number, monthlyRate: number, numPayments: number): number {
  if (principal <= 0 || numPayments <= 0) return 0;
  if (monthlyRate === 0) return principal / numPayments;
  const factor = Math.pow(1 + monthlyRate, numPayments);
  return (principal * monthlyRate * factor) / (factor - 1);
}

function calcLineLocally(line: {
  isActive: boolean;
  isDebt: boolean;
  assetBaseValue: number;
  ltvPercent: number;
  amountUsed: number;
  interestRate: number;
  termMonths: number;
}): { availableAmount: number; monthlyRepayment: number; annualRepayment: number } {
  if (!line.isActive) return { availableAmount: 0, monthlyRepayment: 0, annualRepayment: 0 };
  const availableAmount = line.assetBaseValue > 0 && line.ltvPercent > 0
    ? line.assetBaseValue * line.ltvPercent / 100
    : 0;
  if (!line.isDebt) return { availableAmount, monthlyRepayment: 0, annualRepayment: 0 };
  const used = line.amountUsed;
  const rate = line.interestRate;
  const term = line.termMonths;
  let monthlyRepayment: number;
  if (term <= 1) {
    monthlyRepayment = rate > 0 ? used * rate / 100 / 12 : 0;
  } else {
    monthlyRepayment = pmt(used, rate / 100 / 12, term);
  }
  return { availableAmount, monthlyRepayment, annualRepayment: monthlyRepayment * 12 };
}

interface LocalLineValues {
  isActive: boolean;
  isDebt: boolean;
  assetBaseValue: number;
  ltvPercent: number;
  amountUsed: number;
  interestRate: number;
  termMonths: number;
}

function initLineLocal(line: DealModelFundingLine): LocalLineValues {
  return {
    isActive: line.isActive ?? false,
    isDebt: line.isDebt ?? getDefaultIsDebt(line.fundingType),
    assetBaseValue: toNum(line.assetBaseValue),
    ltvPercent: toNum(line.ltvPercent),
    amountUsed: toNum(line.amountUsed),
    interestRate: toNum(line.interestRate),
    termMonths: line.termMonths ?? 0,
  };
}

function FundingLineCard({
  line,
  calcResult,
  modelId,
  isLocked,
  onDataChange,
}: {
  line: DealModelFundingLine;
  calcResult: { availableAmount: number; monthlyRepayment: number; annualRepayment: number } | null;
  modelId: number;
  isLocked: boolean;
  onDataChange: () => void;
}) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [localVals, setLocalVals] = useState<LocalLineValues>(() => initLineLocal(line));
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<Record<string, any> | null>(null);
  const isEditingRef = useRef(false);
  const prevLineRef = useRef(line.updatedAt);

  useEffect(() => {
    if (line.updatedAt !== prevLineRef.current) {
      prevLineRef.current = line.updatedAt;
      if (!isEditingRef.current) {
        setLocalVals(initLineLocal(line));
      }
    }
  }, [line]);

  const handleFocus = useCallback(() => { isEditingRef.current = true; }, []);
  const handleBlur = useCallback(() => {
    isEditingRef.current = false;
    setTimeout(() => {
      if (!isEditingRef.current) {
        setLocalVals(initLineLocal(line));
        onDataChange();
      }
    }, 100);
  }, [line, onDataChange]);

  const updateMutation = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const res = await apiRequest('PUT', `/api/v2/deal-models/${modelId}/funding-lines/${line.id}`, updates);
      return res.json();
    },
    onSuccess: () => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 1500);
      if (!isEditingRef.current) onDataChange();
    },
    onError: (error: Error) => {
      setSaveStatus('idle');
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('DELETE', `/api/v2/deal-models/${modelId}/funding-lines/${line.id}`);
      return res.json();
    },
    onSuccess: () => {
      setDeleteOpen(false);
      onDataChange();
      toast({ title: 'Funding line removed' });
    },
    onError: (error: Error) => {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    },
  });

  const debounceSave = useCallback((updates: Record<string, any>) => {
    pendingRef.current = { ...(pendingRef.current || {}), ...updates };
    setSaveStatus('saving');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (pendingRef.current) {
        updateMutation.mutate(pendingRef.current);
        pendingRef.current = null;
      }
    }, 600);
  }, [updateMutation]);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  const updateField = useCallback((field: keyof LocalLineValues, value: number | boolean) => {
    setLocalVals(prev => ({ ...prev, [field]: value }));
    if (!isLocked) debounceSave({ [field]: typeof value === 'boolean' ? value : String(value) });
  }, [isLocked, debounceSave]);

  const toggleActive = useCallback((checked: boolean) => {
    setLocalVals(prev => ({ ...prev, isActive: checked }));
    if (!isLocked) updateMutation.mutate({ isActive: checked });
  }, [isLocked, updateMutation]);

  const toggleIsDebt = useCallback((checked: boolean) => {
    setLocalVals(prev => ({ ...prev, isDebt: checked }));
    if (!isLocked) updateMutation.mutate({ isDebt: checked });
  }, [isLocked, updateMutation]);

  const localCalc = useMemo(() => calcLineLocally(localVals), [localVals]);
  const Icon = getFundingIcon(line.fundingType);
  const label = getFundingLabel(line.fundingType, line.label);
  const isAssetBacked = ASSET_BACKED_TYPES.includes(line.fundingType);
  const overDrawn = isAssetBacked && localCalc.availableAmount > 0 && localVals.amountUsed > localCalc.availableAmount;

  return (
    <>
      <div className={`border rounded-lg transition-opacity ${localVals.isActive ? '' : 'opacity-50'}`}>
        <Collapsible open={expanded} onOpenChange={setExpanded}>
          <div className="flex items-center gap-3 px-4 py-3">
            <Switch
              checked={localVals.isActive}
              onCheckedChange={toggleActive}
              disabled={isLocked}
            />
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium truncate">{label}</span>
              <Badge variant="outline" className="text-xs shrink-0">
                {FUNDING_TYPE_CONFIG[line.fundingType]?.label || line.fundingType}
              </Badge>
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 shrink-0 ${
                  localVals.isDebt
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : 'bg-blue-50 text-blue-700 border-blue-200'
                }`}
              >
                {localVals.isDebt ? 'Debt' : 'Equity'}
              </Badge>
            </div>
            <div className="text-right shrink-0">
              <p className="text-base font-semibold">{formatCurrency(localVals.amountUsed)}</p>
              {localVals.isActive && localVals.isDebt && localCalc.monthlyRepayment > 0 && (
                <p className="text-xs text-muted-foreground">{formatCurrency(localCalc.monthlyRepayment)}/mo</p>
              )}
            </div>
            {saveStatus !== 'idle' && (
              <span className="text-xs text-muted-foreground shrink-0">
                {saveStatus === 'saving' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 text-green-600" />}
              </span>
            )}
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0">
                {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
          </div>

          <CollapsibleContent>
            <div className="px-4 pb-4 pt-1 border-t">
              <div className="flex items-center gap-4 mt-3 mb-4 py-2 px-3 bg-muted/50 rounded-md">
                <div className="flex items-center gap-2 flex-1">
                  <Label className="text-sm font-medium">Classification</Label>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${!localVals.isDebt ? 'font-semibold text-blue-700' : 'text-muted-foreground'}`}>Equity</span>
                    <Switch
                      checked={localVals.isDebt}
                      onCheckedChange={toggleIsDebt}
                      disabled={isLocked}
                    />
                    <span className={`text-xs ${localVals.isDebt ? 'font-semibold text-red-700' : 'text-muted-foreground'}`}>Debt</span>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {localVals.isDebt ? 'This source has repayment obligations' : 'No repayment required'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {isAssetBacked && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Asset Base Value</Label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">£</span>
                        <Input
                          type="number"
                          value={localVals.assetBaseValue || ''}
                          onFocus={handleFocus}
                          onBlur={handleBlur}
                          onChange={e => updateField('assetBaseValue', parseFloat(e.target.value) || 0)}
                          disabled={isLocked}
                          className="pl-7 text-right"
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">LTV %</Label>
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        max="100"
                        value={localVals.ltvPercent || ''}
                        onFocus={handleFocus}
                        onBlur={handleBlur}
                        onChange={e => updateField('ltvPercent', parseFloat(e.target.value) || 0)}
                        disabled={isLocked}
                        className="text-right"
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm text-muted-foreground">Available Amount</Label>
                      <p className="text-base font-medium py-2">{formatCurrency(localCalc.availableAmount)}</p>
                    </div>
                  </>
                )}

                <div className="space-y-1.5">
                  <Label className="text-sm">
                    {!localVals.isDebt ? 'Amount to Introduce' : isAssetBacked ? 'Amount to Draw' : 'Loan Amount'}
                  </Label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">£</span>
                    <Input
                      type="number"
                      value={localVals.amountUsed || ''}
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                      onChange={e => updateField('amountUsed', parseFloat(e.target.value) || 0)}
                      disabled={isLocked}
                      className="pl-7 text-right"
                      placeholder="0"
                    />
                  </div>
                  {overDrawn && (
                    <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                      <AlertTriangle className="h-3 w-3" />
                      Draw exceeds available ({formatCurrency(localCalc.availableAmount)} at {localVals.ltvPercent}% LTV)
                    </p>
                  )}
                </div>

                {localVals.isDebt && (
                  <div className="space-y-1.5">
                    <Label className="text-sm">Interest Rate %</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="30"
                      value={localVals.interestRate || ''}
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                      onChange={e => updateField('interestRate', parseFloat(e.target.value) || 0)}
                      disabled={isLocked}
                      className="text-right"
                      placeholder="0"
                    />
                  </div>
                )}

                {localVals.isDebt && (
                  <div className="space-y-1.5">
                    <Label className="text-sm">Term (months)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={localVals.termMonths || ''}
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                      onChange={e => updateField('termMonths', parseInt(e.target.value) || 0)}
                      disabled={isLocked}
                      className="text-right"
                      placeholder="0"
                    />
                  </div>
                )}

                {localVals.isDebt && localCalc.monthlyRepayment > 0 && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-sm text-muted-foreground">Monthly Repayment</Label>
                      <p className="text-base font-medium py-2">{formatCurrency(localCalc.monthlyRepayment)}</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm text-muted-foreground">Annual Repayment</Label>
                      <p className="text-base font-medium py-2">{formatCurrency(localCalc.annualRepayment)}</p>
                    </div>
                  </>
                )}
              </div>

              <div className="flex justify-end mt-4">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteOpen(true)}
                  disabled={isLocked}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Remove
                </Button>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Funding Line</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to remove "{label}"? This cannot be undone, but you can always add a new funding source.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function FundingSection({
  modelId,
  fundingLines,
  calculations,
  totalFundingRequired,
  isLocked,
  onDataChange,
}: FundingSectionProps) {
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [newType, setNewType] = useState('cash_equity');
  const [newLabel, setNewLabel] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newIsDebt, setNewIsDebt] = useState(false);
  const [newInterestRate, setNewInterestRate] = useState('');
  const [newTermMonths, setNewTermMonths] = useState('');

  useEffect(() => {
    setNewIsDebt(getDefaultIsDebt(newType));
  }, [newType]);

  const resetAddDialog = useCallback(() => {
    setAddOpen(false);
    setNewType('cash_equity');
    setNewLabel('');
    setNewAmount('');
    setNewIsDebt(false);
    setNewInterestRate('');
    setNewTermMonths('');
  }, []);

  const addMutation = useMutation({
    mutationFn: async (body: Record<string, any>) => {
      const res = await apiRequest('POST', `/api/v2/deal-models/${modelId}/funding-lines`, body);
      return res.json();
    },
    onSuccess: () => {
      resetAddDialog();
      onDataChange();
      toast({ title: 'Funding source added' });
    },
    onError: (error: Error) => {
      toast({ title: 'Could not add funding source', description: error.message, variant: 'destructive' });
    },
  });

  const sortedLines = useMemo(() =>
    [...fundingLines].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id - b.id),
    [fundingLines]
  );

  const totalFunded = calculations?.totalFunded ?? 0;
  const fundingGap = calculations?.fundingGap ?? 0;
  const progressPct = totalFundingRequired > 0 ? Math.min(100, (totalFunded / totalFundingRequired) * 100) : 0;

  const gapColour = fundingGap <= 0
    ? 'text-green-700'
    : fundingGap < totalFundingRequired * 0.3
      ? 'text-amber-700'
      : 'text-red-700';

  const gapBorderColour = fundingGap <= 0
    ? 'border-l-green-500'
    : fundingGap < totalFundingRequired * 0.3
      ? 'border-l-amber-500'
      : 'border-l-red-500';

  const calcResults = useMemo(() => {
    if (!calculations) return {};
    const map: Record<number, { availableAmount: number; monthlyRepayment: number; annualRepayment: number }> = {};
    sortedLines.forEach((line, idx) => {
      const cr = calculations.fundingLines[idx];
      if (cr) {
        map[line.id] = { availableAmount: cr.availableAmount, monthlyRepayment: cr.monthlyRepayment, annualRepayment: cr.annualRepayment };
      }
    });
    return map;
  }, [calculations, sortedLines]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex items-center justify-center h-6 w-6 rounded-full bg-muted text-xs font-bold">4</span>
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          How Do We Pay For It?
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Funding Target</h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total to Fund</p>
              <p className="text-xl font-bold">{formatCurrency(totalFundingRequired)}</p>
              <p className="text-xs text-muted-foreground">Purchase price + fees</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Funded So Far</p>
              <p className="text-xl font-bold">{formatCurrency(totalFunded)}</p>
            </div>
            <div className={`border-l-4 pl-3 ${gapBorderColour}`}>
              <p className="text-sm text-muted-foreground">Funding Gap</p>
              <p className={`text-xl font-bold ${gapColour}`}>
                {fundingGap <= 0 ? 'Fully Funded' : formatCurrency(fundingGap)}
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{progressPct.toFixed(0)}% funded</span>
              <span>{formatCurrency(totalFunded)} / {formatCurrency(totalFundingRequired)}</span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  progressPct >= 100 ? 'bg-green-500' : progressPct >= 70 ? 'bg-amber-500' : 'bg-primary'
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Funding Sources</h4>
            {!isLocked && (
              <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Add Source
              </Button>
            )}
          </div>

          {sortedLines.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No funding sources yet. Add one to start building the funding stack.
            </div>
          ) : (
            <div className="space-y-3">
              {sortedLines.map(line => (
                <FundingLineCard
                  key={line.id}
                  line={line}
                  calcResult={calcResults[line.id] || null}
                  modelId={modelId}
                  isLocked={isLocked}
                  onDataChange={onDataChange}
                />
              ))}
            </div>
          )}
        </div>
      </CardContent>

      <Dialog open={addOpen} onOpenChange={v => { if (!v) resetAddDialog(); else setAddOpen(true); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Funding Source</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm">Funding Type</Label>
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FUNDING_TYPE_CONFIG).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Label (optional)</Label>
              <Input
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                placeholder={FUNDING_TYPE_CONFIG[newType]?.label || ''}
              />
            </div>

            <div className="flex items-center gap-4 py-2 px-3 bg-muted/50 rounded-md">
              <div className="flex items-center gap-2 flex-1">
                <Label className="text-sm font-medium">Classification</Label>
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${!newIsDebt ? 'font-semibold text-blue-700' : 'text-muted-foreground'}`}>Equity</span>
                  <Switch
                    checked={newIsDebt}
                    onCheckedChange={setNewIsDebt}
                  />
                  <span className={`text-xs ${newIsDebt ? 'font-semibold text-red-700' : 'text-muted-foreground'}`}>Debt</span>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {newIsDebt ? 'Has repayment obligations' : 'No repayment required'}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">
                {!newIsDebt ? 'Amount to Introduce' : 'Initial Amount'}
              </Label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">£</span>
                <Input
                  type="number"
                  value={newAmount}
                  onChange={e => setNewAmount(e.target.value)}
                  className="pl-7 text-right"
                  placeholder="0"
                />
              </div>
            </div>

            {newIsDebt && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm">Interest Rate %</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="30"
                    value={newInterestRate}
                    onChange={e => setNewInterestRate(e.target.value)}
                    className="text-right"
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Term (months)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={newTermMonths}
                    onChange={e => setNewTermMonths(e.target.value)}
                    className="text-right"
                    placeholder="0"
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetAddDialog}>Cancel</Button>
            <Button
              onClick={() => {
                const body: Record<string, any> = {
                  fundingType: newType,
                  label: newLabel || null,
                  amountUsed: newAmount || '0',
                  isDebt: newIsDebt,
                  isActive: true,
                  sortOrder: sortedLines.length,
                };
                if (newIsDebt) {
                  if (newInterestRate) body.interestRate = newInterestRate;
                  if (newTermMonths) body.termMonths = parseInt(newTermMonths) || 0;
                }
                addMutation.mutate(body);
              }}
              disabled={addMutation.isPending}
            >
              {addMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
