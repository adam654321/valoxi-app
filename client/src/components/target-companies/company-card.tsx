import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link, useLocation } from "wouter";
import { Pencil, Trash2, Eye, Users, DollarSign, Calendar } from "lucide-react";
import { formatCurrency } from "./utils";
import type { TargetCompanyWithStats } from "./types";

interface CompanyCardProps {
  company: TargetCompanyWithStats;
  onEdit: (company: TargetCompanyWithStats) => void;
  onDelete: (company: TargetCompanyWithStats) => void;
  isDeletePending: boolean;
}

const CompanyCard: React.FC<CompanyCardProps> = ({
  company,
  onEdit,
  onDelete,
  isDeletePending,
}) => {
  const [, setLocation] = useLocation();

  const handleCardClick = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement;
    if (target.closest('button') || target.closest('a')) {
      return;
    }
    setLocation(`/target-companies/${company.id}`);
  };

  return (
    <Card
      className="hover:shadow-lg transition-shadow cursor-pointer"
      onClick={handleCardClick}
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
              onClick={() => onEdit(company)}
              title="Edit Company"
              data-testid={`button-edit-${company.id}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(company)}
              disabled={isDeletePending}
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

          <div className="grid grid-cols-2 gap-2">
            {company.yearEstablished && (
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3 text-purple-600" />
                <span className="text-xs text-textSecondary">Founded:</span>
                <span className="font-medium text-xs">{company.yearEstablished}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-textSecondary">Contacts:</span>
              <span className="font-medium text-xs">
                {company.contactCount}
                {company.primaryContactName && (
                  <span className="text-muted-foreground"> • {company.primaryContactName}</span>
                )}
              </span>
            </div>
          </div>

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
  );
};

export default CompanyCard;
