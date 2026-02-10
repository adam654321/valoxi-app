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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { 
  Download, 
  X, 
  ExternalLink,
  Eye,
  BarChart3,
  Clock,
  Code
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

export function DocumentViewer({ document, isOpen, onClose, onDownload, publicFileBaseUrl }: DocumentViewerProps) {
  const { toast } = useToast();
  const [isRetryingAnalysis, setIsRetryingAnalysis] = useState(false);
  
  // Check if document was uploaded recently (within 5 minutes)
  const isRecentUpload = document?.createdAt ? 
    (Date.now() - new Date(document.createdAt).getTime()) < 5 * 60 * 1000 : false;

  const { data: analysisResults = [], isLoading: analysisLoading, error: analysisError } = useQuery<DocumentAnalysisResult[]>({
    queryKey: ["/api/v2/document-analysis/document", document?.id],
    enabled: !!document?.id && isOpen,
    staleTime: 0,
    retry: 3,
    select: (response: any) => response.data,
    // Auto-refresh every 5 seconds if document is recent and no results yet
    refetchInterval: (query) => {
      const hasResults = query.state.data && query.state.data.length > 0;
      return isRecentUpload && !hasResults ? 5000 : false;
    },
  });

  useEffect(() => {
    if (document?.id && isOpen) {
      console.log(`[DocumentViewer] Analysis query for document ${document.id}:`, {
        results: analysisResults,
        loading: analysisLoading,
        error: analysisError,
        length: analysisResults?.length
      });
    }
  }, [document?.id, isOpen, analysisResults, analysisLoading, analysisError]);

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
      const response = await fetch(`/api/documents/${document.id}/retry-analysis-webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      
      if (response.ok) {
        toast({
          title: "Analysis Complete",
          description: "Document analysis finished successfully.",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/v2/document-analysis/document", document.id] });
      } else {
        throw new Error('Failed to trigger analysis webhook');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to analyze document. Please try again.",
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
          <Tabs defaultValue="document" className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="document" className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Document
              </TabsTrigger>
              <TabsTrigger value="analysis" className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Analysis
                {analysisResults.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {analysisResults.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="webhook-json" className="flex items-center gap-2">
                <Code className="w-4 h-4" />
                Webhook JSON
                {analysisResults.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {analysisResults.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="document" className="flex-1 overflow-hidden">
              <DocumentPreview document={document} onDownload={onDownload} publicFileBaseUrl={publicFileBaseUrl} />
            </TabsContent>
            
            <TabsContent value="analysis" className="flex-1 overflow-auto p-4">
              <AnalysisDisplay 
                results={analysisResults}
                isLoading={analysisLoading}
                isRetryingAnalysis={isRetryingAnalysis}
                onRetryAnalysis={handleRetryWebhook}
                documentUploadedAt={document.createdAt}
                isPendingAnalysis={isRecentUpload && analysisResults.length === 0}
              />
            </TabsContent>
            
            <TabsContent value="webhook-json" className="flex-1 overflow-auto p-4">
              {analysisLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Clock className="w-8 h-8 mx-auto mb-2 animate-spin" />
                    <p className="text-muted-foreground">Loading analysis results...</p>
                  </div>
                </div>
              ) : analysisResults.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Code className="w-5 h-5" />
                    <h3 className="text-lg font-semibold">Webhook JSON Data</h3>
                    <Badge variant="outline" className="text-xs">
                      Raw analysis data sent to external webhook
                    </Badge>
                  </div>
                  
                  {analysisResults.map((result, index) => (
                    <Card key={result.id}>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Badge 
                            className={getDocumentTypeColor(result.documentType, result.analysisData)}
                          >
                            {formatDocumentType(result.documentType, result.analysisData)}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            Document Analysis #{index + 1}
                          </span>
                        </CardTitle>
                        <CardDescription>
                          Raw JSON data that would be sent to the analysis webhook for this document
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 overflow-auto max-h-96">
                          <pre className="text-sm whitespace-pre-wrap break-words">
                            <code>
                              {JSON.stringify(enhanceDisplayData(result.analysisData, result.documentType), null, 2)}
                            </code>
                          </pre>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>Document Type: {result.documentType}</span>
                          <span>•</span>
                          <span>Created: {formatDate(result.createdAt)}</span>
                          {result.processingTime && (
                            <>
                              <span>•</span>
                              <span>Processing Time: {result.processingTime}ms</span>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                  <Code className="w-16 h-16 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Analysis Data</h3>
                  <p className="text-muted-foreground">
                    No webhook analysis data is available for this document yet.
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
