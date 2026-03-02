import { useHasFeature } from "@/context/subscription-context";
import type { TierFeatures } from "@shared/entitlements";
import type { PlanKey } from "@shared/schema/billing";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Lock } from "lucide-react";
import { Link } from "wouter";

interface UpgradePromptProps {
  feature: keyof TierFeatures;
  requiredPlan: PlanKey;
  title: string;
  description: string;
  children?: React.ReactNode;
}

export function UpgradePrompt({ feature, requiredPlan, title, description, children }: UpgradePromptProps) {
  const hasFeature = useHasFeature(feature);

  if (hasFeature === null) {
    return <Skeleton className="h-48 w-full rounded-lg" />;
  }

  if (hasFeature) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      {children && (
        <div className="blur-sm pointer-events-none select-none" aria-hidden="true">
          {children}
        </div>
      )}
      <div className={children ? "absolute inset-0 flex items-center justify-center" : ""}>
        <Card className="w-full max-w-md border-dashed">
          <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Lock className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-foreground">{title}</h3>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            <Badge variant="secondary">Requires {requiredPlan.charAt(0) + requiredPlan.slice(1).toLowerCase()}</Badge>
            <Link href="/billing">
              <Button>Upgrade Plan</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
