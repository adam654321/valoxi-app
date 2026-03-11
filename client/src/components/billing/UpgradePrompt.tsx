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

  const planLabel = requiredPlan.charAt(0) + requiredPlan.slice(1).toLowerCase();

  return (
    <div className="relative">
      {children && (
        <div className="blur-sm pointer-events-none select-none" aria-hidden="true">
          {children}
        </div>
      )}
      <div className={children ? "absolute inset-0 flex items-center justify-center p-4" : "flex items-center justify-center p-4"}>
        <Card className="w-full max-w-md border border-border shadow-2xl dark:shadow-black/60 bg-background backdrop-blur-sm">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted border border-border">
              <Lock className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-semibold text-foreground">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
            </div>
            <Badge variant="secondary" className="px-3 py-0.5">Requires {planLabel}</Badge>
            <Link href="/billing" className="w-full">
              <Button className="w-full">Upgrade to {planLabel}</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
