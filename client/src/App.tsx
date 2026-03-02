import { lazy, Suspense } from "react";
import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import ErrorBoundary from "@/components/error-boundary";
import { ThemeProvider } from "@/components/theme-provider";
import { SubscriptionProvider } from "@/context/subscription-context";
import Layout from "@/components/layout";
import AdminRoute from "@/components/admin-route";
import AdminLayout from "@/components/admin-layout";
import NotFound from "@/pages/not-found";
import Login from "@/pages/auth/login";
import AcceptInvitation from "@/pages/accept-invitation";

const Register = lazy(() => import("@/pages/auth/register"));
const ForgotPassword = lazy(() => import("@/pages/auth/forgot-password"));
const ResetPassword = lazy(() => import("@/pages/auth/reset-password"));
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
const EmailTest = lazy(() => import("@/pages/EmailTest"));
const WebhookTest = lazy(() => import("@/pages/webhook-test"));
const FileUploadTest = lazy(() => import("@/pages/file-upload-test"));
const AdminOverview = lazy(() => import("@/pages/admin/index"));
const AdminTokenUsage = lazy(() => import("@/pages/admin/token-usage"));
const AdminCosts = lazy(() => import("@/pages/admin/costs"));
const AdminCompanies = lazy(() => import("@/pages/admin/companies"));
const AdminCompanyDetail = lazy(() => import("@/pages/admin/companies/[id]"));
const AdminUsers = lazy(() => import("@/pages/admin/users"));
const AdminWebhookEvents = lazy(() => import("@/pages/admin/webhook-events"));
const AdminSubscriptions = lazy(() => import("@/pages/admin/subscriptions"));

const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
      <p className="mt-2 text-sm text-muted-foreground">Loading...</p>
    </div>
  </div>
);

function Router() {
  const { isAuthenticated, isLoading, isSystemAdmin } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return (
      <Suspense fallback={<LoadingSpinner />}>
        <Switch>
          <Route path="/portal/:token" component={PortalPage} />
          <Route path="/invite/:token" component={AcceptInvitation} />
          <Route path="/" component={Login} />
          <Route path="/login" component={Login} />
          <Route path="/register" component={Register} />
          <Route path="/forgot-password" component={ForgotPassword} />
          <Route path="/reset-password" component={ResetPassword} />
          <Route path="/accept-invitation" component={AcceptInvitation} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Switch>
        <Route path="/portal/:token" component={PortalPage} />
        <Route path="/invite/:token" component={AcceptInvitation} />

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
                  <Route path="/admin/webhook-events" component={AdminWebhookEvents} />
                  <Route path="/admin/subscriptions" component={AdminSubscriptions} />
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
              <Route path="/company-accounts" component={CompanyAccounts} />
              <Route path="/billing" component={Billing} />
              <Route component={NotFound} />
            </Switch>
          </Layout>
        </Route>
      </Switch>
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
