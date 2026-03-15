import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import {
  FileText,
  Upload,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  Paperclip,
  X,
  XCircle,
  ClipboardList,
  MinusCircle,
  Eye,
  ArrowLeft,
  ChevronRight,
  HelpCircle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { DocumentViewer } from '@/components/document-viewer';

interface DdCollectionProps {
  token: string;
  onDocumentUploaded: () => void;
}

interface LinkedDocument {
  id: number;
  source: 'buyer_linked' | 'seller_uploaded';
  documentId: number | null;
  externalSubmissionId: number | null;
  filename: string;
  fileType: string | null;
  fileSize: number | null;
  addedAt: string;
  notes: string | null;
}

interface DdRequirement {
  id: number;
  refNumber: string;
  documentName: string;
  description: string | null;
  priority: string;
  category: string;
  status: string;
  notes: string | null;
  documentId: number | null;
  linkedDocumentName: string | null;
  linkedDocumentFilename: string | null;
  externalSubmissionId: number | null;
  linkedDocuments: LinkedDocument[];
  sellerMarkedComplete: boolean;
  buyerReviewStatus: 'not_reviewed' | 'satisfied' | 'more_needed';
  buyerReviewNotes: string | null;
}

interface DdCategoryData {
  id: number;
  categoryName: string;
  refPrefix: string;
  requirements: DdRequirement[];
  completedCount: number;
  totalCount: number;
}

interface DdSummary {
  total: number;
  completed: number;
  mandatory: { total: number; completed: number };
  advisory: { total: number; completed: number };
  addsValue: { total: number; completed: number };
}

function getDisplayStatus(req: DdRequirement): { label: string; color: string; icon: React.ReactNode } {
  if (req.buyerReviewStatus === 'satisfied') {
    return { label: 'Verified', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300', icon: <CheckCircle className="h-4 w-4 text-green-500" /> };
  }
  if (req.buyerReviewStatus === 'more_needed') {
    return { label: 'More needed', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', icon: <AlertCircle className="h-4 w-4 text-amber-500" /> };
  }
  if (req.sellerMarkedComplete) {
    return { label: 'Pending review', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300', icon: <Clock className="h-4 w-4 text-blue-500" /> };
  }
  if (req.linkedDocuments && req.linkedDocuments.length > 0) {
    return { label: 'In progress', color: 'bg-muted text-muted-foreground', icon: <Clock className="h-4 w-4 text-muted-foreground/70" /> };
  }
  if (req.status === 'na') {
    return { label: 'N/A', color: 'bg-muted text-muted-foreground', icon: <MinusCircle className="h-4 w-4 text-muted-foreground/70" /> };
  }
  return { label: 'Awaiting', color: 'bg-muted text-muted-foreground/70', icon: <AlertCircle className="h-4 w-4 text-muted-foreground/50" /> };
}

function getRequirementTint(req: DdRequirement): string {
  if (req.buyerReviewStatus === 'satisfied') {
    return 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900';
  }
  if (req.buyerReviewStatus === 'more_needed') {
    return 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900';
  }
  if (req.sellerMarkedComplete) {
    return 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900';
  }
  if (req.linkedDocuments && req.linkedDocuments.length > 0) {
    return 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800/60';
  }
  if (req.status === 'na') {
    return 'bg-muted border-border';
  }
  return 'bg-card border-border';
}

export default function DdCollection({ token, onDocumentUploaded }: DdCollectionProps) {
  const [showHelp, setShowHelp] = useState(false);
  const [uploadingRequirementId, setUploadingRequirementId] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [viewingDocument, setViewingDocument] = useState<any | null>(null);
  const [showViewer, setShowViewer] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleViewDocument = (doc: LinkedDocument) => {
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
      targetCompanyId: 0,
      uploadedBy: 0,
      filePath: '',
      lastAccessed: null,
      accessCount: 0,
      uploadedByName: doc.source === 'buyer_linked' ? 'Buyer' : 'Portal',
    });
    setShowViewer(true);
  };

  const { data: ddData, isLoading } = useQuery<{ data: { categories: DdCategoryData[]; summary: DdSummary } }>({
    queryKey: ['portal-dd-requirements', token],
    queryFn: async () => {
      const res = await fetch(`/api/v2/portal-submit/${token}/dd-requirements`);
      if (!res.ok) throw new Error('Failed to fetch requirements');
      return res.json();
    },
  });

  const categories = ddData?.data?.categories || [];
  const summary = ddData?.data?.summary;
  const totalRequirements = summary?.total || 0;

  const verifiedCount = categories.reduce((sum, cat) => {
    return sum + cat.requirements.filter((r: any) => r.buyerReviewStatus === 'satisfied').length;
  }, 0);

  const pendingReviewCount = categories.reduce((sum, cat) => {
    return sum + cat.requirements.filter((r: any) => r.sellerMarkedComplete && r.buyerReviewStatus !== 'satisfied' && r.buyerReviewStatus !== 'more_needed').length;
  }, 0);

  const inProgressCount = categories.reduce((sum, cat) => {
    return sum + cat.requirements.filter((r: any) => r.linkedDocuments?.length > 0 && !r.sellerMarkedComplete && r.buyerReviewStatus === 'not_reviewed').length;
  }, 0);

  const needsAttentionCount = categories.reduce((sum, cat) => {
    return sum + cat.requirements.filter((r: any) => r.buyerReviewStatus === 'more_needed').length;
  }, 0);

  const progressPercent = totalRequirements > 0 ? Math.round((verifiedCount / totalRequirements) * 100) : 0;

  const handleStartUpload = (requirementId: number) => {
    setUploadingRequirementId(requirementId);
    setSelectedFile(null);
    setSubmissionNotes('');
  };

  const handleCancelUpload = () => {
    setUploadingRequirementId(null);
    setSelectedFile(null);
    setSubmissionNotes('');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  const handleUploadSubmit = async () => {
    if (!selectedFile || !uploadingRequirementId) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('document', selectedFile);
      formData.append('documentType', 'due_diligence');
      formData.append('requirement_id', uploadingRequirementId.toString());
      if (submissionNotes.trim()) {
        formData.append('submissionNotes', submissionNotes.trim());
      }

      const response = await fetch(`/api/v2/portal-submit/${token}/submit`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }

      toast({
        title: 'Document Uploaded',
        description: 'Your document has been submitted. You can upload another or click Done.',
      });

      setSelectedFile(null);
      setSubmissionNotes('');
      if (fileInputRef.current) fileInputRef.current.value = '';

      queryClient.invalidateQueries({ queryKey: ['portal-dd-requirements', token] });
      queryClient.invalidateQueries({ queryKey: [`/api/v2/portal-submit/${token}/documents`] });
      queryClient.invalidateQueries({ queryKey: [`/api/v2/portal-submit/${token}/analysis-completion`] });
      onDocumentUploaded();
    } catch (err: any) {
      toast({
        title: 'Upload Failed',
        description: err.message || 'Failed to upload document',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleMarkComplete = async (requirementId: number) => {
    try {
      const response = await fetch(`/api/v2/portal-submit/${token}/dd-requirements/${requirementId}/mark-complete`, {
        method: 'POST',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to mark complete');
      }
      toast({ title: 'Marked as complete', description: 'The buyer will be notified to review.' });
      queryClient.invalidateQueries({ queryKey: ['portal-dd-requirements', token] });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleUnmarkComplete = async (requirementId: number) => {
    try {
      await fetch(`/api/v2/portal-submit/${token}/dd-requirements/${requirementId}/unmark-complete`, {
        method: 'POST',
      });
      queryClient.invalidateQueries({ queryKey: ['portal-dd-requirements', token] });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleRemoveDocument = async (requirementId: number, docLinkId: number) => {
    try {
      const response = await fetch(`/api/v2/portal-submit/${token}/dd-requirements/${requirementId}/documents/${docLinkId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to remove document');
      queryClient.invalidateQueries({ queryKey: ['portal-dd-requirements', token] });
      toast({ title: 'Document removed' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const priorityBadge = (priority: string) => {
    switch (priority) {
      case 'Mandatory':
        return <Badge variant="destructive" className="text-sm">Mandatory</Badge>;
      case 'Advisory':
        return <Badge variant="outline" className="text-sm border-amber-300 text-amber-700 bg-amber-50">Advisory</Badge>;
      case 'Adds Value':
        return <Badge variant="outline" className="text-sm border-blue-300 text-blue-700 bg-blue-50">Adds Value</Badge>;
      default:
        return <Badge variant="outline" className="text-sm">{priority}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/70" />
            <span className="ml-2 text-muted-foreground">Loading due diligence requirements...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!categories.length) return null;

  const selectedCategory = selectedCategoryId !== null
    ? categories.find(c => c.id === selectedCategoryId)
    : null;

  if (selectedCategory) {
    const catVerified = selectedCategory.requirements.filter(r => r.buyerReviewStatus === 'satisfied').length;
    const catProgress = selectedCategory.totalCount > 0 ? Math.round((catVerified / selectedCategory.totalCount) * 100) : 0;

    return (
      <>
        <div className="mb-4">
          <Button
            variant="ghost"
            size="sm"
            className="text-sm gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={() => {
              setSelectedCategoryId(null);
              setUploadingRequirementId(null);
              setSelectedFile(null);
              setSubmissionNotes('');
            }}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to overview
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">{selectedCategory.categoryName}</CardTitle>
              <Badge
                variant={catVerified === selectedCategory.totalCount ? 'default' : 'outline'}
                className="text-sm"
              >
                {catVerified} / {selectedCategory.totalCount}
              </Badge>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <Progress value={catProgress} className="h-2 flex-1" />
              <span className="text-sm text-muted-foreground shrink-0">{catProgress}%</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedCategory.requirements.map(req => {
              const displayStatus = getDisplayStatus(req);
              const tintClass = getRequirementTint(req);
              const buyerDocs = (req.linkedDocuments || []).filter(d => d.source === 'buyer_linked');
              const sellerDocs = (req.linkedDocuments || []).filter(d => d.source === 'seller_uploaded');
              const allDocs = req.linkedDocuments || [];

              return (
                <div key={req.id} className={`rounded-lg border p-4 mb-3 ${tintClass}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-mono text-muted-foreground">{req.refNumber}</span>
                        <span className="text-sm font-medium">{req.documentName}</span>
                        {priorityBadge(req.priority)}
                      </div>
                      {req.description && <p className="text-sm text-muted-foreground mt-1">{req.description}</p>}
                    </div>
                    <Badge className={`text-sm px-3 py-1 flex items-center gap-1.5 shrink-0 ${displayStatus.color}`}>
                      {displayStatus.icon}
                      {displayStatus.label}
                    </Badge>
                  </div>

                  {req.buyerReviewStatus === 'more_needed' && (
                    <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Additional documents requested</p>
                          {req.buyerReviewNotes && (
                            <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">{req.buyerReviewNotes}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {req.buyerReviewStatus === 'satisfied' && (
                    <div className="mt-3 p-2 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/60 rounded-lg flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-green-700 dark:text-green-300 font-medium">Verified by buyer</span>
                    </div>
                  )}

                  {allDocs.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {buyerDocs.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-1 flex items-center gap-1">
                            <FileText className="h-4 w-4" /> Already held
                          </p>
                          {buyerDocs.map(doc => (
                            <div key={doc.id} className="flex items-center gap-2 ml-4 py-2">
                              <Paperclip className="h-4 w-4 text-blue-500 flex-shrink-0" />
                              <button
                                onClick={() => handleViewDocument(doc)}
                                className="text-sm text-foreground truncate hover:text-blue-600 hover:underline cursor-pointer"
                              >
                                {doc.filename}
                              </button>
                              {doc.fileSize && <span className="text-sm text-muted-foreground/70 flex-shrink-0">{formatFileSize(doc.fileSize)}</span>}
                              <button
                                onClick={() => handleViewDocument(doc)}
                                className="text-muted-foreground/70 hover:text-blue-600 flex-shrink-0"
                                title="View document"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {sellerDocs.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-green-600 dark:text-green-400 mb-1 flex items-center gap-1">
                            <Upload className="h-4 w-4" /> Your uploads
                          </p>
                          {sellerDocs.map(doc => (
                            <div key={doc.id} className="flex items-center gap-2 ml-4 py-2">
                              <FileText className="h-4 w-4 text-green-500 flex-shrink-0" />
                              <button
                                onClick={() => handleViewDocument(doc)}
                                className="text-sm text-foreground truncate hover:text-blue-600 hover:underline cursor-pointer"
                              >
                                {doc.filename}
                              </button>
                              {doc.fileSize && <span className="text-sm text-muted-foreground/70 flex-shrink-0">{formatFileSize(doc.fileSize)}</span>}
                              <button
                                onClick={() => handleViewDocument(doc)}
                                className="text-muted-foreground/70 hover:text-blue-600 flex-shrink-0"
                                title="View document"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              {req.buyerReviewStatus !== 'satisfied' && (
                                <button
                                  onClick={() => handleRemoveDocument(req.id, doc.id)}
                                  className="text-muted-foreground/70 hover:text-red-500 flex-shrink-0"
                                  title="Remove"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {req.buyerReviewStatus !== 'satisfied' && (
                    <div className="mt-3">
                      {uploadingRequirementId === req.id ? (
                        <div className="p-3 bg-muted rounded-lg border space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-foreground">
                              Upload for: {req.refNumber} — {req.documentName}
                            </span>
                            <Button variant="ghost" size="sm" onClick={handleCancelUpload} className="h-6 text-xs">
                              Done
                            </Button>
                          </div>

                          <div>
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept=".pdf,.doc,.docx,.xls,.xlsx,.xlsm,.csv,.tsv,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.gif,.bmp,.tiff,.tif,.webp,.numbers,.pages,.key,.odt,.ods,.odp,.rtf"
                              onChange={handleFileSelect}
                              className="hidden"
                            />
                            {selectedFile ? (
                              <div className="flex items-center justify-between bg-card p-2 rounded border">
                                <div className="flex items-center gap-2">
                                  <FileText className="h-4 w-4 text-blue-500" />
                                  <div>
                                    <span className="text-sm font-medium">{selectedFile.name}</span>
                                    <span className="text-xs text-muted-foreground ml-2">{formatFileSize(selectedFile.size)}</span>
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                                  className="h-6 text-xs"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full border-dashed"
                              >
                                <Upload className="h-4 w-4 mr-2" />
                                Select file to upload
                              </Button>
                            )}
                          </div>

                          <Textarea
                            value={submissionNotes}
                            onChange={(e) => setSubmissionNotes(e.target.value)}
                            placeholder="Optional notes about this document..."
                            rows={2}
                            className="text-sm"
                          />

                          <Button
                            onClick={handleUploadSubmit}
                            disabled={!selectedFile || isUploading}
                            size="sm"
                            className="w-full"
                          >
                            {isUploading ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                Uploading...
                              </>
                            ) : (
                              <>
                                <Upload className="h-4 w-4 mr-2" />
                                Submit Document
                              </>
                            )}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-sm h-8"
                          onClick={() => handleStartUpload(req.id)}
                        >
                          <Upload className="h-4 w-4 mr-1" />
                          Add document
                        </Button>
                      )}
                    </div>
                  )}

                  {req.buyerReviewStatus !== 'satisfied' && allDocs.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      {req.sellerMarkedComplete ? (
                        <div className="flex items-center gap-2">
                          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 text-sm">
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Marked as complete
                          </Badge>
                          <button
                            onClick={() => handleUnmarkComplete(req.id)}
                            className="text-sm text-muted-foreground hover:text-foreground dark:hover:text-muted-foreground/50 underline"
                          >
                            Undo
                          </button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-sm h-8 border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-950"
                          onClick={() => handleMarkComplete(req.id)}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Mark as complete
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <DocumentViewer
          document={viewingDocument}
          isOpen={showViewer}
          onClose={() => { setShowViewer(false); setViewingDocument(null); }}
          onDownload={(docId, filename) => {
            if (viewingDocument?.publicToken) {
              window.open(`/api/v2/public/documents/${viewingDocument.publicToken}/download`, '_blank');
            }
          }}
          publicFileBaseUrl="/api/v2/public/documents"
          hideAnalysis={true}
        />
      </>
    );
  }

  return (
    <>
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ClipboardList className="h-5 w-5 text-indigo-600" />
                Due Diligence Documents
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Please upload the requested documents against each requirement below.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowHelp(true)} className="shrink-0 text-muted-foreground">
              <HelpCircle className="h-4 w-4 mr-1" />
              How this works
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4 text-center">
              <div className="text-2xl font-bold">{totalRequirements}</div>
              <div className="text-sm text-muted-foreground">Total</div>
            </Card>
            <Card className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{verifiedCount}</div>
              <div className="text-sm text-muted-foreground">Verified</div>
            </Card>
            <Card className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{pendingReviewCount}</div>
              <div className="text-sm text-muted-foreground">Pending Review</div>
            </Card>
            <Card className="p-4 text-center">
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{needsAttentionCount}</div>
              <div className="text-sm text-muted-foreground">Needs Attention</div>
            </Card>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {verifiedCount} of {totalRequirements} requirements verified
              </span>
              <span className="font-medium text-foreground">{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-3" />
          </div>
        </CardContent>
      </Card>

      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>How Stage 2 works</DialogTitle>
          </DialogHeader>
          <ul className="space-y-3 text-sm text-muted-foreground pt-2">
            <li className="flex items-start gap-3">
              <span className="h-5 w-5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</span>
              <span>Click a category below to see the specific documents required within it.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="h-5 w-5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</span>
              <span>Upload one or more documents against each requirement using the <strong>Add document</strong> button.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="h-5 w-5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">3</span>
              <span>Once ready, click <strong>Mark as complete</strong> on a requirement to notify the buyer.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="h-5 w-5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">4</span>
              <span>If the buyer needs more, the requirement will be flagged — upload the additional documents and mark complete again.</span>
            </li>
          </ul>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Categories</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {categories.map((cat) => {
              const catVerified = cat.requirements.filter(r => r.buyerReviewStatus === 'satisfied').length;
              const allVerified = catVerified === cat.totalCount && cat.totalCount > 0;
              const hasMoreNeeded = cat.requirements.some(r => r.buyerReviewStatus === 'more_needed');
              const hasPendingReview = cat.requirements.some(r => r.sellerMarkedComplete && r.buyerReviewStatus !== 'satisfied' && r.buyerReviewStatus !== 'more_needed');
              const catProgress = cat.totalCount > 0 ? Math.round((catVerified / cat.totalCount) * 100) : 0;
              const rowBg = allVerified
                ? 'bg-green-50/50 dark:bg-green-950/20'
                : hasMoreNeeded
                  ? 'bg-amber-50/50 dark:bg-amber-950/20'
                  : '';

              return (
                <button
                  key={cat.id}
                  className={`w-full flex items-center gap-3 py-3 px-4 hover:bg-muted/50 cursor-pointer transition-colors text-left ${rowBg}`}
                  onClick={() => setSelectedCategoryId(cat.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground truncate">{cat.categoryName}</span>
                      {allVerified && (
                        <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                      )}
                      {hasMoreNeeded && (
                        <Badge variant="outline" className="text-xs border-amber-300 text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 shrink-0">
                          <AlertCircle className="h-3 w-3 mr-0.5" /> Action needed
                        </Badge>
                      )}
                      {!hasMoreNeeded && hasPendingReview && (
                        <Badge variant="outline" className="text-xs border-blue-300 text-blue-600 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400 shrink-0">
                          <Eye className="h-3 w-3 mr-0.5" /> To review
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${allVerified ? 'bg-green-500' : 'bg-blue-500'}`}
                        style={{ width: `${catProgress}%` }}
                      />
                    </div>
                    <span className="text-sm text-muted-foreground w-12 text-right">{catVerified}/{cat.totalCount}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <DocumentViewer
        document={viewingDocument}
        isOpen={showViewer}
        onClose={() => { setShowViewer(false); setViewingDocument(null); }}
        onDownload={(docId, filename) => {
          if (viewingDocument?.publicToken) {
            window.open(`/api/v2/public/documents/${viewingDocument.publicToken}/download`, '_blank');
          }
        }}
        publicFileBaseUrl="/api/v2/public/documents"
        hideAnalysis={true}
      />
    </>
  );
}
