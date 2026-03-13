import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSubscriptionContext, usePlanKey } from "@/context/subscription-context";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Crown,
  Loader2,
  ExternalLink,
  Building2,
  Users,
  Mail,
  Minus,
  UserPlus,
  Tag,
  ChevronDown,
  Gift,
  FlaskConical,
} from "lucide-react";
import type { PlanKey } from "@shared/schema/billing";

const formatGBP = (pence: number) => `£${(pence / 100).toFixed(2)}`;
const formatUSD = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const formatCurrency = (minorUnits: number, currency: string) =>
  currency === 'usd' ? formatUSD(minorUnits) : formatGBP(minorUnits);

interface UpgradePreview {
  currentPlan: string;
  currentInterval: string;
  newPlan: string;
  newInterval: string;
  creditAmount: number;
  chargeAmount: number;
  nextInvoiceDate: string;
  nextInvoiceAmount: number;
  currency: string;
  freePeriodCredit?: number;
  unusedFreeMonths?: number;
}

const PLAN_ORDER: PlanKey[] = ["CORE", "PROFESSIONAL", "EXPERT"];

interface PlanPricing {
  monthlyPrice: number;
  annualPrice: number;
}

interface PlanDefinition {
  key: PlanKey;
  name: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  popular?: boolean;
  features: string[];
}

const PLAN_PRICING: Record<string, Record<PlanKey, PlanPricing>> = {
  gbp: {
    CORE: { monthlyPrice: 67, annualPrice: 53.60 },
    PROFESSIONAL: { monthlyPrice: 127, annualPrice: 101.60 },
    EXPERT: { monthlyPrice: 297, annualPrice: 237.60 },
    ENTERPRISE: { monthlyPrice: 0, annualPrice: 0 },
  },
  usd: {
    CORE: { monthlyPrice: 67, annualPrice: 53.60 },
    PROFESSIONAL: { monthlyPrice: 127, annualPrice: 101.60 },
    EXPERT: { monthlyPrice: 297, annualPrice: 237.60 },
    ENTERPRISE: { monthlyPrice: 0, annualPrice: 0 },
  },
};

function getPlans(currency: string): PlanDefinition[] {
  const pricing = PLAN_PRICING[currency] || PLAN_PRICING.gbp;
  return [
    {
      key: "CORE",
      name: "Core",
      description: "For solo buyers managing their first acquisitions.",
      ...pricing.CORE,
      features: [
        "Pipeline kanban board",
        "AI document extraction",
        "Simplified deal modeller",
        "Seller portal with document collection",
        "AI offer letter generation",
      ],
    },
    {
      key: "PROFESSIONAL",
      name: "Professional",
      description: "For active acquirers running multiple live deals.",
      ...pricing.PROFESSIONAL,
      popular: true,
      features: [
        "Full deal modeller with version history",
        "Expert deep-dive analysis (11 dimensions)",
        "Due diligence data room",
        "Multi-document uploads & review workflow",
        "Onboarding call & priority features",
      ],
    },
    {
      key: "EXPERT",
      name: "Expert",
      description: "For M&A professionals and investment firms.",
      ...pricing.EXPERT,
      features: [
        "Value creation modeller with sensitivity analysis",
        "Heads of Terms builder",
        "Third-party DD access & white-label portal",
        "Role-based access control & API access",
        "Priority support",
      ],
    },
  ];
}

function getStatusLabel(status: string): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
  switch (status) {
    case "active":
      return { label: "Active", variant: "default" };
    case "trialing":
      return { label: "Trial", variant: "secondary" };
    case "past_due":
      return { label: "Past Due", variant: "destructive" };
    case "admin_comped":
      return { label: "Admin Comped", variant: "outline" };
    case "canceled":
      return { label: "Canceled", variant: "destructive" };
    default:
      return { label: status, variant: "outline" };
  }
}

function getPlanIndex(planKey: PlanKey | null): number {
  if (!planKey) return -1;
  return PLAN_ORDER.indexOf(planKey);
}

function getTrialDaysRemaining(trialEnd: string | Date | null | undefined): number | null {
  if (!trialEnd) return null;
  const end = new Date(trialEnd);
  const now = new Date();
  const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

export default function BillingPage() {
  const { subscription, isLoading, isError } = useSubscriptionContext();
  const currentPlan = usePlanKey();
  const { toast } = useToast();
  const [billingInterval, setBillingInterval] = useState<"month" | "year">("month");
  const [pricingCurrency, setPricingCurrency] = useState<"gbp" | "usd">(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("currency") === "usd" ? "usd" : "gbp";
  });
  const currencySymbol = pricingCurrency === "usd" ? "$" : "£";
  const PLANS = getPlans(pricingCurrency);
  const [verifyingSession, setVerifyingSession] = useState(false);
  const verifyAttempted = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    if (!sessionId || verifyAttempted.current) return;
    verifyAttempted.current = true;
    setVerifyingSession(true);

    apiRequest("POST", "/api/v2/billing/verify-session", { sessionId })
      .then((res) => res.json())
      .then((data: any) => {
        if (data.success) {
          queryClient.invalidateQueries({ queryKey: ["/api/v2/billing/subscription"] });
          toast({
            title: "Payment successful",
            description: `Your ${data.planKey?.charAt(0) + data.planKey?.slice(1).toLowerCase()} plan has been activated.`,
          });
        }
      })
      .catch(() => {
        toast({
          title: "Verification issue",
          description: "We couldn't verify your payment right away. Your plan will activate shortly.",
          variant: "destructive",
        });
      })
      .finally(() => {
        setVerifyingSession(false);
        window.history.replaceState({}, "", "/billing");
      });
  }, [toast]);

  const [upgradePreview, setUpgradePreview] = useState<UpgradePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);
  const [pendingUpgrade, setPendingUpgrade] = useState<{ planKey: PlanKey; interval: "month" | "year" } | null>(null);

  const handlePlanAction = async (planKey: PlanKey, interval: "month" | "year") => {
    setPreviewLoading(planKey);
    try {
      const previewRes = await fetch(`/api/v2/billing/upgrade-preview?planKey=${planKey}&billingInterval=${interval}`, {
        credentials: "include",
      });
      const previewData = await previewRes.json() as (UpgradePreview & { isNewSubscription?: boolean });

      if (previewData.isNewSubscription) {
        checkoutMutation.mutate({ planKey, interval });
        return;
      }

      setUpgradePreview(previewData);
      setPendingUpgrade({ planKey, interval });
    } catch {
      checkoutMutation.mutate({ planKey, interval });
    } finally {
      setPreviewLoading(null);
    }
  };

  const confirmUpgrade = () => {
    if (!pendingUpgrade) return;
    upgradeMutation.mutate(pendingUpgrade);
    setUpgradePreview(null);
    setPendingUpgrade(null);
  };

  const cancelUpgrade = () => {
    setUpgradePreview(null);
    setPendingUpgrade(null);
  };

  const checkoutMutation = useMutation({
    mutationFn: async ({ planKey, interval }: { planKey: PlanKey; interval: "month" | "year" }) => {
      const res = await apiRequest("POST", "/api/v2/billing/checkout", {
        planKey,
        billingInterval: interval,
        currency: pricingCurrency,
      });
      return res.json() as Promise<{ checkoutUrl?: string; requiresUpgrade?: boolean }>;
    },
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Checkout failed",
        description: error.message || "Failed to start checkout. Please try again.",
        variant: "destructive",
      });
    },
  });

  const upgradeMutation = useMutation({
    mutationFn: async ({ planKey, interval }: { planKey: PlanKey; interval: "month" | "year" }) => {
      const res = await apiRequest("POST", "/api/v2/billing/upgrade", {
        planKey,
        billingInterval: interval,
        currency: pricingCurrency,
      });
      return res.json() as Promise<{ upgraded?: boolean; error?: string; message?: string }>;
    },
    onSuccess: (data) => {
      if (data.upgraded) {
        queryClient.invalidateQueries({ queryKey: ["/api/v2/billing/subscription"] });
        toast({
          title: "Plan upgraded",
          description: "Your new plan is now active. Enjoy your upgraded features!",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Upgrade failed",
        description: error.message || "Failed to upgrade plan. Please try again.",
        variant: "destructive",
      });
    },
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/v2/billing/portal");
      return res.json() as Promise<{ portalUrl: string }>;
    },
    onSuccess: (data) => {
      window.location.href = data.portalUrl;
    },
    onError: (error: any) => {
      toast({
        title: "Portal access failed",
        description: error.message || "Failed to open billing portal. Please try again.",
        variant: "destructive",
      });
    },
  });

  const addonMutation = useMutation({
    mutationFn: async ({ addonType, quantity }: { addonType: "company_slot" | "seat"; quantity: number }) => {
      const res = await apiRequest("POST", "/api/v2/billing/addon", { addonType, quantity });
      return res.json() as Promise<{ success: boolean; addedQuantity: number; newTotal: number }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v2/billing/subscription"] });
      toast({
        title: "Add-on activated",
        description: "Your next invoice will include the additional charge.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Add-on purchase failed",
        description: error.message || "Failed to purchase add-on. Please try again.",
        variant: "destructive",
      });
    },
  });

  const removeSeatMutation = useMutation({
    mutationFn: async ({ quantity }: { quantity: number }) => {
      const res = await apiRequest("POST", "/api/v2/billing/remove-seat", { quantity });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v2/billing/subscription"] });
      toast({ title: "Seat removed", description: "Your seat has been removed successfully." });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to remove seat",
        description: error.message || "Could not remove seat. Please try again.",
        variant: "destructive",
      });
    },
  });

  const removeSlotMutation = useMutation({
    mutationFn: async ({ quantity }: { quantity: number }) => {
      const res = await apiRequest("POST", "/api/v2/billing/remove-slot", { quantity });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v2/billing/subscription"] });
      toast({ title: "Slot removed", description: "Your company slot has been removed. Your next invoice will reflect the change." });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to remove slot",
        description: error.message || "Could not remove slot. Please try again.",
        variant: "destructive",
      });
    },
  });

  const [slotQuantity, setSlotQuantity] = useState("1");
  const [seatQuantity, setSeatQuantity] = useState("1");

  const [promoOpen, setPromoOpen] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoError, setPromoError] = useState<string | null>(null);

  const promoClaimMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await apiRequest("POST", "/api/v2/billing/claim-promo", { code });
      return res.json() as Promise<{ success: boolean; reason?: string; freeMonths?: number; discountDescription?: string }>;
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["/api/v2/billing/subscription"] });
        toast({
          title: "Promo code applied",
          description: data.discountDescription || `${data.freeMonths} free month${data.freeMonths !== 1 ? "s" : ""} activated!`,
        });
        setPromoCode("");
        setPromoError(null);
        setPromoOpen(false);
      } else {
        setPromoError(data.reason || "Invalid promo code.");
      }
    },
    onError: (error: any) => {
      setPromoError(error.message || "Failed to apply promo code. Please try again.");
    },
  });

  const isBetaMode = import.meta.env.VITE_BETA_MODE === 'true';

  const { data: betaConfig } = useQuery<{ success: boolean; data: { tierSwitchEnabled: boolean; feedbackEnabled: boolean } }>({
    queryKey: ['/api/v2/beta/config'],
    enabled: isBetaMode,
  });

  const betaTierSwitchEnabled = isBetaMode && betaConfig?.data?.tierSwitchEnabled === true;

  const betaSwitchMutation = useMutation({
    mutationFn: async (tier: string) => {
      const res = await apiRequest("POST", "/api/v2/beta/switch-plan", { tier });
      return res.json();
    },
    onSuccess: (_data, tier) => {
      queryClient.invalidateQueries({ queryKey: ["/api/v2/billing/subscription"] });
      toast({
        title: "Plan switched",
        description: `You are now on the ${tier.charAt(0).toUpperCase() + tier.slice(1)} plan (beta override).`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Switch failed",
        description: error.message || "Failed to switch plan. Please try again.",
        variant: "destructive",
      });
    },
  });

  const currentPlanIndex = getPlanIndex(currentPlan);
  const status = subscription?.status ?? null;
  const isActiveOrComped = status === "active" || status === "admin_comped";
  const hasStripeCustomer = !!subscription?.stripeCustomerId;
  const trialDays = status === "trialing" ? getTrialDaysRemaining(subscription?.trialEnd) : null;
  const showSeats = currentPlan === "PROFESSIONAL" || currentPlan === "EXPERT" || currentPlan === "ENTERPRISE";
  const currentSeats = subscription?.additionalSeats ?? 0;
  const currentSlots = subscription?.addOnCompanySlots ?? 0;
  const basePlanLimits = currentPlan ? { CORE: 3, PROFESSIONAL: 20, EXPERT: 100, ENTERPRISE: null }[currentPlan] : null;
  const totalCompanyCapacity = basePlanLimits !== null ? (basePlanLimits ?? 0) + currentSlots : "Unlimited";

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Billing & Plans</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your subscription, compare plans, and purchase add-ons.
        </p>
      </div>

      {isLoading || verifyingSession ? (
        <div className="space-y-6">
          {verifyingSession && (
            <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Verifying your payment and activating your plan...</p>
            </div>
          )}
          <Skeleton className="h-24 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
          </div>
        </div>
      ) : (
        <>
          {status === "past_due" && (
            <Card className="border-destructive bg-destructive/5">
              <CardContent className="flex items-center gap-4 py-4">
                <AlertTriangle className="h-6 w-6 text-destructive flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-destructive">Payment Failed</p>
                  <p className="text-sm text-muted-foreground">
                    Your payment has failed — please update your payment method to avoid losing access.
                  </p>
                </div>
                <Button
                  variant="destructive"
                  onClick={() => portalMutation.mutate()}
                  disabled={portalMutation.isPending}
                >
                  {portalMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  Update Payment Method
                </Button>
              </CardContent>
            </Card>
          )}

          {subscription && (
            <Card>
              <CardContent className="flex items-center justify-between py-5">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <Crown className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold text-foreground">
                        {currentPlan ? currentPlan.charAt(0) + currentPlan.slice(1).toLowerCase() : "No Plan"} Plan
                      </h2>
                      <Badge variant={getStatusLabel(subscription.status).variant}>
                        {getStatusLabel(subscription.status).label}
                      </Badge>
                    </div>
                    {trialDays !== null && (
                      <p className="text-sm text-muted-foreground">
                        {trialDays} day{trialDays !== 1 ? "s" : ""} remaining in trial
                      </p>
                    )}
                  </div>
                </div>
                {subscription.billingInterval && (
                  <Badge variant="outline" className="text-xs">
                    Billed {subscription.billingInterval === "year" ? "annually" : "monthly"}
                  </Badge>
                )}
              </CardContent>
            </Card>
          )}

          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-foreground">Choose Your Plan</h2>
              <div className="flex items-center gap-2">
                <Label htmlFor="billing-toggle" className={`text-sm ${billingInterval === "month" ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                  Monthly
                </Label>
                <Switch
                  id="billing-toggle"
                  checked={billingInterval === "year"}
                  onCheckedChange={(checked) => setBillingInterval(checked ? "year" : "month")}
                />
                <Label htmlFor="billing-toggle" className={`text-sm ${billingInterval === "year" ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                  Annual
                </Label>
                {billingInterval === "year" && (
                  <Badge variant="secondary" className="text-xs ml-1">Save 20%</Badge>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {PLANS.map((plan) => {
                const planIndex = getPlanIndex(plan.key);
                const isCurrent = currentPlan === plan.key;
                const isUpgrade = planIndex > currentPlanIndex;
                const isDowngrade = planIndex < currentPlanIndex && currentPlanIndex >= 0;
                const price = billingInterval === "year" ? plan.annualPrice : plan.monthlyPrice;

                return (
                  <Card
                    key={plan.key}
                    data-plan={plan.key}
                    className={`relative flex flex-col ${plan.popular ? "border-primary shadow-md" : ""} ${isCurrent ? "bg-muted/30" : ""}`}
                  >
                    {plan.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className="bg-primary text-primary-foreground">Most Popular</Badge>
                      </div>
                    )}
                    <CardHeader className="pb-4">
                      <CardTitle className="text-xl">{plan.name}</CardTitle>
                      <CardDescription>{plan.description}</CardDescription>
                      <div className="pt-2">
                        <span className="text-3xl font-bold text-foreground">{currencySymbol}{price % 1 === 0 ? price : price.toFixed(2)}</span>
                        <span className="text-sm text-muted-foreground">/mo</span>
                        {billingInterval === "year" && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {currencySymbol}{(price * 12).toFixed(2)}/year — billed annually
                          </p>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col">
                      <ul className="space-y-2.5 flex-1 mb-6">
                        {plan.features.map((feature, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                            <span className="text-muted-foreground">{feature}</span>
                          </li>
                        ))}
                      </ul>

                      {isCurrent ? (
                        <Button disabled className="w-full">
                          Current Plan
                        </Button>
                      ) : isDowngrade ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="w-full">
                              <Button variant="outline" disabled className="w-full">
                                Downgrade
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Contact us to downgrade</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : isUpgrade ? (
                        <Button
                          className="w-full"
                          onClick={() => handlePlanAction(plan.key, billingInterval)}
                          disabled={previewLoading === plan.key || upgradeMutation.isPending}
                        >
                          {previewLoading === plan.key || upgradeMutation.isPending ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : null}
                          Upgrade to {plan.name}
                        </Button>
                      ) : (
                        <Button
                          className="w-full"
                          onClick={() => handlePlanAction(plan.key, billingInterval)}
                          disabled={previewLoading === plan.key || checkoutMutation.isPending}
                        >
                          {previewLoading === plan.key || checkoutMutation.isPending ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : null}
                          Get Started
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {isActiveOrComped && (
            <>
              <Separator />
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-4">Add-ons</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-primary" />
                        <CardTitle className="text-base">Company Slots</CardTitle>
                      </div>
                      <CardDescription>
                        {currentSlots > 0
                          ? `You currently have ${currentSlots} additional slot${currentSlots !== 1 ? "s" : ""} — total capacity: ${totalCompanyCapacity} companies`
                          : `Your plan includes ${basePlanLimits ?? "unlimited"} company slots. Add more at £9 per slot/month.`}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-end gap-4">
                        <div className="space-y-1.5 flex-1">
                          <Label className="text-sm">Add Slots</Label>
                          <Select value={slotQuantity} onValueChange={setSlotQuantity}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                                <SelectItem key={n} value={String(n)}>
                                  {n} slot{n > 1 ? "s" : ""} — £{n * 9}/mo
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          onClick={() =>
                            addonMutation.mutate({ addonType: "company_slot", quantity: parseInt(slotQuantity) })
                          }
                          disabled={addonMutation.isPending}
                        >
                          {addonMutation.isPending ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : null}
                          Add Slots
                        </Button>
                      </div>
                      {currentSlots > 0 && (
                        <div className="flex items-center justify-between pt-2 border-t">
                          <span className="text-sm text-muted-foreground">
                            {currentSlots} additional slot{currentSlots !== 1 ? "s" : ""} active
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeSlotMutation.mutate({ quantity: 1 })}
                            disabled={removeSlotMutation.isPending}
                          >
                            {removeSlotMutation.isPending ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Minus className="h-4 w-4 mr-2" />
                            )}
                            Remove a Slot
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {showSeats ? (
                    <Card>
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          <Users className="h-5 w-5 text-primary" />
                          <CardTitle className="text-base">Team Seats</CardTitle>
                        </div>
                        <CardDescription>
                          {currentSeats > 0
                            ? `You currently have ${currentSeats} additional seat${currentSeats !== 1 ? "s" : ""} — total team size: ${1 + currentSeats}. Cost: £${currentSeats * 100}/month`
                            : "Add team members to collaborate on deals. £100 per seat/month."}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-end gap-4">
                          <div className="space-y-1.5 flex-1">
                            <Label className="text-sm">Add Seats</Label>
                            <Select value={seatQuantity} onValueChange={setSeatQuantity}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                                  <SelectItem key={n} value={String(n)}>
                                    {n} seat{n > 1 ? "s" : ""} — £{n * 100}/mo
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button
                            onClick={() =>
                              addonMutation.mutate({ addonType: "seat", quantity: parseInt(seatQuantity) })
                            }
                            disabled={addonMutation.isPending}
                          >
                            {addonMutation.isPending ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : null}
                            Add Seats
                          </Button>
                        </div>
                        {currentSeats > 0 && (
                          <div className="flex items-center justify-between pt-2 border-t">
                            <span className="text-sm text-muted-foreground">
                              {currentSeats} additional seat{currentSeats !== 1 ? "s" : ""} active
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => removeSeatMutation.mutate({ quantity: 1 })}
                              disabled={removeSeatMutation.isPending}
                            >
                              {removeSeatMutation.isPending ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Minus className="h-4 w-4 mr-2" />
                              )}
                              Remove a Seat
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="border-primary/20 bg-primary/5">
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          <UserPlus className="h-5 w-5 text-primary" />
                          <CardTitle className="text-base">Invite Your Team</CardTitle>
                        </div>
                        <CardDescription>
                          Collaborating on a deal? Upgrade to Professional to add team members from £100/seat/month.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Button
                          onClick={() => {
                            const el = document.querySelector('[data-plan="PROFESSIONAL"]');
                            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }}
                        >
                          Upgrade to Professional
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </>
          )}

          {hasStripeCustomer && (
            <>
              <Separator />
              <Card>
                <CardContent className="flex items-center justify-between py-5">
                  <div className="flex items-center gap-3">
                    <ExternalLink className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-foreground">Billing Portal</p>
                      <p className="text-sm text-muted-foreground">
                        Manage your subscription, update payment methods, or view invoices in the Stripe billing portal.
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => portalMutation.mutate()}
                    disabled={portalMutation.isPending}
                  >
                    {portalMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : null}
                    Open Billing Portal
                  </Button>
                </CardContent>
              </Card>
            </>
          )}

          {!subscription?.promoCodeId && (
            <Collapsible open={promoOpen} onOpenChange={setPromoOpen}>
              <CollapsibleTrigger asChild>
                <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full justify-center py-2">
                  <Tag className="h-4 w-4" />
                  <span>Have a referral or promo code? Click to apply</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${promoOpen ? "rotate-180" : ""}`} />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <Card className="mt-2">
                  <CardContent className="py-4">
                    <div className="flex items-end gap-3">
                      <div className="flex-1 space-y-1.5">
                        <Label className="text-sm">Promo Code</Label>
                        <Input
                          placeholder="e.g. 5DA-X7K2M"
                          value={promoCode}
                          onChange={(e) => {
                            setPromoCode(e.target.value.toUpperCase());
                            setPromoError(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && promoCode.trim()) {
                              promoClaimMutation.mutate(promoCode.trim());
                            }
                          }}
                        />
                        {promoError && (
                          <p className="text-sm text-destructive">{promoError}</p>
                        )}
                      </div>
                      <Button
                        onClick={() => promoClaimMutation.mutate(promoCode.trim())}
                        disabled={!promoCode.trim() || promoClaimMutation.isPending}
                      >
                        {promoClaimMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : null}
                        Apply
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </CollapsibleContent>
            </Collapsible>
          )}

          {betaTierSwitchEnabled && (
            <>
              <Separator />
              <Card className="border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <FlaskConical className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    <CardTitle className="text-base text-amber-800 dark:text-amber-300">Beta Testing Mode</CardTitle>
                    <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-300 text-xs">BETA</Badge>
                  </div>
                  <CardDescription>
                    Switch between plan tiers to test features at different subscription levels. This does not affect billing.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-3">
                    {(["core", "professional", "expert"] as const).map((tier) => {
                      const isActive = currentPlan === tier.toUpperCase();
                      return (
                        <Button
                          key={tier}
                          variant={isActive ? "default" : "outline"}
                          className={isActive ? "pointer-events-none" : ""}
                          disabled={betaSwitchMutation.isPending}
                          onClick={() => {
                            if (!isActive) betaSwitchMutation.mutate(tier);
                          }}
                        >
                          {betaSwitchMutation.isPending && betaSwitchMutation.variables === tier ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : null}
                          {tier.charAt(0).toUpperCase() + tier.slice(1)}
                          {isActive && <Check className="h-4 w-4 ml-2" />}
                        </Button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          <Card className="border-dashed">
            <CardContent className="flex items-center justify-between py-5">
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-foreground">Enterprise</p>
                  <p className="text-sm text-muted-foreground">
                    Need more? Enterprise plans offer custom limits, team management, SSO, and dedicated support.
                  </p>
                </div>
              </div>
              <Button variant="outline" asChild>
                <a href="mailto:enterprise@valoxi.ai">
                  <Mail className="h-4 w-4 mr-2" />
                  Contact Us
                </a>
              </Button>
            </CardContent>
          </Card>
        </>
      )}
      <AlertDialog open={!!upgradePreview} onOpenChange={(open) => { if (!open) cancelUpgrade(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Plan Change</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-3 py-2">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Current</p>
                    <p className="font-semibold text-foreground">
                      {upgradePreview?.currentPlan} ({upgradePreview?.currentInterval === "year" ? "Annual" : "Monthly"})
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-primary" />
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">New</p>
                    <p className="font-semibold text-foreground">
                      {upgradePreview?.newPlan} ({upgradePreview?.newInterval === "year" ? "Annual" : "Monthly"})
                    </p>
                  </div>
                </div>

                {upgradePreview && (upgradePreview.freePeriodCredit ?? 0) > 0 && (
                  <div className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-950/30 rounded-md border border-green-200 dark:border-green-800">
                    <Gift className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-green-700 dark:text-green-400">
                      Community referral credit: <span className="font-semibold">{formatGBP(upgradePreview.freePeriodCredit!)}</span> ({upgradePreview.unusedFreeMonths} unused free month{upgradePreview.unusedFreeMonths !== 1 ? "s" : ""}) will be applied to your Stripe balance
                    </p>
                  </div>
                )}

                {upgradePreview && upgradePreview.creditAmount > 0 && (
                  <p className="text-sm">
                    Unused time credit: <span className="font-medium text-green-600">{formatGBP(upgradePreview.creditAmount)}</span> will be applied to your account
                  </p>
                )}

                {upgradePreview && (
                  <p className="text-sm">
                    Amount due today: <span className="font-semibold text-foreground">{formatGBP(upgradePreview.chargeAmount)}</span>
                  </p>
                )}

                {upgradePreview && (
                  <p className="text-sm">
                    Your next invoice of <span className="font-medium">{formatGBP(upgradePreview.nextInvoiceAmount)}</span> will be on{" "}
                    {new Date(upgradePreview.nextInvoiceDate).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                )}

                {upgradePreview &&
                  upgradePreview.currentInterval === "year" &&
                  upgradePreview.newInterval === "month" && (
                    <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-md border border-amber-200 dark:border-amber-800">
                      <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-amber-700 dark:text-amber-400">
                        You are switching from annual to monthly billing. Your per-month cost will increase.
                      </p>
                    </div>
                  )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelUpgrade}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmUpgrade} disabled={upgradeMutation.isPending}>
              {upgradeMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Confirm Upgrade
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
