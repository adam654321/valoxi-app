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
}

interface SimplePortalDisplayProps {
  token: string;
}

const DOCUMENT_TYPES = [
  { value: 'company_accounts_1', label: 'Company Accounts (File 1 of 5)' },
  { value: 'company_accounts_2', label: 'Company Accounts (File 2 of 5)' },
  { value: 'company_accounts_3', label: 'Company Accounts (File 3 of 5)' },
  { value: 'company_accounts_4', label: 'Company Accounts (File 4 of 5)' },
  { value: 'company_accounts_5', label: 'Company Accounts (File 5 of 5)' },
  { value: 'p_and_l', label: 'P&L Statement' },
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
    queryKey: ['/api/portal', token],
    enabled: !!token
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
      
      // Refresh portal data
      queryClient.invalidateQueries({ queryKey: ['/api/portal', token] });
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
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
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
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <p className="text-red-600">Invalid or expired portal link</p>
          </div>
        </div>
      </div>
    );
  }

  const isCompleted = (portalData.total_submitted || 0) >= 10;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl text-center">
              Document Submission Portal
            </CardTitle>
            <p className="text-center text-gray-600">
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
                  Progress: {portalData.total_submitted || 0} of {portalData.total_documents_required} documents
                </span>
                <span className="text-sm text-gray-500">
                  {portalData.progress_percentage || 0}% Complete
                </span>
              </div>
              <Progress value={portalData.progress_percentage || 0} className="h-3" />
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
                portalData.document_status.map((doc) => (
                <div key={doc.type} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
                  <div className="flex items-center space-x-3">
                    {doc.isComplete ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                    ) : (
                      <Clock className="h-5 w-5 text-gray-400 flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 text-sm">{doc.label}</p>
                      {doc.isGroup ? (
                        <p className="text-xs text-gray-500">
                          {doc.submitted} of {doc.required} files
                        </p>
                      ) : doc.submission ? (
                        <p className="text-xs text-gray-500 truncate">
                          {doc.submission.filename}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 flex-shrink-0">
                    {doc.isGroup ? (
                      <Badge variant="outline" className={`${
                        doc.isComplete 
                          ? 'text-green-700 border-green-300 bg-green-50' 
                          : 'text-blue-700 border-blue-300 bg-blue-50'
                      }`}>
                        {doc.submitted}/{doc.required}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className={`${
                        doc.isComplete 
                          ? 'text-green-700 border-green-300 bg-green-50' 
                          : 'text-gray-500'
                      }`}>
                        {doc.isComplete ? 'Done' : 'Required'}
                      </Badge>
                    )}
                  </div>
                </div>
                ))
              ) : (
                <div className="col-span-full text-center py-8 text-gray-500">
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
                        // For company_accounts types, check if the group has space for more submissions
                        if (type.value.startsWith('company_accounts_')) {
                          const companyAccountsStatus = portalData.document_status?.find(doc => doc.type === 'company_accounts');
                          if (!companyAccountsStatus) return true;
                          // Allow submissions if the group isn't complete
                          return !companyAccountsStatus.isComplete;
                        }
                        
                        // For individual document types, check if already submitted
                        const docStatus = portalData.document_status?.find(doc => doc.type === type.value);
                        return !docStatus?.submitted;
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
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                  <input
                    type="file"
                    id="document-file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx"
                    onChange={handleFileSelect}
                    className="hidden"
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
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900">{selectedFile.name}</div>
                        <div className="text-sm text-gray-500">{formatFileSize(selectedFile.size)}</div>
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
                <p className="text-gray-600">
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