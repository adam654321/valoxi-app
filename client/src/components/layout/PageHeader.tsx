import { Link, useLocation } from "wouter";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { ThemeToggle } from "@/components/theme-toggle";

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
  "/help": "Help",
  "/help/search": "Help",
};

export function PageHeader() {
  const [location] = useLocation();

  const getCurrentPageLabel = () => {
    if (location.startsWith("/target-companies/")) {
      return "Company Details";
    }
    if (location.startsWith("/help/article/")) {
      return "Help";
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
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
          <Link href="/help">
            <HelpCircle className="h-4 w-4" />
            <span className="sr-only">Help Center</span>
          </Link>
        </Button>
        <ThemeToggle />
        <Notifications />
      </div>
    </header>
  );
}
