import { useLocation, Link } from "wouter";
import {
  LayoutDashboard,
  Coins,
  DollarSign,
  Building2,
  Users,
  Webhook,
  CreditCard,
  Flag,
  TrendingUp,
  ArrowLeft,
  Receipt,
  Tag,
  Settings,
  Database,
  ClipboardList,
} from "lucide-react";

const adminNav = [
  { title: "Overview", url: "/admin", icon: LayoutDashboard },
  { title: "Token Usage", url: "/admin/token-usage", icon: Coins },
  { title: "Subscriptions", url: "/admin/subscriptions", icon: CreditCard },
  { title: "Issue Reports", url: "/admin/feedback", icon: Flag },
  { title: "Funnel", url: "/admin/funnel", icon: TrendingUp },
  { title: "Platform Costs", url: "/admin/costs", icon: DollarSign },
  { title: "Companies", url: "/admin/companies", icon: Building2 },
  { title: "Users", url: "/admin/users", icon: Users },
  { title: "Waitlist", url: "/admin/waitlist", icon: ClipboardList },
  { title: "Webhook Events", url: "/admin/webhook-events", icon: Webhook },
  { title: "Promo Codes", url: "/admin/promo-codes", icon: Tag },
  { title: "5D Invoice", url: "/admin/referral-invoice", icon: Receipt },
  { title: "Settings", url: "/admin/settings", icon: Settings },
  { title: "Database", url: "/admin/database", icon: Database },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const isActive = (url: string) => {
    if (url === "/admin") return location === "/admin";
    return location.startsWith(url);
  };

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-amber-500 text-white font-bold text-sm">
              A
            </div>
            <div>
              <div className="font-semibold text-sm">Admin Panel</div>
              <div className="text-xs text-slate-400">System Management</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {adminNav.map((item) => (
            <Link
              key={item.url}
              href={item.url}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive(item.url)
                  ? "bg-slate-700 text-white font-medium"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.title}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-700">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to App
          </Link>
        </div>
      </aside>
      <main className="flex-1 overflow-auto bg-muted">
        {children}
      </main>
    </div>
  );
}
