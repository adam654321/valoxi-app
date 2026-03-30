import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Building2 } from "lucide-react";
import {
  SearchFilterBar,
  CompanyCard,
  CompanyFormDialog,
  DeleteCompanyDialog,
  type SearchFilters,
  type TargetCompanyWithStats,
  type TargetCompanyForm,
} from "@/components/target-companies";

export default function EnhancedTargetCompanies() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [editingCompany, setEditingCompany] = useState<TargetCompanyWithStats | null>(null);
  const [companyToDelete, setCompanyToDelete] = useState<TargetCompanyWithStats | null>(null);

  const [filters, setFilters] = useState<SearchFilters>({
    q: "",
    sector: "all",
    minRevenue: "",
    maxRevenue: "",
    minEmployees: "",
    maxEmployees: "",
    minYear: "",
    maxYear: "",
    sort: "date_newest",
  });

  const [searchTerm, setSearchTerm] = useState("");
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setFilters(prev => ({ ...prev, q: searchTerm }));
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const searchParams = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    if (filters.sector && filters.sector !== 'all') params.set('industry', filters.sector);
    if (filters.minRevenue) params.set('minRevenue', filters.minRevenue);
    if (filters.maxRevenue) params.set('maxRevenue', filters.maxRevenue);
    if (filters.minEmployees) params.set('minEmployees', filters.minEmployees);
    if (filters.maxEmployees) params.set('maxEmployees', filters.maxEmployees);
    if (filters.minYear) params.set('minYear', filters.minYear);
    if (filters.maxYear) params.set('maxYear', filters.maxYear);
    if (filters.sort) params.set('sort', filters.sort);
    return params.toString();
  }, [filters]);

  const { data: searchResults = [], isLoading } = useQuery<TargetCompanyWithStats[]>({
    queryKey: ["/api/v2/target-companies/search", searchParams],
    queryFn: async () => {
      const response = await fetch(`/api/v2/target-companies/search?${searchParams}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch search results');
      }
      const data = await response.json();
      return data;
    },
    staleTime: 0,
    gcTime: 0,
  });

  const createMutation = useMutation({
    mutationFn: async (data: TargetCompanyForm) => {
      const payload = {
        companyName: data.companyName,
        industry: data.sector,
        subSector: data.subSector || null,
        website: data.website || null,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || null,
        annualRevenue: data.annualRevenue ? Number(data.annualRevenue) : null,
        employeeCount: data.employeeCount ? Number(data.employeeCount) : null,
        yearEstablished: data.yearEstablished ? Number(data.yearEstablished) : null,
        description: data.description || null,
      };
      return await apiRequest("POST", "/api/v2/target-companies", payload);
    },
    onSuccess: () => {
      queryClient.refetchQueries({
        queryKey: ["/api/v2/target-companies/search", searchParams.toString()],
        exact: true
      });
      queryClient.invalidateQueries({ queryKey: ["/api/v2/target-companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/v2/target-companies/search"] });
      queryClient.invalidateQueries({ queryKey: ["/api/v2/target-companies/filters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/v2/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/v2/dashboard/data/quick-stats"] });
      setShowForm(false);
      setEditingCompany(null);
      toast({
        title: "Success",
        description: "Target company added successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add target company",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: TargetCompanyForm & { id: number }) => {
      const payload = {
        companyName: data.companyName,
        industry: data.sector,
        subSector: data.subSector || null,
        website: data.website || null,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || null,
        annualRevenue: data.annualRevenue ? Number(data.annualRevenue) : null,
        employeeCount: data.employeeCount ? Number(data.employeeCount) : null,
        yearEstablished: data.yearEstablished ? Number(data.yearEstablished) : null,
        description: data.description || null,
      };
      return await apiRequest("PUT", `/api/v2/target-companies/${data.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v2/target-companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/v2/target-companies/search"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/v2/target-companies/filters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/v2/dashboard/stats"] });
      setEditingCompany(null);
      setShowForm(false);
      toast({
        title: "Success",
        description: "Target company updated successfully!",
      });
    },
    onError: (error: any) => {
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
      queryClient.invalidateQueries({ queryKey: ["/api/v2/target-companies/search"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/v2/target-companies/filters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/v2/dashboard/stats"] });
      toast({
        title: "Success",
        description: "Target company deleted successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete target company",
        variant: "destructive",
      });
    },
  });

  const handleFormSubmit = (data: TargetCompanyForm) => {
    if (editingCompany) {
      updateMutation.mutate({ ...data, id: editingCompany.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (company: TargetCompanyWithStats) => {
    setEditingCompany(company);
    setShowForm(true);
  };

  const handleAddNew = () => {
    setEditingCompany(null);
    setShowForm(true);
  };

  const handleDeleteConfirm = (id: number) => {
    deleteMutation.mutate(id);
    setCompanyToDelete(null);
  };

  const resetFilters = () => {
    setFilters({
      q: "",
      sector: "all",
      minRevenue: "",
      maxRevenue: "",
      minEmployees: "",
      maxEmployees: "",
      minYear: "",
      maxYear: "",
      sort: "date_newest",
    });
    setSearchTerm("");
    setShowFilters(false);
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.q) count++;
    if (filters.sector && filters.sector !== 'all') count++;
    if (filters.minRevenue) count++;
    if (filters.maxRevenue) count++;
    if (filters.minEmployees) count++;
    if (filters.maxEmployees) count++;
    if (filters.minYear) count++;
    if (filters.maxYear) count++;
    return count;
  }, [filters]);

  if (!user) {
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-textPrimary">Target Companies</h1>
        <p className="mt-1 text-textSecondary">
          Add and manage businesses you're interested in acquiring
        </p>
      </div>

      <SearchFilterBar
        filters={filters}
        setFilters={setFilters}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        activeFiltersCount={activeFiltersCount}
        resetFilters={resetFilters}
        resultCount={Array.isArray(searchResults) ? searchResults.length : 0}
      />

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
      ) : !Array.isArray(searchResults) || searchResults.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Building2 className="mx-auto h-12 w-12 text-muted-foreground/70" />
              <h3 className="mt-2 text-sm font-medium text-foreground">No companies found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {activeFiltersCount > 0
                  ? "Try adjusting your search filters or add your first target company."
                  : "Get started by adding your first potential acquisition target."
                }
              </p>
              <div className="mt-6">
                <Button onClick={handleAddNew} className="bg-primary hover:bg-blue-700">
                  <Building2 className="w-4 h-4 mr-2" />
                  Add Target Company
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.isArray(searchResults) && searchResults.map((company: TargetCompanyWithStats) => (
            <CompanyCard
              key={company.id}
              company={company}
              onEdit={handleEdit}
              onDelete={setCompanyToDelete}
              isDeletePending={deleteMutation.isPending}
            />
          ))}
        </div>
      )}

      <CompanyFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        editingCompany={editingCompany}
        onSubmit={handleFormSubmit}
        isPending={createMutation.isPending || updateMutation.isPending}
      />

      <DeleteCompanyDialog
        company={companyToDelete}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setCompanyToDelete(null)}
      />
    </div>
  );
}
