import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, AlertTriangle, CheckCircle } from "lucide-react";

const StageAlertsWidget: React.FC = () => {
  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/v2/dashboard/data/stage-alerts"],
    refetchInterval: 10 * 60 * 1000,
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

export default StageAlertsWidget;
