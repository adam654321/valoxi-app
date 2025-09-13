import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  CheckCircle2, 
  FileUp, 
  FileText, 
  Clock, 
  BarChart3, 
  CheckCircle,
  Trash2,
  MoreVertical,
  Eye,
  Calendar,
  User,
  AlertTriangle,
  FolderOpen
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DocumentViewer } from '@/components/document-viewer';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { formatDocumentType, getDocumentTypeColor, DOCUMENT_TYPES } from '@/lib/documentUtils';

interface DocumentStatus {
  type: string;
  label: string;
  required: boolean;
  submitted: boolean;
  isComplete?: boolean;
  isGroup?: boolean;
  submission: {
    id: number;
    filename: string;
    submittedAt: string;
    status: string;
  } | null;
}

interface PortalData {
  company_name: string;
  total_documents_required: number;
  total_submitted: number;
  progress_percentage: number;
  document_status: DocumentStatus[];
  portal_expires_at: string;
  targetCompanyId: number;
}

interface Document {
  id: number;
  targetCompanyId: number;
  uploadedBy: number;
  documentName: string;
  originalFilename: string;
  filePath: string;
  fileSize: number;
  fileType: string;
  documentCategory: string;
  description: string;
  isConfidential: boolean;
  uploadDate: string;
  lastAccessed: string | null;
  accessCount: number;
  createdAt: string;
  uploadedByName: string;
  categoryDescription?: string;
}

interface EnhancedPortalDisplayProps {
  token: string;
}


// Analysis badges component
function DocumentAnalysisBadges({ analysisResults }: { analysisResults: any[] }) {
  if (!analysisResults || analysisResults.length === 0) return null;
  
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {analysisResults.map((result) => (
        <Badge 
          key={result.id} 
          className={`text-xs ${getDocumentTypeColor(result.documentType)}`}
          data-testid={`analysis-badge-${result.documentType}`}
        >
          {formatDocumentType(result.documentType)}
        </Badge>
      ))}
    </div>
  );
}

// Analysis completion indicator component adapted for portal
function PortalAnalysisCompletionIndicator({ targetCompanyId, token }: { targetCompanyId: number; token: string }) {
  const { data: completionStatus, isLoading } = useQuery<{
    completedTypes: string[];
    missingTypes: string[];
    isComplete: boolean;
    completionPercentage: number;
    completedCount: number;
    totalCount: number;
  }>({
    queryKey: [`/api/portal/${token}/analysis-completion`],
    refetchInterval: 10000,
    refetchIntervalInBackground: false,
    staleTime: 30000,
    enabled: !!token,
  });

  if (isLoading || !completionStatus) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
        <Skeleton className="h-6 w-48 mb-3" />
        <Skeleton className="h-3 w-full mb-3" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-20" />
        </div>
      </div>
    );
  }

  const { completedTypes, missingTypes, isComplete, completionPercentage, completedCount, totalCount } = completionStatus;

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4" data-testid="analysis-progress-section">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="font-semibold text-blue-900 dark:text-blue-100" data-testid="text-analysis-progress-title">Document Analysis Progress</h3>
          {isComplete && (
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-300" data-testid="badge-analysis-complete">
              <CheckCircle className="w-3 h-3 mr-1" />
              Complete
            </Badge>
          )}
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-blue-900 dark:text-blue-100" data-testid="text-analysis-percentage">{Math.round(completionPercentage)}%</div>
          <div className="text-xs text-blue-600 dark:text-blue-400" data-testid="text-analysis-types-count">{completedCount}/10 Types</div>
        </div>
      </div>
      
      <div className="mb-4">
        <div className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">Analysis Coverage</div>
        <div className="w-full bg-blue-200 rounded-full h-3 dark:bg-blue-800">
          <div 
            className="bg-blue-600 h-3 rounded-full dark:bg-blue-400" 
            style={{ width: `${completionPercentage}%` }}
            data-testid="progress-analysis-bar"
          ></div>
        </div>
        <div className="text-xs text-blue-600 dark:text-blue-400 mt-1" data-testid="text-analysis-count">{completedCount} of {totalCount} completed</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">✅ Analyzed:</div>
          <div className="flex flex-wrap gap-1">
            {(() => {
              // Group company accounts together and handle other types
              const displayCompleted = Array.from(new Set(completedTypes.map(type => {
                return type.startsWith("company_accounts") ? "company_accounts" : type;
              })));
              
              // Count company accounts documents
              const companyAccountsCount = completedTypes.filter(t => t.startsWith("company_accounts")).length;
              
              return displayCompleted.map(normalizedType => (
                <Badge key={normalizedType} className={`text-xs ${getDocumentTypeColor(normalizedType)}`} data-testid={`badge-analyzed-${normalizedType}`}>
                  {normalizedType === "company_accounts" 
                    ? `Company Accounts (${companyAccountsCount})`
                    : formatDocumentType(normalizedType)
                  }
                </Badge>
              ));
            })()}
          </div>
        </div>
        
        {missingTypes.length > 0 && (
        <div>
          <div className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">📋 Remaining:</div>
          <div className="flex flex-wrap gap-1">
            {missingTypes.map(type => (
              <Badge key={type} variant="outline" className="text-xs border-blue-300 text-blue-600 dark:border-blue-600 dark:text-blue-400" data-testid={`badge-remaining-${type}`}>
                {formatDocumentType(type)}
              </Badge>
            ))}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

export function EnhancedPortalDisplay({ token }: EnhancedPortalDisplayProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedDocumentType, setSelectedDocumentType] = useState<string>('');
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [viewingDocument, setViewingDocument] = useState<Document | null>(null);
  const [showViewer, setShowViewer] = useState(false);
  
  const { toast } = useToast();

  // Fetch portal data
  const { data: portalData, isLoading: isPortalLoading } = useQuery<PortalData>({
    queryKey: [`/api/portal/${token}`],
    enabled: !!token
  });

  // Get analysis completion status
  const { data: analysisCompletion } = useQuery<{
    completedTypes: string[];
    missingTypes: string[];
    isComplete: boolean;
    completionPercentage: number;
    completedCount: number;
    totalCount: number;
  }>({
    queryKey: [`/api/portal/${token}/analysis-completion`],
    refetchInterval: 10000,
    refetchIntervalInBackground: false,
    staleTime: 30000,
    enabled: !!token,
  });

  // Get all documents for the company
  const { data: documents = [], isLoading: isDocumentsLoading, error: documentsError } = useQuery<Document[]>({
    queryKey: [`/api/portal/${token}/documents`],
    enabled: !!token,
    retry: 1
  });


  // Submit document mutation
  const submitDocumentMutation = useMutation({
    mutationFn: async ({ file, documentType, notes }: { file: File; documentType: string; notes: string }) => {
      const formData = new FormData();
      formData.append('document', file);
      formData.append('documentType', documentType);
      formData.append('submissionNotes', notes);

      const response = await fetch(`/api/portal/${token}/submit`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Document Uploaded",
        description: "Your document has been submitted successfully!",
      });
      
      // Reset form
      setSelectedFile(null);
      setSelectedDocumentType('');
      setSubmissionNotes('');
      
      // Refresh all portal data
      queryClient.invalidateQueries({ queryKey: [`/api/portal/${token}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/portal/${token}/analysis-completion`] });
      queryClient.invalidateQueries({ queryKey: [`/api/portal/${token}/documents`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Delete document mutation
  const deleteMutation = useMutation({
    mutationFn: (documentId: number) =>
      apiRequest("DELETE", `/api/portal/${token}/documents/${documentId}`, {}),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Document deleted successfully",
      });
      // Refresh all portal data
      queryClient.invalidateQueries({ queryKey: [`/api/portal/${token}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/portal/${token}/analysis-completion`] });
      queryClient.invalidateQueries({ queryKey: [`/api/portal/${token}/documents`] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete document",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile || !selectedDocumentType) {
      toast({
        title: "Missing Information",
        description: "Please select both a file and document type",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      await submitDocumentMutation.mutateAsync({
        file: selectedFile,
        documentType: selectedDocumentType,
        notes: submissionNotes
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = (documentId: number) => {
    deleteMutation.mutate(documentId);
  };

  const handleViewDocument = (document: Document) => {
    setViewingDocument(document);
    setShowViewer(true);
  };

  const handleCloseViewer = () => {
    setShowViewer(false);
    setViewingDocument(null);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isPortalLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading portal...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!portalData) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-12">
            <p className="text-red-600">Invalid or expired portal link</p>
          </div>
        </div>
      </div>
    );
  }

  // Group documents by category
  const documentsByCategory = documents.reduce((acc, doc) => {
    const category = doc.documentCategory;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(doc);
    return acc;
  }, {} as Record<string, Document[]>);

  const totalDocuments = documents.length;
  const isCompleted = (analysisCompletion?.completionPercentage ?? 0) >= 100;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl text-center" data-testid="text-portal-title">
              Document Submission Portal
            </CardTitle>
            <p className="text-center text-gray-600" data-testid="text-company-name">
              {portalData.company_name}
            </p>
          </CardHeader>
        </Card>

        {/* Document Management Section - similar to document library */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2" data-testid="text-document-library-title">
                  <FileText className="w-5 h-5" />
                  Document Library
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1" data-testid="text-document-count">
                  Manage documents for {portalData.company_name} ({totalDocuments} documents)
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Analysis Progress Indicator */}
            <PortalAnalysisCompletionIndicator targetCompanyId={portalData.targetCompanyId} token={token} />
            
            {totalDocuments === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2" data-testid="text-no-documents">No documents uploaded yet</p>
                <p className="text-sm mb-4">Upload documents to keep track of important files</p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(documentsByCategory).map(([category, categoryDocuments]) => (
                  <div key={category} className="space-y-3">
                    <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                      <h3 className="text-lg font-semibold flex items-center gap-2" data-testid={`text-category-${category.replace(/\s+/g, '-').toLowerCase()}`}>
                        <FileText className="w-5 h-5" />
                        {category}
                        <Badge variant="outline" className="ml-2" data-testid={`badge-count-${category.replace(/\s+/g, '-').toLowerCase()}`}>
                          {categoryDocuments.length}
                        </Badge>
                      </h3>
                    </div>
                    
                    <div className="grid gap-3">
                      {categoryDocuments.map((document) => (
                        <div key={document.id} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors" data-testid={`card-document-${document.id}`}>
                          <div className="flex items-start justify-between">
                            <div className="flex items-start space-x-3 flex-1">
                              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                <FileText className="w-5 h-5 text-blue-600" />
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-gray-900 truncate" data-testid={`text-filename-${document.id}`}>
                                  {document.originalFilename}
                                </h4>
                                <p className="text-sm text-gray-600 mt-1" data-testid={`text-document-name-${document.id}`}>
                                  {document.documentName}
                                </p>
                                
                                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                  <span className="flex items-center gap-1" data-testid={`text-upload-date-${document.id}`}>
                                    <Calendar className="w-3 h-3" />
                                    {formatDate(document.uploadDate)}
                                  </span>
                                  <span className="flex items-center gap-1" data-testid={`text-uploader-${document.id}`}>
                                    <User className="w-3 h-3" />
                                    {document.uploadedByName || 'External Portal'}
                                  </span>
                                  <span data-testid={`text-file-size-${document.id}`}>{formatFileSize(document.fileSize)}</span>
                                  {document.isConfidential && (
                                    <Badge variant="outline" className="text-red-600 border-red-300" data-testid={`badge-confidential-${document.id}`}>
                                      Confidential
                                    </Badge>
                                  )}
                                </div>
                                
                                {/* Document analysis badges would go here if available */}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewDocument(document)}
                                data-testid={`button-view-${document.id}`}
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                View
                              </Button>
                              
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" data-testid={`button-menu-${document.id}`}>
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleViewDocument(document)} data-testid={`menu-view-${document.id}`}>
                                    <Eye className="w-4 h-4 mr-2" />
                                    View Document
                                  </DropdownMenuItem>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <DropdownMenuItem onSelect={(e) => e.preventDefault()} data-testid={`menu-delete-${document.id}`}>
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Delete Document
                                      </DropdownMenuItem>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle className="flex items-center gap-2">
                                          <AlertTriangle className="w-5 h-5 text-red-500" />
                                          Delete Document
                                        </AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Are you sure you want to delete "{document.originalFilename}"? This action cannot be undone.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel data-testid={`button-cancel-delete-${document.id}`}>Cancel</AlertDialogCancel>
                                        <AlertDialogAction 
                                          onClick={() => handleDelete(document.id)}
                                          className="bg-red-600 hover:bg-red-700"
                                          disabled={deleteMutation.isPending}
                                          data-testid={`button-confirm-delete-${document.id}`}
                                        >
                                          {deleteMutation.isPending ? "Deleting..." : "Delete Document"}
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upload Section */}
        {!isCompleted && (
          <Card>
            <CardHeader>
              <CardTitle data-testid="text-upload-section-title">Upload Document</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Document Type Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Document Type</label>
                <Select value={selectedDocumentType} onValueChange={setSelectedDocumentType}>
                  <SelectTrigger data-testid="select-document-type">
                    <SelectValue placeholder="Select document type to upload" />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES
                      .filter(type => {
                        if (!analysisCompletion) return true;
                        
                        // Filter logic for available document types based on analysis completion
                        switch (type.value) {
                          case 'company_accounts':
                            const companyAccountsCompleted = analysisCompletion.completedTypes.filter(t => 
                              t.startsWith('company_accounts')
                            ).length;
                            return companyAccountsCompleted < 5;
                          case 'asset_register':
                            return !analysisCompletion.completedTypes.includes('asset_register');
                          case 'balance_sheet':
                            return !analysisCompletion.completedTypes.includes('balance_sheet');
                          case 'p_and_l':
                            return !analysisCompletion.completedTypes.includes('profit_and_loss');
                          case 'sales_ledger':
                            return !analysisCompletion.completedTypes.includes('sales_ledger');
                          case 'staff_matrix':
                            return !analysisCompletion.completedTypes.includes('staff_matrix');
                          default:
                            return true;
                        }
                      })
                      .map(type => (
                        <SelectItem key={type.value} value={type.value} data-testid={`option-${type.value}`}>
                          {type.label}
                        </SelectItem>
                      ))
                    }
                  </SelectContent>
                </Select>
              </div>

              {/* File Upload */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Select File</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                  <input
                    type="file"
                    id="document-file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx"
                    onChange={handleFileSelect}
                    className="hidden"
                    data-testid="input-file-upload"
                  />
                  <label htmlFor="document-file" className="cursor-pointer block">
                    <FileUp className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                    <div className="text-lg font-medium text-gray-700">
                      Click to upload document
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      Supported formats: PDF, Word, Excel
                    </div>
                  </label>
                </div>
                
                {selectedFile && (
                  <div className="bg-gray-50 rounded-lg p-3" data-testid="selected-file-preview">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900" data-testid="text-selected-filename">{selectedFile.name}</div>
                        <div className="text-sm text-gray-500" data-testid="text-selected-filesize">{formatFileSize(selectedFile.size)}</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedFile(null)}
                        data-testid="button-remove-file"
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Additional Notes (Optional)</label>
                <Textarea
                  value={submissionNotes}
                  onChange={(e) => setSubmissionNotes(e.target.value)}
                  placeholder="Any additional information about this document..."
                  rows={3}
                  data-testid="textarea-submission-notes"
                />
              </div>

              {/* Submit Button */}
              <Button
                onClick={handleSubmit}
                disabled={!selectedFile || !selectedDocumentType || isUploading}
                className="w-full"
                size="lg"
                data-testid="button-submit-document"
              >
                {isUploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Uploading...
                  </>
                ) : (
                  'Submit Document'
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Completion Message */}
        {isCompleted && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
                <h3 className="text-xl font-semibold text-green-800" data-testid="text-completion-title">
                  All Documents Submitted!
                </h3>
                <p className="text-gray-600" data-testid="text-completion-message">
                  Thank you for submitting all required documents. Our team will review them and be in touch soon.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Document Viewer */}
      <DocumentViewer
        document={viewingDocument}
        isOpen={showViewer}
        onClose={handleCloseViewer}
        onDownload={() => {}}
      />
    </div>
  );
}