import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Upload, FileText, CheckCircle2, Clock, Building2, AlertCircle, FileUp } from "lucide-react";

interface Stage1Requirement {
  id: number;
  requirement_name: string;
  requirement_description: string;
  priority_level: string;
  requirement_status: string;
  display_status: 'pending' | 'submitted' | 'completed';
  submitted_documents: number;
  latest_submission_date?: string;
  latest_filename?: string;
}

interface PortalProgress {
  company_name: string;
  total_requirements: number;
  completed_requirements: number;
  progress_percentage: number;
  overall_status: 'not_started' | 'in_progress' | 'complete';
  requirements: Stage1Requirement[];
  portal_expires_at: string;
}

interface EnhancedPortalDisplayProps {
  token: string;
}

export function EnhancedPortalDisplay({ token }: EnhancedPortalDisplayProps) {
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]); // For multiple file uploads
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [uploadingRequirementId, setUploadingRequirementId] = useState<number | null>(null);

  // Fetch Stage 1 requirements and progress
  const { data: portalData, isLoading, error } = useQuery({
    queryKey: ['portal-stage1-requirements', token],
    queryFn: async () => {
      const response = await fetch(`/api/portal/${token}/requirements/stage1`);
      if (!response.ok) {
        throw new Error('Failed to fetch requirements');
      }
      return response.json() as Promise<PortalProgress>;
    },
    refetchInterval: 30000, // Refresh every 30 seconds for real-time updates
  });

  // Submit document mutation
  const submitDocumentMutation = useMutation({
    mutationFn: async ({ requirementId, file, notes }: { requirementId: number; file: File; notes: string }) => {
      const formData = new FormData();
      formData.append('document', file);
      formData.append('requirementId', requirementId.toString());
      formData.append('submissionNotes', notes);

      const response = await fetch(`/api/portal/${token}/documents/submit`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to submit document');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Document Submitted",
        description: "Your document has been successfully submitted for review.",
      });
      setSelectedFile(null);
      setSelectedFiles([]);
      setSubmissionNotes('');
      setUploadingRequirementId(null);
      // Refresh the data
      queryClient.invalidateQueries({ queryKey: ['portal-stage1-requirements', token] });
    },
    onError: (error: Error) => {
      toast({
        title: "Submission Failed",
        description: error.message,
        variant: "destructive",
      });
      setUploadingRequirementId(null);
    },
  });

  const handleFileSelect = (requirementId: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const requirement = portalData?.requirements.find(r => r.id === requirementId);
    
    // For Company Accounts requirement, allow multiple files (up to 5)
    if (requirement?.requirement_name === "Company Accounts") {
      if (files.length > 5) {
        toast({
          title: "Too Many Files",
          description: "You can upload up to 5 company account documents.",
          variant: "destructive",
        });
        return;
      }
      setSelectedFiles(files);
      setSelectedFile(null);
    } else {
      // For other requirements, only allow single file
      const file = files[0];
      if (file) {
        setSelectedFile(file);
        setSelectedFiles([]);
      }
    }
    setUploadingRequirementId(requirementId);
  };

  const handleSubmitDocument = async (requirementId: number) => {
    const requirement = portalData?.requirements.find(r => r.id === requirementId);
    
    // Handle multiple files for Company Accounts
    if (requirement?.requirement_name === "Company Accounts" && selectedFiles.length > 0) {
      // Submit each file individually 
      for (const file of selectedFiles) {
        await new Promise((resolve) => {
          submitDocumentMutation.mutate({
            requirementId,
            file,
            notes: submissionNotes,
          }, {
            onSettled: () => resolve(void 0)
          });
        });
      }
    } else if (selectedFile) {
      // Handle single file for other requirements
      submitDocumentMutation.mutate({
        requirementId,
        file: selectedFile,
        notes: submissionNotes,
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    return `${diffDays} days ago`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-6 w-6 text-green-600" />;
      case 'submitted':
        return <FileText className="h-6 w-6 text-blue-600" />;
      default:
        return <Clock className="h-6 w-6 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">✓ Submitted</Badge>;
      case 'submitted':
        return <Badge className="bg-blue-100 text-blue-800">📄 Under Review</Badge>;
      default:
        return <Badge variant="outline">⏳ Pending</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading document requirements...</p>
        </div>
      </div>
    );
  }

  if (error || !portalData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Access Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              Unable to access this portal. The link may be expired or invalid.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Portal Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Document Submission Portal</h1>
              <p className="text-lg text-gray-600 mt-2">
                <Building2 className="inline h-5 w-5 mr-2" />
                {portalData.company_name}
              </p>
              <p className="text-sm text-gray-500 mt-1">Stage 1: Pre-Offer Assessment Documents</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Portal expires</div>
              <div className="text-sm font-medium">
                {new Date(portalData.portal_expires_at).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>

        {/* Overall Progress */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Overall Progress</CardTitle>
              <div className="text-2xl font-bold text-blue-600">
                {portalData.progress_percentage}%
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Progress value={portalData.progress_percentage} className="mb-4" />
            <div className="flex justify-between text-sm text-gray-600">
              <span>{portalData.completed_requirements} of {portalData.total_requirements} documents submitted</span>
              <span>
                {portalData.overall_status === 'complete' && '🎉 Complete'}
                {portalData.overall_status === 'in_progress' && '🔄 In Progress'}
                {portalData.overall_status === 'not_started' && '⏳ Not Started'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Requirements List */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-gray-900">Required Documents</h2>
          <p className="text-gray-600">
            Please submit the following documents to complete Stage 1 assessment:
          </p>

          {portalData.requirements.map((requirement) => (
            <Card key={requirement.id} className={`transition-all ${
              requirement.display_status === 'completed' ? 'border-green-200 bg-green-50' :
              requirement.display_status === 'submitted' ? 'border-blue-200 bg-blue-50' :
              'border-gray-200 hover:border-gray-300'
            }`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    {getStatusIcon(requirement.display_status)}
                    <div>
                      <CardTitle className="text-lg">{requirement.requirement_name}</CardTitle>
                      <CardDescription className="mt-1">
                        {requirement.requirement_description}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getStatusBadge(requirement.display_status)}
                    <Badge variant={requirement.priority_level === 'high' ? 'destructive' : 'secondary'}>
                      {requirement.priority_level} priority
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                {requirement.display_status === 'completed' && (
                  <div className="bg-green-100 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2 text-green-800">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="font-medium">
                        Submitted: {requirement.requirement_name === "Company Accounts" 
                          ? `${requirement.submitted_documents} Company Account Files` 
                          : requirement.latest_filename
                        }
                      </span>
                    </div>
                    {requirement.latest_submission_date && (
                      <div className="text-sm text-green-600 mt-1">
                        {formatTimeAgo(requirement.latest_submission_date)}
                      </div>
                    )}
                  </div>
                )}

                {requirement.display_status === 'submitted' && (
                  <div className="bg-blue-100 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2 text-blue-800">
                      <FileText className="h-5 w-5" />
                      <span className="font-medium">
                        Under Review: {requirement.requirement_name === "Company Accounts" 
                          ? `${requirement.submitted_documents} Company Account Files` 
                          : requirement.latest_filename
                        }
                      </span>
                    </div>
                    {requirement.latest_submission_date && (
                      <div className="text-sm text-blue-600 mt-1">
                        Submitted {formatTimeAgo(requirement.latest_submission_date)}
                      </div>
                    )}
                  </div>
                )}

                {requirement.display_status === 'pending' && (
                  <div className="space-y-4">
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                      <input
                        type="file"
                        id={`file-${requirement.id}`}
                        accept=".pdf,.doc,.docx,.xls,.xlsx"
                        multiple={requirement.requirement_name === "Company Accounts"}
                        onChange={(e) => handleFileSelect(requirement.id, e)}
                        className="hidden"
                      />
                      <label 
                        htmlFor={`file-${requirement.id}`}
                        className="cursor-pointer block"
                      >
                        <FileUp className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                        <div className="text-lg font-medium text-gray-700">
                          Click to upload {requirement.requirement_name}
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          {requirement.requirement_name === "Company Accounts" 
                            ? "Upload up to 5 company account files (PDF, Word, Excel)"
                            : "Supported formats: PDF, Word, Excel"
                          }
                        </div>
                      </label>
                    </div>

                    {uploadingRequirementId === requirement.id && (selectedFile || selectedFiles.length > 0) && (
                      <div className="space-y-4">
                        {/* Show multiple files for Company Accounts */}
                        {requirement.requirement_name === "Company Accounts" && selectedFiles.length > 0 && (
                          <div className="space-y-2">
                            <div className="text-sm font-medium text-gray-700">
                              Selected Files ({selectedFiles.length}/5):
                            </div>
                            {selectedFiles.map((file, index) => (
                              <div key={index} className="bg-gray-50 rounded-lg p-3">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <div className="font-medium text-gray-900">{file.name}</div>
                                    <div className="text-sm text-gray-500">{formatFileSize(file.size)}</div>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const newFiles = selectedFiles.filter((_, i) => i !== index);
                                      setSelectedFiles(newFiles);
                                      if (newFiles.length === 0) {
                                        setUploadingRequirementId(null);
                                      }
                                    }}
                                  >
                                    Remove
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Show single file for other requirements */}
                        {requirement.requirement_name !== "Company Accounts" && selectedFile && (
                          <div className="bg-gray-50 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium text-gray-900">{selectedFile.name}</div>
                                <div className="text-sm text-gray-500">{formatFileSize(selectedFile.size)}</div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedFile(null);
                                  setUploadingRequirementId(null);
                                }}
                              >
                                Remove
                              </Button>
                            </div>
                          </div>
                        )}

                        <div className="space-y-2">
                          <Label htmlFor="notes">Optional Notes</Label>
                          <Textarea
                            id="notes"
                            placeholder="Add any additional notes about this document..."
                            value={submissionNotes}
                            onChange={(e) => setSubmissionNotes(e.target.value)}
                            rows={3}
                          />
                        </div>

                        <Button
                          onClick={() => handleSubmitDocument(requirement.id)}
                          disabled={submitDocumentMutation.isPending}
                          className="w-full"
                        >
                          {submitDocumentMutation.isPending ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Submitting...
                            </>
                          ) : (
                            <>
                              <Upload className="h-4 w-4 mr-2" />
                              Submit {requirement.requirement_name === "Company Accounts" && selectedFiles.length > 1 
                                ? `${selectedFiles.length} Company Account Files`
                                : requirement.requirement_name
                              }
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Completion Status */}
        <Card className="mt-8">
          <CardContent className="p-6">
            {portalData.overall_status === 'complete' ? (
              <div className="text-center">
                <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">All Documents Submitted!</h3>
                <p className="text-gray-600 mb-4">
                  Thank you for submitting all required Stage 1 documents. Our team will now review your submission and begin the initial assessment process.
                </p>
                <p className="text-sm text-gray-500">
                  <strong>Next Steps:</strong> We will contact you within 5-7 business days with our initial assessment and next steps.
                </p>
              </div>
            ) : (
              <div className="text-center">
                <AlertCircle className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {portalData.completed_requirements} of {portalData.total_requirements} Documents Submitted
                </h3>
                <p className="text-gray-600 mb-2">
                  Please complete the remaining document submissions to proceed with the assessment process.
                </p>
                {portalData.completed_requirements > 0 && (
                  <p className="text-sm text-gray-500">
                    <strong>Progress saved:</strong> Your submitted documents are secure and will be retained.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Help Section */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Need Help?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-gray-600 space-y-2">
              <p>• <strong>File formats:</strong> PDF, Word (.doc, .docx), Excel (.xls, .xlsx)</p>
              <p>• <strong>File size limit:</strong> 50MB per document</p>
              <p>• <strong>Support:</strong> Contact our team if you encounter any technical issues</p>
              <p>• <strong>Security:</strong> All uploads are encrypted and securely stored</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}