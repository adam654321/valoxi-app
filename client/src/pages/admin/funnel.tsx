import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  Users,
  PlayCircle,
  Building2,
  FileUp,
  Brain,
  Calculator,
  FileText,
  CreditCard,
  CheckCircle,
  ArrowRight,
} from "lucide-react";

interface FunnelData {
  last30Days: {
    registered: number;
    trialStarted: number;
    targetCreated: number;
    documentUploaded: number;
    analysisCompleted: number;
    dealModelSaved: number;
    documentGenerated: number;
    subscriptionActivated: number;
    onboardingCompleted: number;
  };
  conversionRates: {
    registeredToTrial: string;
    trialToTargetCreated: string;
    targetToAnalysis: string;
    analysisToModelSaved: string;
    modelToDocumentGenerated: string;
  };
}

const EVENT_META: { key: keyof FunnelData["last30Days"]; label: string; icon: typeof Users }[] = [
  { key: "registered", label: "Registered", icon: Users },
  { key: "trialStarted", label: "Trial Started", icon: PlayCircle },
  { key: "targetCreated", label: "Target Created", icon: Building2 },
  { key: "documentUploaded", label: "Document Uploaded", icon: FileUp },
  { key: "analysisCompleted", label: "Analysis Completed", icon: Brain },
  { key: "dealModelSaved", label: "Deal Model Saved", icon: Calculator },
  { key: "documentGenerated", label: "Document Generated", icon: FileText },
  { key: "subscriptionActivated", label: "Subscription Activated", icon: CreditCard },
  { key: "onboardingCompleted", label: "Onboarding Completed", icon: CheckCircle },
];

const CONVERSION_META: { key: keyof FunnelData["conversionRates"]; from: string; to: string }[] = [
  { key: "registeredToTrial", from: "Registered", to: "Trial Started" },
  { key: "trialToTargetCreated", from: "Trial Started", to: "Target Created" },
  { key: "targetToAnalysis", from: "Target Created", to: "Analysis Completed" },
  { key: "analysisToModelSaved", from: "Analysis Completed", to: "Model Saved" },
  { key: "modelToDocumentGenerated", from: "Model Saved", to: "Document Generated" },
];

export default function AdminFunnel() {
  const { data, isLoading } = useQuery<{ success: boolean; data: FunnelData }>({
    queryKey: ["/api/v2/admin/funnel"],
    queryFn: async () => {
      const res = await fetch("/api/v2/admin/funnel", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch funnel data");
      return res.json();
    },
  });

  const funnel = data?.data;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <TrendingUp className="h-6 w-6" />
          Funnel Analytics
        </h1>
        <p className="text-sm text-muted-foreground">
          Last 30 days event counts and conversion rates
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {isLoading
          ? Array.from({ length: 9 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))
          : EVENT_META.map(({ key, label, icon: Icon }) => (
              <Card key={key}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Icon className="h-4 w-4" />
                    {label}
                  </div>
                  <div className="text-2xl font-bold">
                    {funnel?.last30Days[key] ?? 0}
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Conversion Rates</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {CONVERSION_META.map(({ key, from, to }) => {
                const rate = funnel?.conversionRates[key] ?? "0%";
                const numericRate = parseInt(rate);
                return (
                  <div
                    key={key}
                    className="flex items-center gap-4 p-3 rounded-lg border bg-muted/30"
                  >
                    <span className="text-sm font-medium w-40 text-right">{from}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium w-40">{to}</span>
                    <div className="flex-1">
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${Math.min(numericRate, 100)}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-bold w-12 text-right">{rate}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
