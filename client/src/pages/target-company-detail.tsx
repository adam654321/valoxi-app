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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, Plus, Edit, Trash2, Mail, Phone, User, MapPin, Globe, Calendar, Users, DollarSign, Building2, ExternalLink } from "lucide-react";
import type { TargetCompany, TargetContact } from "@shared/schema";
import { DealTeamManagement } from "@/components/deal-team-management";
import { PipelineStageManagement } from "@/components/pipeline-stage-management";
import { ActivityManagement } from "@/components/activity-management";

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
  const { data: profile, isLoading: profileLoading } = useQuery<CompanyProfile>({
    queryKey: ["/api/target-companies", id, "profile"],
    enabled: !!id,
  });

  // Extract company and contacts from profile
  const company = profile;
  const contacts = profile?.contacts || [];
  const companyLoading = profileLoading;
  const contactsLoading = profileLoading;

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
      apiRequest("PUT", `/api/contacts/${editingContact!.id}`, data),
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

  const handleAddContact = () => {
    setEditingContact(null);
    contactForm.reset({
      firstName: "",
      lastName: "",
      title: "",
      email: "",
      phone: "",
      isPrimary: false,
      notes: "",
    });
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

  if (companyLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-8 w-64" />
        </div>
        
        <Card>
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Company Not Found</h1>
          <p className="text-muted-foreground">The target company you're looking for doesn't exist.</p>
          <Link href="/target-companies">
            <Button>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Target Companies
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const formatCurrency = (value: string | null | undefined) => {
    if (!value) return "N/A";
    const num = parseFloat(value);
    if (isNaN(num)) return value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  const formatNumber = (value: string | number | null | undefined) => {
    if (!value) return "N/A";
    const num = typeof value === 'number' ? value : parseInt(value.toString());
    if (isNaN(num)) return value;
    return new Intl.NumberFormat().format(num);
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "Not specified";
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Quick action functions
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

  const primaryContact = contacts.find(c => c.isPrimary);
  const otherContacts = contacts.filter(c => !c.isPrimary);

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-7xl">
      {/* Professional Header Section */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-lg p-8 border">
        {/* Navigation */}
        <div className="flex items-center gap-4 mb-6">
          <Link href="/target-companies">
            <Button variant="outline" size="sm" data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Companies
            </Button>
          </Link>
        </div>

        {/* Company Title and Industry */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Building2 className="w-8 h-8 text-blue-600" />
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white" data-testid="text-company-name">
                {company.companyName}
              </h1>
            </div>
            {company.industry && (
              <Badge variant="secondary" className="text-sm px-3 py-1" data-testid="badge-industry">
                {company.industry}
              </Badge>
            )}
          </div>

          {/* Key Metrics at a Glance */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6">
            <div className="text-center bg-white dark:bg-gray-800 p-4 rounded-lg border shadow-sm">
              <div className="text-2xl font-bold text-green-600" data-testid="metric-revenue">
                {company.annualRevenue ? formatCurrency(company.annualRevenue) : 'N/A'}
              </div>
              <div className="text-sm text-muted-foreground">Annual Revenue</div>
            </div>
            <div className="text-center bg-white dark:bg-gray-800 p-4 rounded-lg border shadow-sm">
              <div className="text-2xl font-bold text-blue-600" data-testid="metric-employees">
                {company.employeeCount ? formatNumber(company.employeeCount) : 'N/A'}
              </div>
              <div className="text-sm text-muted-foreground">Employees</div>
            </div>
            <div className="text-center bg-white dark:bg-gray-800 p-4 rounded-lg border shadow-sm">
              <div className="text-2xl font-bold text-purple-600" data-testid="metric-years">
                {profile?.yearsInBusiness || 'N/A'}
              </div>
              <div className="text-sm text-muted-foreground">Years in Business</div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-3 mt-6">
          <Button onClick={handleAddContact} data-testid="button-add-contact">
            <Plus className="w-4 h-4 mr-2" />
            Add Contact
          </Button>
          {company.website && (
            <Button variant="outline" onClick={() => visitWebsite(company.website!)} data-testid="button-visit-website">
              <ExternalLink className="w-4 h-4 mr-2" />
              Visit Website
            </Button>
          )}
          {profile?.primaryContactEmail && (
            <Button variant="outline" onClick={() => emailContact(profile.primaryContactEmail!)} data-testid="button-email-primary">
              <Mail className="w-4 h-4 mr-2" />
              Email Primary Contact
            </Button>
          )}
          {profile?.primaryContactPhone && (
            <Button variant="outline" onClick={() => callContact(profile.primaryContactPhone!)} data-testid="button-call-primary">
              <Phone className="w-4 h-4 mr-2" />
              Call Primary Contact
            </Button>
          )}
        </div>
      </div>

      {/* Business Overview Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Business Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              {company.website && (
                <div className="flex items-center gap-3" data-testid="info-website">
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <span className="font-medium">Website:</span>
                    <a 
                      href={company.website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="ml-2 text-blue-600 hover:underline"
                    >
                      {company.website.replace(/^https?:\/\//, '')}
                    </a>
                  </div>
                </div>
              )}

              {company.email && (
                <div className="flex items-center gap-3" data-testid="info-email">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <span className="font-medium">Email:</span>
                    <a href={`mailto:${company.email}`} className="ml-2 text-blue-600 hover:underline">
                      {company.email}
                    </a>
                  </div>
                </div>
              )}

              {company.phone && (
                <div className="flex items-center gap-3" data-testid="info-phone">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <span className="font-medium">Phone:</span>
                    <a href={`tel:${company.phone}`} className="ml-2 text-blue-600 hover:underline">
                      {company.phone}
                    </a>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              {company.address && (
                <div className="flex items-start gap-3" data-testid="info-address">
                  <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <span className="font-medium">Address:</span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm">{company.address}</span>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => viewOnMap(company.address!)}
                        className="h-6 px-2 text-xs"
                        data-testid="button-view-map"
                      >
                        View Map
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {company.yearEstablished && (
                <div className="flex items-center gap-3" data-testid="info-established">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <span className="font-medium">Established:</span>
                    <span className="ml-2">{company.yearEstablished}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {company.description && (
            <div className="mt-6 pt-6 border-t">
              <h4 className="font-semibold mb-3">Company Description</h4>
              <p className="text-muted-foreground leading-relaxed" data-testid="text-description">
                {company.description}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Financial Information Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Financial Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border">
              <div className="text-2xl font-bold text-green-600 mb-1" data-testid="financial-revenue">
                {company.annualRevenue ? formatCurrency(company.annualRevenue) : 'Not specified'}
              </div>
              <div className="text-sm text-muted-foreground">Annual Revenue</div>
            </div>
            
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border">
              <div className="text-2xl font-bold text-blue-600 mb-1" data-testid="financial-employees">
                {company.employeeCount ? formatNumber(company.employeeCount) : 'Not specified'}
              </div>
              <div className="text-sm text-muted-foreground">Employee Count</div>
            </div>
            
            <div className="text-center p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg border">
              <div className="text-2xl font-bold text-purple-600 mb-1" data-testid="financial-revenue-per-employee">
                {profile?.revenuePerEmployee ? formatCurrency(profile.revenuePerEmployee.toString()) : 'Not calculated'}
              </div>
              <div className="text-sm text-muted-foreground">Revenue per Employee</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Contact Directory Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Contact Directory
          </CardTitle>
          <CardDescription>
            Key people at {company.companyName} ({profile?.totalContacts || 0} contacts)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {contactsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-[200px]" />
                    <Skeleton className="h-4 w-[160px]" />
                  </div>
                </div>
              ))}
            </div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No contacts added yet</p>
              <p className="text-sm">Add contacts to track key people at this company</p>
              <Button onClick={handleAddContact} className="mt-4" data-testid="button-add-first-contact">
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
                      {primaryContact.email && (
                        <Button
                          onClick={() => emailContact(primaryContact.email!)}
                          className="flex-1 lg:flex-none"
                          data-testid="button-email-primary-contact"
                        >
                          <Mail className="w-4 h-4 mr-2" />
                          Email
                        </Button>
                      )}
                      {primaryContact.phone && (
                        <Button
                          variant="outline"
                          onClick={() => callContact(primaryContact.phone!)}
                          className="flex-1 lg:flex-none"
                          data-testid="button-call-primary-contact"
                        >
                          <Phone className="w-4 h-4 mr-2" />
                          Call
                        </Button>
                      )}
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

              {/* All Contacts Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg">
                    All Contacts ({contacts.length})
                  </h3>
                  <Button onClick={handleAddContact} data-testid="button-add-contact-directory">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Contact
                  </Button>
                </div>
                
                <div className="grid gap-4">
                  {contacts.map((contact) => (
                    <div 
                      key={contact.id} 
                      className={`border rounded-lg p-4 ${contact.isPrimary ? 'bg-blue-50/50 dark:bg-blue-950/10 border-blue-200 dark:border-blue-800' : 'bg-white dark:bg-gray-800'}`}
                      data-testid={`contact-card-${contact.id}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold" data-testid={`contact-name-${contact.id}`}>
                              {contact.firstName} {contact.lastName}
                            </h4>
                            {contact.isPrimary && (
                              <Badge variant="default" className="text-xs">Primary</Badge>
                            )}
                          </div>
                          
                          {contact.title && (
                            <p className="text-sm text-muted-foreground" data-testid={`contact-title-${contact.id}`}>
                              {contact.title}
                            </p>
                          )}
                          
                          <div className="flex flex-wrap gap-4 text-sm">
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
                            <p className="text-sm text-muted-foreground" data-testid={`contact-notes-${contact.id}`}>
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
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Information Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            System Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Creation Details</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span>Created by: <strong>{profile?.createdByName || 'Unknown'}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    <span>Organization: <strong>{profile?.userCompanyName || 'Unknown'}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span>Date: <strong>{formatDate(company.createdAt?.toString())}</strong></span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Record Statistics</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span>Total Contacts: <strong>{profile?.totalContacts || 0}</strong></span>
                  </div>
                  {profile?.primaryContactName && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <span>Primary Contact: <strong>{profile.primaryContactName}</strong></span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pipeline Stage Management Section */}
      <PipelineStageManagement 
        targetCompanyId={parseInt(id!)}
        targetCompanyName={company.companyName}
        currentStage={company.stage || 'New Target'}
        stageUpdatedAt={company.stageUpdatedAt || company.createdAt || new Date().toISOString()}
        stageUpdatedBy={company.stageUpdatedBy}
        daysInStage={company.stageUpdatedAt 
          ? Math.floor((new Date().getTime() - new Date(company.stageUpdatedAt).getTime()) / (1000 * 60 * 60 * 24))
          : company.createdAt 
            ? Math.floor((new Date().getTime() - new Date(company.createdAt).getTime()) / (1000 * 60 * 60 * 24))
            : 0
        }
      />

      {/* Deal Team Management Section */}
      <DealTeamManagement 
        targetCompanyId={parseInt(id!)} 
        targetCompanyName={company.companyName} 
      />

      {/* Activity Management Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Activity Management
          </CardTitle>
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