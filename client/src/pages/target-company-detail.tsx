import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, Plus, Edit, Trash2, Mail, Phone, User, MapPin, Globe, Calendar, Users, DollarSign, Building2, ExternalLink, TrendingUp, FileText, RefreshCw, BarChart, CheckCircle, AlertTriangle, BarChart3, ChevronDown } from "lucide-react";
import type { TargetCompany, TargetContact, Stage1AnalysisEvent } from "@shared/schema";
import { DealTeamManagement } from "@/components/deal-team-management";
import { PipelineStageManagement } from "@/components/pipeline-stage-management";
import { ActivityManagement } from "@/components/activity-management";
import { DocumentManagement } from "@/components/document-management";
import { DetailedAnalysisDisplay } from "@/components/detailed-analysis-display";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Enhanced profile interface to match the backend CompanyProfile
interface CompanyProfile extends TargetCompany {
  createdByName: string;
  userCompanyName: string;
  totalContacts: number;
  primaryContactName: string | null;
  primaryContactEmail: string | null;
  primaryContactPhone: string | null;
  primaryContactTitle: string | null;
  yearsInBusiness: number | null;
  revenuePerEmployee: number | null;
  contacts: TargetContact[];
}

// Contact form schema
const contactSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  title: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  isPrimary: z.boolean().default(false),
  notes: z.string().optional(),
});

type ContactFormData = z.infer<typeof contactSchema>;

export default function TargetCompanyDetail() {
  const { id } = useParams();
  const { toast } = useToast();
  const [showContactForm, setShowContactForm] = useState(false);
  const [editingContact, setEditingContact] = useState<TargetContact | null>(null);

  const contactForm = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      title: "",
      email: "",
      phone: "",
      isPrimary: false,
      notes: "",
    },
  });

  // Get comprehensive company profile with enhanced data
  const { data: profile, isLoading: profileLoading, isFetching: profileFetching, refetch: refetchProfile } = useQuery<CompanyProfile>({
    queryKey: ["/api/target-companies", id, "profile"],
    enabled: !!id,
    // More aggressive polling for website analysis
    refetchInterval: (query) => {
      // Get the actual profile data from the query state
      const data = query?.state?.data as CompanyProfile | undefined;
      
      // Only log when checking for website analysis
      if (!data?.websiteAnalysis) {
        console.log('Checking for website analysis...', { 
          companyId: id,
          hasWebsite: !!data?.website 
        });
      }
      
      // Poll every 5 seconds if no website analysis is available yet
      if (!data?.websiteAnalysis) {
        return 5000; // 5 seconds for faster updates
      }
      return false; // Stop polling once analysis is available
    },
    refetchIntervalInBackground: false,
    // Don't use stale data
    staleTime: 0,
    // Force refetch on mount
    refetchOnMount: 'always',
  });

  // Get stage 1 analysis events
  const { data: stage1Events = [], isLoading: analysisLoading } = useQuery<Stage1AnalysisEvent[]>({
    queryKey: ["/api/target-companies", id, "stage1-analysis"],
    enabled: !!id,
    refetchInterval: 30000, // Poll every 30 seconds for new Stage 1 analysis results
    refetchIntervalInBackground: false, // Only poll when tab is active
    staleTime: 10000, // Consider data stale after 10 seconds
  });

  // Extract company and contacts from profile
  const company = profile;
  const contacts = profile?.contacts || [];

  // Add contact mutation
  const addContactMutation = useMutation({
    mutationFn: (data: ContactFormData) =>
      apiRequest("POST", `/api/target-companies/${id}/contacts`, {
        ...data,
        targetCompanyId: parseInt(id!),
      }),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Contact added successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/target-companies", id, "profile"] });
      setShowContactForm(false);
      contactForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add contact",
        variant: "destructive",
      });
    },
  });

  // Edit contact mutation
  const editContactMutation = useMutation({
    mutationFn: (data: ContactFormData) =>
      apiRequest("PUT", `/api/contacts/${editingContact?.id}`, data),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Contact updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/target-companies", id, "profile"] });
      setShowContactForm(false);
      setEditingContact(null);
      contactForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update contact",
        variant: "destructive",
      });
    },
  });

  // Delete contact mutation
  const deleteContactMutation = useMutation({
    mutationFn: (contactId: number) =>
      apiRequest("DELETE", `/api/contacts/${contactId}`),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Contact deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/target-companies", id, "profile"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete contact",
        variant: "destructive",
      });
    },
  });

  // Helper functions
  const formatCurrency = (amount: string | number) => {
    const value = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleAddContact = () => {
    setEditingContact(null);
    contactForm.reset();
    setShowContactForm(true);
  };

  const handleEditContact = (contact: TargetContact) => {
    setEditingContact(contact);
    contactForm.reset({
      firstName: contact.firstName,
      lastName: contact.lastName,
      title: contact.title || "",
      email: contact.email || "",
      phone: contact.phone || "",
      isPrimary: contact.isPrimary || false,
      notes: contact.notes || "",
    });
    setShowContactForm(true);
  };

  const handleDeleteContact = (contactId: number) => {
    if (confirm("Are you sure you want to delete this contact?")) {
      deleteContactMutation.mutate(contactId);
    }
  };

  const handleSubmitContact = (data: ContactFormData) => {
    if (editingContact) {
      editContactMutation.mutate(data);
    } else {
      addContactMutation.mutate(data);
    }
  };

  const emailContact = (email: string) => {
    if (email) {
      window.location.href = `mailto:${email}`;
    }
  };

  const callContact = (phone: string) => {
    if (phone) {
      window.location.href = `tel:${phone}`;
    }
  };

  const visitWebsite = (website: string) => {
    if (website) {
      window.open(website, '_blank');
    }
  };

  const viewOnMap = (address: string) => {
    if (address) {
      window.open(`https://maps.google.com/?q=${encodeURIComponent(address)}`, '_blank');
    }
  };

  // Loading state
  if (profileLoading) {
    return (
      <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950/50">
        <div className="bg-white dark:bg-gray-900 border-b">
          <div className="container mx-auto px-6 py-4">
            <Skeleton className="h-8 w-64" />
          </div>
        </div>
        <div className="container mx-auto px-6 py-6 max-w-7xl">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-16 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950/50 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="p-6 text-center">
            <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h2 className="text-xl font-semibold mb-2">Company Not Found</h2>
            <p className="text-muted-foreground mb-4">
              The requested company could not be found or you don't have access to it.
            </p>
            <Link href="/target-companies">
              <Button>Return to Companies</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const primaryContact = contacts.find(c => c.isPrimary);
  const otherContacts = contacts.filter(c => !c.isPrimary);

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950/50">
      {/* Modern Header */}
      <div className="bg-white dark:bg-gray-900 border-b sticky top-0 z-40">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/target-companies">
                <Button variant="ghost" size="sm" data-testid="button-back">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              </Link>
              <Separator orientation="vertical" className="h-6" />
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <Building2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="text-company-name">
                    {company.companyName}
                  </h1>
                  <div className="flex items-center gap-2 mt-1">
                    {company.industry && (
                      <Badge variant="secondary" className="text-xs" data-testid="badge-industry">
                        {company.industry}
                      </Badge>
                    )}
                    <span className="text-sm text-muted-foreground">
                      {profile?.yearsInBusiness ? `${profile.yearsInBusiness} years` : 'New business'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button onClick={handleAddContact} size="sm" data-testid="button-add-contact">
                <Plus className="w-4 h-4 mr-2" />
                Add Contact
              </Button>
              {company.website && (
                <Button variant="outline" size="sm" onClick={() => visitWebsite(company.website!)} data-testid="button-visit-website">
                  <ExternalLink className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-6 max-w-7xl">
        {/* Key Metrics Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-700 dark:text-green-300">Annual Revenue</p>
                  <p className="text-2xl font-bold text-green-900 dark:text-green-100" data-testid="metric-revenue">
                    {company.annualRevenue ? formatCurrency(company.annualRevenue) : 'N/A'}
                  </p>
                </div>
                <DollarSign className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border-blue-200 dark:border-blue-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Employees</p>
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-100" data-testid="metric-employees">
                    {company.employeeCount ? formatNumber(company.employeeCount) : 'N/A'}
                  </p>
                </div>
                <Users className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/20 dark:to-violet-950/20 border-purple-200 dark:border-purple-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-700 dark:text-purple-300">Revenue/Employee</p>
                  <p className="text-2xl font-bold text-purple-900 dark:text-purple-100" data-testid="metric-revenue-per-employee">
                    {profile?.revenuePerEmployee ? formatCurrency(profile.revenuePerEmployee.toString()) : 'N/A'}
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-purple-600 dark:text-purple-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 border-orange-200 dark:border-orange-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-700 dark:text-orange-300">Contacts</p>
                  <p className="text-2xl font-bold text-orange-900 dark:text-orange-100" data-testid="metric-contacts">
                    {profile?.totalContacts || 0}
                  </p>
                </div>
                <User className="w-8 h-8 text-orange-600 dark:text-orange-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Modern Tabbed Interface */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="contacts" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Contacts
            </TabsTrigger>
            <TabsTrigger value="documents" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Documents
            </TabsTrigger>
            <TabsTrigger value="analysis" className="flex items-center gap-2">
              <BarChart className="w-4 h-4" />
              Analysis
            </TabsTrigger>
            <TabsTrigger value="activities" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Activities
            </TabsTrigger>
            <TabsTrigger value="pipeline" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Pipeline
            </TabsTrigger>
            <TabsTrigger value="team" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Team
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
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
                      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Globe className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">Website Analysis Pending</span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              queryClient.invalidateQueries({ queryKey: ["/api/target-companies", id, "profile"] });
                              refetchProfile();
                            }}
                            disabled={profileFetching}
                            className="h-7 px-2"
                            data-testid="button-refresh-analysis-business-info"
                          >
                            <RefreshCw className={`w-4 h-4 mr-1 ${profileFetching ? 'animate-spin' : ''}`} />
                            {profileFetching ? 'Checking...' : 'Refresh'}
                          </Button>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Website analysis is currently being processed. This usually takes about 30 seconds.
                        </div>
                        {profileFetching && (
                          <div className="flex items-center gap-2 mt-2 text-sm text-blue-600">
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Checking for updates...</span>
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
          </TabsContent>



          <TabsContent value="contacts" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Contact Directory</CardTitle>
                <CardDescription>
                  Key people at {company.companyName} ({profile?.totalContacts || 0} contacts)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {contacts.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-2">No contacts added yet</p>
                    <p className="text-sm mb-4">Add contacts to track key people at this company</p>
                    <Button onClick={handleAddContact} data-testid="button-add-first-contact">
                      <Plus className="w-4 h-4 mr-2" />
                      Add First Contact
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Primary Contact Highlight */}
                    {primaryContact && (
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
                        <h3 className="font-semibold text-lg mb-4 text-blue-900 dark:text-blue-100">Primary Contact</h3>
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                          <div className="space-y-3">
                            <div>
                              <h4 className="text-xl font-bold" data-testid="primary-contact-name">
                                {primaryContact.firstName} {primaryContact.lastName}
                              </h4>
                              {primaryContact.title && (
                                <p className="text-muted-foreground font-medium" data-testid="primary-contact-title">
                                  {primaryContact.title}
                                </p>
                              )}
                            </div>
                            
                            <div className="flex flex-wrap gap-4">
                              {primaryContact.email && (
                                <a 
                                  href={`mailto:${primaryContact.email}`} 
                                  className="flex items-center gap-2 text-blue-600 hover:underline"
                                  data-testid="primary-contact-email"
                                >
                                  <Mail className="w-4 h-4" />
                                  {primaryContact.email}
                                </a>
                              )}
                              {primaryContact.phone && (
                                <a 
                                  href={`tel:${primaryContact.phone}`} 
                                  className="flex items-center gap-2 text-blue-600 hover:underline"
                                  data-testid="primary-contact-phone"
                                >
                                  <Phone className="w-4 h-4" />
                                  {primaryContact.phone}
                                </a>
                              )}
                            </div>
                            
                            {primaryContact.notes && (
                              <p className="text-sm text-muted-foreground bg-white dark:bg-gray-800 p-3 rounded border" data-testid="primary-contact-notes">
                                {primaryContact.notes}
                              </p>
                            )}
                          </div>
                          
                          <div className="flex gap-2 lg:flex-col">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditContact(primaryContact)}
                              data-testid="button-edit-primary-contact"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Other Contacts */}
                    {otherContacts.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-lg mb-4">Other Contacts</h3>
                        <div className="grid gap-4">
                          {otherContacts.map((contact) => (
                            <Card key={contact.id} className="hover:shadow-sm transition-shadow">
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <h4 className="font-semibold" data-testid={`contact-name-${contact.id}`}>
                                        {contact.firstName} {contact.lastName}
                                      </h4>
                                    </div>
                                    
                                    {contact.title && (
                                      <p className="text-sm text-muted-foreground mb-2" data-testid={`contact-title-${contact.id}`}>
                                        {contact.title}
                                      </p>
                                    )}
                                    
                                    <div className="flex flex-wrap gap-3 text-sm">
                                      {contact.email && (
                                        <a 
                                          href={`mailto:${contact.email}`} 
                                          className="text-blue-600 hover:underline flex items-center gap-1"
                                          data-testid={`contact-email-${contact.id}`}
                                        >
                                          <Mail className="w-3 h-3" />
                                          {contact.email}
                                        </a>
                                      )}
                                      {contact.phone && (
                                        <a 
                                          href={`tel:${contact.phone}`} 
                                          className="text-blue-600 hover:underline flex items-center gap-1"
                                          data-testid={`contact-phone-${contact.id}`}
                                        >
                                          <Phone className="w-3 h-3" />
                                          {contact.phone}
                                        </a>
                                      )}
                                    </div>
                                    
                                    {contact.notes && (
                                      <p className="text-sm text-muted-foreground mt-2" data-testid={`contact-notes-${contact.id}`}>
                                        {contact.notes}
                                      </p>
                                    )}
                                  </div>
                                  
                                  <div className="flex gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleEditContact(contact)}
                                      data-testid={`button-edit-contact-${contact.id}`}
                                    >
                                      <Edit className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleDeleteContact(contact.id)}
                                      data-testid={`button-delete-contact-${contact.id}`}
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents" className="space-y-6">
            <DocumentManagement 
              targetCompanyId={parseInt(id!)}
              companyName={company.companyName}
            />
          </TabsContent>

          <TabsContent value="analysis" className="space-y-6">
            {analysisLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-32 w-full" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
                <Skeleton className="h-64 w-full" />
              </div>
            ) : stage1Events.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <BarChart className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">No analysis available yet</p>
                <p className="text-sm mb-4">Analysis will be automatically generated when all 5 required documents are uploaded and analyzed</p>
                <div className="text-xs text-muted-foreground">
                  Required documents: Asset Register, Balance Sheet, Profit & Loss, Sales Ledger, Staff Matrix
                </div>
              </div>
            ) : (
              <Tabs defaultValue="investment-summary" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="investment-summary" data-testid="tab-investment-summary">
                    Investment Summary & Recommendation
                  </TabsTrigger>
                  <TabsTrigger value="detailed-analysis" data-testid="tab-detailed-analysis">
                    Detailed Analysis
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="investment-summary" className="space-y-6">
                  <div className="space-y-6">
                {/* Investment Summary Dashboard - Featured at Top */}
                {(() => {
                  const successfulEvent = stage1Events.find(event => event.webhookStatus === 'success');
                  const eventToShow = successfulEvent || stage1Events[0];
                  
                  if (!eventToShow || eventToShow.webhookStatus !== 'success' || !eventToShow.webhookResponse) {
                    return null;
                  }

                  try {
                    // Parse the webhook response and extract the analysis content
                    const responseData = JSON.parse(eventToShow.webhookResponse);
                    const analysisContent = responseData.analysis || responseData.data?.analysis || eventToShow.webhookResponse;
                    
                    // Extract Investment Summary section from the analysis
                    const extractInvestmentSummary = (content: string) => {
                      // Look for Investment Summary & Recommendation section and clean it
                      const summaryMatch = content.match(/(?:6\.\s*)?✅?\s*Investment Summary[^#]*?(?=(?:\n##|\n#|$))/i);
                      if (summaryMatch) {
                        // Remove the section number and emoji if present
                        return summaryMatch[0].replace(/^(?:6\.\s*)?✅?\s*Investment Summary & Recommendation\s*\n?/i, '');
                      }
                      
                      // Fallback: look for recommendation section
                      const recMatch = content.match(/(?:recommendation|summary)[^#]*?(?=(?:\n##|\n#|$))/i);
                      return recMatch ? recMatch[0] : null;
                    };

                    // Extract structured sections from the content - simple approach
                    const extractStructuredSections = (content: string) => {
                      const sections = {
                        strengths: '',
                        weaknesses: '',
                        opportunities: '',
                        risks: '',
                        recommendation: ''
                      };

                      // Helper function to clean markdown and remove code blocks
                      const cleanContent = (text: string): string => {
                        return text
                          .replace(/```[\s\S]*?```/g, '') // Remove code blocks with triple backticks
                          .replace(/`([^`]+)`/g, '$1') // Remove inline code backticks
                          .replace(/\*\*/g, '') // Remove bold markers
                          .replace(/^[ \t]+/gm, '') // Remove leading whitespace/indentation that creates code blocks
                          .replace(/^[-*]\s*$/gm, '') // Remove empty bullet points (lines with just - or * and whitespace)
                          .replace(/\n{3,}/g, '\n\n') // Clean up excessive newlines created by removing empty bullets
                          .trim();
                      };

                      // Simple split approach
                      const parts = content.split(/(?=Strengths:|Weaknesses:|Opportunities for Growth:|Risks:|Recommendation:)/);
                      
                      parts.forEach(part => {
                        const trimmed = part.trim();
                        if (trimmed.startsWith('Strengths:')) {
                          sections.strengths = cleanContent(trimmed.replace('Strengths:', ''));
                        } else if (trimmed.startsWith('Weaknesses:')) {
                          sections.weaknesses = cleanContent(trimmed.replace('Weaknesses:', ''));
                        } else if (trimmed.startsWith('Opportunities for Growth:')) {
                          sections.opportunities = cleanContent(trimmed.replace('Opportunities for Growth:', ''));
                        } else if (trimmed.startsWith('Risks:')) {
                          sections.risks = cleanContent(trimmed.replace('Risks:', ''));
                        } else if (trimmed.startsWith('Recommendation:')) {
                          sections.recommendation = cleanContent(trimmed.replace('Recommendation:', ''));
                        }
                      });

                      return sections;
                    };

                    // Parse financial data from the most recent full year of accounts
                    const parseFinancials = (content: string) => {
                      interface YearMatch {
                        year: number;
                        index: number;
                        contextStart: number;
                        contextEnd: number;
                      }
                      
                      interface FinancialData {
                        year: number;
                        revenue: number | null;
                        netProfit: number | null;
                      }
                      
                      const financialsByYear: FinancialData[] = [];
                      
                      // Year context patterns - match the actual analysis format
                      const yearPatterns = [
                        // Standard formal patterns
                        /(?:year(?:s)?\s+(?:ended|to)|for\s+the\s+year(?:\s+ended)?|y\/e|fy)\s*(?:on\s*)?(?:the\s*)?(?:\d{1,2}\s*[a-zA-Z]{3,9}\s*)?(\d{4})/g,
                        /(?:accounts|financial\s+year|period)\s+(?:for\s+)?(?:the\s+)?(?:year\s+)?(?:ended?\s*)?(?:on\s*)?(?:the\s*)?(?:\d{1,2}\s*[a-zA-Z]{3,9}\s*)?(\d{4})/g,
                        /(\d{4})\s*(?:financial\s+)?(?:year|accounts)/g,
                        // Table headers and markdown patterns common in analysis
                        /\|\s*(20\d{2})\s*\|/g,
                        /^(20\d{2})$/gm,
                        // Specific patterns for this analysis format
                        /(?:covers?\s+the\s+years?\s+)(?:\d{4}(?:,\s*)?)*(?:and\s+)?(\d{4})/g,
                        /(?:\b|\s)(20\d{2})(?=\s*[:|,.\s]|\s*$)/g
                      ];
                      
                      // Find all year mentions with context
                      const yearMatches: YearMatch[] = [];
                      yearPatterns.forEach(pattern => {
                        let match;
                        while ((match = pattern.exec(content)) !== null) {
                          const year = parseInt(match[1]);
                          if (year >= 2015 && year <= 2030) { // Reasonable year range
                            yearMatches.push({
                              year,
                              index: match.index,
                              contextStart: Math.max(0, match.index - 200),
                              contextEnd: Math.min(content.length, match.index + 500)
                            });
                          }
                        }
                      });
                      
                      // Extract financial data for each year
                      yearMatches.forEach(yearMatch => {
                        const yearContext = content.slice(yearMatch.contextStart, yearMatch.contextEnd);
                        
                        // Look for revenue in Revenue Growth section specifically
                        const revenuePatterns = [
                          // Match "YYYY: £amount" format in Revenue Growth section
                          new RegExp(`${yearMatch.year}:\\s*£\\s*((?:\\d{1,3}(?:,\\d{3})+|\\d{4,}|\\d+\\.\\d+))\\s*([km])?`, 'gi'),
                          // Match revenue line items in structured format
                          new RegExp(`${yearMatch.year}[^\\n]*revenue[^\\n]*£\\s*((?:\\d{1,3}(?:,\\d{3})+|\\d{4,}|\\d+\\.\\d+))\\s*([km])?`, 'gi'),
                          // Match within Revenue Growth context
                          /Revenue Growth:[\s\S]*?(\d{4}):\s*£\s*((?:\d{1,3}(?:,\d{3})+|\d{4,}|\d+\.\d+))\s*([km])?/gi
                        ];
                        
                        // Look for net profit in Net Profit & Margins section specifically  
                        const profitPatterns = [
                          // Match "YYYY: £amount" format in Net Profit section
                          new RegExp(`${yearMatch.year}:\\s*£\\s*((?:\\d{1,3}(?:,\\d{3})+|\\d{4,}|\\d+\\.\\d+))\\s*([km])?\\s*\\([\\d.]+%\\s*of\\s*Revenue\\)`, 'gi'),
                          // Match within Net Profit & Margins context
                          /Net Profit & Margins:[\s\S]*?(\d{4}):\s*£\s*((?:\d{1,3}(?:,\d{3})+|\d{4,}|\d+\.\d+))\s*([km])?/gi,
                          // Match profit line with percentage
                          new RegExp(`${yearMatch.year}[^\\n]*£\\s*((?:\\d{1,3}(?:,\\d{3})+|\\d{4,}|\\d+\\.\\d+))\\s*([km])?\\s*\\([\\d.]+%\\s*of\\s*Revenue\\)`, 'gi')
                        ];
                        
                        let revenue: number | null = null;
                        let netProfit: number | null = null;
                        
                        // Extract revenue
                        revenuePatterns.forEach(pattern => {
                          if (revenue === null) {
                            // Reset regex for each use
                            pattern.lastIndex = 0;
                            const match = pattern.exec(yearContext);
                            if (match) {
                              let value = parseFloat(match[1].replace(/,/g, ''));
                              if (match[2] === 'k') value *= 1000;
                              if (match[2] === 'm') value *= 1000000;
                              if (value > 1000) { // Reasonable minimum for company revenue
                                revenue = value;
                              }
                            }
                          }
                        });
                        
                        // Extract net profit
                        profitPatterns.forEach(pattern => {
                          if (netProfit === null) {
                            // Reset regex for each use
                            pattern.lastIndex = 0;
                            const match = pattern.exec(yearContext);
                            if (match) {
                              let value = parseFloat(match[1].replace(/,/g, ''));
                              if (match[2] === 'k') value *= 1000;
                              if (match[2] === 'm') value *= 1000000;
                              
                              // Check if it's a loss (negative) - be more specific about loss indicators
                              const contextBefore = yearContext.slice(Math.max(0, match.index - 100), match.index);
                              const contextAfter = yearContext.slice(match.index, Math.min(yearContext.length, match.index + 150));
                              
                              // Only mark as negative if explicitly mentioned as loss or in parentheses without positive context
                              const isExplicitLoss = contextBefore.includes('loss for') || contextAfter.includes('loss for') || 
                                                    contextBefore.includes('net loss') || contextAfter.includes('net loss');
                              const inParentheses = match[0].includes('(') && match[0].includes(')');
                              const hasPositiveContext = contextAfter.includes('profit') || contextAfter.includes('% of Revenue');
                              
                              if (isExplicitLoss || (inParentheses && !hasPositiveContext)) {
                                value = -Math.abs(value);
                              }
                              
                              netProfit = value;
                            }
                          }
                        });
                        
                        if (revenue !== null || netProfit !== null) {
                          financialsByYear.push({
                            year: yearMatch.year,
                            revenue,
                            netProfit
                          });
                        }
                      });
                      
                      // Remove duplicates and consolidate by year, keeping the best values
                      const consolidatedByYear: { [year: number]: FinancialData } = {};
                      
                      financialsByYear.forEach(entry => {
                        if (!consolidatedByYear[entry.year]) {
                          consolidatedByYear[entry.year] = { year: entry.year, revenue: null, netProfit: null };
                        }
                        
                        // For revenue, prefer the largest reasonable value (likely to be the main revenue figure)
                        if (entry.revenue && entry.revenue > 50000 && (!consolidatedByYear[entry.year].revenue || entry.revenue > consolidatedByYear[entry.year].revenue!)) {
                          consolidatedByYear[entry.year].revenue = entry.revenue;
                        }
                        
                        // For net profit, prefer positive values, but keep the most reasonable value
                        if (entry.netProfit !== null) {
                          if (!consolidatedByYear[entry.year].netProfit || 
                              (entry.netProfit > 0 && consolidatedByYear[entry.year].netProfit! <= 0) ||
                              (entry.netProfit > 0 && entry.netProfit < consolidatedByYear[entry.year].netProfit!) ||
                              (entry.netProfit > consolidatedByYear[entry.year].netProfit! && consolidatedByYear[entry.year].netProfit! < 0)) {
                            consolidatedByYear[entry.year].netProfit = entry.netProfit;
                          }
                        }
                      });
                      
                      // Convert back to array and sort by year
                      const consolidatedArray = Object.values(consolidatedByYear).sort((a, b) => b.year - a.year);
                      
                      // Find the most recent year with both revenue and profit, fallback to most recent with either
                      const mostRecentComplete = consolidatedArray.find(f => f.revenue && f.netProfit !== null);
                      const mostRecentWithRevenue = consolidatedArray.find(f => f.revenue);
                      const mostRecent = mostRecentComplete || mostRecentWithRevenue || consolidatedArray[0];
                      
                      // If we have revenue but no profit for the same year, try to find profit from same year in original data
                      let finalRevenue = mostRecent?.revenue || null;
                      let finalNetProfit = mostRecent?.netProfit || null;
                      
                      if (finalRevenue && !finalNetProfit && mostRecent) {
                        const samYearWithProfit = consolidatedArray.find(f => f.year === mostRecent.year && f.netProfit !== null);
                        if (samYearWithProfit) {
                          finalNetProfit = samYearWithProfit.netProfit;
                        }
                      }
                      
                      return {
                        latestYear: mostRecent?.year,
                        latestRevenue: finalRevenue,
                        latestNetProfit: finalNetProfit,
                        byYear: consolidatedArray
                      };
                    };

                    // Extract key metrics using the robust parser
                    const extractKeyMetrics = (content: string) => {
                      const metrics = [];
                      const financials = parseFinancials(content);
                      
                      if (financials.latestRevenue) {
                        const revenueLabel = financials.latestYear ? `Latest Revenue (${financials.latestYear})` : "Latest Revenue";
                        metrics.push({ 
                          label: revenueLabel, 
                          value: formatCurrency(financials.latestRevenue), 
                          type: "currency" 
                        });
                      }
                      
                      if (financials.latestNetProfit !== null && financials.latestNetProfit !== undefined) {
                        const profitLabel = financials.latestYear ? `Net Profit (${financials.latestYear})` : "Net Profit";
                        metrics.push({ 
                          label: profitLabel, 
                          value: formatCurrency(financials.latestNetProfit), 
                          type: "currency" 
                        });
                      }
                      
                      return metrics;
                    };

                    // Extract risk assessment
                    const extractRiskLevel = (content: string) => {
                      const lowerContent = content.toLowerCase();
                      if (lowerContent.includes('high risk') || lowerContent.includes('major red flag') || lowerContent.includes('severe')) {
                        return { level: "High", color: "bg-red-500", description: "Significant concerns identified" };
                      } else if (lowerContent.includes('medium risk') || lowerContent.includes('moderate')) {
                        return { level: "Medium", color: "bg-yellow-500", description: "Some risks to consider" };
                      } else if (lowerContent.includes('low risk') || lowerContent.includes('attractive')) {
                        return { level: "Low", color: "bg-green-500", description: "Favorable investment profile" };
                      }
                      return { level: "Under Review", color: "bg-gray-500", description: "Analysis in progress" };
                    };

                    const investmentSummary = extractInvestmentSummary(analysisContent);
                    const keyMetrics = extractKeyMetrics(analysisContent);
                    const riskAssessment = extractRiskLevel(analysisContent);
                    const structuredSections = extractStructuredSections(investmentSummary || '');

                    return (
                      <>
                        {/* Investment Summary Dashboard Card */}
                        <Card className="border-2 border-blue-200 dark:border-blue-800 shadow-lg">
                          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
                            <CardTitle className="text-xl flex items-center gap-3">
                              <div className="flex items-center justify-center w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg">
                                <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                              </div>
                              Investment Summary & Recommendation
                            </CardTitle>
                            <CardDescription className="text-base">
                              Executive overview and investment recommendation for {company.companyName}
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="pt-6 space-y-6">
                            {/* Key Metrics Dashboard */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                              {/* Risk Assessment */}
                              <Card className="border-l-4 border-l-blue-500">
                                <CardContent className="p-4">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-muted-foreground">Risk Level</span>
                                    <div className={`w-3 h-3 rounded-full ${riskAssessment.color}`}></div>
                                  </div>
                                  <div className="font-semibold text-lg">{riskAssessment.level}</div>
                                  <div className="text-xs text-muted-foreground mt-1">{riskAssessment.description}</div>
                                </CardContent>
                              </Card>

                              {/* Key Metrics */}
                              {keyMetrics.slice(0, 2).map((metric, index) => (
                                <Card key={index} className="border-l-4 border-l-green-500">
                                  <CardContent className="p-4">
                                    <div className="text-sm font-medium text-muted-foreground mb-2">{metric.label}</div>
                                    <div className="font-semibold text-lg">{metric.value}</div>
                                    <div className="text-xs text-muted-foreground mt-1">From financial analysis</div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>

                            <Separator />

                            {/* Structured Analysis Sections */}
                            <div className="space-y-6">
                              {/* Strengths Section */}
                              {structuredSections.strengths && (
                                <Card className="border-2 border-green-200 dark:border-green-800 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
                                  <CardHeader className="pb-3">
                                    <CardTitle className="text-lg flex items-center gap-2 text-green-700 dark:text-green-400">
                                      <CheckCircle className="w-5 h-5" />
                                      Strengths
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <div className="prose prose-sm dark:prose-invert max-w-none [&_ul]:my-2 [&_li]:my-1">
                                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {structuredSections.strengths}
                                      </ReactMarkdown>
                                    </div>
                                  </CardContent>
                                </Card>
                              )}

                              {/* Weaknesses Section */}
                              {structuredSections.weaknesses && (
                                <Card className="border-2 border-red-200 dark:border-red-800 bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-950/20 dark:to-pink-950/20">
                                  <CardHeader className="pb-3">
                                    <CardTitle className="text-lg flex items-center gap-2 text-red-700 dark:text-red-400">
                                      <AlertTriangle className="w-5 h-5" />
                                      Weaknesses
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <div className="prose prose-sm dark:prose-invert max-w-none [&_ul]:my-2 [&_li]:my-1">
                                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {structuredSections.weaknesses}
                                      </ReactMarkdown>
                                    </div>
                                  </CardContent>
                                </Card>
                              )}

                              {/* Opportunities Section */}
                              {structuredSections.opportunities && (
                                <Card className="border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20">
                                  <CardHeader className="pb-3">
                                    <CardTitle className="text-lg flex items-center gap-2 text-blue-700 dark:text-blue-400">
                                      <TrendingUp className="w-5 h-5" />
                                      Opportunities for Growth
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <div className="prose prose-sm dark:prose-invert max-w-none [&_ul]:my-2 [&_li]:my-1">
                                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {structuredSections.opportunities}
                                      </ReactMarkdown>
                                    </div>
                                  </CardContent>
                                </Card>
                              )}

                              {/* Risks Section */}
                              {structuredSections.risks && (
                                <Card className="border-2 border-orange-200 dark:border-orange-800 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20">
                                  <CardHeader className="pb-3">
                                    <CardTitle className="text-lg flex items-center gap-2 text-orange-700 dark:text-orange-400">
                                      <AlertTriangle className="w-5 h-5" />
                                      Risks
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <div className="prose prose-sm dark:prose-invert max-w-none [&_ul]:my-2 [&_li]:my-1">
                                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {structuredSections.risks}
                                      </ReactMarkdown>
                                    </div>
                                  </CardContent>
                                </Card>
                              )}

                              {/* Final Recommendation Section */}
                              {structuredSections.recommendation && (
                                <Card className="border-2 border-purple-200 dark:border-purple-800 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20">
                                  <CardHeader className="pb-3">
                                    <CardTitle className="text-lg flex items-center gap-2 text-purple-700 dark:text-purple-400">
                                      <BarChart3 className="w-5 h-5" />
                                      Final Recommendation
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <div className="prose prose-sm dark:prose-invert max-w-none">
                                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {structuredSections.recommendation}
                                      </ReactMarkdown>
                                    </div>
                                  </CardContent>
                                </Card>
                              )}

                              {/* Fallback: Show full content if sections can't be extracted */}
                              {!structuredSections.strengths && !structuredSections.weaknesses && !structuredSections.recommendation && investmentSummary && (
                                <Card>
                                  <CardContent className="pt-6">
                                    <div className="prose dark:prose-invert max-w-none">
                                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {investmentSummary}
                                      </ReactMarkdown>
                                    </div>
                                  </CardContent>
                                </Card>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </>
                    );
                  } catch (error) {
                    return null;
                  }
                })()}

                {/* Detailed Analysis Section */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <BarChart className="w-5 h-5" />
                      Financial analysis
                    </CardTitle>
                    <CardDescription>
                      Complete Stage 1 analysis with all financial and operational details
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {/* Show the most recent successful event, or latest event if none succeeded */}
                      {(() => {
                        const successfulEvent = stage1Events.find(event => event.webhookStatus === 'success');
                        const eventToShow = successfulEvent || stage1Events[0];
                        return eventToShow ? [eventToShow] : [];
                      })().map((event) => (
                        <Card key={event.id} className="border-l-4 border-l-blue-500">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="font-semibold">Stage 1 Analysis</h3>
                                <p className="text-sm text-muted-foreground">
                                  Generated on {new Date(event.createdAt || new Date()).toLocaleDateString()} at {new Date(event.createdAt || new Date()).toLocaleTimeString()}
                                </p>
                              </div>
                              <Badge variant={event.webhookStatus === 'success' ? 'default' : event.webhookStatus === 'failed' ? 'destructive' : 'secondary'}>
                                {event.webhookStatus === 'success' ? 'completed' : event.webhookStatus === 'failed' ? 'failed' : 'pending'}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent>
                            {event.webhookStatus === 'success' && event.webhookResponse ? (() => {
                              try {
                                // Parse the webhook response JSON to extract the analysis content
                                const responseData = JSON.parse(event.webhookResponse);
                                const analysisContent = responseData.analysis || responseData.data?.analysis || event.webhookResponse;
                                
                                // Create collapsible sections for detailed analysis
                                const createCollapsibleSections = (content: string) => {
                                  // Split content by numbered sections (1., 2., 3., etc.)
                                  const sections = content.split(/(?=\d+\.\s*[🧾📈🧩📊⚠️🎯])/);
                                  
                                  return sections.filter(section => section.trim()).map((section, index) => {
                                    const trimmedSection = section.trim();
                                    if (!trimmedSection) return null;
                                    
                                    // Extract the heading (first line)
                                    const lines = trimmedSection.split('\n');
                                    const heading = lines[0]?.trim() || '';
                                    const content = lines.slice(1).join('\n').trim();
                                    
                                    if (!heading.match(/^\d+\./)) return null;
                                    
                                    return (
                                      <Collapsible key={index} className="mb-4">
                                        <CollapsibleTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            className="w-full justify-between p-4 h-auto text-left hover:bg-muted/50 rounded-lg border"
                                          >
                                            <span className="font-semibold text-base">{heading}</span>
                                            <ChevronDown className="w-4 h-4 transition-transform duration-200 data-[state=open]:rotate-180" />
                                          </Button>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent className="mt-2">
                                          <Card className="border-l-4 border-l-blue-500">
                                            <CardContent className="p-4">
                                              <div className="prose prose-sm dark:prose-invert max-w-none">
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                  {content}
                                                </ReactMarkdown>
                                              </div>
                                            </CardContent>
                                          </Card>
                                        </CollapsibleContent>
                                      </Collapsible>
                                    );
                                  }).filter(Boolean);
                                };

                                const collapsibleSections = createCollapsibleSections(analysisContent);
                                
                                return (
                                  <div className="space-y-4">
                                    {collapsibleSections.length > 0 ? (
                                      collapsibleSections
                                    ) : (
                                      <div className="prose dark:prose-invert max-w-none">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                          {analysisContent}
                                        </ReactMarkdown>
                                      </div>
                                    )}
                                  </div>
                                );
                              } catch (error) {
                                // Fallback to rendering the raw response if JSON parsing fails
                                return (
                                  <div className="prose dark:prose-invert max-w-none">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                      {event.webhookResponse}
                                    </ReactMarkdown>
                                  </div>
                                );
                              }
                            })() : event.webhookStatus === 'failed' ? (
                              <div className="text-red-600 dark:text-red-400">
                                <p className="font-medium">Analysis failed</p>
                                {event.webhookResponse && (
                                  <p className="text-sm mt-1">{event.webhookResponse}</p>
                                )}
                              </div>
                            ) : event.webhookStatus === 'pending' && event.webhookSent ? (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                <span>Analysis in progress...</span>
                              </div>
                            ) : (
                              <div className="text-muted-foreground">
                                <p>Analysis pending...</p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                  </div>
                </TabsContent>

                <TabsContent value="detailed-analysis" className="space-y-6">
                  {(() => {
                    const detailedAnalysisEvent = stage1Events.find(event => 
                      event.webhookStatus === 'success' && 
                      event.detailedAnalysisData
                    );

                    if (!detailedAnalysisEvent || !detailedAnalysisEvent.detailedAnalysisData) {
                      return (
                        <div className="text-center py-12 text-muted-foreground">
                          <BarChart className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p className="text-lg font-medium mb-2">Detailed analysis not available</p>
                          <p className="text-sm">Comprehensive analysis will appear here when available</p>
                        </div>
                      );
                    }

                    try {
                      const detailedData = typeof detailedAnalysisEvent.detailedAnalysisData === 'string' 
                        ? JSON.parse(detailedAnalysisEvent.detailedAnalysisData)
                        : detailedAnalysisEvent.detailedAnalysisData;
                      
                      return <DetailedAnalysisDisplay data={detailedData} />;
                    } catch (error) {
                      return (
                        <div className="text-center py-12 text-muted-foreground">
                          <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p className="text-lg font-medium mb-2">Error loading detailed analysis</p>
                          <p className="text-sm">Unable to parse detailed analysis data</p>
                        </div>
                      );
                    }
                  })()}
                </TabsContent>
              </Tabs>
            )}
          </TabsContent>

          <TabsContent value="activities" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Activity Timeline</CardTitle>
                <CardDescription>
                  Track all interactions and activities with {company.companyName}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ActivityManagement 
                  targetCompanyId={parseInt(id!)}
                  companyName={company.companyName}
                  contacts={contacts}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pipeline" className="space-y-6">
            <PipelineStageManagement 
              targetCompanyId={parseInt(id!)}
              targetCompanyName={company.companyName}
              currentStage={company.stage || 'New Target'}
              stageUpdatedAt={company.stageUpdatedAt ? (typeof company.stageUpdatedAt === 'string' ? company.stageUpdatedAt : company.stageUpdatedAt.toISOString()) : (company.createdAt ? (typeof company.createdAt === 'string' ? company.createdAt : company.createdAt.toISOString()) : new Date().toISOString())}
              stageUpdatedBy={company.stageUpdatedBy}
              daysInStage={company.stageUpdatedAt 
                ? Math.floor((new Date().getTime() - new Date(company.stageUpdatedAt).getTime()) / (1000 * 60 * 60 * 24))
                : company.createdAt 
                  ? Math.floor((new Date().getTime() - new Date(company.createdAt).getTime()) / (1000 * 60 * 60 * 24))
                  : 0
              }
            />
          </TabsContent>

          <TabsContent value="team" className="space-y-6">
            <DealTeamManagement 
              targetCompanyId={parseInt(id!)} 
              targetCompanyName={company.companyName} 
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Contact Form Dialog */}
      <Dialog open={showContactForm} onOpenChange={setShowContactForm}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {editingContact ? "Edit Contact" : "Add New Contact"}
            </DialogTitle>
          </DialogHeader>

          <Form {...contactForm}>
            <form onSubmit={contactForm.handleSubmit(handleSubmitContact)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={contactForm.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="John" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={contactForm.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Smith" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={contactForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job Title</FormLabel>
                    <FormControl>
                      <Input placeholder="CEO, Owner, Manager..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={contactForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="john@company.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={contactForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="(555) 123-4567" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={contactForm.control}
                name="isPrimary"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        Set as primary contact
                      </FormLabel>
                      <p className="text-[0.8rem] text-muted-foreground">
                        The primary contact will be highlighted in the company profile
                      </p>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={contactForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Additional notes about this contact..."
                        className="min-h-[80px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowContactForm(false)}
                  disabled={addContactMutation.isPending || editContactMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={addContactMutation.isPending || editContactMutation.isPending}
                >
                  {addContactMutation.isPending || editContactMutation.isPending
                    ? "Saving..."
                    : editingContact
                    ? "Update Contact"
                    : "Add Contact"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}