import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Link, useLocation } from "wouter";
import { Pencil, Trash2, Building2, Eye } from "lucide-react";
import type { TargetCompany } from "@shared/schema";

const industries = [
  'Technology',
  'Manufacturing',
  'Retail',
  'Healthcare',
  'Financial Services',
  'Real Estate',
  'Construction',
  'Transportation',
  'Food & Beverage',
  'Professional Services',
  'Education',
  'Entertainment',
  'Agriculture',
  'Energy',
  'Other'
];

const targetCompanySchema = z.object({
  companyName: z.string().min(2, "Company name must be at least 2 characters"),
  industry: z.string().min(1, "Industry is required"),
  subSector: z.string().optional().nullable(),
  website: z.string().url("Please enter a valid website URL").optional().or(z.literal("")),
  phone: z.string().optional(),
  email: z.string().email("Please enter a valid email address").optional().or(z.literal("")),
  address: z.string().optional(),
  annualRevenue: z.union([z.string(), z.number()]).optional(),
  employeeCount: z.union([z.string(), z.number()]).optional(),
  yearEstablished: z.union([z.string(), z.number()]).optional(),
  description: z.string().optional(),
});

type TargetCompanyForm = z.infer<typeof targetCompanySchema>;

export default function TargetCompanies() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [showForm, setShowForm] = useState(false);
  const [editingCompany, setEditingCompany] = useState<TargetCompany | null>(null);

  const form = useForm<TargetCompanyForm>({
    resolver: zodResolver(targetCompanySchema),
    defaultValues: {
      companyName: "",
      industry: "",
      website: "",
      phone: "",
      email: "",
      address: "",
      annualRevenue: "",
      employeeCount: "",
      yearEstablished: "",
      description: "",
    },
  });

  const { data: targetCompanies = [], isLoading } = useQuery<TargetCompany[]>({
    queryKey: ["/api/v2/target-companies"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: TargetCompanyForm) => {
      const payload = {
        ...data,
        website: data.website || null,
        email: data.email || null,
      };
      return await apiRequest("POST", "/api/v2/target-companies", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v2/target-companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/v2/dashboard/stats"] });
      setShowForm(false);
      form.reset();
      toast({
        title: "Success",
        description: "Target company added successfully!",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add target company",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: TargetCompanyForm) => {
      if (!editingCompany) return;
      const payload = {
        ...data,
        subSector: data.subSector || null,
        website: data.website || null,
        email: data.email || null,
      };
      return await apiRequest("PUT", `/api/v2/target-companies/${editingCompany.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v2/target-companies"] });
      setEditingCompany(null);
      setShowForm(false);
      form.reset();
      toast({
        title: "Success",
        description: "Target company updated successfully!",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update target company",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/v2/target-companies/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v2/target-companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/v2/dashboard/stats"] });
      toast({
        title: "Success",
        description: "Target company deleted successfully!",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete target company",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: TargetCompanyForm) => {
    if (editingCompany) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (company: TargetCompany) => {
    setEditingCompany(company);
    form.reset({
      companyName: company.companyName,
      industry: company.industry || "",
      subSector: company.subSector || "",
      website: company.website || "",
      phone: company.phone || "",
      email: company.email || "",
      address: company.address || "",
      annualRevenue: company.annualRevenue?.toString() || "",
      employeeCount: company.employeeCount?.toString() || "",
      yearEstablished: company.yearEstablished?.toString() || "",
      description: company.description || "",
    });
    setShowForm(true);
  };

  const handleAddNew = () => {
    setEditingCompany(null);
    form.reset();
    setShowForm(true);
  };

  const handleCardClick = (company: TargetCompany, event: React.MouseEvent) => {
    console.log('Card clicked:', company.id, event.target);
    // Don't navigate if clicking on buttons or links
    const target = event.target as HTMLElement;
    if (target.closest('button') || target.closest('a')) {
      console.log('Click ignored - clicked on button or link');
      return;
    }
    console.log('Navigating to:', `/target-companies/${company.id}`);
    setLocation(`/target-companies/${company.id}`);
  };

  const formatCurrency = (amount: number | string | null) => {
    if (!amount) return "Not specified";
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Header */}
      <nav className="bg-card shadow-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <span className="ml-3 text-xl font-semibold text-textPrimary">Valoxi</span>
              </div>
              <div className="hidden md:ml-10 md:flex md:space-x-8">
                <Link href="/dashboard" className="text-textSecondary hover:text-textPrimary border-b-2 border-transparent hover:border-border px-1 pt-1 pb-4 text-sm font-medium transition-colors">
                  Dashboard
                </Link>
                <Link href="/target-companies" className="text-primary border-b-2 border-primary px-1 pt-1 pb-4 text-sm font-medium">
                  Target Companies
                </Link>
                <Link href="/contacts" className="text-textSecondary hover:text-textPrimary border-b-2 border-transparent hover:border-border px-1 pt-1 pb-4 text-sm font-medium transition-colors">
                  Contacts
                </Link>
                <a href="#" className="text-textSecondary hover:text-textPrimary border-b-2 border-transparent hover:border-border px-1 pt-1 pb-4 text-sm font-medium transition-colors">
                  Reports
                </a>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Button onClick={handleAddNew} className="bg-primary text-white hover:bg-blue-700">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Target Company
              </Button>
              <div className="relative">
                <div className="h-8 w-8 bg-muted rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-textPrimary">Target Companies</h1>
          <p className="mt-1 text-textSecondary">
            Manage businesses you're interested in acquiring
          </p>
        </div>

        {/* Target Companies List */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="animate-pulse">
                    <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-muted rounded w-1/2 mb-4"></div>
                    <div className="h-3 bg-muted rounded w-full mb-2"></div>
                    <div className="h-3 bg-muted rounded w-2/3"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : targetCompanies.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Building2 className="mx-auto h-12 w-12 text-muted-foreground/70" />
                <h3 className="mt-2 text-sm font-medium text-foreground">No target companies yet</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Get started by adding your first potential acquisition target.
                </p>
                <div className="mt-6">
                  <Button onClick={handleAddNew} className="bg-primary hover:bg-blue-700">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Target Company
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {targetCompanies.map((company) => (
              <Card 
                key={company.id} 
                className="hover:shadow-lg transition-shadow cursor-pointer" 
                onClick={(event) => handleCardClick(company, event)}
                data-testid={`card-company-${company.id}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{company.companyName}</CardTitle>
                      {company.industry && (
                        <Badge variant="secondary" className="mt-1">
                          {company.industry}
                        </Badge>
                      )}
                    </div>
                    <div className="flex space-x-1">
                      <Link href={`/target-companies/${company.id}`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="View Details"
                          data-testid={`button-view-details-${company.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(company)}
                        title="Edit Company"
                        data-testid={`button-edit-${company.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMutation.mutate(company.id)}
                        disabled={deleteMutation.isPending}
                        title="Delete Company"
                        data-testid={`button-delete-${company.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {company.annualRevenue && (
                      <div className="flex justify-between">
                        <span className="text-textSecondary">Annual Revenue:</span>
                        <span className="font-medium">{formatCurrency(company.annualRevenue)}</span>
                      </div>
                    )}
                    {company.employeeCount && (
                      <div className="flex justify-between">
                        <span className="text-textSecondary">Employees:</span>
                        <span className="font-medium">{company.employeeCount}</span>
                      </div>
                    )}
                    {company.yearEstablished && (
                      <div className="flex justify-between">
                        <span className="text-textSecondary">Founded:</span>
                        <span className="font-medium">{company.yearEstablished}</span>
                      </div>
                    )}
                    {company.website && (
                      <div className="pt-2">
                        <a
                          href={company.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline text-sm"
                        >
                          Visit Website
                        </a>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Company Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCompany ? "Edit Target Company" : "Add Target Company"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Basic Information Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-textPrimary">Basic Information</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="companyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Acme Corporation" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="industry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Industry *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select industry" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {industries.map((industry) => (
                              <SelectItem key={industry} value={industry}>
                                {industry}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="website"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Website</FormLabel>
                        <FormControl>
                          <Input 
                            type="url" 
                            placeholder="example.com"
                            {...field}
                            onChange={(e) => {
                              let value = e.target.value;
                              if (value && !value.startsWith('http://') && !value.startsWith('https://')) {
                                value = 'https://' + value;
                              }
                              field.onChange(value);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="contact@company.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input type="tel" placeholder="+1 (555) 123-4567" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Company headquarters address" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Business Details Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-textPrimary">Business Details</h3>
                
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="annualRevenue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Annual Revenue (£)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="1000000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="employeeCount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employees</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="50" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="yearEstablished"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Year Founded</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="2010" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe the company's business model, products/services, and market position..."
                          rows={4}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end space-x-4">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? "Saving..."
                    : editingCompany
                    ? "Update Company"
                    : "Add Company"
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