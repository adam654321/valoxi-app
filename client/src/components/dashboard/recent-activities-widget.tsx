import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { RefreshCw, Activity, Eye } from "lucide-react";
import type { RecentActivitiesData } from "./types";
import { getActivityIcon } from "./utils";

const RecentActivitiesWidget: React.FC = () => {
  const { data, isLoading, refetch } = useQuery<RecentActivitiesData>({
    queryKey: ["/api/v2/dashboard/data/recent-activities"],
    refetchInterval: 2 * 60 * 1000,
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

export default RecentActivitiesWidget;
