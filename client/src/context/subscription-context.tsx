import { createContext, useContext } from "react";
import { useSubscription } from "@/hooks/use-subscription";
import type { TierFeatures, TierLimits } from "@shared/entitlements";
import type { Subscription, PlanKey } from "@shared/schema/billing";

interface SubscriptionContextValue {
  subscription: Subscription | null;
  limits: TierLimits | null;
  features: TierFeatures | null;
  effectiveMaxSeats: number | null;
  consumedSeats: number;
  assignedPromoCampaign?: {
    id: number;
    name: string;
    referralSource: string;
    freeMonthsTotal: number;
  } | null;
  freePeriodState?: {
    isActive: boolean;
    elapsedMonths: number;
    remainingMonths: number;
  } | null;
  isLoading: boolean;
  isError: boolean;
}

export const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const value = useSubscription();

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscriptionContext(): SubscriptionContextValue {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error("useSubscriptionContext must be used within a SubscriptionProvider");
  }
  return context;
}

export function useHasFeature(feature: keyof TierFeatures): boolean | null {
  const { features, isLoading } = useSubscriptionContext();
  if (isLoading) return null;
  if (!features) return false;
  const val = features[feature];
  return val !== false;
}

export function usePlanKey(): PlanKey | null {
  const { subscription, isLoading } = useSubscriptionContext();
  if (isLoading || !subscription) return null;
  return subscription.planKey as PlanKey;
}
