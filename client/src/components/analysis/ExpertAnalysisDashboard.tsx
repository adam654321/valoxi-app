import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
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

const EXPERT_CONFIG: Record<string, { label: string; icon: typeof Brain; color: string; description: string }> = {
  data_quality: { label: "Data Quality", icon: Gauge, color: "text-slate-500", description: "Validates extracted data completeness" },
  screening: { label: "Screening", icon: Target, color: "text-indigo-500", description: "Initial viability assessment" },
  financial: { label: "Financial", icon: DollarSign, color: "text-emerald-500", description: "Revenue, margins & financial health" },
  operational: { label: "Operational", icon: BarChart3, color: "text-blue-500", description: "Operations & efficiency analysis" },
  risk: { label: "Risk", icon: Shield, color: "text-red-500", description: "Risk factors & mitigation" },
  qoe: { label: "Quality of Earnings", icon: ShieldCheck, color: "text-amber-500", description: "Earnings sustainability review" },
  sector: { label: "Sector", icon: Layers, color: "text-purple-500", description: "Market positioning & sector dynamics" },
  valuation: { label: "Valuation", icon: TrendingUp, color: "text-teal-500", description: "Fair value & pricing analysis" },
  deal_structure: { label: "Deal Structure", icon: Handshake, color: "text-orange-500", description: "Optimal deal terms & structure" },
  synthesis: { label: "Synthesis", icon: Brain, color: "text-pink-500", description: "Combined recommendation & verdict" },
};

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Clock }> = {
  pending: { label: "Pending", variant: "secondary", icon: Clock },
  processing: { label: "Running", variant: "default", icon: Loader2 },
  success: { label: "Complete", variant: "default", icon: CheckCircle },
  failed: { label: "Failed", variant: "destructive", icon: XCircle },
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
  const color = rag === "GREEN" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
    : rag === "AMBER" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
    : rag === "RED" ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
    : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400";
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>{rag}</span>;
}

function ScoreBar({ score, max = 100 }: { score: number; max?: number }) {
  const pct = Math.min((score / max) * 100, 100);
  const color = pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-semibold w-10 text-right">{score}</span>
    </div>
  );
}

function formatLabel(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/Cagr/g, "CAGR").replace(/Rag/g, "RAG").replace(/Qoe/g, "QoE")
    .replace(/Ebitda/g, "EBITDA").replace(/Roi/g, "ROI");
}

const SKIP_KEYS = new Set(["stage", "company_name", "sector", "analysis_date", "assessment_date"]);

function isSection(value: unknown): boolean {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDimensionBlock(value: unknown): value is Record<string, unknown> {
  if (!isSection(value)) return false;
  const v = value as Record<string, unknown>;
  return "rag" in v || "score" in v || "explanation" in v;
}

function DimensionCard({ label, data }: { label: string; data: Record<string, unknown> }) {
  const rag = data.rag as string | undefined;
  const score = data.score as number | undefined;
  const explanation = data.explanation as string | undefined;
  const otherEntries = Object.entries(data).filter(([k]) => !["rag", "score", "explanation"].includes(k));

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm">{formatLabel(label)}</h4>
        <div className="flex items-center gap-2">
          {score !== undefined && <span className="text-sm font-bold">{score}/100</span>}
          {rag && <RagBadge rag={rag} />}
        </div>
      </div>
      {score !== undefined && <ScoreBar score={score} />}
      {explanation && <p className="text-sm text-muted-foreground leading-relaxed">{explanation}</p>}
      {otherEntries.length > 0 && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1">
          {otherEntries.map(([k, v]) => (
            <div key={k} className="flex justify-between text-xs py-0.5">
              <span className="text-muted-foreground">{formatLabel(k)}</span>
              <span className="font-medium text-foreground">
                {typeof v === "number" ? v.toLocaleString() : typeof v === "boolean" ? (v ? "Yes" : "No") : String(v ?? "—")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DataSection({ label, data }: { label: string; data: Record<string, unknown> }) {
  const dimensionEntries = Object.entries(data).filter(([, v]) => isDimensionBlock(v));
  const subSections = Object.entries(data).filter(([, v]) => isSection(v) && !isDimensionBlock(v));
  const primitives = Object.entries(data).filter(([k, v]) => !isSection(v) && !Array.isArray(v) && !SKIP_KEYS.has(k));
  const arrays = Object.entries(data).filter(([, v]) => Array.isArray(v));

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-base border-b pb-2">{formatLabel(label)}</h3>
      {primitives.length > 0 && (
        <div className="grid grid-cols-2 gap-x-6 gap-y-1">
          {primitives.map(([k, v]) => (
            <div key={k} className="flex justify-between text-sm py-1 border-b border-dashed border-muted">
              <span className="text-muted-foreground">{formatLabel(k)}</span>
              <span className="font-medium text-right">
                {k === "rag" || k === "status" ? (
                  typeof v === "string" && ["GREEN", "AMBER", "RED"].includes(v) ? <RagBadge rag={v} /> : String(v ?? "—")
                ) : typeof v === "number" ? v.toLocaleString() : typeof v === "boolean" ? (v ? "Yes" : "No") : String(v ?? "—")}
              </span>
            </div>
          ))}
        </div>
      )}
      {dimensionEntries.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {dimensionEntries.map(([k, v]) => (
            <DimensionCard key={k} label={k} data={v as Record<string, unknown>} />
          ))}
        </div>
      )}
      {arrays.map(([k, v]) => (
        <div key={k} className="space-y-1">
          <span className="text-sm font-medium text-muted-foreground">{formatLabel(k)}</span>
          {(v as unknown[]).length === 0 ? (
            <p className="text-xs text-muted-foreground italic">None</p>
          ) : typeof (v as unknown[])[0] === "string" || typeof (v as unknown[])[0] === "number" ? (
            <div className="flex flex-wrap gap-1">
              {(v as unknown[]).map((item, i) => (
                <Badge key={i} variant="outline" className="text-xs">{String(item)}</Badge>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {(v as Record<string, unknown>[]).map((item, i) => (
                <div key={i} className="border rounded p-3 text-sm space-y-1">
                  {Object.entries(item).map(([ik, iv]) => (
                    <div key={ik} className="flex gap-2">
                      <span className="text-muted-foreground min-w-[120px]">{formatLabel(ik)}:</span>
                      <span className="text-foreground">{typeof iv === "number" ? iv.toLocaleString() : String(iv ?? "—")}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      {subSections.map(([k, v]) => (
        <DataSection key={k} label={k} data={v as Record<string, unknown>} />
      ))}
    </div>
  );
}

function AnalysisDataView({ data }: { data: Record<string, unknown> }) {
  const topPrimitives = Object.entries(data).filter(([k, v]) => !isSection(v) && !Array.isArray(v) && !SKIP_KEYS.has(k));
  const sections = Object.entries(data).filter(([k, v]) => isSection(v) && !SKIP_KEYS.has(k));
  const topArrays = Object.entries(data).filter(([k, v]) => Array.isArray(v) && !SKIP_KEYS.has(k));

  return (
    <div className="space-y-6">
      {topPrimitives.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {topPrimitives.map(([k, v]) => (
            <div key={k} className="border rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">{formatLabel(k)}</p>
              <p className="font-semibold text-sm">
                {k === "rag" && typeof v === "string" && ["GREEN", "AMBER", "RED"].includes(v) ? <RagBadge rag={v} />
                  : typeof v === "number" ? v.toLocaleString()
                  : typeof v === "boolean" ? (v ? "Yes" : "No")
                  : String(v ?? "—")}
              </p>
            </div>
          ))}
        </div>
      )}
      {sections.map(([k, v]) => (
        <DataSection key={k} label={k} data={v as Record<string, unknown>} />
      ))}
      {topArrays.map(([k, v]) => {
        const arr = v as unknown[];
        return (
          <div key={k} className="space-y-2">
            <h3 className="font-semibold text-base border-b pb-2">{formatLabel(k)}</h3>
            {arr.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">None</p>
            ) : typeof arr[0] === "string" || typeof arr[0] === "number" ? (
              <div className="flex flex-wrap gap-1">
                {arr.map((item, i) => <Badge key={i} variant="outline">{String(item)}</Badge>)}
              </div>
            ) : (
              <div className="space-y-2">
                {(arr as Record<string, unknown>[]).map((item, i) => (
                  <div key={i} className="border rounded p-3 text-sm space-y-1">
                    {Object.entries(item).map(([ik, iv]) => (
                      <div key={ik} className="flex gap-2">
                        <span className="text-muted-foreground min-w-[120px]">{formatLabel(ik)}:</span>
                        <span>{typeof iv === "number" ? iv.toLocaleString() : String(iv ?? "—")}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ExpertAnalysisDashboard({ targetCompanyId, companyName }: ExpertAnalysisDashboardProps) {
  const { toast } = useToast();
  const [selectedExpert, setSelectedExpert] = useState<ExpertResult | null>(null);

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
      toast({ title: "Deep Dive Started", description: "The expert analysis pipeline has been triggered." });
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
  const screeningScore = screening?.score;

  const hasScreeningPassed = screening?.status === "success";
  const deepDiveExperts = ["financial", "operational", "risk", "qoe", "sector", "valuation", "deal_structure", "synthesis"];
  const hasDeepDiveStarted = deepDiveExperts.some((t) => getResult(t));
  const hasRunningExperts = results.some((r) => r.status === "processing");

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Brain className="w-16 h-16 mx-auto mb-4 opacity-40" />
        <p className="text-lg font-medium mb-2">No Expert Analysis Yet</p>
        <p className="text-sm mb-1">Expert analysis will appear here once triggered by the Stage 1 pipeline.</p>
        <p className="text-xs">Upload documents and run Stage 1 Analysis to begin.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card
          className={`transition-all ${dataQuality?.status === "success" && dataQuality?.analysisData ? "cursor-pointer hover:shadow-md hover:border-primary/50" : ""}`}
          onClick={() => dataQuality?.status === "success" && dataQuality?.analysisData && setSelectedExpert(dataQuality)}
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Data Quality Score</CardTitle>
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
                  <StatusBadge status={dataQuality.status} />
                  {dataQuality.analysisData && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Confidence: {(dataQuality.analysisData as Record<string, unknown>).confidence_for_analysis as string || "—"}
                    </p>
                  )}
                </div>
                {dataQuality.status === "success" && dataQuality.analysisData && (
                  <div className="flex items-center text-xs text-primary">
                    View details <ChevronRight className="w-3 h-3 ml-1" />
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Screening Outcome</CardTitle>
          </CardHeader>
          <CardContent>
            {screening ? (
              <div className="flex items-center gap-4">
                <div className={`text-2xl font-bold capitalize ${
                  screeningOutcome === "proceed" || screeningOutcome === "strong_proceed" ? "text-green-600"
                    : screeningOutcome === "review" ? "text-amber-600" : "text-red-600"
                }`}>
                  {screeningOutcome?.replace(/_/g, " ") ?? "—"}
                </div>
                <div className="flex-1">
                  <StatusBadge status={screening.status} />
                  {screeningScore !== null && screeningScore !== undefined && (
                    <p className="text-xs text-muted-foreground mt-1">Score: {screeningScore}/100</p>
                  )}
                </div>
                {screening.status === "success" && screening.analysisData && (
                  <div className="flex items-center text-xs text-primary">
                    View details <ChevronRight className="w-3 h-3 ml-1" />
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

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Expert Analysis Engine</h3>
          <p className="text-sm text-muted-foreground">
            {hasDeepDiveStarted
              ? `${results.filter((r) => deepDiveExperts.includes(r.expertType) && r.status === "success").length}/${deepDiveExperts.length} experts completed`
              : "Run a deep dive to analyze this target across all dimensions"}
          </p>
        </div>
        <Button
          onClick={() => triggerMutation.mutate()}
          disabled={!hasScreeningPassed || triggerMutation.isPending || hasRunningExperts}
        >
          {triggerMutation.isPending || hasRunningExperts ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              Start Deep Dive Analysis
            </>
          )}
        </Button>
      </div>

      {!hasScreeningPassed && !hasDeepDiveStarted && (
        <Card className="border-dashed">
          <CardContent className="py-6 text-center text-muted-foreground">
            <p className="text-sm">Deep Dive is available once Screening passes successfully.</p>
          </CardContent>
        </Card>
      )}

      {hasDeepDiveStarted && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {deepDiveExperts.map((expertType) => {
            const result = getResult(expertType);
            const config = EXPERT_CONFIG[expertType];
            if (!config) return null;
            const Icon = config.icon;
            const status = result?.status || "pending";
            const isClickable = status === "success" && result?.analysisData;

            return (
              <Card
                key={expertType}
                className={`transition-all ${isClickable ? "cursor-pointer hover:shadow-md hover:border-primary/50" : ""} ${
                  status === "processing" ? "border-blue-400 shadow-sm" : ""
                }`}
                onClick={() => isClickable && result && setSelectedExpert(result)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={`w-5 h-5 ${config.color}`} />
                      <CardTitle className="text-sm font-medium">{config.label}</CardTitle>
                    </div>
                    <StatusBadge status={status} />
                  </div>
                  <CardDescription className="text-xs">{config.description}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  {result?.score !== null && result?.score !== undefined && (
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-muted-foreground">Score:</span>
                      <span className={`text-sm font-bold ${
                        result.score >= 70 ? "text-green-600" : result.score >= 40 ? "text-amber-600" : "text-red-600"
                      }`}>
                        {result.score}/100
                      </span>
                    </div>
                  )}
                  {result?.confidence && (
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-muted-foreground">Confidence:</span>
                      <span className="text-xs capitalize">{result.confidence}</span>
                    </div>
                  )}
                  {result?.processingTime && (
                    <p className="text-xs text-muted-foreground">
                      {(result.processingTime / 1000).toFixed(1)}s
                    </p>
                  )}
                  {isClickable && (
                    <div className="flex items-center text-xs text-primary mt-2">
                      View details <ChevronRight className="w-3 h-3 ml-1" />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!selectedExpert} onOpenChange={() => setSelectedExpert(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedExpert && EXPERT_CONFIG[selectedExpert.expertType] && (
                <>
                  {(() => { const Icon = EXPERT_CONFIG[selectedExpert.expertType].icon; return <Icon className={`w-5 h-5 ${EXPERT_CONFIG[selectedExpert.expertType].color}`} />; })()}
                  {EXPERT_CONFIG[selectedExpert.expertType].label} Analysis
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedExpert && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                {selectedExpert.score !== null && (
                  <span>Score: <strong className="text-foreground">{selectedExpert.score}/100</strong></span>
                )}
                {selectedExpert.confidence && (
                  <span>Confidence: <strong className="text-foreground capitalize">{selectedExpert.confidence}</strong></span>
                )}
                {selectedExpert.processingTime && (
                  <span>Time: <strong className="text-foreground">{(selectedExpert.processingTime / 1000).toFixed(1)}s</strong></span>
                )}
              </div>
              <div className="border rounded-lg p-4 bg-muted/30">
                <AnalysisDataView data={selectedExpert.analysisData as Record<string, unknown>} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
