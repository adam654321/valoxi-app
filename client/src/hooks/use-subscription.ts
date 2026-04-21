import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import type { TierFeatures, TierLimits } from "@shared/entitlements";
import type { Subscription } from "@shared/schema/billing";

interface SubscriptionResponse {
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
}

export function useSubscription() {
  const { isAuthenticated } = useAuth();

  const { data, isLoading, isError } = useQuery<SubscriptionResponse>({
    queryKey: ["/api/v2/billing/subscription"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });

  return {
    subscription: data?.subscription ?? null,
    limits: data?.limits ?? null,
    features: data?.features ?? null,
    effectiveMaxSeats: data?.effectiveMaxSeats ?? null,
    consumedSeats: data?.consumedSeats ?? 0,
    assignedPromoCampaign: data?.assignedPromoCampaign ?? null,
    freePeriodState: data?.freePeriodState ?? null,
    isLoading,
    isError,
  };
}
