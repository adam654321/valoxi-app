import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw, Calendar } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { getActivityIcon } from "./utils";

const UpcomingRemindersWidget: React.FC = () => {
  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/v2/dashboard/data/upcoming-reminders"],
    refetchInterval: 5 * 60 * 1000,
    select: (response: any) => response.data,
  });

  return (
    <Card className="col-span-1">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold">Upcoming Reminders</CardTitle>
        <div className="flex space-x-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()} aria-label="Refresh upcoming reminders">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="animate-pulse space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-muted rounded"></div>
                <div className="flex-1 space-y-1">
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {data?.reminders?.length === 0 ? (
              <EmptyState icon={Calendar} title="No upcoming reminders" size="sm" />
            ) : (
              data?.reminders?.map((reminder: any) => (
                <div key={reminder.id} className="flex items-center space-x-3 p-2 hover:bg-muted/50 rounded-lg">
                  <div className="flex-shrink-0 p-1 bg-blue-50 rounded">
                    {getActivityIcon(reminder.activityType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{reminder.title}</div>
                    <div className="text-xs text-muted-foreground">
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

export default UpcomingRemindersWidget;
