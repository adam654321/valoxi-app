import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Send, ExternalLink, Copy, Mail, FileText, Users, Building } from "lucide-react";
import { format } from "date-fns";

// Form schema for sending portal links
const portalLinkSchema = z.object({
  targetCompanyId: z.string().min(1, "Please select a target company"),
  contactIds: z.array(z.string()).min(1, "Please select at least one contact"),
  customMessage: z.string().optional(),
});

type PortalLinkForm = z.infer<typeof portalLinkSchema>;

type TargetCompany = {
  id: number;
  companyName: string;
  industry: string;
};

type TargetContact = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  targetCompanyId: number;
  isPrimary: boolean;
};

type PortalToken = {
  id: number;
  accessToken: string;
  targetCompanyId: number;
  contactId: number;
  isActive: boolean;
  expiresAt: string;
  createdAt: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  lastAccessed?: string;
  documentSubmissions: number;
};

export default function PortalManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreatePortalOpen, setIsCreatePortalOpen] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  
  // Form setup
  const form = useForm<PortalLinkForm>({
    resolver: zodResolver(portalLinkSchema),
    defaultValues: {
      targetCompanyId: "",
      contactIds: [],
      customMessage: "",
    },
  });

  // Fetch target companies
  const { data: companies = [], isLoading: companiesLoading } = useQuery<TargetCompany[]>({
    queryKey: ['/api/target-companies'],
    enabled: true,
  });

  // Fetch contacts for selected company
  const { data: contacts = [], isLoading: contactsLoading } = useQuery<TargetContact[]>({
    queryKey: ['/api/target-contacts/by-company', selectedCompanyId],
    enabled: !!selectedCompanyId,
  });

  // Fetch existing portal tokens
  const { data: portalTokens = [], isLoading: tokensLoading, refetch: refetchTokens } = useQuery<PortalToken[]>({
    queryKey: ['/api/portal-tokens'],
    enabled: true,
  });

  // Create portal link mutation
  const createPortalMutation = useMutation({
    mutationFn: async (data: PortalLinkForm) => {
      const response = await fetch('/api/portal-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetCompanyId: parseInt(data.targetCompanyId),
          contactIds: data.contactIds.map(id => parseInt(id)),
          customMessage: data.customMessage,
        }),
      });
      if (!response.ok) throw new Error('Failed to create portal link');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Portal link created and sent successfully" });
      setIsCreatePortalOpen(false);
      form.reset();
      setSelectedCompanyId("");
      refetchTokens();
    },
    onError: (error: any) => {
      toast({ title: "Failed to create portal link", description: error.message, variant: "destructive" });
    },
  });

  // Copy portal link to clipboard
  const copyPortalLink = (token: string) => {
    const link = `${window.location.origin}/portal/${token}`;
    navigator.clipboard.writeText(link);
    toast({ title: "Portal link copied to clipboard" });
  };

  const onSubmit = (data: PortalLinkForm) => {
    createPortalMutation.mutate(data);
  };

  // Handle company selection
  const handleCompanyChange = (companyId: string) => {
    setSelectedCompanyId(companyId);
    form.setValue('targetCompanyId', companyId);
    form.setValue('contactIds', []); // Reset contacts when company changes
  };

  // Stats calculations
  const totalPortalLinks = portalTokens.length;
  const activePortalLinks = portalTokens.filter(token => token.isActive).length;
  const companiesWithPortals = new Set(portalTokens.map(token => token.targetCompanyId)).size;
  const totalSubmissions = portalTokens.reduce((sum, token) => sum + token.documentSubmissions, 0);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Portal Management</h1>
          <p className="text-muted-foreground">Send secure document portal links to target companies</p>
        </div>
        
        <Dialog open={isCreatePortalOpen} onOpenChange={setIsCreatePortalOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Send Portal Link
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Send Portal Link</DialogTitle>
              <DialogDescription>
                Send a secure document portal link to target company contacts
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="targetCompanyId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Company</FormLabel>
                      <Select onValueChange={handleCompanyChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select target company" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {companies.map((company) => (
                            <SelectItem key={company.id} value={company.id.toString()}>
                              {company.companyName} - {company.industry}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contactIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contacts</FormLabel>
                      <div className="space-y-2">
                        {contactsLoading && selectedCompanyId && (
                          <p className="text-sm text-muted-foreground">Loading contacts...</p>
                        )}
                        {contacts.map((contact) => (
                          <div key={contact.id} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={`contact-${contact.id}`}
                              checked={field.value.includes(contact.id.toString())}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  field.onChange([...field.value, contact.id.toString()]);
                                } else {
                                  field.onChange(field.value.filter(id => id !== contact.id.toString()));
                                }
                              }}
                              className="rounded"
                            />
                            <Label htmlFor={`contact-${contact.id}`} className="text-sm">
                              {contact.firstName} {contact.lastName} ({contact.email})
                              {contact.isPrimary && <span className="text-blue-600 ml-1">(Primary)</span>}
                            </Label>
                          </div>
                        ))}
                        {selectedCompanyId && contacts.length === 0 && !contactsLoading && (
                          <p className="text-sm text-muted-foreground">No contacts found for this company</p>
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="customMessage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Custom Message (Optional)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Add a personal message to include in the email..."
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsCreatePortalOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createPortalMutation.isPending}>
                    {createPortalMutation.isPending ? "Sending..." : "Send Portal Link"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Portal Links</CardTitle>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPortalLinks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Links</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activePortalLinks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Companies with Portals</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{companiesWithPortals}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Submissions</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSubmissions}</div>
          </CardContent>
        </Card>
      </div>

      {/* Portal Links Table */}
      <Card>
        <CardHeader>
          <CardTitle>Portal Links</CardTitle>
          <CardDescription>Manage active portal links sent to target companies</CardDescription>
        </CardHeader>
        <CardContent>
          {tokensLoading ? (
            <div className="text-center py-8">Loading portal links...</div>
          ) : portalTokens.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No portal links created yet</p>
              <Button 
                className="mt-4" 
                onClick={() => setIsCreatePortalOpen(true)}
              >
                Send Your First Portal Link
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {portalTokens.map((token) => (
                <div key={token.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{token.companyName}</h3>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        token.isActive 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                      }`}>
                        {token.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {token.contactName} ({token.contactEmail})
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Created {format(new Date(token.createdAt), "MMM dd, yyyy")} • 
                      Expires {format(new Date(token.expiresAt), "MMM dd, yyyy")} •
                      {token.documentSubmissions} documents submitted
                    </p>
                    {token.lastAccessed && (
                      <p className="text-sm text-muted-foreground">
                        Last accessed {format(new Date(token.lastAccessed), "MMM dd, yyyy 'at' HH:mm")}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyPortalLink(token.accessToken)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(`/portal/${token.accessToken}`, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
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