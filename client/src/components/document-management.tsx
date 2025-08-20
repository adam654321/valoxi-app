import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { DocumentViewer } from "@/components/document-viewer";
import { 
  FileText, 
  Upload, 
  Download, 
  Edit, 
  Trash2, 
  MoreVertical, 
  FolderOpen, 
  Shield,
  Calendar,
  User,
  Eye,
  File,
  CheckCircle,
  BarChart3,
  TrendingUp,
  AlertTriangle
} from "lucide-react";

interface DocumentManagementProps {
  targetCompanyId: number;
  companyName: string;
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

interface DocumentCategory {
  categoryName: string;
  description: string;
  sortOrder: number;
}

const documentSchema = z.object({
  document_name: z.string().min(1, "Document name is required"),
  document_category: z.string().min(1, "Category is required"),
  description: z.string().optional(),
  is_confidential: z.boolean().default(false),
});

type DocumentFormData = z.infer<typeof documentSchema>;

// Utility functions for analysis types (shared between components)
const formatDocumentType = (type: string) => {
  switch (type) {
    case 'asset_register': return 'Asset Register';
    case 'sales_ledger': return 'Sales Ledger';
    case 'staff_matrix': return 'Staff Matrix';
    case 'profit_and_loss': return 'Profit & Loss';
    case 'balance_sheet': return 'Balance Sheet';
    default: return type;
  }
};

const getDocumentTypeColor = (type: string) => {
  switch (type) {
    case 'asset_register': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
    case 'sales_ledger': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case 'staff_matrix': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'profit_and_loss': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200';
    case 'balance_sheet': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
  }
};

// Document analysis badges component
function DocumentAnalysisBadges({ documentId }: { documentId: number }) {
  const { data: analysisResults = [], isLoading } = useQuery<Array<{
    id: number;
    documentType: string;
    createdAt: string;
    analysisData: any;
  }>>({
    queryKey: ["/api/documents", documentId, "analysis"],
  });

  if (isLoading || analysisResults.length === 0) {
    return null;
  }

  // Check if any analysis result is a company_accounts document
  const hasCompanyAccounts = analysisResults.some(result => 
    result.analysisData && result.analysisData.document === 'company_accounts'
  );

  // If it's a company accounts document, only show the Company Accounts badge
  if (hasCompanyAccounts) {
    return (
      <div className="flex flex-wrap gap-1 mt-2">
        <Badge 
          className="text-xs bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200"
          data-testid="analysis-badge-company-accounts"
        >
          Company Accounts
        </Badge>
      </div>
    );
  }

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

// Analysis completion indicator component
function AnalysisCompletionIndicator({ targetCompanyId }: { targetCompanyId: number }) {
  const { data: completionStatus, isLoading } = useQuery<{
    completedTypes: string[];
    missingTypes: string[];
    isComplete: boolean;
    completionPercentage: number;
  }>({
    queryKey: ["/api/target-companies", targetCompanyId, "analysis-completion"],
  });

  if (isLoading || !completionStatus) {
    return null;
  }

  const { completedTypes, missingTypes, isComplete, completionPercentage } = completionStatus;

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="font-semibold text-blue-900 dark:text-blue-100">Document Analysis Progress</h3>
          {isComplete && (
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-300">
              <CheckCircle className="w-3 h-3 mr-1" />
              Complete
            </Badge>
          )}
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{completionPercentage}%</div>
          <div className="text-xs text-blue-600 dark:text-blue-400">{completedTypes.length}/10 Types</div>
        </div>
      </div>

      <div className="mb-3">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-blue-700 dark:text-blue-300">Analysis Coverage</span>
          <span className="text-blue-600 dark:text-blue-400">{completedTypes.length} of 10 completed</span>
        </div>
        <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
          <div 
            className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${completionPercentage}%` }}
          />
        </div>
      </div>

      {completedTypes.length > 0 && (
        <div className="mb-3">
          <div className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">✅ Analyzed:</div>
          <div className="flex flex-wrap gap-1">
            {completedTypes.map(type => (
              <Badge key={type} className={`text-xs ${getDocumentTypeColor(type)}`}>
                {formatDocumentType(type)}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {missingTypes.length > 0 && (
        <div>
          <div className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">📋 Remaining:</div>
          <div className="flex flex-wrap gap-1">
            {missingTypes.map(type => (
              <Badge key={type} variant="outline" className="text-xs border-blue-300 text-blue-600 dark:border-blue-600 dark:text-blue-400">
                {formatDocumentType(type)}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {isComplete && (
        <div className="mt-3 p-2 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm font-medium">All financial analysis types completed! Ready for comprehensive due diligence review.</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function DocumentManagement({ targetCompanyId, companyName }: DocumentManagementProps) {
  const { toast } = useToast();
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [viewingDocument, setViewingDocument] = useState<Document | null>(null);
  const [showViewer, setShowViewer] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const documentForm = useForm<DocumentFormData>({
    resolver: zodResolver(documentSchema),
    defaultValues: {
      document_name: "",
      document_category: "",
      description: "",
      is_confidential: false,
    },
  });

  // Get document categories
  const { data: categories } = useQuery<DocumentCategory[]>({
    queryKey: ["/api/document-categories"],
  });

  // Get company documents
  const { data: groupedDocuments = {}, isLoading: documentsLoading } = useQuery<Record<string, Document[]>>({
    queryKey: ["/api/target-companies", targetCompanyId, "documents"],
  });

  // Upload document mutation
  const uploadMutation = useMutation({
    mutationFn: async (data: DocumentFormData & { file: File }) => {
      const formData = new FormData();
      formData.append('document', data.file);
      formData.append('document_name', data.document_name);
      formData.append('document_category', data.document_category);
      formData.append('description', data.description || '');
      formData.append('is_confidential', data.is_confidential.toString());

      const response = await fetch(`/api/target-companies/${targetCompanyId}/documents`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: "Document uploaded successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/target-companies", targetCompanyId, "documents"] });
      
      // Invalidate analysis cache for the newly uploaded document
      if (data?.document?.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/documents", data.document.id, "analysis"] });
      }
      
      setShowUploadForm(false);
      setSelectedFile(null);
      documentForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to upload document",
        variant: "destructive",
      });
    },
  });

  // Delete document mutation
  const deleteMutation = useMutation({
    mutationFn: (documentId: number) =>
      apiRequest("DELETE", `/api/documents/${documentId}`, {}),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Document deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/target-companies", targetCompanyId, "documents"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete document",
        variant: "destructive",
      });
    },
  });

  // Clear all documents mutation
  const clearAllDocumentsMutation = useMutation({
    mutationFn: () =>
      apiRequest("DELETE", "/api/documents/clear-all", {}),
    onSuccess: (data: any) => {
      toast({
        title: "Success",
        description: `All company documents cleared successfully. ${data?.details?.deletedDocuments || 0} documents and ${data?.details?.deletedExternalSubmissions || 0} portal submissions removed.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/target-companies", targetCompanyId, "documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/target-companies", targetCompanyId, "analysis-completion"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to clear documents",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!documentForm.getValues("document_name")) {
        documentForm.setValue("document_name", file.name);
      }
    }
  };

  const handleUpload = (data: DocumentFormData) => {
    if (!selectedFile) {
      toast({
        title: "Error",
        description: "Please select a file to upload",
        variant: "destructive",
      });
      return;
    }

    uploadMutation.mutate({ ...data, file: selectedFile });
  };

  const handleView = (document: Document) => {
    setViewingDocument(document);
    setShowViewer(true);
  };

  const handleDownload = (documentId: number, filename: string) => {
    window.open(`/api/documents/${documentId}/download`, '_blank');
  };

  const handleDelete = (documentId: number) => {
    if (confirm("Are you sure you want to delete this document?")) {
      deleteMutation.mutate(documentId);
    }
  };

  const handleClearAllDocuments = () => {
    clearAllDocumentsMutation.mutate();
  };

  const handleCloseViewer = () => {
    setShowViewer(false);
    setViewingDocument(null);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) return <FileText className="w-4 h-4 text-red-500" />;
    if (fileType.includes('word')) return <FileText className="w-4 h-4 text-blue-500" />;
    if (fileType.includes('excel') || fileType.includes('spreadsheet')) return <FileText className="w-4 h-4 text-green-500" />;
    if (fileType.includes('powerpoint') || fileType.includes('presentation')) return <FileText className="w-4 h-4 text-orange-500" />;
    if (fileType.includes('image')) return <FileText className="w-4 h-4 text-purple-500" />;
    return <File className="w-4 h-4 text-gray-500" />;
  };

  const totalDocuments = Object.values(groupedDocuments).flat().length;

  if (documentsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Document Library</CardTitle>
              <CardDescription>
                Manage documents for {companyName} ({totalDocuments} documents)
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {totalDocuments > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Clear All
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                        Clear All Company Documents
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete all {totalDocuments} documents and portal submissions 
                        for {companyName}, including:
                        <br />
                        <br />
                        • All uploaded documents and their physical files
                        <br />
                        • All document analysis results
                        <br />
                        • All portal document submissions
                        <br />
                        • All document access logs
                        <br />
                        <br />
                        <strong>This action cannot be undone.</strong>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleClearAllDocuments}
                        className="bg-red-600 hover:bg-red-700"
                        disabled={clearAllDocumentsMutation.isPending}
                      >
                        {clearAllDocumentsMutation.isPending ? "Clearing..." : "Clear All Documents"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <Dialog open={showUploadForm} onOpenChange={setShowUploadForm}>
                <DialogTrigger asChild>
                  <Button>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Document
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Upload New Document</DialogTitle>
                </DialogHeader>

                <Form {...documentForm}>
                  <form onSubmit={documentForm.handleSubmit(handleUpload)} className="space-y-4">
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium">Select File *</label>
                        <div className="mt-2">
                          <input
                            ref={fileInputRef}
                            type="file"
                            onChange={handleFileSelect}
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png"
                            className="w-full p-2 border rounded-md"
                          />
                          {selectedFile && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                            </p>
                          )}
                        </div>
                      </div>

                      <FormField
                        control={documentForm.control}
                        name="document_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Document Name *</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter document name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={documentForm.control}
                        name="document_category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Category *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a category" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {categories?.map((category) => (
                                  <SelectItem key={category.categoryName} value={category.categoryName}>
                                    {category.categoryName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={documentForm.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Brief description of the document"
                                className="min-h-[80px]"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={documentForm.control}
                        name="is_confidential"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>
                                Confidential Document
                              </FormLabel>
                              <p className="text-sm text-muted-foreground">
                                Mark this document as confidential to restrict access
                              </p>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex gap-2 justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowUploadForm(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={uploadMutation.isPending || !selectedFile}
                      >
                        {uploadMutation.isPending ? "Uploading..." : "Upload Document"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <AnalysisCompletionIndicator targetCompanyId={targetCompanyId} />
          {totalDocuments === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No documents uploaded yet</p>
              <p className="text-sm mb-4">Upload documents to keep track of important files</p>
              <Button onClick={() => setShowUploadForm(true)}>
                <Upload className="w-4 h-4 mr-2" />
                Upload First Document
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedDocuments).map(([category, documents]) => (
                <div key={category} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="w-5 h-5 text-muted-foreground" />
                    <h3 className="font-semibold text-lg">{category}</h3>
                    <Badge variant="secondary" className="ml-2">
                      {documents.length}
                    </Badge>
                  </div>
                  
                  <div className="grid gap-3">
                    {documents.map((document) => (
                      <Card key={document.id} className="hover:shadow-sm transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3 flex-1">
                              {getFileIcon(document.fileType)}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-medium truncate">{document.documentName}</h4>
                                  {document.isConfidential && (
                                    <Shield className="w-4 h-4 text-amber-500" />
                                  )}
                                </div>
                                
                                <p className="text-sm text-muted-foreground mb-2">
                                  {document.originalFilename} • {formatFileSize(document.fileSize)}
                                </p>
                                
                                {document.description && (
                                  <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                                    {document.description}
                                  </p>
                                )}

                                <DocumentAnalysisBadges documentId={document.id} />
                                
                                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                                  <div className="flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    {document.uploadedByName}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {formatDate(document.uploadDate)}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Eye className="w-3 h-3" />
                                    {document.accessCount} views
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleView(document)}
                                className="flex items-center gap-1"
                              >
                                <Eye className="w-3 h-3" />
                                View
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem 
                                  onClick={() => handleView(document)}
                                >
                                  <Eye className="w-4 h-4 mr-2" />
                                  View
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleDownload(document.id, document.originalFilename)}
                                >
                                  <Download className="w-4 h-4 mr-2" />
                                  Download
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleDelete(document.id)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Document Viewer */}
      <DocumentViewer
        document={viewingDocument}
        isOpen={showViewer}
        onClose={handleCloseViewer}
        onDownload={handleDownload}
      />
    </div>
  );
}