import { useState, useEffect, useMemo } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Link, useLocation } from "wouter";
import { 
  Pencil, 
  Trash2, 
  Building2, 
  Eye, 
  Search, 
  Filter, 
  SlidersHorizontal,
  X,
  Users,
  DollarSign,
  Calendar
} from "lucide-react";

const sectorsData: Record<string, string[]> = {
  "Agriculture": [
    "Agri-tech",
    "Crop Production",
    "Forestry & Timber",
    "Livestock & Dairy",
    "Sustainable Farming Practices"
  ],
  "Construction": [
    "Commercial Construction",
    "Infrastructure & Civil Engineering",
    "Property Refurbishment",
    "Residential Building",
    "Specialist Trades & Building Services"
  ],
  "Education": [
    "Early Years & Schools",
    "Educational Technology",
    "Higher Education",
    "Private Training & Development",
    "Vocational & Apprenticeship Training"
  ],
  "Energy": [
    "Fossil Fuels",
    "Grid & Power Distribution",
    "Nuclear Energy",
    "Renewable Energy",
    "Smart Energy Systems & Storage"
  ],
  "Entertainment": [
    "Film & Television",
    "Gaming",
    "Music & Live Events",
    "Publishing & Media Production",
    "Sports & Recreation"
  ],
  "Financial Services": [
    "Banking & Payments",
    "FinTech",
    "Insurance",
    "Lending & Credit Services",
    "Wealth & Investment Management"
  ],
  "Food & Beverage": [
    "Food Manufacturing",
    "Hospitality & Restaurants",
    "Packaging & Food Distribution",
    "Retail & Wholesale Food Supply",
    "Soft Drinks & Alcohol Production"
  ],
  "Healthcare": [
    "Hospitals & Secondary Care",
    "Medical Devices & Diagnostics",
    "Non-Surgical Aesthetics",
    "Pharmaceuticals & Biotech",
    "Primary Care & Medical Clinics"
  ],
  "Manufacturing": [
    "Automotive Manufacturing",
    "Chemicals & Materials",
    "Electronics & Components",
    "Industrial & Machinery",
    "Textiles & Consumer Goods"
  ],
  "Other": [],
  "Professional Services": [
    "Accountancy & Finance",
    "Consultancy & Advisory",
    "HR & Recruitment",
    "Legal Services",
    "Marketing & Creative Services"
  ],
  "Real Estate": [
    "Commercial Property",
    "Estate Management & Maintenance",
    "Property Development",
    "PropTech",
    "Residential Property Sales & Lettings"
  ],
  "Retail": [
    "E-commerce",
    "Fashion & Apparel",
    "General Retail",
    "Grocery & Convenience Retail",
    "Luxury & Specialist Retail"
  ],
  "Technology": [
    "Artificial Intelligence",
    "Cloud Computing",
    "Cyber Security",
    "Hardware & Electronics",
    "Software & SaaS"
  ],
  "Transportation": [
    "Automotive Transport",
    "Aviation",
    "Logistics & Freight",
    "Public Transport",
    "Shipping & Maritime"
  ]
};

const sectors = Object.keys(sectorsData).sort();

const targetCompanySchema = z.object({
  companyName: z.string().min(2, "Company name must be at least 2 characters"),
  sector: z.string().min(1, "Sector is required"),
  subSector: z.string(),
  website: z.string().optional().or(z.literal("")).refine((val) => {
    if (!val || val === "") return true;
    const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
    return urlPattern.test(val);
  }, "Please enter a valid website URL (example.com or https://example.com)"),
  phone: z.string().optional(),
  email: z.string().email("Please enter a valid email address").optional().or(z.literal("")),
  address: z.string().optional(),
  annualRevenue: z.union([z.string(), z.number()]).optional(),
  employeeCount: z.union([z.string(), z.number()]).optional(),
  yearEstablished: z.union([z.string(), z.number()]).optional(),
  description: z.string().optional(),
}).refine((data) => {
  if (data.sector === "Other") return true;
  return data.subSector && data.subSector.length > 0;
}, {
  message: "Sub-sector is required",
  path: ["subSector"],
});

type TargetCompanyForm = z.infer<typeof targetCompanySchema>;

interface SearchFilters {
  q: string;
  sector: string;
  minRevenue: string;
  maxRevenue: string;
  minEmployees: string;
  maxEmployees: string;
  minYear: string;
  maxYear: string;
  sort: string;
}

interface TargetCompanyWithStats {
  id: number;
  userCompanyId: number;
  companyName: string;
  industry: string | null;
  subSector: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  annualRevenue: string | null;
  employeeCount: number | null;
  yearEstablished: number | null;
  description: string | null;
  createdBy: number | null;
  createdAt: string;
  contactCount: number;
  primaryContactName: string | null;
}

interface FilterOptions {
  industries: string[];
  sectors: string[];
  revenueRange: {
    min: number | null;
    max: number | null;
  };
  employeeRange: {
    min: number | null;
    max: number | null;
  };
  yearRange: {
    min: number | null;
    max: number | null;
  };
}

export default function EnhancedTargetCompanies() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [showForm, setShowForm] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [editingCompany, setEditingCompany] = useState<TargetCompanyWithStats | null>(null);
  
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

  const form = useForm<TargetCompanyForm>({
    resolver: zodResolver(targetCompanySchema),
    defaultValues: {
      companyName: "",
      sector: "",
      subSector: "",
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

  const selectedSector = form.watch("sector");
  const availableSubSectors = selectedSector ? sectorsData[selectedSector] || [] : [];

  // Debounce search
  const [searchTerm, setSearchTerm] = useState("");
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setFilters(prev => ({ ...prev, q: searchTerm }));
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  // Get filter options
  const { data: filterOptions } = useQuery<FilterOptions>({
    queryKey: ["/api/target-companies/filters"],
  });

  // Build search params
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

  // Get search results
  const { data: searchResults = [], isLoading } = useQuery<TargetCompanyWithStats[]>({
    queryKey: ["/api/target-companies/search", searchParams],
    queryFn: async () => {
      const response = await fetch(`/api/target-companies/search?${searchParams}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch search results');
      }
      return response.json();
    },
    staleTime: 0, // Always refetch
    gcTime: 0,    // Don't cache
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
      return await apiRequest("POST", "/api/target-companies", payload);
    },
    onSuccess: () => {
      // Immediately refetch the current search query
      queryClient.refetchQueries({ 
        queryKey: ["/api/target-companies/search", searchParams.toString()],
        exact: true 
      });
      
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ["/api/target-companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/target-companies/search"] });
      queryClient.invalidateQueries({ queryKey: ["/api/target-companies/filters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/data/quick-stats"] });
      
      setShowForm(false);
      form.reset();
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
    mutationFn: async (data: TargetCompanyForm) => {
      if (!editingCompany) return;
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
      return await apiRequest("PUT", `/api/target-companies/${editingCompany.id}`, payload);
    },
    onSuccess: () => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ["/api/target-companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/target-companies/search"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/target-companies/filters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setEditingCompany(null);
      setShowForm(false);
      form.reset();
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
      return await apiRequest("DELETE", `/api/target-companies/${id}`);
    },
    onSuccess: () => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ["/api/target-companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/target-companies/search"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/target-companies/filters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
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

  const onSubmit = (data: TargetCompanyForm) => {
    // Auto-prefix website URL with https:// if not present
    const processedData = {
      ...data,
      website: data.website && !data.website.startsWith('http://') && !data.website.startsWith('https://') 
        ? `https://${data.website}` 
        : data.website
    };

    if (editingCompany) {
      updateMutation.mutate(processedData);
    } else {
      createMutation.mutate(processedData);
    }
  };

  const handleEdit = (company: TargetCompanyWithStats) => {
    setEditingCompany(company);
    form.reset({
      companyName: company.companyName,
      sector: company.industry || "",
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

  const handleCardClick = (company: TargetCompanyWithStats, event: React.MouseEvent) => {
    // Don't navigate if clicking on buttons or links
    const target = event.target as HTMLElement;
    if (target.closest('button') || target.closest('a')) {
      return;
    }
    setLocation(`/target-companies/${company.id}`);
  };

  const formatCurrency = (amount: string | number | null) => {
    if (!amount) return "Not specified";
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
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
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-textPrimary">Target Companies</h1>
          <p className="mt-1 text-textSecondary">
            Manage and discover businesses you're interested in acquiring
          </p>
        </div>

        {/* Search and Filter Bar */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="space-y-4">
              {/* Search Row */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search companies, industries, or locations..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                    data-testid="input-search"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowFilters(!showFilters)}
                    className="relative"
                    data-testid="button-toggle-filters"
                  >
                    <SlidersHorizontal className="h-4 w-4 mr-2" />
                    Filters
                    {activeFiltersCount > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {activeFiltersCount}
                      </Badge>
                    )}
                  </Button>
                  <Select value={filters.sort} onValueChange={(value) => setFilters(prev => ({ ...prev, sort: value }))}>
                    <SelectTrigger className="w-48" data-testid="select-sort">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date_newest">Newest First</SelectItem>
                      <SelectItem value="date_oldest">Oldest First</SelectItem>
                      <SelectItem value="name_asc">Name A-Z</SelectItem>
                      <SelectItem value="name_desc">Name Z-A</SelectItem>
                      <SelectItem value="revenue_high">Revenue High-Low</SelectItem>
                      <SelectItem value="revenue_low">Revenue Low-High</SelectItem>
                      <SelectItem value="employees_high">Employees High-Low</SelectItem>
                      <SelectItem value="employees_low">Employees Low-High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Filter Panel */}
              {showFilters && (
                <>
                  <Separator />
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Sector Filter */}
                    <div>
                      <label className="text-sm font-medium text-textPrimary mb-2 block">Sector</label>
                      <Select 
                        value={filters.sector} 
                        onValueChange={(value) => setFilters(prev => ({ ...prev, sector: value }))}
                      >
                        <SelectTrigger data-testid="select-sector-filter">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Sectors</SelectItem>
                          {sectors.map((sector) => (
                            <SelectItem key={sector} value={sector}>
                              {sector}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Revenue Range */}
                    <div>
                      <label className="text-sm font-medium text-textPrimary mb-2 block">
                        Revenue Range (£)
                      </label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          placeholder="Min"
                          value={filters.minRevenue}
                          onChange={(e) => setFilters(prev => ({ ...prev, minRevenue: e.target.value }))}
                          data-testid="input-min-revenue"
                        />
                        <Input
                          type="number"
                          placeholder="Max"
                          value={filters.maxRevenue}
                          onChange={(e) => setFilters(prev => ({ ...prev, maxRevenue: e.target.value }))}
                          data-testid="input-max-revenue"
                        />
                      </div>
                    </div>

                    {/* Employee Count */}
                    <div>
                      <label className="text-sm font-medium text-textPrimary mb-2 block">
                        Employee Count
                      </label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          placeholder="Min"
                          value={filters.minEmployees}
                          onChange={(e) => setFilters(prev => ({ ...prev, minEmployees: e.target.value }))}
                          data-testid="input-min-employees"
                        />
                        <Input
                          type="number"
                          placeholder="Max"
                          value={filters.maxEmployees}
                          onChange={(e) => setFilters(prev => ({ ...prev, maxEmployees: e.target.value }))}
                          data-testid="input-max-employees"
                        />
                      </div>
                    </div>

                    {/* Year Established */}
                    <div>
                      <label className="text-sm font-medium text-textPrimary mb-2 block">
                        Year Established
                      </label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          placeholder="Min"
                          value={filters.minYear}
                          onChange={(e) => setFilters(prev => ({ ...prev, minYear: e.target.value }))}
                          data-testid="input-min-year"
                        />
                        <Input
                          type="number"
                          placeholder="Max"
                          value={filters.maxYear}
                          onChange={(e) => setFilters(prev => ({ ...prev, maxYear: e.target.value }))}
                          data-testid="input-max-year"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Filter Actions */}
                  <div className="flex justify-between items-center pt-4">
                    <div className="text-sm text-textSecondary" data-testid="text-results-count">
                      Showing {Array.isArray(searchResults) ? searchResults.length : 0} companies
                    </div>
                    <Button variant="outline" onClick={resetFilters} data-testid="button-reset-filters">
                      <X className="h-4 w-4 mr-2" />
                      Reset All Filters
                    </Button>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2 mb-4"></div>
                    <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !Array.isArray(searchResults) || searchResults.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Building2 className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No companies found</h3>
                <p className="mt-1 text-sm text-gray-500">
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
              <Card 
                key={company.id} 
                className="hover:shadow-lg transition-shadow cursor-pointer" 
                onClick={(event) => handleCardClick(company, event)}
                data-testid={`card-company-${company.id}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">{company.companyName}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        {company.industry && (
                          <Badge variant="secondary" className="text-xs">
                            {company.industry}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex space-x-1 ml-2">
                      <Link href={`/target-companies/${company.id}`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="View Details"
                          data-testid={`button-view-${company.id}`}
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
                  <div className="space-y-3 text-sm">
                    {/* Key Metrics Row */}
                    <div className="grid grid-cols-2 gap-2">
                      {company.annualRevenue && (
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3 text-green-600" />
                          <span className="text-xs text-textSecondary">Revenue:</span>
                          <span className="font-medium text-xs">{formatCurrency(company.annualRevenue)}</span>
                        </div>
                      )}
                      {company.employeeCount && (
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3 text-blue-600" />
                          <span className="text-xs text-textSecondary">Employees:</span>
                          <span className="font-medium text-xs">{company.employeeCount}</span>
                        </div>
                      )}
                    </div>

                    {/* Secondary Metrics */}
                    <div className="grid grid-cols-2 gap-2">
                      {company.yearEstablished && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-purple-600" />
                          <span className="text-xs text-textSecondary">Founded:</span>
                          <span className="font-medium text-xs">{company.yearEstablished}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3 text-gray-600" />
                        <span className="text-xs text-textSecondary">Contacts:</span>
                        <span className="font-medium text-xs">
                          {company.contactCount}
                          {company.primaryContactName && (
                            <span className="text-gray-500"> • {company.primaryContactName}</span>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Website Link */}
                    {company.website && (
                      <div className="pt-2">
                        <a
                          href={company.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline text-sm font-medium"
                          data-testid={`link-website-${company.id}`}
                        >
                          Visit Website →
                        </a>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

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
              {/* Basic Information */}
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
                          <Input placeholder="Acme Corporation" {...field} data-testid="input-company-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="sector"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sector *</FormLabel>
                        <Select 
                          onValueChange={(value) => {
                            field.onChange(value);
                            form.setValue("subSector", "");
                          }} 
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-sector">
                              <SelectValue placeholder="Select sector" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {sectors.map((sector) => (
                              <SelectItem key={sector} value={sector}>
                                {sector}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="subSector"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sub-sector *</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value}
                        disabled={!selectedSector || selectedSector === "Other"}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-sub-sector">
                            <SelectValue placeholder={selectedSector === "Other" ? "No sub-sectors for Other" : "Select sub-sector"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {availableSubSectors.map((subSector) => (
                            <SelectItem key={subSector} value={subSector}>
                              {subSector}
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
                    control={form.control}
                    name="website"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Website</FormLabel>
                        <FormControl>
                          <Input placeholder="example.com" {...field} data-testid="input-website" />
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
                          <Input placeholder="contact@example.com" {...field} data-testid="input-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Financial & Operational Details */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-textPrimary">Financial & Operational Details</h3>
                
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="annualRevenue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Annual Revenue (£)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="1000000" {...field} data-testid="input-annual-revenue" />
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
                        <FormLabel>Employee Count</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="50" {...field} data-testid="input-employee-count" />
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
                        <FormLabel>Year Established</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="2010" {...field} data-testid="input-year-established" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Contact & Location */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-textPrimary">Contact & Location</h3>
                
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="+1 (555) 123-4567" {...field} data-testid="input-phone" />
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
                        <Textarea 
                          placeholder="123 Business St, City, State, ZIP" 
                          {...field} 
                          data-testid="textarea-address"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Brief description of the company's business model, key strengths, and acquisition potential..." 
                          {...field} 
                          data-testid="textarea-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Form Actions */}
              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-submit-form"
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