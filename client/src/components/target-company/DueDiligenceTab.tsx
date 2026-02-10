import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, FileText } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface DueDiligenceTabProps {
  targetCompanyId: number;
}

interface DdCategory {
  id: number;
  refPrefix: string;
  categoryName: string;
  description: string | null;
  sortOrder: number;
}

interface DdRequirementStatus {
  id: number;
  requirementId: number;
  targetCompanyId: number;
  status: string;
  notes: string | null;
  documentId: number | null;
  externalSubmissionId: number | null;
  reviewedBy: number | null;
  reviewedAt: string | null;
  updatedBy: number | null;
}

interface DdRequirementWithStatus {
  id: number;
  categoryId: number;
  refNumber: string;
  documentName: string;
  priority: string;
  guidance: string | null;
  collectionStage: number | null;
  sortOrder: number;
  status: DdRequirementStatus | null;
}

interface DdCategoryWithStatus {
  category: DdCategory;
  requirements: DdRequirementWithStatus[];
  completedCount: number;
  totalCount: number;
  mandatoryCompletedCount: number;
  mandatoryTotalCount: number;
}

interface DdCompletionSummary {
  total: number;
  completed: number;
  mandatory: { total: number; completed: number };
  advisory: { total: number; completed: number };
  addsValue: { total: number; completed: number };
}

function ProgressBar({ value, max, className = "" }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className={`h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden ${className}`}>
      <div
        className="h-full bg-blue-600 dark:bg-blue-500 rounded-full transition-all duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  if (priority === "Mandatory") {
    return <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5 font-medium">Mandatory</Badge>;
  }
  if (priority === "Advisory") {
    return <Badge className="text-[10px] px-1.5 py-0 h-5 font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 hover:bg-amber-100">Advisory</Badge>;
  }
  return <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-medium text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700">Adds Value</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    not_started: { label: "Not Started", className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
    in_progress: { label: "In Progress", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
    ready: { label: "Ready", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
    na: { label: "N/A", className: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500" },
  };
  const c = config[status] || config.not_started;
  return <Badge className={`text-[10px] px-1.5 py-0 h-5 font-medium hover:opacity-90 ${c.className}`}>{c.label}</Badge>;
}

function RequirementRow({ req, targetCompanyId }: { req: DdRequirementWithStatus; targetCompanyId: number }) {
  const { toast } = useToast();
  const currentStatus = req.status?.status || "not_started";

  const mutation = useMutation({
    mutationFn: (newStatus: string) =>
      apiRequest("PUT", `/api/v2/due-diligence/company/${targetCompanyId}/requirement/${req.id}/status`, { status: newStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v2/due-diligence/company", targetCompanyId, "status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/v2/due-diligence/company", targetCompanyId, "summary"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update status", variant: "destructive" });
    },
  });

  return (
    <div className="flex items-start gap-3 py-2.5 px-3 border-b last:border-b-0 hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
      <span className="text-xs text-muted-foreground font-mono w-8 shrink-0 pt-0.5">{req.refNumber}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{req.documentName}</span>
          <PriorityBadge priority={req.priority} />
          <StatusBadge status={currentStatus} />
        </div>
        {req.guidance && (
          <p className="text-xs text-muted-foreground italic mt-1 leading-relaxed">{req.guidance}</p>
        )}
      </div>
      <Select
        value={currentStatus}
        onValueChange={(val) => mutation.mutate(val)}
        disabled={mutation.isPending}
      >
        <SelectTrigger className="w-[120px] h-7 text-xs shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="not_started">Not Started</SelectItem>
          <SelectItem value="in_progress">In Progress</SelectItem>
          <SelectItem value="ready">Ready</SelectItem>
          <SelectItem value="na">N/A</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function CategoryAccordion({ item, targetCompanyId }: { item: DdCategoryWithStatus; targetCompanyId: number }) {
  const [open, setOpen] = useState(false);
  const pct = item.totalCount > 0 ? Math.round((item.completedCount / item.totalCount) * 100) : 0;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg transition-colors">
          {open ? <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />}
          <div className="flex-1 text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{item.category.categoryName}</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                {item.completedCount} of {item.totalCount}
              </Badge>
              {item.mandatoryTotalCount > 0 && item.mandatoryCompletedCount < item.mandatoryTotalCount && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 text-red-600 dark:text-red-400 border-red-300 dark:border-red-700">
                  {item.mandatoryTotalCount - item.mandatoryCompletedCount} mandatory outstanding
                </Badge>
              )}
            </div>
            <ProgressBar value={item.completedCount} max={item.totalCount} className="mt-1.5" />
          </div>
          <span className="text-xs text-muted-foreground shrink-0">{pct}%</span>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-7 border-l border-gray-200 dark:border-gray-700 mt-1 mb-2">
          {item.requirements.map((req) => (
            <RequirementRow key={req.id} req={req} targetCompanyId={targetCompanyId} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function DueDiligenceTab({ targetCompanyId }: DueDiligenceTabProps) {
  const statusQuery = useQuery<DdCategoryWithStatus[]>({
    queryKey: ["/api/v2/due-diligence/company", targetCompanyId, "status"],
    queryFn: () => fetch(`/api/v2/due-diligence/company/${targetCompanyId}/status`, { credentials: "include" }).then(r => {
      if (!r.ok) throw new Error("Failed to load DD status");
      return r.json();
    }),
  });

  const summaryQuery = useQuery<DdCompletionSummary>({
    queryKey: ["/api/v2/due-diligence/company", targetCompanyId, "summary"],
    queryFn: () => fetch(`/api/v2/due-diligence/company/${targetCompanyId}/summary`, { credentials: "include" }).then(r => {
      if (!r.ok) throw new Error("Failed to load DD summary");
      return r.json();
    }),
  });

  if (statusQuery.isLoading || summaryQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  const summary = summaryQuery.data;
  const categories = statusQuery.data || [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Due Diligence Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium">Overall Completion</span>
              <span className="text-sm text-muted-foreground">{summary?.completed || 0} of {summary?.total || 121}</span>
            </div>
            <ProgressBar value={summary?.completed || 0} max={summary?.total || 121} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-100 dark:border-red-900/30">
              <div className="text-lg font-bold text-red-700 dark:text-red-400">
                {summary?.mandatory.completed || 0}/{summary?.mandatory.total || 0}
              </div>
              <div className="text-xs text-red-600 dark:text-red-500">Mandatory</div>
            </div>
            <div className="text-center p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-100 dark:border-amber-900/30">
              <div className="text-lg font-bold text-amber-700 dark:text-amber-400">
                {summary?.advisory.completed || 0}/{summary?.advisory.total || 0}
              </div>
              <div className="text-xs text-amber-600 dark:text-amber-500">Advisory</div>
            </div>
            <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-100 dark:border-blue-900/30">
              <div className="text-lg font-bold text-blue-700 dark:text-blue-400">
                {summary?.addsValue.completed || 0}/{summary?.addsValue.total || 0}
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-500">Adds Value</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-2">
          {categories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No DD categories found</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {categories.map((item) => (
                <CategoryAccordion key={item.category.id} item={item} targetCompanyId={targetCompanyId} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
