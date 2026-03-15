import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import NdaAgreement from '@/components/portal/NdaAgreement';
import OfferReview from '@/components/portal/OfferReview';
import HoTReview from '@/components/portal/HoTReview';
import DdCollection from '@/components/portal/DdCollection';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
  FolderOpen,
  Code,
  Shield,
  FileCheck,
  ChevronDown,
  ChevronRight,
  ClipboardList,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DocumentViewer } from '@/components/document-viewer';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { formatDocumentType, getDocumentTypeColor, DOCUMENT_TYPES } from '@/lib/documentUtils';

// Utility functions shared between components
const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Function to enhance display data with calculated financial ratios for existing data
const enhanceDisplayData = (analysisData: any, documentType: string) => {
  // Only enhance profit & loss documents
  if (documentType !== 'profit_and_loss') {
    return analysisData;
  }

  try {
    // Create a deep copy to avoid modifying the original
    const enhanced = JSON.parse(JSON.stringify(analysisData));
    
    // Check if we have years data with profit and loss information
    if (enhanced.years && typeof enhanced.years === 'object') {
      Object.keys(enhanced.years).forEach(year => {
        const yearData = enhanced.years[year];
        
        // Ensure profit_and_loss object exists
        if (yearData.profit_and_loss) {
          const pl = yearData.profit_and_loss;
          
          // Only add calculations if they don't already exist
          // Calculate Gross Margin % = (Gross Profit / Revenue) * 100
          if (!pl.gross_margin_percentage && pl.revenue && pl.gross_profit && pl.revenue > 0) {
            pl.gross_margin_percentage = Number(((pl.gross_profit / pl.revenue) * 100).toFixed(2));
          }
          
          // Calculate Net Margin % = (Net Profit / Revenue) * 100
          if (!pl.net_margin_percentage && pl.revenue && pl.net_profit && pl.revenue > 0) {
            pl.net_margin_percentage = Number(((pl.net_profit / pl.revenue) * 100).toFixed(2));
          }
          
          // Calculate Interest Coverage Ratio = Operating Profit / Interest Payable
          if (!pl.interest_coverage_ratio && pl.operating_profit && pl.interest_payable && pl.interest_payable > 0) {
            pl.interest_coverage_ratio = Number((pl.operating_profit / pl.interest_payable).toFixed(2));
          }
        }
      });
    }
    
    // Also check for direct profit_and_loss data (without years structure)
    if (enhanced.profit_and_loss && typeof enhanced.profit_and_loss === 'object') {
      const pl = enhanced.profit_and_loss;
      
      // Only add calculations if they don't already exist
      // Calculate Gross Margin % = (Gross Profit / Revenue) * 100
      if (!pl.gross_margin_percentage && pl.revenue && pl.gross_profit && pl.revenue > 0) {
        pl.gross_margin_percentage = Number(((pl.gross_profit / pl.revenue) * 100).toFixed(2));
      }
      
      // Calculate Net Margin % = (Net Profit / Revenue) * 100
      if (!pl.net_margin_percentage && pl.revenue && pl.net_profit && pl.revenue > 0) {
        pl.net_margin_percentage = Number(((pl.net_profit / pl.revenue) * 100).toFixed(2));
      }
      
      // Calculate Interest Coverage Ratio = Operating Profit / Interest Payable
      if (!pl.interest_coverage_ratio && pl.operating_profit && pl.interest_payable && pl.interest_payable > 0) {
        pl.interest_coverage_ratio = Number((pl.operating_profit / pl.interest_payable).toFixed(2));
      }
    }
    
    return enhanced;
    
  } catch (error) {
    console.error('Error enhancing display data:', error);
    return analysisData; // Return original data if enhancement fails
  }
};

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
  token?: { id: number; expiresAt: string; customMessage: string | null };
  company?: { id: number; name: string };
  buyerPlanKey?: string;
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
  publicToken: string;
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

// Portal version of DocumentAnalysisBadges component that fetches analysis results
function PortalDocumentAnalysisBadges({ documentId, documentCategory }: { documentId: number; documentCategory: string }) {
  const { data: analysisResults = [], isLoading: analysisLoading } = useQuery<Array<{
    id: number;
    documentType: string;
    createdAt: string;
    analysisData: any;
  }>>({
    queryKey: ["/api/v2/document-analysis/document", documentId],
    select: (response: any) => response.data,
  });

  if (analysisLoading || analysisResults.length === 0) {
    return null;
  }

  // If the document was uploaded with "Company Accounts" category, always show only Company Accounts badge
  if (documentCategory === 'Company Accounts') {
    return (
      <div className="flex flex-wrap gap-1 mt-2">
        <Badge 
          className="text-xs bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200"
          data-testid="portal-analysis-badge-company-accounts"
        >
          Company Accounts
        </Badge>
      </div>
    );
  }

  // For non-Company Accounts documents, show badges based on analysis results
  // Check if any analysis result is a company_accounts document  
  const hasCompanyAccounts = analysisResults.some(result => 
    result.analysisData && result.analysisData.document === 'company_accounts'
  );

  // If it's a company accounts document (by analysis), only show the Company Accounts badge
  if (hasCompanyAccounts) {
    return (
      <div className="flex flex-wrap gap-1 mt-2">
        <Badge 
          className="text-xs bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200"
          data-testid="portal-analysis-badge-company-accounts"
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
          data-testid={`portal-analysis-badge-${result.documentType}`}
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
    queryKey: [`/api/v2/portal-submit/${token}/analysis-completion`],
    refetchInterval: 10000,
    refetchIntervalInBackground: false,
    staleTime: 30000,
    enabled: !!token,
    select: (response: any) => response.data,
  });

  if (isLoading || !completionStatus) {
    return (
      <div className="bg-muted border border-border rounded-lg p-4 mb-4">
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
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800/50 rounded-lg p-4 mb-4" data-testid="analysis-progress-section">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="font-semibold text-blue-900 dark:text-blue-100" data-testid="text-analysis-progress-title">Document Analysis Progress</h3>
          {isComplete && (
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border-green-300 dark:border-green-800/50" data-testid="badge-analysis-complete">
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
        <div className="w-full bg-blue-200 rounded-full h-3 dark:bg-blue-800/40">
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
          <div className="flex items-center gap-1 text-sm font-medium text-blue-700 dark:text-blue-300 mb-2"><CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> Analyzed:</div>
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
          <div className="flex items-center gap-1 text-sm font-medium text-blue-700 dark:text-blue-300 mb-2"><ClipboardList className="w-3.5 h-3.5" /> Remaining:</div>
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
  const [activePortalTab, setActivePortalTab] = useState<string>('stage1');
  const [expandedDealDocs, setExpandedDealDocs] = useState<Set<string>>(new Set());
  const [ndaHtml, setNdaHtml] = useState<string | null>(null);
  const [ndaHtmlLoading, setNdaHtmlLoading] = useState(false);
  const [showDdIntro, setShowDdIntro] = useState(() => {
    try {
      return !localStorage.getItem(`dd-intro-dismissed-${token}`);
    } catch {
      return true;
    }
  });
  
  const { toast } = useToast();

  const toggleDealDoc = (docKey: string) => {
    setExpandedDealDocs(prev => {
      const next = new Set(prev);
      if (next.has(docKey)) next.delete(docKey);
      else next.add(docKey);
      return next;
    });
  };

  const loadNdaHtml = async (docId: number) => {
    if (ndaHtml) return;
    setNdaHtmlLoading(true);
    try {
      const res = await fetch(`/api/v2/public/deal-documents/${token}/${docId}/html`);
      if (res.ok) {
        const data = await res.json();
        setNdaHtml(data.html || '');
      }
    } catch (err) {
      console.error('Failed to load NDA content:', err);
    } finally {
      setNdaHtmlLoading(false);
    }
  };

  // Fetch portal data
  const { data: portalData, isLoading: isPortalLoading } = useQuery<PortalData>({
    queryKey: [`/api/v2/portal-submit/${token}`],
    enabled: !!token,
    select: (response: any) => response.data,
  });

  // Fetch deal documents (NDA status)
  const { data: dealDocsData, refetch: refetchDealDocs } = useQuery<{ documents: any[]; ndaAccepted: boolean }>({
    queryKey: ['/api/v2/public/deal-documents', token],
    queryFn: async () => {
      const res = await fetch(`/api/v2/public/deal-documents/${token}`);
      if (!res.ok) return { documents: [], ndaAccepted: true };
      return res.json();
    },
    enabled: !!token,
  });

  // Get all documents for the company
  const { data: documents = [], isLoading: isDocumentsLoading, error: documentsError } = useQuery<Document[]>({
    queryKey: [`/api/v2/portal-submit/${token}/documents`],
    enabled: !!token,
    retry: 1,
    select: (response: any) => response.data,
  });

  const { data: analysisCompletion } = useQuery<{
    completedTypes: string[];
    missingTypes: string[];
    isComplete: boolean;
    completionPercentage: number;
    completedCount: number;
    totalCount: number;
  }>({
    queryKey: [`/api/v2/portal-submit/${token}/analysis-completion`],
    enabled: !!token,
    refetchInterval: 10000,
    refetchIntervalInBackground: false,
    staleTime: 30000,
    select: (response: any) => response.data,
  });

  // SSE subscription for real-time document updates
  useEffect(() => {
    const companyId = portalData?.targetCompanyId || portalData?.company?.id;
    if (!companyId) return;

    const targetCompanyId = companyId;
    console.log(`[PORTAL] Setting up SSE for company ${targetCompanyId}`);
    
    const eventSource = new EventSource(`/api/document-updates/stream/${targetCompanyId}`);
    
    eventSource.onopen = () => {
      console.log(`[PORTAL SSE] Connected to document update stream for company: ${targetCompanyId}`);
    };
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log(`[PORTAL SSE] Received update:`, data);
        
        if (data.type === 'document_uploaded' || data.type === 'document_deleted') {
          console.log(`[PORTAL SSE] Invalidating portal caches for token: ${token.substring(0, 8)}...`);
          // Invalidate all portal queries
          queryClient.invalidateQueries({ queryKey: [`/api/v2/portal-submit/${token}`] });
          queryClient.invalidateQueries({ queryKey: [`/api/v2/portal-submit/${token}/documents`] });
        }
      } catch (error) {
        console.error('[PORTAL SSE] Error parsing SSE data:', error);
      }
    };
    
    eventSource.onerror = (error) => {
      console.error('[PORTAL SSE] Connection error:', error);
    };
    
    return () => {
      console.log(`[PORTAL SSE] Disconnecting from document update stream for company: ${targetCompanyId}`);
      eventSource.close();
    };
  }, [portalData?.targetCompanyId, portalData?.company?.id, token]);

  const hotAccepted = (dealDocsData?.documents || []).some(
    (d: any) => d.documentType === 'heads_of_terms' && d.status === 'accepted'
  );

  useEffect(() => {
    if (hotAccepted && portalData?.buyerPlanKey !== 'CORE') {
      setActivePortalTab('stage2');
    }
  }, [hotAccepted, portalData?.buyerPlanKey]);

  // Submit document mutation
  const submitDocumentMutation = useMutation({
    mutationFn: async ({ file, documentType, notes }: { file: File; documentType: string; notes: string }) => {
      const formData = new FormData();
      formData.append('document', file);
      formData.append('documentType', documentType);
      formData.append('submissionNotes', notes);

      const response = await fetch(`/api/v2/portal-submit/${token}/submit`, {
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
      queryClient.invalidateQueries({ queryKey: [`/api/v2/portal-submit/${token}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/v2/portal-submit/${token}/documents`] });
      queryClient.invalidateQueries({ queryKey: [`/api/v2/portal-submit/${token}/analysis-completion`] });
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
      apiRequest("DELETE", `/api/v2/portal-submit/${token}/documents/${documentId}`, {}),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Document deleted successfully",
      });
      // Refresh all portal data
      queryClient.invalidateQueries({ queryKey: [`/api/v2/portal-submit/${token}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/v2/portal-submit/${token}/documents`] });
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


  if (isPortalLoading) {
    return (
      <div className="force-light min-h-screen bg-muted p-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading portal...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!portalData) {
    return (
      <div className="force-light min-h-screen bg-muted p-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-12">
            <p className="text-red-600">Invalid or expired portal link</p>
          </div>
        </div>
      </div>
    );
  }

  // NDA gate — if there's an unsigned NDA, show it before allowing portal access
  const ndaDocument = dealDocsData?.documents?.find((d: any) => d.documentType === 'nda');
  const ndaAccepted = dealDocsData?.ndaAccepted ?? true;

  if (ndaDocument && !ndaAccepted) {
    return (
      <NdaAgreement
        token={token}
        ndaDocument={ndaDocument}
        buyerCompanyName={portalData.company_name || portalData.company?.name || ''}
        onAgreed={() => refetchDealDocs()}
      />
    );
  }

  const offerDocuments = (dealDocsData?.documents || [])
    .filter((d: any) => d.documentType === 'offer_letter');

  const hotDocuments = (dealDocsData?.documents || [])
    .filter((d: any) => d.documentType === 'heads_of_terms');

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
  const isCompleted = (portalData?.progress_percentage ?? 0) >= 100;

  return (
    <div className="force-light min-h-screen bg-muted p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl text-center" data-testid="text-portal-title">
              Document Submission Portal
            </CardTitle>
            <p className="text-center text-muted-foreground" data-testid="text-company-name">
              {portalData.company_name || portalData.company?.name}
            </p>
            {portalData.token?.expiresAt && (
              <p className={`text-xs mt-1 text-center ${
                new Date(portalData.token.expiresAt).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000
                  ? 'text-red-500 font-medium'
                  : new Date(portalData.token.expiresAt).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000
                    ? 'text-amber-500'
                    : 'text-muted-foreground'
              }`}>
                Portal access expires: {new Date(portalData.token.expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            )}
          </CardHeader>
        </Card>

        <Tabs value={activePortalTab} onValueChange={setActivePortalTab} className="space-y-6">
          <TabsList className="flex w-full">
            <TabsTrigger value="stage1" className="flex items-center gap-2 flex-1">
              <FileText className="w-4 h-4" />
              Stage 1: Financial
            </TabsTrigger>
            {hotAccepted && portalData.buyerPlanKey !== 'CORE' && (
              <TabsTrigger value="stage2" className="flex items-center gap-2 flex-1">
                <FileCheck className="w-4 h-4" />
                Stage 2: Due Diligence
              </TabsTrigger>
            )}
            <TabsTrigger value="deal-documents" className="flex items-center gap-2 flex-1">
              <Shield className="w-4 h-4" />
              Deal Documents
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stage1" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2" data-testid="text-document-library-title">
                      <FileText className="w-5 h-5" />
                      Document Library
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1" data-testid="text-document-count">
                      Manage documents for {portalData.company_name || portalData.company?.name} ({totalDocuments} documents)
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                
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
                        <div className="flex items-center justify-between border-b border-border pb-2">
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
                            <div key={document.id} className="border border-border rounded-lg p-4 hover:border-border transition-colors" data-testid={`card-document-${document.id}`}>
                              <div className="flex items-start justify-between">
                                <div className="flex items-start space-x-3 flex-1">
                                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <FileText className="w-5 h-5 text-blue-600" />
                                  </div>
                                  
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-medium text-foreground truncate" data-testid={`text-filename-${document.id}`}>
                                      {document.originalFilename}
                                    </h4>
                                    
                                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
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

            {!isCompleted && (
              <Card>
                <CardHeader>
                  <CardTitle data-testid="text-upload-section-title">Upload Document</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
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
                            switch (type.value) {
                              case 'company_accounts': {
                                const count = analysisCompletion.completedTypes.filter(t =>
                                  t.startsWith('company_accounts')
                                ).length;
                                return count < 5;
                              }
                              case 'asset_register':
                                return !analysisCompletion.completedTypes.includes('asset_register');
                              case 'balance_sheet':
                                return !analysisCompletion.completedTypes.includes('balance_sheet');
                              case 'profit_and_loss':
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

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Select File</label>
                    <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-border transition-colors">
                      <input
                        type="file"
                        id="document-file"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.xlsm,.csv,.tsv,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.gif,.bmp,.tiff,.tif,.webp,.numbers,.pages,.key,.odt,.ods,.odp,.rtf"
                        onChange={handleFileSelect}
                        className="hidden"
                        data-testid="input-file-upload"
                      />
                      <label htmlFor="document-file" className="cursor-pointer block">
                        <FileUp className="h-8 w-8 mx-auto text-muted-foreground/70 mb-2" />
                        <div className="text-lg font-medium text-foreground">
                          Click to upload document
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          Supported formats: PDF, Word, Excel
                        </div>
                      </label>
                    </div>
                    
                    {selectedFile && (
                      <div className="bg-muted rounded-lg p-3" data-testid="selected-file-preview">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-foreground" data-testid="text-selected-filename">{selectedFile.name}</div>
                            <div className="text-sm text-muted-foreground" data-testid="text-selected-filesize">{formatFileSize(selectedFile.size)}</div>
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

            {isCompleted && (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center space-y-4">
                    <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
                    <h3 className="text-xl font-semibold text-green-800" data-testid="text-completion-title">
                      All Documents Submitted!
                    </h3>
                    <p className="text-muted-foreground" data-testid="text-completion-message">
                      Thank you for submitting all required documents. Our team will review them and be in touch soon.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {hotAccepted && portalData.buyerPlanKey !== 'CORE' && (
            <TabsContent value="stage2">
              {showDdIntro ? (
                <div className="min-h-[60vh] flex items-center justify-center py-8 px-4">
                  <div className="max-w-xl w-full space-y-8">

                    <div className="text-center space-y-4">
                      <div className="inline-flex items-center justify-center h-20 w-20 rounded-2xl bg-indigo-600 shadow-lg mx-auto">
                        <ClipboardList className="h-10 w-10 text-white" />
                      </div>
                      <div>
                        <h2 className="text-3xl font-bold text-foreground">Stage 2: Due Diligence</h2>
                        <p className="text-muted-foreground mt-2 text-base leading-relaxed">
                          The Heads of Terms have been agreed. We now need to collect the supporting documents
                          so the buyer can complete a thorough review of the business before exchange.
                        </p>
                      </div>
                    </div>

                    <div className="bg-card border border-border rounded-xl divide-y divide-border">
                      {[
                        {
                          n: '1',
                          title: 'Browse the document categories',
                          detail: 'Each category contains a list of specific documents the buyer needs. Work through the Mandatory items first.',
                        },
                        {
                          n: '2',
                          title: 'Upload documents against each requirement',
                          detail: 'Click into a category and use the Add document button on each item. You can upload multiple files per requirement — add as many as needed before marking it complete.',
                        },
                        {
                          n: '3',
                          title: 'Mark each requirement as complete',
                          detail: "Once you've uploaded everything for a requirement, click Mark as complete. This notifies the buyer to review what you've submitted.",
                        },
                        {
                          n: '4',
                          title: 'Respond to any follow-up requests',
                          detail: 'The buyer may ask for additional documents on certain items. These will be clearly flagged so nothing gets missed.',
                        },
                      ].map(({ n, title, detail }) => (
                        <div key={n} className="flex items-start gap-4 p-4">
                          <span className="flex-shrink-0 h-8 w-8 rounded-full bg-indigo-600 text-white text-sm font-bold flex items-center justify-center">
                            {n}
                          </span>
                          <div>
                            <p className="font-semibold text-foreground text-sm">{title}</p>
                            <p className="text-muted-foreground text-sm mt-0.5">{detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <Button
                      size="lg"
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-base font-semibold py-4"
                      onClick={() => {
                        try { localStorage.setItem(`dd-intro-dismissed-${token}`, '1'); } catch {}
                        setShowDdIntro(false);
                      }}
                    >
                      Get started
                    </Button>

                    <p className="text-center text-xs text-muted-foreground">
                      You can revisit these instructions at any time using the <strong>How this works</strong> button inside the due diligence section.
                    </p>

                  </div>
                </div>
              ) : (
                <DdCollection
                  token={token}
                  onDocumentUploaded={() => {
                    queryClient.invalidateQueries({ queryKey: [`/api/v2/portal-submit/${token}`] });
                    queryClient.invalidateQueries({ queryKey: [`/api/v2/portal-submit/${token}/documents`] });
                    queryClient.invalidateQueries({ queryKey: [`/api/v2/portal-submit/${token}/analysis-completion`] });
                  }}
                />
              )}
            </TabsContent>
          )}

          <TabsContent value="deal-documents" className="space-y-6">
            {ndaDocument && ndaAccepted && (
              <Collapsible open={expandedDealDocs.has('nda')} onOpenChange={() => {
                toggleDealDoc('nda');
                if (!expandedDealDocs.has('nda')) {
                  loadNdaHtml(ndaDocument.id);
                }
              }}>
                <Card>
                  <CollapsibleTrigger className="w-full">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                            <Shield className="w-5 h-5 text-green-600 dark:text-green-400" />
                          </div>
                          <div className="text-left">
                            <h4 className="font-medium">Non-Disclosure Agreement</h4>
                            <p className="text-sm text-muted-foreground">
                              Signed {ndaDocument.respondedAt ? new Date(ndaDocument.respondedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">Accepted</Badge>
                          {expandedDealDocs.has('nda') ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                        </div>
                      </div>
                    </CardContent>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-4 pb-4 border-t">
                      <div className="pt-4 space-y-4">
                        {ndaHtmlLoading && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                            Loading document...
                          </div>
                        )}
                        {ndaHtml && (
                          <div className="p-4 bg-white text-gray-900 border rounded-lg max-h-96 overflow-y-auto text-sm prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: ndaHtml }} />
                        )}
                        {!ndaHtml && !ndaHtmlLoading && (
                          <p className="text-sm text-muted-foreground">NDA Version {ndaDocument.version} — signed and in effect.</p>
                        )}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            )}

            {offerDocuments.length > 0 && (() => {
              const latestOffer = offerDocuments[0];
              const latestOfferResolved = latestOffer.status === 'accepted' || latestOffer.status === 'rejected';
              
              if (latestOfferResolved) {
                return (
                  <Collapsible open={expandedDealDocs.has('offers')} onOpenChange={() => toggleDealDoc('offers')}>
                    <Card>
                      <CollapsibleTrigger className="w-full">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${latestOffer.status === 'accepted' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                                <FileText className={`w-5 h-5 ${latestOffer.status === 'accepted' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} />
                              </div>
                              <div className="text-left">
                                <h4 className="font-medium">Offer Letter</h4>
                                <p className="text-sm text-muted-foreground">
                                  {latestOffer.status === 'accepted' ? 'Accepted' : 'Rejected'} — Version {latestOffer.version}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge className={latestOffer.status === 'accepted' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}>
                                {latestOffer.status === 'accepted' ? 'Accepted' : 'Rejected'}
                              </Badge>
                              {expandedDealDocs.has('offers') ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                            </div>
                          </div>
                        </CardContent>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="border-t">
                          <OfferReview
                            token={token}
                            offers={offerDocuments}
                            onResponseSubmitted={() => refetchDealDocs()}
                          />
                        </div>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                );
              }
              
              return (
                <OfferReview
                  token={token}
                  offers={offerDocuments}
                  onResponseSubmitted={() => refetchDealDocs()}
                />
              );
            })()}

            {hotDocuments.length > 0 && (() => {
              const latestHot = hotDocuments[0];
              const latestHotResolved = latestHot.status === 'accepted' || latestHot.status === 'rejected';
              
              if (latestHotResolved) {
                return (
                  <Collapsible open={expandedDealDocs.has('hot')} onOpenChange={() => toggleDealDoc('hot')}>
                    <Card>
                      <CollapsibleTrigger className="w-full">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${latestHot.status === 'accepted' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                                <FileCheck className={`w-5 h-5 ${latestHot.status === 'accepted' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} />
                              </div>
                              <div className="text-left">
                                <h4 className="font-medium">Heads of Terms</h4>
                                <p className="text-sm text-muted-foreground">
                                  {latestHot.status === 'accepted' ? 'Accepted' : 'Rejected'} — Version {latestHot.version}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge className={latestHot.status === 'accepted' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}>
                                {latestHot.status === 'accepted' ? 'Accepted' : 'Rejected'}
                              </Badge>
                              {expandedDealDocs.has('hot') ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                            </div>
                          </div>
                        </CardContent>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="border-t">
                          <HoTReview
                            documents={hotDocuments}
                            token={token}
                            onResponseSubmitted={() => refetchDealDocs()}
                          />
                        </div>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                );
              }
              
              return (
                <HoTReview
                  documents={hotDocuments}
                  token={token}
                  onResponseSubmitted={() => refetchDealDocs()}
                />
              );
            })()}

            {!ndaDocument && offerDocuments.length === 0 && hotDocuments.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">No deal documents yet</p>
                  <p className="text-sm">Deal documents like offer letters and heads of terms will appear here.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Document Viewer */}
      <DocumentViewer
        document={viewingDocument}
        isOpen={showViewer}
        onClose={handleCloseViewer}
        onDownload={(docId, filename) => {
          const doc = viewingDocument;
          if (doc?.publicToken) {
            window.open(`/api/v2/public/documents/${doc.publicToken}/download`, '_blank');
          }
        }}
        publicFileBaseUrl="/api/v2/public/documents"
        hideAnalysis={true}
      />
    </div>
  );
}