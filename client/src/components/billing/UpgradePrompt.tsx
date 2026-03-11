import { useHasFeature } from "@/context/subscription-context";
import type { TierFeatures } from "@shared/entitlements";
import type { PlanKey } from "@shared/schema/billing";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Lock, Sparkles } from "lucide-react";
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
        <Card className="w-full max-w-md border border-indigo-200/60 dark:border-indigo-500/20 shadow-2xl dark:shadow-indigo-950/50 bg-white dark:bg-slate-900/95 backdrop-blur-sm ring-1 ring-inset ring-white/10">
          <CardContent className="flex flex-col items-center gap-5 p-8 text-center">
            <div className="relative">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/30">
                <Lock className="h-7 w-7 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 shadow-sm">
                <Sparkles className="h-3 w-3 text-amber-900" />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-foreground">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
            </div>
            <Badge className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-0 px-3 py-1">
              Requires {planLabel}
            </Badge>
            <Link href="/billing">
              <Button className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/25 border-0">
                Upgrade to {planLabel}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
