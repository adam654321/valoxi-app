import { useHasFeature } from "@/context/subscription-context";
import type { TierFeatures } from "@shared/entitlements";

interface FeatureGateProps {
  feature: keyof TierFeatures;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function FeatureGate({ feature, children, fallback = null }: FeatureGateProps) {
  const hasFeature = useHasFeature(feature);

  if (hasFeature === true) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}
