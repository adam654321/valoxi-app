import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Building2, Users, Settings, CheckCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertUserCompanySchema } from "@shared/schema";

// Company form schema
const companyFormSchema = insertUserCompanySchema.extend({
  email: z.string().email("Please enter a valid email").optional().or(z.literal("")),
});

type CompanyForm = z.infer<typeof companyFormSchema>;

interface UserCompany {
  id: number;
  companyId: number;
  companyName: string;
  email?: string;
  phone?: string;
  address?: string;
  isAdmin: boolean;
  role: string;
  joinedAt: string;
  isActive: boolean;
  isCurrent: boolean;
}

export default function CompanyAccounts() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const { toast } = useToast();

  const form = useForm<CompanyForm>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: {
      companyName: "",
      email: "",
      phone: "",
      address: "",
    },
  });

  // Get user's companies
  const { data: companies = [], isLoading } = useQuery<UserCompany[]>({
    queryKey: ["/api/v2/user/companies"],
  });

  // Create company mutation
  const createMutation = useMutation({
    mutationFn: async (data: CompanyForm) => {
      return await apiRequest("POST", "/api/v2/user/companies", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v2/user/companies"] });
      setShowCreateForm(false);
      form.reset();
      toast({
        title: "Success",
        description: "Company account created successfully!",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create company account",
        variant: "destructive",
      });
    },
  });

  // Switch company mutation
  const switchMutation = useMutation({
    mutationFn: async (companyId: number) => {
      return await apiRequest("POST", `/api/v2/user/companies/${companyId}/switch`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v2/user/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/v2/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/v2/target-companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/v2/dashboard/stats"] });
      toast({
        title: "Success", 
        description: "Switched to company successfully!",
      });
      // Reload page to refresh all data for new company
      window.location.reload();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to switch company",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CompanyForm) => {
    createMutation.mutate(data);
  };

  const handleSwitchCompany = (companyId: number) => {
    switchMutation.mutate(companyId);
  };

  const currentCompany = companies.find(c => c.isCurrent);
  const canAddMore = companies.length < 5;

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Company Accounts</h1>
          <p className="text-gray-600 mt-2">
            Manage your company accounts. You can have up to 5 companies.
          </p>
        </div>
        {canAddMore && (
          <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Company
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Company Account</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="companyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter company name" {...field} />
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
                          <Input placeholder="company@example.com" type="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
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
                  
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                          <Input placeholder="Company address" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="flex gap-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowCreateForm(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={createMutation.isPending}
                      className="flex-1"
                    >
                      {createMutation.isPending ? "Creating..." : "Create Company"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Current Company */}
      {currentCompany && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-blue-600" />
                Current Company
              </CardTitle>
              <Badge variant="default" className="bg-blue-600">
                Active
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold text-lg">{currentCompany.companyName}</h3>
                {currentCompany.email && (
                  <p className="text-sm text-gray-600">{currentCompany.email}</p>
                )}
                {currentCompany.phone && (
                  <p className="text-sm text-gray-600">{currentCompany.phone}</p>
                )}
              </div>
              <div className="flex items-center justify-end gap-2">
                <Badge variant="secondary">
                  {currentCompany.isAdmin ? "Admin" : currentCompany.role}
                </Badge>
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Other Companies */}
      {companies.filter(c => !c.isCurrent).length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Other Companies ({companies.filter(c => !c.isCurrent).length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {companies
              .filter(c => !c.isCurrent)
              .map((company) => (
                <Card key={company.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">{company.companyName}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 mb-4">
                      {company.email && (
                        <p className="text-sm text-gray-600">{company.email}</p>
                      )}
                      {company.phone && (
                        <p className="text-sm text-gray-600">{company.phone}</p>
                      )}
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {company.isAdmin ? "Admin" : company.role}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          Joined {new Date(company.joinedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleSwitchCompany(company.companyId)}
                      disabled={switchMutation.isPending}
                      className="w-full"
                      variant="outline"
                    >
                      {switchMutation.isPending ? "Switching..." : "Switch to Company"}
                    </Button>
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {companies.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Company Accounts</h3>
            <p className="text-gray-600 mb-4">
              Create your first company account to get started with the M&A CRM platform.
            </p>
            <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Company
                </Button>
              </DialogTrigger>
            </Dialog>
          </CardContent>
        </Card>
      )}

      {/* Limit Message */}
      {!canAddMore && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-amber-600" />
              <p className="text-amber-800">
                You've reached the maximum limit of 5 company accounts.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}