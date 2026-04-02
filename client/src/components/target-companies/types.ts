export interface SearchFilters {
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

export interface TargetCompanyWithStats {
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
  isArchived: boolean;
  archivedAt: string | null;
  createdBy: number | null;
  createdAt: string;
  contactCount: number;
  primaryContactName: string | null;
}

export interface FilterOptions {
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
