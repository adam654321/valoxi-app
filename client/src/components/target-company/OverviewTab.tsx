import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Globe, Mail, Phone, MapPin, Calendar, User, Building2, FileText, ExternalLink, RefreshCw, RotateCcw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { CompanyProfile } from "./types";

interface OverviewTabProps {
  company: CompanyProfile;
  profile: CompanyProfile | undefined;
  profileLoading: boolean;
  profileFetching: boolean;
  refetchProfile: () => void;
  companyId: string;
  formatDate: (date: string | undefined) => string;
  viewOnMap: (address: string) => void;
  DealNotesSection: React.ComponentType<{ targetCompanyId: number }>;
}

export function OverviewTab({
  company,
  profile,
  profileLoading,
  profileFetching,
  refetchProfile,
  companyId,
  formatDate,
  viewOnMap,
  DealNotesSection,
}: OverviewTabProps) {
  const { toast } = useToast();
  const [isRetryingAnalysis, setIsRetryingAnalysis] = useState(false);

  const handleRetryWebsiteAnalysis = async () => {
    if (isRetryingAnalysis) return;
    
    setIsRetryingAnalysis(true);
    try {
      await apiRequest('POST', `/api/v2/website-analysis/company/${companyId}/analyze`);
      toast({
        title: "Analysis Started",
        description: "Website analysis is being processed. Results will appear shortly.",
      });
      // Start polling for results
      setTimeout(() => refetchProfile(), 5000);
      setTimeout(() => refetchProfile(), 15000);
      setTimeout(() => refetchProfile(), 30000);
    } catch (error) {
      console.error('Failed to trigger website analysis:', error);
      toast({
        title: "Analysis Failed",
        description: "Failed to start website analysis. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRetryingAnalysis(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Company Information */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Company Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {company.website && (
              <div className="flex items-center gap-3" data-testid="info-website">
                <Globe className="w-4 h-4 text-muted-foreground" />
                <div className="flex-1">
                  <span className="text-sm font-medium text-muted-foreground">Website</span>
                  <div>
                    <a 
                      href={company.website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline flex items-center gap-1"
                    >
                      {company.website.replace(/^https?:\/\//, '')}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
            )}

            {company.email && (
              <div className="flex items-center gap-3" data-testid="info-email">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <div className="flex-1">
                  <span className="text-sm font-medium text-muted-foreground">Email</span>
                  <div>
                    <a href={`mailto:${company.email}`} className="text-blue-600 hover:underline">
                      {company.email}
                    </a>
                  </div>
                </div>
              </div>
            )}

            {company.phone && (
              <div className="flex items-center gap-3" data-testid="info-phone">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <div className="flex-1">
                  <span className="text-sm font-medium text-muted-foreground">Phone</span>
                  <div>
                    <a href={`tel:${company.phone}`} className="text-blue-600 hover:underline">
                      {company.phone}
                    </a>
                  </div>
                </div>
              </div>
            )}

            {company.address && (
              <div className="flex items-start gap-3" data-testid="info-address">
                <MapPin className="w-4 h-4 text-muted-foreground mt-1" />
                <div className="flex-1">
                  <span className="text-sm font-medium text-muted-foreground">Address</span>
                  <div>
                    <button 
                      onClick={() => viewOnMap(company.address!)}
                      className="text-blue-600 hover:underline text-left"
                    >
                      {company.address}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {company.yearEstablished && (
              <div className="flex items-center gap-3" data-testid="info-year-established">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <div className="flex-1">
                  <span className="text-sm font-medium text-muted-foreground">Established</span>
                  <div>{company.yearEstablished}</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Business Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {company.description && (
              <div>
                <span className="text-sm font-medium text-muted-foreground">Description</span>
                <p className="mt-2 text-sm leading-relaxed" data-testid="info-description">
                  {company.description}
                </p>
              </div>
            )}

            {/* Website Analysis Section */}
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Globe className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Website Analysis</span>
                {profileFetching && !profileLoading && (
                  <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
                )}
              </div>
              {profileLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ) : company.websiteAnalysis ? (
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">
                    Analysis completed: {company.websiteAnalysisProcessedAt 
                      ? new Date(company.websiteAnalysisProcessedAt).toLocaleString()
                      : 'Unknown'
                    }
                  </div>
                  <div 
                    className="prose prose-xs max-w-none dark:prose-invert text-sm leading-relaxed [&>*]:text-sm [&>h1]:text-base [&>h2]:text-sm [&>h3]:text-sm [&>p]:text-sm [&>ul]:text-sm [&>ol]:text-sm [&>li]:text-sm"
                    data-testid="website-analysis-content"
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {company.websiteAnalysis}
                    </ReactMarkdown>
                  </div>
                </div>
              ) : (
                <div className="bg-muted rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">Website Analysis</span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRetryWebsiteAnalysis}
                        disabled={isRetryingAnalysis || !company.website}
                        className="h-7 px-2"
                        data-testid="button-retry-website-analysis"
                      >
                        <RotateCcw className={`w-4 h-4 mr-1 ${isRetryingAnalysis ? 'animate-spin' : ''}`} />
                        {isRetryingAnalysis ? 'Analyzing...' : 'Retry Analysis'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refetchProfile()}
                        disabled={profileFetching}
                        className="h-7 px-2"
                        data-testid="button-refresh-analysis-business-info"
                      >
                        <RefreshCw className={`w-4 h-4 ${profileFetching ? 'animate-spin' : ''}`} />
                      </Button>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {company.website 
                      ? "No website analysis available. Click 'Retry Analysis' to analyze the company website."
                      : "No website URL configured for this company."
                    }
                  </div>
                  {(isRetryingAnalysis || profileFetching) && (
                    <div className="flex items-center gap-2 mt-2 text-sm text-blue-600">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{isRetryingAnalysis ? 'Analyzing website...' : 'Checking for updates...'}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Show a placeholder if neither description nor analysis is available */}
            {!company.description && !company.websiteAnalysis && !profileLoading && (
              <div className="text-center py-6 text-muted-foreground">
                <FileText className="w-6 h-6 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No business information available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Deal Notes Section */}
      <DealNotesSection targetCompanyId={parseInt(companyId)} />

      {/* System Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Record Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <span className="text-sm font-medium text-muted-foreground">Created By</span>
              <div className="mt-1">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">{profile?.createdByName || 'Unknown'}</span>
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {formatDate(company.createdAt ? company.createdAt.toString() : undefined)}
                </div>
              </div>
            </div>
            <div>
              <span className="text-sm font-medium text-muted-foreground">Organization</span>
              <div className="mt-1">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">{profile?.userCompanyName || 'Unknown'}</span>
                </div>
              </div>
            </div>
            <div>
              <span className="text-sm font-medium text-muted-foreground">Primary Contact</span>
              <div className="mt-1">
                {profile?.primaryContactName ? (
                  <div>
                    <div className="font-medium">{profile.primaryContactName}</div>
                    {profile.primaryContactEmail && (
                      <div className="text-sm text-muted-foreground">{profile.primaryContactEmail}</div>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground">No primary contact</span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
