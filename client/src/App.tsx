import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Layout from "@/components/layout";
import NotFound from "@/pages/not-found";
import Login from "@/pages/auth/login";
import Register from "@/pages/auth/register";
import Dashboard from "@/pages/dashboard";
import EnhancedTargetCompanies from "@/pages/enhanced-target-companies";
import TargetCompanyDetail from "@/pages/target-company-detail";
import Contacts from "@/pages/contacts";
import TeamManagement from "@/pages/team-management";
import AcceptInvitation from "@/pages/accept-invitation";
import { NotificationsPage } from "@/components/notifications";

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

  return (
    <Switch>
      {!isAuthenticated ? (
        <>
          <Route path="/" component={Login} />
          <Route path="/login" component={Login} />
          <Route path="/register" component={Register} />
          <Route path="/accept-invitation" component={AcceptInvitation} />
        </>
      ) : (
        <Layout>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/target-companies" component={EnhancedTargetCompanies} />
            <Route path="/target-companies/:id" component={TargetCompanyDetail} />
            <Route path="/contacts" component={Contacts} />
            <Route path="/team" component={TeamManagement} />
            <Route path="/notifications" component={NotificationsPage} />
            <Route component={NotFound} />
          </Switch>
        </Layout>
      )}
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
