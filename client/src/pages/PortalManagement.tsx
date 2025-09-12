import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Users, FileText, Clock, Mail, Plus, ChevronRight, ArrowLeft, Building2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

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
    queryKey: [`/api/portal/${accessToken}/analysis-completion`],
    enabled: !!accessToken,
    refetchInterval: 10000, // Refresh every 10 seconds
  });
}

// Component to display completion percentage for a token
function TokenCompletionDisplay({ accessToken }: { accessToken: string }) {
  const { data: completionData, isLoading } = useTokenCompletion(accessToken);
  
  if (isLoading) {
    return (
      <div className="text-center">
        <div className="text-xl font-bold text-gray-400">...</div>
        <div className="text-xs text-muted-foreground">Loading</div>
      </div>
    );
  }
  
  if (!completionData) {
    return (
      <div className="text-center">
        <div className="text-xl font-bold text-gray-400">N/A</div>
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

export default function PortalManagement() {
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [selectedContactIds, setSelectedContactIds] = useState<number[]>([]);
  const [customMessage, setCustomMessage] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [viewMode, setViewMode] = useState<'overview' | 'company-detail'>('overview');
  const [selectedBusinessId, setSelectedBusinessId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch target companies
  const { data: companies = [], isLoading: companiesLoading } = useQuery<TargetCompany[]>({
    queryKey: ['/api/target-companies'],
  });

  // Fetch contacts for selected company
  const { data: contacts = [], isLoading: contactsLoading } = useQuery<Contact[]>({
    queryKey: ['/api/target-companies', selectedCompanyId, 'contacts'],
    enabled: !!selectedCompanyId,
  });

  // Fetch existing portal tokens
  const { data: portalTokens = [], isLoading: tokensLoading } = useQuery<PortalToken[]>({
    queryKey: ['/api/portal-tokens'],
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
      contactIds: number[];
      customMessage?: string;
    }) => {
      const response = await fetch('/api/portal-tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create portal token');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Portal link created successfully",
        description: "Portal access email has been sent to the primary contact.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/portal-tokens'] });
      setShowCreateForm(false);
      setSelectedCompanyId(null);
      setSelectedContactIds([]);
      setCustomMessage('');
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
      const response = await fetch(`/api/portal/deactivate/${tokenId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to remove portal token');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Portal link removed",
        description: "The portal link has been deactivated and removed.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/portal-tokens'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error removing portal link",
        description: error.message || "Failed to remove portal link",
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
      contactIds: selectedContactIds,
      customMessage: customMessage.trim() || undefined,
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
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
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
                            className="rounded border-gray-300"
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
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
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
                        {business.totalSubmissions} document{business.totalSubmissions !== 1 ? 's' : ''} submitted across {business.totalLinks} portal link{business.totalLinks !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-2xl font-bold text-blue-600">{business.totalSubmissions}</div>
                        <div className="text-xs text-muted-foreground">Documents</div>
                      </div>
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
                  <div key={token.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold">{token.contactName}</h4>
                        <Badge variant={token.isActive ? "default" : "secondary"}>
                          {token.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div className="flex items-center gap-2">
                          <Mail size={14} />
                          {token.contactEmail}
                        </div>
                        <div className="flex items-center gap-4">
                          <span>Created: {new Date(token.createdAt).toLocaleDateString()}</span>
                          <span>Expires: {new Date(token.expiresAt).toLocaleDateString()}</span>
                          {token.lastAccessed && (
                            <span>Last accessed: {new Date(token.lastAccessed).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <TokenCompletionDisplay accessToken={token.accessToken} />
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(`/portal/${token.accessToken}`, '_blank')}
                          title="View Portal"
                        >
                          <ExternalLink size={14} />
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
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            if (confirm('Are you sure you want to remove this portal link? This action cannot be undone.')) {
                              removePortalToken.mutate(token.id);
                            }
                          }}
                          disabled={removePortalToken.isPending}
                          title="Remove Portal Link"
                        >
                          {removePortalToken.isPending ? '...' : 'Remove'}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )
      )}
    </div>
  );
}