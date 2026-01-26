import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { 
  RefreshCw, 
  TrendingUp, 
  Users, 
  Building2, 
  Activity,
  AlertTriangle,
  Eye,
  Phone,
  Mail,
  Users2,
  FileText,
  Calendar,
  Search,
  Target,
  CheckCircle
} from "lucide-react";

// Widget Data Types
interface PipelineOverviewData {
  stages: Array<{
    stage: string;
    count: number;
    avg_days: number;
  }>;
  totalActive: number;
  lastUpdated: Date;
}

interface RecentActivitiesData {
  activities: Array<{
    id: number;
    title: string;
    activityType: string;
    companyName: string;
    userName: string;
    contactName?: string;
    createdAt: string;
  }>;
  lastUpdated: Date;
}

interface HotDealsData {
  deals: Array<{
    id: number;
    companyName: string;
    stage: string;
    daysInStage: number;
    recentActivityCount: number;
  }>;
  lastUpdated: Date;
}

interface QuickStatsData {
  newDeals: number;
  completedDeals: number;
  totalActivities: number;
  avgDealTime: number;
  lastUpdated: Date;
}

interface DashboardStats {
  targetCompanies: number;
  activeDeals: number;
  totalContacts: number;
  dealValue: string;
}

// Activity Type Icons
const getActivityIcon = (type: string) => {
  switch (type) {
    case 'Phone Call': return <Phone className="w-4 h-4" />;
    case 'Email': return <Mail className="w-4 h-4" />;
    case 'Meeting': return <Users2 className="w-4 h-4" />;
    case 'Note': return <FileText className="w-4 h-4" />;
    case 'Follow-up': return <Calendar className="w-4 h-4" />;
    case 'Research': return <Search className="w-4 h-4" />;
    case 'Document': return <FileText className="w-4 h-4" />;
    default: return <Activity className="w-4 h-4" />;
  }
};

// Pipeline Overview Widget
const PipelineOverviewWidget: React.FC = () => {
  const { data, isLoading, refetch } = useQuery<PipelineOverviewData>({
    queryKey: ["/api/v2/dashboard/data/pipeline-overview"],
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
    select: (response: any) => response.data,
  });

  return (
    <Card className="col-span-2">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold">Pipeline Overview</CardTitle>
        <div className="flex space-x-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Link href="/pipeline">
            <Button variant="ghost" size="sm">
              <Eye className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-6 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{data?.totalActive || 0}</div>
                <div className="text-sm text-gray-600">Active Deals</div>
              </div>
            </div>
            
            <div className="space-y-2">
              {data?.stages.map((stage) => (
                <div key={stage.stage} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium">{stage.stage}</div>
                    <div className="text-sm text-gray-600">{stage.avg_days} days avg</div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="secondary">{stage.count}</Badge>
                    {stage.avg_days > 21 && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Recent Activities Widget
const RecentActivitiesWidget: React.FC = () => {
  const { data, isLoading, refetch } = useQuery<RecentActivitiesData>({
    queryKey: ["/api/v2/dashboard/data/recent-activities"],
    refetchInterval: 2 * 60 * 1000, // Refresh every 2 minutes
    select: (response: any) => response.data,
  });

  return (
    <Card className="col-span-2">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold">Recent Activities</CardTitle>
        <div className="flex space-x-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Link href="/target-companies">
            <Button variant="ghost" size="sm">
              <Eye className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="animate-pulse space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gray-200 rounded"></div>
                <div className="flex-1 space-y-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {data?.activities.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Activity className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No recent activities</p>
              </div>
            ) : (
              data?.activities.map((activity) => (
                <div key={activity.id} className="flex items-start space-x-3 p-3 hover:bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0 p-2 bg-blue-50 rounded-lg">
                    {getActivityIcon(activity.activityType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{activity.title}</div>
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">{activity.companyName}</span>
                      <span className="mx-1">•</span>
                      <span>by {activity.userName}</span>
                      <span className="mx-1">•</span>
                      <span>{new Date(activity.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Hot Deals Widget
const HotDealsWidget: React.FC = () => {
  const { data, isLoading, refetch } = useQuery<HotDealsData>({
    queryKey: ["/api/v2/dashboard/data/hot-deals"],
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
    select: (response: any) => response.data,
  });

  return (
    <Card className="col-span-2">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold flex items-center">
          🔥 Hot Deals
          <span className="ml-2 text-sm text-gray-600 font-normal">Deals needing attention</span>
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="animate-pulse space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {data?.deals.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Target className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p className="text-lg">🎉 No deals need immediate attention!</p>
              </div>
            ) : (
              data?.deals.map((deal) => (
                <Link key={deal.id} href={`/target-companies/${deal.id}`}>
                  <div className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold">{deal.companyName}</h4>
                        <div className="text-sm text-gray-600">{deal.stage}</div>
                      </div>
                      <div className="text-right space-y-1">
                        {deal.daysInStage > 21 && (
                          <Badge variant="destructive" className="text-xs">
                            Stuck {deal.daysInStage} days
                          </Badge>
                        )}
                        {deal.recentActivityCount === 0 && (
                          <Badge variant="outline" className="text-xs">
                            No recent activity
                          </Badge>
                        )}
                        {(deal.stage === 'Offer Stage' || deal.stage === 'Negotiation') && (
                          <Badge variant="default" className="text-xs">
                            Critical stage
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Quick Stats Widget
const QuickStatsWidget: React.FC = () => {
  const { data, isLoading, refetch } = useQuery<QuickStatsData>({
    queryKey: ["/api/v2/dashboard/data/quick-stats"],
    refetchInterval: 10 * 60 * 1000, // Refresh every 10 minutes
    select: (response: any) => response.data,
  });

  return (
    <Card className="col-span-2">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold">Quick Stats</CardTitle>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">Last 30 days</span>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="animate-pulse grid grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{data?.newDeals || 0}</div>
              <div className="text-sm text-gray-600">New Deals</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{data?.completedDeals || 0}</div>
              <div className="text-sm text-gray-600">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{data?.totalActivities || 0}</div>
              <div className="text-sm text-gray-600">Activities</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{data?.avgDealTime || 0}</div>
              <div className="text-sm text-gray-600">Avg Deal Time (days)</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Upcoming Reminders Widget
const UpcomingRemindersWidget: React.FC = () => {
  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/v2/dashboard/data/upcoming-reminders"],
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
    select: (response: any) => response.data,
  });

  return (
    <Card className="col-span-1">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold">Upcoming Reminders</CardTitle>
        <div className="flex space-x-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="animate-pulse space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gray-200 rounded"></div>
                <div className="flex-1 space-y-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {data?.reminders?.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                <Calendar className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No upcoming reminders</p>
              </div>
            ) : (
              data?.reminders?.map((reminder: any) => (
                <div key={reminder.id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0 p-1 bg-blue-50 rounded">
                    {getActivityIcon(reminder.activityType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{reminder.title}</div>
                    <div className="text-xs text-gray-600">
                      <span>{reminder.companyName}</span>
                      <span className="mx-1">•</span>
                      <span>{new Date(reminder.activityDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Team Activity Widget
const TeamActivityWidget: React.FC = () => {
  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/v2/dashboard/data/team-activity"],
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
    select: (response: any) => response.data,
  });

  return (
    <Card className="col-span-1">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold">Team Activity</CardTitle>
        <div className="flex space-x-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="animate-pulse space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 bg-gray-200 rounded-full"></div>
                  <div className="h-4 bg-gray-200 rounded w-20"></div>
                </div>
                <div className="h-4 bg-gray-200 rounded w-8"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {data?.teamActivity?.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                <Users2 className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No team activity</p>
              </div>
            ) : (
              data?.teamActivity?.map((member: any) => (
                <div key={member.userName} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-xs font-medium text-blue-600">
                        {member.userName.split(' ').map((n: string) => n[0]).join('')}
                      </span>
                    </div>
                    <span className="text-sm font-medium">{member.userName}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {member.count}
                  </Badge>
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Stage Alerts Widget
const StageAlertsWidget: React.FC = () => {
  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/v2/dashboard/data/stage-alerts"],
    refetchInterval: 10 * 60 * 1000, // Refresh every 10 minutes
    select: (response: any) => response.data,
  });

  return (
    <Card className="col-span-2">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold">Stage Alerts</CardTitle>
        <div className="flex space-x-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="animate-pulse space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center space-x-3">
                <div className="w-4 h-4 bg-gray-200 rounded"></div>
                <div className="flex-1 space-y-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {data?.stageAlerts?.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-300" />
                <p className="text-sm">No stage alerts - all deals are progressing well!</p>
              </div>
            ) : (
              data?.stageAlerts?.map((alert: any) => (
                <div key={alert.id} className="flex items-start space-x-3 p-3 border-l-4 border-amber-400 bg-amber-50 rounded-lg">
                  <AlertTriangle className={`w-4 h-4 mt-0.5 ${
                    alert.alertType === 'critical' ? 'text-red-500' : 
                    alert.alertType === 'warning' ? 'text-amber-500' : 'text-blue-500'
                  }`} />
                  <div className="flex-1">
                    <div className="font-medium text-sm">{alert.companyName}</div>
                    <div className="text-xs text-gray-600">{alert.message}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Current stage: <span className="font-medium">{alert.stage}</span>
                    </div>
                  </div>
                  <Badge variant={alert.alertType === 'critical' ? 'destructive' : 'secondary'} className="text-xs">
                    {alert.daysInStage}d
                  </Badge>
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/v2/dashboard/stats"],
    select: (response: any) => response.data,
  });

  // Auto-refresh dashboard every 5 minutes
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
            <h1 className="text-3xl font-bold text-gray-900">
              M&A Dashboard
            </h1>
            <p className="mt-1 text-gray-600">
              Welcome back, {user.firstName} • {user.company?.companyName}
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            <Button onClick={refreshDashboard} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <div className="text-sm text-gray-500">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
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
                  <p className="text-sm font-medium text-gray-600">Target Companies</p>
                  <p className="text-2xl font-bold text-gray-900">{stats?.targetCompanies || 0}</p>
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
                  <p className="text-sm font-medium text-gray-600">Active Deals</p>
                  <p className="text-2xl font-bold text-gray-900">{stats?.activeDeals || 0}</p>
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
                  <p className="text-sm font-medium text-gray-600">Total Contacts</p>
                  <p className="text-2xl font-bold text-gray-900">{stats?.totalContacts || 0}</p>
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
                  <p className="text-sm font-medium text-gray-600">Deal Value</p>
                  <p className="text-2xl font-bold text-gray-900">{stats?.dealValue || '$0'}</p>
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
              <p className="text-gray-600 mb-4">Create a new acquisition target to track</p>
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
              <p className="text-gray-600 mb-4">Manage your acquisition pipeline</p>
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
              <p className="text-gray-600 mb-4">Manage team members and roles</p>
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