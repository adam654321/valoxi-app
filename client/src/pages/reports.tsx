import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { Download, TrendingUp, Target, Users, Activity, BarChart3 } from "lucide-react";

interface PipelineData {
  pipelineDistribution: Array<{
    stage: string;
    count: number;
    percentage: number;
  }>;
  stageVelocity: any[];
  conversionRates: any[];
}

interface ActivityData {
  activityByType: Array<{
    activity_type: string;
    count: number;
    avg_duration: number;
    companies_contacted: number;
  }>;
  activityByUser: any[];
  activityTrends: any[];
}

interface PerformanceData {
  total_deals: number;
  active_deals: number;
  completed_deals: number;
  success_rate: number;
}

interface StageAnalysisData {
  stage_name: string;
  deal_count: number;
  avg_days: number;
  risk_level: 'low' | 'medium' | 'high';
}

interface UserPerformanceData {
  user_name: string;
  active_deals: number;
  total_activities: number;
  success_rate: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', '#d084d0'];

export default function Reports() {
  const [dateRange, setDateRange] = useState<string>("30");

  // Fetch all report data using v2 endpoints
  const { data: pipelineData, isLoading: pipelineLoading } = useQuery<PipelineData>({
    queryKey: ['/api/v2/reports/pipeline-overview', dateRange],
    queryFn: () => fetch(`/api/v2/reports/pipeline-overview?range=${dateRange}`, { credentials: 'include' }).then(r => r.json()),
    select: (response: any) => response.data,
  });

  const { data: activityData, isLoading: activityLoading } = useQuery<ActivityData>({
    queryKey: ['/api/v2/reports/activity-summary', dateRange],
    queryFn: () => fetch(`/api/v2/reports/activity-summary?range=${dateRange}`, { credentials: 'include' }).then(r => r.json()),
    select: (response: any) => response.data,
  });

  const { data: performanceData, isLoading: performanceLoading } = useQuery<PerformanceData>({
    queryKey: ['/api/v2/reports/performance-metrics', dateRange],
    queryFn: () => fetch(`/api/v2/reports/performance-metrics?range=${dateRange}`, { credentials: 'include' }).then(r => r.json()),
    select: (response: any) => response.data,
  });

  const { data: stageAnalysisData, isLoading: stageAnalysisLoading } = useQuery<StageAnalysisData[]>({
    queryKey: ['/api/v2/reports/stage-analysis', dateRange],
    queryFn: () => fetch(`/api/v2/reports/stage-analysis?range=${dateRange}`, { credentials: 'include' }).then(r => r.json()),
    select: (response: any) => response.data,
  });

  const { data: userPerformanceData, isLoading: userPerformanceLoading } = useQuery<UserPerformanceData[]>({
    queryKey: ['/api/v2/reports/user-performance', dateRange],
    queryFn: () => fetch(`/api/v2/reports/user-performance?range=${dateRange}`, { credentials: 'include' }).then(r => r.json()),
    select: (response: any) => response.data,
  });

  const handleExport = async (reportType: string) => {
    try {
      const response = await fetch(`/api/v2/reports/export/${reportType}?format=csv`, { credentials: 'include' });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reportType}_report_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const getRiskBadgeVariant = (riskLevel: string) => {
    switch (riskLevel) {
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      default: return 'default';
    }
  };

  return (
    <div className="min-h-screen bg-muted">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Reports & Analytics
            </h1>
            <p className="text-muted-foreground mt-2">
              Comprehensive insights into your Valoxi pipeline performance
            </p>
          </div>

          <div className="flex items-center gap-4">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select date range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">Last 30 Days</SelectItem>
                <SelectItem value="90">Last 90 Days</SelectItem>
                <SelectItem value="365">Last Year</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>

            <Button
              onClick={() => handleExport('pipeline-overview')}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {performanceLoading ? (
            [...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-4 w-20 mb-2" />
                  <Skeleton className="h-8 w-16 mb-4" />
                  <Skeleton className="h-3 w-24" />
                </CardContent>
              </Card>
            ))
          ) : (
            <>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Deals</p>
                      <p className="text-2xl font-bold text-foreground">
                        {performanceData?.total_deals || 0}
                      </p>
                    </div>
                    <div className="h-12 w-12 bg-blue-50 dark:bg-blue-900/40 rounded-lg flex items-center justify-center">
                      <Target className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Active Deals</p>
                      <p className="text-2xl font-bold text-foreground">
                        {performanceData?.active_deals || 0}
                      </p>
                    </div>
                    <div className="h-12 w-12 bg-green-50 dark:bg-green-900/40 rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Completed Deals</p>
                      <p className="text-2xl font-bold text-foreground">
                        {performanceData?.completed_deals || 0}
                      </p>
                    </div>
                    <div className="h-12 w-12 bg-purple-50 dark:bg-purple-900/40 rounded-lg flex items-center justify-center">
                      <BarChart3 className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
                      <p className="text-2xl font-bold text-foreground">
                        {performanceData?.success_rate || 0}%
                      </p>
                    </div>
                    <div className="h-12 w-12 bg-orange-50 dark:bg-orange-900/40 rounded-lg flex items-center justify-center">
                      <Activity className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Pipeline Distribution Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Pipeline Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pipelineLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pipelineData?.pipelineDistribution || []}
                      dataKey="count"
                      nameKey="stage"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      label
                    >
                      {pipelineData?.pipelineDistribution?.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Activity by Type Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Activity by Type
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activityLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={activityData?.activityByType || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="activity_type" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tables Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Stage Analysis Table */}
          <Card>
            <CardHeader>
              <CardTitle>Stage Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              {stageAnalysisLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Stage</TableHead>
                      <TableHead>Deals</TableHead>
                      <TableHead>Avg Days</TableHead>
                      <TableHead>Risk</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stageAnalysisData?.map((stage, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{stage.stage_name}</TableCell>
                        <TableCell>{stage.deal_count}</TableCell>
                        <TableCell>{Math.round(stage.avg_days || 0)}</TableCell>
                        <TableCell>
                          <Badge variant={getRiskBadgeVariant(stage.risk_level)}>
                            {stage.risk_level}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* User Performance Table */}
          <Card>
            <CardHeader>
              <CardTitle>Team Performance</CardTitle>
            </CardHeader>
            <CardContent>
              {userPerformanceLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Team Member</TableHead>
                      <TableHead>Active Deals</TableHead>
                      <TableHead>Activities</TableHead>
                      <TableHead>Success Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userPerformanceData?.map((user, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{user.user_name}</TableCell>
                        <TableCell>{user.active_deals}</TableCell>
                        <TableCell>{user.total_activities}</TableCell>
                        <TableCell>{user.success_rate || 0}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}