import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, FileUp, FileText, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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

interface SimplePortalDisplayProps {
  token: string;
}

const DOCUMENT_TYPES = [
  { value: 'company_accounts', label: 'Company Accounts' },
  { value: 'p_and_l', label: 'Profit and Loss' },
  { value: 'balance_sheet', label: 'Balance Sheet' },
  { value: 'sales_ledger', label: 'Sales Ledger' },
  { value: 'asset_register', label: 'Asset Register' },
  { value: 'staff_matrix', label: 'Staff Matrix' }
];

export function SimplePortalDisplay({ token }: SimplePortalDisplayProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedDocumentType, setSelectedDocumentType] = useState<string>('');
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch portal data
  const { data: portalData, isLoading } = useQuery<PortalData>({
    queryKey: ['/api/v2/portal-submit', token],
    enabled: !!token,
    select: (response: any) => response.data,
  });

  // Get analysis completion status for badge-based filtering
  const { data: analysisCompletion } = useQuery<{
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
    enabled: !!token && !!portalData,
    select: (response: any) => response.data,
  });

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
      
      // Refresh portal data and analysis completion status
      queryClient.invalidateQueries({ queryKey: ['/api/v2/portal-submit', token] });
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

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getNextAvailableDocumentType = (): string => {
    if (!portalData?.document_status) return DOCUMENT_TYPES[0].value;
    
    const unsubmittedTypes = portalData.document_status.filter(doc => !doc.submitted);
    return unsubmittedTypes.length > 0 ? unsubmittedTypes[0].type : '';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted p-4">
        <div className="max-w-4xl mx-auto">
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
      <div className="min-h-screen bg-muted p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <p className="text-red-600">Invalid or expired portal link</p>
          </div>
        </div>
      </div>
    );
  }

  // Calculate analysis-based completion
  const analysisProgress = analysisCompletion || { completedTypes: [], completionPercentage: 0, completedCount: 0, totalCount: 10 };
  const isCompleted = analysisProgress.completionPercentage >= 100;

  // Helper function to get actual upload count for document types
  const getUploadBasedCompletion = (docType: string) => {
    if (!portalData?.document_status) return false;
    
    const docStatus = portalData.document_status.find(doc => doc.type === docType);
    if (!docStatus) return false;
    
    if (docType === 'company_accounts') {
      // For Company Accounts, return actual uploaded count (submitted/required)
      return docStatus.submitted || 0;
    } else {
      // For individual docs, return whether submitted
      return docStatus.submitted || false;
    }
  };

  // Helper function to determine completion based on analysis (for progress display) or uploads (for Company Accounts)
  const getCompletionStatus = (docType: string) => {
    if (docType === 'company_accounts') {
      // Company Accounts: use actual upload count, not analysis
      return getUploadBasedCompletion(docType);
    } else {
      // Individual docs: use analysis completion
      if (!analysisCompletion) return false;
      
      switch (docType) {
        case 'p_and_l':
          return analysisCompletion.completedTypes.includes('profit_and_loss');
        case 'balance_sheet':
          return analysisCompletion.completedTypes.includes('balance_sheet');
        case 'sales_ledger':
          return analysisCompletion.completedTypes.includes('sales_ledger');
        case 'asset_register':
          return analysisCompletion.completedTypes.includes('asset_register');
        case 'staff_matrix':
          return analysisCompletion.completedTypes.includes('staff_matrix');
        default:
          return false;
      }
    }
  };

  return (
    <div className="min-h-screen bg-muted p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl text-center">
              Document Submission Portal
            </CardTitle>
            <p className="text-center text-muted-foreground">
              {portalData.company_name}
            </p>
          </CardHeader>
        </Card>

        {/* Progress */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">
                  Analysis Progress: {analysisProgress.completedCount} of {analysisProgress.totalCount} types analyzed
                </span>
                <span className="text-sm text-muted-foreground">
                  {Math.round(analysisProgress.completionPercentage)}% Complete
                </span>
              </div>
              <Progress value={analysisProgress.completionPercentage} className="h-3" />
            </div>
          </CardContent>
        </Card>

        {/* Document Requirements - Condensed */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Document Requirements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {portalData.document_status && portalData.document_status.length > 0 ? (
                portalData.document_status.map((doc) => {
                  // Use upload-based completion for Company Accounts, analysis-based for others
                  const completionData = getCompletionStatus(doc.type);
                  const isComplete = doc.isGroup 
                    ? typeof completionData === 'number' && completionData >= 5  // Company Accounts: require all 5 documents uploaded
                    : completionData;  // Individual docs: use analysis completion
                  
                  return (
                <div key={doc.type} className="flex items-center justify-between p-3 border border-border rounded-lg hover:border-border transition-colors">
                  <div className="flex items-center space-x-3">
                    {isComplete ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                    ) : (
                      <Clock className="h-5 w-5 text-muted-foreground/70 flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground text-sm">{doc.label}</p>
                      {doc.isGroup ? (
                        <p className="text-xs text-muted-foreground">
                          {typeof completionData === 'number' ? completionData : 0} of 5 files
                        </p>
                      ) : doc.submission ? (
                        <p className="text-xs text-muted-foreground truncate">
                          {doc.submission.filename}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 flex-shrink-0">
                    {doc.isGroup ? (
                      <Badge variant="outline" className={`${
                        isComplete 
                          ? 'text-green-700 border-green-300 bg-green-50' 
                          : 'text-blue-700 border-blue-300 bg-blue-50'
                      }`}>
                        {typeof completionData === 'number' ? completionData : 0}/5
                      </Badge>
                    ) : (
                      <Badge variant="outline" className={`${
                        isComplete 
                          ? 'text-green-700 border-green-300 bg-green-50' 
                          : 'text-muted-foreground'
                      }`}>
                        {isComplete ? 'Done' : 'Required'}
                      </Badge>
                    )}
                  </div>
                </div>
                  )
                })
              ) : (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  No document requirements found
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Upload Section */}
        {!isCompleted && (
          <Card>
            <CardHeader>
              <CardTitle>Upload Document</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Document Type Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Document Type</label>
                <Select value={selectedDocumentType} onValueChange={setSelectedDocumentType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select document type to upload" />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES
                      .filter(type => {
                        if (!analysisCompletion) return true; // Show all if no analysis data yet
                        
                        // Map portal document types to analysis types
                        let analysisType: string;
                        switch (type.value) {
                          case 'company_accounts':
                            // For Company Accounts, count how many company_accounts_* types are completed
                            const companyAccountsCompleted = analysisCompletion.completedTypes.filter(t => 
                              t.startsWith('company_accounts')
                            ).length;
                            return companyAccountsCompleted < 5;
                          case 'asset_register':
                            analysisType = 'asset_register';
                            break;
                          case 'balance_sheet':
                            analysisType = 'balance_sheet';
                            break;
                          case 'p_and_l':
                            analysisType = 'profit_and_loss';
                            break;
                          case 'sales_ledger':
                            analysisType = 'sales_ledger';
                            break;
                          case 'staff_matrix':
                            analysisType = 'staff_matrix';
                            break;
                          default:
                            return true; // Allow unknown types
                        }
                        
                        // For other document types, only allow if analysis type is not completed
                        return !analysisCompletion.completedTypes.includes(analysisType);
                      })
                      .map(type => (
                        <SelectItem key={type.value} value={type.value}>
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
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-border transition-colors">
                  <input
                    type="file"
                    id="document-file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.xlsm,.csv,.tsv,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.gif,.bmp,.tiff,.tif,.webp,.numbers,.pages,.key,.odt,.ods,.odp,.rtf"
                    onChange={handleFileSelect}
                    className="hidden"
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
                  <div className="bg-muted rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-foreground">{selectedFile.name}</div>
                        <div className="text-sm text-muted-foreground">{formatFileSize(selectedFile.size)}</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedFile(null)}
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
                />
              </div>

              {/* Submit Button */}
              <Button
                onClick={handleSubmit}
                disabled={!selectedFile || !selectedDocumentType || isUploading}
                className="w-full"
                size="lg"
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
                <h3 className="text-xl font-semibold text-green-800">
                  All Documents Submitted!
                </h3>
                <p className="text-muted-foreground">
                  Thank you for submitting all required documents. Our team will review them and be in touch soon.
                </p>
              </div>
            </CardContent>
          </Card>
        )}


      </div>
    </div>
  );
}