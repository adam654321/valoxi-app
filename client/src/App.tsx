import { lazy, Suspense } from "react";
import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useServerConfig } from "@/hooks/useServerConfig";
import ErrorBoundary from "@/components/error-boundary";
import { ThemeProvider } from "@/components/theme-provider";
import { SubscriptionProvider } from "@/context/subscription-context";
import Layout from "@/components/layout";
import AdminRoute from "@/components/admin-route";
import AdminLayout from "@/components/admin-layout";
import { BetaFeedbackWidget } from "@/components/BetaFeedbackWidget";
import NotFound from "@/pages/not-found";
import AcceptInvitation from "@/pages/accept-invitation";
import MarketingConsentPage from "@/pages/marketing-consent";

const SignInPage = lazy(() => import("@/pages/auth/sign-in"));
const SignUpPage = lazy(() => import("@/pages/auth/sign-up"));
const AccountSetupPending = lazy(() => import("@/pages/auth/account-setup-pending"));
const AccountInactive = lazy(() => import("@/pages/auth/account-inactive"));
const OnboardingPage = lazy(() => import("@/pages/onboarding"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const EnhancedTargetCompanies = lazy(() => import("@/pages/enhanced-target-companies"));
const TargetCompanyDetail = lazy(() => import("@/pages/target-company-detail"));
const Contacts = lazy(() => import("@/pages/contacts"));
const TeamManagement = lazy(() => import("@/pages/team-management"));
const Pipeline = lazy(() => import("@/pages/pipeline"));
const Reports = lazy(() => import("@/pages/reports"));
const NotificationsPage = lazy(() => import("@/components/notifications").then(m => ({ default: m.NotificationsPage })));
const PortalPage = lazy(() => import("@/pages/PortalPage"));
const PortalManagement = lazy(() => import("@/pages/PortalManagement"));
const CompanyAccounts = lazy(() => import("@/pages/company-accounts"));
const Billing = lazy(() => import("@/pages/billing"));
const AccountPage = lazy(() => import("@/pages/account"));
const HelpHome = lazy(() => import("@/pages/help/HelpHome"));
const HelpArticle = lazy(() => import("@/pages/help/HelpArticle"));
const HelpSearch = lazy(() => import("@/pages/help/HelpSearch"));
const EmailTest = lazy(() => import("@/pages/EmailTest"));
const WebhookTest = lazy(() => import("@/pages/webhook-test"));
const FileUploadTest = lazy(() => import("@/pages/file-upload-test"));
const AdminOverview = lazy(() => import("@/pages/admin/index"));
const AdminTokenUsage = lazy(() => import("@/pages/admin/token-usage"));
const AdminCosts = lazy(() => import("@/pages/admin/costs"));
const AdminCompanies = lazy(() => import("@/pages/admin/companies"));
const AdminCompanyDetail = lazy(() => import("@/pages/admin/companies/[id]"));
const AdminUsers = lazy(() => import("@/pages/admin/users"));
const AdminWaitlist = lazy(() => import("@/pages/admin/waitlist"));
const AdminWebhookEvents = lazy(() => import("@/pages/admin/webhook-events"));
const AdminSubscriptions = lazy(() => import("@/pages/admin/subscriptions"));
const AdminFunnel = lazy(() => import("@/pages/admin/funnel"));
const AdminPromoCampaigns = lazy(() => import("@/pages/admin/promo-campaigns"));
const AdminReferralInvoice = lazy(() => import("@/pages/admin/referral-invoice"));
const AdminSettings = lazy(() => import("@/pages/admin/settings"));
const AdminFeedback = lazy(() => import("@/pages/admin/feedback"));
const AdminDatabase = lazy(() => import("@/pages/admin/database"));
const AdminBroadcasts = lazy(() => import("@/pages/admin/broadcasts"));

const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
      <p className="mt-2 text-sm text-muted-foreground">Loading...</p>
    </div>
  </div>
);

function Router() {
  const { isAuthenticated, isLoading: authLoading, isSystemAdmin, user, authError } = useAuth();
  const { clerkEnabled, isLoading: configLoading } = useServerConfig();

  if (authLoading || configLoading) {
    return <LoadingSpinner />;
  }

  if (authError === "CLERK_USER_NOT_LINKED") {
    return (
      <Suspense fallback={<LoadingSpinner />}>
        <AccountSetupPending />
      </Suspense>
    );
  }

  if (authError === "CLERK_USER_INACTIVE") {
    return (
      <Suspense fallback={<LoadingSpinner />}>
        <AccountInactive />
      </Suspense>
    );
  }

  if (!isAuthenticated) {
    return (
      <Suspense fallback={<LoadingSpinner />}>
        <Switch>
          <Route path="/portal/:token" component={PortalPage} />
          <Route path="/invite/:token" component={AcceptInvitation} />
          {clerkEnabled && <Route path="/sign-in" component={SignInPage} />}
          {clerkEnabled && <Route path="/sign-up" component={SignUpPage} />}
          <Route path="/">{() => <Redirect to="/sign-in" />}</Route>
          <Route path="/accept-invitation" component={AcceptInvitation} />
          <Route path="/marketing-consent/:token" component={MarketingConsentPage} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    );
  }

  // Onboarding gate — redirect users who haven't completed onboarding.
  // Skip when admin is in view-as mode: they should land on the normal app,
  // and the amber exit banner must remain accessible.
  if (user && user.onboardingCompleted === false && !user.viewingAs) {
    return (
      <Suspense fallback={<LoadingSpinner />}>
        <Switch>
          <Route path="/onboarding" component={OnboardingPage} />
          <Route>{() => <Redirect to="/onboarding" />}</Route>
        </Switch>
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Switch>
        <Route path="/portal/:token" component={PortalPage} />
        <Route path="/invite/:token" component={AcceptInvitation} />
        <Route path="/marketing-consent/:token" component={MarketingConsentPage} />

        <Route path="/admin/companies/:id">
          {() => (
            <AdminRoute>
              <AdminLayout>
                <AdminCompanyDetail />
              </AdminLayout>
            </AdminRoute>
          )}
        </Route>

        <Route path="/admin/:rest*">
          {() => (
            <AdminRoute>
              <AdminLayout>
                <Switch>
                  <Route path="/admin" component={AdminOverview} />
                  <Route path="/admin/token-usage" component={AdminTokenUsage} />
                  <Route path="/admin/costs" component={AdminCosts} />
                  <Route path="/admin/companies/:id" component={AdminCompanyDetail} />
                  <Route path="/admin/companies" component={AdminCompanies} />
                  <Route path="/admin/users" component={AdminUsers} />
                  <Route path="/admin/waitlist" component={AdminWaitlist} />
                  <Route path="/admin/webhook-events" component={AdminWebhookEvents} />
                  <Route path="/admin/subscriptions" component={AdminSubscriptions} />
                  <Route path="/admin/funnel" component={AdminFunnel} />
                  <Route path="/admin/referral-invoice" component={AdminReferralInvoice} />
                  <Route path="/admin/promo-campaigns" component={AdminPromoCampaigns} />
                  <Route path="/admin/settings" component={AdminSettings} />
                  <Route path="/admin/feedback" component={AdminFeedback} />
                  <Route path="/admin/database" component={AdminDatabase} />
                  <Route path="/admin/broadcasts" component={AdminBroadcasts} />
                  <Route component={NotFound} />
                </Switch>
              </AdminLayout>
            </AdminRoute>
          )}
        </Route>
        <Route path="/admin">
          {() => (
            <AdminRoute>
              <AdminLayout>
                <AdminOverview />
              </AdminLayout>
            </AdminRoute>
          )}
        </Route>

        <Route path="/onboarding" component={OnboardingPage} />
        <Route path="/login">{() => <Redirect to="/" />}</Route>
        <Route path="/register">{() => <Redirect to="/" />}</Route>

        <Route>
          <Layout>
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/dashboard" component={Dashboard} />
              <Route path="/pipeline" component={Pipeline} />
              <Route path="/target-companies" component={EnhancedTargetCompanies} />
              <Route path="/target-companies/:id" component={TargetCompanyDetail} />
              <Route path="/contacts" component={Contacts} />
              <Route path="/team" component={TeamManagement} />
              <Route path="/reports" component={Reports} />
              <Route path="/notifications" component={NotificationsPage} />
              <Route path="/portal-management" component={PortalManagement} />
              <Route path="/email-test">
                {isSystemAdmin ? <EmailTest /> : <Redirect to="/" />}
              </Route>
              <Route path="/webhook-test">
                {isSystemAdmin ? <WebhookTest /> : <Redirect to="/" />}
              </Route>
              <Route path="/file-upload-test">
                {isSystemAdmin ? <FileUploadTest /> : <Redirect to="/" />}
              </Route>
              {/* <Route path="/company-accounts" component={CompanyAccounts} /> */}
              <Route path="/billing" component={Billing} />
              <Route path="/help" component={HelpHome} />
              <Route path="/help/search" component={HelpSearch} />
              <Route path="/help/article/:slug" component={HelpArticle} />
              <Route path="/account" component={AccountPage} />
              <Route component={NotFound} />
            </Switch>
          </Layout>
        </Route>
      </Switch>
      <BetaFeedbackWidget />
    </Suspense>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <SubscriptionProvider>
          <TooltipProvider>
            <Toaster />
            <ErrorBoundary>
              <Router />
            </ErrorBoundary>
          </TooltipProvider>
        </SubscriptionProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
