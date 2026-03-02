import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { PageHeader } from "@/components/layout/PageHeader";
import { ReportIssueButton } from "@/components/layout/ReportIssueButton";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <PageHeader />
        <main className="flex-1 min-w-0 overflow-auto bg-muted">
          {children}
        </main>
      </SidebarInset>
      <ReportIssueButton />
    </SidebarProvider>
  );
}
