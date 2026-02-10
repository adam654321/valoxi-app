import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, ChevronRight, FileText, Paperclip, X, Search, Globe } from "lucide-react";
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
  linkedDocumentName: string | null;
  linkedDocumentFilename: string | null;
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

interface CompanyDocument {
  id: number;
  documentName: string;
  originalFilename: string;
  documentCategory: string;
  fileType: string;
  createdAt: string;
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

function DocumentLinkPicker({
  targetCompanyId,
  companyDocuments,
  linkedDocMap,
  onSelect,
}: {
  targetCompanyId: number;
  companyDocuments: CompanyDocument[];
  linkedDocMap: Map<number, string>;
  onSelect: (docId: number) => void;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return companyDocuments;
    const q = search.toLowerCase();
    return companyDocuments.filter(
      (d) =>
        d.documentName?.toLowerCase().includes(q) ||
        d.originalFilename?.toLowerCase().includes(q) ||
        d.documentCategory?.toLowerCase().includes(q)
    );
  }, [companyDocuments, search]);

  const grouped = useMemo(() => {
    const groups: Record<string, CompanyDocument[]> = {};
    for (const doc of filtered) {
      const cat = doc.documentCategory || "Uncategorised";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(doc);
    }
    return groups;
  }, [filtered]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground gap-1 px-1.5">
          <Paperclip className="h-3 w-3" />
          Link
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search documents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-xs pl-7"
            />
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {Object.keys(grouped).length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              {companyDocuments.length === 0
                ? "No documents uploaded yet"
                : "No documents match your search"}
            </div>
          ) : (
            Object.entries(grouped).map(([cat, docs]) => (
              <div key={cat}>
                <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-gray-50 dark:bg-gray-800/50 sticky top-0">
                  {cat}
                </div>
                {docs.map((doc) => {
                  const linkedTo = linkedDocMap.get(doc.id);
                  return (
                    <button
                      key={doc.id}
                      className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-start gap-2"
                      onClick={() => {
                        onSelect(doc.id);
                        setOpen(false);
                        setSearch("");
                      }}
                    >
                      <FileText className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-500" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">
                          {doc.originalFilename || doc.documentName}
                        </div>
                        {linkedTo && (
                          <div className="text-[10px] text-amber-600 dark:text-amber-400">
                            Linked to {linkedTo}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function RequirementRow({
  req,
  targetCompanyId,
  companyDocuments,
  linkedDocMap,
}: {
  req: DdRequirementWithStatus;
  targetCompanyId: number;
  companyDocuments: CompanyDocument[];
  linkedDocMap: Map<number, string>;
}) {
  const { toast } = useToast();
  const currentStatus = req.status?.status || "not_started";
  const linkedDocName = req.status?.linkedDocumentFilename || req.status?.linkedDocumentName;
  const linkedDocId = req.status?.documentId;
  const isPortalLinked = !!req.status?.externalSubmissionId;

  const statusMutation = useMutation({
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

  const linkMutation = useMutation({
    mutationFn: ({ documentId, status }: { documentId: number | null; status: string }) =>
      apiRequest("PUT", `/api/v2/due-diligence/company/${targetCompanyId}/requirement/${req.id}/status`, {
        status,
        documentId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v2/due-diligence/company", targetCompanyId, "status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/v2/due-diligence/company", targetCompanyId, "summary"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to link document", variant: "destructive" });
    },
  });

  const handleLink = (docId: number) => {
    const newStatus = currentStatus === "not_started" ? "in_progress" : currentStatus;
    linkMutation.mutate({ documentId: docId, status: newStatus });
  };

  const handleUnlink = () => {
    linkMutation.mutate({ documentId: null, status: currentStatus });
  };

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
        {linkedDocName ? (
          <div className="flex items-center gap-1.5 mt-1.5">
            <FileText className="h-3.5 w-3.5 text-green-600 dark:text-green-400 shrink-0" />
            <span className="text-xs text-green-700 dark:text-green-400 truncate">{linkedDocName}</span>
            {isPortalLinked && (
              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 font-normal border-indigo-300 text-indigo-600 dark:border-indigo-700 dark:text-indigo-400">
                <Globe className="h-2.5 w-2.5 mr-0.5" />
                Portal
              </Badge>
            )}
            <button
              onClick={handleUnlink}
              disabled={linkMutation.isPending}
              className="ml-1 text-gray-400 hover:text-red-500 transition-colors"
              title="Unlink document"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="mt-1.5">
            <DocumentLinkPicker
              targetCompanyId={targetCompanyId}
              companyDocuments={companyDocuments}
              linkedDocMap={linkedDocMap}
              onSelect={handleLink}
            />
          </div>
        )}
      </div>
      <Select
        value={currentStatus}
        onValueChange={(val) => statusMutation.mutate(val)}
        disabled={statusMutation.isPending}
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

function CategoryAccordion({
  item,
  targetCompanyId,
  companyDocuments,
  linkedDocMap,
}: {
  item: DdCategoryWithStatus;
  targetCompanyId: number;
  companyDocuments: CompanyDocument[];
  linkedDocMap: Map<number, string>;
}) {
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
            <RequirementRow
              key={req.id}
              req={req}
              targetCompanyId={targetCompanyId}
              companyDocuments={companyDocuments}
              linkedDocMap={linkedDocMap}
            />
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

  const documentsQuery = useQuery<{ documents: CompanyDocument[] }>({
    queryKey: ["/api/v2/files/company", targetCompanyId],
    queryFn: () => fetch(`/api/v2/files/company/${targetCompanyId}`, { credentials: "include" }).then(r => {
      if (!r.ok) return { documents: [] };
      return r.json().then(d => d.data || d);
    }),
  });

  const companyDocuments = documentsQuery.data?.documents || [];
  const categories = statusQuery.data || [];

  const linkedDocMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const cat of categories) {
      for (const req of cat.requirements) {
        if (req.status?.documentId) {
          map.set(req.status.documentId, req.refNumber);
        }
      }
    }
    return map;
  }, [categories]);

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
                <CategoryAccordion
                  key={item.category.id}
                  item={item}
                  targetCompanyId={targetCompanyId}
                  companyDocuments={companyDocuments}
                  linkedDocMap={linkedDocMap}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
