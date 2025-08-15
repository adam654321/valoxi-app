import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Send, Edit, Trash2, Eye, Mail, Calendar, TrendingUp, Users, ExternalLink, Copy } from "lucide-react";
import { format } from "date-fns";

// Form schemas
const campaignSchema = z.object({
  name: z.string().min(1, "Campaign name is required"),
  description: z.string().optional(),
  status: z.enum(["draft", "active", "paused", "completed"]),
  targetAudience: z.string().optional(),
  startDate: z.string().optional().transform(val => val === "" ? undefined : val),
  endDate: z.string().optional().transform(val => val === "" ? undefined : val),
});

const emailTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  description: z.string().optional(),
  subject: z.string().min(1, "Subject is required"),
  bodyTemplate: z.string().min(1, "Email body is required"),
  templateCategory: z.enum(["initial_outreach", "follow_up", "reminder", "thank_you", "custom"]),
  isActive: z.boolean().default(true),
});

type Campaign = {
  id: number;
  name: string;
  description?: string;
  status: "draft" | "active" | "paused" | "completed";
  targetAudience?: string;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: number;
  userCompanyId: number;
};

type EmailTemplate = {
  id: number;
  name: string;
  description?: string;
  subject: string;
  bodyTemplate: string;
  templateCategory: "initial_outreach" | "follow_up" | "reminder" | "thank_you" | "custom";
  isActive: boolean;
  usageCount: number;
  lastUsed?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: number;
  userCompanyId: number;
};

type Communication = {
  id: number;
  campaignId?: number;
  targetContactId: number;
  communicationType: string;
  subject?: string;
  message?: string;
  emailStatus?: string;
  sentAt?: string;
  deliveredAt?: string;
  openedAt?: string;
  clickedAt?: string;
  createdAt: string;
};

type Analytics = {
  id: number;
  userCompanyId: number;
  analyticsDate: string;
  targetCompanyId?: number;
  portalTokenId?: number;
  uniqueVisitors: number;
  totalPageViews: number;
  documentsViewed: number;
  documentsDownloaded: number;
  averageSessionDuration: number;
  emailsSent: number;
  emailsOpened: number;
  emailsClicked: number;
  portalLinksGenerated: number;
  portalLinksShared: number;
  conversionRate: number;
  createdAt: string;
  updatedAt: string;
};

export default function PortalManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [isCreateCampaignOpen, setIsCreateCampaignOpen] = useState(false);
  const [isCreateTemplateOpen, setIsCreateTemplateOpen] = useState(false);
  const [isSendEmailOpen, setIsSendEmailOpen] = useState(false);

  // Fetch campaigns
  const { data: campaigns = [], isLoading: campaignsLoading } = useQuery<Campaign[]>({
    queryKey: ["/api/portal/campaigns"],
  });

  // Fetch email templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery<EmailTemplate[]>({
    queryKey: ["/api/portal/email-templates"],
  });

  // Fetch communications log
  const { data: communications = [], isLoading: communicationsLoading } = useQuery<Communication[]>({
    queryKey: ["/api/portal/communications"],
  });

  // Fetch analytics
  const { data: analytics = [], isLoading: analyticsLoading } = useQuery<Analytics[]>({
    queryKey: ["/api/portal/analytics"],
  });

  // Create campaign mutation
  const createCampaignMutation = useMutation({
    mutationFn: async (data: z.infer<typeof campaignSchema>) => {
      const response = await fetch("/api/portal/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create campaign");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal/campaigns"] });
      setIsCreateCampaignOpen(false);
      toast({ title: "Campaign created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create campaign", variant: "destructive" });
    },
  });

  // Create template mutation
  const createTemplateMutation = useMutation({
    mutationFn: async (data: z.infer<typeof emailTemplateSchema>) => {
      const response = await fetch("/api/portal/email-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create template");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal/email-templates"] });
      setIsCreateTemplateOpen(false);
      toast({ title: "Email template created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create email template", variant: "destructive" });
    },
  });

  // Delete campaign mutation
  const deleteCampaignMutation = useMutation({
    mutationFn: async (campaignId: number) => {
      const response = await fetch(`/api/portal/campaigns/${campaignId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete campaign");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal/campaigns"] });
      toast({ title: "Campaign deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete campaign", variant: "destructive" });
    },
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: number) => {
      const response = await fetch(`/api/portal/email-templates/${templateId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete template");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal/email-templates"] });
      toast({ title: "Email template deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete email template", variant: "destructive" });
    },
  });

  const campaignForm = useForm<z.infer<typeof campaignSchema>>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      status: "draft",
      name: "",
      description: "",
      targetAudience: "",
      startDate: "",
      endDate: "",
    },
  });

  const templateForm = useForm<z.infer<typeof emailTemplateSchema>>({
    resolver: zodResolver(emailTemplateSchema),
    defaultValues: {
      name: "",
      description: "",
      subject: "",
      bodyTemplate: "",
      templateCategory: "initial_outreach",
      isActive: true,
    },
  });

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "active": return "default";
      case "draft": return "secondary";
      case "paused": return "outline";
      case "completed": return "outline";
      default: return "secondary";
    }
  };

  const getCategoryBadgeVariant = (category: string) => {
    switch (category) {
      case "initial_outreach": return "default";
      case "follow_up": return "secondary";
      case "reminder": return "outline";
      case "thank_you": return "outline";
      default: return "secondary";
    }
  };

  // Calculate analytics summary
  const analyticsSummary = analytics.reduce((acc, item) => ({
    totalVisitors: acc.totalVisitors + item.uniqueVisitors,
    totalEmailsSent: acc.totalEmailsSent + item.emailsSent,
    totalEmailsOpened: acc.totalEmailsOpened + item.emailsOpened,
    totalLinksGenerated: acc.totalLinksGenerated + item.portalLinksGenerated,
    avgConversionRate: (acc.avgConversionRate + item.conversionRate) / 2,
  }), {
    totalVisitors: 0,
    totalEmailsSent: 0,
    totalEmailsOpened: 0,
    totalLinksGenerated: 0,
    avgConversionRate: 0,
  });

  return (
    <div className="space-y-6" data-testid="portal-management-page">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Portal Management</h1>
          <p className="text-muted-foreground">
            Manage portal link campaigns, email templates, and track analytics
          </p>
        </div>
      </div>

      {/* Analytics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Visitors</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsSummary.totalVisitors}</div>
            <p className="text-xs text-muted-foreground">Unique portal visitors</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Emails Sent</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsSummary.totalEmailsSent}</div>
            <p className="text-xs text-muted-foreground">Total campaign emails</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Email Open Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analyticsSummary.totalEmailsSent > 0 
                ? Math.round((analyticsSummary.totalEmailsOpened / analyticsSummary.totalEmailsSent) * 100)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground">Email engagement rate</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Portal Links</CardTitle>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsSummary.totalLinksGenerated}</div>
            <p className="text-xs text-muted-foreground">Links generated</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="campaigns" className="space-y-4">
        <TabsList>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="templates">Email Templates</TabsTrigger>
          <TabsTrigger value="communications">Communications</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Campaigns Tab */}
        <TabsContent value="campaigns" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Portal Link Campaigns</h2>
            <Dialog open={isCreateCampaignOpen} onOpenChange={setIsCreateCampaignOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-campaign">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Campaign
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create New Campaign</DialogTitle>
                  <DialogDescription>
                    Create a new portal link campaign to organize your outreach efforts.
                  </DialogDescription>
                </DialogHeader>
                <Form {...campaignForm}>
                  <form onSubmit={campaignForm.handleSubmit((data) => createCampaignMutation.mutate(data))} className="space-y-4">
                    <FormField
                      control={campaignForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Campaign Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Q1 2024 Outreach Campaign" {...field} data-testid="input-campaign-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={campaignForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Campaign description and objectives..." {...field} data-testid="input-campaign-description" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={campaignForm.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Status</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-campaign-status">
                                  <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="draft">Draft</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="paused">Paused</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={campaignForm.control}
                        name="targetAudience"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Target Audience</FormLabel>
                            <FormControl>
                              <Input placeholder="Healthcare companies" {...field} data-testid="input-target-audience" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={campaignForm.control}
                        name="startDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Start Date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} data-testid="input-start-date" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={campaignForm.control}
                        name="endDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>End Date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} data-testid="input-end-date" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button type="button" variant="outline" onClick={() => setIsCreateCampaignOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createCampaignMutation.isPending} data-testid="button-save-campaign">
                        {createCampaignMutation.isPending ? "Creating..." : "Create Campaign"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          {campaignsLoading ? (
            <div className="text-center py-8">Loading campaigns...</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {campaigns.map((campaign) => (
                <Card key={campaign.id} className="relative" data-testid={`card-campaign-${campaign.id}`}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{campaign.name}</CardTitle>
                        <CardDescription>{campaign.description}</CardDescription>
                      </div>
                      <Badge variant={getStatusBadgeVariant(campaign.status)}>
                        {campaign.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {campaign.targetAudience && (
                      <p className="text-sm text-muted-foreground">
                        <strong>Target:</strong> {campaign.targetAudience}
                      </p>
                    )}
                    {campaign.startDate && (
                      <p className="text-sm text-muted-foreground">
                        <strong>Start:</strong> {format(new Date(campaign.startDate), "MMM dd, yyyy")}
                      </p>
                    )}
                    <div className="flex justify-between items-center pt-2">
                      <p className="text-xs text-muted-foreground">
                        Created {format(new Date(campaign.createdAt), "MMM dd, yyyy")}
                      </p>
                      <div className="flex space-x-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedCampaign(campaign)}
                          data-testid={`button-view-campaign-${campaign.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteCampaignMutation.mutate(campaign.id)}
                          data-testid={`button-delete-campaign-${campaign.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Email Templates Tab */}
        <TabsContent value="templates" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Email Templates</h2>
            <Dialog open={isCreateTemplateOpen} onOpenChange={setIsCreateTemplateOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-template">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Template
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Create Email Template</DialogTitle>
                  <DialogDescription>
                    Create a reusable email template for your portal campaigns.
                  </DialogDescription>
                </DialogHeader>
                <Form {...templateForm}>
                  <form onSubmit={templateForm.handleSubmit((data) => createTemplateMutation.mutate(data))} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={templateForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Template Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Initial Outreach Template" {...field} data-testid="input-template-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={templateForm.control}
                        name="templateCategory"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Category</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-template-category">
                                  <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="initial_outreach">Initial Outreach</SelectItem>
                                <SelectItem value="follow_up">Follow Up</SelectItem>
                                <SelectItem value="reminder">Reminder</SelectItem>
                                <SelectItem value="thank_you">Thank You</SelectItem>
                                <SelectItem value="custom">Custom</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={templateForm.control}
                      name="subject"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Subject</FormLabel>
                          <FormControl>
                            <Input placeholder="Portal Access for {company_name}" {...field} data-testid="input-template-subject" />
                          </FormControl>
                          <FormDescription>
                            Use variables: {"{contact_name}"}, {"{company_name}"}, {"{portal_link}"}, {"{campaign_name}"}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={templateForm.control}
                      name="bodyTemplate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Body</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Dear {contact_name},&#10;&#10;We are pleased to provide you with secure access to our document portal...&#10;&#10;Access your portal here: {portal_link}&#10;&#10;Best regards"
                              rows={8}
                              {...field} 
                              data-testid="input-template-body"
                            />
                          </FormControl>
                          <FormDescription>
                            Use the same variables as subject line for personalization
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={templateForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Template description and usage notes..." {...field} data-testid="input-template-description" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end space-x-2">
                      <Button type="button" variant="outline" onClick={() => setIsCreateTemplateOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createTemplateMutation.isPending} data-testid="button-save-template">
                        {createTemplateMutation.isPending ? "Creating..." : "Create Template"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          {templatesLoading ? (
            <div className="text-center py-8">Loading templates...</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {templates.map((template) => (
                <Card key={template.id} className="relative" data-testid={`card-template-${template.id}`}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                        <CardDescription>{template.description}</CardDescription>
                      </div>
                      <Badge variant={getCategoryBadgeVariant(template.templateCategory)}>
                        {template.templateCategory.replace('_', ' ')}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm font-medium">Subject: {template.subject}</p>
                    <p className="text-sm text-muted-foreground">
                      Used {template.usageCount} times
                      {template.lastUsed && ` • Last used ${format(new Date(template.lastUsed), "MMM dd, yyyy")}`}
                    </p>
                    <div className="flex justify-between items-center pt-2">
                      <Badge variant={template.isActive ? "default" : "secondary"}>
                        {template.isActive ? "Active" : "Inactive"}
                      </Badge>
                      <div className="flex space-x-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedTemplate(template)}
                          data-testid={`button-view-template-${template.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteTemplateMutation.mutate(template.id)}
                          data-testid={`button-delete-template-${template.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Communications Tab */}
        <TabsContent value="communications" className="space-y-4">
          <h2 className="text-xl font-semibold">Communications Log</h2>
          {communicationsLoading ? (
            <div className="text-center py-8">Loading communications...</div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b">
                      <tr className="text-left">
                        <th className="p-4 font-medium">Date</th>
                        <th className="p-4 font-medium">Type</th>
                        <th className="p-4 font-medium">Subject</th>
                        <th className="p-4 font-medium">Status</th>
                        <th className="p-4 font-medium">Contact</th>
                      </tr>
                    </thead>
                    <tbody>
                      {communications.map((communication) => (
                        <tr key={communication.id} className="border-b hover:bg-muted/50" data-testid={`row-communication-${communication.id}`}>
                          <td className="p-4">
                            {format(new Date(communication.createdAt), "MMM dd, yyyy HH:mm")}
                          </td>
                          <td className="p-4">
                            <Badge variant="outline">{communication.communicationType}</Badge>
                          </td>
                          <td className="p-4">{communication.subject || "-"}</td>
                          <td className="p-4">
                            <Badge variant={communication.emailStatus === "sent" ? "default" : "secondary"}>
                              {communication.emailStatus || "pending"}
                            </Badge>
                          </td>
                          <td className="p-4">Contact #{communication.targetContactId}</td>
                        </tr>
                      ))}
                      {communications.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-muted-foreground">
                            No communications logged yet
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <h2 className="text-xl font-semibold">Portal Analytics</h2>
          {analyticsLoading ? (
            <div className="text-center py-8">Loading analytics...</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {analytics.map((analytic) => (
                <Card key={analytic.id} data-testid={`card-analytics-${analytic.id}`}>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      {format(new Date(analytic.analyticsDate), "MMM dd, yyyy")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Visitors</p>
                        <p className="font-semibold">{analytic.uniqueVisitors}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Page Views</p>
                        <p className="font-semibold">{analytic.totalPageViews}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Docs Viewed</p>
                        <p className="font-semibold">{analytic.documentsViewed}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Downloads</p>
                        <p className="font-semibold">{analytic.documentsDownloaded}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Emails Sent</p>
                        <p className="font-semibold">{analytic.emailsSent}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Conversion</p>
                        <p className="font-semibold">{analytic.conversionRate.toFixed(1)}%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {analytics.length === 0 && (
                <Card className="col-span-full">
                  <CardContent className="p-8 text-center text-muted-foreground">
                    No analytics data available yet
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}