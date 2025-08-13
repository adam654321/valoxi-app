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
import { ArrowLeft, Plus, Edit, Trash2, Mail, Phone, User, MapPin, Globe, Calendar, Users, DollarSign } from "lucide-react";
import type { TargetCompany, TargetContact } from "@shared/schema";

const contactSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  title: z.string().optional(),
  email: z.string().email("Please enter a valid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  isPrimary: z.boolean().default(false),
  notes: z.string().optional(),
});

type ContactForm = z.infer<typeof contactSchema>;

export default function TargetCompanyDetail() {
  const { id } = useParams();
  const { toast } = useToast();
  const [showContactForm, setShowContactForm] = useState(false);
  const [editingContact, setEditingContact] = useState<TargetContact | null>(null);

  const contactForm = useForm<ContactForm>({
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

  // Get target company details
  const { data: company, isLoading: companyLoading } = useQuery<TargetCompany>({
    queryKey: ["/api/target-companies", id],
    enabled: !!id,
  });

  // Get contacts for this company
  const { data: contacts = [], isLoading: contactsLoading } = useQuery<TargetContact[]>({
    queryKey: ["/api/target-companies", id, "contacts"],
    enabled: !!id,
  });

  // Create contact mutation
  const createContactMutation = useMutation({
    mutationFn: async (data: ContactForm) => {
      return await apiRequest("POST", `/api/target-companies/${id}/contacts`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/target-companies", id, "contacts"] });
      setShowContactForm(false);
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
      return await apiRequest("PUT", `/api/contacts/${editingContact.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/target-companies", id, "contacts"] });
      setEditingContact(null);
      setShowContactForm(false);
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
    mutationFn: async (contactId: number) => {
      return await apiRequest("DELETE", `/api/contacts/${contactId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/target-companies", id, "contacts"] });
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
    contactForm.reset();
    setEditingContact(null);
    setShowContactForm(true);
  };

  const handleEditContact = (contact: TargetContact) => {
    contactForm.reset({
      firstName: contact.firstName,
      lastName: contact.lastName,
      title: contact.title || "",
      email: contact.email || "",
      phone: contact.phone || "",
      isPrimary: contact.isPrimary || false,
      notes: contact.notes || "",
    });
    setEditingContact(contact);
    setShowContactForm(true);
  };

  const handleSubmitContact = (data: ContactForm) => {
    if (editingContact) {
      updateContactMutation.mutate(data);
    } else {
      createContactMutation.mutate(data);
    }
  };

  const handleDeleteContact = (contactId: number) => {
    if (confirm("Are you sure you want to delete this contact?")) {
      deleteContactMutation.mutate(contactId);
    }
  };

  if (companyLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
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

  const formatNumber = (value: string | null | undefined) => {
    if (!value) return "N/A";
    const num = parseInt(value);
    if (isNaN(num)) return value;
    return new Intl.NumberFormat().format(num);
  };

  const primaryContact = contacts.find(c => c.isPrimary);
  const otherContacts = contacts.filter(c => !c.isPrimary);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/target-companies">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{company.companyName}</h1>
            {company.industry && (
              <Badge variant="secondary" className="mt-1">
                {company.industry}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Company Information */}
      <Card>
        <CardHeader>
          <CardTitle>Company Information</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {company.website && (
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-muted-foreground" />
              <a 
                href={company.website} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                {company.website.replace(/^https?:\/\//, '')}
              </a>
            </div>
          )}

          {company.email && (
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <a href={`mailto:${company.email}`} className="text-blue-600 hover:underline">
                {company.email}
              </a>
            </div>
          )}

          {company.phone && (
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <span>{company.phone}</span>
            </div>
          )}

          {company.address && (
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <span>{company.address}</span>
            </div>
          )}

          {company.annualRevenue && (
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <span>Annual Revenue: {formatCurrency(company.annualRevenue)}</span>
            </div>
          )}

          {company.employeeCount && (
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span>Employees: {formatNumber(company.employeeCount)}</span>
            </div>
          )}

          {company.yearEstablished && (
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span>Established: {company.yearEstablished}</span>
            </div>
          )}
        </CardContent>
        
        {company.description && (
          <>
            <CardHeader className="pt-0">
              <CardTitle className="text-lg">Description</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-muted-foreground">{company.description}</p>
            </CardContent>
          </>
        )}
      </Card>

      {/* Contacts Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Contacts</CardTitle>
            <CardDescription>
              Key people at {company.companyName}
            </CardDescription>
          </div>
          <Button onClick={handleAddContact}>
            <Plus className="w-4 h-4 mr-2" />
            Add Contact
          </Button>
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
            </div>
          ) : (
            <div className="space-y-4">
              {/* Primary Contact */}
              {primaryContact && (
                <div className="border rounded-lg p-4 bg-blue-50 dark:bg-blue-950/20">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">
                          {primaryContact.firstName} {primaryContact.lastName}
                        </h4>
                        <Badge variant="default">Primary</Badge>
                      </div>
                      {primaryContact.title && (
                        <p className="text-sm text-muted-foreground">{primaryContact.title}</p>
                      )}
                      <div className="flex flex-wrap gap-4 text-sm">
                        {primaryContact.email && (
                          <a href={`mailto:${primaryContact.email}`} className="text-blue-600 hover:underline flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {primaryContact.email}
                          </a>
                        )}
                        {primaryContact.phone && (
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {primaryContact.phone}
                          </span>
                        )}
                      </div>
                      {primaryContact.notes && (
                        <p className="text-sm text-muted-foreground mt-2">{primaryContact.notes}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditContact(primaryContact)}
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteContact(primaryContact.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Other Contacts */}
              {otherContacts.map((contact) => (
                <div key={contact.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <h4 className="font-semibold">
                        {contact.firstName} {contact.lastName}
                      </h4>
                      {contact.title && (
                        <p className="text-sm text-muted-foreground">{contact.title}</p>
                      )}
                      <div className="flex flex-wrap gap-4 text-sm">
                        {contact.email && (
                          <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {contact.email}
                          </a>
                        )}
                        {contact.phone && (
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {contact.phone}
                          </span>
                        )}
                      </div>
                      {contact.notes && (
                        <p className="text-sm text-muted-foreground mt-2">{contact.notes}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditContact(contact)}
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteContact(contact.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
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
                        <Input type="email" placeholder="john@example.com" {...field} />
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
                        <Input type="tel" placeholder="(555) 123-4567" {...field} />
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
                      <FormLabel>Primary Contact</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Mark this as the main person to contact at this company
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
                        placeholder="Additional information about this contact..."
                        className="resize-none"
                        rows={3}
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowContactForm(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createContactMutation.isPending || updateContactMutation.isPending}
                >
                  {editingContact ? "Update Contact" : "Add Contact"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}