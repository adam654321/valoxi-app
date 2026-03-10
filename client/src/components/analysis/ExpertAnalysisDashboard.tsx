import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getReportViewForExpert, CoreAnalysisSummaryView } from "./ExpertReportViews";
import { useHasFeature } from "@/context/subscription-context";
import {
  Brain,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Play,
  ChevronRight,
  TrendingUp,
  Shield,
  DollarSign,
  BarChart3,
  Target,
  Handshake,
  Layers,
  ShieldCheck,
  Gauge,
  Lock,
  RefreshCw,
  AlertTriangle,
  StopCircle,
} from "lucide-react";

interface ExpertResult {
  id: number;
  targetCompanyId: number;
  expertType: string;
  status: string;
  analysisData: Record<string, unknown> | null;
  analysisMarkdown: string | null;
  score: number | null;
  confidence: string | null;
  processingTime: number | null;
  usageMetadata: Record<string, unknown> | null;
  dependsOn: string[] | null;
  createdAt: string;
  updatedAt: string;
}

interface ExpertAnalysisDashboardProps {
  targetCompanyId: number;
  companyName: string;
}

const EXPERT_CONFIG: Record<string, { label: string; icon: typeof Brain; color: string; description: string; layer: number; dependsOn: string[] }> = {
  data_quality: { label: "Data Quality", icon: Gauge, color: "text-slate-500", description: "Validates extracted data completeness", layer: 0, dependsOn: [] },
  screening: { label: "Screening", icon: Target, color: "text-indigo-500", description: "Initial viability assessment", layer: 0, dependsOn: ["data_quality"] },
  financial: { label: "Financial", icon: DollarSign, color: "text-emerald-500", description: "Revenue, margins & financial health", layer: 1, dependsOn: [] },
  operational: { label: "Operational", icon: BarChart3, color: "text-blue-500", description: "Operations & efficiency analysis", layer: 1, dependsOn: [] },
  risk: { label: "Risk", icon: Shield, color: "text-red-500", description: "Risk factors & mitigation", layer: 1, dependsOn: [] },
  qoe: { label: "Quality of Earnings", icon: ShieldCheck, color: "text-amber-500", description: "Earnings sustainability review", layer: 2, dependsOn: ["financial", "operational"] },
  sector: { label: "Sector", icon: Layers, color: "text-purple-500", description: "Market positioning & sector dynamics", layer: 2, dependsOn: ["financial"] },
  valuation: { label: "Valuation", icon: TrendingUp, color: "text-teal-500", description: "Fair value & pricing analysis", layer: 3, dependsOn: ["financial", "operational", "risk", "qoe", "sector"] },
  deal_structure: { label: "Deal Structure", icon: Handshake, color: "text-orange-500", description: "Optimal deal terms & structure", layer: 3, dependsOn: ["valuation", "risk", "operational", "qoe"] },
  synthesis: { label: "Synthesis", icon: Brain, color: "text-pink-500", description: "Combined recommendation & verdict", layer: 4, dependsOn: ["financial", "operational", "risk", "qoe", "sector", "valuation", "deal_structure"] },
};

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Clock }> = {
  pending: { label: "Pending", variant: "secondary", icon: Clock },
  processing: { label: "Running", variant: "default", icon: Loader2 },
  success: { label: "Complete", variant: "default", icon: CheckCircle },
  failed: { label: "Failed", variant: "destructive", icon: XCircle },
};

const LAYER_LABELS: Record<number, { title: string; subtitle: string }> = {
  1: { title: "Layer 1: Foundation Analysis", subtitle: "Parallel execution — Financial, Operational, Risk" },
  2: { title: "Layer 2: Derived Analysis", subtitle: "Depends on Layer 1 completion" },
  3: { title: "Layer 3: Valuation & Deal", subtitle: "Depends on Layers 1-2 completion" },
  4: { title: "Layer 4: Synthesis", subtitle: "Final combined recommendation" },
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = config.icon;
  const isRunning = status === "processing";
  return (
    <Badge variant={config.variant} className={`gap-1 ${status === "success" ? "bg-green-600 hover:bg-green-700" : ""}`}>
      <Icon className={`w-3 h-3 ${isRunning ? "animate-spin" : ""}`} />
      {config.label}
    </Badge>
  );
}

function RagBadge({ rag }: { rag: string }) {
  const color =
    rag === "GREEN" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
    : rag === "AMBER" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
    : rag === "RED" ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
    : "bg-muted text-foreground";
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>{rag}</span>;
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min((score / 100) * 100, 100);
  const color = pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function checkDependencies(expertType: string, results: ExpertResult[]): boolean {
  const config = EXPERT_CONFIG[expertType];
  if (!config || config.dependsOn.length === 0) return true;
  return config.dependsOn.every((dep) => {
    const depResult = results.find((r) => r.expertType === dep);
    return depResult?.status === "success" || depResult?.status === "failed";
  });
}

function ExpertCard({
  expertType,
  result,
  isLocked,
  onClick,
  onRetry,
  isRetrying,
}: {
  expertType: string;
  result: ExpertResult | undefined;
  isLocked: boolean;
  onClick: () => void;
  onRetry?: () => void;
  isRetrying?: boolean;
}) {
  const config = EXPERT_CONFIG[expertType];
  if (!config) return null;
  const Icon = config.icon;
  const status = result?.status || "pending";
  const isClickable = status === "success" && result?.analysisData && !isLocked;
  const isRunning = status === "processing";

  const analysisData = result?.analysisData as Record<string, unknown> | null;
  const rag = analysisData?.overall_rag as string | undefined;
  const overallScore = result?.score ?? (analysisData?.overall_score as number | undefined);

  return (
    <Card
      className={`transition-all relative ${
        isLocked
          ? "opacity-50 cursor-not-allowed"
          : isClickable
            ? "cursor-pointer hover:shadow-md hover:border-primary/50"
            : isRunning
              ? "border-blue-400 shadow-sm"
              : ""
      }`}
      onClick={() => !isLocked && isClickable && onClick()}
    >
      {isLocked && (
        <div className="absolute top-2 right-2">
          <Lock className="w-4 h-4 text-muted-foreground" />
        </div>
      )}
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className={`w-5 h-5 ${isLocked ? "text-muted-foreground" : config.color}`} />
            <CardTitle className="text-sm font-medium">{config.label}</CardTitle>
          </div>
          {!isLocked && <StatusBadge status={status} />}
        </div>
        <CardDescription className="text-xs">{config.description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {!isLocked && result && (
          <div className="space-y-1">
            {overallScore !== null && overallScore !== undefined && (
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Score</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${
                      overallScore >= 70 ? "text-green-600" : overallScore >= 40 ? "text-amber-600" : "text-red-600"
                    }`}>
                      {overallScore}/100
                    </span>
                    {rag && <RagBadge rag={rag} />}
                  </div>
                </div>
                <ScoreBar score={overallScore} />
              </div>
            )}
            {result.confidence && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Confidence</span>
                <span className="text-xs capitalize font-medium">{result.confidence}</span>
              </div>
            )}
            {result.processingTime && (
              <p className="text-xs text-muted-foreground">
                Processed in {(result.processingTime / 1000).toFixed(1)}s
              </p>
            )}
            {isClickable && (
              <div className="flex items-center text-xs text-primary mt-2 font-medium">
                View full report <ChevronRight className="w-3 h-3 ml-1" />
              </div>
            )}
            {status === "failed" && onRetry && (
              <div className="mt-2">
                {analysisData?.error ? (
                  <p className="text-xs text-red-500 mb-2 line-clamp-2">
                    {String(analysisData.error as string)}
                  </p>
                ) : null}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs h-7"
                  onClick={(e) => { e.stopPropagation(); onRetry(); }}
                  disabled={isRetrying}
                >
                  {isRetrying ? (
                    <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Retrying...</>
                  ) : (
                    <><RefreshCw className="w-3 h-3 mr-1" />Retry</>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
        {isLocked && (
          <p className="text-xs text-muted-foreground italic mt-1">
            Waiting for: {config.dependsOn.map((d) => EXPERT_CONFIG[d]?.label || d).join(", ")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function ExpertAnalysisDashboard({ targetCompanyId, companyName }: ExpertAnalysisDashboardProps) {
  const { toast } = useToast();
  const [selectedExpert, setSelectedExpert] = useState<ExpertResult | null>(null);
  const hasFullDetail = useHasFeature("expertAnalysisFullDetail");

  const { data: results = [], isLoading } = useQuery<ExpertResult[]>({
    queryKey: ["/api/v2/expert-analysis/results", targetCompanyId],
    select: (response: any) => response.data || response,
    refetchInterval: (query) => {
      const raw = query.state.data;
      const data = Array.isArray(raw) ? raw : Array.isArray((raw as any)?.data) ? (raw as any).data : null;
      if (!data || data.length === 0) return false;
      const hasRunning = data.some((r: ExpertResult) => r.status === "processing" || r.status === "pending");
      return hasRunning ? 3000 : false;
    },
  });

  const triggerMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/v2/expert-analysis/trigger-pipeline/${targetCompanyId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v2/expert-analysis/results", targetCompanyId] });
      toast({ title: "Expert Deep Dive Started", description: "The full expert analysis pipeline has been triggered." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const triggerStage1Mutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/v2/expert-analysis/trigger-stage1/${targetCompanyId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v2/expert-analysis/results", targetCompanyId] });
      toast({ title: "Screening Started", description: "Data quality check and screening analysis have been triggered." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const [retryingExpert, setRetryingExpert] = useState<string | null>(null);

  const retryMutation = useMutation({
    mutationFn: (expertType: string) => apiRequest("POST", `/api/v2/expert-analysis/retry/${targetCompanyId}/${expertType}`),
    onMutate: (expertType: string) => {
      setRetryingExpert(expertType);
    },
    onSuccess: (_data: unknown, expertType: string) => {
      queryClient.invalidateQueries({ queryKey: ["/api/v2/expert-analysis/results", targetCompanyId] });
      const label = EXPERT_CONFIG[expertType]?.label || expertType;
      toast({ title: `${label} Retry Started`, description: `Re-running the ${label} analysis. Downstream experts will continue automatically.` });
      setRetryingExpert(null);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setRetryingExpert(null);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/v2/expert-analysis/cancel/${targetCompanyId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v2/expert-analysis/results", targetCompanyId] });
      toast({ title: "Analysis Cancelled", description: "All pending and running analyses have been stopped." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const getResult = (type: string) => results.find((r) => r.expertType === type);

  const dataQuality = getResult("data_quality");
  const screening = getResult("screening");
  const qualityScore = (dataQuality?.analysisData as Record<string, unknown>)?.overall_completeness_score as number | undefined;
  const screeningData = screening?.analysisData as Record<string, unknown> | null;
  const screeningOutcome = screeningData?.recommendation as string | undefined;
  const screeningScore = screeningData?.overall_score as number | undefined ?? screening?.score;

  const hasScreeningPassed = screening?.status === "success";
  const deepDiveExperts = ["financial", "operational", "risk", "qoe", "sector", "valuation", "deal_structure", "synthesis"];
  const hasDeepDiveStarted = deepDiveExperts.some((t) => getResult(t));
  const hasRunningExperts = results.some((r) => r.status === "processing" || r.status === "pending");

  const completedDeepDive = deepDiveExperts.filter((t) => getResult(t)?.status === "success").length;
  const totalDeepDive = deepDiveExperts.length;
  const progressPercent = hasDeepDiveStarted ? Math.round((completedDeepDive / totalDeepDive) * 100) : 0;

  const isProceed = screeningOutcome === "PROCEED" || screeningOutcome === "STRONG_PROCEED" || screeningOutcome === "proceed" || screeningOutcome === "strong_proceed";
  const isNoGo = screeningOutcome === "NO_GO" || screeningOutcome === "REJECT" || screeningOutcome === "no_go" || screeningOutcome === "reject";

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => <Skeleton key={i} className="h-40 w-full" />)}
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Brain className="w-16 h-16 mx-auto mb-4 opacity-40" />
        <p className="text-lg font-medium mb-2">No Expert Analysis Yet</p>
        <p className="text-sm mb-6">
          Run screening analysis to assess data quality and initial viability.
          <br />
          <span className="text-xs">This triggers automatically when financial documents are uploaded, or you can start it manually.</span>
        </p>
        <Button
          onClick={() => triggerStage1Mutation.mutate()}
          disabled={triggerStage1Mutation.isPending}
        >
          {triggerStage1Mutation.isPending ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Starting...</>
          ) : (
            <><Play className="w-4 h-4 mr-2" />Run Screening Analysis</>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-indigo-500" />
            <h2 className="text-lg font-semibold">Phase 1: Screening</h2>
            <Badge variant="outline" className="text-xs">Pre-requisite</Badge>
          </div>
          <div className="flex items-center gap-2">
            {(dataQuality?.status === 'processing' || screening?.status === 'processing') && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
              >
                {cancelMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Cancelling...</>
                ) : (
                  <><StopCircle className="w-4 h-4 mr-2" />Cancel</>
                )}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => triggerStage1Mutation.mutate()}
              disabled={triggerStage1Mutation.isPending || (dataQuality?.status === 'processing') || (screening?.status === 'processing')}
            >
              {triggerStage1Mutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Running...</>
              ) : (
                <><RefreshCw className="w-4 h-4 mr-2" />Re-run Screening</>
              )}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card
            className={`transition-all ${dataQuality?.status === "success" && dataQuality?.analysisData ? "cursor-pointer hover:shadow-md hover:border-primary/50" : ""}`}
            onClick={() => dataQuality?.status === "success" && dataQuality?.analysisData && setSelectedExpert(dataQuality)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gauge className="w-5 h-5 text-slate-500" />
                  <CardTitle className="text-sm font-medium">Data Quality</CardTitle>
                </div>
                {dataQuality && <StatusBadge status={dataQuality.status} />}
              </div>
            </CardHeader>
            <CardContent>
              {dataQuality ? (
                <div className="flex items-center gap-4">
                  <div className={`text-4xl font-bold ${
                    qualityScore && qualityScore > 70 ? "text-green-600" : qualityScore && qualityScore > 40 ? "text-amber-600" : "text-red-600"
                  }`}>
                    {qualityScore ?? "—"}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Completeness Score</p>
                    {dataQuality.analysisData && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Confidence: <span className="capitalize font-medium">{(dataQuality.analysisData as Record<string, unknown>).confidence_for_analysis as string || "—"}</span>
                      </p>
                    )}
                  </div>
                  {dataQuality.status === "success" && dataQuality.analysisData && (
                    <div className="flex items-center text-xs text-primary font-medium">
                      View report <ChevronRight className="w-3 h-3 ml-1" />
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">Not yet assessed</p>
              )}
            </CardContent>
          </Card>

          <Card
            className={`transition-all ${screening?.status === "success" && screening?.analysisData ? "cursor-pointer hover:shadow-md hover:border-primary/50" : ""}`}
            onClick={() => screening?.status === "success" && screening?.analysisData && setSelectedExpert(screening)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-indigo-500" />
                  <CardTitle className="text-sm font-medium">Screening</CardTitle>
                </div>
                {screening && <StatusBadge status={screening.status} />}
              </div>
            </CardHeader>
            <CardContent>
              {screening ? (
                <div className="flex items-center gap-4">
                  <Badge className={`text-base px-3 py-1 ${
                    isProceed ? "bg-green-600 hover:bg-green-700"
                    : isNoGo ? "bg-red-600 hover:bg-red-700"
                    : "bg-amber-600 hover:bg-amber-700"
                  }`}>
                    {screeningOutcome?.replace(/_/g, " ") ?? "—"}
                  </Badge>
                  <div className="flex-1">
                    {screeningScore !== null && screeningScore !== undefined && (
                      <p className="text-sm">
                        Score: <span className="font-bold">{screeningScore}/100</span>
                      </p>
                    )}
                  </div>
                  {screening.status === "success" && screening.analysisData && (
                    <div className="flex items-center text-xs text-primary font-medium">
                      View report <ChevronRight className="w-3 h-3 ml-1" />
                    </div>
                  )}
                </div>
              ) : qualityScore !== undefined && qualityScore <= 40 ? (
                <p className="text-sm text-amber-600">Skipped — data quality too low (score: {qualityScore})</p>
              ) : (
                <p className="text-muted-foreground text-sm">Awaiting data quality check</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {hasFullDetail === false && (
        <>
          {/* CORE: trigger block — shown when screening passed but deep dive not yet started */}
          {hasScreeningPassed && !hasDeepDiveStarted && (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 dark:bg-indigo-950/20 dark:border-indigo-800/60 p-6 text-center space-y-3">
              <Brain className="w-10 h-10 mx-auto text-indigo-500 opacity-80" />
              <h3 className="text-base font-semibold text-indigo-900 dark:text-indigo-200">Ready for Expert Deep Dive</h3>
              <p className="text-sm text-indigo-700 dark:text-indigo-400">
                Screening is complete. Start the full expert analysis to get valuations, risk scoring, and deal recommendations.
              </p>
              <Button
                onClick={() => triggerMutation.mutate()}
                disabled={triggerMutation.isPending || hasRunningExperts}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {triggerMutation.isPending || hasRunningExperts ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Running...</>
                ) : (
                  <><Play className="w-4 h-4 mr-2" />Start Expert Deep Dive</>
                )}
              </Button>
            </div>
          )}

          {/* CORE: progress indicator while deep dive is running */}
          {hasDeepDiveStarted && hasRunningExperts && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800/60 p-6 text-center space-y-3">
              <Loader2 className="w-10 h-10 mx-auto text-blue-500 animate-spin" />
              <h3 className="text-base font-semibold text-blue-900 dark:text-blue-200">Expert Analysis Running</h3>
              <p className="text-sm text-blue-700 dark:text-blue-400">
                {completedDeepDive} of {totalDeepDive} experts complete — this usually takes 3–5 minutes.
              </p>
              <Progress value={progressPercent} className="h-2 max-w-xs mx-auto" />
            </div>
          )}

          {/* CORE: summary view once complete */}
          {hasDeepDiveStarted && completedDeepDive === totalDeepDive && !hasRunningExperts && (
            <CoreAnalysisSummaryView results={results} />
          )}
        </>
      )}

      {hasFullDetail !== false && (<div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <h2 className="text-lg font-semibold">Phase 2: Expert Deep Dive</h2>
              {hasDeepDiveStarted && (
                <Badge variant="outline" className="text-xs">
                  {completedDeepDive}/{totalDeepDive} complete
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {hasDeepDiveStarted
                ? hasRunningExperts
                  ? "Analysis in progress — experts are running..."
                  : completedDeepDive === totalDeepDive
                    ? "All expert analyses complete"
                    : `${completedDeepDive} of ${totalDeepDive} experts completed`
                : "Run a comprehensive deep dive across all dimensions"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasRunningExperts && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
              >
                {cancelMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Cancelling...</>
                ) : (
                  <><StopCircle className="w-4 h-4 mr-2" />Cancel</>
                )}
              </Button>
            )}
            <Button
              onClick={() => triggerMutation.mutate()}
              disabled={triggerMutation.isPending || hasRunningExperts}
            >
              {triggerMutation.isPending || hasRunningExperts ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  {hasDeepDiveStarted ? "Re-run Deep Dive" : "Start Expert Deep Dive"}
                </>
              )}
            </Button>
          </div>
        </div>

        {hasDeepDiveStarted && (
          <div className="mb-6">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>Overall Progress</span>
              <span>{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>
        )}

        {!hasScreeningPassed && !hasDeepDiveStarted && (
          <Card className="border-dashed border-amber-200 dark:border-amber-800/60">
            <CardContent className="py-8 text-center text-muted-foreground">
              <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-amber-500 opacity-70" />
              <p className="text-sm font-medium mb-1">Screening Not Complete</p>
              <p className="text-xs mb-4">Screening is recommended before deep dive to ensure data quality, but you can proceed manually if needed.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => triggerMutation.mutate()}
                disabled={triggerMutation.isPending}
              >
                {triggerMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Starting...</>
                ) : (
                  <><Play className="w-4 h-4 mr-2" />Start Deep Dive Anyway</>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {isNoGo && !hasDeepDiveStarted && (
          <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900">
            <CardContent className="py-6 text-center">
              <XCircle className="w-8 h-8 mx-auto mb-3 text-red-500" />
              <p className="text-sm font-medium text-red-700 dark:text-red-400">Screening Recommended NO-GO</p>
              <p className="text-xs text-red-600 dark:text-red-500 mt-1 mb-4">Deep dive is not recommended for this target, but you can override if needed.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => triggerMutation.mutate()}
                disabled={triggerMutation.isPending}
                className="border-red-300 text-red-700 hover:bg-red-100 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950"
              >
                {triggerMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Starting...</>
                ) : (
                  <><Play className="w-4 h-4 mr-2" />Override & Start Deep Dive</>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {(hasDeepDiveStarted || hasScreeningPassed) && (
          <div className="space-y-6">
            {[1, 2, 3, 4].map((layer) => {
              const layerExperts = deepDiveExperts.filter((t) => EXPERT_CONFIG[t]?.layer === layer);
              if (layerExperts.length === 0) return null;
              const layerInfo = LAYER_LABELS[layer];

              const gridCols =
                layerExperts.length >= 3
                  ? "grid-cols-1 md:grid-cols-3"
                  : layerExperts.length === 2
                    ? "grid-cols-1 md:grid-cols-2"
                    : "grid-cols-1";

              return (
                <div key={layer}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      layer === 1 ? "bg-blue-500" : layer === 2 ? "bg-purple-500" : layer === 3 ? "bg-teal-500" : "bg-pink-500"
                    }`} />
                    <h3 className="text-sm font-semibold text-muted-foreground">{layerInfo.title}</h3>
                    <span className="text-xs text-muted-foreground">— {layerInfo.subtitle}</span>
                  </div>
                  <div className={`grid ${gridCols} gap-4`}>
                    {layerExperts.map((expertType) => {
                      const result = getResult(expertType);
                      const isLocked = !checkDependencies(expertType, results);
                      return (
                        <ExpertCard
                          key={expertType}
                          expertType={expertType}
                          result={result}
                          isLocked={isLocked && !result}
                          onClick={() => result && setSelectedExpert(result)}
                          onRetry={() => retryMutation.mutate(expertType)}
                          isRetrying={retryingExpert === expertType}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>)}

      <Dialog open={!!selectedExpert} onOpenChange={() => setSelectedExpert(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              {selectedExpert && EXPERT_CONFIG[selectedExpert.expertType] && (
                <>
                  {(() => { const Icon = EXPERT_CONFIG[selectedExpert.expertType].icon; return <Icon className={`w-5 h-5 ${EXPERT_CONFIG[selectedExpert.expertType].color}`} />; })()}
                  {EXPERT_CONFIG[selectedExpert.expertType].label} Report
                </>
              )}
            </DialogTitle>
            {selectedExpert && (
              <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                {selectedExpert.score !== null && selectedExpert.score !== undefined && (
                  <span>Score: <strong className="text-foreground">{selectedExpert.score}/100</strong></span>
                )}
                {selectedExpert.confidence && (
                  <span>Confidence: <strong className="text-foreground capitalize">{selectedExpert.confidence}</strong></span>
                )}
                {selectedExpert.processingTime && (
                  <span>Processed in: <strong className="text-foreground">{(selectedExpert.processingTime / 1000).toFixed(1)}s</strong></span>
                )}
              </div>
            )}
          </DialogHeader>
          <ScrollArea className="max-h-[calc(85vh-120px)]">
            <div className="px-6 py-4">
              {selectedExpert && selectedExpert.analysisData && (
                getReportViewForExpert(selectedExpert.expertType, selectedExpert.analysisData)
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
