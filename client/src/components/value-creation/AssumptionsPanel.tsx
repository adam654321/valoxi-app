import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { formatCurrency } from '@/lib/format-utils';
import { toNum } from '@shared/calculators/deal-model.calc';
import type {
  ValueCreationScenario,
  ValueCreationAssumption,
  ValueCreationSynergy,
  ValueCreationExitAssumption,
  DealModelFundingLine,
} from '@shared/schema';
import type { BaseYearData } from '@shared/calculators/value-creation.calc';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Banknote,
  LogOut,
  Check,
  Loader2,
  Info,
  Lock,
  Zap,
  Plus,
  Trash2,
} from 'lucide-react';

interface AssumptionsPanelProps {
  scenario: ValueCreationScenario;
  assumptions: ValueCreationAssumption[];
  synergies: ValueCreationSynergy[];
  exitAssumptions: ValueCreationExitAssumption | null;
  dealModelId: number;
  fundingLines: DealModelFundingLine[];
  baseYearData: BaseYearData | null;
  onDataChange: () => void;
}

function NumericStepper({
  value,
  onChange,
  step = 0.5,
  min = -50,
  max = 100,
  unit = '%',
  disabled = false,
}: {
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  disabled?: boolean;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 100) / 100));

  return (
    <div className="flex items-center gap-0.5">
      <Button
        variant="outline"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={() => onChange(clamp(value - step))}
        disabled={disabled || value <= min}
      >
        <span className="text-sm">&minus;</span>
      </Button>
      <div className="relative w-16">
        <Input
          type="number"
          value={value}
          onChange={e => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v)) onChange(clamp(v));
          }}
          disabled={disabled}
          className="h-7 text-xs text-center pr-5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          step={step}
        />
        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">
          {unit}
        </span>
      </div>
      <Button
        variant="outline"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={() => onChange(clamp(value + step))}
        disabled={disabled || value >= max}
      >
        <span className="text-sm">+</span>
      </Button>
    </div>
  );
}

function CurrencyStepper({
  value,
  onChange,
  step = 5000,
  min = 0,
  max = 10000000,
  disabled = false,
}: {
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v)));

  return (
    <div className="flex items-center gap-0.5">
      <Button
        variant="outline"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={() => onChange(clamp(value - step))}
        disabled={disabled || value <= min}
      >
        <span className="text-sm">&minus;</span>
      </Button>
      <div className="relative w-20">
        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">
          &pound;
        </span>
        <Input
          type="number"
          value={value}
          onChange={e => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v)) onChange(clamp(v));
          }}
          disabled={disabled}
          className="h-7 text-xs text-center pl-5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          step={step}
        />
      </div>
      <Button
        variant="outline"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={() => onChange(clamp(value + step))}
        disabled={disabled || value >= max}
      >
        <span className="text-sm">+</span>
      </Button>
    </div>
  );
}

export default function AssumptionsPanel({
  scenario,
  assumptions,
  synergies,
  exitAssumptions,
  dealModelId,
  fundingLines,
  baseYearData,
  onDataChange,
}: AssumptionsPanelProps) {
  const { toast } = useToast();
  const [perYearMode, setPerYearMode] = useState(false);
  const [growthOpen, setGrowthOpen] = useState(true);
  const [debtOpen, setDebtOpen] = useState(false);
  const [synergiesOpen, setSynergiesOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [addingSynergy, setAddingSynergy] = useState(false);
  const [newSynergyType, setNewSynergyType] = useState<'revenue' | 'cost'>('revenue');
  const [newSynergyName, setNewSynergyName] = useState('');
  const [newSynergyValue, setNewSynergyValue] = useState('');
  
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingAssumptionUpdates = useRef<Map<number, Record<string, any>>>(new Map());
  const pendingExitUpdates = useRef<Record<string, any> | null>(null);

  const sorted = useMemo(() =>
    [...assumptions].sort((a, b) => a.year - b.year),
    [assumptions]
  );

  const [localAssumptions, setLocalAssumptions] = useState<Record<number, Record<string, number>>>({});
  const [localExit, setLocalExit] = useState<{
    exitMultiple: number;
    holdPeriodYears: number;
    exitCostPercent: number;
  } | null>(null);

  useEffect(() => {
    const map: Record<number, Record<string, number>> = {};
    for (const a of sorted) {
      map[a.id] = {
        revenueGrowthPercent: toNum(a.revenueGrowthPercent),
        costOfSalesGrowthPercent: toNum(a.costOfSalesGrowthPercent),
        adminCostGrowthPercent: toNum(a.adminCostGrowthPercent),
        staffCostGrowthPercent: toNum(a.staffCostGrowthPercent),
        depreciationGrowthPercent: toNum(a.depreciationGrowthPercent),
        capexPerYear: toNum(a.capexPerYear),
        workingCapitalPercent: toNum(a.workingCapitalPercent),
        taxRatePercent: toNum(a.taxRatePercent),
      };
    }
    setLocalAssumptions(map);
  }, [sorted]);

  useEffect(() => {
    if (exitAssumptions) {
      setLocalExit({
        exitMultiple: toNum(exitAssumptions.exitMultiple),
        holdPeriodYears: exitAssumptions.holdPeriodYears ?? 5,
        exitCostPercent: toNum(exitAssumptions.exitCostPercent),
      });
    }
  }, [exitAssumptions]);

  const bulkUpdateMutation = useMutation({
    mutationFn: async (updates: Array<{ id: number; data: Record<string, any> }>) => {
      await apiRequest('PUT', '/api/v2/value-creation/assumptions/bulk', { updates });
    },
    onSuccess: () => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 1500);
      onDataChange();
    },
    onError: (error: Error) => {
      setSaveStatus('idle');
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
    },
  });

  const exitUpdateMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      await apiRequest('PUT', `/api/v2/value-creation/exit/${dealModelId}`, data);
    },
    onSuccess: () => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 1500);
      onDataChange();
    },
    onError: (error: Error) => {
      setSaveStatus('idle');
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
    },
  });

  const addSynergyMutation = useMutation({
    mutationFn: async (data: { synergyType: string; name: string; targetValue: string }) => {
      await apiRequest('POST', `/api/v2/value-creation/synergies/${scenario.id}`, data);
    },
    onSuccess: () => {
      setAddingSynergy(false);
      setNewSynergyName('');
      setNewSynergyValue('');
      setNewSynergyType('revenue');
      onDataChange();
      toast({ title: 'Synergy added' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to add synergy', description: error.message, variant: 'destructive' });
    },
  });

  const updateSynergyMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, any> }) => {
      await apiRequest('PUT', `/api/v2/value-creation/synergies/${id}`, data);
    },
    onSuccess: () => {
      onDataChange();
    },
    onError: (error: Error) => {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    },
  });

  const deleteSynergyMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/v2/value-creation/synergies/${id}`);
    },
    onSuccess: () => {
      onDataChange();
      toast({ title: 'Synergy removed' });
    },
    onError: (error: Error) => {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    },
  });

  const scenarioSynergies = useMemo(() =>
    synergies.filter(s => s.scenarioId === scenario.id),
    [synergies, scenario.id]
  );

  const flushSave = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const assumptionUpdates = Array.from(pendingAssumptionUpdates.current.entries()).map(
      ([id, data]) => ({ id, data })
    );
    const exitUpdate = pendingExitUpdates.current;

    if (assumptionUpdates.length > 0) {
      bulkUpdateMutation.mutate(assumptionUpdates);
      pendingAssumptionUpdates.current.clear();
    }
    if (exitUpdate) {
      exitUpdateMutation.mutate(exitUpdate);
      pendingExitUpdates.current = null;
    }
  }, [bulkUpdateMutation, exitUpdateMutation]);

  const scheduleSave = useCallback(() => {
    setSaveStatus('saving');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(flushSave, 800);
  }, [flushSave]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const updateAssumption = useCallback((assumptionId: number, field: string, value: number) => {
    setLocalAssumptions(prev => ({
      ...prev,
      [assumptionId]: { ...(prev[assumptionId] || {}), [field]: value },
    }));

    const existing = pendingAssumptionUpdates.current.get(assumptionId) || {};
    pendingAssumptionUpdates.current.set(assumptionId, { ...existing, [field]: String(value) });
    scheduleSave();
  }, [scheduleSave]);

  const updateAllYears = useCallback((field: string, value: number) => {
    for (const a of sorted) {
      updateAssumption(a.id, field, value);
    }
  }, [sorted, updateAssumption]);

  const updateExit = useCallback((field: string, value: number) => {
    setLocalExit(prev => prev ? { ...prev, [field]: value } : null);
    pendingExitUpdates.current = { ...(pendingExitUpdates.current || {}), [field]: String(value) };
    scheduleSave();
  }, [scheduleSave]);

  const getLocal = (assumptionId: number, field: string): number => {
    return localAssumptions[assumptionId]?.[field] ?? 0;
  };

  const firstAssumption = sorted[0];
  const simpleVal = (field: string): number => {
    if (!firstAssumption) return 0;
    return getLocal(firstAssumption.id, field);
  };

  const totalDebt = fundingLines
    .filter(f => f.isDebt && f.isActive)
    .reduce((sum, f) => sum + toNum(f.amountUsed), 0);
  const avgRate = (() => {
    const debtLines = fundingLines.filter(f => f.isDebt && f.isActive && toNum(f.amountUsed) > 0);
    if (debtLines.length === 0) return 0;
    const weighted = debtLines.reduce((sum, f) => sum + toNum(f.interestRate) * toNum(f.amountUsed), 0);
    return weighted / debtLines.reduce((sum, f) => sum + toNum(f.amountUsed), 0);
  })();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Assumptions</h3>
        {saveStatus !== 'idle' && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {saveStatus === 'saving' ? (
              <><Loader2 className="h-3 w-3 animate-spin" /> Saving</>
            ) : (
              <><Check className="h-3 w-3 text-green-600" /> Saved</>
            )}
          </span>
        )}
      </div>

      <Badge variant="secondary" className="text-xs">
        {scenario.name} {scenario.scenarioType === 'bear' ? '\uD83D\uDC3B' : scenario.scenarioType === 'bull' ? '\uD83D\uDC02' : '\uD83D\uDCCA'}
      </Badge>

      <Collapsible open={growthOpen} onOpenChange={setGrowthOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 hover:bg-muted/50 rounded-md px-2 transition-colors">
          {growthOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <TrendingUp className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium flex-1 text-left">Growth Assumptions</span>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-2">
          <div className="flex items-center gap-2 px-2">
            <Label htmlFor="per-year-toggle" className="text-xs text-muted-foreground">
              {perYearMode ? 'Per year' : 'Uniform'}
            </Label>
            <Switch
              id="per-year-toggle"
              checked={perYearMode}
              onCheckedChange={setPerYearMode}
            />
          </div>

          {perYearMode ? (
            <div className="space-y-4">
              {sorted.map(a => (
                <div key={a.id} className="space-y-2 border rounded-lg p-2 bg-muted/20">
                  <p className="text-xs font-semibold text-muted-foreground">Year {a.year}</p>
                  
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs">Revenue growth</span>
                      <NumericStepper
                        value={getLocal(a.id, 'revenueGrowthPercent')}
                        onChange={v => updateAssumption(a.id, 'revenueGrowthPercent', v)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs">CoS inflation</span>
                      <NumericStepper
                        value={getLocal(a.id, 'costOfSalesGrowthPercent')}
                        onChange={v => updateAssumption(a.id, 'costOfSalesGrowthPercent', v)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs">Staff cost growth</span>
                      <NumericStepper
                        value={getLocal(a.id, 'staffCostGrowthPercent')}
                        onChange={v => updateAssumption(a.id, 'staffCostGrowthPercent', v)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs">Admin cost growth</span>
                      <NumericStepper
                        value={getLocal(a.id, 'adminCostGrowthPercent')}
                        onChange={v => updateAssumption(a.id, 'adminCostGrowthPercent', v)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs">Capex</span>
                      <CurrencyStepper
                        value={getLocal(a.id, 'capexPerYear')}
                        onChange={v => updateAssumption(a.id, 'capexPerYear', v)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs">Tax rate</span>
                      <NumericStepper
                        value={getLocal(a.id, 'taxRatePercent')}
                        onChange={v => updateAssumption(a.id, 'taxRatePercent', v)}
                        step={1}
                        min={0}
                        max={50}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2 px-1">
              <div className="flex items-center justify-between">
                <span className="text-xs">Revenue growth</span>
                <NumericStepper
                  value={simpleVal('revenueGrowthPercent')}
                  onChange={v => updateAllYears('revenueGrowthPercent', v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs">CoS inflation</span>
                <NumericStepper
                  value={simpleVal('costOfSalesGrowthPercent')}
                  onChange={v => updateAllYears('costOfSalesGrowthPercent', v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs">Staff cost growth</span>
                <NumericStepper
                  value={simpleVal('staffCostGrowthPercent')}
                  onChange={v => updateAllYears('staffCostGrowthPercent', v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs">Admin cost growth</span>
                <NumericStepper
                  value={simpleVal('adminCostGrowthPercent')}
                  onChange={v => updateAllYears('adminCostGrowthPercent', v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs">Capex (per year)</span>
                <CurrencyStepper
                  value={simpleVal('capexPerYear')}
                  onChange={v => updateAllYears('capexPerYear', v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs">Working capital (% &Delta;rev)</span>
                <NumericStepper
                  value={simpleVal('workingCapitalPercent')}
                  onChange={v => updateAllYears('workingCapitalPercent', v)}
                  step={1}
                  min={0}
                  max={30}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs">Tax rate</span>
                <NumericStepper
                  value={simpleVal('taxRatePercent')}
                  onChange={v => updateAllYears('taxRatePercent', v)}
                  step={1}
                  min={0}
                  max={50}
                />
              </div>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      <Collapsible open={debtOpen} onOpenChange={setDebtOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 hover:bg-muted/50 rounded-md px-2 transition-colors">
          {debtOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <Banknote className="h-4 w-4 text-amber-600" />
          <span className="text-sm font-medium flex-1 text-left">Debt & Financing</span>
          <Lock className="h-3 w-3 text-muted-foreground" />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 pt-2 px-1">
          <p className="text-[11px] text-muted-foreground italic">
            From Deal Modeller funding stack. Edit in the Deal Modeller tab.
          </p>
          
          {fundingLines.filter(f => f.isActive).length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">No funding lines configured</p>
          ) : (
            <div className="space-y-1.5">
              {fundingLines.filter(f => f.isActive).map((f, i) => (
                <div key={f.id || i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    {f.isDebt && <Badge variant="outline" className="text-[9px] h-4 px-1">Debt</Badge>}
                    <span className="truncate max-w-[140px]">{f.label || f.fundingType}</span>
                  </div>
                  <span className="font-mono">{formatCurrency(toNum(f.amountUsed))}</span>
                </div>
              ))}
              <Separator className="my-1" />
              <div className="flex items-center justify-between text-xs font-semibold">
                <span>Total Debt</span>
                <span className="font-mono">{formatCurrency(totalDebt)}</span>
              </div>
              {avgRate > 0 && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Weighted Avg Rate</span>
                  <span>{avgRate.toFixed(2)}%</span>
                </div>
              )}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      <Collapsible open={synergiesOpen} onOpenChange={setSynergiesOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 hover:bg-muted/50 rounded-md px-2 transition-colors">
          {synergiesOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <Zap className="h-4 w-4 text-purple-600" />
          <span className="text-sm font-medium flex-1 text-left">Synergies</span>
          {scenarioSynergies.length > 0 && (
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{scenarioSynergies.length}</Badge>
          )}
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 pt-2 px-1">
          {scenarioSynergies.length === 0 && !addingSynergy && (
            <p className="text-xs text-muted-foreground text-center py-2">No synergies added yet</p>
          )}

          {scenarioSynergies.map(s => (
            <div key={s.id} className="border rounded-lg p-2 bg-muted/20 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Badge
                    variant="outline"
                    className={`text-[9px] h-4 px-1 ${
                      s.synergyType === 'revenue'
                        ? 'border-green-300 text-green-700 dark:text-green-400'
                        : 'border-blue-300 text-blue-700 dark:text-blue-400'
                    }`}
                  >
                    {s.synergyType === 'revenue' ? 'Rev' : 'Cost'}
                  </Badge>
                  <span className="text-xs font-medium truncate max-w-[120px]">{s.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-red-600"
                  onClick={() => deleteSynergyMutation.mutate(s.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">Target value</span>
                <span className="text-xs font-mono">{formatCurrency(toNum(s.targetValue))}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">Impl. cost</span>
                <CurrencyStepper
                  value={toNum(s.implementationCost)}
                  onChange={v => updateSynergyMutation.mutate({ id: s.id, data: { implementationCost: String(v) } })}
                  step={5000}
                />
              </div>
              <div className="space-y-0.5">
                <span className="text-[11px] text-muted-foreground">Realisation %</span>
                <div className="grid grid-cols-5 gap-1">
                  {[1, 2, 3, 4, 5].map(y => (
                    <div key={y} className="text-center">
                      <p className="text-[9px] text-muted-foreground mb-0.5">Y{y}</p>
                      <Input
                        type="number"
                        className="h-6 text-[11px] text-center p-0 font-mono"
                        value={toNum((s as any)[`realisationY${y}`])}
                        onChange={e => updateSynergyMutation.mutate({
                          id: s.id,
                          data: { [`realisationY${y}`]: String(e.target.value || '0') },
                        })}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}

          {addingSynergy ? (
            <div className="border rounded-lg p-2 space-y-2 bg-muted/10">
              <Select value={newSynergyType} onValueChange={(v: 'revenue' | 'cost') => setNewSynergyType(v)}>
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="revenue">Revenue synergy</SelectItem>
                  <SelectItem value="cost">Cost synergy</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="Name (e.g. Cross-sell)"
                className="h-7 text-xs"
                value={newSynergyName}
                onChange={e => setNewSynergyName(e.target.value)}
              />
              <Input
                placeholder="Target value (£)"
                type="number"
                className="h-7 text-xs"
                value={newSynergyValue}
                onChange={e => setNewSynergyValue(e.target.value)}
              />
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  className="h-7 text-xs flex-1"
                  disabled={!newSynergyName.trim() || !newSynergyValue || addSynergyMutation.isPending}
                  onClick={() => addSynergyMutation.mutate({
                    synergyType: newSynergyType,
                    name: newSynergyName.trim(),
                    targetValue: newSynergyValue,
                  })}
                >
                  {addSynergyMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Add'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    setAddingSynergy(false);
                    setNewSynergyName('');
                    setNewSynergyValue('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full h-7 text-xs gap-1"
              onClick={() => setAddingSynergy(true)}
            >
              <Plus className="h-3 w-3" />
              Add synergy
            </Button>
          )}
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      <Collapsible open={exitOpen} onOpenChange={setExitOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 hover:bg-muted/50 rounded-md px-2 transition-colors">
          {exitOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <LogOut className="h-4 w-4 text-emerald-600" />
          <span className="text-sm font-medium flex-1 text-left">Exit Assumptions</span>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-2 px-1">
          {localExit && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs">Exit multiple</span>
                  <NumericStepper
                    value={localExit.exitMultiple}
                    onChange={v => updateExit('exitMultiple', v)}
                    step={0.5}
                    min={1}
                    max={15}
                    unit="x"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs">Hold period</span>
                  <div className="flex items-center gap-1">
                    {[3, 4, 5, 6, 7].map(y => (
                      <Button
                        key={y}
                        variant={localExit.holdPeriodYears === y ? 'default' : 'outline'}
                        size="sm"
                        className="h-7 w-8 text-xs p-0"
                        onClick={() => updateExit('holdPeriodYears', y)}
                      >
                        {y}
                      </Button>
                    ))}
                    <span className="text-[10px] text-muted-foreground ml-1">yrs</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs">Exit costs</span>
                  <NumericStepper
                    value={localExit.exitCostPercent}
                    onChange={v => updateExit('exitCostPercent', v)}
                    step={0.5}
                    min={0}
                    max={10}
                  />
                </div>
              </div>
            </>
          )}
        </CollapsibleContent>
      </Collapsible>

      {baseYearData && (
        <>
          <Separator />
          <div className="px-1 space-y-1">
            <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide">Base Year</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
              <span className="text-muted-foreground">Revenue</span>
              <span className="text-right font-mono">{formatCurrency(baseYearData.revenue)}</span>
              <span className="text-muted-foreground">EBITDA</span>
              <span className="text-right font-mono">{formatCurrency(baseYearData.adjustedEbitda)}</span>
              <span className="text-muted-foreground">EBITDA Margin</span>
              <span className="text-right font-mono">
                {baseYearData.revenue > 0 ? ((baseYearData.adjustedEbitda / baseYearData.revenue) * 100).toFixed(1) + '%' : '\u2014'}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
