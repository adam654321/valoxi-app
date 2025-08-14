import { useAuth } from "@/hooks/useAuth";
import { useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Settings, User, Users, Bell } from "lucide-react";
import { Notifications } from "@/components/notifications";
import { AddTargetCompanyButton } from "@/components/AddTargetCompanyButton";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [location] = useLocation();

  const logoutMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/auth/logout"),
    onSuccess: () => {
      window.location.href = "/login";
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to logout. Please try again.",
        variant: "destructive",
      });
    },
  });

  const isActiveRoute = (path: string) => {
    if (path === "/dashboard" && location === "/") return true;
    if (path === "/target-companies" && (location === "/target-companies" || location.startsWith("/target-companies/"))) return true;
    if (path === "/pipeline" && location === "/pipeline") return true;
    if (path === "/team" && location === "/team") return true;
    if (path === "/reports" && location === "/reports") return true;
    if (path === "/notifications" && location === "/notifications") return true;
    if (path === "/portal-management" && location === "/portal-management") return true;
    if (path === "/email-test" && location === "/email-test") return true;
    return location === path;
  };

  const getNavLinkClass = (path: string) => {
    const baseClass = "px-1 pt-1 pb-4 text-sm font-medium transition-colors border-b-2";
    if (isActiveRoute(path)) {
      return `${baseClass} text-primary border-primary`;
    }
    return `${baseClass} text-textSecondary hover:text-textPrimary border-transparent hover:border-gray-300`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Header */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <span className="ml-3 text-xl font-semibold text-textPrimary">M&A Pipeline</span>
              </div>
              <div className="hidden md:ml-10 md:flex md:space-x-8">
                <Link href="/dashboard" className={getNavLinkClass("/dashboard")}>
                  Dashboard
                </Link>
                <Link href="/target-companies" className={getNavLinkClass("/target-companies")}>
                  Target Companies
                </Link>
                <Link href="/contacts" className={getNavLinkClass("/contacts")}>
                  Contacts
                </Link>
                <Link href="/pipeline" className={getNavLinkClass("/pipeline")}>
                  Pipeline
                </Link>
                <Link href="/reports" className={getNavLinkClass("/reports")}>
                  Reports
                </Link>
                <Link href="/team" className={getNavLinkClass("/team")}>
                  Team
                </Link>
                <Link href="/portal-management" className={getNavLinkClass("/portal-management")}>
                  Portals
                </Link>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Notifications />
              <AddTargetCompanyButton />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="relative h-8 w-8 rounded-full"
                    data-testid="button-profile-menu"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage 
                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user?.firstName + ' ' + user?.lastName)}&background=3b82f6&color=fff`}
                        alt={`${user?.firstName} ${user?.lastName}`}
                      />
                      <AvatarFallback>
                        {user?.firstName?.[0]}{user?.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {user?.firstName} {user?.lastName}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user?.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem data-testid="menu-item-profile">
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem data-testid="menu-item-settings">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => logoutMutation.mutate()}
                    disabled={logoutMutation.isPending}
                    data-testid="menu-item-logout"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>{logoutMutation.isPending ? "Logging out..." : "Log out"}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </nav>

      {/* Page Content */}
      <main>
        {children}
      </main>
    </div>
  );
}