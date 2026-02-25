import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Flame, RefreshCw, Target } from "lucide-react";
import type { HotDealsData } from "./types";

const HotDealsWidget: React.FC = () => {
  const { data, isLoading, refetch } = useQuery<HotDealsData>({
    queryKey: ["/api/v2/dashboard/data/hot-deals"],
    refetchInterval: 5 * 60 * 1000,
    select: (response: any) => response.data,
  });

  return (
    <Card className="col-span-2">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold flex items-center">
          <Flame className="w-5 h-5 mr-2 text-orange-500" /> Hot Deals
          <span className="ml-2 text-sm text-muted-foreground font-normal">Deals needing attention</span>
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={() => refetch()} aria-label="Refresh hot deals">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="animate-pulse space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded"></div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {data?.deals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Target className="w-12 h-12 mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-lg">No deals need immediate attention!</p>
              </div>
            ) : (
              data?.deals.map((deal) => (
                <Link key={deal.id} href={`/target-companies/${deal.id}`}>
                  <div className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold">{deal.companyName}</h4>
                        <div className="text-sm text-muted-foreground">{deal.stage}</div>
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
                        {(deal.stage === 'Offer Stage' || deal.stage === 'Heads of Terms') && (
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

export default HotDealsWidget;
