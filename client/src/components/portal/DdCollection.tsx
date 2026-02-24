import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
} from 'lucide-react';
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
    return { label: 'Verified', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', icon: <CheckCircle className="h-4 w-4 text-green-500" /> };
  }
  if (req.buyerReviewStatus === 'more_needed') {
    return { label: 'More needed', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300', icon: <AlertCircle className="h-4 w-4 text-amber-500" /> };
  }
  if (req.sellerMarkedComplete) {
    return { label: 'Pending review', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', icon: <Clock className="h-4 w-4 text-blue-500" /> };
  }
  if (req.linkedDocuments && req.linkedDocuments.length > 0) {
    return { label: 'In progress', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300', icon: <Clock className="h-4 w-4 text-gray-400" /> };
  }
  if (req.status === 'na') {
    return { label: 'N/A', color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400', icon: <MinusCircle className="h-4 w-4 text-gray-400" /> };
  }
  return { label: 'Awaiting', color: 'bg-gray-50 text-gray-400 dark:bg-gray-900 dark:text-gray-500', icon: <AlertCircle className="h-4 w-4 text-gray-300" /> };
}

function getRequirementTint(req: DdRequirement): string {
  if (req.buyerReviewStatus === 'satisfied') {
    return 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-900';
  }
  if (req.buyerReviewStatus === 'more_needed') {
    return 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-900';
  }
  if (req.sellerMarkedComplete) {
    return 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-900';
  }
  if (req.linkedDocuments && req.linkedDocuments.length > 0) {
    return 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800';
  }
  if (req.status === 'na') {
    return 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800';
  }
  return 'bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800';
}

export default function DdCollection({ token, onDocumentUploaded }: DdCollectionProps) {
  const [uploadingRequirementId, setUploadingRequirementId] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [viewingDocument, setViewingDocument] = useState<any | null>(null);
  const [showViewer, setShowViewer] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('');
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
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-500">Loading due diligence requirements...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!categories.length) return null;

  return (
    <>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ClipboardList className="h-5 w-5 text-indigo-600" />
            Due Diligence Documents
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Please upload the requested documents against each requirement below.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4 text-center">
              <div className="text-2xl font-bold">{totalRequirements}</div>
              <div className="text-sm text-muted-foreground">Total Requirements</div>
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
              <span className="text-gray-600 dark:text-gray-400">
                {verifiedCount} of {totalRequirements} requirements verified
              </span>
              <span className="font-medium text-gray-900 dark:text-gray-100">{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-3" />

            <div className="flex gap-4 text-sm text-gray-500 dark:text-gray-400 mt-2">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />
                <span className="text-green-600 dark:text-green-400">{verifiedCount} verified</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-blue-500 inline-block" />
                <span className="text-blue-600 dark:text-blue-400">{pendingReviewCount} pending review</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-gray-400 inline-block" />
                <span className="text-gray-600 dark:text-gray-400">{inProgressCount} in progress</span>
              </span>
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden dark:border-gray-700">
            <div className="bg-gray-50 dark:bg-gray-800 py-2 px-3 border-b dark:border-gray-700">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Category Overview</span>
            </div>
            {categories.map((cat) => {
              const catVerified = cat.requirements.filter(r => r.buyerReviewStatus === 'satisfied').length;
              const allVerified = catVerified === cat.totalCount;
              const hasMoreNeeded = cat.requirements.some(r => r.buyerReviewStatus === 'more_needed');
              const catProgress = cat.totalCount > 0 ? Math.round((catVerified / cat.totalCount) * 100) : 0;
              const rowBg = allVerified
                ? 'bg-green-50 dark:bg-green-950/30 hover:bg-green-100 dark:hover:bg-green-950/50'
                : hasMoreNeeded
                  ? 'bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-950/50'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800';
              return (
                <button
                  key={cat.id}
                  className={`w-full flex items-center py-2 px-3 border-b last:border-b-0 dark:border-gray-700 cursor-pointer transition-colors ${rowBg}`}
                  onClick={() => {
                    setActiveTab(String(cat.id));
                    document.getElementById('dd-tabs-section')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  <div className="flex-1 text-left text-sm font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                    {allVerified && <span className="h-2 w-2 rounded-full bg-green-500 inline-block flex-shrink-0" />}
                    {!allVerified && hasMoreNeeded && <span className="h-2 w-2 rounded-full bg-amber-500 inline-block flex-shrink-0" />}
                    {!allVerified && !hasMoreNeeded && <span className="h-2 w-2 rounded-full bg-gray-300 dark:bg-gray-600 inline-block flex-shrink-0" />}
                    {cat.categoryName}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">{catVerified}/{cat.totalCount}</span>
                    <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full transition-all"
                        style={{ width: `${catProgress}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-10 text-right">{catProgress}%</span>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div id="dd-tabs-section">
        <Tabs value={activeTab || String(categories[0]?.id || '')} onValueChange={setActiveTab}>
          <TabsList className="w-full h-auto flex flex-wrap gap-1 bg-transparent p-1">
            {categories.map(cat => {
              const catVerified = cat.requirements.filter(r => r.buyerReviewStatus === 'satisfied').length;
              const allVerified = catVerified === cat.totalCount;
              const hasMoreNeeded = cat.requirements.some(r => r.buyerReviewStatus === 'more_needed');
              return (
                <TabsTrigger key={cat.id} value={String(cat.id)} className="flex items-center gap-1.5 text-sm px-3 py-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-sm rounded-md border border-transparent data-[state=active]:border-gray-200 dark:data-[state=active]:border-gray-700">
                  {allVerified && <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />}
                  {!allVerified && hasMoreNeeded && <span className="h-2 w-2 rounded-full bg-amber-500 inline-block" />}
                  {cat.categoryName}
                  <Badge variant="secondary" className="text-xs ml-1">{catVerified}/{cat.totalCount}</Badge>
                </TabsTrigger>
              );
            })}
          </TabsList>
          {categories.map(cat => {
            const catVerified = cat.requirements.filter(r => r.buyerReviewStatus === 'satisfied').length;
            const catProgress = cat.totalCount > 0 ? Math.round((catVerified / cat.totalCount) * 100) : 0;
            return (
              <TabsContent key={cat.id} value={String(cat.id)}>
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-semibold">{cat.categoryName}</CardTitle>
                      <Badge variant={catVerified === cat.totalCount ? 'default' : 'outline'} className="text-sm">
                        {catVerified} / {cat.totalCount}
                      </Badge>
                    </div>
                    <Progress value={catProgress} className="h-1.5 mt-2" />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {cat.requirements.map(req => {
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
                            <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
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
                            <div className="mt-3 p-2 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2">
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
                                        className="text-sm text-gray-700 dark:text-gray-300 truncate hover:text-blue-600 hover:underline cursor-pointer"
                                      >
                                        {doc.filename}
                                      </button>
                                      {doc.fileSize && <span className="text-sm text-gray-400 flex-shrink-0">{formatFileSize(doc.fileSize)}</span>}
                                      <button
                                        onClick={() => handleViewDocument(doc)}
                                        className="text-gray-400 hover:text-blue-600 flex-shrink-0"
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
                                        className="text-sm text-gray-700 dark:text-gray-300 truncate hover:text-blue-600 hover:underline cursor-pointer"
                                      >
                                        {doc.filename}
                                      </button>
                                      {doc.fileSize && <span className="text-sm text-gray-400 flex-shrink-0">{formatFileSize(doc.fileSize)}</span>}
                                      <button
                                        onClick={() => handleViewDocument(doc)}
                                        className="text-gray-400 hover:text-blue-600 flex-shrink-0"
                                        title="View document"
                                      >
                                        <Eye className="h-4 w-4" />
                                      </button>
                                      {req.buyerReviewStatus !== 'satisfied' && (
                                        <button
                                          onClick={() => handleRemoveDocument(req.id, doc.id)}
                                          className="text-gray-400 hover:text-red-500 flex-shrink-0"
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
                                <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border space-y-3">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
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
                                      <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-2 rounded border">
                                        <div className="flex items-center gap-2">
                                          <FileText className="h-4 w-4 text-blue-500" />
                                          <div>
                                            <span className="text-sm font-medium">{selectedFile.name}</span>
                                            <span className="text-xs text-gray-500 ml-2">{formatFileSize(selectedFile.size)}</span>
                                          </div>
                                        </div>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                                          className="h-6 text-xs"
                                        >
                                          Remove
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
                                  <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 text-sm">
                                    <CheckCircle className="h-4 w-4 mr-1" />
                                    Marked as complete
                                  </Badge>
                                  <button
                                    onClick={() => handleUnmarkComplete(req.id)}
                                    className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 underline"
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
              </TabsContent>
            );
          })}
        </Tabs>
      </div>

      <DocumentViewer
        document={viewingDocument}
        isOpen={showViewer}
        onClose={() => { setShowViewer(false); setViewingDocument(null); }}
        onDownload={(docId, filename) => {
          window.open(`/api/v2/public/documents/${docId}/download`, '_blank');
        }}
        publicFileBaseUrl="/api/v2/public/documents"
        hideAnalysis={true}
      />
    </>
  );
}
