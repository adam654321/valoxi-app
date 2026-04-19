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
                  <path d="M3 5L15 26L27 5H21.5L15 17L8.5 5H3Z" fill="#F97316" />
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
