import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw } from "lucide-react";
import type { QuickStatsData } from "./types";

const QuickStatsWidget: React.FC = () => {
  const { data, isLoading, refetch } = useQuery<QuickStatsData>({
    queryKey: ["/api/v2/dashboard/data/quick-stats"],
    refetchInterval: 10 * 60 * 1000,
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

export default QuickStatsWidget;
