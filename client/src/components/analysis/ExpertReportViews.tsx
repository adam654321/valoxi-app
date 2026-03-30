import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DollarSign,
  BarChart3,
  Shield,
  ShieldCheck,
  Layers,
  TrendingUp,
  Handshake,
  Brain,
  Target,
  Gauge,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  FileText,
  Users,
  Building,
  CircleDollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Calendar,
  ClipboardList,
  ListOrdered,
  Lock,
  type LucideIcon,
} from "lucide-react";
import ExplainButton from '@/components/analysis/ExplainButton';

function formatLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/Cagr/g, "CAGR")
    .replace(/Qoe/g, "QoE")
    .replace(/Ebitda/g, "EBITDA")
    .replace(/Roi/g, "ROI")
    .replace(/Yoy/g, "YoY")
    .replace(/Hhi/g, "HHI")
    .replace(/Nbv/g, "NBV")
    .replace(/Ev /g, "EV ")
    .replace(/Uk /g, "UK ");
}

function RagBadge({ rag, size = "sm" }: { rag: string; size?: "sm" | "lg" }) {
  const colors: Record<string, string> = {
    GREEN: "bg-green-500/10 text-green-700 dark:text-green-400 ring-1 ring-green-500/20",
    AMBER: "bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-1 ring-amber-500/20",
    RED: "bg-red-500/10 text-red-700 dark:text-red-400 ring-1 ring-red-500/20",
  };
  const sizing = size === "lg" ? "px-4 py-1.5 text-sm" : "px-2.5 py-0.5 text-xs";
  return (
    <span className={`inline-flex items-center rounded-full font-bold tracking-wide ${colors[rag] || "bg-muted text-muted-foreground"} ${sizing}`}>
      {rag}
    </span>
  );
}

function ScoreRing({ score, size = "md" }: { score: number; size?: "sm" | "md" | "lg" }) {
  const pct = Math.min((score / 100) * 100, 100);
  const color = pct >= 70 ? "text-green-500" : pct >= 40 ? "text-amber-500" : "text-red-500";
  const bgColor = pct >= 70 ? "text-green-500/15" : pct >= 40 ? "text-amber-500/15" : "text-red-500/15";
  const dims = size === "lg" ? { s: 80, sw: 6, r: 34, fs: "text-xl" } : size === "md" ? { s: 56, sw: 4, r: 23, fs: "text-base" } : { s: 40, sw: 3, r: 16, fs: "text-xs" };
  const circumference = 2 * Math.PI * dims.r;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={dims.s} height={dims.s} className="transform -rotate-90">
        <circle cx={dims.s / 2} cy={dims.s / 2} r={dims.r} fill="none" strokeWidth={dims.sw} className={`stroke-current ${bgColor}`} />
        <circle cx={dims.s / 2} cy={dims.s / 2} r={dims.r} fill="none" strokeWidth={dims.sw} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} className={`stroke-current ${color} transition-all duration-500`} />
      </svg>
      <span className={`absolute font-bold ${dims.fs} ${color}`}>{score}</span>
    </div>
  );
}

function ScoreBar({ score, label }: { score: number; label?: string }) {
  const pct = Math.min((score / 100) * 100, 100);
  const color = pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500";
  const bgColor = pct >= 70 ? "bg-green-500/10" : pct >= 40 ? "bg-amber-500/10" : "bg-red-500/10";
  return (
    <div className="space-y-1">
      {label && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-semibold">{score}/100</span>
        </div>
      )}
      <div className={`h-2 rounded-full overflow-hidden ${bgColor}`}>
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SectionCard({ icon: Icon, title, children, accent }: { icon: LucideIcon; title: string; children: React.ReactNode; accent?: string }) {
  const accentColor = accent || "border-l-blue-500";
  return (
    <div className={`border rounded-lg overflow-hidden border-l-4 ${accentColor}`}>
      <div className="flex items-center gap-2.5 px-4 py-3 bg-muted/40">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <h3 className="font-semibold text-sm tracking-tight">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function MetricCard({ label, value, subtext, color }: { label: string; value: React.ReactNode; subtext?: string; color?: string }) {
  return (
    <div className="border rounded-xl p-4 bg-gradient-to-br from-background to-muted/30 text-center space-y-1">
      <p className="text-xs text-muted-foreground font-medium tracking-wide uppercase">{label}</p>
      <p className={`text-2xl font-bold tracking-tight ${color || ""}`}>{value}</p>
      {subtext && <p className="text-xs text-muted-foreground">{subtext}</p>}
    </div>
  );
}

function KeyValueGrid({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-0">
      {items.map(({ label, value }, i) => (
        <div key={i} className="flex justify-between items-center py-2 border-b border-dashed border-muted/60 last:border-0 text-sm">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-medium text-right">{value}</span>
        </div>
      ))}
    </div>
  );
}

function formatCurrency(val: number | null | undefined): string {
  if (val === null || val === undefined) return "—";
  if (Math.abs(val) >= 1_000_000) return `£${(val / 1_000_000).toFixed(2)}m`;
  if (Math.abs(val) >= 1_000) return `£${(val / 1_000).toFixed(0)}k`;
  return `£${val.toLocaleString()}`;
}

function formatPercent(val: number | null | undefined): string {
  if (val === null || val === undefined) return "—";
  return `${val.toFixed(1)}%`;
}

function formatNumber(val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "number") return val.toLocaleString();
  return String(val);
}

function colorForValue(val: number | null | undefined): string {
  if (val === null || val === undefined) return "";
  return val > 0 ? "text-green-600 dark:text-green-400" : val < 0 ? "text-red-600 dark:text-red-400" : "";
}

function TrendIcon({ val }: { val: number | null | undefined }) {
  if (val === null || val === undefined) return null;
  if (val > 0) return <ArrowUpRight className="w-3.5 h-3.5 text-green-500 inline" />;
  if (val < 0) return <ArrowDownRight className="w-3.5 h-3.5 text-red-500 inline" />;
  return <Minus className="w-3.5 h-3.5 text-muted-foreground inline" />;
}

function RiskLevelBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    low: "bg-green-500/10 text-green-700 dark:text-green-400 ring-1 ring-green-500/20",
    moderate: "bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-1 ring-amber-500/20",
    high: "bg-red-500/10 text-red-700 dark:text-red-400 ring-1 ring-red-500/20",
    critical: "bg-red-600/15 text-red-800 dark:text-red-300 ring-1 ring-red-600/30",
  };
  return <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold capitalize tracking-wide ${colors[level] || "bg-muted text-muted-foreground"}`}>{level}</span>;
}

function BulletList({ items, variant }: { items: string[]; variant?: "strength" | "concern" | "info" | "question" }) {
  if (!items || items.length === 0) return <p className="text-sm text-muted-foreground italic">None identified</p>;
  const styles = {
    strength: { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/5", border: "border-green-500/10" },
    concern: { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/5", border: "border-amber-500/10" },
    info: { icon: Info, color: "text-blue-500", bg: "bg-blue-500/5", border: "border-blue-500/10" },
    question: { icon: FileText, color: "text-purple-500", bg: "bg-purple-500/5", border: "border-purple-500/10" },
  };
  const s = styles[variant || "info"];
  const Icon = s.icon;
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className={`flex gap-3 p-3 rounded-lg border ${s.bg} ${s.border}`}>
          <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${s.color}`} />
          <span className="text-sm leading-relaxed">{item}</span>
        </div>
      ))}
    </div>
  );
}

function NarrativeBlock({ text }: { text: string | undefined | null }) {
  if (!text) return null;
  return (
    <div className="bg-muted/30 rounded-lg p-4 border border-dashed">
      <p className="text-sm leading-relaxed whitespace-pre-wrap">{text}</p>
    </div>
  );
}

export function DataQualityReportView({ data }: { data: Record<string, unknown> }) {
  const d = data as any;
  const sources = d.data_sources || {};
  const checks = d.consistency_checks || {};

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="border rounded-xl p-5 text-center bg-gradient-to-br from-background to-muted/30">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-3">Completeness</p>
          <ScoreRing score={d.overall_completeness_score || 0} size="lg" />
        </div>
        <MetricCard label="Rating" value={<span className="capitalize">{d.overall_completeness_rating ?? "—"}</span>} />
        <MetricCard label="Confidence" value={<span className="capitalize">{d.confidence_for_analysis ?? "—"}</span>} />
      </div>

      <SectionCard icon={BarChart3} title="Data Sources" accent="border-l-blue-500">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(sources).map(([key, src]: [string, any]) => {
            const isComplete = src.status === "complete";
            return (
              <div key={key} className={`rounded-lg p-4 space-y-3 border ${isComplete ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5 border-red-500/20"}`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">{formatLabel(key)}</span>
                  <Badge className={`${isComplete ? "bg-green-600" : "bg-red-600"} text-white`}>
                    {isComplete ? "Complete" : src.status}
                  </Badge>
                </div>
                {src.years_available !== undefined && src.years_available > 0 && (
                  <p className="text-xs text-muted-foreground">{src.years_available} years available</p>
                )}
                {src.key_fields_populated?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {src.key_fields_populated.map((f: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-[10px] bg-green-500/5">{formatLabel(f)}</Badge>
                    ))}
                  </div>
                )}
                {src.key_fields_missing?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {src.key_fields_missing.map((f: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-[10px] bg-red-500/5 border-red-500/20 text-red-700 dark:text-red-400">{formatLabel(f)}</Badge>
                    ))}
                  </div>
                )}
                {src.headcount_reported !== undefined && <p className="text-xs">Headcount: <strong>{src.headcount_reported}</strong></p>}
                {src.asset_count !== undefined && <p className="text-xs">Assets: <strong>{src.asset_count}</strong></p>}
                {src.customer_count !== undefined && <p className="text-xs">Customers: <strong>{src.customer_count}</strong></p>}
              </div>
            );
          })}
        </div>
      </SectionCard>

      {Object.keys(checks).length > 0 && (
        <SectionCard icon={ShieldCheck} title="Consistency Checks" accent="border-l-purple-500">
          <div className="space-y-1">
            {Object.entries(checks).map(([key, check]: [string, any]) => {
              const isOk = check.result === "consistent";
              const isMajor = check.result === "major_discrepancy";
              return (
                <div key={key} className={`flex items-center justify-between py-2.5 px-3 rounded-lg ${isMajor ? "bg-red-500/5" : isOk ? "bg-green-500/5" : "bg-amber-500/5"}`}>
                  <span className="text-sm font-medium">{formatLabel(key)}</span>
                  <div className="flex items-center gap-3">
                    {check.variance_percent !== null && check.variance_percent !== undefined && (
                      <span className={`text-xs font-mono ${isMajor ? "text-red-600" : "text-muted-foreground"}`}>{check.variance_percent}%</span>
                    )}
                    <Badge className={`${isOk ? "bg-green-600" : isMajor ? "bg-red-600" : "bg-amber-600"} text-white text-xs`}>
                      {check.result?.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {d.red_flags?.length > 0 && (
        <SectionCard icon={AlertTriangle} title="Red Flags" accent="border-l-red-500">
          <BulletList items={d.red_flags} variant="concern" />
        </SectionCard>
      )}

      {d.gaps_requiring_seller_action?.length > 0 && (
        <SectionCard icon={FileText} title="Gaps Requiring Seller Action" accent="border-l-amber-500">
          <BulletList items={d.gaps_requiring_seller_action} variant="question" />
        </SectionCard>
      )}

      {d.analysis_limitations?.length > 0 && (
        <SectionCard icon={Info} title="Analysis Limitations" accent="border-l-slate-500">
          <BulletList items={d.analysis_limitations} variant="info" />
        </SectionCard>
      )}
    </div>
  );
}

export function ScreeningReportView({ data }: { data: Record<string, unknown> }) {
  const d = data as any;
  const dims = d.dimensions || {};
  const recommendation = d.recommendation || d.overall_recommendation;
  const isProceed = recommendation === "PROCEED" || recommendation === "STRONG_PROCEED";
  const isReview = recommendation === "REVIEW";

  const dimensionOrder = ["earnings_trajectory", "balance_sheet_health", "cash_reality", "customer_risk", "asset_quality", "people_capability"];
  const dimensionEntries = dimensionOrder
    .filter((key) => dims[key])
    .map((key) => ({ key, ...dims[key] }));
  const extraDimensions = Object.keys(dims)
    .filter((key) => !dimensionOrder.includes(key))
    .map((key) => ({ key, ...dims[key] }));
  const allDimensions = [...dimensionEntries, ...extraDimensions];

  function truncate(text: string, max: number): string {
    if (!text || text.length <= max) return text || "";
    return text.slice(0, max).trimEnd() + "…";
  }

  return (
    <div className="space-y-6">
      <div className={`rounded-xl p-6 border-2 ${isProceed ? "bg-green-500/5 border-green-500/30" : isReview ? "bg-amber-500/5 border-amber-500/30" : "bg-red-500/5 border-red-500/30"}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">Recommendation</p>
            <Badge className={`text-lg px-4 py-1.5 font-bold tracking-wide ${
              isProceed ? "bg-green-600 hover:bg-green-700" : isReview ? "bg-amber-600 hover:bg-amber-700" : "bg-red-600 hover:bg-red-700"
            } text-white`}>
              {recommendation?.replace(/_/g, " ") || "—"}
            </Badge>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">Overall Score</p>
            <ScoreRing score={d.overall_score ?? 0} size="lg" />
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">Data Quality</p>
            <ScoreRing score={d.data_quality_score ?? 0} size="md" />
          </div>
        </div>
      </div>

      {(d.recommendation_justification || d.executive_summary) && (
        <div className="space-y-3">
          {d.recommendation_justification && (
            <div className="bg-muted/30 rounded-lg p-4 border border-dashed">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{d.recommendation_justification}</p>
            </div>
          )}
          {d.executive_summary && d.executive_summary !== d.recommendation_justification && (
            <SectionCard icon={Brain} title="Executive Summary" accent="border-l-indigo-500">
              <NarrativeBlock text={d.executive_summary} />
            </SectionCard>
          )}
        </div>
      )}

      {d.comparable_context && (
        <div className="border rounded-lg overflow-hidden">
          <div className="flex items-center gap-2.5 px-4 py-3 bg-muted/40">
            <Building className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm tracking-tight">Sector Context</h3>
          </div>
          <div className="p-4">
            <p className="text-sm leading-relaxed italic text-muted-foreground whitespace-pre-wrap">{d.comparable_context}</p>
          </div>
        </div>
      )}

      {allDimensions.length > 0 && (
        <SectionCard icon={Target} title="Dimension Breakdown" accent="border-l-blue-500">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {allDimensions.map((dim: any) => {
              const ragBg = dim.rag === "GREEN"
                ? "bg-green-500/5 border-green-500/30"
                : dim.rag === "AMBER"
                  ? "bg-amber-500/5 border-amber-500/30"
                  : dim.rag === "RED"
                    ? "bg-red-500/5 border-red-500/30"
                    : "bg-muted/30 border-muted";
              const ragDot = dim.rag === "GREEN"
                ? "bg-green-500"
                : dim.rag === "AMBER"
                  ? "bg-amber-500"
                  : dim.rag === "RED"
                    ? "bg-red-500"
                    : "bg-muted-foreground";
              const scoreColor = (dim.score ?? 0) >= 70
                ? "text-green-600"
                : (dim.score ?? 0) >= 40
                  ? "text-amber-600"
                  : "text-red-600";

              return (
                <div key={dim.key} className={`border rounded-lg p-4 space-y-2 ${ragBg}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${ragDot}`} />
                      <h4 className="font-semibold text-sm">{formatLabel(dim.key)}</h4>
                    </div>
                    <span className={`text-sm font-bold ${scoreColor}`}>{dim.score ?? "—"}/100</span>
                  </div>
                  {dim.explanation && (
                    <p className="text-xs text-muted-foreground leading-relaxed">{dim.explanation}</p>
                  )}
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {d.key_strengths?.length > 0 && (
        <SectionCard icon={CheckCircle2} title="Key Strengths" accent="border-l-green-500">
          <BulletList items={d.key_strengths} variant="strength" />
        </SectionCard>
      )}

      {d.key_concerns?.length > 0 && (
        <SectionCard icon={AlertTriangle} title="Key Concerns" accent="border-l-amber-500">
          <BulletList items={d.key_concerns} variant="concern" />
        </SectionCard>
      )}

      {d.questions_for_seller?.length > 0 && (
        <div className="border rounded-lg overflow-hidden bg-blue-500/5 border-blue-500/20">
          <div className="flex items-center gap-2.5 px-4 py-3 bg-blue-500/10 border-b border-blue-500/20">
            <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h3 className="font-semibold text-sm tracking-tight text-blue-700 dark:text-blue-300">Questions to Ask the Seller</h3>
          </div>
          <div className="p-4">
            <ol className="space-y-2">
              {d.questions_for_seller.map((q: string, i: number) => (
                <li key={i} className="flex gap-3 p-3 rounded-lg border border-blue-500/10 bg-background/60">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500/20 text-blue-700 dark:text-blue-400 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                  <span className="text-sm leading-relaxed">{q}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

export function FinancialReportView({ data }: { data: Record<string, unknown> }) {
  const d = data as any;
  const yearlyMetrics = d.yearly_metrics || {};
  const years = Object.keys(yearlyMetrics).sort();
  const cagr = d.cagr || {};
  const costStructure = d.cost_structure || {};
  const earningsQuality = d.earnings_quality || {};
  const debtService = d.debt_service || {};
  const topOverheads = costStructure.top_5_overheads || costStructure.top_overheads || [];

  const latestYear = years[years.length - 1];
  const latestData = yearlyMetrics[latestYear] || {};

  const cagrFields = [
    { key: "revenue_cagr", label: "Revenue CAGR" },
    { key: "gross_profit_cagr", label: "Gross Profit CAGR" },
    { key: "operating_profit_cagr", label: "Operating Profit CAGR" },
  ];

  return (
    <div className="space-y-6">
      {latestYear && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard label="Revenue" value={formatCurrency(latestData.revenue)} subtext={latestYear} color={colorForValue(latestData.revenue)} />
          <div className="relative">
            <MetricCard label="Gross Margin" value={formatPercent(latestData.gross_margin_percent)} subtext={latestYear} />
            <div className="absolute top-2 right-2">
              <ExplainButton
                metricKey="Gross Margin %"
                metricValue={formatPercent(latestData.gross_margin_percent)}
                context={{ companyName: d.company_name || 'This company', sector: d.sector || 'Unknown', revenue: latestData.revenue }}
              />
            </div>
          </div>
          <MetricCard label="EBITDA" value={formatCurrency(latestData.ebitda)} subtext={latestYear} color={colorForValue(latestData.ebitda)} />
          <MetricCard label="Net Margin" value={formatPercent(latestData.net_margin_percent)} subtext={latestYear} />
        </div>
      )}

      {d.narrative && (
        <SectionCard icon={Brain} title="Narrative" accent="border-l-indigo-500">
          <NarrativeBlock text={d.narrative} />
        </SectionCard>
      )}

      {d.key_findings?.length > 0 && (
        <SectionCard icon={CheckCircle2} title="Key Findings" accent="border-l-green-500">
          <BulletList items={d.key_findings} variant="strength" />
        </SectionCard>
      )}

      {d.red_flags?.length > 0 && (
        <div className="border rounded-lg overflow-hidden bg-red-500/5 border-red-500/20">
          <div className="flex items-center gap-2.5 px-4 py-3 bg-red-500/10 border-b border-red-500/20">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
            <h3 className="font-semibold text-sm tracking-tight text-red-700 dark:text-red-300">Red Flags</h3>
          </div>
          <div className="p-4">
            <BulletList items={d.red_flags.map((f: any) => typeof f === "string" ? f : f.description || f.flag || String(f))} variant="concern" />
          </div>
        </div>
      )}

      {years.length > 0 && (
        <SectionCard icon={DollarSign} title="Profit & Loss Summary" accent="border-l-emerald-500">
          <div className="overflow-x-auto -mx-4 px-4">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="sticky left-0 bg-muted/30 font-bold">Year</TableHead>
                  <TableHead className="text-right font-bold">Revenue</TableHead>
                  <TableHead className="text-right font-bold">Gross Profit</TableHead>
                  <TableHead className="text-right font-bold">Gross %</TableHead>
                  <TableHead className="text-right font-bold">Op. Profit</TableHead>
                  <TableHead className="text-right font-bold">Op. %</TableHead>
                  {years.some((y) => yearlyMetrics[y]?.ebitda != null) && (
                    <TableHead className="text-right font-bold">EBITDA</TableHead>
                  )}
                  <TableHead className="text-right font-bold">Net Profit</TableHead>
                  <TableHead className="text-right font-bold">Net %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {years.map((y, idx) => {
                  const m = yearlyMetrics[y] || {};
                  const hasEbitda = years.some((yr) => yearlyMetrics[yr]?.ebitda != null);
                  return (
                    <TableRow key={y} className={idx % 2 === 0 ? "bg-muted/10" : ""}>
                      <TableCell className="sticky left-0 bg-inherit font-bold text-sm">{y}</TableCell>
                      <TableCell className="text-right text-sm font-mono">{formatCurrency(m.revenue)}</TableCell>
                      <TableCell className="text-right text-sm font-mono">{formatCurrency(m.gross_profit)}</TableCell>
                      <TableCell className="text-right text-sm font-mono">{formatPercent(m.gross_margin_percent)}</TableCell>
                      <TableCell className="text-right text-sm font-mono">{formatCurrency(m.operating_profit)}</TableCell>
                      <TableCell className="text-right text-sm font-mono">{formatPercent(m.operating_margin_percent)}</TableCell>
                      {hasEbitda && <TableCell className="text-right text-sm font-mono">{formatCurrency(m.ebitda)}</TableCell>}
                      <TableCell className={`text-right text-sm font-mono ${colorForValue(m.net_profit)}`}>{formatCurrency(m.net_profit)}</TableCell>
                      <TableCell className="text-right text-sm font-mono">{formatPercent(m.net_margin_percent)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </SectionCard>
      )}

      <SectionCard icon={TrendingUp} title="Growth Rates (CAGR)" accent="border-l-teal-500">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {cagrFields.map(({ key, label }) => {
            const val = cagr[key] ?? cagr[key.replace("_cagr", "")] ?? null;
            return (
              <div key={key} className="border rounded-xl p-4 text-center bg-gradient-to-br from-background to-muted/30">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
                {val != null && typeof val === "number" ? (
                  <p className={`text-xl font-bold ${colorForValue(val)}`}>
                    {formatPercent(val)} <TrendIcon val={val} />
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Insufficient data</p>
                )}
              </div>
            );
          })}
          {Object.entries(cagr)
            .filter(([k]) => !cagrFields.some((f) => f.key === k || f.key.replace("_cagr", "") === k))
            .map(([key, val]: [string, any]) => (
              <div key={key} className="border rounded-xl p-4 text-center bg-gradient-to-br from-background to-muted/30">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{formatLabel(key)}</p>
                {typeof val === "number" ? (
                  <p className={`text-xl font-bold ${colorForValue(val)}`}>
                    {formatPercent(val)} <TrendIcon val={val} />
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Insufficient data</p>
                )}
              </div>
            ))}
        </div>
      </SectionCard>

      {(costStructure.cost_of_sales_percent_revenue != null || costStructure.overheads_percent_revenue != null || costStructure.staff_costs_percent_revenue != null) && (
        <SectionCard icon={BarChart3} title="Cost Structure" accent="border-l-blue-500">
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { key: "cost_of_sales_percent_revenue", label: "Cost of Sales" },
              { key: "overheads_percent_revenue", label: "Overheads" },
              { key: "staff_costs_percent_revenue", label: "Staff Costs" },
            ].filter(({ key }) => costStructure[key] != null).map(({ key, label }) => (
              <div key={key} className="border rounded-xl p-4 text-center bg-gradient-to-br from-background to-muted/30">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
                <p className="text-xl font-bold">{formatPercent(costStructure[key])}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">% of Revenue</p>
              </div>
            ))}
          </div>
          {topOverheads.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2 font-medium">Top Overheads</p>
              <Table>
                <TableBody>
                  {topOverheads.map((item: any, i: number) => (
                    <TableRow key={i} className={i % 2 === 0 ? "bg-muted/10" : ""}>
                      <TableCell className="text-sm font-medium">{typeof item === "string" ? item : item.name || item.item || item.category || String(item)}</TableCell>
                      {typeof item === "object" && (item.amount != null || item.value != null) && (
                        <TableCell className="text-right text-sm font-mono">{formatCurrency(item.amount ?? item.value)}</TableCell>
                      )}
                      {typeof item === "object" && (item.percent != null || item.percent_of_overheads != null) && (
                        <TableCell className="text-right text-sm font-mono text-muted-foreground">{formatPercent(item.percent ?? item.percent_of_overheads)}</TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </SectionCard>
      )}

      {Object.keys(earningsQuality).length > 0 && (
        <SectionCard icon={ShieldCheck} title="Earnings Quality" accent="border-l-amber-500">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-4">
              {earningsQuality.net_profit_tracks_operating_profit != null && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Net Profit Tracks Operating Profit:</span>
                  <Badge className={earningsQuality.net_profit_tracks_operating_profit ? "bg-green-600 text-white" : "bg-red-600 text-white"}>
                    {earningsQuality.net_profit_tracks_operating_profit ? "Yes" : "No"}
                  </Badge>
                </div>
              )}
              {earningsQuality.tax_rate_consistent != null && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Tax Rate Consistent:</span>
                  <Badge className={earningsQuality.tax_rate_consistent ? "bg-green-600 text-white" : "bg-amber-600 text-white"}>
                    {earningsQuality.tax_rate_consistent ? "Yes" : "No"}
                  </Badge>
                </div>
              )}
            </div>
            {earningsQuality.exceptional_items_identified?.length > 0 && (
              <div className="border-l-4 border-l-amber-500 bg-amber-500/5 rounded-r-lg p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2 font-medium">Exceptional Items</p>
                <ul className="space-y-1">
                  {earningsQuality.exceptional_items_identified.map((item: any, i: number) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                      <span>{typeof item === "string" ? item : item.description || String(item)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {earningsQuality.limitations?.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1 font-medium">Limitations</p>
                <ul className="space-y-0.5">
                  {earningsQuality.limitations.map((lim: any, i: number) => (
                    <li key={i} className="text-xs text-muted-foreground leading-relaxed">• {typeof lim === "string" ? lim : String(lim)}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {(debtService.latest_interest_coverage != null || debtService.interest_coverage_trend || debtService.additional_debt_capacity_assessment) && (
        <SectionCard icon={Shield} title="Debt Service Capacity" accent="border-l-red-500">
          <div className="space-y-4">
            <div className="flex items-center gap-6">
              {debtService.latest_interest_coverage != null && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Interest Coverage</p>
                  <p className={`text-3xl font-bold ${(debtService.latest_interest_coverage ?? 0) >= 3 ? "text-green-600" : (debtService.latest_interest_coverage ?? 0) >= 1.5 ? "text-amber-600" : "text-red-600"}`}>
                    {typeof debtService.latest_interest_coverage === "number" ? debtService.latest_interest_coverage.toFixed(1) : "—"}x
                  </p>
                </div>
              )}
              {debtService.interest_coverage_trend && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Trend</p>
                  <Badge variant="outline" className={`capitalize font-medium ${
                    debtService.interest_coverage_trend === "improving" ? "border-green-500 text-green-600" :
                    debtService.interest_coverage_trend === "declining" ? "border-red-500 text-red-600" :
                    "border-muted-foreground"
                  }`}>{debtService.interest_coverage_trend}</Badge>
                </div>
              )}
            </div>
            {debtService.additional_debt_capacity_assessment && (
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{debtService.additional_debt_capacity_assessment}</p>
            )}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

export function OperationalReportView({ data }: { data: Record<string, unknown> }) {
  const d = data as any;
  const wc = d.working_capital || {};
  const wcMetrics = wc.yearly_metrics || {};
  const wcYears = Object.keys(wcMetrics).sort();
  const latestWcYear = wcYears[wcYears.length - 1];
  const latestWc = latestWcYear ? wcMetrics[latestWcYear] || {} : wc;
  const capex = d.capex || {};
  const workforce = d.workforce || {};
  const ownerDep = d.owner_dependency || {};
  const scalability = d.scalability || {};
  const processMat = d.process_maturity || {};
  const systemsAssessment = d.systems_assessment || d.technology || {};
  const scalabilityConstraints = scalability.constraints || d.scalability_constraints || [];
  const scalabilityOpportunities = scalability.opportunities || d.scalability_opportunities || [];

  function debtorDaysColor(v: number | null): string {
    if (v == null) return "";
    if (v > 90) return "text-red-600";
    if (v > 60) return "text-amber-600";
    return "";
  }
  function creditorDaysColor(v: number | null): string {
    if (v == null) return "";
    if (v > 120) return "text-red-600";
    if (v > 90) return "text-amber-600";
    return "";
  }
  function cashCycleColor(v: number | null): string {
    if (v == null) return "";
    if (v < 0) return "text-green-600";
    if (v > 60) return "text-red-600";
    return "text-amber-600";
  }

  const maturityColors: Record<string, string> = {
    "ad hoc": "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30",
    "basic": "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
    "defined": "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30",
    "optimised": "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    "optimized": "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  };

  return (
    <div className="space-y-6">
      {d.narrative && (
        <SectionCard icon={Brain} title="Narrative" accent="border-l-indigo-500">
          <NarrativeBlock text={d.narrative} />
        </SectionCard>
      )}

      {d.key_findings?.length > 0 && (
        <SectionCard icon={CheckCircle2} title="Key Findings" accent="border-l-green-500">
          <BulletList items={d.key_findings} variant="strength" />
        </SectionCard>
      )}

      {d.red_flags?.length > 0 && (
        <div className="border rounded-lg overflow-hidden bg-red-500/5 border-red-500/20">
          <div className="flex items-center gap-2.5 px-4 py-3 bg-red-500/10 border-b border-red-500/20">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
            <h3 className="font-semibold text-sm tracking-tight text-red-700 dark:text-red-300">Red Flags</h3>
          </div>
          <div className="p-4">
            <BulletList items={d.red_flags.map((f: any) => typeof f === "string" ? f : f.description || f.flag || String(f))} variant="concern" />
          </div>
        </div>
      )}

      <SectionCard icon={BarChart3} title="Working Capital" accent="border-l-blue-500">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { key: "debtor_days", label: "Debtor Days", colorFn: debtorDaysColor },
            { key: "creditor_days", label: "Creditor Days", colorFn: creditorDaysColor },
            { key: "stock_days", label: "Stock Days", colorFn: () => "" },
            { key: "cash_conversion_cycle_days", label: "Cash Conversion Cycle", colorFn: cashCycleColor },
          ].map(({ key, label, colorFn }) => {
            const val = latestWc[key] ?? wc[key] ?? null;
            return (
              <div key={key} className="border rounded-xl p-4 text-center bg-gradient-to-br from-background to-muted/30">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
                <p className={`text-2xl font-bold ${colorFn(val)}`}>
                  {val != null ? `${Math.round(val)}` : "—"}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">days</p>
              </div>
            );
          })}
        </div>
        {(wc.trend || wc.working_capital_intensity) && (
          <div className="flex items-center gap-4 mt-3">
            {wc.trend && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Trend:</span>
                <Badge variant="outline" className="capitalize font-medium">{wc.trend}</Badge>
              </div>
            )}
            {wc.working_capital_intensity && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Intensity:</span>
                <Badge variant="outline" className="capitalize font-medium">{wc.working_capital_intensity}</Badge>
              </div>
            )}
          </div>
        )}
        {wc.observations?.length > 0 && <div className="mt-3"><BulletList items={wc.observations} variant="info" /></div>}
      </SectionCard>

      {(workforce.revenue_per_employee != null || workforce.headcount != null || workforce.employee_count != null) && (
        <SectionCard icon={Users} title="Staff Productivity" accent="border-l-purple-500">
          <div className="flex items-center gap-6">
            {(workforce.revenue_per_employee != null) && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Revenue per Employee</p>
                <p className="text-3xl font-bold">{formatCurrency(workforce.revenue_per_employee)}</p>
              </div>
            )}
            {(workforce.headcount ?? workforce.employee_count) != null && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Headcount</p>
                <p className="text-2xl font-bold">{workforce.headcount ?? workforce.employee_count}</p>
              </div>
            )}
          </div>
          {workforce.key_person_dependencies && (
            <p className="text-sm text-muted-foreground mt-3 italic">{workforce.key_person_dependencies}</p>
          )}
          {workforce.observations?.length > 0 && <div className="mt-3"><BulletList items={workforce.observations} variant="info" /></div>}
        </SectionCard>
      )}

      {Object.keys(processMat).length > 0 && (
        <SectionCard icon={Gauge} title="Process Maturity" accent="border-l-teal-500">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(processMat).map(([area, rating]: [string, any]) => {
              const ratingStr = String(rating ?? "").toLowerCase();
              const colorCls = maturityColors[ratingStr] || "bg-muted/30 border-muted";
              return (
                <div key={area} className={`border rounded-lg p-3 text-center ${colorCls}`}>
                  <p className="text-xs uppercase tracking-wide mb-1 font-medium">{formatLabel(area)}</p>
                  <Badge variant="outline" className="capitalize font-medium">{String(rating ?? "—")}</Badge>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {Object.keys(systemsAssessment).length > 0 && (
        <SectionCard icon={Layers} title="Systems & Technology" accent="border-l-blue-500">
          {Array.isArray(systemsAssessment) ? (
            <ul className="space-y-2">
              {systemsAssessment.map((sys: any, i: number) => (
                <li key={i} className="flex items-center justify-between p-3 rounded-lg border bg-muted/10">
                  <span className="text-sm font-medium">{typeof sys === "string" ? sys : sys.name || sys.system || String(sys)}</span>
                  {typeof sys === "object" && sys.fit_for_purpose != null && (
                    <Badge className={sys.fit_for_purpose ? "bg-green-600 text-white" : "bg-red-600 text-white"}>
                      {sys.fit_for_purpose ? "Fit" : "Not Fit"}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <ul className="space-y-2">
              {Object.entries(systemsAssessment).filter(([k]) => k !== "observations").map(([k, v]: [string, any]) => (
                <li key={k} className="flex items-center justify-between p-3 rounded-lg border bg-muted/10">
                  <span className="text-sm font-medium">{formatLabel(k)}</span>
                  {typeof v === "boolean" ? (
                    <Badge className={v ? "bg-green-600 text-white" : "bg-red-600 text-white"}>{v ? "Fit" : "Not Fit"}</Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">{String(v ?? "—")}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      )}

      {(scalabilityConstraints.length > 0 || scalabilityOpportunities.length > 0) && (
        <SectionCard icon={TrendingUp} title="Scalability" accent="border-l-green-500">
          <div className="space-y-4">
            {scalabilityOpportunities.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2 font-medium">Opportunities</p>
                <ul className="space-y-1">
                  {scalabilityOpportunities.map((item: string, i: number) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <ArrowUpRight className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>{typeof item === "string" ? item : String(item)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {scalabilityConstraints.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2 font-medium">Constraints</p>
                <ul className="space-y-1">
                  {scalabilityConstraints.map((item: string, i: number) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                      <span>{typeof item === "string" ? item : String(item)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {Object.keys(capex).length > 0 && (
        <SectionCard icon={TrendingUp} title="Capital Expenditure" accent="border-l-teal-500">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { k: "total_gross_asset_value", l: "Gross Asset Value" },
              { k: "total_nbv", l: "Net Book Value" },
              { k: "asset_freshness_percent", l: "Asset Freshness" },
              { k: "recent_additions_24m_value", l: "Recent Additions (24m)" },
              { k: "recent_additions_percent", l: "Recent Additions %" },
              { k: "estimated_annual_maintenance_capex", l: "Est. Annual Maint." },
            ].filter(({ k }) => capex[k] !== undefined && capex[k] !== null).map(({ k, l }) => (
              <MetricCard key={k} label={l} value={k.includes("percent") || k.includes("freshness") ? formatPercent(capex[k]) : formatCurrency(capex[k])} />
            ))}
          </div>
          {capex.observations?.length > 0 && <div className="mt-4"><BulletList items={capex.observations} variant="info" /></div>}
        </SectionCard>
      )}

      {Object.keys(ownerDep).length > 0 && (
        <SectionCard icon={Shield} title="Owner Dependency" accent="border-l-amber-500">
          <KeyValueGrid items={Object.entries(ownerDep).filter(([k]) => k !== "observations").map(([k, v]) => ({
            label: formatLabel(k),
            value: typeof v === "boolean" ? (v ? "Yes" : "No") : typeof v === "number" ? (k.includes("percent") ? formatPercent(v as number) : formatCurrency(v as number)) : String(v ?? "—"),
          }))} />
          {ownerDep.observations?.length > 0 && <div className="mt-4"><BulletList items={ownerDep.observations} variant="info" /></div>}
        </SectionCard>
      )}
    </div>
  );
}

export function RiskReportView({ data }: { data: Record<string, unknown> }) {
  const d = data as any;
  const custConc = d.customer_concentration || {};
  const keyPerson = d.key_person_risk || d.key_person_dependency || {};
  const regulatory = d.regulatory_risks || [];
  const complianceStatus = d.compliance_status || d.compliance || null;
  const riskRegister = d.risk_register || d.risks || [];

  const riskSections = [
    { key: "customer_concentration", label: "Customer Concentration", icon: Target, accent: "border-l-amber-500" },
    { key: "financial_risk", label: "Financial Risk", icon: DollarSign, accent: "border-l-red-500" },
    { key: "key_person_risk", label: "Key Person Risk", icon: Users, accent: "border-l-purple-500" },
    { key: "revenue_quality", label: "Revenue Quality", icon: TrendingUp, accent: "border-l-teal-500" },
    { key: "balance_sheet_risks", label: "Balance Sheet Risks", icon: BarChart3, accent: "border-l-blue-500" },
    { key: "bad_debt", label: "Bad Debt Risk", icon: AlertTriangle, accent: "border-l-orange-500" },
  ];

  function hmlColor(level: string | null): string {
    if (!level) return "";
    const l = String(level).toLowerCase();
    if (l === "high" || l === "h") return "bg-red-600 text-white";
    if (l === "medium" || l === "m") return "bg-amber-600 text-white";
    if (l === "low" || l === "l") return "bg-green-600 text-white";
    return "";
  }

  function concColor(pct: number | null): string {
    if (pct == null) return "";
    if (pct > 40) return "text-red-600";
    if (pct > 25) return "text-amber-600";
    return "text-green-600";
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {riskSections.map(({ key, label }) => {
          const section = d[key];
          if (!section?.risk_level) return null;
          return (
            <div key={key} className="border rounded-xl p-4 text-center bg-gradient-to-br from-background to-muted/30 space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
              <RiskLevelBadge level={section.risk_level} />
            </div>
          );
        })}
      </div>

      {d.narrative && (
        <SectionCard icon={Brain} title="Narrative" accent="border-l-indigo-500">
          <NarrativeBlock text={d.narrative} />
        </SectionCard>
      )}

      {d.key_findings?.length > 0 && (
        <SectionCard icon={CheckCircle2} title="Key Findings" accent="border-l-green-500">
          <BulletList items={d.key_findings} variant="strength" />
        </SectionCard>
      )}

      {d.deal_breakers?.length > 0 && (
        <div className="border-2 rounded-lg overflow-hidden bg-red-500/10 border-red-600/40">
          <div className="flex items-center gap-2.5 px-4 py-3 bg-red-600/20 border-b border-red-600/30">
            <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            <h3 className="font-bold text-sm tracking-tight text-red-700 dark:text-red-300 uppercase">Deal Breakers</h3>
          </div>
          <div className="p-4">
            <BulletList items={d.deal_breakers.map((db: any) => typeof db === "string" ? db : db.description || db.risk)} variant="concern" />
          </div>
        </div>
      )}

      {d.red_flags?.length > 0 && (
        <div className="border rounded-lg overflow-hidden bg-amber-500/5 border-amber-500/20">
          <div className="flex items-center gap-2.5 px-4 py-3 bg-amber-500/10 border-b border-amber-500/20">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <h3 className="font-semibold text-sm tracking-tight text-amber-700 dark:text-amber-300">Red Flags</h3>
          </div>
          <div className="p-4">
            <BulletList items={d.red_flags.map((f: any) => typeof f === "string" ? f : f.description || f.flag || String(f))} variant="concern" />
          </div>
        </div>
      )}

      {riskRegister.length > 0 && (
        <SectionCard icon={Shield} title="Risk Register" accent="border-l-red-500">
          <div className="overflow-x-auto -mx-4 px-4">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="font-bold">Risk</TableHead>
                  <TableHead className="font-bold">Category</TableHead>
                  <TableHead className="font-bold text-center">Likelihood</TableHead>
                  <TableHead className="font-bold text-center">Impact</TableHead>
                  <TableHead className="font-bold text-center">Score</TableHead>
                  <TableHead className="font-bold">Mitigation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...riskRegister]
                  .sort((a: any, b: any) => (b.composite_score ?? b.score ?? 0) - (a.composite_score ?? a.score ?? 0))
                  .map((risk: any, i: number) => (
                  <TableRow key={i} className={i % 2 === 0 ? "bg-muted/10" : ""}>
                    <TableCell className="text-sm font-medium max-w-[200px]">{risk.risk || risk.description || risk.name}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px] capitalize">{formatLabel(risk.category || "")}</Badge></TableCell>
                    <TableCell className="text-center">
                      <Badge className={`text-[10px] ${hmlColor(risk.likelihood)}`}>{risk.likelihood || "—"}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={`text-[10px] ${hmlColor(risk.impact)}`}>{risk.impact || "—"}</Badge>
                    </TableCell>
                    <TableCell className="text-center text-sm font-mono font-bold">{risk.composite_score ?? risk.score ?? risk.severity ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px]">{risk.mitigation || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </SectionCard>
      )}

      {(custConc.top_customer_percent != null || custConc.top_customer_revenue_percent != null || custConc.concentration_risk_level) && (
        <SectionCard icon={Target} title="Customer Concentration" accent="border-l-amber-500">
          <div className="flex items-center gap-6">
            {(custConc.top_customer_percent ?? custConc.top_customer_revenue_percent) != null && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Top Customer % of Revenue</p>
                <p className={`text-3xl font-bold ${concColor(custConc.top_customer_percent ?? custConc.top_customer_revenue_percent)}`}>
                  {formatPercent(custConc.top_customer_percent ?? custConc.top_customer_revenue_percent)}
                </p>
              </div>
            )}
            {(custConc.top_3_customers_percent ?? custConc.top_3_customer_revenue_percent) != null && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Top 3 Customers</p>
                <p className="text-xl font-bold">{formatPercent(custConc.top_3_customers_percent ?? custConc.top_3_customer_revenue_percent)}</p>
              </div>
            )}
            {custConc.concentration_risk_level && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Risk Level</p>
                <RiskLevelBadge level={custConc.concentration_risk_level} />
              </div>
            )}
          </div>
          {custConc.customers_over_15_percent?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              <span className="text-xs text-muted-foreground mr-1">Customers &gt;15%:</span>
              {custConc.customers_over_15_percent.map((c: string, i: number) => (
                <Badge key={i} className="bg-red-600 text-white text-xs">{c}</Badge>
              ))}
            </div>
          )}
          {custConc.observations?.length > 0 && <div className="mt-3"><BulletList items={custConc.observations} variant="info" /></div>}
        </SectionCard>
      )}

      {(keyPerson.key_persons?.length > 0 || keyPerson.dependency_level || keyPerson.risk_level) && (
        <SectionCard icon={Users} title="Key Person Dependency" accent="border-l-purple-500">
          {keyPerson.risk_level && (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm text-muted-foreground">Risk Level:</span>
              <RiskLevelBadge level={keyPerson.risk_level} />
            </div>
          )}
          {keyPerson.key_persons?.length > 0 ? (
            <div className="space-y-2">
              {keyPerson.key_persons.map((person: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg border bg-muted/10">
                  <div>
                    <span className="text-sm font-medium">{person.name || person.role || `Person ${i + 1}`}</span>
                    {person.role && person.name && <span className="text-xs text-muted-foreground ml-2">({person.role})</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    {person.dependency_level && <Badge variant="outline" className="text-[10px] capitalize">{person.dependency_level}</Badge>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <KeyValueGrid items={Object.entries(keyPerson).filter(([k]) => !["observations", "key_persons", "risk_level"].includes(k) && !Array.isArray(keyPerson[k])).map(([k, v]) => ({
              label: formatLabel(k),
              value: typeof v === "boolean" ? (v ? "Yes" : "No") : String(v ?? "—"),
            }))} />
          )}
          {(keyPerson.mitigation || keyPerson.mitigation_note) && (
            <p className="text-sm text-muted-foreground mt-3 italic">{keyPerson.mitigation || keyPerson.mitigation_note}</p>
          )}
          {keyPerson.observations?.length > 0 && <div className="mt-3"><BulletList items={keyPerson.observations} variant="info" /></div>}
        </SectionCard>
      )}

      {(regulatory.length > 0 || complianceStatus) && (
        <SectionCard icon={ShieldCheck} title="Regulatory & Compliance" accent="border-l-blue-500">
          <div className="space-y-4">
            {complianceStatus && (
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{typeof complianceStatus === "string" ? complianceStatus : JSON.stringify(complianceStatus)}</p>
            )}
            {regulatory.length > 0 && (
              <BulletList items={regulatory.map((r: any) => typeof r === "string" ? r : r.description || r.risk || String(r))} variant="concern" />
            )}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

export function QoEReportView({ data }: { data: Record<string, unknown> }) {
  const d = data as any;
  const reported = d.reported_figures || {};
  const addBacks = d.add_backs || [];
  const deductions = d.deductions || [];
  const adjusted = d.adjusted_ebitda || {};
  const directorSalary = d.director_salary_analysis || {};
  const directors = directorSalary.directors || [];
  const sustainability = d.sustainability_assessment || {};

  const reportedEbitda = reported.reported_ebitda;
  const totalAddBacks = d.total_add_backs ?? addBacks.reduce((s: number, ab: any) => s + (ab.amount || 0), 0);
  const totalDeductions = d.total_deductions ?? deductions.reduce((s: number, ded: any) => s + (ded.amount || 0), 0);
  const adjustedBase = adjusted.base ?? adjusted.mid;
  const adjustedBaseColor = (adjustedBase ?? 0) > 0 ? "text-green-600" : "text-amber-600";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Operating Profit" value={formatCurrency(reported.operating_profit)} color="text-emerald-600" />
        <MetricCard label="Depreciation" value={formatCurrency(reported.depreciation)} />
        <MetricCard label="Amortisation" value={formatCurrency(reported.amortisation)} />
        <MetricCard label="Reported EBITDA" value={formatCurrency(reported.reported_ebitda)} color="text-blue-600" subtext={reported.source_year ? `Year: ${reported.source_year}` : undefined} />
      </div>

      {d.narrative && (
        <SectionCard icon={Brain} title="Narrative" accent="border-l-indigo-500">
          <NarrativeBlock text={d.narrative} />
        </SectionCard>
      )}

      {reportedEbitda != null && (
        <SectionCard icon={Layers} title="EBITDA Bridge" accent="border-l-emerald-500">
          <div className="space-y-0">
            <div className="flex items-center justify-between p-3 rounded-t-lg bg-muted/30 border border-b-0">
              <span className="text-sm font-medium">Reported EBITDA</span>
              <span className="text-sm font-bold font-mono">{formatCurrency(reportedEbitda)}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-green-500/5 border border-b-0 border-green-500/20">
              <span className="text-sm font-medium text-green-700 dark:text-green-400">+ Add-backs</span>
              <span className="text-sm font-bold font-mono text-green-600 dark:text-green-400">
                {totalAddBacks >= 0 ? `+${formatCurrency(totalAddBacks)}` : formatCurrency(totalAddBacks)}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-red-500/5 border border-b-0 border-red-500/20">
              <span className="text-sm font-medium text-red-700 dark:text-red-400">− Deductions</span>
              <span className="text-sm font-bold font-mono text-red-600 dark:text-red-400">−{formatCurrency(totalDeductions)}</span>
            </div>
            <div className="border-t-2 border-dashed border-muted-foreground/30" />
            <div className="flex items-center justify-between p-3 rounded-b-lg bg-muted/40 border border-t-0">
              <span className="text-sm font-bold">Adjusted EBITDA (Base)</span>
              <span className={`text-lg font-bold font-mono ${adjustedBaseColor}`}>{formatCurrency(adjustedBase)}</span>
            </div>
          </div>

          {(adjusted.low != null || adjusted.base != null || adjusted.mid != null || adjusted.high != null) && (
            <div className="grid grid-cols-3 gap-3 mt-4">
              {[
                { k: "low", l: "Conservative" },
                { k: "base", l: "Base", alt: "mid" },
                { k: "high", l: "Optimistic" },
              ].map(({ k, l, alt }) => {
                const val = adjusted[k] ?? (alt ? adjusted[alt] : null);
                const isBase = k === "base";
                return val != null ? (
                  <div key={k} className={`border rounded-xl p-4 text-center ${isBase ? "border-primary bg-primary/5 ring-1 ring-primary/20" : ""}`}>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{l}</p>
                    <p className={`text-xl font-bold tracking-tight ${isBase ? "text-primary" : ""}`}>{formatCurrency(val)}</p>
                  </div>
                ) : null;
              })}
            </div>
          )}
        </SectionCard>
      )}

      {d.key_findings?.length > 0 && (
        <SectionCard icon={CheckCircle2} title="Key Findings" accent="border-l-green-500">
          <BulletList items={d.key_findings} variant="strength" />
        </SectionCard>
      )}

      {d.red_flags?.length > 0 && (
        <div className="border rounded-lg overflow-hidden bg-red-500/5 border-red-500/20">
          <div className="flex items-center gap-2.5 px-4 py-3 bg-red-500/10 border-b border-red-500/20">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
            <h3 className="font-semibold text-sm tracking-tight text-red-700 dark:text-red-300">Red Flags</h3>
          </div>
          <div className="p-4">
            <BulletList items={d.red_flags.map((f: any) => typeof f === "string" ? f : f.description || f.flag || String(f))} variant="concern" />
          </div>
        </div>
      )}

      {addBacks.length > 0 && (
        <SectionCard icon={TrendingUp} title="Add-backs" accent="border-l-green-500">
          <div className="overflow-x-auto -mx-4 px-4">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="font-bold">Item</TableHead>
                  <TableHead className="font-bold">Category</TableHead>
                  <TableHead className="text-right font-bold">Amount</TableHead>
                  <TableHead className="font-bold">Recurrence</TableHead>
                  <TableHead className="text-right font-bold">Defensibility</TableHead>
                  <TableHead className="font-bold">Justification</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {addBacks.map((ab: any, i: number) => (
                  <TableRow key={i} className={i % 2 === 0 ? "bg-green-500/5" : ""}>
                    <TableCell className="text-sm font-medium">{ab.item}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px] capitalize">{formatLabel(ab.category || "")}</Badge></TableCell>
                    <TableCell className="text-right text-sm text-green-600 dark:text-green-400 font-bold font-mono">+{formatCurrency(ab.amount)}</TableCell>
                    <TableCell className="text-sm">{ab.recurrence || ab.recurring || "—"}</TableCell>
                    <TableCell className="text-right text-sm font-mono">{ab.defensibility_score != null ? `${ab.defensibility_score}/10` : ab.defensibility ?? ab.confidence ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{ab.justification || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </SectionCard>
      )}

      {deductions.length > 0 && (
        <SectionCard icon={AlertTriangle} title="Deductions" accent="border-l-red-500">
          <div className="overflow-x-auto -mx-4 px-4">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="font-bold">Item</TableHead>
                  <TableHead className="font-bold">Category</TableHead>
                  <TableHead className="text-right font-bold">Amount</TableHead>
                  <TableHead className="font-bold">Recurrence</TableHead>
                  <TableHead className="text-right font-bold">Defensibility</TableHead>
                  <TableHead className="font-bold">Justification</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deductions.map((ded: any, i: number) => (
                  <TableRow key={i} className={i % 2 === 0 ? "bg-red-500/5" : ""}>
                    <TableCell className="text-sm font-medium">{ded.item}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px] capitalize">{formatLabel(ded.category || "")}</Badge></TableCell>
                    <TableCell className="text-right text-sm text-red-600 dark:text-red-400 font-bold font-mono">−{formatCurrency(ded.amount)}</TableCell>
                    <TableCell className="text-sm">{ded.recurrence || ded.recurring || "—"}</TableCell>
                    <TableCell className="text-right text-sm font-mono">{ded.defensibility_score != null ? `${ded.defensibility_score}/10` : ded.defensibility ?? ded.confidence ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{ded.justification || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </SectionCard>
      )}

      {directors.length > 0 && (
        <SectionCard icon={Users} title="Director / Owner Salary Analysis" accent="border-l-purple-500">
          <div className="overflow-x-auto -mx-4 px-4">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="font-bold">Name</TableHead>
                  <TableHead className="text-right font-bold">Current Salary</TableHead>
                  <TableHead className="text-right font-bold">Market Rate</TableHead>
                  <TableHead className="text-right font-bold">Adjustment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {directors.map((dir: any, i: number) => (
                  <TableRow key={i} className={i % 2 === 0 ? "bg-muted/10" : ""}>
                    <TableCell className="text-sm font-medium">{dir.name || dir.title || `Director ${i + 1}`}</TableCell>
                    <TableCell className="text-right text-sm font-mono">{formatCurrency(dir.current_salary ?? dir.salary)}</TableCell>
                    <TableCell className="text-right text-sm font-mono">{formatCurrency(dir.market_rate ?? dir.market_rate_estimate)}</TableCell>
                    <TableCell className={`text-right text-sm font-mono font-bold ${(dir.adjustment ?? 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {dir.adjustment != null ? formatCurrency(dir.adjustment) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {(directorSalary.benchmark_range || directorSalary.benchmark_source) && (
            <p className="mt-2 text-xs text-muted-foreground italic">
              Benchmark: {directorSalary.benchmark_range || directorSalary.benchmark_source}
            </p>
          )}
        </SectionCard>
      )}

      {Object.keys(sustainability).length > 0 && (
        <SectionCard icon={Shield} title="Sustainability Assessment" accent="border-l-teal-500">
          <div className="space-y-4">
            {sustainability.sustainable_for_3_years != null && (
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">Sustainable for 3 Years:</span>
                <Badge className={sustainability.sustainable_for_3_years ? "bg-green-600 text-white" : "bg-red-600 text-white"}>
                  {sustainability.sustainable_for_3_years ? "Yes" : "No"}
                </Badge>
              </div>
            )}
            {sustainability.key_assumptions?.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2 font-medium">Key Assumptions</p>
                <BulletList items={sustainability.key_assumptions} variant="strength" />
              </div>
            )}
            {sustainability.sensitivity_factors?.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2 font-medium">Sensitivity Factors</p>
                <BulletList items={sustainability.sensitivity_factors} variant="question" />
              </div>
            )}
            {sustainability.upside_scenarios?.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2 font-medium">Upside Scenarios</p>
                <ul className="space-y-1">
                  {sustainability.upside_scenarios.map((item: string, i: number) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <ArrowUpRight className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {sustainability.downside_scenarios?.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2 font-medium">Downside Scenarios</p>
                <ul className="space-y-1">
                  {sustainability.downside_scenarios.map((item: string, i: number) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <ArrowDownRight className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

export function SectorReportView({ data }: { data: Record<string, unknown> }) {
  const d = data as any;
  const overview = d.sector_overview || {};
  const positioning = d.competitive_positioning || {};
  const multiples = d.comparable_multiples || {};
  const growth = d.growth_opportunities || {};
  const sectorRisks = d.sector_risks || {};
  const comparables = d.comparable_transactions || d.sector_comparables || [];
  const tailwinds = d.sector_tailwinds || d.opportunities || growth.organic || [];
  const regulatoryEnv = d.regulatory_environment || d.external_factors || null;
  const sectorRiskItems = sectorRisks.threats || sectorRisks.risks || [];

  const growthOutlookColor: Record<string, string> = {
    growing: "bg-green-600 text-white",
    stable: "bg-blue-600 text-white",
    declining: "bg-red-600 text-white",
    disrupted: "bg-amber-600 text-white",
  };

  const marginComparison = positioning.margin_vs_sector || positioning.company_vs_typical;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {overview.growth_outlook && <MetricCard label="Growth Outlook" value={<span className="capitalize">{overview.growth_outlook}</span>} />}
        {overview.uk_market_size_estimate && <MetricCard label="UK Market Size" value={overview.uk_market_size_estimate} />}
        {positioning.company_size_classification && <MetricCard label="Company Size" value={<span className="capitalize">{positioning.company_size_classification}</span>} />}
      </div>

      {d.narrative && (
        <SectionCard icon={Brain} title="Narrative" accent="border-l-indigo-500">
          <NarrativeBlock text={d.narrative} />
        </SectionCard>
      )}

      {d.key_findings?.length > 0 && (
        <SectionCard icon={CheckCircle2} title="Key Findings" accent="border-l-green-500">
          <BulletList items={d.key_findings} variant="strength" />
        </SectionCard>
      )}

      {d.red_flags?.length > 0 && (
        <div className="border rounded-lg overflow-hidden bg-red-500/5 border-red-500/20">
          <div className="flex items-center gap-2.5 px-4 py-3 bg-red-500/10 border-b border-red-500/20">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
            <h3 className="font-semibold text-sm tracking-tight text-red-700 dark:text-red-300">Red Flags</h3>
          </div>
          <div className="p-4">
            <BulletList items={d.red_flags.map((f: any) => typeof f === "string" ? f : f.description || f.flag || String(f))} variant="concern" />
          </div>
        </div>
      )}

      <SectionCard icon={Building} title="Sector Overview" accent="border-l-blue-500">
        <div className="grid grid-cols-2 gap-3">
          {overview.sector_name && (
            <div className="border rounded-xl p-4 bg-gradient-to-br from-background to-muted/30">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Sector</p>
              <p className="text-sm font-bold">{overview.sector_name}</p>
            </div>
          )}
          {overview.growth_outlook && (
            <div className="border rounded-xl p-4 bg-gradient-to-br from-background to-muted/30">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Growth Outlook</p>
              <Badge className={`capitalize font-medium ${growthOutlookColor[overview.growth_outlook?.toLowerCase()] || ""}`}>
                {overview.growth_outlook}
              </Badge>
            </div>
          )}
          {overview.uk_market_size_estimate && (
            <div className="border rounded-xl p-4 bg-gradient-to-br from-background to-muted/30">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Market Size</p>
              <p className="text-sm font-bold">{overview.uk_market_size_estimate}</p>
            </div>
          )}
          {positioning.company_size_classification && (
            <div className="border rounded-xl p-4 bg-gradient-to-br from-background to-muted/30">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Company Size vs Sector</p>
              <Badge variant="outline" className="capitalize font-medium">{positioning.company_size_classification}</Badge>
            </div>
          )}
          {positioning.typical_ebitda_margin_range && (
            <div className="border rounded-xl p-4 bg-gradient-to-br from-background to-muted/30">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Typical EBITDA Margin</p>
              <p className="text-sm font-bold">{formatPercent(positioning.typical_ebitda_margin_range.low)} — {formatPercent(positioning.typical_ebitda_margin_range.high)}</p>
              {marginComparison && <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">Company: {marginComparison}</p>}
            </div>
          )}
          {multiples.ev_ebitda_range && (
            <div className="border rounded-xl p-4 bg-gradient-to-br from-background to-muted/30">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Typical EV/EBITDA</p>
              <p className="text-sm font-bold">{multiples.ev_ebitda_range.low}x — {multiples.ev_ebitda_range.high}x</p>
              {multiples.ev_ebitda_range.mid && <p className="text-[10px] text-muted-foreground mt-0.5">Mid: {multiples.ev_ebitda_range.mid}x</p>}
            </div>
          )}
        </div>
        {positioning.positioning_assessment && (
          <div className="mt-4">
            <NarrativeBlock text={positioning.positioning_assessment} />
          </div>
        )}
      </SectionCard>

      {comparables.length > 0 && (
        <SectionCard icon={CircleDollarSign} title="Comparable Transactions" accent="border-l-emerald-500">
          <div className="overflow-x-auto -mx-4 px-4">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="font-bold">Company / Deal</TableHead>
                  <TableHead className="text-right font-bold">Revenue</TableHead>
                  <TableHead className="text-right font-bold">EBITDA</TableHead>
                  <TableHead className="text-right font-bold">Multiple</TableHead>
                  <TableHead className="font-bold">Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparables.map((comp: any, i: number) => (
                  <TableRow key={i} className={i % 2 === 0 ? "bg-muted/10" : ""}>
                    <TableCell className="text-sm font-medium">{comp.company || comp.name || comp.deal || `Comparable ${i + 1}`}</TableCell>
                    <TableCell className="text-right text-sm font-mono">{comp.revenue != null ? formatCurrency(comp.revenue) : "—"}</TableCell>
                    <TableCell className="text-right text-sm font-mono">{comp.ebitda != null ? formatCurrency(comp.ebitda) : "—"}</TableCell>
                    <TableCell className="text-right text-sm font-mono font-bold">{comp.multiple != null ? `${comp.multiple}x` : "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px]">{comp.notes || comp.description || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {multiples.data_quality_note && <p className="text-xs text-muted-foreground mt-3 italic">{multiples.data_quality_note}</p>}
        </SectionCard>
      )}

      {sectorRiskItems.length > 0 && (
        <SectionCard icon={AlertTriangle} title="Sector Risks" accent="border-l-red-500">
          {sectorRisks.cyclicality && (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm text-muted-foreground">Cyclicality:</span>
              <Badge variant="outline" className="capitalize font-medium">{sectorRisks.cyclicality}</Badge>
            </div>
          )}
          <div className="space-y-2">
            {[...sectorRiskItems]
              .sort((a: any, b: any) => {
                const sev = (v: any) => typeof v === "string" ? (v.toLowerCase() === "high" ? 3 : v.toLowerCase() === "medium" ? 2 : 1) : 0;
                return sev(b.severity || b.risk_level) - sev(a.severity || a.risk_level);
              })
              .map((risk: any, i: number) => {
                const riskName = typeof risk === "string" ? risk : risk.name || risk.threat || risk.description;
                const severity = typeof risk === "object" ? (risk.severity || risk.risk_level) : null;
                const desc = typeof risk === "object" ? (risk.description || risk.detail) : null;
                return (
                  <div key={i} className="border rounded-lg p-3 bg-muted/10 flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{riskName}</p>
                      {desc && desc !== riskName && <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>}
                    </div>
                    {severity && (
                      <Badge className={`text-[10px] flex-shrink-0 ${
                        String(severity).toLowerCase() === "high" ? "bg-red-600 text-white" :
                        String(severity).toLowerCase() === "medium" ? "bg-amber-600 text-white" :
                        "bg-green-600 text-white"
                      }`}>{severity}</Badge>
                    )}
                  </div>
                );
              })}
          </div>
        </SectionCard>
      )}

      {tailwinds.length > 0 && (
        <SectionCard icon={TrendingUp} title="Sector Tailwinds" accent="border-l-green-500">
          <ul className="space-y-1">
            {tailwinds.map((item: any, i: number) => (
              <li key={i} className="text-sm flex items-start gap-2">
                <ArrowUpRight className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                <span>{typeof item === "string" ? item : item.description || item.name || String(item)}</span>
              </li>
            ))}
          </ul>
          {growth.acquisition?.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Acquisition Opportunities</p>
              <BulletList items={growth.acquisition} variant="strength" />
            </div>
          )}
        </SectionCard>
      )}

      {(regulatoryEnv || overview.regulatory_factors?.length > 0) && (
        <SectionCard icon={ShieldCheck} title="Regulatory & External Environment" accent="border-l-amber-500">
          {regulatoryEnv && typeof regulatoryEnv === "string" && (
            <p className="text-sm leading-relaxed whitespace-pre-wrap mb-3">{regulatoryEnv}</p>
          )}
          {regulatoryEnv && typeof regulatoryEnv === "object" && (
            <div className="mb-3">
              <KeyValueGrid items={Object.entries(regulatoryEnv).map(([k, v]) => ({
                label: formatLabel(k),
                value: String(v ?? "—"),
              }))} />
            </div>
          )}
          {overview.regulatory_factors?.length > 0 && (
            <BulletList items={overview.regulatory_factors} variant="concern" />
          )}
        </SectionCard>
      )}

      {overview.key_trends?.length > 0 && (
        <SectionCard icon={TrendingUp} title="Key Sector Trends" accent="border-l-blue-500">
          <BulletList items={overview.key_trends} variant="info" />
        </SectionCard>
      )}
    </div>
  );
}

export function ValuationReportView({ data }: { data: Record<string, unknown> }) {
  const d = data as any;
  const ebitdaVal = d.ebitda_multiple_valuation || {};
  const bridge = d.ev_to_equity_bridge || {};
  const summary = d.valuation_summary || {};
  const sensitivity = d.sensitivity_analysis || {};
  const sellerExp = d.seller_expectation || d.valuation_gap || null;

  const equityRange = bridge.equity_value_range || summary.equity_value_range || {};
  const evRange = ebitdaVal.enterprise_value_range || {};
  const recommendedOffer = summary.recommended_offer ?? summary.recommended_offer_price ?? d.recommended_offer;
  const recommendedStructure = summary.recommended_structure ?? d.recommended_structure;

  return (
    <div className="space-y-6">
      {d.narrative && (
        <SectionCard icon={Brain} title="Narrative" accent="border-l-indigo-500">
          <NarrativeBlock text={d.narrative} />
        </SectionCard>
      )}

      <SectionCard icon={CircleDollarSign} title="Equity Value Range" accent="border-l-emerald-500">
        <div className="grid grid-cols-3 gap-4">
          {[
            { k: "conservative", l: "Conservative" },
            { k: "base", l: "Base Case" },
            { k: "optimistic", l: "Optimistic" },
          ].map(({ k, l }) => {
            const val = equityRange[k] ?? evRange[k];
            const isBase = k === "base";
            return (
              <div key={k} className={`border rounded-xl p-5 text-center ${isBase ? "border-primary bg-primary/5 ring-1 ring-primary/20" : ""}`}>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">{l}</p>
                <p className={`text-2xl font-bold tracking-tight ${isBase ? "text-primary" : ""}`}>{formatCurrency(val)}</p>
                <p className="text-[10px] text-muted-foreground mt-1">Equity Value</p>
              </div>
            );
          })}
        </div>
        {recommendedOffer != null && (
          <div className="mt-4 p-4 rounded-xl border-2 border-primary/30 bg-primary/5 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Recommended Offer</p>
            <p className="text-3xl font-bold text-primary tracking-tight">{formatCurrency(recommendedOffer)}</p>
          </div>
        )}
        {recommendedStructure && (
          <div className="mt-3 flex justify-center">
            <Badge variant="outline" className="text-sm capitalize font-medium px-4 py-1">{recommendedStructure}</Badge>
          </div>
        )}
      </SectionCard>

      {d.key_findings?.length > 0 && (
        <SectionCard icon={CheckCircle2} title="Key Findings" accent="border-l-green-500">
          <BulletList items={d.key_findings} variant="strength" />
        </SectionCard>
      )}

      {d.red_flags?.length > 0 && (
        <div className="border rounded-lg overflow-hidden bg-red-500/5 border-red-500/20">
          <div className="flex items-center gap-2.5 px-4 py-3 bg-red-500/10 border-b border-red-500/20">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
            <h3 className="font-semibold text-sm tracking-tight text-red-700 dark:text-red-300">Red Flags</h3>
          </div>
          <div className="p-4">
            <BulletList items={d.red_flags.map((f: any) => typeof f === "string" ? f : f.description || f.flag || String(f))} variant="concern" />
          </div>
        </div>
      )}

      {(Object.keys(bridge).length > 0 || Object.keys(ebitdaVal).length > 0) && (
        <SectionCard icon={BarChart3} title="Valuation Bridge" accent="border-l-blue-500">
          <div className="space-y-0 max-w-lg mx-auto">
            {ebitdaVal.adjusted_ebitda_base != null && (
              <div className="flex items-center justify-between p-3 rounded-t-lg bg-muted/30 border border-b-0">
                <span className="text-sm font-medium">Adjusted EBITDA</span>
                <span className="text-sm font-bold font-mono">{formatCurrency(ebitdaVal.adjusted_ebitda_base)}</span>
              </div>
            )}
            {(ebitdaVal.selected_multiple != null || ebitdaVal.sector_multiple_range) && (
              <div className="flex items-center justify-between p-3 bg-blue-500/5 border border-b-0 border-blue-500/20">
                <span className="text-sm font-medium text-blue-700 dark:text-blue-400">× Multiple Applied</span>
                <span className="text-sm font-bold font-mono text-blue-600 dark:text-blue-400">
                  {ebitdaVal.selected_multiple != null ? `${ebitdaVal.selected_multiple}x` : ""}
                  {ebitdaVal.sector_multiple_range ? ` (sector: ${ebitdaVal.sector_multiple_range.low}x–${ebitdaVal.sector_multiple_range.high}x)` : ""}
                </span>
              </div>
            )}
            {(bridge.enterprise_value_base != null || evRange.base != null) && (
              <div className="flex items-center justify-between p-3 bg-muted/20 border border-b-0">
                <span className="text-sm font-medium">Enterprise Value</span>
                <span className="text-sm font-bold font-mono">{formatCurrency(bridge.enterprise_value_base ?? evRange.base)}</span>
              </div>
            )}
            {[
              { k: "plus_cash", l: "+ Cash at Bank", sign: "+" },
              { k: "minus_long_term_debt", l: "− Long-term Debt", sign: "−" },
              { k: "minus_director_loans", l: "− Director Loans", sign: "−" },
              { k: "minus_bad_debt_provision", l: "− Bad Debt Provision", sign: "−" },
              { k: "minus_working_capital_adjustment", l: "− Working Capital Adj.", sign: "−" },
            ].filter(({ k }) => bridge[k] != null).map(({ k, l, sign }) => (
              <div key={k} className={`flex items-center justify-between p-3 border border-b-0 ${sign === "+" ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5 border-red-500/20"}`}>
                <span className={`text-sm font-medium ${sign === "+" ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>{l}</span>
                <span className={`text-sm font-bold font-mono ${sign === "+" ? "text-green-600" : "text-red-600"}`}>
                  {formatCurrency(Math.abs(bridge[k]))}
                </span>
              </div>
            ))}
            <div className="border-t-2 border-dashed border-muted-foreground/30" />
            {equityRange.base != null && (
              <div className="flex items-center justify-between p-3 rounded-b-lg bg-muted/40 border border-t-0">
                <span className="text-sm font-bold">Equity Value (Base)</span>
                <span className="text-lg font-bold font-mono text-primary">{formatCurrency(equityRange.base)}</span>
              </div>
            )}
          </div>
          {ebitdaVal.multiple_justification && <div className="mt-4"><NarrativeBlock text={ebitdaVal.multiple_justification} /></div>}
        </SectionCard>
      )}

      {(ebitdaVal.sector_multiple_range || d.comparable_multiples) && (
        <SectionCard icon={Target} title="Multiple Benchmarking" accent="border-l-teal-500">
          <div className="grid grid-cols-3 gap-3">
            {ebitdaVal.sector_multiple_range && (
              <div className="border rounded-xl p-4 text-center bg-gradient-to-br from-background to-muted/30">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Sector EV/EBITDA Range</p>
                <p className="text-xl font-bold">{ebitdaVal.sector_multiple_range.low}x — {ebitdaVal.sector_multiple_range.high}x</p>
              </div>
            )}
            {ebitdaVal.selected_multiple != null && (
              <div className="border rounded-xl p-4 text-center border-primary bg-primary/5">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Applied Multiple</p>
                <p className="text-xl font-bold text-primary">{ebitdaVal.selected_multiple}x</p>
              </div>
            )}
            {(ebitdaVal.premium_discount_percent != null || d.premium_discount) && (
              <div className="border rounded-xl p-4 text-center bg-gradient-to-br from-background to-muted/30">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Premium / Discount</p>
                <p className="text-xl font-bold">{formatPercent(ebitdaVal.premium_discount_percent ?? d.premium_discount)}</p>
                {(ebitdaVal.premium_discount_reason || d.premium_discount_reason) && (
                  <p className="text-[10px] text-muted-foreground mt-1">{ebitdaVal.premium_discount_reason || d.premium_discount_reason}</p>
                )}
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {(sensitivity.scenarios?.length > 0 || sensitivity.grid || Object.keys(sensitivity).length > 2) && (
        <SectionCard icon={Gauge} title="Sensitivity Analysis" accent="border-l-amber-500">
          {sensitivity.grid ? (
            <div className="overflow-x-auto -mx-4 px-4">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="font-bold">EBITDA \ Multiple</TableHead>
                    {(sensitivity.grid.multiples || []).map((m: number) => (
                      <TableHead key={m} className="text-right font-bold">{m}x</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(sensitivity.grid.ebitda_values || []).map((ebitda: number, ri: number) => (
                    <TableRow key={ri} className={ri % 2 === 0 ? "bg-muted/10" : ""}>
                      <TableCell className="font-medium text-sm">{formatCurrency(ebitda)}</TableCell>
                      {(sensitivity.grid.multiples || []).map((m: number, ci: number) => {
                        const val = sensitivity.grid.values?.[ri]?.[ci];
                        const isBase = sensitivity.grid.base_row === ri && sensitivity.grid.base_col === ci;
                        return (
                          <TableCell key={ci} className={`text-right text-sm font-mono ${isBase ? "bg-primary/10 font-bold text-primary" : ""}`}>
                            {formatCurrency(val)}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : sensitivity.scenarios?.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {sensitivity.scenarios.map((sc: any, i: number) => (
                <div key={i} className={`border rounded-xl p-4 text-center ${sc.is_base ? "border-primary bg-primary/5" : "bg-gradient-to-br from-background to-muted/30"}`}>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{sc.label || sc.name || `Scenario ${i + 1}`}</p>
                  <p className={`text-xl font-bold ${sc.is_base ? "text-primary" : ""}`}>{formatCurrency(sc.equity_value ?? sc.value)}</p>
                  {sc.ebitda && <p className="text-[10px] text-muted-foreground mt-0.5">EBITDA: {formatCurrency(sc.ebitda)}</p>}
                  {sc.multiple && <p className="text-[10px] text-muted-foreground">Multiple: {sc.multiple}x</p>}
                </div>
              ))}
            </div>
          ) : (
            <KeyValueGrid items={Object.entries(sensitivity).filter(([k]) => k !== "grid" && k !== "scenarios").map(([k, v]) => ({
              label: formatLabel(k),
              value: typeof v === "number" ? formatCurrency(v as number) : String(v ?? "—"),
            }))} />
          )}
        </SectionCard>
      )}

      {sellerExp && typeof sellerExp === "object" && (
        <SectionCard icon={Handshake} title="Seller Expectation Gap" accent="border-l-purple-500">
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {sellerExp.seller_expectation != null && (
                <div className="border rounded-xl p-4 text-center bg-red-500/5">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Seller Expectation</p>
                  <p className="text-xl font-bold text-red-600">{formatCurrency(sellerExp.seller_expectation)}</p>
                </div>
              )}
              {(recommendedOffer ?? sellerExp.recommended_offer) != null && (
                <div className="border rounded-xl p-4 text-center border-primary bg-primary/5">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Recommended Offer</p>
                  <p className="text-xl font-bold text-primary">{formatCurrency(recommendedOffer ?? sellerExp.recommended_offer)}</p>
                </div>
              )}
              {(sellerExp.gap ?? sellerExp.gap_amount) != null && (
                <div className="border rounded-xl p-4 text-center bg-amber-500/5">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Gap</p>
                  <p className="text-xl font-bold text-amber-600">{formatCurrency(sellerExp.gap ?? sellerExp.gap_amount)}</p>
                  {(sellerExp.gap_percent ?? sellerExp.gap_percentage) != null && (
                    <p className="text-xs text-muted-foreground mt-0.5">{formatPercent(sellerExp.gap_percent ?? sellerExp.gap_percentage)}</p>
                  )}
                </div>
              )}
            </div>
            {(sellerExp.bridging_strategy || sellerExp.how_to_bridge) && (
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{sellerExp.bridging_strategy || sellerExp.how_to_bridge}</p>
            )}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

export function DealStructureReportView({ data }: { data: Record<string, unknown> }) {
  const d = data as any;
  const structures = d.structures || [];
  const recommended = d.recommended_structure;
  const dealBreakers = d.deal_breaker_terms || d.red_flags || [];
  const paymentMechanics = d.payment_mechanics || d.earnout_structure || null;
  const conditionsPrecedent = d.conditions_precedent || [];
  const protections = d.warranties_indemnities || d.protections || null;
  const integrationPriorities = d.integration_priorities || d.first_100_days || [];

  const approachColor = (name: string) => {
    const n = (name || "").toLowerCase();
    if (n.includes("conservative")) return { bg: "bg-green-500/10 border-green-500/30", badge: "bg-green-600 text-white", text: "text-green-700 dark:text-green-400" };
    if (n.includes("competitive") || n.includes("aggressive")) return { bg: "bg-blue-500/10 border-blue-500/30", badge: "bg-blue-600 text-white", text: "text-blue-700 dark:text-blue-400" };
    return { bg: "bg-amber-500/10 border-amber-500/30", badge: "bg-amber-600 text-white", text: "text-amber-700 dark:text-amber-400" };
  };

  const recColors = approachColor(recommended || "balanced");

  return (
    <div className="space-y-6">
      {d.narrative && (
        <SectionCard icon={Brain} title="Narrative" accent="border-l-indigo-500">
          <NarrativeBlock text={d.narrative} />
        </SectionCard>
      )}

      {recommended && (
        <div className={`rounded-xl p-5 border-2 ${recColors.bg} flex items-center justify-between`}>
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Recommended Approach</p>
            <p className="text-lg font-bold">{recommended}</p>
          </div>
          <Badge className={`text-lg px-4 py-1.5 ${recColors.badge}`}>Recommended</Badge>
        </div>
      )}

      {d.recommendation_rationale && (
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{d.recommendation_rationale}</p>
      )}

      {d.key_findings?.length > 0 && (
        <SectionCard icon={CheckCircle2} title="Key Findings" accent="border-l-green-500">
          <BulletList items={d.key_findings} variant="strength" />
        </SectionCard>
      )}

      {dealBreakers.length > 0 && (
        <div className="border rounded-lg overflow-hidden bg-red-500/5 border-red-500/20">
          <div className="flex items-center gap-2.5 px-4 py-3 bg-red-500/10 border-b border-red-500/20">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
            <h3 className="font-semibold text-sm tracking-tight text-red-700 dark:text-red-300">Terms to Watch</h3>
          </div>
          <div className="p-4">
            <BulletList items={dealBreakers.map((f: any) => typeof f === "string" ? f : f.description || f.term || f.flag || String(f))} variant="concern" />
          </div>
        </div>
      )}

      {structures.length > 0 && (
        <SectionCard icon={Handshake} title="Structure Comparison" accent="border-l-purple-500">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {structures.map((struct: any, i: number) => {
              const isRec = struct.name === recommended || (structures.length === 1);
              const consideration = struct.consideration || {};
              const colors = approachColor(struct.name || "");
              const totalVal = consideration.total_headline ?? consideration.total ?? consideration.total_consideration;
              const upfrontVal = consideration.upfront_cash ?? consideration.upfront ?? consideration.initial_payment;
              const deferredVal = (
                (consideration.deferred ?? consideration.deferred_cash ?? 0) +
                (consideration.earnout_maximum ?? consideration.earnout ?? 0)
              ) || null;
              const upfrontPct = consideration.upfront_percent ?? (totalVal && upfrontVal ? Math.round((upfrontVal / totalVal) * 100) : null);
              const deferredPct = (deferredVal != null && totalVal != null && totalVal > 0)
                ? Math.round((deferredVal / totalVal) * 100)
                : (upfrontPct != null ? 100 - upfrontPct : null);
              const earnoutPeriod = struct.earnout_period ?? consideration.earnout_period ?? struct.deferred_period;
              const keyConditions = struct.key_conditions || struct.conditions || consideration.key_conditions || [];
              const riskLevel = struct.risk_to_buyer ?? struct.buyer_risk ?? consideration.risk_level;

              return (
                <div key={i} className={`border rounded-xl overflow-hidden flex flex-col ${isRec ? "border-2 ring-1 ring-primary/20 border-primary/40" : ""}`}>
                  <div className={`px-4 py-3 border-b flex items-center justify-between ${colors.bg}`}>
                    <h3 className={`font-bold text-sm ${colors.text}`}>{struct.name}</h3>
                    {isRec && <Badge className={`text-[10px] ${recColors.badge}`}>Recommended</Badge>}
                  </div>
                  <div className="p-4 space-y-3 flex-1">
                    {struct.strategy && <p className="text-xs text-muted-foreground">{struct.strategy}</p>}

                    {upfrontVal != null && (
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Upfront Payment</span>
                        <span className="text-sm font-bold font-mono">
                          {formatCurrency(upfrontVal)}
                          {upfrontPct != null && <span className="text-[10px] text-muted-foreground ml-1">({upfrontPct}%)</span>}
                        </span>
                      </div>
                    )}
                    {deferredVal != null && (
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Deferred / Earnout</span>
                        <span className="text-sm font-bold font-mono">
                          {formatCurrency(deferredVal)}
                          {deferredPct != null && <span className="text-[10px] text-muted-foreground ml-1">({deferredPct}%)</span>}
                        </span>
                      </div>
                    )}
                    <Separator />
                    {totalVal != null && (
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold text-muted-foreground">Total Consideration</span>
                        <span className="text-base font-bold font-mono">{formatCurrency(totalVal)}</span>
                      </div>
                    )}
                    {earnoutPeriod && (
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Earnout Period</span>
                        <span className="text-sm font-medium">{typeof earnoutPeriod === "number" ? `${earnoutPeriod} months` : earnoutPeriod}</span>
                      </div>
                    )}
                    {keyConditions.length > 0 && (
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Key Conditions</p>
                        {(Array.isArray(keyConditions) ? keyConditions : [keyConditions]).slice(0, 2).map((cond: any, ci: number) => (
                          <p key={ci} className="text-xs text-muted-foreground">• {typeof cond === "string" ? cond : cond.description || String(cond)}</p>
                        ))}
                      </div>
                    )}
                    {riskLevel && (
                      <div className="flex justify-between items-center pt-1">
                        <span className="text-[10px] text-muted-foreground uppercase">Buyer Risk</span>
                        <Badge className={`text-[10px] ${
                          String(riskLevel).toLowerCase() === "low" ? "bg-green-600 text-white" :
                          String(riskLevel).toLowerCase() === "high" ? "bg-red-600 text-white" :
                          "bg-amber-600 text-white"
                        }`}>{riskLevel}</Badge>
                      </div>
                    )}

                    {struct.suitable_when && (
                      <p className="text-[10px] text-muted-foreground italic mt-2">Best suited when: {struct.suitable_when}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {paymentMechanics && typeof paymentMechanics === "object" && (
        <SectionCard icon={Calendar} title="Payment Mechanics" accent="border-l-teal-500">
          <div className="space-y-4">
            {(paymentMechanics.earnout_triggers || paymentMechanics.triggers || []).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Earnout Triggers</p>
                <BulletList items={paymentMechanics.earnout_triggers || paymentMechanics.triggers} variant="info" />
              </div>
            )}
            {(paymentMechanics.measurement_period || paymentMechanics.period) && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Measurement Period:</span>
                <Badge variant="outline" className="font-medium">{paymentMechanics.measurement_period || paymentMechanics.period}</Badge>
              </div>
            )}
            {(paymentMechanics.payment_schedule || paymentMechanics.milestones || []).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Payment Schedule</p>
                <div className="overflow-x-auto -mx-4 px-4">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="font-bold">Milestone</TableHead>
                        <TableHead className="text-right font-bold">Amount</TableHead>
                        <TableHead className="font-bold">Timing</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(paymentMechanics.payment_schedule || paymentMechanics.milestones).map((item: any, i: number) => (
                        <TableRow key={i} className={i % 2 === 0 ? "bg-muted/10" : ""}>
                          <TableCell className="text-sm font-medium">{item.milestone || item.description || item.name || `Payment ${i + 1}`}</TableCell>
                          <TableCell className="text-right text-sm font-mono font-bold">{formatCurrency(item.amount ?? item.value)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{item.timing || item.date || item.when || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
            {typeof paymentMechanics === "object" && !paymentMechanics.earnout_triggers && !paymentMechanics.triggers && !paymentMechanics.payment_schedule && !paymentMechanics.milestones && (
              <KeyValueGrid items={Object.entries(paymentMechanics).filter(([, v]) => typeof v !== "object").map(([k, v]) => ({
                label: formatLabel(k),
                value: typeof v === "number" ? formatCurrency(v as number) : String(v ?? "—"),
              }))} />
            )}
          </div>
        </SectionCard>
      )}

      {conditionsPrecedent.length > 0 && (
        <SectionCard icon={ClipboardList} title="Conditions Precedent" accent="border-l-amber-500">
          <ol className="space-y-2">
            {conditionsPrecedent.map((cond: any, i: number) => (
              <li key={i} className="text-sm flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-muted text-muted-foreground text-xs font-bold flex items-center justify-center">{i + 1}</span>
                <span>{typeof cond === "string" ? cond : cond.description || cond.condition || String(cond)}</span>
              </li>
            ))}
          </ol>
        </SectionCard>
      )}

      {protections && typeof protections === "object" && (
        <SectionCard icon={ShieldCheck} title="Post-Acquisition Protection" accent="border-l-blue-500">
          <div className="space-y-4">
            {(protections.key_warranties || protections.warranties || []).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Key Warranties</p>
                <BulletList items={protections.key_warranties || protections.warranties} variant="info" />
              </div>
            )}
            {(protections.indemnities || []).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Indemnities</p>
                <BulletList items={protections.indemnities} variant="concern" />
              </div>
            )}
            {(protections.retention_recommended != null || protections.escrow_recommended != null) && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Retention / Escrow:</span>
                <Badge className={`${(protections.retention_recommended || protections.escrow_recommended) ? "bg-green-600 text-white" : "bg-muted text-muted-foreground"}`}>
                  {(protections.retention_recommended || protections.escrow_recommended) ? "Recommended" : "Not Required"}
                </Badge>
                {(protections.retention_amount || protections.escrow_amount) && (
                  <span className="text-sm font-mono font-bold">{formatCurrency(protections.retention_amount || protections.escrow_amount)}</span>
                )}
              </div>
            )}
            {typeof protections === "object" && !protections.key_warranties && !protections.warranties && !protections.indemnities && protections.retention_recommended == null && protections.escrow_recommended == null && (
              <KeyValueGrid items={Object.entries(protections).filter(([, v]) => typeof v !== "object" || v === null).map(([k, v]) => ({
                label: formatLabel(k),
                value: String(v ?? "—"),
              }))} />
            )}
          </div>
        </SectionCard>
      )}

      {integrationPriorities.length > 0 && (
        <SectionCard icon={ListOrdered} title="First 100 Days" accent="border-l-emerald-500">
          <ol className="space-y-2">
            {integrationPriorities.map((item: any, i: number) => (
              <li key={i} className="text-sm flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                <span>{typeof item === "string" ? item : item.description || item.action || item.priority || String(item)}</span>
              </li>
            ))}
          </ol>
        </SectionCard>
      )}
    </div>
  );
}

export function SynthesisReportView({ data }: { data: Record<string, unknown> }) {
  const d = data as any;
  const recommendation = d.recommendation || "";
  const overallScore = d.overall_score ?? 0;
  const scoresDashboard = d.scores_dashboard || {};
  const consensus = d.expert_consensus || {};
  const devil = d.devils_advocate || {};
  const thesis = d.investment_thesis || {};
  const infoRequests = d.information_requests || {};
  const valSummary = d.valuation_summary || {};
  const equityRange = valSummary.equity_value_range || {};

  const isGreen = recommendation === "STRONG_PROCEED" || recommendation === "PROCEED";
  const isAmber = recommendation === "PROCEED_WITH_CAUTION";

  const verdictColor = isGreen
    ? "bg-green-500/5 border-green-500/30"
    : isAmber
      ? "bg-amber-500/5 border-amber-500/30"
      : "bg-red-500/5 border-red-500/30";

  const verdictBadgeColor = isGreen
    ? "bg-green-600 hover:bg-green-700"
    : isAmber
      ? "bg-amber-600 hover:bg-amber-700"
      : "bg-red-600 hover:bg-red-700";

  const expertOrder = ["financial", "operational", "risk", "quality_of_earnings", "sector", "valuation", "deal_structure"];

  function renderNarrativeReport(text: string) {
    const lines = text.split("\n");
    const elements: React.ReactNode[] = [];
    let currentParagraph: string[] = [];

    const flushParagraph = () => {
      if (currentParagraph.length > 0) {
        elements.push(
          <p key={`p-${elements.length}`} className="text-sm leading-relaxed mb-3">
            {currentParagraph.join("\n")}
          </p>
        );
        currentParagraph = [];
      }
    };

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (trimmed.length === 0) {
        flushParagraph();
        return;
      }
      if (trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed) && trimmed.length > 2) {
        flushParagraph();
        elements.push(
          <h3 key={`h-${elements.length}`} className="text-sm font-bold uppercase tracking-wide text-foreground mt-5 mb-2 border-b border-muted pb-1">
            {trimmed}
          </h3>
        );
      } else {
        currentParagraph.push(trimmed);
      }
    });
    flushParagraph();
    return elements;
  }

  const criticalRequests = infoRequests.critical || [];
  const importantRequests = infoRequests.important || [];
  const niceToHaveRequests = infoRequests.nice_to_have || [];

  return (
    <div className="space-y-6">
      {(recommendation || overallScore > 0) && (
        <div className={`rounded-xl p-6 border-2 ${verdictColor}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">Combined Verdict</p>
              <Badge className={`text-lg px-4 py-1.5 font-bold tracking-wide ${verdictBadgeColor} text-white`}>
                {recommendation.replace(/_/g, " ") || "—"}
              </Badge>
              <p className="text-xs text-muted-foreground mt-3">Combined verdict across 8 specialist expert analyses</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">Overall Score</p>
              <ScoreRing score={overallScore} size="lg" />
            </div>
          </div>
        </div>
      )}

      {d.executive_summary && (
        <SectionCard icon={Brain} title="Executive Summary" accent="border-l-indigo-500">
          <NarrativeBlock text={d.executive_summary} />
        </SectionCard>
      )}

      {Object.keys(scoresDashboard).length > 0 && (
        <SectionCard icon={BarChart3} title="Scores Dashboard" accent="border-l-blue-500">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {expertOrder.map((key) => {
              const entry = scoresDashboard[key];
              if (!entry) return null;
              const score = entry.score ?? 0;
              return (
                <div key={key} className="border rounded-xl p-4 bg-gradient-to-br from-background to-muted/30 space-y-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{formatLabel(key)}</p>
                  <div className="flex items-center justify-between">
                    <span className={`text-lg font-bold ${score >= 70 ? "text-green-600" : score >= 40 ? "text-amber-600" : "text-red-600"}`}>
                      {score}/100
                    </span>
                    {entry.confidence && (
                      <Badge variant="outline" className="text-[10px] capitalize">{entry.confidence}</Badge>
                    )}
                  </div>
                  <ScoreBar score={score} />
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {(equityRange.low !== undefined || equityRange.mid !== undefined || equityRange.high !== undefined) && (
        <SectionCard icon={CircleDollarSign} title="Valuation Snapshot" accent="border-l-emerald-500">
          <div className="grid grid-cols-3 gap-4 mb-4">
            {[
              { k: "low", l: "Conservative" },
              { k: "mid", l: "Base Case", highlight: true },
              { k: "high", l: "Optimistic" },
            ].filter(({ k }) => equityRange[k] !== undefined && equityRange[k] !== null).map(({ k, l, highlight }) => (
              <div key={k} className={`border rounded-xl p-5 text-center ${highlight ? "border-primary bg-primary/5 ring-1 ring-primary/20" : ""}`}>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">{l}</p>
                <p className="text-2xl font-bold tracking-tight">{formatCurrency(equityRange[k])}</p>
                <p className="text-xs text-muted-foreground mt-1">Equity Value</p>
              </div>
            ))}
          </div>
          {valSummary.recommended_offer && (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm text-muted-foreground">Recommended Offer:</span>
              <span className="text-sm font-bold">{typeof valSummary.recommended_offer === "number" ? formatCurrency(valSummary.recommended_offer) : String(valSummary.recommended_offer)}</span>
            </div>
          )}
          {valSummary.recommended_structure && (
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className="text-sm text-muted-foreground">Recommended Structure:</span>
              <Badge variant="outline" className="capitalize font-medium">{valSummary.recommended_structure}</Badge>
            </div>
          )}
        </SectionCard>
      )}

      {(consensus.agreements?.length > 0 || consensus.contradictions?.length > 0) && (
        <SectionCard icon={Users} title="Expert Consensus" accent="border-l-purple-500">
          <div className="space-y-5">
            {consensus.agreements?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Where Experts Agreed</p>
                <BulletList items={consensus.agreements} variant="strength" />
              </div>
            )}
            {consensus.contradictions?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Where Experts Disagreed</p>
                <div className="space-y-3">
                  {consensus.contradictions.map((c: any, i: number) => (
                    <div key={i} className="border rounded-lg overflow-hidden">
                      <div className="grid grid-cols-2 divide-x">
                        <div className="p-3 bg-blue-500/5">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{c.expert_a || "Expert A"}</p>
                          <p className="text-sm">{c.expert_a_view || "—"}</p>
                        </div>
                        <div className="p-3 bg-amber-500/5">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{c.expert_b || "Expert B"}</p>
                          <p className="text-sm">{c.expert_b_view || "—"}</p>
                        </div>
                      </div>
                      {c.resolution && (
                        <div className="px-3 py-2 bg-muted/30 border-t">
                          <p className="text-xs"><span className="font-semibold">Resolution:</span> {c.resolution}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {(devil.worst_case_scenario || devil.weakest_assumptions?.length > 0 || devil.underweighted_risks?.length > 0) && (
        <SectionCard icon={AlertTriangle} title="Devil's Advocate" accent="border-l-amber-500">
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4 space-y-4">
            {devil.worst_case_scenario && (
              <div>
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-2">Worst Case Scenario</p>
                <p className="text-sm leading-relaxed">{devil.worst_case_scenario}</p>
              </div>
            )}
            {devil.weakest_assumptions?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-2">Weakest Assumptions</p>
                <BulletList items={devil.weakest_assumptions} variant="concern" />
              </div>
            )}
            {devil.underweighted_risks?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-2">Underweighted Risks</p>
                <BulletList items={devil.underweighted_risks} variant="concern" />
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {(thesis.positive_case || thesis.conditions_for_success?.length > 0 || thesis.integration_priorities_100_days?.length > 0) && (
        <SectionCard icon={TrendingUp} title="Investment Thesis" accent="border-l-green-500">
          <div className="space-y-4">
            {thesis.positive_case && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Positive Case</p>
                <NarrativeBlock text={thesis.positive_case} />
              </div>
            )}
            {thesis.conditions_for_success?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Conditions for Success</p>
                <ol className="space-y-2">
                  {thesis.conditions_for_success.map((item: string, i: number) => (
                    <li key={i} className="flex gap-3 p-3 rounded-lg border bg-green-500/5 border-green-500/10">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-500/20 text-green-700 dark:text-green-400 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                      <span className="text-sm leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {thesis.integration_priorities_100_days?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Integration Priorities (First 100 Days)</p>
                <ol className="space-y-2">
                  {thesis.integration_priorities_100_days.map((item: string, i: number) => (
                    <li key={i} className="flex gap-3 p-3 rounded-lg border bg-blue-500/5 border-blue-500/10">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500/20 text-blue-700 dark:text-blue-400 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                      <span className="text-sm leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {(criticalRequests.length > 0 || importantRequests.length > 0 || niceToHaveRequests.length > 0) && (
        <SectionCard icon={FileText} title="Information Requests" accent="border-l-red-500">
          <div className="space-y-5">
            {criticalRequests.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  <p className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wide">Critical</p>
                </div>
                <div className="space-y-2">
                  {criticalRequests.map((req: any, i: number) => (
                    <div key={i} className="border border-red-500/20 bg-red-500/5 rounded-lg p-3 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold">{typeof req === "string" ? req : req.request || req.item || "—"}</p>
                        {req.source_expert && <Badge variant="outline" className="text-[10px] capitalize flex-shrink-0">{formatLabel(req.source_expert)}</Badge>}
                      </div>
                      {req.rationale && <p className="text-xs text-muted-foreground">{req.rationale}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {importantRequests.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">Important</p>
                </div>
                <div className="space-y-2">
                  {importantRequests.map((req: any, i: number) => (
                    <div key={i} className="border border-amber-500/20 bg-amber-500/5 rounded-lg p-3 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold">{typeof req === "string" ? req : req.request || req.item || "—"}</p>
                        {req.source_expert && <Badge variant="outline" className="text-[10px] capitalize flex-shrink-0">{formatLabel(req.source_expert)}</Badge>}
                      </div>
                      {req.rationale && <p className="text-xs text-muted-foreground">{req.rationale}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {niceToHaveRequests.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground" />
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nice to Have</p>
                </div>
                <div className="space-y-2">
                  {niceToHaveRequests.map((req: any, i: number) => (
                    <div key={i} className="border rounded-lg p-3 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold">{typeof req === "string" ? req : req.request || req.item || "—"}</p>
                        {req.source_expert && <Badge variant="outline" className="text-[10px] capitalize flex-shrink-0">{formatLabel(req.source_expert)}</Badge>}
                      </div>
                      {req.rationale && <p className="text-xs text-muted-foreground">{req.rationale}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {d.narrative_report && (
        <div className="border rounded-lg overflow-hidden">
          <div className="flex items-center gap-2.5 px-4 py-3 bg-muted/40 border-b">
            <Brain className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm tracking-tight">Investment Memorandum</h3>
          </div>
          <div className="p-5 bg-muted/10">
            {renderNarrativeReport(d.narrative_report)}
          </div>
        </div>
      )}
    </div>
  );
}

export function GenericReportView({ data }: { data: Record<string, unknown> }) {
  const SKIP = new Set(["expert", "company_name", "sector", "analysis_date", "score", "confidence"]);

  function renderValue(value: unknown, depth: number = 0): React.ReactNode {
    if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>;
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "number") return value.toLocaleString();
    if (typeof value === "string") {
      if (["GREEN", "AMBER", "RED"].includes(value)) return <RagBadge rag={value} />;
      if (value.length > 100) return <NarrativeBlock text={value} />;
      return value;
    }
    if (Array.isArray(value)) {
      if (value.length === 0) return <span className="text-muted-foreground italic">None</span>;
      if (typeof value[0] === "string") return <BulletList items={value} variant="info" />;
      return (
        <div className="space-y-2">
          {value.map((item, i) => (
            <div key={i} className="border rounded-lg p-3 text-sm">{renderValue(item, depth + 1)}</div>
          ))}
        </div>
      );
    }
    if (typeof value === "object") {
      const entries = Object.entries(value as Record<string, unknown>);
      return (
        <div className={`space-y-2 ${depth > 0 ? "pl-3 border-l-2 border-muted" : ""}`}>
          {entries.map(([k, v]) => (
            <div key={k}>
              <span className="text-sm font-medium text-muted-foreground">{formatLabel(k)}: </span>
              {typeof v === "object" && v !== null ? (
                <div className="mt-1">{renderValue(v, depth + 1)}</div>
              ) : (
                <span className="text-sm">{renderValue(v, depth + 1) as any}</span>
              )}
            </div>
          ))}
        </div>
      );
    }
    return String(value);
  }

  const topLevel = Object.entries(data).filter(([k]) => !SKIP.has(k));
  const narrativeEntry = topLevel.find(([k]) => k === "narrative");
  const keyFindings = topLevel.find(([k]) => k === "key_findings");
  const otherEntries = topLevel.filter(([k]) => k !== "narrative" && k !== "key_findings");

  return (
    <div className="space-y-6">
      {otherEntries.map(([key, value]) => {
        if (typeof value === "object" && value !== null && !Array.isArray(value)) {
          return (
            <SectionCard key={key} icon={Info} title={formatLabel(key)} accent="border-l-blue-500">
              {renderValue(value)}
            </SectionCard>
          );
        }
        return (
          <div key={key}>
            <p className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wide">{formatLabel(key)}</p>
            <div className="text-sm">{renderValue(value)}</div>
          </div>
        );
      })}

      {keyFindings && (
        <SectionCard icon={CheckCircle2} title="Key Findings" accent="border-l-green-500">
          <BulletList items={keyFindings[1] as string[]} variant="strength" />
        </SectionCard>
      )}

      {narrativeEntry && (
        <SectionCard icon={Brain} title="Narrative" accent="border-l-indigo-500">
          <NarrativeBlock text={narrativeEntry[1] as string} />
        </SectionCard>
      )}
    </div>
  );
}

interface CoreExpertResult {
  expertType: string;
  status: string;
  analysisData: Record<string, unknown> | null;
  score: number | null;
}

const CORE_EXPERT_ICONS: Record<string, { icon: LucideIcon; label: string; color: string }> = {
  financial: { icon: DollarSign, label: "Financials", color: "text-emerald-500" },
  operational: { icon: BarChart3, label: "Operational", color: "text-blue-500" },
  risk: { icon: Shield, label: "Risk", color: "text-red-500" },
  qoe: { icon: ShieldCheck, label: "Quality of Earnings", color: "text-amber-500" },
  sector: { icon: Layers, label: "Sector", color: "text-purple-500" },
  valuation: { icon: TrendingUp, label: "Valuation", color: "text-teal-500" },
  deal_structure: { icon: Handshake, label: "Deal Structure", color: "text-orange-500" },
};

export function CoreAnalysisSummaryView({ results }: { results: CoreExpertResult[] }) {
  const getResult = (type: string) => results.find((r) => r.expertType === type);
  const getData = (type: string) => {
    const r = getResult(type);
    if (!r || r.status !== "success" || !r.analysisData) return null;
    return r.analysisData as any;
  };

  const synthesis = getData("synthesis");
  const qoe = getData("qoe");
  const financial = getData("financial");
  const screening = getData("screening");

  if (!synthesis) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Brain className="w-12 h-12 mx-auto mb-4 opacity-40" />
        <p className="text-sm font-medium">Analysis is still in progress</p>
        <p className="text-xs mt-1">The summary will appear once all expert analyses are complete.</p>
      </div>
    );
  }

  const recommendation = synthesis.recommendation || "";
  const overallScore = synthesis.overall_score ?? 0;
  const isGreen = recommendation === "STRONG_PROCEED" || recommendation === "PROCEED";
  const isAmber = recommendation === "PROCEED_WITH_CAUTION";
  const verdictBg = isGreen ? "bg-green-500/10 border-green-500/30" : isAmber ? "bg-amber-500/10 border-amber-500/30" : "bg-red-500/10 border-red-500/30";
  const verdictBadge = isGreen ? "bg-green-600" : isAmber ? "bg-amber-600" : "bg-red-600";
  const scoreColor = overallScore >= 70 ? "text-green-600" : overallScore >= 40 ? "text-amber-600" : "text-red-600";

  const execSummary = synthesis.executive_summary || "";
  const thesis = synthesis.investment_thesis || {};
  const devil = synthesis.devils_advocate || {};
  const valSummary = synthesis.valuation_summary || {};
  const equityRange = valSummary.equity_value_range || {};
  const scoresDashboard = synthesis.scores_dashboard || {};
  const infoRequests = synthesis.information_requests || {};

  const positiveCase = thesis.positive_case || thesis.bull_case || "";
  const positiveBullets = typeof positiveCase === "string"
    ? positiveCase.split(/\n|(?<=[.!?])\s+/).filter((s: string) => s.trim().length > 10).slice(0, 3)
    : Array.isArray(positiveCase) ? positiveCase.slice(0, 3) : [];

  const weakAssumptions = devil.weakest_assumptions || devil.bear_case_points || devil.key_risks || [];

  const reportedEbitda = qoe?.reported_figures?.reported_ebitda;
  const adjustedEbitda = qoe?.adjusted_ebitda?.base ?? qoe?.adjusted_ebitda?.mid;
  const revenue = financial?.income_statement?.[0]?.revenue ?? financial?.revenue ?? screening?.financials?.revenue;
  const recommendedOffer = valSummary.recommended_offer ?? valSummary.recommended_offer_price;

  const ebitdaGap = (reportedEbitda != null && adjustedEbitda != null) ? reportedEbitda - adjustedEbitda : null;
  const significantGap = ebitdaGap != null && ebitdaGap > 0 && ebitdaGap > (reportedEbitda * 0.1);

  const expertOrder = ["financial", "operational", "risk", "qoe", "sector", "valuation", "deal_structure"];

  const criticalQuestions = (infoRequests.critical || []).slice(0, 5);

  return (
    <div className="space-y-8">
      <div className={`rounded-xl p-6 border-2 ${verdictBg} text-center`}>
        <Badge className={`${verdictBadge} text-white text-lg px-6 py-2 mb-3`}>
          {recommendation.replace(/_/g, " ")}
        </Badge>
        <p className={`text-3xl font-bold ${scoreColor} mt-2`}>{overallScore} / 100</p>
        <p className="text-xs text-muted-foreground mt-2">Based on AI analysis across 8 specialist areas</p>
      </div>

      {execSummary && (
        <SectionCard icon={Brain} title="What This Means" accent="border-l-indigo-500">
          <div className="prose prose-sm max-w-none dark:prose-invert">
            {execSummary.split(/\n\n|\n/).filter((p: string) => p.trim()).map((p: string, i: number) => (
              <p key={i} className="text-sm leading-relaxed mb-3 last:mb-0">{p.trim()}</p>
            ))}
          </div>
        </SectionCard>
      )}

      {(positiveBullets.length > 0 || weakAssumptions.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-green-500/10 border-b border-green-500/20">
              <h3 className="font-semibold text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Reasons to Proceed
              </h3>
            </div>
            <div className="p-4">
              {positiveBullets.length > 0 ? (
                <BulletList items={positiveBullets.map((b: any) => typeof b === "string" ? b : b.description || String(b))} variant="strength" />
              ) : (
                <p className="text-xs text-muted-foreground italic">No positive case data available</p>
              )}
            </div>
          </div>
          <div className="border rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-amber-500/10 border-b border-amber-500/20">
              <h3 className="font-semibold text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Reasons for Caution
              </h3>
            </div>
            <div className="p-4">
              {weakAssumptions.length > 0 ? (
                <BulletList items={weakAssumptions.slice(0, 3).map((a: any) => typeof a === "string" ? a : a.assumption || a.description || String(a))} variant="concern" />
              ) : (
                <p className="text-xs text-muted-foreground italic">No caution points identified</p>
              )}
            </div>
          </div>
        </div>
      )}

      <SectionCard icon={CircleDollarSign} title="Key Numbers" accent="border-l-emerald-500">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {revenue != null && <MetricCard label="Revenue" value={formatCurrency(revenue)} />}
          {reportedEbitda != null && <MetricCard label="Reported EBITDA" value={formatCurrency(reportedEbitda)} />}
          {adjustedEbitda != null && (
            <MetricCard
              label="Adjusted EBITDA"
              value={formatCurrency(adjustedEbitda)}
              color={significantGap ? "text-amber-600" : "text-emerald-600"}
            />
          )}
          {(equityRange.conservative != null || equityRange.optimistic != null || equityRange.low != null || equityRange.high != null) && (
            <MetricCard
              label="Valuation Range"
              value={`${formatCurrency(equityRange.conservative ?? equityRange.low)} — ${formatCurrency(equityRange.optimistic ?? equityRange.high)}`}
            />
          )}
          {recommendedOffer != null && (
            <MetricCard label="Recommended Offer" value={formatCurrency(recommendedOffer)} color="text-primary" />
          )}
        </div>
        {significantGap && (
          <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              Adjusted figure is {formatCurrency(ebitdaGap)} lower than reported — review Quality of Earnings
            </p>
          </div>
        )}
      </SectionCard>

      <SectionCard icon={Gauge} title="Expert Scorecard" accent="border-l-purple-500">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {expertOrder.map((expertType) => {
            const config = CORE_EXPERT_ICONS[expertType];
            if (!config) return null;
            const score = scoresDashboard[expertType]?.score ?? scoresDashboard[expertType] ?? getResult(expertType)?.score;
            const scoreNum = typeof score === "number" ? score : null;
            const pillColor = scoreNum == null ? "bg-muted" : scoreNum >= 70 ? "bg-green-600" : scoreNum >= 40 ? "bg-amber-600" : "bg-red-600";
            const Icon = config.icon;
            return (
              <div key={expertType} className="border rounded-xl p-3 text-center group relative cursor-default">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Icon className={`w-4 h-4 ${config.color}`} />
                  <span className="text-xs font-medium truncate">{config.label}</span>
                </div>
                <Badge className={`${pillColor} text-white text-sm px-3 py-0.5`}>
                  {scoreNum != null ? `${scoreNum}` : "—"}
                </Badge>
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard icon={FileText} title="Key Takeaways" accent="border-l-teal-500">
        <div className="space-y-4">
          {expertOrder.map((expertType) => {
            const config = CORE_EXPERT_ICONS[expertType];
            if (!config) return null;
            const expertData = getData(expertType);
            const result = getResult(expertType);
            if (!result || result.status !== "success") return null;

            const Icon = config.icon;
            const score = result.score ?? (expertData?.overall_score as number | undefined);
            const pillColor = score == null ? "bg-muted" : score >= 70 ? "bg-green-600" : score >= 40 ? "bg-amber-600" : "bg-red-600";
            const keyFindings = (expertData?.key_findings || []).slice(0, 3);

            let footerFlag: { text: string; severity: "red" | "amber" } | null = null;
            if (expertType === "risk") {
              const dealBreakers = expertData?.deal_breakers || [];
              if (dealBreakers.length > 0) {
                const first = dealBreakers[0];
                footerFlag = { text: typeof first === "string" ? first : first.description || first.name || String(first), severity: "red" };
              } else if (expertData?.red_flags?.length > 0) {
                const first = expertData.red_flags[0];
                footerFlag = { text: typeof first === "string" ? first : first.description || first.flag || String(first), severity: "amber" };
              }
            } else if (expertType === "qoe" && significantGap) {
              footerFlag = { text: `Adjusted EBITDA is ${formatCurrency(ebitdaGap)} lower than reported`, severity: "amber" };
            } else if (expertData?.red_flags?.length > 0) {
              const first = expertData.red_flags[0];
              footerFlag = { text: typeof first === "string" ? first : first.description || first.flag || String(first), severity: "amber" };
            }

            return (
              <div key={expertType} className="border rounded-xl overflow-hidden group relative cursor-default">
                <div className="px-4 py-3 bg-muted/30 border-b flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${config.color}`} />
                    <span className="text-sm font-semibold">{config.label}</span>
                  </div>
                  <Badge className={`${pillColor} text-white text-xs`}>
                    {score != null ? `${score}/100` : "—"}
                  </Badge>
                </div>
                <div className="p-4">
                  {keyFindings.length > 0 ? (
                    <BulletList items={keyFindings.map((f: any) => typeof f === "string" ? f : f.description || String(f))} variant="info" />
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Analysis complete — upgrade to view detailed findings</p>
                  )}
                </div>
                {footerFlag && (
                  <div className={`px-4 py-2.5 border-t ${
                    footerFlag.severity === "red" ? "bg-red-500/10 border-red-500/20" : "bg-amber-500/10 border-amber-500/20"
                  }`}>
                    <p className={`text-xs flex items-center gap-1.5 ${
                      footerFlag.severity === "red" ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400"
                    }`}>
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      {footerFlag.text}
                    </p>
                  </div>
                )}
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <Lock className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {criticalQuestions.length > 0 && (
        <div className="border-2 border-indigo-500/20 rounded-xl overflow-hidden bg-indigo-500/5">
          <div className="px-5 py-3 bg-indigo-500/10 border-b border-indigo-500/20">
            <h3 className="font-semibold text-sm text-indigo-700 dark:text-indigo-400 flex items-center gap-2">
              <Info className="w-4 h-4" /> Top Questions to Ask the Seller
            </h3>
          </div>
          <div className="p-5">
            <ol className="space-y-2">
              {criticalQuestions.map((q: any, i: number) => (
                <li key={i} className="text-sm flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                  <span>{typeof q === "string" ? q : q.request || q.question || q.description || String(q)}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-indigo-500/20 overflow-hidden bg-gradient-to-br from-indigo-50/50 via-background to-blue-50/30 dark:from-indigo-950/20 dark:via-background dark:to-blue-950/10">
        <div className="p-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Lock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-lg font-semibold">Unlock the full picture</h3>
          </div>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
            You're on the Core plan. Upgrade to Professional to access detailed reports from all 8 specialist expert areas.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-lg mx-auto mb-8">
            {[
              { icon: "📊", title: "Deep-dive Financials", desc: "P&L trends and CAGR analysis" },
              { icon: "🏦", title: "EBITDA Bridge", desc: "Waterfall + full add-backs detail" },
              { icon: "📈", title: "Sensitivity Analysis", desc: "Valuation bridge and scenarios" },
              { icon: "🤝", title: "Deal Structures", desc: "3-way comparison with mechanics" },
              { icon: "🏭", title: "Sector Benchmarks", desc: "Margins and comparables" },
              { icon: "📝", title: "Full Memorandum", desc: "Investment memo (2,000+ words)" },
            ].map((tile, i) => (
              <div key={i} className="border rounded-lg p-4 bg-background/60 text-left">
                <p className="text-lg mb-1.5">{tile.icon}</p>
                <p className="text-sm font-semibold mb-0.5">{tile.title}</p>
                <p className="text-xs text-muted-foreground leading-snug">{tile.desc}</p>
              </div>
            ))}
          </div>
          <a href="/billing">
            <button className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-8 py-3 text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm">
              Upgrade to Professional — from £127/mo
            </button>
          </a>
          <p className="text-xs text-muted-foreground mt-3">No commitment. Cancel anytime.</p>
        </div>
      </div>
    </div>
  );
}

export function getReportViewForExpert(expertType: string, rawData: Record<string, unknown>) {
  const data = (Array.isArray(rawData) ? rawData[0] : rawData) as Record<string, unknown>;
  switch (expertType) {
    case "data_quality": return <DataQualityReportView data={data} />;
    case "screening": return <ScreeningReportView data={data} />;
    case "financial": return <FinancialReportView data={data} />;
    case "operational": return <OperationalReportView data={data} />;
    case "risk": return <RiskReportView data={data} />;
    case "qoe": return <QoEReportView data={data} />;
    case "sector": return <SectorReportView data={data} />;
    case "valuation": return <ValuationReportView data={data} />;
    case "deal_structure": return <DealStructureReportView data={data} />;
    case "synthesis": return <SynthesisReportView data={data} />;
    default: return <GenericReportView data={data} />;
  }
}
