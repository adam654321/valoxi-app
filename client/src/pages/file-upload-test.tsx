import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Send, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Clock, 
  FileText, 
  ExternalLink,
  Download,
  Users
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface FileUploadEvent {
  id: number;
  documentId: number;
  targetCompanyId: number;
  uploadedBy: number;
  fileName: string;
  fileUrl: string;
  webhookSent: boolean;
  webhookResponse: string | null;
  webhookStatus: string;
  webhookSentAt: string | null;
  uploadedAt: string;
  createdAt: string;
  // Related data
  targetCompanyName?: string;
  uploadedByName?: string;
}

interface DocumentAnalysisResult {
  id: number;
  documentId: number;
  fileUploadEventId: number;
  documentType: string;
  analysisData: any;
  processingTime?: number;
  createdAt: string;
}

export default function FileUploadTest() {
  const { toast } = useToast();
  const [expandedResponse, setExpandedResponse] = useState<number | null>(null);
  const [selectedDocumentAnalysis, setSelectedDocumentAnalysis] = useState<DocumentAnalysisResult[] | null>(null);

  // Fetch file upload events
  const { data: fileUploadEvents = [], isLoading: eventsLoading } = useQuery<FileUploadEvent[]>({
    queryKey: ["/api/file-upload-events"],
  });

  // Fetch analysis results for a specific document using v2 endpoint
  const fetchAnalysisResults = async (documentId: number): Promise<DocumentAnalysisResult[]> => {
    const response = await fetch(`/api/v2/document-analysis/document/${documentId}`, {
      credentials: 'include'
    });
    if (!response.ok) throw new Error("Failed to fetch analysis results");
    const data = await response.json();
    return data.data;
  };

  // Send webhook for file upload event
  const sendWebhookMutation = useMutation({
    mutationFn: async (eventId: number) => {
      const response = await apiRequest("POST", `/api/file-upload-events/${eventId}/send-webhook`);
      return response.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: "Webhook sent successfully",
        description: "Check the response in the table below"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/file-upload-events"] });
    },
    onError: (error: any) => {
      const errorMessage = error?.message || "Failed to send webhook";
      toast({ 
        title: "Webhook Failed", 
        description: errorMessage,
        variant: "destructive" 
      });
    },
  });

  // Test staff matrix webhook simulation
  const testStaffMatrixMutation = useMutation({
    mutationFn: async (eventId: number) => {
      const testData = {
        document_type: "staff_matrix",
        data: {
          total_employee_count: 5,
          total_annual_payroll: 140000,
          average_salary: 28000,
          employment_type_breakdown: {
            "Full-Time": 4,
            "Part-Time": 1
          },
          status_summary: {
            "Active": 4,
            "Maternity Leave": 1
          },
          longest_tenured_employees: "* Lisa Chow – Finance Assistant (start_date: 01/09/17; years_of_service: 7)\n* Alice Thompson – Operations Manager (start_date: 01/05/18; years_of_service: 7)\n* James Patel – Cleaning Supervisor (start_date: 15/11/19; years_of_service: 5)",
          observations: "* Majority of staff are active full-time employees.\n* Two employees have been with the company for over 7 years.\n* Only one employee is currently on maternity leave."
        },
        id: eventId
      };

      const response = await fetch(`/api/file-upload-events/${eventId}/webhook-response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([testData]),
      });
      if (!response.ok) throw new Error("Failed to simulate staff matrix webhook");
      return response.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: "Staff Matrix Analysis Added",
        description: "Test staff matrix analysis results have been stored successfully"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/file-upload-events"] });
    },
    onError: (error: any) => {
      const errorMessage = error?.message || "Failed to simulate staff matrix webhook";
      toast({ 
        title: "Simulation Failed", 
        description: errorMessage,
        variant: "destructive" 
      });
    },
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'success':
        return 'default' as const;
      case 'failed':
        return 'destructive' as const;
      case 'pending':
        return 'secondary' as const;
      default:
        return 'outline' as const;
    }
  };

  const toggleResponseExpansion = (eventId: number) => {
    setExpandedResponse(expandedResponse === eventId ? null : eventId);
  };

  const checkAnalysisResults = async (documentId: number) => {
    try {
      const results = await fetchAnalysisResults(documentId);
      setSelectedDocumentAnalysis(results);
      if (results.length === 0) {
        toast({
          title: "No Analysis Results",
          description: "No analysis results found for this document yet.",
          variant: "default"
        });
      } else {
        toast({
          title: "Analysis Results Found",
          description: `Found ${results.length} analysis result(s) for this document.`,
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch analysis results",
        variant: "destructive"
      });
    }
  };

  if (eventsLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="space-y-4">
          <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-gray-200 rounded animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            File Upload Webhook Test
          </h1>
          <p className="text-gray-600 mt-1" data-testid="text-page-description">
            Monitor file uploads and test webhook responses for target company documents
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/file-upload-events"] })}
          data-testid="button-refresh"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4">
        {fileUploadEvents.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No file uploads yet
              </h3>
              <p className="text-gray-500">
                Upload some documents to target companies to see them appear here for webhook testing.
              </p>
            </CardContent>
          </Card>
        ) : (
          fileUploadEvents.map((event) => (
            <Card key={event.id} className="border">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      <span data-testid={`text-filename-${event.id}`}>
                        {event.fileName}
                      </span>
                    </CardTitle>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                      <span data-testid={`text-company-${event.id}`}>
                        Company: {event.targetCompanyName || `ID ${event.targetCompanyId}`}
                      </span>
                      <span>•</span>
                      <span data-testid={`text-uploaded-by-${event.id}`}>
                        Uploaded by: {event.uploadedByName || `User ${event.uploadedBy}`}
                      </span>
                      <span>•</span>
                      <span data-testid={`text-uploaded-at-${event.id}`}>
                        {formatDate(event.uploadedAt)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getStatusBadgeVariant(event.webhookStatus)} className="flex items-center gap-1">
                      {getStatusIcon(event.webhookStatus)}
                      <span className="capitalize" data-testid={`badge-status-${event.id}`}>
                        {event.webhookStatus}
                      </span>
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <p className="text-sm text-gray-600 mb-1">File URL:</p>
                    <div className="flex items-center gap-2">
                      <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono flex-1 truncate"
                            data-testid={`text-file-url-${event.id}`}>
                        {event.fileUrl}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(event.fileUrl, '_blank')}
                        data-testid={`button-open-file-${event.id}`}
                      >
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {event.webhookSentAt && (
                      <div>
                        <p className="text-xs text-gray-500">Webhook sent at:</p>
                        <p className="text-sm font-medium" data-testid={`text-webhook-sent-at-${event.id}`}>
                          {formatDate(event.webhookSentAt)}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => checkAnalysisResults(event.documentId)}
                      data-testid={`button-view-analysis-${event.id}`}
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      View Analysis
                    </Button>
                    <Button
                      onClick={() => sendWebhookMutation.mutate(event.id)}
                      disabled={sendWebhookMutation.isPending}
                      data-testid={`button-send-webhook-${event.id}`}
                    >
                      <Send className="w-4 h-4 mr-2" />
                      {sendWebhookMutation.isPending ? "Sending..." : "Send Webhook"}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => testStaffMatrixMutation.mutate(event.id)}
                      disabled={testStaffMatrixMutation.isPending}
                      data-testid={`button-test-staff-matrix-${event.id}`}
                    >
                      <Users className="w-4 h-4 mr-2" />
                      {testStaffMatrixMutation.isPending ? "Adding..." : "Test Staff Matrix"}
                    </Button>
                  </div>
                </div>

                {event.webhookResponse && (
                  <>
                    <Separator />
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium">Webhook Response</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleResponseExpansion(event.id)}
                          data-testid={`button-toggle-response-${event.id}`}
                        >
                          {expandedResponse === event.id ? "Collapse" : "Expand"}
                        </Button>
                      </div>
                      <div className={`bg-gray-50 p-3 rounded-md ${expandedResponse === event.id ? '' : 'max-h-24 overflow-hidden'}`}>
                        <pre className="text-xs text-gray-700 whitespace-pre-wrap break-all"
                             data-testid={`text-webhook-response-${event.id}`}>
                          {event.webhookResponse}
                        </pre>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Document Analysis Results Section */}
      {selectedDocumentAnalysis && selectedDocumentAnalysis.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Document Analysis Results</h2>
            <Button 
              variant="outline" 
              onClick={() => setSelectedDocumentAnalysis(null)}
              data-testid="button-close-analysis"
            >
              Close
            </Button>
          </div>
          
          <div className="grid gap-4">
            {selectedDocumentAnalysis.map((result) => (
              <Card key={result.id} className="border">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Analysis Result #{result.id}
                  </CardTitle>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span data-testid={`text-doc-type-${result.id}`}>
                      Type: {result.documentType}
                    </span>
                    <span>•</span>
                    <span data-testid={`text-processed-at-${result.id}`}>
                      Processed: {formatDate(result.createdAt)}
                    </span>
                    {result.processingTime && (
                      <>
                        <span>•</span>
                        <span data-testid={`text-processing-time-${result.id}`}>
                          Processing time: {result.processingTime}ms
                        </span>
                      </>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium mb-2">Analysis Data</h4>
                      <div className="bg-gray-50 p-4 rounded-md">
                        <pre className="text-xs text-gray-700 whitespace-pre-wrap"
                             data-testid={`text-analysis-data-${result.id}`}>
                          {JSON.stringify(result.analysisData, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}