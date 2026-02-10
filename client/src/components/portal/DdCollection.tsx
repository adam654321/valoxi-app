import { useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
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
  ClipboardList,
  MinusCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';

interface DdCollectionProps {
  token: string;
  onDocumentUploaded: () => void;
}

interface DdRequirement {
  id: number;
  refNumber: string;
  documentName: string;
  description: string | null;
  priority: string;
  category: string;
  status: string;
  documentId: number | null;
  linkedDocumentName: string | null;
  linkedDocumentFilename: string | null;
  externalSubmissionId: number | null;
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

export default function DdCollection({ token, onDocumentUploaded }: DdCollectionProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
  const [uploadingRequirementId, setUploadingRequirementId] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [isUploading, setIsUploading] = useState(false);
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

  const hasDocumentCount = categories.reduce((sum, cat) => {
    return sum + cat.requirements.filter(r => r.status !== 'not_started').length;
  }, 0);
  const totalRequirements = summary?.total || 0;
  const progressPercent = totalRequirements > 0 ? Math.round((hasDocumentCount / totalRequirements) * 100) : 0;

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
        description: 'Your document has been submitted and linked to the requirement.',
      });

      setUploadingRequirementId(null);
      setSelectedFile(null);
      setSubmissionNotes('');

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

  const statusIcon = (status: string) => {
    switch (status) {
      case 'ready':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-amber-500" />;
      case 'na':
        return <MinusCircle className="h-4 w-4 text-gray-400" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-300" />;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'ready': return 'Complete';
      case 'in_progress': return 'Uploaded';
      case 'na': return 'N/A';
      default: return 'Awaiting';
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
              {hasDocumentCount} of {totalRequirements} requirements addressed
            </span>
            <span className="font-medium text-gray-900">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />

          {summary && (
            <div className="flex gap-4 text-xs text-gray-500 mt-2">
              <span>Mandatory: {summary.mandatory.completed}/{summary.mandatory.total}</span>
              <span>Advisory: {summary.advisory.completed}/{summary.advisory.total}</span>
              <span>Adds Value: {summary.addsValue.completed}/{summary.addsValue.total}</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {categories.map((cat, catIndex) => {
          const isExpanded = expandedCategories.has(cat.id) || (catIndex === 0 && expandedCategories.size === 0);
          const catAddressed = cat.requirements.filter(r => r.status !== 'not_started').length;

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
                  variant={catAddressed === cat.totalCount ? 'default' : 'outline'}
                  className="text-xs"
                >
                  {catAddressed} / {cat.totalCount}
                </Badge>
              </button>

              {isExpanded && (
                <div className="divide-y">
                  {cat.requirements.map(req => (
                    <div key={req.id} className="p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          {statusIcon(req.status)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-mono text-gray-400">{req.refNumber}</span>
                              <span className="text-sm font-medium text-gray-900">{req.documentName}</span>
                              {priorityBadge(req.priority)}
                            </div>
                            {req.description && (
                              <p className="text-xs text-gray-500 mt-1">{req.description}</p>
                            )}
                            {req.linkedDocumentName && (
                              <div className="flex items-center gap-1 mt-1 text-xs text-green-700">
                                <Paperclip className="h-3 w-3" />
                                <span>{req.linkedDocumentFilename || req.linkedDocumentName}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-gray-500">{statusLabel(req.status)}</span>
                          {req.status !== 'na' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-7"
                              onClick={() => handleStartUpload(req.id)}
                            >
                              <Upload className="h-3 w-3 mr-1" />
                              {req.status === 'not_started' ? 'Upload' : 'Replace'}
                            </Button>
                          )}
                        </div>
                      </div>

                      {uploadingRequirementId === req.id && (
                        <div className="mt-3 ml-6 p-3 bg-gray-50 rounded-lg border space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">
                              Upload for: {req.refNumber} — {req.documentName}
                            </span>
                            <Button variant="ghost" size="sm" onClick={handleCancelUpload} className="h-6 w-6 p-0">
                              <X className="h-4 w-4" />
                            </Button>
                          </div>

                          <div>
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
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
                                  onClick={() => setSelectedFile(null)}
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
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
