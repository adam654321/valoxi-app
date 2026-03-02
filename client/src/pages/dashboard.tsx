import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { 
  RefreshCw, 
  TrendingUp, 
  Users, 
  Building2, 
  Activity,
} from "lucide-react";
import {
  PipelineOverviewWidget,
  RecentActivitiesWidget,
  HotDealsWidget,
  QuickStatsWidget,
  UpcomingRemindersWidget,
  TeamActivityWidget,
  StageAlertsWidget,
} from "@/components/dashboard";
import ActivationChecklist from "@/components/onboarding/ActivationChecklist";

interface DashboardStats {
  targetCompanies: number;
  activeDeals: number;
  totalContacts: number;
  dealValue: string;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/v2/dashboard/stats"],
    select: (response: any) => response.data,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/v2/dashboard/data"] });
      setLastRefresh(new Date());
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const refreshDashboard = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/v2/dashboard"] });
    setLastRefresh(new Date());
    toast({
      title: "Dashboard Refreshed",
      description: "All widgets have been updated with the latest data.",
    });
  };

  if (!user) {
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      {/* Dashboard Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              M&A Dashboard
            </h1>
            <p className="mt-1 text-muted-foreground">
              Welcome back, {user.firstName} • {user.company?.companyName}
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            <Button onClick={refreshDashboard} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <div className="text-sm text-muted-foreground">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </div>
          </div>
        </div>
      </div>

      {!user.onboardingCompleted && <ActivationChecklist />}

      {/* Key Metrics Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
                  <div className="h-8 bg-muted rounded w-1/3 mb-4"></div>
                  <div className="h-3 bg-muted rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Target Companies</p>
                  <p className="text-2xl font-bold text-foreground">{stats?.targetCompanies || 0}</p>
                </div>
                <div className="h-12 w-12 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <div className="mt-4">
                <span className="text-blue-600 text-sm font-medium">Ready to track acquisition targets</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Deals</p>
                  <p className="text-2xl font-bold text-foreground">{stats?.activeDeals || 0}</p>
                </div>
                <div className="h-12 w-12 bg-green-50 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
              </div>
              <div className="mt-4">
                <span className="text-green-600 text-sm font-medium">Pipeline ready</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Contacts</p>
                  <p className="text-2xl font-bold text-foreground">{stats?.totalContacts || 0}</p>
                </div>
                <div className="h-12 w-12 bg-purple-50 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-purple-600" />
                </div>
              </div>
              <div className="mt-4">
                <span className="text-purple-600 text-sm font-medium">Network expanding</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Deal Value</p>
                  <p className="text-2xl font-bold text-foreground">{stats?.dealValue || '$0'}</p>
                </div>
                <div className="h-12 w-12 bg-yellow-50 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
              <div className="mt-4">
                <span className="text-yellow-600 text-sm font-medium">Value tracking ready</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Enhanced Widget Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <PipelineOverviewWidget />
        <UpcomingRemindersWidget />
        <TeamActivityWidget />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <RecentActivitiesWidget />
        <QuickStatsWidget />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <HotDealsWidget />
        <StageAlertsWidget />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <div className="h-12 w-12 bg-blue-50 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Add Target Company</h3>
              <p className="text-muted-foreground mb-4">Create a new acquisition target to track</p>
              <Link href="/target-companies/new">
                <Button className="w-full">
                  Add Company
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <div className="h-12 w-12 bg-green-50 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Activity className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">View Pipeline</h3>
              <p className="text-muted-foreground mb-4">Manage your acquisition pipeline</p>
              <Link href="/pipeline">
                <Button variant="outline" className="w-full">
                  View Pipeline
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <div className="h-12 w-12 bg-purple-50 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Team Management</h3>
              <p className="text-muted-foreground mb-4">Manage team members and roles</p>
              <Link href="/team">
                <Button variant="outline" className="w-full">
                  Manage Team
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
