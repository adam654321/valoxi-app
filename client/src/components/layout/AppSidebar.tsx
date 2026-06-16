import { useLocation, Link } from "wouter";
import {
  LayoutDashboard,
  Kanban,
  Building2,
  Users,
  UserCircle,
  FileText,
  Globe,
  ChevronRight,
  Shield,
  CreditCard,
  Settings2,
  Clock,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { NavUser } from "./NavUser";
import { useSubscriptionContext } from "@/context/subscription-context";

const navGroups = [
  {
    label: "Core",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
      { title: "Pipeline", url: "/pipeline", icon: Kanban },
      { title: "Target Companies", url: "/target-companies", icon: Building2 },
    ],
  },
  {
    label: "Relationships",
    items: [
      { title: "Contacts", url: "/contacts", icon: UserCircle },
      { title: "Team", url: "/team", icon: Users },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { title: "Reports", url: "/reports", icon: FileText },
      { title: "Portals", url: "/portal-management", icon: Globe },
    ],
  },
  {
    label: "Account",
    items: [
      { title: "Account", url: "/account", icon: Settings2 },
      { title: "Billing & Plan", url: "/billing", icon: CreditCard },
    ],
  },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [location] = useLocation();
  const { isSystemAdmin } = useAuth();
  const { subscription } = useSubscriptionContext();

  const isTrialing = subscription?.status === 'trialing';
  const trialEnd = subscription?.trialEnd ? new Date(subscription.trialEnd) : null;
  const hoursRemaining = trialEnd ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / (1000 * 60 * 60))) : null;
  const daysRemaining = hoursRemaining !== null ? Math.ceil(hoursRemaining / 24) : null;

  const trialLabel = hoursRemaining !== null && hoursRemaining < 24
    ? `${hoursRemaining} hours remaining`
    : `${daysRemaining} days remaining`;

  const isActiveRoute = (path: string) => {
    if (path === "/dashboard" && location === "/") return true;
    if (path === "/target-companies" && (location === "/target-companies" || location.startsWith("/target-companies/"))) return true;
    if (path === "/pipeline" && location === "/pipeline") return true;
    if (path === "/team" && location === "/team") return true;
    if (path === "/reports" && location === "/reports") return true;
    if (path === "/contacts" && location === "/contacts") return true;
    if (path === "/portal-management" && location === "/portal-management") return true;
    if (path === "/billing" && location === "/billing") return true;
    if (path === "/account" && location === "/account") return true;
    return location === path;
  };

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
                <svg
                  className="size-8 shrink-0"
                  viewBox="0 0 30 30"
                  fill="none"
                  aria-hidden="true"
                >
                  <path d="M3 5L15 26L27 5H21.5L15 17L8.5 5H3Z" fill="#E05115" />
                </svg>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Valoxi</span>
                  <span className="truncate text-xs text-muted-foreground">Enterprise</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {isTrialing && (
          <SidebarGroup>
            <div className="hidden group-data-[collapsible=icon]:flex justify-center px-1">
              <SidebarMenuButton tooltip={`Free trial — ${trialLabel}`} className="text-orange-400 hover:text-orange-300">
                <Clock className="text-orange-400" />
              </SidebarMenuButton>
            </div>
            <div className="group-data-[collapsible=icon]:hidden border-l-2 border-orange-400 bg-orange-500/10 p-3 mx-2 rounded-md mb-2">
              <div className="flex items-center gap-1.5 mb-1">
                <Clock className="size-3 text-orange-400 shrink-0" />
                <span className="text-xs font-bold text-orange-400">Free Trial</span>
              </div>
              <p className="text-xs text-muted-foreground mb-2">{trialLabel}</p>
              <Link href="/billing" className="text-xs text-orange-400 hover:text-orange-300 font-medium">
                Upgrade
              </Link>
            </div>
          </SidebarGroup>
        )}
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActiveRoute(item.url)}
                      tooltip={item.title}
                    >
                      <Link href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      {isSystemAdmin && (
        <SidebarGroup>
          <SidebarGroupLabel>System</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location.startsWith("/admin")} tooltip="Admin">
                  <Link href="/admin">
                    <Shield />
                    <span>Admin</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      )}
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
