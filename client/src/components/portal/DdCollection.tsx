import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import {
  ChevronDown,
  ChevronRight,
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
    return { label: 'Verified', color: 'bg-green-100 text-green-700', icon: <CheckCircle className="h-3.5 w-3.5 text-green-500" /> };
  }
  if (req.buyerReviewStatus === 'more_needed') {
    return { label: 'More needed', color: 'bg-amber-100 text-amber-700', icon: <AlertCircle className="h-3.5 w-3.5 text-amber-500" /> };
  }
  if (req.sellerMarkedComplete) {
    return { label: 'Pending review', color: 'bg-blue-100 text-blue-700', icon: <Clock className="h-3.5 w-3.5 text-blue-500" /> };
  }
  if (req.linkedDocuments && req.linkedDocuments.length > 0) {
    return { label: 'In progress', color: 'bg-gray-100 text-gray-600', icon: <Clock className="h-3.5 w-3.5 text-gray-400" /> };
  }
  if (req.status === 'na') {
    return { label: 'N/A', color: 'bg-gray-100 text-gray-500', icon: <MinusCircle className="h-3.5 w-3.5 text-gray-400" /> };
  }
  return { label: 'Awaiting', color: 'bg-gray-50 text-gray-400', icon: <AlertCircle className="h-3.5 w-3.5 text-gray-300" /> };
}

export default function DdCollection({ token, onDocumentUploaded }: DdCollectionProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
  const [uploadingRequirementId, setUploadingRequirementId] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [viewingDocument, setViewingDocument] = useState<any | null>(null);
  const [showViewer, setShowViewer] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

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

  const progressPercent = totalRequirements > 0 ? Math.round((verifiedCount / totalRequirements) * 100) : 0;

  const toggleCategory = (categoryId: number) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  };

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
        return <Badge variant="destructive" className="text-xs">Mandatory</Badge>;
      case 'Advisory':
        return <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 bg-amber-50">Advisory</Badge>;
      case 'Adds Value':
        return <Badge variant="outline" className="text-xs border-blue-300 text-blue-700 bg-blue-50">Adds Value</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{priority}</Badge>;
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ClipboardList className="h-5 w-5 text-indigo-600" />
          Due Diligence Documents
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Please upload the requested documents against each requirement below.
        </p>

        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">
              {verifiedCount} of {totalRequirements} requirements verified
            </span>
            <span className="font-medium text-gray-900">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />

          <div className="flex gap-4 text-xs text-gray-500 mt-2">
            <span className="text-green-600">{verifiedCount} verified</span>
            <span className="text-blue-600">{pendingReviewCount} pending review</span>
            <span className="text-gray-600">{inProgressCount} in progress</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {categories.map((cat, catIndex) => {
          const isExpanded = expandedCategories.has(cat.id) || (catIndex === 0 && expandedCategories.size === 0);
          const catVerified = cat.requirements.filter(r => r.buyerReviewStatus === 'satisfied').length;

          return (
            <div key={cat.id} className="border rounded-lg overflow-hidden">
              <button
                onClick={() => toggleCategory(cat.id)}
                className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  {isExpanded
                    ? <ChevronDown className="h-4 w-4 text-gray-500" />
                    : <ChevronRight className="h-4 w-4 text-gray-500" />
                  }
                  <span className="font-medium text-gray-900">{cat.categoryName}</span>
                </div>
                <Badge
                  variant={catVerified === cat.totalCount ? 'default' : 'outline'}
                  className="text-xs"
                >
                  {catVerified} / {cat.totalCount}
                </Badge>
              </button>

              {isExpanded && (
                <div className="divide-y">
                  {cat.requirements.map(req => {
                    const displayStatus = getDisplayStatus(req);
                    const buyerDocs = (req.linkedDocuments || []).filter(d => d.source === 'buyer_linked');
                    const sellerDocs = (req.linkedDocuments || []).filter(d => d.source === 'seller_uploaded');
                    const allDocs = req.linkedDocuments || [];

                    return (
                      <div key={req.id} className="p-4 border-b last:border-b-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2 flex-1">
                            {displayStatus.icon}
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-mono text-gray-400">{req.refNumber}</span>
                                <span className="text-sm font-medium">{req.documentName}</span>
                                {priorityBadge(req.priority)}
                                <Badge className={`text-xs ${displayStatus.color}`}>{displayStatus.label}</Badge>
                              </div>
                              {req.description && <p className="text-xs text-gray-500 mt-1">{req.description}</p>}
                            </div>
                          </div>
                        </div>

                        {req.buyerReviewStatus === 'more_needed' && (
                          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                            <div className="flex items-start gap-2">
                              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-sm font-medium text-amber-800">Additional documents requested</p>
                                {req.buyerReviewNotes && (
                                  <p className="text-xs text-amber-700 mt-1">{req.buyerReviewNotes}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {req.buyerReviewStatus === 'satisfied' && (
                          <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span className="text-sm text-green-700 font-medium">Verified by buyer</span>
                          </div>
                        )}

                        {allDocs.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {buyerDocs.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-blue-600 mb-1 flex items-center gap-1">
                                  <FileText className="h-3 w-3" /> Already held
                                </p>
                                {buyerDocs.map(doc => (
                                  <div key={doc.id} className="flex items-center gap-2 ml-4 py-1">
                                    <Paperclip className="h-3 w-3 text-blue-500 flex-shrink-0" />
                                    <button
                                      onClick={() => {
                                        setViewingDocument({
                                          id: doc.documentId || doc.externalSubmissionId,
                                          originalFilename: doc.filename,
                                          fileType: doc.fileType,
                                          fileSize: doc.fileSize,
                                          documentCategory: 'Due Diligence',
                                          uploadDate: doc.addedAt,
                                          createdAt: doc.addedAt,
                                        });
                                        setShowViewer(true);
                                      }}
                                      className="text-xs text-gray-700 truncate cursor-pointer hover:underline hover:text-blue-600 transition-colors"
                                    >
                                      {doc.filename}
                                    </button>
                                    {doc.fileSize && <span className="text-xs text-gray-400 flex-shrink-0">{formatFileSize(doc.fileSize)}</span>}
                                  </div>
                                ))}
                              </div>
                            )}

                            {sellerDocs.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-green-600 mb-1 flex items-center gap-1">
                                  <Upload className="h-3 w-3" /> Your uploads
                                </p>
                                {sellerDocs.map(doc => (
                                  <div key={doc.id} className="flex items-center gap-2 ml-4 py-1">
                                    <FileText className="h-3 w-3 text-green-500 flex-shrink-0" />
                                    <button
                                      onClick={() => {
                                        setViewingDocument({
                                          id: doc.documentId || doc.externalSubmissionId,
                                          originalFilename: doc.filename,
                                          fileType: doc.fileType,
                                          fileSize: doc.fileSize,
                                          documentCategory: 'Due Diligence',
                                          uploadDate: doc.addedAt,
                                          createdAt: doc.addedAt,
                                        });
                                        setShowViewer(true);
                                      }}
                                      className="text-xs text-gray-700 truncate cursor-pointer hover:underline hover:text-blue-600 transition-colors"
                                    >
                                      {doc.filename}
                                    </button>
                                    {doc.fileSize && <span className="text-xs text-gray-400 flex-shrink-0">{formatFileSize(doc.fileSize)}</span>}
                                    {req.buyerReviewStatus !== 'satisfied' && (
                                      <button
                                        onClick={() => handleRemoveDocument(req.id, doc.id)}
                                        className="text-gray-400 hover:text-red-500 flex-shrink-0"
                                        title="Remove"
                                      >
                                        <X className="h-3 w-3" />
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
                              <div className="p-3 bg-gray-50 rounded-lg border space-y-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium text-gray-700">
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
                                    <div className="flex items-center justify-between bg-white p-2 rounded border">
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
                                className="text-xs h-7"
                                onClick={() => handleStartUpload(req.id)}
                              >
                                <Upload className="h-3 w-3 mr-1" />
                                Add document
                              </Button>
                            )}
                          </div>
                        )}

                        {req.buyerReviewStatus !== 'satisfied' && allDocs.length > 0 && (
                          <div className="mt-3 pt-3 border-t">
                            {req.sellerMarkedComplete ? (
                              <div className="flex items-center gap-2">
                                <Badge className="bg-blue-100 text-blue-700 text-xs">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Marked as complete
                                </Badge>
                                <button
                                  onClick={() => handleUnmarkComplete(req.id)}
                                  className="text-xs text-gray-500 hover:text-gray-700 underline"
                                >
                                  Undo
                                </button>
                              </div>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs h-7 border-green-300 text-green-700 hover:bg-green-50"
                                onClick={() => handleMarkComplete(req.id)}
                              >
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Mark as complete
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
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
    </Card>
  );
}
