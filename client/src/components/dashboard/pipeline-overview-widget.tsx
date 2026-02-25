import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { RefreshCw, AlertTriangle, Eye } from "lucide-react";
import type { PipelineOverviewData } from "./types";

const PipelineOverviewWidget: React.FC = () => {
  const { data, isLoading, refetch } = useQuery<PipelineOverviewData>({
    queryKey: ["/api/v2/dashboard/data/pipeline-overview"],
    refetchInterval: 5 * 60 * 1000,
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
            <div className="h-8 bg-muted rounded w-1/3"></div>
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-6 bg-muted rounded"></div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{data?.totalActive || 0}</div>
                <div className="text-sm text-muted-foreground">Active Deals</div>
              </div>
            </div>
            
            <div className="space-y-2">
              {data?.stages.map((stage) => (
                <div key={stage.stage} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium">{stage.stage}</div>
                    <div className="text-sm text-muted-foreground">{stage.avg_days} days avg</div>
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

export default PipelineOverviewWidget;
