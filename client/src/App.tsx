import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Layout from "@/components/layout";
import AdminRoute from "@/components/admin-route";
import AdminLayout from "@/components/admin-layout";
import NotFound from "@/pages/not-found";
import Login from "@/pages/auth/login";
import Register from "@/pages/auth/register";
import Dashboard from "@/pages/dashboard";
import EnhancedTargetCompanies from "@/pages/enhanced-target-companies";
import TargetCompanyDetail from "@/pages/target-company-detail";
import Contacts from "@/pages/contacts";
import TeamManagement from "@/pages/team-management";
import AcceptInvitation from "@/pages/accept-invitation";
import Pipeline from "@/pages/pipeline";
import Reports from "@/pages/reports";
import { NotificationsPage } from "@/components/notifications";
import PortalPage from "@/pages/PortalPage";
import PortalManagement from "@/pages/PortalManagement";
import EmailTest from "@/pages/EmailTest";
import WebhookTest from "@/pages/webhook-test";
import FileUploadTest from "@/pages/file-upload-test";
import CompanyAccounts from "@/pages/company-accounts";
import AdminOverview from "@/pages/admin/index";
import AdminTokenUsage from "@/pages/admin/token-usage";
import AdminCosts from "@/pages/admin/costs";
import AdminCompanies from "@/pages/admin/companies";
import AdminCompanyDetail from "@/pages/admin/companies/[id]";
import AdminUsers from "@/pages/admin/users";
import AdminWebhookEvents from "@/pages/admin/webhook-events";


function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Switch>
        {/* Public portal route - accessible without authentication */}
        <Route path="/portal/:token" component={PortalPage} />
        
        {/* Public invitation route - accessible without authentication */}
        <Route path="/invite/:token" component={AcceptInvitation} />
        
        <Route path="/" component={Login} />
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/accept-invitation" component={AcceptInvitation} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  return (
    <Switch>
      {/* Public routes accessible even when authenticated */}
      <Route path="/portal/:token" component={PortalPage} />
      <Route path="/invite/:token" component={AcceptInvitation} />
      
      {/* Admin routes */}
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

      {/* Authenticated routes */}
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
            <Route path="/email-test" component={EmailTest} />
            <Route path="/webhook-test" component={WebhookTest} />
            <Route path="/file-upload-test" component={FileUploadTest} />
            <Route path="/company-accounts" component={CompanyAccounts} />
            <Route component={NotFound} />
          </Switch>
        </Layout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
