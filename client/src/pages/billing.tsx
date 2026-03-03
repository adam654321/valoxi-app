import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
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
  AlertTriangle,
  Check,
  Crown,
  Loader2,
  ExternalLink,
  Building2,
  Users,
  Mail,
} from "lucide-react";
import type { PlanKey } from "@shared/schema/billing";

const PLAN_ORDER: PlanKey[] = ["CORE", "PROFESSIONAL", "EXPERT"];

interface PlanDefinition {
  key: PlanKey;
  name: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  popular?: boolean;
  features: string[];
}

const PLANS: PlanDefinition[] = [
  {
    key: "CORE",
    name: "Core",
    description: "For solo buyers managing their first acquisitions.",
    monthlyPrice: 67,
    annualPrice: 53.60,
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
    monthlyPrice: 297,
    annualPrice: 237.60,
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
    monthlyPrice: 447,
    annualPrice: 357.60,
    features: [
      "Value creation modeller with sensitivity analysis",
      "Heads of Terms builder",
      "Third-party DD access & white-label portal",
      "Role-based access control & API access",
      "Priority support",
    ],
  },
];

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

  const checkoutMutation = useMutation({
    mutationFn: async ({ planKey, interval }: { planKey: PlanKey; interval: "month" | "year" }) => {
      const res = await apiRequest("POST", "/api/v2/billing/checkout", {
        planKey,
        billingInterval: interval,
      });
      return res.json() as Promise<{ checkoutUrl: string }>;
    },
    onSuccess: (data) => {
      window.location.href = data.checkoutUrl;
    },
    onError: (error: any) => {
      toast({
        title: "Checkout failed",
        description: error.message || "Failed to start checkout. Please try again.",
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

  // TODO: implement Stripe Elements for add-on payment confirmation
  const addonMutation = useMutation({
    mutationFn: async ({ addonType, quantity }: { addonType: "company_slot" | "seat"; quantity: number }) => {
      const res = await apiRequest("POST", "/api/v2/billing/addon", { addonType, quantity });
      return res.json() as Promise<{ clientSecret: string }>;
    },
    onSuccess: () => {
      toast({
        title: "Add-on purchased",
        description: "Your add-on has been processed successfully.",
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

  const [slotQuantity, setSlotQuantity] = useState("1");
  const [seatQuantity, setSeatQuantity] = useState("1");

  const currentPlanIndex = getPlanIndex(currentPlan);
  const status = subscription?.status ?? null;
  const isActiveOrComped = status === "active" || status === "admin_comped";
  const hasStripeCustomer = !!subscription?.stripeCustomerId;
  const trialDays = status === "trialing" ? getTrialDaysRemaining(subscription?.trialEnd) : null;
  const showSeats = currentPlan === "PROFESSIONAL" || currentPlan === "EXPERT" || currentPlan === "ENTERPRISE";

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
                        <span className="text-3xl font-bold text-foreground">£{price % 1 === 0 ? price : price.toFixed(2)}</span>
                        <span className="text-sm text-muted-foreground">/mo</span>
                        {billingInterval === "year" && (
                          <p className="text-xs text-muted-foreground mt-1">
                            £{(price * 12).toFixed(2)}/year — billed annually
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
                          onClick={() =>
                            checkoutMutation.mutate({
                              planKey: plan.key,
                              interval: billingInterval,
                            })
                          }
                          disabled={checkoutMutation.isPending}
                        >
                          {checkoutMutation.isPending ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : null}
                          Upgrade to {plan.name}
                        </Button>
                      ) : (
                        <Button
                          className="w-full"
                          onClick={() =>
                            checkoutMutation.mutate({
                              planKey: plan.key,
                              interval: billingInterval,
                            })
                          }
                          disabled={checkoutMutation.isPending}
                        >
                          {checkoutMutation.isPending ? (
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
                  {/* // TODO: confirm final add-on slot pricing before launch */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-primary" />
                        <CardTitle className="text-base">Additional Company Slots</CardTitle>
                      </div>
                      <CardDescription>
                        Add more target company slots to your plan. £8 per additional slot.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-end gap-4">
                        <div className="space-y-1.5 flex-1">
                          <Label className="text-sm">Quantity</Label>
                          <Select value={slotQuantity} onValueChange={setSlotQuantity}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                                <SelectItem key={n} value={String(n)}>
                                  {n} slot{n > 1 ? "s" : ""} — £{n * 8}/mo
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
                          Purchase
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {showSeats && (
                    // TODO: confirm final seat pricing before launch
                    <Card>
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          <Users className="h-5 w-5 text-primary" />
                          <CardTitle className="text-base">Additional Seats</CardTitle>
                        </div>
                        <CardDescription>
                          Add more team member seats to your plan. £10 per additional seat.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-end gap-4">
                          <div className="space-y-1.5 flex-1">
                            <Label className="text-sm">Quantity</Label>
                            <Select value={seatQuantity} onValueChange={setSeatQuantity}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                                  <SelectItem key={n} value={String(n)}>
                                    {n} seat{n > 1 ? "s" : ""} — £{n * 10}/mo
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
                            Purchase
                          </Button>
                        </div>
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
              {/* // TODO: replace with real contact email before launch */}
              <Button variant="outline" asChild>
                <a href="mailto:enterprise@example.com">
                  <Mail className="h-4 w-4 mr-2" />
                  Contact Us
                </a>
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
