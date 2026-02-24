import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { FileText, Paperclip, X, Search, Globe, Eye, Lock, FileCheck, Upload, Loader2, CheckCircle, XCircle, AlertCircle, Clock } from "lucide-react";
import { apiRequest, queryClient, getCsrfToken } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { DocumentViewer } from '@/components/document-viewer';

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
  sellerMarkedComplete: boolean;
  sellerMarkedCompleteAt: string | null;
  buyerReviewStatus: string;
  buyerReviewNotes: string | null;
  buyerReviewedAt: string | null;
  buyerReviewedBy: number | null;
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

interface LinkedDoc {
  id: number;
  source: string;
  documentId: number | null;
  externalSubmissionId: number | null;
  filename: string;
  fileType: string | null;
  fileSize: number | null;
  addedAt: string;
  notes: string | null;
}

function PriorityBadge({ priority }: { priority: string }) {
  if (priority === "Mandatory") {
    return <Badge variant="destructive" className="text-sm">Mandatory</Badge>;
  }
  if (priority === "Advisory") {
    return <Badge className="text-sm bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 hover:bg-amber-100">Advisory</Badge>;
  }
  return <Badge variant="outline" className="text-sm text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700">Adds Value</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    not_submitted: { label: "Not Submitted", className: "bg-gray-50 text-gray-400 dark:bg-gray-900 dark:text-gray-500", icon: <AlertCircle className="h-4 w-4 text-gray-300" /> },
    submitted: { label: "Submitted", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300", icon: <Clock className="h-4 w-4 text-amber-500" /> },
    approved: { label: "Approved", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300", icon: <CheckCircle className="h-4 w-4 text-green-500" /> },
    rejected: { label: "Rejected", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", icon: <XCircle className="h-4 w-4 text-red-500" /> },
    na: { label: "N/A", className: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400", icon: <AlertCircle className="h-4 w-4 text-gray-400" /> },
    satisfied: { label: "Verified", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300", icon: <CheckCircle className="h-4 w-4 text-green-500" /> },
    more_needed: { label: "More Needed", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300", icon: <AlertCircle className="h-4 w-4 text-amber-500" /> },
    pending_review: { label: "Pending Review", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", icon: <Clock className="h-4 w-4 text-blue-500" /> },
  };
  const c = config[status] || config.not_submitted;
  return (
    <Badge className={`text-sm px-3 py-1 flex items-center gap-1.5 shrink-0 hover:opacity-90 ${c.className}`}>
      {c.icon}
      {c.label}
    </Badge>
  );
}

function getComputedDisplayStatus(req: DdRequirementWithStatus): string {
  const buyerReview = req.status?.buyerReviewStatus || 'not_reviewed';
  if (buyerReview === 'satisfied') return 'satisfied';
  if (buyerReview === 'more_needed') return 'more_needed';
  if (req.status?.sellerMarkedComplete && buyerReview === 'not_reviewed') return 'pending_review';
  return req.status?.status || 'not_submitted';
}

function getRequirementTint(req: DdRequirementWithStatus): string {
  const displayStatus = getComputedDisplayStatus(req);
  switch (displayStatus) {
    case 'satisfied':
    case 'approved':
      return 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-900';
    case 'more_needed':
      return 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-900';
    case 'pending_review':
      return 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-900';
    case 'submitted':
      return 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800';
    case 'na':
      return 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800';
    case 'rejected':
      return 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-900';
    default:
      return 'bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800';
  }
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

  const docs = Array.isArray(companyDocuments) ? companyDocuments : [];

  const filtered = useMemo(() => {
    if (!search.trim()) return docs;
    const q = search.toLowerCase();
    return docs.filter(
      (d) =>
        d.documentName?.toLowerCase().includes(q) ||
        d.originalFilename?.toLowerCase().includes(q) ||
        d.documentCategory?.toLowerCase().includes(q)
    );
  }, [docs, search]);

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
        <Button variant="outline" size="sm" className="h-8 text-sm gap-1.5">
          <Upload className="h-4 w-4" />
          Upload / Link
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
  linkedDocuments,
  onUploadAndLink,
  onBuyerReview,
  onOpenMoreNeeded,
  onViewDocument,
}: {
  req: DdRequirementWithStatus;
  targetCompanyId: number;
  companyDocuments: CompanyDocument[];
  linkedDocMap: Map<number, string>;
  linkedDocuments: LinkedDoc[];
  onUploadAndLink: (file: File, docName: string) => Promise<void>;
  onBuyerReview: (requirementId: number, reviewStatus: string, notes?: string) => Promise<void>;
  onOpenMoreNeeded: (requirementId: number) => void;
  onViewDocument: (doc: LinkedDoc) => void;
}) {
  const { toast } = useToast();
  const currentStatus = req.status?.status || "not_submitted";
  const displayStatus = getComputedDisplayStatus(req);
  const isVerified = displayStatus === 'satisfied';
  const tintClass = getRequirementTint(req);
  const buyerDocs = linkedDocuments.filter(d => d.source === 'buyer_linked');
  const sellerDocs = linkedDocuments.filter(d => d.source === 'seller_uploaded');
  const hasLinkedDocs = linkedDocuments.length > 0;

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

  const handleLinkDoc = async (docId: number) => {
    try {
      await apiRequest('POST', `/api/v2/due-diligence/company/${targetCompanyId}/requirement/${req.id}/documents`, { documentId: docId });
      queryClient.invalidateQueries({ queryKey: ['/api/v2/due-diligence/company', targetCompanyId, 'category-docs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v2/due-diligence/company', targetCompanyId, 'status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v2/due-diligence/company', targetCompanyId, 'summary'] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to link document", variant: "destructive" });
    }
  };

  const handleUnlinkDoc = async (docLinkId: number) => {
    try {
      await apiRequest('DELETE', `/api/v2/due-diligence/company/${targetCompanyId}/requirement/${req.id}/documents/${docLinkId}`);
      queryClient.invalidateQueries({ queryKey: ['/api/v2/due-diligence/company', targetCompanyId, 'category-docs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v2/due-diligence/company', targetCompanyId, 'status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v2/due-diligence/company', targetCompanyId, 'summary'] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to unlink document", variant: "destructive" });
    }
  };

  return (
    <div className={`rounded-lg border p-4 mb-3 ${tintClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground font-mono">{req.refNumber}</span>
            <span className="text-sm font-medium">{req.documentName}</span>
            <PriorityBadge priority={req.priority} />
          </div>
          {req.guidance && (
            <p className="text-sm text-muted-foreground italic mt-1 leading-relaxed">{req.guidance}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!isVerified && !hasLinkedDocs && (
            <Select
              value={currentStatus}
              onValueChange={(val) => statusMutation.mutate(val)}
              disabled={statusMutation.isPending}
            >
              <SelectTrigger className="w-[130px] h-8 text-sm shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="not_submitted">Not Submitted</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="na">N/A</SelectItem>
              </SelectContent>
            </Select>
          )}
          <StatusBadge status={displayStatus} />
        </div>
      </div>

      {req.status?.sellerMarkedComplete && req.status?.buyerReviewStatus !== 'satisfied' && (
        <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Seller marked complete — review required</span>
        </div>
      )}

      {req.status?.buyerReviewStatus === 'more_needed' && req.status?.buyerReviewNotes && (
        <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <span className="text-sm text-amber-700 dark:text-amber-300">More needed: {req.status.buyerReviewNotes}</span>
          </div>
        </div>
      )}

      {hasLinkedDocs && (
        <div className="mt-3 space-y-2">
          {buyerDocs.map(doc => (
            <div key={doc.id} className="flex items-center gap-2 ml-1 py-2">
              <FileText className="h-4 w-4 text-blue-500 flex-shrink-0" />
              <button
                onClick={() => onViewDocument(doc)}
                className="text-sm truncate hover:text-blue-600 hover:underline cursor-pointer"
              >
                {doc.filename}
              </button>
              <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 border-blue-300 text-blue-600">Held</Badge>
              <button
                onClick={() => onViewDocument(doc)}
                className="text-gray-400 hover:text-blue-600"
                title="View document"
              >
                <Eye className="h-4 w-4" />
              </button>
              {!isVerified && (
                <button onClick={() => handleUnlinkDoc(doc.id)} className="text-gray-400 hover:text-red-500">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          {sellerDocs.map(doc => (
            <div key={doc.id} className="flex items-center gap-2 ml-1 py-2">
              <FileText className="h-4 w-4 text-green-500 flex-shrink-0" />
              <button
                onClick={() => onViewDocument(doc)}
                className="text-sm truncate hover:text-blue-600 hover:underline cursor-pointer"
              >
                {doc.filename}
              </button>
              <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 border-indigo-300 text-indigo-600">
                <Globe className="h-3 w-3 mr-0.5" /> Portal
              </Badge>
              <button
                onClick={() => onViewDocument(doc)}
                className="text-gray-400 hover:text-blue-600"
                title="View document"
              >
                <Eye className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {!isVerified && (
        <div className="mt-3">
          <DocumentLinkPicker
            targetCompanyId={targetCompanyId}
            companyDocuments={companyDocuments}
            linkedDocMap={linkedDocMap}
            onSelect={handleLinkDoc}
            onUploadAndLink={onUploadAndLink}
          />
        </div>
      )}

      {currentStatus === 'rejected' && req.status?.notes && (
        <div className="mt-3 flex items-start gap-1.5">
          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
          <span className="text-sm text-red-600">Rejected: {req.status.notes}</span>
        </div>
      )}

      {hasLinkedDocs && !isVerified && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-sm text-green-600 hover:text-green-700 hover:bg-green-50 gap-1.5"
            onClick={() => onBuyerReview(req.id, 'satisfied')}
          >
            <CheckCircle className="h-4 w-4" />
            Mark Verified
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-sm text-amber-600 hover:text-amber-700 hover:bg-amber-50 gap-1.5"
            onClick={() => onOpenMoreNeeded(req.id)}
          >
            <AlertCircle className="h-4 w-4" />
            Request More
          </Button>
        </div>
      )}

      {isVerified && (
        <div className="mt-3 p-2 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <span className="text-sm text-green-700 dark:text-green-300 font-medium">Verified</span>
        </div>
      )}
    </div>
  );
}

function CategoryCard({
  item,
  targetCompanyId,
  companyDocuments,
  linkedDocMap,
  onUploadAndLink,
  onBuyerReview,
  onOpenMoreNeeded,
  onViewDocument,
}: {
  item: DdCategoryWithStatus;
  targetCompanyId: number;
  companyDocuments: CompanyDocument[];
  linkedDocMap: Map<number, string>;
  onUploadAndLink: (requirementId: number, file: File, docName: string) => Promise<void>;
  onBuyerReview: (requirementId: number, reviewStatus: string, notes?: string) => Promise<void>;
  onOpenMoreNeeded: (requirementId: number) => void;
  onViewDocument: (doc: LinkedDoc) => void;
}) {
  const { data: categoryDocs } = useQuery<Record<number, LinkedDoc[]>>({
    queryKey: ['/api/v2/due-diligence/company', targetCompanyId, 'category-docs', item.category.id],
    queryFn: async () => {
      const docsByReq: Record<number, LinkedDoc[]> = {};
      await Promise.all(
        item.requirements.map(async (req) => {
          try {
            const res = await fetch(`/api/v2/due-diligence/company/${targetCompanyId}/requirement/${req.id}/documents`, { credentials: 'include' });
            if (res.ok) {
              docsByReq[req.id] = await res.json();
            }
          } catch { }
        })
      );
      return docsByReq;
    },
  });

  const activeReqs = item.requirements.filter(r => (r.status?.status || "not_submitted") !== "na");
  const activeTotal = activeReqs.length;

  const verifiedCount = activeReqs.filter(r => {
    const br = r.status?.buyerReviewStatus || 'not_reviewed';
    return br === 'satisfied' || (r.status?.status || "not_submitted") === "approved";
  }).length;

  const toReviewCount = activeReqs.filter(r => {
    return r.status?.sellerMarkedComplete && (r.status?.buyerReviewStatus || 'not_reviewed') === 'not_reviewed';
  }).length;

  const catProgress = activeTotal > 0 ? Math.round((verifiedCount / activeTotal) * 100) : 0;

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-semibold">{item.category.categoryName}</CardTitle>
            {toReviewCount > 0 && (
              <Badge className="text-sm px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 hover:bg-blue-100">
                <Eye className="h-3.5 w-3.5 mr-1" />
                {toReviewCount} to review
              </Badge>
            )}
          </div>
          <Badge
            variant={verifiedCount === activeTotal ? 'default' : 'outline'}
            className="text-sm"
          >
            {verifiedCount} / {activeTotal}
          </Badge>
        </div>
        <Progress value={catProgress} className="h-1.5 mt-2" />
      </CardHeader>
      <CardContent className="space-y-3">
        {item.requirements.map((req) => (
          <RequirementRow
            key={req.id}
            req={req}
            targetCompanyId={targetCompanyId}
            companyDocuments={companyDocuments}
            linkedDocMap={linkedDocMap}
            linkedDocuments={categoryDocs?.[req.id] || []}
            onUploadAndLink={async (file, name) => {
              await onUploadAndLink(req.id, file, name);
            }}
            onBuyerReview={onBuyerReview}
            onOpenMoreNeeded={onOpenMoreNeeded}
            onViewDocument={onViewDocument}
          />
        ))}
      </CardContent>
    </Card>
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

  const documentsQuery = useQuery<CompanyDocument[]>({
    queryKey: ["/api/v2/files/company", targetCompanyId, "docs-list"],
    queryFn: async () => {
      const res = await fetch(`/api/v2/files/company/${targetCompanyId}`, { credentials: "include" });
      if (!res.ok) return [];
      const json = await res.json();
      const data = json?.data || json;
      const arr = data?.documents || data;
      return Array.isArray(arr) ? arr : [];
    },
  });

  const companyDocuments = Array.isArray(documentsQuery.data) ? documentsQuery.data : [];
  const categories = statusQuery.data || [];

  const [ddFilter, setDdFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<string>('');

  const handleUploadAndLink = async (requirementId: number, file: File, docName: string) => {
    const formData = new FormData();
    formData.append('document', file);
    formData.append('document_name', docName);
    formData.append('document_category', 'Due Diligence');
    formData.append('description', '');
    formData.append('is_confidential', 'true');

    const csrfToken = getCsrfToken();
    const uploadRes = await fetch(`/api/v2/files/company/${targetCompanyId}/upload`, {
      method: 'POST',
      credentials: 'include',
      headers: csrfToken ? { 'x-csrf-token': csrfToken } : {},
      body: formData,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(errText || 'Upload failed');
    }

    const result = await uploadRes.json();
    const docId = result?.data?.document?.id || result?.data?.id || result?.id;
    if (!docId) throw new Error('No document ID returned');

    await apiRequest('POST', `/api/v2/due-diligence/company/${targetCompanyId}/requirement/${requirementId}/documents`, { documentId: docId });

    queryClient.invalidateQueries({ queryKey: ["/api/v2/due-diligence/company", targetCompanyId, "status"] });
    queryClient.invalidateQueries({ queryKey: ["/api/v2/due-diligence/company", targetCompanyId, "summary"] });
    queryClient.invalidateQueries({ queryKey: ["/api/v2/files/company", targetCompanyId, "docs-list"] });
    queryClient.invalidateQueries({ queryKey: ['/api/v2/due-diligence/company', targetCompanyId, 'category-docs'] });
  };

  const handleBuyerReview = async (requirementId: number, reviewStatus: string, notes?: string) => {
    try {
      await apiRequest('POST', `/api/v2/due-diligence/company/${targetCompanyId}/requirement/${requirementId}/buyer-review`, { reviewStatus, notes });
      queryClient.invalidateQueries({ queryKey: ['/api/v2/due-diligence/company', targetCompanyId, 'status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v2/due-diligence/company', targetCompanyId, 'summary'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v2/due-diligence/company', targetCompanyId, 'category-docs'] });
    } catch (err) {
      console.error('Review failed:', err);
    }
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

  const [moreNeededRequirementId, setMoreNeededRequirementId] = useState<number | null>(null);
  const [moreNeededNotes, setMoreNeededNotes] = useState('');
  const [submittingMoreNeeded, setSubmittingMoreNeeded] = useState(false);

  const [viewingDocument, setViewingDocument] = useState<any | null>(null);
  const [showViewer, setShowViewer] = useState(false);

  const handleViewDocument = (doc: LinkedDoc) => {
    const docId = doc.documentId || doc.externalSubmissionId;
    if (!docId) return;
    setViewingDocument({
      id: docId,
      documentName: doc.filename,
      originalFilename: doc.filename,
      fileType: doc.fileType || 'application/octet-stream',
      fileSize: doc.fileSize || 0,
      documentCategory: 'Due Diligence',
      uploadDate: doc.addedAt,
      createdAt: doc.addedAt,
      description: doc.notes || '',
      isConfidential: false,
      targetCompanyId: targetCompanyId,
      uploadedBy: 0,
      filePath: '',
      lastAccessed: null,
      accessCount: 0,
      uploadedByName: doc.source === 'buyer_linked' ? 'Internal' : 'Portal',
    });
    setShowViewer(true);
  };

  const clientStats = useMemo(() => {
    const allReqs = categories.flatMap(c => c.requirements);
    const active = allReqs.filter(r => (r.status?.status || "not_submitted") !== "na");
    const total = active.length;

    const verified = active.filter(r => {
      const br = (r.status as any)?.buyerReviewStatus || 'not_reviewed';
      return br === 'satisfied' || (r.status?.status || "not_submitted") === "approved";
    }).length;

    const toReview = active.filter(r => {
      return (r.status as any)?.sellerMarkedComplete && ((r.status as any)?.buyerReviewStatus || 'not_reviewed') === 'not_reviewed';
    }).length;

    const moreNeeded = active.filter(r => {
      return ((r.status as any)?.buyerReviewStatus || 'not_reviewed') === 'more_needed';
    }).length;

    const submitted = active.filter(r => {
      const s = r.status?.status || "not_submitted";
      return s === "submitted" || s === "approved";
    }).length;

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
      verified,
      toReview,
      moreNeeded,
      mandatorySubmitted,
      mandatoryTotal: mandatoryReqs.length,
      mandatoryOutstanding,
      advisorySubmitted,
      advisoryTotal: advisoryReqs.length,
      addsValueSubmitted,
      addsValueTotal: addsValueReqs.length,
    };
  }, [categories]);

  const filteredCategories = useMemo(() => {
    if (ddFilter === 'all') return categories;

    return categories.map(cat => {
      const filteredReqs = cat.requirements.filter(req => {
        const br = (req.status as any)?.buyerReviewStatus || 'not_reviewed';
        const sc = (req.status as any)?.sellerMarkedComplete;
        const s = req.status?.status || 'not_submitted';

        switch (ddFilter) {
          case 'needs_review':
            return sc && br !== 'satisfied';
          case 'more_needed':
            return br === 'more_needed';
          case 'outstanding':
            return !req.status?.documentId && s !== 'na' && br !== 'satisfied';
          case 'verified':
            return br === 'satisfied' || s === 'approved';
          default:
            return true;
        }
      });

      return { ...cat, requirements: filteredReqs };
    }).filter(cat => cat.requirements.length > 0);
  }, [categories, ddFilter]);

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
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Due Diligence Progress</CardTitle>
              {clientStats.toReview > 0 && (
                <Badge className="text-sm px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 hover:bg-blue-100">
                  <Eye className="h-3.5 w-3.5 mr-1" />
                  {clientStats.toReview} pending review
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4 text-center">
              <div className="text-2xl font-bold">{clientStats.total}</div>
              <div className="text-sm text-muted-foreground">Total Requirements</div>
            </Card>
            <Card className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{clientStats.verified}</div>
              <div className="text-sm text-muted-foreground">Verified</div>
            </Card>
            <Card className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{clientStats.toReview}</div>
              <div className="text-sm text-muted-foreground">Pending Review</div>
            </Card>
            <Card className="p-4 text-center">
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{clientStats.moreNeeded}</div>
              <div className="text-sm text-muted-foreground">Needs Attention</div>
            </Card>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium">Verification Progress</span>
              <span className="text-sm text-muted-foreground">
                {clientStats.verified} of {clientStats.total} verified
              </span>
            </div>
            <Progress value={clientStats.total > 0 ? Math.round((clientStats.verified / clientStats.total) * 100) : 0} className="h-3" />
          </div>

          <div className="flex gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />
              <span className="text-green-600 dark:text-green-400">{clientStats.verified} verified</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-blue-500 inline-block" />
              <span className="text-blue-600 dark:text-blue-400">{clientStats.toReview} pending review</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500 inline-block" />
              <span className="text-amber-600 dark:text-amber-400">{clientStats.moreNeeded} more needed</span>
            </span>
          </div>

          {clientStats.mandatoryOutstanding > 0 && (
            <div className="text-sm text-red-600 dark:text-red-400 font-medium">
              {clientStats.mandatoryOutstanding} mandatory requirement{clientStats.mandatoryOutstanding !== 1 ? 's' : ''} still outstanding
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-100 dark:border-red-900/30">
              <div className="text-lg font-bold text-red-700 dark:text-red-400">
                {clientStats.mandatorySubmitted}/{clientStats.mandatoryTotal}
              </div>
              <div className="text-sm text-red-600 dark:text-red-500">Mandatory</div>
            </div>
            <div className="text-center p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-100 dark:border-amber-900/30">
              <div className="text-lg font-bold text-amber-700 dark:text-amber-400">
                {clientStats.advisorySubmitted}/{clientStats.advisoryTotal}
              </div>
              <div className="text-sm text-amber-600 dark:text-amber-500">Advisory</div>
            </div>
            <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-100 dark:border-blue-900/30">
              <div className="text-lg font-bold text-blue-700 dark:text-blue-400">
                {clientStats.addsValueSubmitted}/{clientStats.addsValueTotal}
              </div>
              <div className="text-sm text-blue-600 dark:text-blue-500">Adds Value</div>
            </div>
          </div>

          {filteredCategories.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-muted/50 border-b">
                <span className="text-sm font-medium">Category Summary</span>
              </div>
              {filteredCategories.map((item) => {
                const activeReqs = item.requirements.filter(r => (r.status?.status || "not_submitted") !== "na");
                const verifiedCount = activeReqs.filter(r => {
                  const br = (r.status as any)?.buyerReviewStatus || 'not_reviewed';
                  return br === 'satisfied' || (r.status?.status || "not_submitted") === "approved";
                }).length;
                const allVerified = verifiedCount === activeReqs.length && activeReqs.length > 0;
                const hasMoreNeeded = activeReqs.some(r => ((r.status as any)?.buyerReviewStatus || 'not_reviewed') === 'more_needed');
                const pct = activeReqs.length > 0 ? Math.round((verifiedCount / activeReqs.length) * 100) : 0;
                return (
                  <button
                    key={item.category.id}
                    className={`w-full flex items-center justify-between py-2 px-3 text-left hover:bg-muted/30 transition-colors border-b last:border-b-0 ${allVerified ? 'bg-green-50 dark:bg-green-950/20' : hasMoreNeeded ? 'bg-amber-50 dark:bg-amber-950/20' : ''}`}
                    onClick={() => {
                      setActiveTab(String(item.category.id));
                      document.getElementById('dd-tabs-section')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    <span className="text-sm font-medium">{item.category.categoryName}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">{verifiedCount}/{activeReqs.length}</span>
                      <span className="text-sm text-muted-foreground w-10 text-right">{pct}%</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Select value={ddFilter} onValueChange={setDdFilter}>
          <SelectTrigger className="w-[200px] h-8 text-sm">
            <SelectValue placeholder="Filter requirements" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All requirements</SelectItem>
            <SelectItem value="needs_review">Needs review</SelectItem>
            <SelectItem value="more_needed">More needed sent</SelectItem>
            <SelectItem value="outstanding">Outstanding</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredCategories.length === 0 ? (
        <Card>
          <CardContent className="p-2">
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">{ddFilter === 'all' ? 'No DD categories found' : 'No matching requirements'}</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div id="dd-tabs-section">
          <Tabs value={activeTab || String(filteredCategories[0]?.category.id || '')} onValueChange={setActiveTab}>
            <TabsList className="w-full h-auto flex flex-wrap gap-1 bg-transparent p-1">
              {filteredCategories.map(item => {
                const activeReqs = item.requirements.filter(r => (r.status?.status || "not_submitted") !== "na");
                const verifiedCount = activeReqs.filter(r => {
                  const br = (r.status as any)?.buyerReviewStatus || 'not_reviewed';
                  return br === 'satisfied' || (r.status?.status || "not_submitted") === "approved";
                }).length;
                const allVerified = verifiedCount === activeReqs.length && activeReqs.length > 0;
                const hasMoreNeeded = activeReqs.some(r => ((r.status as any)?.buyerReviewStatus || 'not_reviewed') === 'more_needed');
                return (
                  <TabsTrigger key={item.category.id} value={String(item.category.id)} className="flex items-center gap-1.5 text-sm">
                    {allVerified && <span className="h-2 w-2 rounded-full bg-green-500" />}
                    {!allVerified && hasMoreNeeded && <span className="h-2 w-2 rounded-full bg-amber-500" />}
                    {item.category.categoryName}
                    <Badge variant="secondary" className="text-xs ml-1">{verifiedCount}/{activeReqs.length}</Badge>
                  </TabsTrigger>
                );
              })}
            </TabsList>
            {filteredCategories.map(item => (
              <TabsContent key={item.category.id} value={String(item.category.id)}>
                <CategoryCard
                  item={item}
                  targetCompanyId={targetCompanyId}
                  companyDocuments={companyDocuments}
                  linkedDocMap={linkedDocMap}
                  onUploadAndLink={handleUploadAndLink}
                  onBuyerReview={handleBuyerReview}
                  onOpenMoreNeeded={(reqId) => setMoreNeededRequirementId(reqId)}
                  onViewDocument={handleViewDocument}
                />
              </TabsContent>
            ))}
          </Tabs>
        </div>
      )}

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
                    await apiRequest('PUT', `/api/v2/due-diligence/company/${targetCompanyId}/requirement/${rejectingRequirementId}/status`, { status: 'rejected', notes: rejectionReason.trim() });
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

      <Dialog open={moreNeededRequirementId !== null} onOpenChange={(open) => {
        if (!open) { setMoreNeededRequirementId(null); setMoreNeededNotes(''); }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request Additional Documents</DialogTitle>
            <DialogDescription>
              Let the seller know what additional documents are needed. They'll see this note in their portal.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              value={moreNeededNotes}
              onChange={(e) => setMoreNeededNotes(e.target.value)}
              placeholder="Please provide details about what additional documents are required..."
              rows={3}
              className="text-sm"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => { setMoreNeededRequirementId(null); setMoreNeededNotes(''); }}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-700"
                disabled={!moreNeededNotes.trim() || submittingMoreNeeded}
                onClick={async () => {
                  setSubmittingMoreNeeded(true);
                  await handleBuyerReview(moreNeededRequirementId!, 'more_needed', moreNeededNotes.trim());
                  setMoreNeededRequirementId(null);
                  setMoreNeededNotes('');
                  setSubmittingMoreNeeded(false);
                }}
              >
                {submittingMoreNeeded ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                Send Request
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DocumentViewer
        document={viewingDocument}
        isOpen={showViewer}
        onClose={() => { setShowViewer(false); setViewingDocument(null); }}
        onDownload={(docId, filename) => {
          window.open(`/api/v2/files/${docId}/download`, '_blank');
        }}
        hideAnalysis={true}
      />
    </div>
  );
}
