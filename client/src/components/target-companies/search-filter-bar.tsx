import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { sectors } from "./constants";
import type { SearchFilters } from "./types";

interface SearchFilterBarProps {
  filters: SearchFilters;
  setFilters: React.Dispatch<React.SetStateAction<SearchFilters>>;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
  activeFiltersCount: number;
  resetFilters: () => void;
  resultCount: number;
}

const SearchFilterBar: React.FC<SearchFilterBarProps> = ({
  filters,
  setFilters,
  searchTerm,
  setSearchTerm,
  showFilters,
  setShowFilters,
  activeFiltersCount,
  resetFilters,
  resultCount,
}) => {
  return (
    <Card className="mb-6">
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/70" />
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

          {showFilters && (
            <>
              <Separator />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

              <div className="flex justify-between items-center pt-4">
                <div className="text-sm text-textSecondary" data-testid="text-results-count">
                  Showing {resultCount} companies
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
  );
};

export default SearchFilterBar;
