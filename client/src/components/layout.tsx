import { useEffect } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { PageHeader } from "@/components/layout/PageHeader";
import { ReportIssueButton } from "@/components/layout/ReportIssueButton";
import { useAuth } from "@/hooks/useAuth";
import { useSubscriptionContext } from "@/context/subscription-context";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CreditCard } from "lucide-react";

interface LayoutProps {
  children: React.ReactNode;
}

function getTrialDaysRemaining(trialEnd: string | Date | null | undefined): number | null {
  if (!trialEnd) return null;
  const end = new Date(trialEnd);
  const now = new Date();
  const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

function ExpiredWall() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-muted px-4">
      <div className="max-w-md w-full bg-background rounded-xl border shadow-sm p-8 text-center space-y-6">
        <div className="flex justify-center">
          <div className="h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-foreground">Your trial has ended</h1>
          <p className="text-sm text-muted-foreground">
            Choose a plan to restore access to your deals and data. Nothing has been deleted.
          </p>
        </div>
        <Link href="/billing">
          <Button className="w-full gap-2">
            <CreditCard className="h-4 w-4" />
            View plans and upgrade
          </Button>
        </Link>
        <p className="text-xs text-muted-foreground">
          Need help? Email <a href="mailto:support@valoxi.ai" className="underline">support@valoxi.ai</a>
        </p>
      </div>
    </div>
  );
}

export default function Layout({ children }: LayoutProps) {
  const { user } = useAuth();
  const { subscription, isLoading } = useSubscriptionContext();
  const [location] = useLocation();
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

  const status = subscription?.status ?? null;
  const trialDays = status === 'trialing'
    ? getTrialDaysRemaining(subscription?.trialEndsAt ?? (subscription as any)?.trialEnd)
    : null;

  const showTrialBanner = !isLoading && status === 'trialing' && trialDays !== null;
  const isExpired = !isLoading && (!subscription || status === 'canceled');
  const onBillingPage = location === '/billing';
  const trialUrgent = trialDays !== null && trialDays <= 3;
  const trialWarning = trialDays !== null && trialDays <= 7 && trialDays > 3;

  // If expired and not on billing page, show the wall instead of the app
  if (isExpired && !onBillingPage) {
    return <ExpiredWall />;
  }

  const bannerCount = [isViewingAs, showTrialBanner].filter(Boolean).length;

  return (
    <SidebarProvider>
      {isViewingAs && (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 text-white text-sm font-medium px-4 py-2 flex items-center justify-between shadow-md">
          <span>
            Viewing as {user?.viewingAs?.name}
            {user?.viewingAs?.companyName ? ` — ${user.viewingAs.companyName}` : ''} — read-only mode
          </span>
          <button
            onClick={handleExitViewAs}
            className="underline hover:no-underline ml-4 font-semibold"
          >
            Exit view
          </button>
        </div>
      )}

      {showTrialBanner && (
        <div
          className={`fixed left-0 right-0 z-[9998] text-sm font-medium px-4 py-2 flex items-center justify-between shadow-md ${
            trialUrgent
              ? 'bg-destructive text-destructive-foreground'
              : trialWarning
              ? 'bg-amber-500 text-white'
              : 'bg-muted text-muted-foreground border-b'
          }`}
          style={{ top: isViewingAs ? '40px' : '0px' }}
        >
          <span>
            {trialDays === 0
              ? 'Your trial expires today.'
              : `${trialDays} day${trialDays !== 1 ? 's' : ''} remaining in your trial.`}
          </span>
          <Link href="/billing" className="underline hover:no-underline ml-4 font-semibold">
            Upgrade
          </Link>
        </div>
      )}

      <AppSidebar />
      <SidebarInset className={bannerCount > 0 ? 'mt-10' : ''}>
        <PageHeader />
        <main className="flex-1 min-w-0 overflow-auto bg-muted">
          {children}
        </main>
      </SidebarInset>
      <ReportIssueButton />
    </SidebarProvider>
  );
}
