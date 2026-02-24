import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Users2 } from "lucide-react";

const TeamActivityWidget: React.FC = () => {
  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/v2/dashboard/data/team-activity"],
    refetchInterval: 5 * 60 * 1000,
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

export default TeamActivityWidget;
