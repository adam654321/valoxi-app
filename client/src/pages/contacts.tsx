import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Mail, Phone, User, Building, Eye, UserPlus, Pencil, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { TargetContact, TargetCompany } from "@shared/schema";

// Extended contact type that includes company information
interface ContactWithCompany extends TargetContact {
  company: {
    id: number;
    companyName: string;
    industry?: string;
  };
}

// Contact form schema
const contactSchema = z.object({
  targetCompanyId: z.string().min(1, "Please select a target company"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  title: z.string().optional(),
  email: z.string().email("Please enter a valid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  isPrimary: z.boolean().default(false),
  notes: z.string().optional(),
});

type ContactForm = z.infer<typeof contactSchema>;

export default function Contacts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [showContactForm, setShowContactForm] = useState(false);
  const [showPrimaryOnly, setShowPrimaryOnly] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactWithCompany | null>(null);

  // Get all contacts across all target companies
  const { data: allContacts = [], isLoading } = useQuery<ContactWithCompany[]>({
    queryKey: ["/api/contacts/all"],
    enabled: !!user,
  });

  // Get target companies for the contact form dropdown
  const { data: targetCompanies = [] } = useQuery<TargetCompany[]>({
    queryKey: ["/api/target-companies"],
    enabled: !!user,
  });

  // Contact form
  const contactForm = useForm<ContactForm>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      targetCompanyId: "",
      firstName: "",
      lastName: "",
      title: "",
      email: "",
      phone: "",
      isPrimary: false,
      notes: "",
    },
  });

  // Create contact mutation
  const createContactMutation = useMutation({
    mutationFn: async (data: ContactForm) => {
      const { targetCompanyId, ...contactData } = data;
      return await apiRequest("POST", `/api/target-companies/${targetCompanyId}/contacts`, contactData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/target-companies"] });
      setShowContactForm(false);
      setEditingContact(null);
      contactForm.reset();
      toast({
        title: "Success",
        description: "Contact added successfully!",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add contact",
        variant: "destructive",
      });
    },
  });

  // Update contact mutation
  const updateContactMutation = useMutation({
    mutationFn: async (data: ContactForm) => {
      if (!editingContact) return;
      const { targetCompanyId, ...contactData } = data;
      return await apiRequest("PUT", `/api/contacts/${editingContact.id}`, contactData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/target-companies"] });
      setShowContactForm(false);
      setEditingContact(null);
      contactForm.reset();
      toast({
        title: "Success",
        description: "Contact updated successfully!",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update contact",
        variant: "destructive",
      });
    },
  });

  // Delete contact mutation
  const deleteContactMutation = useMutation({
    mutationFn: async (contact: ContactWithCompany) => {
      return await apiRequest("DELETE", `/api/contacts/${contact.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/target-companies"] });
      toast({
        title: "Success",
        description: "Contact deleted successfully!",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete contact",
        variant: "destructive",
      });
    },
  });

  const handleAddContact = () => {
    setEditingContact(null);
    contactForm.reset();
    setShowContactForm(true);
  };

  const handleEditContact = (contact: ContactWithCompany) => {
    setEditingContact(contact);
    contactForm.reset({
      targetCompanyId: contact.company.id.toString(),
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

  const handleDeleteContact = (contact: ContactWithCompany) => {
    if (confirm(`Are you sure you want to delete ${contact.firstName} ${contact.lastName}?`)) {
      deleteContactMutation.mutate(contact);
    }
  };

  const handleSubmitContact = (data: ContactForm) => {
    if (editingContact) {
      updateContactMutation.mutate(data);
    } else {
      createContactMutation.mutate(data);
    }
  };

  // Filter contacts based on search term and primary filter
  const filteredContacts = allContacts.filter((contact) => {
    // First apply primary filter if enabled
    if (showPrimaryOnly && !contact.isPrimary) {
      return false;
    }

    // Then apply search filter
    const searchLower = searchTerm.toLowerCase();
    return (
      contact.firstName.toLowerCase().includes(searchLower) ||
      contact.lastName.toLowerCase().includes(searchLower) ||
      (contact.title && contact.title.toLowerCase().includes(searchLower)) ||
      (contact.email && contact.email.toLowerCase().includes(searchLower)) ||
      contact.company.companyName.toLowerCase().includes(searchLower)
    );
  });

  // Separate primary and other contacts for display
  const primaryContacts = filteredContacts.filter(c => c.isPrimary);
  const otherContacts = filteredContacts.filter(c => !c.isPrimary);

  const handleLogout = () => {
    window.location.href = "/api/auth/logout";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Navigation */}
        <nav className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <div className="flex-shrink-0 flex items-center">
                  <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <span className="ml-3 text-xl font-semibold text-textPrimary">M&A Pipeline</span>
                </div>
                <div className="hidden md:ml-10 md:flex md:space-x-8">
                  <Link href="/dashboard" className="text-textSecondary hover:text-textPrimary border-b-2 border-transparent hover:border-gray-300 px-1 pt-1 pb-4 text-sm font-medium transition-colors">
                    Dashboard
                  </Link>
                  <Link href="/target-companies" className="text-textSecondary hover:text-textPrimary border-b-2 border-transparent hover:border-gray-300 px-1 pt-1 pb-4 text-sm font-medium transition-colors">
                    Target Companies
                  </Link>
                  <Link href="/contacts" className="text-primary border-b-2 border-primary px-1 pt-1 pb-4 text-sm font-medium">
                    Contacts
                  </Link>
                  <a href="#" className="text-textSecondary hover:text-textPrimary border-b-2 border-transparent hover:border-gray-300 px-1 pt-1 pb-4 text-sm font-medium transition-colors">
                    Reports
                  </a>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <Link href="/target-companies">
                  <Button className="bg-primary text-white hover:bg-blue-700">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add Target Company
                  </Button>
                </Link>
                <div className="relative">
                  <Button
                    variant="ghost"
                    className="flex items-center space-x-2 text-textSecondary hover:text-textPrimary"
                    onClick={handleLogout}
                  >
                    {user && (
                      <span className="text-sm font-medium">
                        {user.firstName} {user.lastName}
                      </span>
                    )}
                    <div className="h-8 w-8 bg-gray-300 rounded-full flex items-center justify-center">
                      <User className="w-4 h-4" />
                    </div>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </nav>

        {/* Loading Content */}
        <div className="max-w-7xl mx-auto p-6">
          <div className="space-y-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-full max-w-md" />
            <div className="grid gap-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-4">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-64" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <span className="ml-3 text-xl font-semibold text-textPrimary">M&A Pipeline</span>
              </div>
              <div className="hidden md:ml-10 md:flex md:space-x-8">
                <Link href="/dashboard" className="text-textSecondary hover:text-textPrimary border-b-2 border-transparent hover:border-gray-300 px-1 pt-1 pb-4 text-sm font-medium transition-colors">
                  Dashboard
                </Link>
                <Link href="/target-companies" className="text-textSecondary hover:text-textPrimary border-b-2 border-transparent hover:border-gray-300 px-1 pt-1 pb-4 text-sm font-medium transition-colors">
                  Target Companies
                </Link>
                <Link href="/contacts" className="text-primary border-b-2 border-primary px-1 pt-1 pb-4 text-sm font-medium">
                  Contacts
                </Link>
                <a href="#" className="text-textSecondary hover:text-textPrimary border-b-2 border-transparent hover:border-gray-300 px-1 pt-1 pb-4 text-sm font-medium transition-colors">
                  Reports
                </a>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/target-companies">
                <Button className="bg-primary text-white hover:bg-blue-700">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add Target Company
                </Button>
              </Link>
              <div className="relative">
                <Button
                  variant="ghost"
                  className="flex items-center space-x-2 text-textSecondary hover:text-textPrimary"
                  onClick={handleLogout}
                >
                  {user && (
                    <span className="text-sm font-medium">
                      {user.firstName} {user.lastName}
                    </span>
                  )}
                  <div className="h-8 w-8 bg-gray-300 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4" />
                  </div>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">All Contacts</h1>
              <p className="mt-2 text-gray-600">
                Manage contacts across all your target companies
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-500">
                {filteredContacts.length} contact{filteredContacts.length !== 1 ? 's' : ''} found
              </div>
              <Button 
                className="bg-primary text-white hover:bg-blue-700"
                onClick={handleAddContact}
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Add Contact
              </Button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex items-center gap-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search contacts and companies..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="primary-only"
                checked={showPrimaryOnly}
                onCheckedChange={(checked) => setShowPrimaryOnly(checked === true)}
              />
              <label
                htmlFor="primary-only"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Primary contacts only
              </label>
            </div>
          </div>

          {/* Contacts List */}
          {filteredContacts.length === 0 && !searchTerm && (
            <Card>
              <CardContent className="p-12 text-center">
                <User className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No contacts yet</h3>
                <p className="text-gray-600 mb-4">
                  Add contacts to your target companies to track key people and decision makers.
                </p>
                <div className="flex justify-center gap-3">
                  <Link href="/target-companies">
                    <Button variant="outline">
                      <Building className="w-4 h-4 mr-2" />
                      View Companies
                    </Button>
                  </Link>
                  <Button onClick={handleAddContact}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add First Contact
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {filteredContacts.length === 0 && searchTerm && (
            <Card>
              <CardContent className="p-8 text-center">
                <Search className="w-8 h-8 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No contacts found</h3>
                <p className="text-gray-600">
                  Try adjusting your search terms or check a different spelling.
                </p>
              </CardContent>
            </Card>
          )}

          {filteredContacts.length > 0 && (
            <div className="space-y-6">
              {/* Primary Contacts */}
              {primaryContacts.length > 0 && !showPrimaryOnly && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <span className="w-2 h-2 bg-blue-600 rounded-full mr-2"></span>
                    Primary Contacts ({primaryContacts.length})
                  </h2>
                  <div className="grid gap-4">
                    {primaryContacts.map((contact) => (
                      <Card key={contact.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-4">
                              <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                                <User className="w-6 h-6 text-blue-600" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="text-lg font-semibold text-gray-900">
                                    {contact.firstName} {contact.lastName}
                                  </h3>
                                  <Badge variant="default">Primary</Badge>
                                </div>
                                {contact.title && (
                                  <p className="text-sm text-gray-600 mb-1">{contact.title}</p>
                                )}
                                <div className="flex items-center gap-4 text-sm text-gray-500 mb-2">
                                  <div className="flex items-center gap-1">
                                    <Building className="w-3 h-3" />
                                    <Link 
                                      href={`/target-companies/${contact.company.id}`}
                                      className="text-blue-600 hover:underline"
                                    >
                                      {contact.company.companyName}
                                    </Link>
                                  </div>
                                  {contact.company.industry && (
                                    <Badge variant="secondary" className="text-xs">
                                      {contact.company.industry}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-4 text-sm">
                                  {contact.email && (
                                    <a 
                                      href={`mailto:${contact.email}`} 
                                      className="text-blue-600 hover:underline flex items-center gap-1"
                                    >
                                      <Mail className="w-3 h-3" />
                                      {contact.email}
                                    </a>
                                  )}
                                  {contact.phone && (
                                    <span className="text-gray-600 flex items-center gap-1">
                                      <Phone className="w-3 h-3" />
                                      {contact.phone}
                                    </span>
                                  )}
                                </div>
                                {contact.notes && (
                                  <p className="text-sm text-gray-600 mt-2 bg-gray-50 p-2 rounded">
                                    {contact.notes}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleEditContact(contact)}
                                data-testid={`button-edit-contact-${contact.id}`}
                              >
                                <Pencil className="w-3 h-3 mr-1" />
                                Edit
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleDeleteContact(contact)}
                                disabled={deleteContactMutation.isPending}
                                data-testid={`button-delete-contact-${contact.id}`}
                              >
                                <Trash2 className="w-3 h-3 mr-1 text-red-500" />
                                Delete
                              </Button>
                              <Link href={`/target-companies/${contact.company.id}`}>
                                <Button variant="outline" size="sm">
                                  <Eye className="w-3 h-3 mr-1" />
                                  View Company
                                </Button>
                              </Link>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Other Contacts - only show when not filtering for primary only */}
              {otherContacts.length > 0 && !showPrimaryOnly && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <span className="w-2 h-2 bg-gray-400 rounded-full mr-2"></span>
                    Other Contacts ({otherContacts.length})
                  </h2>
                  <div className="grid gap-4">
                    {otherContacts.map((contact) => (
                      <Card key={contact.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-4">
                              <div className="h-12 w-12 bg-gray-100 rounded-full flex items-center justify-center">
                                <User className="w-6 h-6 text-gray-600" />
                              </div>
                              <div className="flex-1">
                                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                                  {contact.firstName} {contact.lastName}
                                </h3>
                                {contact.title && (
                                  <p className="text-sm text-gray-600 mb-1">{contact.title}</p>
                                )}
                                <div className="flex items-center gap-4 text-sm text-gray-500 mb-2">
                                  <div className="flex items-center gap-1">
                                    <Building className="w-3 h-3" />
                                    <Link 
                                      href={`/target-companies/${contact.company.id}`}
                                      className="text-blue-600 hover:underline"
                                    >
                                      {contact.company.companyName}
                                    </Link>
                                  </div>
                                  {contact.company.industry && (
                                    <Badge variant="secondary" className="text-xs">
                                      {contact.company.industry}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-4 text-sm">
                                  {contact.email && (
                                    <a 
                                      href={`mailto:${contact.email}`} 
                                      className="text-blue-600 hover:underline flex items-center gap-1"
                                    >
                                      <Mail className="w-3 h-3" />
                                      {contact.email}
                                    </a>
                                  )}
                                  {contact.phone && (
                                    <span className="text-gray-600 flex items-center gap-1">
                                      <Phone className="w-3 h-3" />
                                      {contact.phone}
                                    </span>
                                  )}
                                </div>
                                {contact.notes && (
                                  <p className="text-sm text-gray-600 mt-2 bg-gray-50 p-2 rounded">
                                    {contact.notes}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleEditContact(contact)}
                                data-testid={`button-edit-contact-${contact.id}`}
                              >
                                <Pencil className="w-3 h-3 mr-1" />
                                Edit
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleDeleteContact(contact)}
                                disabled={deleteContactMutation.isPending}
                                data-testid={`button-delete-contact-${contact.id}`}
                              >
                                <Trash2 className="w-3 h-3 mr-1 text-red-500" />
                                Delete
                              </Button>
                              <Link href={`/target-companies/${contact.company.id}`}>
                                <Button variant="outline" size="sm">
                                  <Eye className="w-3 h-3 mr-1" />
                                  View Company
                                </Button>
                              </Link>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* When showing primary only, display all filtered contacts without grouping */}
              {showPrimaryOnly && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <span className="w-2 h-2 bg-blue-600 rounded-full mr-2"></span>
                    Primary Contacts ({filteredContacts.length})
                  </h2>
                  <div className="grid gap-4">
                    {filteredContacts.map((contact) => (
                      <Card key={contact.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-4">
                              <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                                <User className="w-6 h-6 text-blue-600" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="text-lg font-semibold text-gray-900">
                                    {contact.firstName} {contact.lastName}
                                  </h3>
                                  <Badge variant="default">Primary</Badge>
                                </div>
                                {contact.title && (
                                  <p className="text-sm text-gray-600 mb-1">{contact.title}</p>
                                )}
                                <div className="flex items-center gap-4 text-sm text-gray-500 mb-2">
                                  <div className="flex items-center gap-1">
                                    <Building className="w-3 h-3" />
                                    <Link 
                                      href={`/target-companies/${contact.company.id}`}
                                      className="text-blue-600 hover:underline"
                                    >
                                      {contact.company.companyName}
                                    </Link>
                                  </div>
                                  {contact.company.industry && (
                                    <Badge variant="secondary" className="text-xs">
                                      {contact.company.industry}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-4 text-sm">
                                  {contact.email && (
                                    <a 
                                      href={`mailto:${contact.email}`} 
                                      className="text-blue-600 hover:underline flex items-center gap-1"
                                    >
                                      <Mail className="w-3 h-3" />
                                      {contact.email}
                                    </a>
                                  )}
                                  {contact.phone && (
                                    <span className="text-gray-600 flex items-center gap-1">
                                      <Phone className="w-3 h-3" />
                                      {contact.phone}
                                    </span>
                                  )}
                                </div>
                                {contact.notes && (
                                  <p className="text-sm text-gray-600 mt-2 bg-gray-50 p-2 rounded">
                                    {contact.notes}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleEditContact(contact)}
                                data-testid={`button-edit-contact-${contact.id}`}
                              >
                                <Pencil className="w-3 h-3 mr-1" />
                                Edit
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleDeleteContact(contact)}
                                disabled={deleteContactMutation.isPending}
                                data-testid={`button-delete-contact-${contact.id}`}
                              >
                                <Trash2 className="w-3 h-3 mr-1 text-red-500" />
                                Delete
                              </Button>
                              <Link href={`/target-companies/${contact.company.id}`}>
                                <Button variant="outline" size="sm">
                                  <Eye className="w-3 h-3 mr-1" />
                                  View Company
                                </Button>
                              </Link>
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
        </div>
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
              {/* Target Company Selection */}
              <FormField
                control={contactForm.control}
                name="targetCompanyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target Company *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a target company" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {targetCompanies.map((company) => (
                          <SelectItem key={company.id} value={company.id.toString()}>
                            {company.companyName}
                            {company.industry && (
                              <span className="text-muted-foreground ml-2">
                                ({company.industry})
                              </span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                      <Input placeholder="CEO, CTO, etc." {...field} />
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
                        <Input placeholder="+1 (555) 123-4567" {...field} />
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
                        Primary Contact
                      </FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Mark this person as the primary contact for this company
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
                        placeholder="Any additional notes about this contact..."
                        className="min-h-[80px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowContactForm(false)}
                  disabled={createContactMutation.isPending || updateContactMutation.isPending}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createContactMutation.isPending || updateContactMutation.isPending}
                  data-testid="button-submit-contact"
                >
                  {createContactMutation.isPending || updateContactMutation.isPending
                    ? (editingContact ? "Updating..." : "Adding...") 
                    : (editingContact ? "Update Contact" : "Add Contact")
                  }
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}