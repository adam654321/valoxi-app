import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Building2,
  FileText,
  Brain,
  Calculator,
  FileCheck,
  Check,
  X,
  PartyPopper,
} from "lucide-react";

interface OnboardingProgress {
  steps: {
    createTarget: boolean;
    uploadDocuments: boolean;
    generateAnalysis: boolean;
    saveModel: boolean;
    generateDocument: boolean;
  };
  completedCount: number;
  onboardingCompleted: boolean;
}

interface StepConfig {
  key: keyof OnboardingProgress["steps"];
  title: string;
  description: string;
  ctaLabel: string;
  icon: typeof Building2;
  getHref: (hasTarget: boolean) => string;
  disabledWhen?: (steps: OnboardingProgress["steps"]) => boolean;
}

const STEPS: StepConfig[] = [
  {
    key: "createTarget",
    title: "Add your first target company",
    description: "Find a business you want to evaluate and add it to your pipeline.",
    ctaLabel: "Add Target",
    icon: Building2,
    getHref: () => "/target-companies",
  },
  {
    key: "uploadDocuments",
    title: "Upload financial documents",
    description: "Upload accounts or financial statements for AI analysis.",
    ctaLabel: "Go to Target",
    icon: FileText,
    getHref: () => "/target-companies",
    disabledWhen: (steps) => !steps.createTarget,
  },
  {
    key: "generateAnalysis",
    title: "Generate expert analysis",
    description: "Run the AI analysis to get a full commercial due diligence report.",
    ctaLabel: "Run Analysis",
    icon: Brain,
    getHref: () => "/target-companies",
    disabledWhen: (steps) => !steps.uploadDocuments,
  },
  {
    key: "saveModel",
    title: "Save your deal model",
    description: "Set your offer price, funding stack, and DSCR.",
    ctaLabel: "Open Deal Modeller",
    icon: Calculator,
    getHref: () => "/target-companies",
    disabledWhen: (steps) => !steps.createTarget,
  },
  {
    key: "generateDocument",
    title: "Generate an offer or HoT",
    description: "Create your offer letter or heads of terms and send it to the seller.",
    ctaLabel: "Generate Document",
    icon: FileCheck,
    getHref: () => "/target-companies",
    disabledWhen: (steps) => !steps.createTarget,
  },
];

export default function ActivationChecklist() {
  const [dismissed, setDismissed] = useState(false);
  const [, navigate] = useLocation();

  const { data: progress, isLoading } = useQuery<OnboardingProgress>({
    queryKey: ["/api/v2/onboarding/progress"],
    select: (response: any) => response?.data || response,
    refetchInterval: 30000,
  });

  const completeMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/v2/onboarding/complete"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v2/onboarding/progress"] });
      queryClient.invalidateQueries({ queryKey: ["/api/v2/auth/me"] });
    },
  });

  if (dismissed || isLoading || !progress || progress.onboardingCompleted) {
    return null;
  }

  const allComplete = progress.completedCount === 5;

  if (allComplete && !completeMutation.isPending) {
    completeMutation.mutate();
  }

  const progressPercent = (progress.completedCount / 5) * 100;

  if (allComplete) {
    return (
      <Card className="mb-8 border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 bg-green-100 dark:bg-green-900/40 rounded-lg flex items-center justify-center shrink-0">
              <PartyPopper className="w-6 h-6 text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">
                You've completed your first deal pack — you're ready to buy a business.
              </h3>
              <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                All 5 activation steps complete. Your onboarding is finished.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-8">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Get started with Rubicon</CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setDismissed(true)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-3 mt-2">
          <Progress value={progressPercent} className="flex-1 h-2" />
          <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
            {progress.completedCount} of 5
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {STEPS.map((step) => {
            const isComplete = progress.steps[step.key];
            const isDisabled = step.disabledWhen?.(progress.steps) ?? false;
            const Icon = step.icon;

            return (
              <div
                key={step.key}
                className={`flex items-center gap-4 p-3 rounded-lg border transition-colors ${
                  isComplete
                    ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                    : "bg-background border-border"
                }`}
              >
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                    isComplete
                      ? "bg-green-500 text-white"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isComplete ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium ${
                      isComplete
                        ? "text-green-700 dark:text-green-300 line-through"
                        : "text-foreground"
                    }`}
                  >
                    {step.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {step.description}
                  </p>
                </div>
                {!isComplete && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isDisabled}
                    onClick={() => navigate(step.getHref(progress.steps.createTarget))}
                    className="shrink-0"
                  >
                    {step.ctaLabel}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
