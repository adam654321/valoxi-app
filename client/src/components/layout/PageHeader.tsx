import { useLocation } from "wouter";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Notifications } from "@/components/notifications";
import { AddTargetCompanyButton } from "@/components/AddTargetCompanyButton";

const routeLabels: Record<string, string> = {
  "/": "Dashboard",
  "/dashboard": "Dashboard",
  "/pipeline": "Pipeline",
  "/target-companies": "Target Companies",
  "/contacts": "Contacts",
  "/team": "Team",
  "/reports": "Reports",
  "/portal-management": "Portals",
  "/company-accounts": "Company Accounts",
  "/file-upload-test": "File Upload Test",
};

export function PageHeader() {
  const [location] = useLocation();

  const getCurrentPageLabel = () => {
    if (location.startsWith("/target-companies/")) {
      return "Company Details";
    }
    return routeLabels[location] || "Page";
  };

  const getBreadcrumbs = () => {
    const breadcrumbs = [];
    
    if (location.startsWith("/target-companies/")) {
      breadcrumbs.push({ label: "Target Companies", href: "/target-companies" });
      breadcrumbs.push({ label: "Company Details", href: null });
    } else {
      breadcrumbs.push({ label: getCurrentPageLabel(), href: null });
    }
    
    return breadcrumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          {breadcrumbs.map((crumb, index) => (
            <span key={index} className="contents">
              {index > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
              </BreadcrumbItem>
            </span>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
      <div className="ml-auto flex items-center gap-2">
        <Notifications />
        <AddTargetCompanyButton />
      </div>
    </header>
  );
}
