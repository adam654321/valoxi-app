import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerConfig } from "@/hooks/useServerConfig";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ValoxiLogo } from "@/components/valoxi-logo";
import { Loader2 } from "lucide-react";

const MARKETING_REGISTER_URL = "https://valoxi.ai/#register";

interface PromoInfo {
  slug: string;
  name: string;
  freeMonthsTotal: number;
  benefitLabel: string | null;
}

export default function WelcomePage() {
  const { openAccessEnabled, isLoading: configLoading } = useServerConfig();
  const { toast } = useToast();

  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const promoSlug = params.get("promo")?.trim().toLowerCase() || null;
  const planParam = params.get("plan")?.trim() || null;
  const intervalParam = params.get("interval")?.trim() || null;

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    data: promoData,
    isLoading: promoLoading,
    isError: promoError,
  } = useQuery<PromoInfo | null>({
    queryKey: ["/api/v2/public/promo", promoSlug],
    queryFn: async () => {
      const res = await fetch(`/api/v2/public/promo/${encodeURIComponent(promoSlug as string)}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("promo_fetch_failed");
      const json = await res.json();
      return json?.data ?? null;
    },
    enabled: !!promoSlug && openAccessEnabled,
    retry: false,
    staleTime: Infinity,
  });

  const effectivePromoSlug = promoData?.slug ?? null;
  const promoLinkInvalid = !!promoSlug && (promoError || (!promoLoading && promoData === null));

  function buildRedirect(baseRedirect: string): string {
    const url = new URL(baseRedirect, window.location.origin);
    if (planParam) url.searchParams.set("plan", planParam);
    if (intervalParam) url.searchParams.set("interval", intervalParam);
    return url.pathname + url.search;
  }

  async function handleSubmit() {
    if (!email.trim() || !firstName.trim()) {
      toast({
        title: "Missing details",
        description: "Email and first name are required.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/v2/public/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          promoSlug: effectivePromoSlug,
          marketingConsent,
        }),
      });
      const json = await res.json().catch(() => null);

      if (res.ok && json?.data?.redirectUrl) {
        window.location.href = buildRedirect(json.data.redirectUrl);
        return;
      }

      const errorCode = json?.error;
      if (errorCode === "account_inactive") {
        toast({
          title: "Account unavailable",
          description: "An account with this email is deactivated. Please contact support.",
          variant: "destructive",
        });
      } else if (errorCode === "open_access_disabled") {
        toast({
          title: "Signup unavailable",
          description: "Self-serve signup is not currently available.",
          variant: "destructive",
        });
      } else if (errorCode === "promo_not_found") {
        toast({
          title: "Promo link invalid",
          description: "That promo link is not valid. Please try again without it.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Something went wrong",
          description: json?.message || "Could not complete signup. Please try again.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Something went wrong",
        description: "Could not reach the server. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (configLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!openAccessEnabled) {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-4 bg-background">
        <div className="flex flex-col items-center gap-6 max-w-md text-center">
          <ValoxiLogo />
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Valoxi is currently invite-only</CardTitle>
              <CardDescription>
                We're not open for self-serve signup just yet. Register your interest
                and we'll be in touch.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full"
                onClick={() => { window.location.href = MARKETING_REGISTER_URL; }}
              >
                Register your interest
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 bg-background">
      <div className="flex flex-col items-center gap-6 w-full max-w-md">
        <ValoxiLogo />
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Create your Valoxi account</CardTitle>
            <CardDescription>
              Enter your details to get started. You'll set your password on the next step.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {promoSlug && promoLoading && (
              <p className="text-sm text-muted-foreground">Checking your promo link...</p>
            )}
            {promoData?.benefitLabel && (
              <div className="rounded-md bg-muted p-3 text-sm">
                {promoData.benefitLabel}
              </div>
            )}
            {promoLinkInvalid && (
              <div className="rounded-md border border-destructive/40 p-3 text-sm text-muted-foreground">
                That promo link isn't valid, but you can still sign up below.
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="w-email">Email</Label>
              <Input
                id="w-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="w-first">First name</Label>
                <Input
                  id="w-first"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="w-last">Last name</Label>
                <Input
                  id="w-last"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                />
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Checkbox
                id="w-consent"
                checked={marketingConsent}
                onCheckedChange={(v) => setMarketingConsent(v === true)}
              />
              <Label htmlFor="w-consent" className="text-sm font-normal leading-snug">
                Email me occasional Valoxi product updates. You can unsubscribe anytime.
              </Label>
            </div>

            <Button className="w-full" onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Continue
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Already have an account?{" "}
              <a href="/sign-in" className="underline hover:text-foreground">Sign in</a>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
