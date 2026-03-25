import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { PageHeader } from "@/components/layout/PageHeader";
import { ReportIssueButton } from "@/components/layout/ReportIssueButton";
import { useAuth } from "@/hooks/useAuth";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user } = useAuth();
  const isViewingAs = !!user?.viewingAs;

  const handleExitViewAs = async () => {
    try {
      await apiRequest('POST', '/api/v2/admin/view-as/exit');
      queryClient.clear();
      window.location.href = '/admin/users';
    } catch {
      window.location.href = '/admin/users';
    }
  };

  return (
    <SidebarProvider>
      {isViewingAs && (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 text-white text-sm font-medium px-4 py-2 flex items-center justify-between shadow-md">
          <span>
            Viewing as {user?.firstName} {user?.lastName}
            {user?.company?.companyName ? ` — ${user.company.companyName}` : ''} — read-only mode
          </span>
          <button
            onClick={handleExitViewAs}
            className="underline hover:no-underline ml-4 font-semibold"
          >
            Exit view
          </button>
        </div>
      )}
      <AppSidebar />
      <SidebarInset className={isViewingAs ? 'mt-10' : ''}>
        <PageHeader />
        <main className="flex-1 min-w-0 overflow-auto bg-muted">
          {children}
        </main>
      </SidebarInset>
      <ReportIssueButton />
    </SidebarProvider>
  );
}
