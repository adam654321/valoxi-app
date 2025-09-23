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
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { 
  Download, 
  X, 
  FileText,
  Image as ImageIcon,
  AlertCircle,
  ExternalLink,
  Eye,
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Clock,
  Plus,
  Calendar,
  List,
  Code
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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

interface DocumentAnalysisResult {
  id: number;
  documentId: number;
  fileUploadEventId: number;
  documentType: string;
  analysisData: any;
  processingTime?: number;
  createdAt: string;
}

interface DocumentViewerProps {
  document: Document | null;
  isOpen: boolean;
  onClose: () => void;
  onDownload: (documentId: number, filename: string) => void;
}

export function DocumentViewer({ document, isOpen, onClose, onDownload }: DocumentViewerProps) {
  const { toast } = useToast();
  const [viewerError, setViewerError] = useState(false);
  const [pdfLoadAttempted, setPdfLoadAttempted] = useState(false);

  // Fetch document analysis results
  const { data: analysisResults = [], isLoading: analysisLoading, error: analysisError } = useQuery<DocumentAnalysisResult[]>({
    queryKey: ["/api/documents", document?.id, "analysis"],
    enabled: !!document?.id && isOpen,
    staleTime: 0, // Always refetch to get latest analysis
    retry: 3,
  });

  // Debug logging for analysis results
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

  // Reset states when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setViewerError(false);
      setPdfLoadAttempted(false);
    }
  }, [isOpen]);

  if (!document) return null;

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

  // Helper function to process text with escaped newlines and markdown
  const processObservationsText = (text: string) => {
    return text
      .replace(/\\n/g, '\n') // Convert literal \n to actual newlines
      .replace(/\n\*/g, '\n• ') // Convert bullet points to better formatting
      .replace(/^\*/g, '• '); // Convert first bullet point
  };

  // Format document type for display
  const formatDocumentType = (documentType: string, analysisData?: any) => {
    // Special case for company_accounts - check if analysisData has "document": "company_accounts"
    if (analysisData && analysisData.document === 'company_accounts') {
      return 'Company Accounts';
    }
    
    const typeMap: Record<string, string> = {
      'sales_ledger': 'Sales Ledger',
      'staff_matrix': 'Staff Matrix',
      'asset_register': 'Asset Register',
      'profit_and_loss': 'Profit & Loss',
      'balance_sheet': 'Balance Sheet'
    };
    return typeMap[documentType] || documentType;
  };

  // Get document type color
  const getDocumentTypeColor = (documentType: string, analysisData?: any) => {
    // Special case for company_accounts - check if analysisData has "document": "company_accounts"
    if (analysisData && analysisData.document === 'company_accounts') {
      return 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200';
    }
    
    const colorMap: Record<string, string> = {
      'sales_ledger': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'staff_matrix': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'asset_register': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      'profit_and_loss': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
      'balance_sheet': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
    };
    return colorMap[documentType] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
  };

  // Get invoice status background color
  const getInvoiceStatusColor = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower === 'paid') {
      return 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800';
    } else if (statusLower === 'part paid') {
      return 'bg-orange-50 border-orange-200 dark:bg-orange-950 dark:border-orange-800';
    } else if (statusLower === 'unpaid') {
      return 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800';
    }
    return 'bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700';
  };

  const isPDF = document.fileType === 'application/pdf';
  const isImage = document.fileType.startsWith('image/');
  const isText = document.fileType === 'text/plain';
  const isViewable = isPDF || isImage || isText;

  const viewerUrl = `/api/documents/${document.id}/view`;
  const downloadUrl = `/api/documents/${document.id}/download`;

  const handleViewerLoad = () => {
    setViewerError(false);
  };

  const handleViewerError = () => {
    setViewerError(true);
    toast({
      title: "Viewer Error",
      description: "Unable to display this document. You can still download it.",
      variant: "destructive",
    });
  };

  const openInNewTab = () => {
    window.open(viewerUrl, '_blank');
  };

  // Render staff matrix analysis
  const renderStaffMatrixAnalysis = (analysisData: any) => {
    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="w-4 h-4" />
                Total Employees
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analysisData.total_employee_count}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Annual Payroll
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">£{analysisData.total_annual_payroll?.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                Average Salary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">£{analysisData.average_salary?.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-green-600" />
                Active Staff
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {analysisData.status_summary?.Active || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Employment Type Breakdown */}
        {analysisData.employment_type_breakdown && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Employment Type Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(analysisData.employment_type_breakdown).map(([type, count]: [string, any]) => (
                  <div key={type} className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-semibold">{count}</div>
                    <div className="text-sm text-muted-foreground">{type}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Status Summary */}
        {analysisData.status_summary && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Employee Status Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                {Object.entries(analysisData.status_summary).map(([status, count]: [string, any]) => (
                  <div key={status} className="text-center p-4 border rounded-lg">
                    <div className="text-lg font-semibold">{count}</div>
                    <div className="text-sm text-muted-foreground">{status}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Longest Tenured Employees */}
        {analysisData.longest_tenured_employees && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Longest Tenured Employees
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-line text-sm font-mono bg-muted p-4 rounded-md">
                {analysisData.longest_tenured_employees}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Observations */}
        {analysisData.observations && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Key Observations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-line text-sm">{analysisData.observations}</div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  // Render sales ledger analysis
  const renderSalesLedgerAnalysis = (analysisData: any) => {
    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Total Invoices
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analysisData.total_invoice_count}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Total Value
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">£{analysisData.total_invoice_value?.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
                Amount Paid
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">£{analysisData.total_amount_paid?.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600" />
                Outstanding
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">£{analysisData.total_outstanding?.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>

        {/* Invoice Status Summary */}
        {analysisData.invoice_status_summary && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Invoice Status Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                {Object.entries(analysisData.invoice_status_summary).map(([status, data]: [string, any]) => (
                  <div key={status} className={`text-center p-4 border rounded-lg ${getInvoiceStatusColor(status)}`}>
                    <div className="text-lg font-semibold">{data.count}</div>
                    <div className="text-sm text-muted-foreground">{status}</div>
                    <div className="text-sm font-medium">£{data.value?.toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Customer Exposure */}
        {analysisData.customer_exposure && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Customer Exposure Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Customer</th>
                      <th className="text-right py-2">Total Invoiced</th>
                      <th className="text-right py-2">Total Paid</th>
                      <th className="text-right py-2">Outstanding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysisData.customer_exposure.map((customer: any, index: number) => (
                      <tr key={index} className="border-b">
                        <td className="py-2 font-medium">{customer.customer_name}</td>
                        <td className="text-right py-2">£{customer.total_invoiced?.toLocaleString()}</td>
                        <td className="text-right py-2 text-green-600">£{customer.total_paid?.toLocaleString()}</td>
                        <td className={`text-right py-2 font-medium ${customer.total_outstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          £{customer.total_outstanding?.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Observations */}
        {analysisData.observations && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Key Observations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-line text-sm">{processObservationsText(analysisData.observations)}</div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  // Render profit & loss analysis
  const renderProfitAndLossAnalysis = (analysisData: any) => {
    return (
      <div className="space-y-6">
        {/* Years Covered */}
        {analysisData.years_covered && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Years Covered
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-line text-sm font-mono bg-muted p-4 rounded-md">
                {analysisData.years_covered}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Year-by-Year Analysis */}
        {analysisData.years && (
          <div className="space-y-6">
            {Object.entries(analysisData.years).map(([year, yearData]: [string, any]) => (
              <Card key={year}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    {year} Financial Performance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">Revenue</div>
                      <div className="text-xl font-bold text-blue-600">
                        £{yearData.profit_and_loss?.revenue?.toLocaleString() || 0}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">Gross Profit</div>
                      <div className="text-xl font-bold text-green-600">
                        £{yearData.profit_and_loss?.gross_profit?.toLocaleString() || 0}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">Operating Profit</div>
                      <div className="text-xl font-bold text-orange-600">
                        £{yearData.profit_and_loss?.operating_profit?.toLocaleString() || 0}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">Profit Before Tax</div>
                      <div className="text-xl font-bold text-purple-600">
                        £{yearData.profit_and_loss?.profit_before_tax?.toLocaleString() || 0}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">Net Profit</div>
                      <div className={`text-xl font-bold ${(yearData.profit_and_loss?.net_profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        £{yearData.profit_and_loss?.net_profit?.toLocaleString() || 0}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">Tax</div>
                      <div className="text-xl font-bold text-gray-600">
                        £{yearData.profit_and_loss?.tax?.toLocaleString() || 0}
                      </div>
                    </div>
                  </div>

                  {/* Additional Financial Details */}
                  <div className="mt-4 pt-4 border-t">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="space-y-1">
                        <div className="text-muted-foreground">Cost of Sales</div>
                        <div className="font-medium">£{yearData.profit_and_loss?.cost_of_sales?.toLocaleString() || 0}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-muted-foreground">Admin Expenses</div>
                        <div className="font-medium">£{yearData.profit_and_loss?.administrative_expenses?.toLocaleString() || 0}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-muted-foreground">Other Operating Income</div>
                        <div className="font-medium">£{yearData.profit_and_loss?.other_operating_income?.toLocaleString() || 0}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-muted-foreground">Interest (Net)</div>
                        <div className="font-medium">
                          £{((yearData.profit_and_loss?.interest_receivable || 0) - (yearData.profit_and_loss?.interest_payable || 0)).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Key Financial Ratios */}
        {analysisData.years && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Key Financial Ratios
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {Object.entries(analysisData.years).map(([year, yearData]: [string, any]) => (
                  <div key={year} className="space-y-4">
                    <h4 className="text-lg font-semibold text-muted-foreground">{year}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Gross Margin Percentage */}
                      <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div className="text-sm text-blue-700 dark:text-blue-300 font-medium">Gross Margin %</div>
                        <div className="text-2xl font-bold text-blue-800 dark:text-blue-200">
                          {yearData.profit_and_loss?.revenue && yearData.profit_and_loss?.gross_profit
                            ? ((yearData.profit_and_loss.gross_profit / yearData.profit_and_loss.revenue) * 100).toFixed(1)
                            : 'N/A'
                          }%
                        </div>
                        <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                          (Gross Profit ÷ Revenue) × 100
                        </div>
                      </div>

                      {/* Net Margin Percentage */}
                      <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg border border-green-200 dark:border-green-800">
                        <div className="text-sm text-green-700 dark:text-green-300 font-medium">Net Margin %</div>
                        <div className="text-2xl font-bold text-green-800 dark:text-green-200">
                          {yearData.profit_and_loss?.revenue && yearData.profit_and_loss?.net_profit
                            ? ((yearData.profit_and_loss.net_profit / yearData.profit_and_loss.revenue) * 100).toFixed(1)
                            : 'N/A'
                          }%
                        </div>
                        <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                          (Net Profit ÷ Revenue) × 100
                        </div>
                      </div>

                      {/* Interest Coverage Ratio */}
                      <div className="bg-purple-50 dark:bg-purple-950 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                        <div className="text-sm text-purple-700 dark:text-purple-300 font-medium">Interest Coverage</div>
                        <div className="text-2xl font-bold text-purple-800 dark:text-purple-200">
                          {yearData.profit_and_loss?.operating_profit && yearData.profit_and_loss?.interest_payable
                            ? (yearData.profit_and_loss.operating_profit / yearData.profit_and_loss.interest_payable).toFixed(1)
                            : 'N/A'
                          }x
                        </div>
                        <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                          Operating Profit ÷ Interest Payable
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Insights */}
        {analysisData.summary && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Summary Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {analysisData.summary}
                </ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  // Render asset register analysis
  const renderAssetRegisterAnalysis = (analysisData: any) => {
    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Total Assets Cost
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                £{analysisData.total_assets_cost?.toLocaleString() || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingDown className="w-4 h-4" />
                Accumulated Depreciation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                £{analysisData.total_accumulated_depreciation?.toLocaleString() || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Net Book Value
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                £{analysisData.total_net_book_value?.toLocaleString() || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Asset Breakdown */}
        {analysisData.asset_breakdown && analysisData.asset_breakdown.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Asset Category Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analysisData.asset_breakdown.map((asset: any, index: number) => (
                  <div key={index} className="border rounded-lg p-4">
                    <h4 className="font-semibold text-lg mb-3">{asset.category}</h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center">
                        <div className="text-sm text-muted-foreground">Cost</div>
                        <div className="text-lg font-semibold text-blue-600">
                          £{asset.cost?.toLocaleString() || 0}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm text-muted-foreground">Depreciation</div>
                        <div className="text-lg font-semibold text-red-600">
                          £{asset.accumulated_depreciation?.toLocaleString() || 0}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm text-muted-foreground">Net Book Value</div>
                        <div className="text-lg font-semibold text-green-600">
                          £{asset.net_book_value?.toLocaleString() || 0}
                        </div>
                      </div>
                    </div>
                    
                    {/* Depreciation Rate */}
                    {asset.cost > 0 && (
                      <div className="mt-3 text-center">
                        <div className="text-sm text-muted-foreground">Depreciation Rate</div>
                        <div className="text-sm font-medium">
                          {((asset.accumulated_depreciation / asset.cost) * 100).toFixed(1)}%
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Additions */}
        {analysisData.recent_additions_summary && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Recent Additions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-line text-sm font-mono bg-muted p-4 rounded-md">
                {analysisData.recent_additions_summary}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Depreciation This Year */}
        {analysisData.depreciation_this_year && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Depreciation This Year
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                £{analysisData.depreciation_this_year?.toLocaleString() || 0}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Asset Breakdown List */}
        {analysisData.asset_breakdown_list && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <List className="w-5 h-5" />
                Asset Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-line text-sm font-mono bg-muted p-4 rounded-md">
                {analysisData.asset_breakdown_list}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Observations */}
        {analysisData.observations && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Key Observations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-line text-sm">{analysisData.observations}</div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  // Render company accounts analysis
  const renderCompanyAccountsAnalysis = (analysisData: any) => {
    // Extract the nested data from the company_accounts structure
    const accountsData = analysisData.data;
    
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 mb-6">
          <div className="bg-teal-100 dark:bg-teal-900 px-4 py-2 rounded-full">
            <span className="text-teal-800 dark:text-teal-200 font-semibold text-base">Company Accounts</span>
          </div>
          <span className="text-muted-foreground text-sm">Financial Records Analysis</span>
        </div>

        {/* Detect nested document type and render accordingly */}
        {accountsData.document_type === 'sales_ledger' && renderSalesLedgerAnalysis(accountsData.data)}
        {accountsData.document_type === 'staff_matrix' && renderStaffMatrixAnalysis(accountsData.data)}
        {accountsData.document_type === 'asset_register' && renderAssetRegisterAnalysis(accountsData.data)}
        {accountsData.document_type === 'profit_and_loss' && renderProfitAndLossAnalysis(accountsData.data)}
        {accountsData.document_type === 'balance_sheet' && renderBalanceSheetAnalysis(accountsData.data)}
        
        {/* If no specific document type is matched, show raw data */}
        {!['sales_ledger', 'staff_matrix', 'asset_register', 'profit_and_loss', 'balance_sheet'].includes(accountsData.document_type) && (
          <Card>
            <CardHeader>
              <CardTitle>Company Accounts Data</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs bg-muted p-4 rounded-md overflow-auto">
                {JSON.stringify(accountsData, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  // Render balance sheet analysis
  const renderBalanceSheetAnalysis = (analysisData: any) => {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 mb-6">
          <div className="bg-orange-100 dark:bg-orange-900 px-4 py-2 rounded-full">
            <span className="text-orange-800 dark:text-orange-200 font-semibold text-base">Balance Sheet</span>
          </div>
          <span className="text-muted-foreground text-sm">Financial Position Analysis</span>
        </div>

        {/* Years Covered */}
        {analysisData.years_covered && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Years Covered
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {analysisData.years_covered}
                </ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Balance Sheet Data */}
        {analysisData.years && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Balance Sheet Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-12">
                {Object.entries(analysisData.years).map(([year, yearData]: [string, any]) => (
                  <div key={year} className="space-y-4">
                    <h3 className="text-xl font-bold text-orange-600 dark:text-orange-400 border-b border-orange-200 dark:border-orange-800 pb-2">
                      {year}
                    </h3>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Assets Section */}
                      <div className="space-y-4">
                        <h4 className="text-lg font-semibold text-green-700 dark:text-green-300">Assets</h4>
                        
                        {/* Fixed Assets */}
                        <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg">
                          <div className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">Fixed Assets</div>
                          <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                            £{yearData.balance_sheet?.fixed_assets?.toLocaleString() || 'N/A'}
                          </div>
                        </div>

                        {/* Current Assets Breakdown */}
                        <div className="space-y-2">
                          <div className="text-sm font-medium text-green-800 dark:text-green-200">Current Assets</div>
                          <div className="grid grid-cols-1 gap-2">
                            <div className="flex justify-between items-center bg-green-25 p-2 rounded">
                              <span className="text-sm">Debtors</span>
                              <span className="font-medium">£{yearData.balance_sheet?.debtors?.toLocaleString() || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between items-center bg-green-25 p-2 rounded">
                              <span className="text-sm">Cash at Bank</span>
                              <span className="font-medium">£{yearData.balance_sheet?.cash_at_bank?.toLocaleString() || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between items-center bg-green-100 dark:bg-green-900 p-2 rounded border-t border-green-200 dark:border-green-800">
                              <span className="text-sm font-medium">Total Current Assets</span>
                              <span className="font-bold">£{yearData.balance_sheet?.total_current_assets?.toLocaleString() || 'N/A'}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Liabilities & Equity Section */}
                      <div className="space-y-4">
                        <h4 className="text-lg font-semibold text-red-700 dark:text-red-300">Liabilities & Equity</h4>
                        
                        {/* Current Liabilities */}
                        <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg">
                          <div className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">Creditors (Within One Year)</div>
                          <div className="text-2xl font-bold text-red-900 dark:text-red-100">
                            £{yearData.balance_sheet?.creditors_within_one_year?.toLocaleString() || 'N/A'}
                          </div>
                        </div>

                        {/* Long-term Liabilities */}
                        <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg">
                          <div className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">Creditors (After One Year)</div>
                          <div className="text-2xl font-bold text-red-900 dark:text-red-100">
                            £{yearData.balance_sheet?.creditors_after_one_year?.toLocaleString() || 'N/A'}
                          </div>
                        </div>

                        {/* Equity Breakdown */}
                        <div className="space-y-2">
                          <div className="text-sm font-medium text-blue-800 dark:text-blue-200">Shareholders' Equity</div>
                          <div className="grid grid-cols-1 gap-2">
                            <div className="flex justify-between items-center bg-blue-25 p-2 rounded">
                              <span className="text-sm">Share Capital</span>
                              <span className="font-medium">£{yearData.balance_sheet?.called_up_share_capital?.toLocaleString() || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between items-center bg-blue-25 p-2 rounded">
                              <span className="text-sm">P&L Reserve</span>
                              <span className="font-medium">£{yearData.balance_sheet?.profit_and_loss_reserve?.toLocaleString() || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between items-center bg-blue-100 dark:bg-blue-900 p-2 rounded border-t border-blue-200 dark:border-blue-800">
                              <span className="text-sm font-medium">Net Assets</span>
                              <span className="font-bold">£{yearData.balance_sheet?.net_assets?.toLocaleString() || 'N/A'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Key Metrics Row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                      <div className="bg-purple-50 dark:bg-purple-950 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                        <div className="text-sm text-purple-700 dark:text-purple-300 font-medium">Net Current Assets</div>
                        <div className="text-xl font-bold text-purple-800 dark:text-purple-200">
                          £{yearData.balance_sheet?.net_current_assets?.toLocaleString() || 'N/A'}
                        </div>
                      </div>
                      <div className="bg-indigo-50 dark:bg-indigo-950 p-4 rounded-lg border border-indigo-200 dark:border-indigo-800">
                        <div className="text-sm text-indigo-700 dark:text-indigo-300 font-medium">Total Assets Less Current Liabilities</div>
                        <div className="text-xl font-bold text-indigo-800 dark:text-indigo-200">
                          £{yearData.balance_sheet?.total_assets_less_current_liabilities?.toLocaleString() || 'N/A'}
                        </div>
                      </div>
                      <div className="bg-orange-50 dark:bg-orange-950 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
                        <div className="text-sm text-orange-700 dark:text-orange-300 font-medium">Current Ratio</div>
                        <div className="text-xl font-bold text-orange-800 dark:text-orange-200">
                          {yearData.balance_sheet?.total_current_assets && yearData.balance_sheet?.creditors_within_one_year
                            ? (yearData.balance_sheet.total_current_assets / yearData.balance_sheet.creditors_within_one_year).toFixed(2)
                            : 'N/A'
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Insights */}
        {analysisData.summary && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Summary Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {analysisData.summary}
                </ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  // Manual file upload analysis webhook retry for documents with missing analysis
  const handleRetryWebhook = async () => {
    if (!document?.id) return;
    
    try {
      const response = await fetch(`/api/documents/${document.id}/retry-analysis-webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        toast({
          title: "Analysis Webhook Triggered",
          description: "File upload analysis webhook has been sent. Results should appear shortly.",
        });
        // Refetch analysis results
        queryClient.invalidateQueries({ queryKey: ["/api/documents", document.id, "analysis"] });
      } else {
        throw new Error('Failed to trigger analysis webhook');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to trigger file upload analysis webhook. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Render analysis results based on document type
  const renderAnalysisResults = (results: DocumentAnalysisResult[]) => {
    if (results.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No analysis results available for this document yet.</p>
          <p className="text-sm mt-2">Analysis results will appear here after processing.</p>
          <div className="mt-4">
            <Button 
              onClick={handleRetryWebhook}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <TrendingUp className="w-4 h-4" />
              Retry Analysis
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {results.map((result) => (
          <div key={result.id}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">Document Analysis</h3>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span>Type:</span>
                    <span className={`px-3 py-1 rounded-md text-sm font-medium ${getDocumentTypeColor(result.documentType, result.analysisData)}`}>
                      {formatDocumentType(result.documentType, result.analysisData)}
                    </span>
                  </div>
                  <span>•</span>
                  <span>Processed: {formatDate(result.createdAt)}</span>
                  {result.processingTime && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {(result.processingTime / 1000).toFixed(1)}s
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            {/* Special case for company_accounts documents */}
            {result.analysisData && result.analysisData.document === 'company_accounts' && renderCompanyAccountsAnalysis(result.analysisData)}
            
            {/* Standard document types */}
            {(!result.analysisData || result.analysisData.document !== 'company_accounts') && result.documentType === 'sales_ledger' && renderSalesLedgerAnalysis(result.analysisData)}
            {(!result.analysisData || result.analysisData.document !== 'company_accounts') && result.documentType === 'staff_matrix' && renderStaffMatrixAnalysis(result.analysisData)}
            {(!result.analysisData || result.analysisData.document !== 'company_accounts') && result.documentType === 'asset_register' && renderAssetRegisterAnalysis(result.analysisData)}
            {(!result.analysisData || result.analysisData.document !== 'company_accounts') && result.documentType === 'profit_and_loss' && renderProfitAndLossAnalysis(result.analysisData)}
            {(!result.analysisData || result.analysisData.document !== 'company_accounts') && result.documentType === 'balance_sheet' && renderBalanceSheetAnalysis(result.analysisData)}
            
            {(!result.analysisData || result.analysisData.document !== 'company_accounts') && !['sales_ledger', 'staff_matrix', 'asset_register', 'profit_and_loss', 'balance_sheet'].includes(result.documentType) && (
              <Card>
                <CardHeader>
                  <CardTitle>Analysis Data</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs bg-muted p-4 rounded-md overflow-auto">
                    {JSON.stringify(result.analysisData, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}
          </div>
        ))}
      </div>
    );
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
              {!isViewable ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                  <FileText className="w-16 h-16 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">Preview Not Available</h3>
                  <p className="text-muted-foreground mb-4">
                    This file type cannot be previewed in the browser.
                  </p>
                  <p className="text-sm text-muted-foreground mb-6">
                    File type: {document.fileType}
                  </p>
                  <Button
                    onClick={() => onDownload(document.id, document.originalFilename)}
                  >
                <Download className="w-4 h-4 mr-2" />
                Download to View
              </Button>
            </div>
          ) : viewerError ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <AlertCircle className="w-16 h-16 text-destructive mb-4" />
              <h3 className="text-lg font-medium mb-2">Unable to Load Document</h3>
              <p className="text-muted-foreground mb-6">
                There was an error loading the document preview.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setViewerError(false)}
                >
                  Try Again
                </Button>
                <Button
                  onClick={() => onDownload(document.id, document.originalFilename)}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Instead
                </Button>
              </div>
            </div>
          ) : isImage ? (
            <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900 rounded-lg">
              <img
                src={viewerUrl}
                alt={document.documentName}
                className="max-w-full max-h-full object-contain"
                onLoad={handleViewerLoad}
                onError={handleViewerError}
              />
            </div>
          ) : isPDF ? (
            <div className="h-full w-full rounded-lg overflow-hidden">
              {!pdfLoadAttempted ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                  <FileText className="w-16 h-16 text-blue-500 mb-4" />
                  <h3 className="text-lg font-medium mb-2">PDF Document Ready</h3>
                  <p className="text-muted-foreground mb-6">
                    This PDF document is ready to view. Choose your preferred viewing method below.
                  </p>
                  <div className="flex flex-col gap-3 w-full max-w-sm">
                    <Button
                      onClick={openInNewTab}
                      className="w-full"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open in New Tab (Recommended)
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setPdfLoadAttempted(true)}
                      className="w-full"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Try Inline Viewer
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => onDownload(document.id, document.originalFilename)}
                      className="w-full"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download PDF
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-4">
                    Some browsers may block inline PDF viewing for security reasons
                  </p>
                </div>
              ) : (
                <object
                  data={`${viewerUrl}#toolbar=1&navpanes=1&scrollbar=1&page=1&view=FitH`}
                  type="application/pdf"
                  className="w-full h-full"
                  onLoad={handleViewerLoad}
                  onError={handleViewerError}
                >
                  <div className="flex flex-col items-center justify-center h-full text-center p-8">
                    <AlertCircle className="w-16 h-16 text-amber-500 mb-4" />
                    <h3 className="text-lg font-medium mb-2">PDF Viewer Blocked</h3>
                    <p className="text-muted-foreground mb-4">
                      Your browser is blocking the inline PDF viewer for security reasons.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        onClick={openInNewTab}
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Open in New Tab
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => onDownload(document.id, document.originalFilename)}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  </div>
                </object>
              )}
            </div>
          ) : isText ? (
            <div className="h-full w-full bg-gray-50 dark:bg-gray-900 rounded-lg p-4 overflow-auto">
              <iframe
                src={viewerUrl}
                className="w-full h-full border-0 bg-white dark:bg-gray-800 rounded"
                title={document.documentName}
                onLoad={handleViewerLoad}
                onError={handleViewerError}
              />
            </div>
          ) : null}
            </TabsContent>
            
            <TabsContent value="analysis" className="flex-1 overflow-auto p-4">
              {analysisLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Clock className="w-8 h-8 mx-auto mb-2 animate-spin" />
                    <p className="text-muted-foreground">Loading analysis results...</p>
                  </div>
                </div>
              ) : (
                renderAnalysisResults(analysisResults)
              )}
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
                              {JSON.stringify(result.analysisData, null, 2)}
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