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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown, ChevronRight, FileText, Paperclip, X, Search, Globe, Eye, Lock, FileCheck, Upload, Loader2, CheckCircle, XCircle, AlertCircle } from "lucide-react";
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
    not_submitted: { label: "Not Submitted", className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
    submitted: { label: "Submitted", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
    approved: { label: "Approved", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
    rejected: { label: "Rejected", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
    na: { label: "N/A", className: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500" },
  };
  const c = config[status] || config.not_submitted;
  return <Badge className={`text-[10px] px-1.5 py-0 h-5 font-medium hover:opacity-90 ${c.className}`}>{c.label}</Badge>;
}

function DocumentLinkPicker({
  targetCompanyId,
  companyDocuments,
  linkedDocMap,
  onSelect,
  onUploadAndLink,
}: {
  targetCompanyId: number;
  companyDocuments: CompanyDocument[];
  linkedDocMap: Map<number, string>;
  onSelect: (docId: number) => void;
  onUploadAndLink: (file: File, docName: string) => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'upload' | 'link'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docName, setDocName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setUploadError('');
    try {
      await onUploadAndLink(selectedFile, docName || selectedFile.name);
      setOpen(false);
      setSelectedFile(null);
      setDocName('');
      setMode('upload');
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

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
    <Popover open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) {
        setSelectedFile(null);
        setDocName('');
        setUploadError('');
        setMode('upload');
        setSearch('');
      }
    }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground gap-1 px-1.5">
          <Upload className="h-3 w-3" />
          Upload
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-2 border-b">
          <div className="flex gap-1 p-1 bg-muted rounded-md">
            <button
              onClick={() => setMode('upload')}
              className={`flex-1 text-xs py-1.5 rounded transition-colors ${mode === 'upload' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Upload New
            </button>
            <button
              onClick={() => setMode('link')}
              className={`flex-1 text-xs py-1.5 rounded transition-colors ${mode === 'link' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Link Existing
            </button>
          </div>
        </div>

        {mode === 'upload' ? (
          <div className="p-3 space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Select File</label>
              <input
                type="file"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  setSelectedFile(f);
                  if (f) setDocName(f.name.replace(/\.[^.]+$/, ''));
                  setUploadError('');
                }}
                className="text-xs w-full file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-primary file:text-primary-foreground cursor-pointer"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Document Name</label>
              <Input
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                placeholder="Auto-filled from filename"
                className="h-7 text-xs"
              />
            </div>
            {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
            <Button
              size="sm"
              className="w-full h-7 text-xs"
              disabled={!selectedFile || uploading}
              onClick={handleUpload}
            >
              {uploading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Upload className="h-3 w-3 mr-1" />}
              Upload & Link
            </Button>
          </div>
        ) : (
          <>
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
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

function RequirementRow({
  req,
  targetCompanyId,
  companyDocuments,
  linkedDocMap,
  onUploadAndLink,
  onReject,
}: {
  req: DdRequirementWithStatus;
  targetCompanyId: number;
  companyDocuments: CompanyDocument[];
  linkedDocMap: Map<number, string>;
  onUploadAndLink: (file: File, docName: string) => Promise<void>;
  onReject: (requirementId: number) => void;
}) {
  const { toast } = useToast();
  const currentStatus = req.status?.status || "not_submitted";
  const linkedDocName = req.status?.linkedDocumentFilename || req.status?.linkedDocumentName;
  const linkedDocId = req.status?.documentId;
  const isPortalLinked = !!req.status?.externalSubmissionId;
  const isApproved = currentStatus === "approved";

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
    const newStatus = currentStatus === "not_submitted" ? "submitted" : currentStatus;
    linkMutation.mutate({ documentId: docId, status: newStatus });
  };

  const handleUnlink = () => {
    linkMutation.mutate({ documentId: null, status: currentStatus });
  };

  const handleApprove = async () => {
    await fetch(`/api/v2/due-diligence/company/${targetCompanyId}/requirement/${req.id}/status`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    });
    queryClient.invalidateQueries({ queryKey: ['/api/v2/due-diligence/company', targetCompanyId, 'status'] });
    queryClient.invalidateQueries({ queryKey: ['/api/v2/due-diligence/company', targetCompanyId, 'summary'] });
  };

  return (
    <div className="flex items-start gap-3 py-2.5 px-3 border-b last:border-b-0 hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
      <span className="text-xs text-muted-foreground font-mono w-8 shrink-0 pt-0.5">{req.refNumber}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{req.documentName}</span>
          <PriorityBadge priority={req.priority} />
          <StatusBadge status={currentStatus} />
          {currentStatus === 'submitted' && (
            <div className="flex items-center gap-1 ml-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-green-600 hover:text-green-700 hover:bg-green-50 gap-1 px-2"
                onClick={handleApprove}
              >
                <CheckCircle className="h-3 w-3" />
                Approve
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 gap-1 px-2"
                onClick={() => onReject(req.id)}
              >
                <XCircle className="h-3 w-3" />
                Reject
              </Button>
            </div>
          )}
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
            {!isApproved && (
              <button
                onClick={handleUnlink}
                disabled={linkMutation.isPending}
                className="ml-1 text-gray-400 hover:text-red-500 transition-colors"
                title="Unlink document"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ) : !isApproved ? (
          <div className="mt-1.5">
            <DocumentLinkPicker
              targetCompanyId={targetCompanyId}
              companyDocuments={companyDocuments}
              linkedDocMap={linkedDocMap}
              onSelect={handleLink}
              onUploadAndLink={onUploadAndLink}
            />
          </div>
        ) : null}
        {currentStatus === 'rejected' && req.status?.notes && (
          <div className="mt-1 flex items-start gap-1.5">
            <AlertCircle className="h-3 w-3 text-red-500 mt-0.5 flex-shrink-0" />
            <span className="text-xs text-red-600">Rejected: {req.status.notes}</span>
          </div>
        )}
      </div>
      {!isApproved && (
        <Select
          value={currentStatus}
          onValueChange={(val) => statusMutation.mutate(val)}
          disabled={statusMutation.isPending}
        >
          <SelectTrigger className="w-[130px] h-7 text-xs shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="not_submitted">Not Submitted</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="na">N/A</SelectItem>
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

function CategoryAccordion({
  item,
  targetCompanyId,
  companyDocuments,
  linkedDocMap,
  onUploadAndLink,
  onReject,
}: {
  item: DdCategoryWithStatus;
  targetCompanyId: number;
  companyDocuments: CompanyDocument[];
  linkedDocMap: Map<number, string>;
  onUploadAndLink: (requirementId: number, file: File, docName: string) => Promise<void>;
  onReject: (requirementId: number) => void;
}) {
  const [open, setOpen] = useState(false);

  const activeReqs = item.requirements.filter(r => (r.status?.status || "not_submitted") !== "na");
  const activeTotal = activeReqs.length;
  const submittedCount = activeReqs.filter(r => {
    const s = r.status?.status || "not_submitted";
    return s === "submitted" || s === "approved";
  }).length;
  const toReviewCount = activeReqs.filter(r => (r.status?.status || "not_submitted") === "submitted").length;
  const mandatoryOutstanding = activeReqs.filter(r => {
    const s = r.status?.status || "not_submitted";
    return r.priority === "Mandatory" && (s === "not_submitted" || s === "rejected");
  }).length;
  const pct = activeTotal > 0 ? Math.round((submittedCount / activeTotal) * 100) : 0;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg transition-colors">
          {open ? <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />}
          <div className="flex-1 text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{item.category.categoryName}</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                {submittedCount} of {activeTotal}
              </Badge>
              {toReviewCount > 0 && (
                <Badge className="text-[10px] px-1.5 py-0 h-5 font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 hover:bg-amber-100">
                  <Eye className="h-3 w-3 mr-0.5" />
                  {toReviewCount} to review
                </Badge>
              )}
              {mandatoryOutstanding > 0 && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 text-red-600 dark:text-red-400 border-red-300 dark:border-red-700">
                  {mandatoryOutstanding} mandatory outstanding
                </Badge>
              )}
            </div>
            <ProgressBar value={submittedCount} max={activeTotal} className="mt-1.5" />
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
              onUploadAndLink={async (file, name) => {
                await onUploadAndLink(req.id, file, name);
              }}
              onReject={onReject}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function DueDiligenceTab({ targetCompanyId }: DueDiligenceTabProps) {
  const { data: dealDocs, isLoading: dealDocsLoading } = useQuery<any[]>({
    queryKey: ["/api/v2/deal-documents/company", targetCompanyId],
    queryFn: () => fetch(`/api/v2/deal-documents/company/${targetCompanyId}`, { credentials: "include" }).then(r => {
      if (!r.ok) return [];
      return r.json();
    }),
  });

  const hotAccepted = Array.isArray(dealDocs) && dealDocs.some(
    (d: any) => d.documentType === "heads_of_terms" && d.status === "accepted"
  );

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

  const handleUploadAndLink = async (requirementId: number, file: File, docName: string) => {
    const formData = new FormData();
    formData.append('document', file);
    formData.append('document_name', docName);
    formData.append('document_category', 'Due Diligence');
    formData.append('description', '');
    formData.append('is_confidential', 'true');

    const uploadRes = await fetch(`/api/v2/files/company/${targetCompanyId}/upload`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(errText || 'Upload failed');
    }

    const result = await uploadRes.json();
    const docId = result?.data?.document?.id || result?.data?.id || result?.id;
    if (!docId) throw new Error('No document ID returned');

    const linkRes = await fetch(`/api/v2/due-diligence/company/${targetCompanyId}/requirement/${requirementId}/status`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'submitted',
        documentId: docId,
      }),
    });

    if (!linkRes.ok) throw new Error('Failed to link document');

    queryClient.invalidateQueries({ queryKey: ["/api/v2/due-diligence/company", targetCompanyId, "status"] });
    queryClient.invalidateQueries({ queryKey: ["/api/v2/due-diligence/company", targetCompanyId, "summary"] });
    queryClient.invalidateQueries({ queryKey: ["/api/v2/files/company", targetCompanyId] });
  };

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

  const [rejectingRequirementId, setRejectingRequirementId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const clientStats = useMemo(() => {
    const allReqs = categories.flatMap(c => c.requirements);
    const active = allReqs.filter(r => (r.status?.status || "not_submitted") !== "na");
    const total = active.length;
    const submitted = active.filter(r => {
      const s = r.status?.status || "not_submitted";
      return s === "submitted" || s === "approved";
    }).length;
    const toReview = active.filter(r => (r.status?.status || "not_submitted") === "submitted").length;
    const verified = active.filter(r => (r.status?.status || "not_submitted") === "approved").length;

    const mandatoryReqs = active.filter(r => r.priority === "Mandatory");
    const mandatorySubmitted = mandatoryReqs.filter(r => {
      const s = r.status?.status || "not_submitted";
      return s === "submitted" || s === "approved";
    }).length;
    const mandatoryOutstanding = mandatoryReqs.filter(r => {
      const s = r.status?.status || "not_submitted";
      return s === "not_submitted" || s === "rejected";
    }).length;

    const advisoryReqs = active.filter(r => r.priority === "Advisory");
    const advisorySubmitted = advisoryReqs.filter(r => {
      const s = r.status?.status || "not_submitted";
      return s === "submitted" || s === "approved";
    }).length;

    const addsValueReqs = active.filter(r => r.priority === "Adds Value");
    const addsValueSubmitted = addsValueReqs.filter(r => {
      const s = r.status?.status || "not_submitted";
      return s === "submitted" || s === "approved";
    }).length;

    return {
      total,
      submitted,
      toReview,
      verified,
      mandatorySubmitted,
      mandatoryTotal: mandatoryReqs.length,
      mandatoryOutstanding,
      advisorySubmitted,
      advisoryTotal: advisoryReqs.length,
      addsValueSubmitted,
      addsValueTotal: addsValueReqs.length,
    };
  }, [categories]);

  if (dealDocsLoading || statusQuery.isLoading || summaryQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (!hotAccepted) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-full p-6 mb-6">
          <Lock className="h-12 w-12 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Due Diligence Locked</h3>
        <p className="text-gray-500 text-center max-w-md mb-4">
          The Due Diligence stage will unlock once the Heads of Terms document has been accepted by the seller.
        </p>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <FileCheck className="h-4 w-4" />
          <span>Awaiting Heads of Terms acceptance</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Due Diligence Progress</CardTitle>
            {clientStats.toReview > 0 && (
              <Badge className="text-xs px-2 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 hover:bg-amber-100">
                <Eye className="h-3.5 w-3.5 mr-1" />
                {clientStats.toReview} awaiting review
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium">Documents Submitted</span>
              <span className="text-sm text-muted-foreground">
                {clientStats.submitted} of {clientStats.total}
                {clientStats.verified > 0 && (
                  <span className="text-green-600 dark:text-green-400 ml-1">({clientStats.verified} approved)</span>
                )}
              </span>
            </div>
            <ProgressBar value={clientStats.submitted} max={clientStats.total} />
          </div>
          {clientStats.mandatoryOutstanding > 0 && (
            <div className="text-xs text-red-600 dark:text-red-400 font-medium">
              {clientStats.mandatoryOutstanding} mandatory requirement{clientStats.mandatoryOutstanding !== 1 ? 's' : ''} still outstanding
            </div>
          )}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-100 dark:border-red-900/30">
              <div className="text-lg font-bold text-red-700 dark:text-red-400">
                {clientStats.mandatorySubmitted}/{clientStats.mandatoryTotal}
              </div>
              <div className="text-xs text-red-600 dark:text-red-500">Mandatory</div>
            </div>
            <div className="text-center p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-100 dark:border-amber-900/30">
              <div className="text-lg font-bold text-amber-700 dark:text-amber-400">
                {clientStats.advisorySubmitted}/{clientStats.advisoryTotal}
              </div>
              <div className="text-xs text-amber-600 dark:text-amber-500">Advisory</div>
            </div>
            <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-100 dark:border-blue-900/30">
              <div className="text-lg font-bold text-blue-700 dark:text-blue-400">
                {clientStats.addsValueSubmitted}/{clientStats.addsValueTotal}
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
                  onUploadAndLink={handleUploadAndLink}
                  onReject={(reqId) => setRejectingRequirementId(reqId)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={rejectingRequirementId !== null} onOpenChange={(open) => {
        if (!open) { setRejectingRequirementId(null); setRejectionReason(''); }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Document</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejection. This will be shared with the seller so they can upload a corrected document.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Reason for rejection..."
              className="min-h-[80px]"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => { setRejectingRequirementId(null); setRejectionReason(''); }}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={!rejectionReason.trim() || rejecting}
                onClick={async () => {
                  setRejecting(true);
                  try {
                    await fetch(`/api/v2/due-diligence/company/${targetCompanyId}/requirement/${rejectingRequirementId}/status`, {
                      method: 'PUT',
                      credentials: 'include',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ status: 'rejected', notes: rejectionReason.trim() }),
                    });
                    queryClient.invalidateQueries({ queryKey: ['/api/v2/due-diligence/company', targetCompanyId, 'status'] });
                    queryClient.invalidateQueries({ queryKey: ['/api/v2/due-diligence/company', targetCompanyId, 'summary'] });
                    setRejectingRequirementId(null);
                    setRejectionReason('');
                  } catch (err) {
                    console.error('Reject failed:', err);
                  } finally {
                    setRejecting(false);
                  }
                }}
              >
                {rejecting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                Reject
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
