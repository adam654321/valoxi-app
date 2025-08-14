import { useState, useEffect } from 'react';
import { useParams } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Upload, FileText, CheckCircle, XCircle, Clock, Download, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PortalToken {
  valid: boolean;
  tokenId: number;
  companyId: number;
  contactId: number;
  allowedActions: {
    upload: boolean;
    download: boolean;
    message: boolean;
  };
  customMessage?: string;
  portalBranding?: {
    companyName?: string;
    logoUrl?: string;
    primaryColor?: string;
  };
}

interface DocumentRequirement {
  id: number;
  requirementName: string;
  requirementDescription?: string;
  isMandatory: boolean;
  submissionStatus: string;
  acceptedFileTypes: string[];
  maxFileSize: number;
  submissionInstructions?: string;
  helpText?: string;
}

interface Submission {
  id: number;
  originalFilename: string;
  fileSize: number;
  fileType: string;
  documentCategory: string;
  submissionNotes?: string;
  submittedAt: string;
  processingStatus: string;
  reviewNotes?: string;
  reviewedAt?: string;
}

export default function PortalPage() {
  const { token } = useParams();
  const { toast } = useToast();
  const [portalData, setPortalData] = useState<PortalToken | null>(null);
  const [requirements, setRequirements] = useState<DocumentRequirement[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [selectedRequirement, setSelectedRequirement] = useState<number | null>(null);

  useEffect(() => {
    if (token) {
      validateToken();
    }
  }, [token]);

  const validateToken = async () => {
    try {
      const response = await fetch(`/api/portal/validate/${token}`);
      if (!response.ok) {
        throw new Error('Invalid or expired access token');
      }
      
      const data = await response.json();
      setPortalData(data);
      
      // Load requirements and submissions
      await Promise.all([
        loadRequirements(),
        loadSubmissions()
      ]);
    } catch (error) {
      console.error('Token validation error:', error);
      toast({
        title: "Access Error",
        description: "Invalid or expired access token. Please contact your deal team for a new link.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadRequirements = async () => {
    try {
      const response = await fetch(`/api/portal/${token}/requirements`);
      if (response.ok) {
        const data = await response.json();
        setRequirements(data);
      }
    } catch (error) {
      console.error('Load requirements error:', error);
    }
  };

  const loadSubmissions = async () => {
    try {
      const response = await fetch(`/api/portal/${token}/submissions`);
      if (response.ok) {
        const data = await response.json();
        setSubmissions(data);
      }
    } catch (error) {
      console.error('Load submissions error:', error);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFile) {
      toast({
        title: "No File Selected",
        description: "Please select a document to upload.",
        variant: "destructive",
      });
      return;
    }

    if (!portalData?.allowedActions.upload) {
      toast({
        title: "Upload Not Permitted",
        description: "Document upload is not enabled for this portal.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('document', selectedFile);
      formData.append('submission_notes', submissionNotes);
      formData.append('document_category', 'general');
      
      if (selectedRequirement) {
        formData.append('requirement_id', selectedRequirement.toString());
      }

      const response = await fetch(`/api/portal/${token}/submit`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Upload failed');
      }

      const result = await response.json();
      
      toast({
        title: "Document Submitted",
        description: `${result.filename} has been successfully uploaded.`,
      });

      // Reset form
      setSelectedFile(null);
      setSubmissionNotes('');
      setSelectedRequirement(null);
      
      // Refresh submissions
      await loadSubmissions();
      
      // Reset file input
      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload document. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'needs_revision':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      default:
        return <Clock className="w-4 h-4 text-blue-600" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading portal...</p>
        </div>
      </div>
    );
  }

  if (!portalData?.valid) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="w-5 h-5" />
              Access Denied
            </CardTitle>
            <CardDescription>
              This portal link is invalid or has expired. Please contact your deal team for assistance.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const primaryColor = portalData.portalBranding?.primaryColor || '#2563eb';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div 
        className="bg-white dark:bg-gray-800 shadow-lg border-b-4"
        style={{ borderBottomColor: primaryColor }}
      >
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {portalData.portalBranding?.companyName || 'Document Portal'}
              </h1>
              <p className="text-lg text-gray-600 dark:text-gray-300">
                Secure document submission and management platform
              </p>
              <div className="flex items-center mt-3 text-sm text-gray-500 dark:text-gray-400">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                Portal active and secure
              </div>
            </div>
            {portalData.portalBranding?.logoUrl && (
              <img 
                src={portalData.portalBranding.logoUrl} 
                alt="Company Logo" 
                className="h-16 w-auto"
              />
            )}
          </div>
          
          {portalData.customMessage && (
            <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-700">
              <p className="text-blue-800 dark:text-blue-200 font-medium">
                {portalData.customMessage}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Document Upload Section */}
          {portalData.allowedActions.upload && (
            <Card className="border-0 shadow-xl bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-600 rounded-t-lg">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div 
                    className="p-2 rounded-lg"
                    style={{ backgroundColor: primaryColor + '20' }}
                  >
                    <Upload className="w-6 h-6" style={{ color: primaryColor }} />
                  </div>
                  Upload Document
                </CardTitle>
                <CardDescription className="text-base">
                  Submit required documents securely through this portal.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <Label htmlFor="file-input" className="text-base font-medium">Select Document</Label>
                    <div className="mt-3 relative">
                      <Input
                        id="file-input"
                        type="file"
                        onChange={handleFileSelect}
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.gif"
                        className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:cursor-pointer hover:file:opacity-80 transition-all duration-200"
                        style={{ 
                          '--file-bg': primaryColor,
                          '--file-text': 'white'
                        } as any}
                      />
                    </div>
                    {selectedFile && (
                      <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {selectedFile.name}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            ({formatFileSize(selectedFile.size)})
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {requirements.length > 0 && (
                    <div>
                      <Label htmlFor="requirement-select">Document Type (Optional)</Label>
                      <select
                        id="requirement-select"
                        value={selectedRequirement || ''}
                        onChange={(e) => setSelectedRequirement(e.target.value ? parseInt(e.target.value) : null)}
                        className="w-full mt-1 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
                      >
                        <option value="">Select document type...</option>
                        {requirements.map((req) => (
                          <option key={req.id} value={req.id}>
                            {req.requirementName} {req.isMandatory ? '(Required)' : '(Optional)'}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <Label htmlFor="notes">Additional Notes (Optional)</Label>
                    <Textarea
                      id="notes"
                      value={submissionNotes}
                      onChange={(e) => setSubmissionNotes(e.target.value)}
                      placeholder="Add any additional context or notes about this document..."
                      className="mt-1"
                    />
                  </div>

                  <Button 
                    type="submit" 
                    disabled={!selectedFile || uploading}
                    className="w-full py-3 text-lg font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-0.5"
                    style={{ backgroundColor: primaryColor, borderColor: primaryColor }}
                  >
                    {uploading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                        Uploading Document...
                      </>
                    ) : (
                      <>
                        <Upload className="w-5 h-5 mr-3" />
                        Submit Document Securely
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Document Requirements */}
          {requirements.length > 0 && (
            <Card className="border-0 shadow-xl bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-600 rounded-t-lg">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div 
                    className="p-2 rounded-lg"
                    style={{ backgroundColor: primaryColor + '20' }}
                  >
                    <FileText className="w-6 h-6" style={{ color: primaryColor }} />
                  </div>
                  Required Documents
                </CardTitle>
                <CardDescription className="text-base">
                  Review the documents needed for this process.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {requirements.map((req) => (
                    <div key={req.id} className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            {req.requirementName}
                            {req.isMandatory && (
                              <span className="text-red-600 ml-1">*</span>
                            )}
                          </h4>
                          {req.requirementDescription && (
                            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                              {req.requirementDescription}
                            </p>
                          )}
                          {req.acceptedFileTypes && req.acceptedFileTypes.length > 0 && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                              Accepted formats: {req.acceptedFileTypes.join(', ')}
                            </p>
                          )}
                        </div>
                        <div className="ml-4">
                          {getStatusIcon(req.submissionStatus)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Submission History */}
        {submissions.length > 0 && (
          <Card className="mt-8 border-0 shadow-xl bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-600 rounded-t-lg">
              <CardTitle className="flex items-center gap-3 text-xl">
                <div 
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: primaryColor + '20' }}
                >
                  <FileText className="w-6 h-6" style={{ color: primaryColor }} />
                </div>
                Submission History
              </CardTitle>
              <CardDescription className="text-base">
                View the status of your submitted documents.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {submissions.map((submission) => (
                  <div key={submission.id} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gray-500" />
                        <span className="font-medium text-gray-900 dark:text-white">
                          {submission.originalFilename}
                        </span>
                        {getStatusIcon(submission.processingStatus)}
                      </div>
                      <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                        <p>Size: {formatFileSize(submission.fileSize)} | Type: {submission.fileType}</p>
                        <p>Submitted: {new Date(submission.submittedAt).toLocaleString()}</p>
                        {submission.submissionNotes && (
                          <p className="mt-1 text-gray-500">Notes: {submission.submissionNotes}</p>
                        )}
                        {submission.reviewNotes && (
                          <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded">
                            <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Review Notes:</p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">{submission.reviewNotes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                        ${submission.processingStatus === 'approved' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                          submission.processingStatus === 'rejected' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                          submission.processingStatus === 'needs_revision' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                          'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'}`}>
                        {submission.processingStatus.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}