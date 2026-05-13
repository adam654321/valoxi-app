import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useServerConfig } from '@/hooks/useServerConfig';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ExternalLink, Users, FileText, Clock, Mail, Plus, ChevronRight, ArrowLeft, Building2, AlertTriangle, TimerOff, CalendarPlus, RefreshCw } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { handleSendResult } from '@/lib/send-result-toast';

interface TargetCompany {
  id: number;
  companyName: string;
  industry?: string;
  website?: string;
}

interface Contact {
  id: number;
  targetCompanyId: number;
  firstName: string;
  lastName: string;
  email?: string;
  title?: string;
  phone?: string;
  isPrimary: boolean;
  notes?: string;
  createdAt: string;
}

interface PortalToken {
  id: number;
  accessToken: string;
  targetCompanyId: number;
  contactId: number;
  isActive: boolean;
  expiresAt: string;
  createdAt: string;
  lastAccessed?: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  documentSubmissions: number;
  submissionDeadline?: string;
  chaseUpStatus?: string;
  escalationLevel?: string;
  chaseEmailCount?: number;
}

interface ChaseUpStatus {
  hasSchedule: boolean;
  scheduleId?: number;
  timeframeDays?: number;
  submissionDeadline?: string;
  isActive?: boolean;
  isCompleted?: boolean;
  completionReason?: string;
  daysRemaining?: number;
  daysOverdue?: number;
  chaseUpStatus?: string;
  escalationLevel?: string;
  emailsSent?: number;
}

interface BusinessOverview {
  companyId: number;
  companyName: string;
  totalLinks: number;
  activeLinks: number;
  totalSubmissions: number;
  tokens: PortalToken[];
}

interface AnalysisCompletion {
  completedTypes: string[];
  completionPercentage: number;
  completedCount: number;
  totalCount: number;
}

// Hook to fetch completion percentage for a token
function useTokenCompletion(accessToken: string) {
  return useQuery<AnalysisCompletion>({
    queryKey: [`/api/v2/portal-submit/${accessToken}/analysis-completion`],
    enabled: !!accessToken,
    refetchInterval: 10000, // Refresh every 10 seconds
    select: (response: any) => response.data,
  });
}

// Component to display completion percentage for a token
function TokenCompletionDisplay({ accessToken }: { accessToken: string }) {
  const { data: completionData, isLoading } = useTokenCompletion(accessToken);
  
  if (isLoading) {
    return (
      <div className="text-center">
        <div className="text-xl font-bold text-muted-foreground/70">...</div>
        <div className="text-xs text-muted-foreground">Loading</div>
      </div>
    );
  }
  
  if (!completionData) {
    return (
      <div className="text-center">
        <div className="text-xl font-bold text-muted-foreground/70">N/A</div>
        <div className="text-xs text-muted-foreground">No data</div>
      </div>
    );
  }
  
  return (
    <div className="text-center">
      <div className="text-xl font-bold text-green-600">
        {Math.round(completionData.completionPercentage || 0)}%
      </div>
      <div className="text-xs text-muted-foreground">Complete</div>
    </div>
  );
}

// Component to display average completion percentage for a business with multiple tokens
function BusinessCompletionDisplay({ tokens }: { tokens: PortalToken[] }) {
  const completionQueries = tokens.map(token => 
    useTokenCompletion(token.accessToken)
  );
  
  const isLoading = completionQueries.some(query => query.isLoading);
  const completionData = completionQueries.map(query => query.data).filter(Boolean);
  
  if (isLoading) {
    return (
      <div className="text-right">
        <div className="text-2xl font-bold text-muted-foreground/70">...</div>
        <div className="text-xs text-muted-foreground">Loading</div>
      </div>
    );
  }
  
  if (completionData.length === 0) {
    return (
      <div className="text-right">
        <div className="text-2xl font-bold text-muted-foreground/70">N/A</div>
        <div className="text-xs text-muted-foreground">No data</div>
      </div>
    );
  }
  
  const averageCompletion = completionData.reduce((sum, data) => sum + (data?.completionPercentage || 0), 0) / completionData.length;
  
  return (
    <div className="text-right">
      <div className="text-2xl font-bold text-blue-600">
        {Math.round(averageCompletion)}%
      </div>
      <div className="text-xs text-muted-foreground">Complete</div>
    </div>
  );
}

function ChaseUpStatusBadge({ status, escalationLevel, daysOverdue }: { status?: string; escalationLevel?: string; daysOverdue?: number }) {
  if (!status || status === 'not_started') {
    return <Badge variant="outline">No Chase-up</Badge>;
  }

  if (status === 'completed') {
    return <Badge variant="secondary">Completed</Badge>;
  }

  if (status === 'within_timeframe') {
    return <Badge className="bg-green-500">On Track</Badge>;
  }

  if (status === 'manual_intervention' || escalationLevel === 'manual') {
    return (
      <Badge variant="destructive" className="flex items-center gap-1">
        <AlertTriangle size={12} />
        Needs Attention
      </Badge>
    );
  }

  if (escalationLevel === 'urgent' || escalationLevel === 'final') {
    return (
      <Badge variant="destructive" className="flex items-center gap-1">
        {daysOverdue || 0} days overdue
      </Badge>
    );
  }

  if (escalationLevel === 'firm') {
    return <Badge className="bg-orange-500">{daysOverdue || 0} days overdue</Badge>;
  }

  if (escalationLevel === 'gentle') {
    return <Badge className="bg-yellow-500">{daysOverdue || 0} days overdue</Badge>;
  }

  return <Badge variant="outline">Pending</Badge>;
}

export default function PortalManagement() {
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [selectedContactIds, setSelectedContactIds] = useState<number[]>([]);
  const [customMessage, setCustomMessage] = useState('');
  const [timeframeDays, setTimeframeDays] = useState<number>(14);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [viewMode, setViewMode] = useState<'overview' | 'company-detail'>('overview');
  const [selectedBusinessId, setSelectedBusinessId] = useState<number | null>(null);
  const [showExtendModal, setShowExtendModal] = useState<number | null>(null);
  const [extensionDays, setExtensionDays] = useState<number>(7);
  const [includeNda, setIncludeNda] = useState<boolean>(true);
  const { toast } = useToast();
  const { nylasConnectVisible } = useServerConfig();
  const queryClient = useQueryClient();

  // Fetch target companies
  const { data: companies = [], isLoading: companiesLoading } = useQuery<TargetCompany[]>({
    queryKey: ['/api/v2/target-companies'],
  });

  // Fetch contacts for selected company (using v2 contacts endpoint)
  const { data: contacts = [], isLoading: contactsLoading } = useQuery<Contact[]>({
    queryKey: ['/api/v2/contacts/company', selectedCompanyId],
    select: (response: any) => response.data,
    enabled: !!selectedCompanyId,
  });

  // Fetch existing portal tokens
  const { data: portalTokens = [], isLoading: tokensLoading } = useQuery<PortalToken[]>({
    queryKey: ['/api/v2/portal/tokens'],
    select: (response: any) => response.data,
  });

  // Get primary contacts only (for portal link creation)
  const primaryContacts = contacts.filter(contact => contact.isPrimary);

  // Get companies that don't have portal links yet
  const availableCompanies = companies.filter(company => 
    !portalTokens.some(token => token.targetCompanyId === company.id)
  );

  // Check if selected company already has a portal link
  const companyHasPortal = selectedCompanyId ? 
    portalTokens.some(token => token.targetCompanyId === selectedCompanyId) : false;

  // Create portal token mutation
  const createPortalToken = useMutation({
    mutationFn: async (data: {
      targetCompanyId: number;
      targetContactId: number;
      customMessage?: string;
      timeframeDays?: number;
      includeNda?: boolean;
    }) => {
      const response = await apiRequest('POST', '/api/v2/portal/tokens', data);
      return response.json();
    },
    onSuccess: (data) => {
      handleSendResult(data, toast, 'Portal link created', nylasConnectVisible);
      queryClient.invalidateQueries({ queryKey: ['/api/v2/portal/tokens'] });
      // Invalidate pipeline/company queries since creating portal moves company to Documents Requested stage
      queryClient.invalidateQueries({ queryKey: ['/api/v2/target-companies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v2/target-companies/search'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v2/pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v2/dashboard/data/pipeline-overview'] });
      setShowCreateForm(false);
      setSelectedCompanyId(null);
      setSelectedContactIds([]);
      setCustomMessage('');
      setIncludeNda(true);
    },
    onError: (error: any) => {
      toast({
        title: "Error creating portal links",
        description: error.message || "Failed to create portal links",
        variant: "destructive",
      });
    },
  });

  // Remove/expire portal token mutation
  const removePortalToken = useMutation({
    mutationFn: async (tokenId: number) => {
      const response = await apiRequest('DELETE', `/api/v2/portal/tokens/${tokenId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Portal link removed",
        description: "The portal link has been deactivated. Document history preserved.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/v2/portal/tokens'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error removing portal link",
        description: error.message || "Failed to remove portal link",
        variant: "destructive",
      });
    },
  });

  // Reinstate portal token mutation
  const reinstatePortalToken = useMutation({
    mutationFn: async (tokenId: number) => {
      const response = await apiRequest('POST', `/api/v2/portal/tokens/${tokenId}/reinstate`);
      return response.json();
    },
    onSuccess: (data) => {
      handleSendResult(data, toast, 'Portal link reinstated', nylasConnectVisible);
      queryClient.invalidateQueries({ queryKey: ['/api/v2/portal/tokens'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error reinstating portal link",
        description: error.message || "Failed to reinstate portal link",
        variant: "destructive",
      });
    },
  });

  // Resend portal email mutation
  const resendPortalEmail = useMutation({
    mutationFn: async (tokenId: number) => {
      const response = await apiRequest('POST', `/api/v2/portal/tokens/${tokenId}/resend-email`);
      return response.json();
    },
    onSuccess: (data) => {
      handleSendResult(data, toast, 'Portal email resent', nylasConnectVisible);
    },
    onError: (error: any) => {
      toast({
        title: "Error sending email",
        description: error.message || "Failed to resend portal email",
        variant: "destructive",
      });
    },
  });

  // Extend deadline mutation
  const extendDeadline = useMutation({
    mutationFn: async ({ tokenId, additionalDays }: { tokenId: number; additionalDays: number }) => {
      const response = await apiRequest('POST', `/api/v2/chase-up/tokens/${tokenId}/extend`, { additionalDays });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Deadline extended",
        description: "The submission deadline has been extended.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/v2/portal/tokens'] });
      setShowExtendModal(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error extending deadline",
        description: error.message || "Failed to extend deadline",
        variant: "destructive",
      });
    },
  });

  // Stop chase-up mutation
  const stopChaseUp = useMutation({
    mutationFn: async (tokenId: number) => {
      const response = await apiRequest('POST', `/api/v2/chase-up/tokens/${tokenId}/stop`, { reason: 'manual_stop' });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Chase-up stopped",
        description: "Automated reminder emails have been stopped for this portal link.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/v2/portal/tokens'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error stopping chase-up",
        description: error.message || "Failed to stop chase-up",
        variant: "destructive",
      });
    },
  });

  // Group portal tokens by company for business overview
  const businessOverview: BusinessOverview[] = React.useMemo(() => {
    const groupedByCompany = portalTokens.reduce((acc, token) => {
      const companyId = token.targetCompanyId;
      if (!acc[companyId]) {
        acc[companyId] = {
          companyId,
          companyName: token.companyName,
          totalLinks: 0,
          activeLinks: 0,
          totalSubmissions: 0,
          tokens: [],
        };
      }
      
      acc[companyId].totalLinks += 1;
      if (token.isActive) acc[companyId].activeLinks += 1;
      acc[companyId].totalSubmissions += token.documentSubmissions;
      acc[companyId].tokens.push(token);
      
      return acc;
    }, {} as Record<number, BusinessOverview>);

    return Object.values(groupedByCompany).sort((a, b) => a.companyName.localeCompare(b.companyName));
  }, [portalTokens]);

  const handleContactToggle = (contactId: number) => {
    // Only allow selecting one contact (primary contact)
    setSelectedContactIds(prev => 
      prev.includes(contactId) 
        ? [] // Deselect if already selected
        : [contactId] // Select only this contact
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyId || selectedContactIds.length === 0) {
      toast({
        title: "Missing information",
        description: "Please select a company and at least one contact.",
        variant: "destructive",
      });
      return;
    }

    createPortalToken.mutate({
      targetCompanyId: selectedCompanyId,
      targetContactId: selectedContactIds[0],
      customMessage: customMessage.trim() || undefined,
      timeframeDays,
      includeNda,
    });
  };

  const showCompanyDetail = (businessId: number) => {
    setSelectedBusinessId(businessId);
    setViewMode('company-detail');
  };

  const goBackToOverview = () => {
    setViewMode('overview');
    setSelectedBusinessId(null);
  };

  // Dashboard stats
  const totalLinks = portalTokens.length;
  const activeLinks = portalTokens.filter(token => token.isActive).length;
  const totalSubmissions = portalTokens.reduce((sum, token) => sum + token.documentSubmissions, 0);
  const selectedBusiness = businessOverview.find(b => b.companyId === selectedBusinessId);

  if (companiesLoading || tokensLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          {viewMode === 'company-detail' && selectedBusiness ? (
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={goBackToOverview} className="flex items-center gap-1">
                <ArrowLeft size={16} />
                Back
              </Button>
              <div>
                <h1 className="text-3xl font-bold">{selectedBusiness.companyName}</h1>
                <p className="text-muted-foreground">Portal links and contact management</p>
              </div>
            </div>
          ) : (
            <div>
              <h1 className="text-3xl font-bold">Portal Management</h1>
              <p className="text-muted-foreground">
                Manage secure document collection links across all target companies
              </p>
            </div>
          )}
        </div>
        {availableCompanies.length > 0 ? (
          <Button onClick={() => setShowCreateForm(true)} className="flex items-center gap-2">
            <Plus size={16} />
            Send Portal Link
          </Button>
        ) : (
          <Button disabled className="flex items-center gap-2">
            <Plus size={16} />
            All Companies Have Links
          </Button>
        )}
      </div>

      {/* Dashboard Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Portal Links</CardTitle>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{viewMode === 'company-detail' ? selectedBusiness?.totalLinks || 0 : totalLinks}</div>
            <p className="text-xs text-muted-foreground">
              {viewMode === 'company-detail' ? 'Links for this company' : 'All portal links created'}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Links</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{viewMode === 'company-detail' ? selectedBusiness?.activeLinks || 0 : activeLinks}</div>
            <p className="text-xs text-muted-foreground">
              Currently accessible portals
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Document Submissions</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{viewMode === 'company-detail' ? selectedBusiness?.totalSubmissions || 0 : totalSubmissions}</div>
            <p className="text-xs text-muted-foreground">
              Total documents received
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Create Portal Link Form */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Send Portal Link</CardTitle>
            <CardDescription>
              Select a target company and contacts to send secure document collection links
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="company">Target Company</Label>
                {availableCompanies.length === 0 ? (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <div className="text-sm text-blue-800">
                      All companies already have portal links. Each company can only have one portal link.
                    </div>
                  </div>
                ) : (
                  <Select value={selectedCompanyId?.toString()} onValueChange={(value) => {
                    setSelectedCompanyId(parseInt(value));
                    setSelectedContactIds([]);
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a company" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCompanies.map((company) => (
                        <SelectItem key={company.id} value={company.id.toString()}>
                          {company.companyName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {selectedCompanyId && (
                <div className="space-y-2">
                  <Label>Primary Contact</Label>
                  {companyHasPortal ? (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                      <div className="text-sm text-yellow-800">
                        This company already has a portal link. Only one portal link per company is allowed.
                      </div>
                    </div>
                  ) : contactsLoading ? (
                    <div className="text-sm text-muted-foreground">Loading contacts...</div>
                  ) : !contactsLoading && primaryContacts.length === 0 ? (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                      <div className="text-sm text-yellow-800">
                        No primary contact found for this company. Portal links can only be sent to primary contacts.
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {primaryContacts.map((contact) => (
                        <div key={contact.id} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`contact-${contact.id}`}
                            checked={selectedContactIds.includes(contact.id)}
                            onChange={() => handleContactToggle(contact.id)}
                            className="rounded border-border"
                          />
                          <label htmlFor={`contact-${contact.id}`} className="text-sm">
                            {contact.firstName} {contact.lastName} ({contact.email})
                            <Badge variant="secondary" className="ml-2">Primary</Badge>
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="timeframe">Submission Timeframe</Label>
                <Select value={timeframeDays.toString()} onValueChange={(value) => setTimeframeDays(parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select timeframe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="14">14 days (Default)</SelectItem>
                    <SelectItem value="21">21 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="45">45 days</SelectItem>
                    <SelectItem value="60">60 days</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Deadline: {new Date(Date.now() + timeframeDays * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Checkbox
                  id="include-nda"
                  checked={includeNda}
                  onCheckedChange={(checked) => setIncludeNda(checked === true)}
                />
                <Label htmlFor="include-nda" className="cursor-pointer">
                  Include NDA — automatically send an NDA to the seller when the portal is created
                </Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Custom Message (Optional)</Label>
                <Textarea
                  id="message"
                  placeholder="Add a custom message for the portal access email..."
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex gap-2">
                <Button 
                  type="submit" 
                  disabled={
                    !selectedCompanyId || 
                    selectedContactIds.length === 0 || 
                    createPortalToken.isPending || 
                    companyHasPortal || 
                    contactsLoading ||
                    (!contactsLoading && primaryContacts.length === 0)
                  }
                >
                  {createPortalToken.isPending ? 'Sending...' : 'Send Portal Link'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowCreateForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Business Overview or Company Detail View */}
      {viewMode === 'overview' ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 size={20} />
              Business Overview
            </CardTitle>
            <CardDescription>
              View portal link activity across all target companies. Click on a company to see detailed contact information.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {businessOverview.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No portal links created yet. Click "Send Portal Link" to get started.
              </div>
            ) : (
              <div className="space-y-3">
                {businessOverview.map((business) => (
                  <div 
                    key={business.companyId} 
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => showCompanyDetail(business.companyId)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-lg">{business.companyName}</h3>
                        <div className="flex gap-2">
                          <Badge variant="outline">{business.totalLinks} Total</Badge>
                          <Badge variant={business.activeLinks > 0 ? "default" : "secondary"}>
                            {business.activeLinks} Active
                          </Badge>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Portal completion status across {business.totalLinks} portal link{business.totalLinks !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <BusinessCompletionDisplay tokens={business.tokens} />
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        selectedBusiness && (
          <Card>
            <CardHeader>
              <CardTitle>Portal Links for {selectedBusiness.companyName}</CardTitle>
              <CardDescription>Individual contacts and their portal access details</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {selectedBusiness.tokens.map((token) => (
                  <div key={token.id} className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold">{token.contactName}</h4>
                          <Badge variant={token.isActive ? "default" : "secondary"}>
                            {token.isActive ? "Active" : "Inactive"}
                          </Badge>
                          <ChaseUpStatusBadge 
                            status={token.chaseUpStatus} 
                            escalationLevel={token.escalationLevel}
                          />
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <div className="flex items-center gap-2">
                            <Mail size={14} />
                            {token.contactEmail}
                          </div>
                          <div className="flex items-center gap-4 flex-wrap">
                            <span>Created: {new Date(token.createdAt).toLocaleDateString()}</span>
                            <span>Expires: {new Date(token.expiresAt).toLocaleDateString()}</span>
                            {token.submissionDeadline && (
                              <span className="font-medium">
                                Deadline: {new Date(token.submissionDeadline).toLocaleDateString()}
                              </span>
                            )}
                            {token.lastAccessed && (
                              <span>Last accessed: {new Date(token.lastAccessed).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <TokenCompletionDisplay accessToken={token.accessToken} />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`/portal/${token.accessToken}`, '_blank')}
                        title="View Portal"
                      >
                        <ExternalLink size={14} className="mr-1" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/portal/${token.accessToken}`);
                          toast({
                            title: "Link copied",
                            description: "Portal link copied to clipboard",
                          });
                        }}
                        title="Copy Link"
                      >
                        Copy
                      </Button>
                      {token.isActive && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => resendPortalEmail.mutate(token.id)}
                            disabled={resendPortalEmail.isPending}
                            title="Resend portal access email"
                          >
                            <Mail size={14} className="mr-1" />
                            {resendPortalEmail.isPending ? '...' : 'Resend'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowExtendModal(token.id)}
                            title="Extend submission deadline"
                          >
                            <CalendarPlus size={14} className="mr-1" />
                            Extend
                          </Button>
                          {token.chaseUpStatus && token.chaseUpStatus !== 'completed' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (confirm('Stop sending reminder emails for this portal link?')) {
                                  stopChaseUp.mutate(token.id);
                                }
                              }}
                              disabled={stopChaseUp.isPending}
                              title="Stop chase-up emails"
                            >
                              <TimerOff size={14} className="mr-1" />
                              Stop Reminders
                            </Button>
                          )}
                        </>
                      )}
                      {token.isActive ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            if (confirm('Are you sure you want to remove this portal link? Document history will be preserved.')) {
                              removePortalToken.mutate(token.id);
                            }
                          }}
                          disabled={removePortalToken.isPending}
                          title="Remove Portal Link"
                        >
                          {removePortalToken.isPending ? '...' : 'Remove'}
                        </Button>
                      ) : (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => reinstatePortalToken.mutate(token.id)}
                          disabled={reinstatePortalToken.isPending}
                          title="Reinstate Portal Link"
                        >
                          {reinstatePortalToken.isPending ? '...' : 'Reinstate'}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )
      )}

      {showExtendModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-96">
            <CardHeader>
              <CardTitle>Extend Deadline</CardTitle>
              <CardDescription>Add more time for document submission</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Additional Days</Label>
                <Select value={extensionDays.toString()} onValueChange={(v) => setExtensionDays(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="14">14 days</SelectItem>
                    <SelectItem value="21">21 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowExtendModal(null)}>
                  Cancel
                </Button>
                <Button 
                  onClick={() => extendDeadline.mutate({ tokenId: showExtendModal, additionalDays: extensionDays })}
                  disabled={extendDeadline.isPending}
                >
                  {extendDeadline.isPending ? 'Extending...' : 'Extend'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}