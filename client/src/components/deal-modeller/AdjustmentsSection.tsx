import { useState, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { formatCurrency } from '@/lib/format-utils';
import { toNum } from '@shared/calculators/deal-model.calc';
import type { CalculationResult } from '@shared/calculators/deal-model.calc';
import type { DealModelAdjustment } from '@shared/schema';
import {
  Check,
  X,
  Pencil,
  Undo2,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  CheckCircle2,
  Loader2,
  Info,
  Calendar,
} from 'lucide-react';

interface AdjustmentsSectionProps {
  modelId: number;
  adjustments: DealModelAdjustment[];
  calculations: CalculationResult | null;
  isLocked: boolean;
  financialYears: string[];
  onDataChange: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  owner_salary_excess: 'Owner Salary Excess',
  one_off_cost: 'One-Off Cost',
  non_recurring: 'Non-Recurring',
  related_party: 'Related Party',
  discretionary: 'Discretionary',
  personal_expense: 'Personal Expense',
  depreciation: 'Depreciation',
  amortisation: 'Amortisation',
  rent_adjustment: 'Rent Adjustment',
  pension_excess: 'Pension Excess',
  director_remuneration: 'Director Remuneration',
  covid_related: 'COVID Related',
  normalisation: 'Normalisation',
  replacement_salary: 'Replacement Salary',
  missing_management: 'Missing Management',
  deferred_maintenance: 'Deferred Maintenance',
  unsustainable_revenue: 'Unsustainable Revenue',
  bad_debt_provision: 'Bad Debt Provision',
  redundant_cost: 'Redundant Cost',
  other: 'Other',
  custom: 'Custom',
};

const CONFIDENCE_COLOURS: Record<string, string> = {
  high: 'bg-green-100 text-green-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-red-100 text-red-700',
};

const DEFENSIBILITY_COLOURS: Record<string, string> = {
  strong: 'bg-green-100 text-green-700 border-green-200',
  moderate: 'bg-amber-100 text-amber-700 border-amber-200',
  weak: 'bg-red-100 text-red-700 border-red-200',
};

function defensibilityLabel(score: number | null | undefined): { label: string; colour: string } {
  if (score == null) return { label: '', colour: '' };
  if (score >= 8) return { label: `${score}/10`, colour: DEFENSIBILITY_COLOURS.strong };
  if (score >= 5) return { label: `${score}/10`, colour: DEFENSIBILITY_COLOURS.moderate };
  return { label: `${score}/10`, colour: DEFENSIBILITY_COLOURS.weak };
}

const STATUS_BORDER: Record<string, string> = {
  accepted: 'border-l-4 border-l-green-500',
  rejected: 'border-l-4 border-l-red-400 opacity-60',
  modified: 'border-l-4 border-l-amber-500',
  suggested: 'border-l-4 border-l-transparent',
};

function categoryLabel(cat: string): string {
  return CATEGORY_LABELS[cat] || cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatCompactCurrency(val: number): string {
  if (Math.abs(val) >= 1000) {
    return `£${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}k`;
  }
  return formatCurrency(val);
}

interface CategoryGroup {
  category: string;
  label: string;
  items: DealModelAdjustment[];
  total: number;
}

function groupByCategory(adjustments: DealModelAdjustment[]): CategoryGroup[] {
  const groups: Record<string, DealModelAdjustment[]> = {};
  for (const adj of adjustments) {
    const cat = adj.category || 'other';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(adj);
  }

  return Object.entries(groups)
    .map(([category, items]) => ({
      category,
      label: categoryLabel(category),
      items: items.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id - b.id),
      total: items
        .filter(a => a.status === 'accepted' || a.status === 'modified')
        .reduce((sum, a) => sum + toNum(a.amount), 0),
    }))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
}

function PerYearGrid({ years, amounts, onChange }: {
  years: string[];
  amounts: Record<string, string>;
  onChange: (year: string, value: string) => void;
}) {
  const total = useMemo(() => {
    return years.reduce((sum, y) => sum + toNum(amounts[y] || '0'), 0);
  }, [years, amounts]);

  return (
    <div className="space-y-2">
      <div className="max-h-[200px] overflow-y-auto space-y-1.5">
        {years.map(year => (
          <div key={year} className="flex items-center gap-3">
            <Label className="text-sm w-16 shrink-0 text-muted-foreground">{year}</Label>
            <Input
              type="number"
              step="0.01"
              value={amounts[year] || ''}
              onChange={(e) => onChange(year, e.target.value)}
              placeholder="0"
              className="h-8 text-sm"
            />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 pt-1 border-t">
        <Label className="text-sm w-16 shrink-0 font-semibold">Total</Label>
        <p className="text-sm font-semibold">{formatCurrency(total)}</p>
      </div>
    </div>
  );
}

export default function AdjustmentsSection({ modelId, adjustments, calculations, isLocked, financialYears, onDataChange }: AdjustmentsSectionProps) {
  const { toast } = useToast();
  const [modifyTarget, setModifyTarget] = useState<DealModelAdjustment | null>(null);
  const [modifyAmount, setModifyAmount] = useState('');
  const [modifyReason, setModifyReason] = useState('');
  const [modifyPerYear, setModifyPerYear] = useState(false);
  const [modifyYearAmounts, setModifyYearAmounts] = useState<Record<string, string>>({});
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addType, setAddType] = useState<'add_back' | 'deduction'>('add_back');
  const [addCategory, setAddCategory] = useState('other');
  const [addDescription, setAddDescription] = useState('');
  const [addAmount, setAddAmount] = useState('');
  const [addNotes, setAddNotes] = useState('');
  const [addPerYear, setAddPerYear] = useState(false);
  const [addYearAmounts, setAddYearAmounts] = useState<Record<string, string>>({});
  const [expandedReasoning, setExpandedReasoning] = useState<Set<number>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  function toggleCategory(key: string) {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  const updateMutation = useMutation({
    mutationFn: async ({ adjId, body }: { adjId: number; body: any }) => {
      const res = await apiRequest('PUT', `/api/v2/deal-models/${modelId}/adjustments/${adjId}`, body);
      return res.json();
    },
    onSuccess: () => onDataChange(),
    onError: (err: Error) => toast({ title: 'Update failed', description: err.message, variant: 'destructive' }),
  });

  const bulkMutation = useMutation({
    mutationFn: async (updates: Array<{ id: number; status: string }>) => {
      const res = await apiRequest('PUT', `/api/v2/deal-models/${modelId}/adjustments/bulk`, { updates });
      return res.json();
    },
    onSuccess: () => {
      onDataChange();
      toast({ title: 'All adjustments accepted' });
    },
    onError: (err: Error) => toast({ title: 'Bulk update failed', description: err.message, variant: 'destructive' }),
  });

  const addMutation = useMutation({
    mutationFn: async (body: any) => {
      const res = await apiRequest('POST', `/api/v2/deal-models/${modelId}/adjustments`, body);
      return res.json();
    },
    onSuccess: () => {
      onDataChange();
      setAddDialogOpen(false);
      resetAddForm();
      toast({ title: 'Adjustment added' });
    },
    onError: (err: Error) => toast({ title: 'Could not add adjustment', description: err.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (adjId: number) => {
      const res = await apiRequest('DELETE', `/api/v2/deal-models/${modelId}/adjustments/${adjId}`);
      return res.json();
    },
    onSuccess: () => {
      onDataChange();
      toast({ title: 'Adjustment deleted' });
    },
    onError: (err: Error) => toast({ title: 'Delete failed', description: err.message, variant: 'destructive' }),
  });

  function resetAddForm() {
    setAddType('add_back');
    setAddCategory('other');
    setAddDescription('');
    setAddAmount('');
    setAddNotes('');
    setAddPerYear(false);
    setAddYearAmounts({});
  }

  const expertAdjustments = adjustments.filter(a => !a.isManual);
  const manualAdjustments = adjustments.filter(a => a.isManual);
  const addBacks = expertAdjustments.filter(a => a.adjustmentType === 'add_back').sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id - b.id);
  const deductions = expertAdjustments.filter(a => a.adjustmentType === 'deduction').sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id - b.id);
  const addBackGroups = useMemo(() => groupByCategory(addBacks), [addBacks]);
  const deductionGroups = useMemo(() => groupByCategory(deductions), [deductions]);
  const suggested = expertAdjustments.filter(a => a.status === 'suggested');

  const counts = {
    suggested: adjustments.filter(a => a.status === 'suggested').length,
    accepted: adjustments.filter(a => a.status === 'accepted').length,
    rejected: adjustments.filter(a => a.status === 'rejected').length,
    modified: adjustments.filter(a => a.status === 'modified').length,
  };

  const acceptedAddBacks = adjustments.filter(a => (a.status === 'accepted' || a.status === 'modified') && a.adjustmentType === 'add_back');
  const acceptedDeductions = adjustments.filter(a => (a.status === 'accepted' || a.status === 'modified') && a.adjustmentType === 'deduction');
  const totalAddBacks = acceptedAddBacks.reduce((sum, a) => sum + toNum(a.amount), 0);
  const totalDeductions = acceptedDeductions.reduce((sum, a) => sum + toNum(a.amount), 0);
  const netImpact = totalAddBacks - totalDeductions;

  function handleAccept(adj: DealModelAdjustment) {
    updateMutation.mutate({ adjId: adj.id, body: { status: 'accepted', isAccepted: true } });
  }

  function handleReject(adj: DealModelAdjustment) {
    updateMutation.mutate({ adjId: adj.id, body: { status: 'rejected', isAccepted: false } });
  }

  function handleUndo(adj: DealModelAdjustment) {
    updateMutation.mutate({ adjId: adj.id, body: { status: 'suggested', isAccepted: false } });
  }

  function handleBulkAccept() {
    const updates = suggested.map(a => ({ id: a.id, status: 'accepted' }));
    if (updates.length > 0) bulkMutation.mutate(updates);
  }

  function openModifyDialog(adj: DealModelAdjustment) {
    setModifyTarget(adj);
    const existingByYear = adj.amountsByYear as Record<string, number> | null;
    const hasPerYear = existingByYear && Object.keys(existingByYear).length > 0;

    setModifyPerYear(!!hasPerYear);
    setModifyAmount(String(toNum(adj.amount)));
    setModifyReason('');

    if (hasPerYear) {
      const yearStrings: Record<string, string> = {};
      for (const [y, v] of Object.entries(existingByYear!)) {
        yearStrings[y] = String(v);
      }
      setModifyYearAmounts(yearStrings);
    } else {
      const flatAmount = toNum(adj.amount);
      const divided = financialYears.length > 0 ? flatAmount / financialYears.length : 0;
      const yearStrings: Record<string, string> = {};
      for (const y of financialYears) {
        yearStrings[y] = String(Math.round(divided * 100) / 100);
      }
      setModifyYearAmounts(yearStrings);
    }
  }

  function handleModifySave() {
    if (!modifyTarget) return;

    if (modifyPerYear && financialYears.length > 0) {
      const amountsByYear: Record<string, number> = {};
      let total = 0;
      for (const y of financialYears) {
        const val = toNum(modifyYearAmounts[y] || '0');
        amountsByYear[y] = val;
        total += val;
      }
      updateMutation.mutate({
        adjId: modifyTarget.id,
        body: {
          status: 'modified',
          isAccepted: true,
          amount: String(total),
          amountsByYear,
          userOverrideAmount: null,
        },
      });
    } else {
      updateMutation.mutate({
        adjId: modifyTarget.id,
        body: {
          status: 'modified',
          isAccepted: true,
          amount: modifyAmount,
          userOverrideAmount: modifyAmount,
          amountsByYear: null,
        },
      });
    }
    setModifyTarget(null);
  }

  function handleAddSave() {
    if (!addDescription.trim()) return;

    if (addPerYear && financialYears.length > 0) {
      const amountsByYear: Record<string, number> = {};
      let total = 0;
      for (const y of financialYears) {
        const val = toNum(addYearAmounts[y] || '0');
        amountsByYear[y] = val;
        total += val;
      }
      if (total === 0) return;
      addMutation.mutate({
        adjustmentType: addType,
        category: addCategory,
        description: addDescription.trim(),
        amount: String(total),
        amountsByYear,
        reasoning: addNotes.trim() || undefined,
      });
    } else {
      if (!addAmount.trim()) return;
      addMutation.mutate({
        adjustmentType: addType,
        category: addCategory,
        description: addDescription.trim(),
        amount: addAmount,
        reasoning: addNotes.trim() || undefined,
      });
    }
  }

  function toggleReasoning(id: number) {
    setExpandedReasoning(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const isBusy = updateMutation.isPending || bulkMutation.isPending || addMutation.isPending || deleteMutation.isPending;

  const addTotalPerYear = useMemo(() => {
    return financialYears.reduce((sum, y) => sum + toNum(addYearAmounts[y] || '0'), 0);
  }, [financialYears, addYearAmounts]);

  function renderAdjustmentRow(adj: DealModelAdjustment, allowDelete: boolean) {
    const borderClass = STATUS_BORDER[adj.status || 'suggested'] || '';
    const amount = toNum(adj.amount);
    const amountsByYear = adj.amountsByYear as Record<string, number> | null;
    const hasPerYear = amountsByYear && Object.keys(amountsByYear).length > 0;

    return (
      <div key={adj.id} className={`flex items-start gap-3 py-3 px-3 ${borderClass}`}>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">{categoryLabel(adj.category)}</Badge>
            <Badge variant={adj.adjustmentType === 'add_back' ? 'default' : 'secondary'} className="text-xs">
              {adj.adjustmentType === 'add_back' ? 'Add-back' : 'Deduction'}
            </Badge>
            {adj.confidence && (
              <Badge className={`text-xs ${CONFIDENCE_COLOURS[adj.confidence] || ''}`}>
                {adj.confidence}
              </Badge>
            )}
            {(adj as any).defensibilityScore != null && (
              <Badge variant="outline" className={`text-xs ${defensibilityLabel((adj as any).defensibilityScore).colour}`}>
                Defensibility: {defensibilityLabel((adj as any).defensibilityScore).label}
              </Badge>
            )}
            {adj.status === 'accepted' && <Badge className="bg-green-100 text-green-700 text-xs"><Check className="h-3 w-3 mr-0.5" />Accepted</Badge>}
            {adj.status === 'rejected' && <Badge className="bg-red-100 text-red-700 text-xs"><X className="h-3 w-3 mr-0.5" />Rejected</Badge>}
            {adj.status === 'modified' && <Badge className="bg-amber-100 text-amber-700 text-xs"><Pencil className="h-3 w-3 mr-0.5" />Modified</Badge>}
          </div>

          <p className="text-sm">{adj.description}</p>

          {adj.sourceExpert && !adj.isManual && (
            <p className="text-xs text-muted-foreground">Suggested by {adj.sourceExpert.replace(/_/g, ' ')}</p>
          )}

          {(adj.reasoning || (adj as any).caseForInclusion || (adj as any).caseForExclusion) && (
            <Collapsible open={expandedReasoning.has(adj.id)} onOpenChange={() => toggleReasoning(adj.id)}>
              <CollapsibleTrigger asChild>
                <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  {expandedReasoning.has(adj.id) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  Analysis &amp; defensibility
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-1 space-y-2">
                  {adj.reasoning && (
                    <div className="bg-muted/50 p-2 rounded">
                      <p className="text-xs font-medium text-muted-foreground mb-0.5">Expert reasoning</p>
                      <p className="text-xs text-muted-foreground">{adj.reasoning}</p>
                    </div>
                  )}
                  {((adj as any).caseForInclusion || (adj as any).caseForExclusion) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {(adj as any).caseForInclusion && (
                        <div className="bg-green-50 border border-green-200 p-2 rounded">
                          <p className="text-xs font-medium text-green-700 mb-0.5">Case for including</p>
                          <p className="text-xs text-green-800">{(adj as any).caseForInclusion}</p>
                        </div>
                      )}
                      {(adj as any).caseForExclusion && (
                        <div className="bg-red-50 border border-red-200 p-2 rounded">
                          <p className="text-xs font-medium text-red-700 mb-0.5">Case against</p>
                          <p className="text-xs text-red-800">{(adj as any).caseForExclusion}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {hasPerYear ? (
            <div className="flex items-center gap-1.5 flex-wrap mt-1">
              <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
              {Object.entries(amountsByYear!).sort().map(([year, val], idx) => (
                <span key={year} className="text-xs text-muted-foreground">
                  {idx > 0 && <span className="mr-1.5">·</span>}
                  {year}: {formatCompactCurrency(val)}
                </span>
              ))}
            </div>
          ) : (
            amount > 0 && (
              <p className="text-xs text-muted-foreground mt-1">(all years)</p>
            )
          )}
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="text-right">
            {adj.status === 'modified' ? (
              <>
                <span className="text-xs line-through text-muted-foreground">{formatCurrency(toNum((adj as any).userOverrideAmount ?? adj.amount))}</span>
                <p className="text-sm font-semibold">{formatCurrency(amount)}</p>
              </>
            ) : (
              <p className="text-sm font-semibold">{formatCurrency(amount)}</p>
            )}
          </div>

          <div className="flex items-center gap-1">
            {adj.status === 'suggested' && (
              <>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600 hover:bg-green-50" onClick={() => handleAccept(adj)} disabled={isLocked || isBusy} title="Accept">
                  <Check className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600 hover:bg-red-50" onClick={() => handleReject(adj)} disabled={isLocked || isBusy} title="Reject">
                  <X className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-600 hover:bg-amber-50" onClick={() => openModifyDialog(adj)} disabled={isLocked || isBusy} title="Modify">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
            {(adj.status === 'accepted' || adj.status === 'rejected' || adj.status === 'modified') && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleUndo(adj)} disabled={isLocked || isBusy} title="Undo">
                <Undo2 className="h-3.5 w-3.5" />
              </Button>
            )}
            {allowDelete && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:bg-red-50" onClick={() => deleteMutation.mutate(adj.id)} disabled={isLocked || isBusy} title="Delete">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex items-center justify-center h-6 w-6 rounded-full bg-muted text-xs font-bold">2</span>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
            What Should We Adjust?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="default"
              size="sm"
              onClick={handleBulkAccept}
              disabled={isLocked || isBusy || suggested.length === 0}
            >
              {bulkMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
              Accept All Suggested ({suggested.length})
            </Button>
            <div className="flex gap-1.5 ml-auto">
              {counts.suggested > 0 && <Badge variant="outline" className="text-xs">{counts.suggested} pending</Badge>}
              {counts.accepted > 0 && <Badge className="bg-green-100 text-green-700 text-xs">{counts.accepted} accepted</Badge>}
              {counts.rejected > 0 && <Badge className="bg-red-100 text-red-700 text-xs">{counts.rejected} rejected</Badge>}
              {counts.modified > 0 && <Badge className="bg-amber-100 text-amber-700 text-xs">{counts.modified} modified</Badge>}
            </div>
          </div>

          {expertAdjustments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No expert-suggested adjustments found. Run expert analysis to generate adjustment recommendations.</p>
          ) : (
            <div>
              {addBackGroups.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2 tracking-wider">Add-backs</h4>
                  <div className="space-y-1">
                    {addBackGroups.map(group => {
                      const groupKey = `ab-${group.category}`;
                      const isExpanded = expandedCategories.has(groupKey);
                      return (
                        <div key={groupKey} className="border rounded-md">
                          <button
                            className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-muted/50 transition-colors"
                            onClick={() => toggleCategory(groupKey)}
                          >
                            <div className="flex items-center gap-2">
                              {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                              <span className="text-sm font-medium">{group.label}</span>
                              <Badge variant="outline" className="text-xs">{group.items.length} item{group.items.length !== 1 ? 's' : ''}</Badge>
                            </div>
                            <span className="text-sm font-semibold text-green-700">{group.total > 0 ? `+${formatCurrency(group.total)}` : ''}</span>
                          </button>
                          {isExpanded && (
                            <div className="border-t divide-y">
                              {group.items.map(a => renderAdjustmentRow(a, false))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {deductionGroups.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2 tracking-wider">Deductions</h4>
                  <div className="space-y-1">
                    {deductionGroups.map(group => {
                      const groupKey = `ded-${group.category}`;
                      const isExpanded = expandedCategories.has(groupKey);
                      return (
                        <div key={groupKey} className="border rounded-md">
                          <button
                            className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-muted/50 transition-colors"
                            onClick={() => toggleCategory(groupKey)}
                          >
                            <div className="flex items-center gap-2">
                              {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                              <span className="text-sm font-medium">{group.label}</span>
                              <Badge variant="outline" className="text-xs">{group.items.length} item{group.items.length !== 1 ? 's' : ''}</Badge>
                            </div>
                            <span className="text-sm font-semibold text-red-700">{group.total > 0 ? `-${formatCurrency(group.total)}` : ''}</span>
                          </button>
                          {isExpanded && (
                            <div className="border-t divide-y">
                              {group.items.map(a => renderAdjustmentRow(a, false))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <Separator />

          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold">Manual Adjustments</h4>
              <Button variant="outline" size="sm" onClick={() => setAddDialogOpen(true)} disabled={isLocked}>
                <Plus className="h-4 w-4 mr-1" />
                Add Adjustment
              </Button>
            </div>
            {manualAdjustments.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No manual adjustments added yet.</p>
            ) : (
              <div className="divide-y">
                {manualAdjustments.map(a => renderAdjustmentRow(a, true))}
              </div>
            )}
          </div>

          <Separator />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Total Add-backs</p>
              <p className="font-semibold text-green-700">{formatCurrency(totalAddBacks)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Total Deductions</p>
              <p className="font-semibold text-red-700">{formatCurrency(totalDeductions)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Net Adjustment Impact</p>
              <p className="font-semibold">{formatCurrency(netImpact)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Adjusted Avg EBITDA</p>
              <p className="font-semibold">{calculations ? formatCurrency(calculations.averageAdjustedEbitda) : '—'}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 shrink-0" />
            Accepted adjustments feed into the EBITDA used for valuation in Section 3.
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!modifyTarget} onOpenChange={(open) => { if (!open) setModifyTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modify Adjustment</DialogTitle>
          </DialogHeader>
          {modifyTarget && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm text-muted-foreground">Description</Label>
                <p className="text-sm">{modifyTarget.description}</p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Original Amount</Label>
                <p className="text-sm font-semibold">{formatCurrency(toNum(modifyTarget.amount))}</p>
              </div>

              {financialYears.length > 0 && (
                <div>
                  <Label className="text-sm mb-1.5 block">Apply to</Label>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant={!modifyPerYear ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setModifyPerYear(false)}
                    >
                      All years
                    </Button>
                    <Button
                      type="button"
                      variant={modifyPerYear ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setModifyPerYear(true)}
                    >
                      <Calendar className="h-3.5 w-3.5 mr-1" />
                      Specific years
                    </Button>
                  </div>
                </div>
              )}

              {modifyPerYear && financialYears.length > 0 ? (
                <div>
                  <Label className="text-sm mb-1.5 block">Amount per year (£)</Label>
                  <PerYearGrid
                    years={financialYears}
                    amounts={modifyYearAmounts}
                    onChange={(year, value) => setModifyYearAmounts(prev => ({ ...prev, [year]: value }))}
                  />
                </div>
              ) : (
                <div>
                  <Label htmlFor="modify-amount">Override Amount (£)</Label>
                  <Input
                    id="modify-amount"
                    type="number"
                    step="0.01"
                    value={modifyAmount}
                    onChange={(e) => setModifyAmount(e.target.value)}
                  />
                </div>
              )}

              <div>
                <Label htmlFor="modify-reason">Reason for Modification</Label>
                <Textarea
                  id="modify-reason"
                  value={modifyReason}
                  onChange={(e) => setModifyReason(e.target.value)}
                  placeholder="Optional: explain why you're changing this amount"
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setModifyTarget(null)}>Cancel</Button>
            <Button onClick={handleModifySave} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addDialogOpen} onOpenChange={(open) => { if (!open) { setAddDialogOpen(false); resetAddForm(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Manual Adjustment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Type</Label>
              <RadioGroup value={addType} onValueChange={(v) => setAddType(v as 'add_back' | 'deduction')} className="flex gap-4 mt-1">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="add_back" id="type-addback" />
                  <Label htmlFor="type-addback" className="font-normal">Add-back</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="deduction" id="type-deduction" />
                  <Label htmlFor="type-deduction" className="font-normal">Deduction</Label>
                </div>
              </RadioGroup>
            </div>
            <div>
              <Label>Category</Label>
              <Select value={addCategory} onValueChange={setAddCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="add-desc">Description</Label>
              <Input id="add-desc" value={addDescription} onChange={(e) => setAddDescription(e.target.value)} placeholder="What is this adjustment?" />
            </div>

            {financialYears.length > 0 && (
              <div>
                <Label className="text-sm mb-1.5 block">Apply to</Label>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant={!addPerYear ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAddPerYear(false)}
                  >
                    All years
                  </Button>
                  <Button
                    type="button"
                    variant={addPerYear ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAddPerYear(true)}
                  >
                    <Calendar className="h-3.5 w-3.5 mr-1" />
                    Specific years
                  </Button>
                </div>
              </div>
            )}

            {addPerYear && financialYears.length > 0 ? (
              <div>
                <Label className="text-sm mb-1.5 block">Amount per year (£)</Label>
                <PerYearGrid
                  years={financialYears}
                  amounts={addYearAmounts}
                  onChange={(year, value) => setAddYearAmounts(prev => ({ ...prev, [year]: value }))}
                />
              </div>
            ) : (
              <div>
                <Label htmlFor="add-amount">Amount (£)</Label>
                <Input id="add-amount" type="number" step="0.01" value={addAmount} onChange={(e) => setAddAmount(e.target.value)} placeholder="0" />
              </div>
            )}

            <div>
              <Label htmlFor="add-notes">Notes (optional)</Label>
              <Textarea id="add-notes" value={addNotes} onChange={(e) => setAddNotes(e.target.value)} rows={2} placeholder="Additional context" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddDialogOpen(false); resetAddForm(); }}>Cancel</Button>
            <Button
              onClick={handleAddSave}
              disabled={
                addMutation.isPending ||
                !addDescription.trim() ||
                (addPerYear ? addTotalPerYear === 0 : !addAmount.trim())
              }
            >
              {addMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Add Adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
