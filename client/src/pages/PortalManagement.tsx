import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Link2, Plus, Settings, Users, FileText, Activity, Calendar, Copy, ExternalLink, Trash2 } from 'lucide-react';

interface TargetCompany {
  id: number;
  companyName: string;
  industry?: string;
  stage?: string;
}

interface TargetContact {
  id: number;
  targetCompanyId: number;
  firstName: string;
  lastName: string;
  email?: string;
  title?: string;
}

interface PortalToken {
  id: number;
  targetCompanyId: number;
  targetContactId: number;
  accessToken: string;
  tokenPurpose: string;
  expiresAt: string;
  isActive: boolean;
  accessCount: number;
  lastAccessed?: string;
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
  // Relations
  companyName?: string;
  contactName?: string;
  contactEmail?: string;
}

export default function PortalManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCompany, setSelectedCompany] = useState<number | null>(null);
  const [selectedContact, setSelectedContact] = useState<number | null>(null);
  const [tokenForm, setTokenForm] = useState({
    tokenPurpose: 'document_submission',
    expiresInDays: 30,
    allowedActions: {
      upload: true,
      download: false,
      message: true,
    },
    customMessage: '',
    portalBranding: {
      companyName: '',
      logoUrl: '',
      primaryColor: '#2563eb',
    },
  });

  // Queries
  const { data: companies = [] } = useQuery<TargetCompany[]>({
    queryKey: ['/api/target-companies'],
  });

  const { data: contacts = [], isLoading: contactsLoading } = useQuery<TargetContact[]>({
    queryKey: ['/api/target-companies/contacts', selectedCompany],
    queryFn: async () => {
      if (!selectedCompany) return [];
      const response = await fetch(`/api/target-companies/contacts/${selectedCompany}`);
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!selectedCompany,
  });

  const { data: portalTokens = [] } = useQuery<PortalToken[]>({
    queryKey: ['/api/portal/tokens'],
  });

  // Mutations
  const createTokenMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('POST', '/api/portal/create-token', {
        targetCompanyId: selectedCompany,
        targetContactId: selectedContact,
        ...data,
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Portal Created",
        description: `Portal access token created successfully. Token expires on ${new Date(data.expiresAt).toLocaleDateString()}.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/portal/tokens'] });
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Creation Failed",
        description: error.message || "Failed to create portal token",
        variant: "destructive",
      });
    },
  });

  const deactivateTokenMutation = useMutation({
    mutationFn: async (tokenId: number) => {
      return await apiRequest('POST', `/api/portal/deactivate/${tokenId}`);
    },
    onSuccess: () => {
      toast({
        title: "Portal Deactivated",
        description: "Portal access has been deactivated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/portal/tokens'] });
    },
    onError: (error: any) => {
      toast({
        title: "Deactivation Failed",
        description: error.message || "Failed to deactivate portal",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setSelectedCompany(null);
    setSelectedContact(null);
    setTokenForm({
      tokenPurpose: 'document_submission',
      expiresInDays: 30,
      allowedActions: {
        upload: true,
        download: false,
        message: true,
      },
      customMessage: '',
      portalBranding: {
        companyName: '',
        logoUrl: '',
        primaryColor: '#2563eb',
      },
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedCompany || !selectedContact) {
      toast({
        title: "Missing Information",
        description: "Please select both a target company and contact.",
        variant: "destructive",
      });
      return;
    }

    createTokenMutation.mutate(tokenForm);
  };

  const copyPortalUrl = (token: string) => {
    const url = `${window.location.origin}/portal/${token}`;
    navigator.clipboard.writeText(url);
    toast({
      title: "URL Copied",
      description: "Portal URL has been copied to your clipboard.",
    });
  };

  const getStatusBadge = (token: PortalToken) => {
    const isExpired = new Date(token.expiresAt) < new Date();
    const isInactive = !token.isActive;
    
    if (isInactive) {
      return <Badge variant="destructive">Deactivated</Badge>;
    } else if (isExpired) {
      return <Badge variant="outline" className="border-yellow-600 text-yellow-600">Expired</Badge>;
    } else {
      return <Badge variant="default" className="bg-green-600">Active</Badge>;
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Portal Management</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Create and manage secure document submission portals for external parties.
          </p>
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Create Portal
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Document Portal</DialogTitle>
              <DialogDescription>
                Set up a secure portal for external document submission and communication.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="company-select">Target Company</Label>
                  <Select value={selectedCompany?.toString() || ''} onValueChange={(value) => {
                    setSelectedCompany(parseInt(value));
                    setSelectedContact(null);
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select company..." />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id.toString()}>
                          {company.companyName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="contact-select">Primary Contact</Label>
                  <Select 
                    value={selectedContact?.toString() || ''} 
                    onValueChange={(value) => setSelectedContact(parseInt(value))}
                    disabled={!selectedCompany}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select contact..." />
                    </SelectTrigger>
                    <SelectContent>
                      {contactsLoading ? (
                        <SelectItem value="loading" disabled>Loading contacts...</SelectItem>
                      ) : Array.isArray(contacts) && contacts.length > 0 ? (
                        contacts.map((contact) => (
                          <SelectItem key={contact.id} value={contact.id.toString()}>
                            {contact.firstName} {contact.lastName}
                            {contact.email && ` (${contact.email})`}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no-contacts" disabled>No contacts found</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="purpose">Portal Purpose</Label>
                  <Input
                    id="purpose"
                    value={tokenForm.tokenPurpose}
                    onChange={(e) => setTokenForm({ ...tokenForm, tokenPurpose: e.target.value })}
                    placeholder="e.g., Due Diligence Documents"
                  />
                </div>

                <div>
                  <Label htmlFor="expires">Expires In (Days)</Label>
                  <Input
                    id="expires"
                    type="number"
                    min="1"
                    max="90"
                    value={tokenForm.expiresInDays}
                    onChange={(e) => setTokenForm({ ...tokenForm, expiresInDays: parseInt(e.target.value) || 30 })}
                  />
                </div>
              </div>

              <div>
                <Label>Allowed Actions</Label>
                <div className="flex items-center space-x-6 mt-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={tokenForm.allowedActions.upload}
                      onCheckedChange={(checked) => setTokenForm({
                        ...tokenForm,
                        allowedActions: { ...tokenForm.allowedActions, upload: checked }
                      })}
                    />
                    <Label>Document Upload</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={tokenForm.allowedActions.download}
                      onCheckedChange={(checked) => setTokenForm({
                        ...tokenForm,
                        allowedActions: { ...tokenForm.allowedActions, download: checked }
                      })}
                    />
                    <Label>Document Download</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={tokenForm.allowedActions.message}
                      onCheckedChange={(checked) => setTokenForm({
                        ...tokenForm,
                        allowedActions: { ...tokenForm.allowedActions, message: checked }
                      })}
                    />
                    <Label>Messaging</Label>
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="custom-message">Custom Welcome Message (Optional)</Label>
                <Textarea
                  id="custom-message"
                  value={tokenForm.customMessage}
                  onChange={(e) => setTokenForm({ ...tokenForm, customMessage: e.target.value })}
                  placeholder="Welcome to our secure document portal. Please upload the requested due diligence materials..."
                  rows={3}
                />
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Portal Branding (Optional)</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="brand-company">Display Company Name</Label>
                    <Input
                      id="brand-company"
                      value={tokenForm.portalBranding.companyName}
                      onChange={(e) => setTokenForm({
                        ...tokenForm,
                        portalBranding: { ...tokenForm.portalBranding, companyName: e.target.value }
                      })}
                      placeholder="Your Company Name"
                    />
                  </div>

                  <div>
                    <Label htmlFor="brand-color">Primary Color</Label>
                    <Input
                      id="brand-color"
                      type="color"
                      value={tokenForm.portalBranding.primaryColor}
                      onChange={(e) => setTokenForm({
                        ...tokenForm,
                        portalBranding: { ...tokenForm.portalBranding, primaryColor: e.target.value }
                      })}
                    />
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button 
                  type="submit" 
                  disabled={createTokenMutation.isPending || !selectedCompany || !selectedContact}
                >
                  {createTokenMutation.isPending ? 'Creating...' : 'Create Portal'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Portal Tokens List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            Active Portals
          </CardTitle>
          <CardDescription>
            Manage your external document submission portals.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {portalTokens.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Link2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No portals created yet.</p>
              <p className="text-sm">Create your first portal to get started.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {portalTokens.map((token) => (
                <div key={token.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {token.companyName || 'Unknown Company'}
                        </h4>
                        {getStatusBadge(token)}
                      </div>
                      
                      <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                        <p><strong>Contact:</strong> {token.contactName || 'Unknown Contact'}</p>
                        <p><strong>Purpose:</strong> {token.tokenPurpose}</p>
                        <p><strong>Expires:</strong> {new Date(token.expiresAt).toLocaleDateString()}</p>
                        <p><strong>Access Count:</strong> {token.accessCount}</p>
                        {token.lastAccessed && (
                          <p><strong>Last Accessed:</strong> {new Date(token.lastAccessed).toLocaleString()}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-3">
                        {token.allowedActions.upload && (
                          <Badge variant="outline" className="text-xs">
                            <FileText className="w-3 h-3 mr-1" />
                            Upload
                          </Badge>
                        )}
                        {token.allowedActions.download && (
                          <Badge variant="outline" className="text-xs">
                            <FileText className="w-3 h-3 mr-1" />
                            Download
                          </Badge>
                        )}
                        {token.allowedActions.message && (
                          <Badge variant="outline" className="text-xs">
                            <Activity className="w-3 h-3 mr-1" />
                            Message
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyPortalUrl(token.accessToken)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(`/portal/${token.accessToken}`, '_blank')}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>

                      {token.isActive && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deactivateTokenMutation.mutate(token.id)}
                          disabled={deactivateTokenMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}