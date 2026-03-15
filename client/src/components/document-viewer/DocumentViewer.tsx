import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Download, 
  X, 
  ExternalLink,
  Eye,
  BarChart3
} from "lucide-react";
import { DocumentPreview } from "./DocumentPreview";
import { AnalysisDisplay, formatDate, formatDocumentType, getDocumentTypeColor } from "./AnalysisDisplay";
import type { Document, DocumentAnalysisResult, DocumentViewerProps } from "./types";

function enhanceDisplayData(analysisData: any, documentType: string) {
  if (documentType !== 'profit_and_loss') {
    return analysisData;
  }

  try {
    const enhanced = JSON.parse(JSON.stringify(analysisData));
    
    if (enhanced.years && typeof enhanced.years === 'object') {
      Object.keys(enhanced.years).forEach(year => {
        const yearData = enhanced.years[year];
        
        if (yearData.profit_and_loss) {
          const pl = yearData.profit_and_loss;
          
          if (!pl.gross_margin_percentage && pl.revenue && pl.gross_profit && pl.revenue > 0) {
            pl.gross_margin_percentage = Number(((pl.gross_profit / pl.revenue) * 100).toFixed(2));
          }
          
          if (!pl.net_margin_percentage && pl.revenue && pl.net_profit && pl.revenue > 0) {
            pl.net_margin_percentage = Number(((pl.net_profit / pl.revenue) * 100).toFixed(2));
          }
          
          if (!pl.interest_coverage_ratio && pl.operating_profit && pl.interest_payable && pl.interest_payable > 0) {
            pl.interest_coverage_ratio = Number((pl.operating_profit / pl.interest_payable).toFixed(2));
          }
        }
      });
    }
    
    if (enhanced.profit_and_loss && typeof enhanced.profit_and_loss === 'object') {
      const pl = enhanced.profit_and_loss;
      
      if (!pl.gross_margin_percentage && pl.revenue && pl.gross_profit && pl.revenue > 0) {
        pl.gross_margin_percentage = Number(((pl.gross_profit / pl.revenue) * 100).toFixed(2));
      }
      
      if (!pl.net_margin_percentage && pl.revenue && pl.net_profit && pl.revenue > 0) {
        pl.net_margin_percentage = Number(((pl.net_profit / pl.revenue) * 100).toFixed(2));
      }
      
      if (!pl.interest_coverage_ratio && pl.operating_profit && pl.interest_payable && pl.interest_payable > 0) {
        pl.interest_coverage_ratio = Number((pl.operating_profit / pl.interest_payable).toFixed(2));
      }
    }
    
    return enhanced;
    
  } catch (error) {
    console.error('Error enhancing display data:', error);
    return analysisData;
  }
}

function formatFileSize(bytes: number) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function DocumentViewer({ document, isOpen, onClose, onDownload, publicFileBaseUrl, hideAnalysis }: DocumentViewerProps) {
  const { toast } = useToast();
  const [isRetryingAnalysis, setIsRetryingAnalysis] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  const [featureGated, setFeatureGated] = useState(false);
  const [nonRetryableError, setNonRetryableError] = useState<string | null>(null);
  const MAX_POLL_COUNT = 24;
  
  // Check if document was uploaded recently (within 5 minutes)
  const isRecentUpload = document?.createdAt ? 
    (Date.now() - new Date(document.createdAt).getTime()) < 5 * 60 * 1000 : false;

  // Reset state when document changes
  useEffect(() => {
    setPollCount(0);
    setFeatureGated(false);
    setNonRetryableError(null);
  }, [document?.id]);

  const { data: analysisResults = [], isLoading: analysisLoading, error: analysisError } = useQuery<DocumentAnalysisResult[]>({
    queryKey: ["/api/v2/document-analysis/document", document?.id],
    enabled: !!document?.id && isOpen && !featureGated,
    staleTime: 0,
    retry: (failureCount, error: any) => {
      const status = error?.status || error?.response?.status;
      if (status === 403 || status === 404) return false;
      return failureCount < 2;
    },
    select: (response: any) => response.data,
    refetchInterval: (query) => {
      if (featureGated || nonRetryableError) return false;
      if (pollCount >= MAX_POLL_COUNT) return false;
      const hasResults = query.state.data && query.state.data.length > 0;
      if (hasResults) return false;
      const hasError = query.state.error;
      if (hasError) {
        const status = (hasError as any)?.status || (hasError as any)?.response?.status;
        if (status === 403 || status === 404 || status === 500) return false;
      }
      return isRecentUpload ? 5000 : false;
    },
  });

  useEffect(() => {
    if (analysisError) {
      const status = (analysisError as any)?.status || (analysisError as any)?.response?.status;
      if (status === 403) {
        setFeatureGated(true);
        return;
      }
      if (status === 404 || status === 500) {
        setNonRetryableError(status === 404 ? 'Document not found' : 'Server error — please try again later');
        return;
      }
    }
  }, [analysisError]);

  useEffect(() => {
    if (isRecentUpload && analysisResults.length === 0 && !featureGated && !nonRetryableError) {
      setPollCount(prev => prev + 1);
    }
  }, [analysisResults, analysisLoading]);

  useEffect(() => {
    if (document?.id && isOpen) {
      console.log(`[DocumentViewer] Analysis query for document ${document.id}:`, {
        results: analysisResults,
        loading: analysisLoading,
        error: analysisError,
        length: analysisResults?.length,
        pollCount,
        featureGated,
      });
    }
  }, [document?.id, isOpen, analysisResults, analysisLoading, analysisError, pollCount, featureGated]);

  if (!document) return null;

  const isPDF = document.fileType === 'application/pdf';
  const isImage = document.fileType.startsWith('image/');
  const isText = document.fileType === 'text/plain';
  const isViewable = isPDF || isImage || isText;

  const viewerUrl = `/api/v2/files/${document.id}/view`;

  const openInNewTab = () => {
    window.open(viewerUrl, '_blank');
  };

  const handleRetryWebhook = async () => {
    if (!document?.id || isRetryingAnalysis) return;
    
    setIsRetryingAnalysis(true);
    toast({
      title: "Analysis Started",
      description: "Document analysis is running. This may take 30-60 seconds...",
    });
    
    try {
      const response = await apiRequest('POST', `/api/v2/document-analysis/document/${document.id}/retry`);
      
      if (response.ok) {
        toast({
          title: "Analysis Queued",
          description: "Document analysis has been queued. Results will appear automatically.",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/v2/document-analysis/document", document.id] });
      } else {
        throw new Error('Failed to trigger analysis');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to retrigger analysis. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRetryingAnalysis(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-lg">{document.documentName}</DialogTitle>
              <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                <span>{document.originalFilename}</span>
                <span>•</span>
                <span>{formatFileSize(document.fileSize)}</span>
                <span>•</span>
                <Badge variant="secondary" className="text-xs">
                  {document.documentCategory}
                </Badge>
                {document.isConfidential && (
                  <Badge variant="destructive" className="text-xs">
                    Confidential
                  </Badge>
                )}
              </div>
              {document.description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {document.description}
                </p>
              )}
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                <span>Uploaded by {document.uploadedByName}</span>
                <span>•</span>
                <span>{formatDate(document.uploadDate)}</span>
                <span>•</span>
                <span>{document.accessCount} views</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDownload(document.id, document.originalFilename)}
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
              {isViewable && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openInNewTab}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open in New Tab
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue={hideAnalysis ? "document" : "analysis"} className="h-full flex flex-col">
            <TabsList className={`grid w-full ${hideAnalysis ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {!hideAnalysis && (
                <TabsTrigger value="analysis" className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Analysis
                  {analysisResults.length > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs">
                      {analysisResults.length}
                    </Badge>
                  )}
                </TabsTrigger>
              )}
              <TabsTrigger value="document" className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Document
              </TabsTrigger>
            </TabsList>

            {!hideAnalysis && (
              <TabsContent value="analysis" className="flex-1 overflow-auto p-4">
                <AnalysisDisplay 
                  results={analysisResults}
                  isLoading={analysisLoading && !featureGated}
                  isRetryingAnalysis={isRetryingAnalysis}
                  onRetryAnalysis={handleRetryWebhook}
                  documentUploadedAt={document.createdAt}
                  isPendingAnalysis={isRecentUpload && analysisResults.length === 0 && !featureGated && !nonRetryableError && pollCount < MAX_POLL_COUNT}
                  featureGated={featureGated}
                  nonRetryableError={nonRetryableError}
                  pollExhausted={pollCount >= MAX_POLL_COUNT && analysisResults.length === 0}
                />
              </TabsContent>
            )}

            <TabsContent value="document" className="flex-1 overflow-hidden">
              <DocumentPreview document={document} onDownload={onDownload} publicFileBaseUrl={publicFileBaseUrl} />
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
