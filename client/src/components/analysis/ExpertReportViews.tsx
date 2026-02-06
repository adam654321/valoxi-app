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
  type LucideIcon,
} from "lucide-react";

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
    <span className={`inline-flex items-center rounded-full font-bold tracking-wide ${colors[rag] || "bg-gray-100 text-gray-600"} ${sizing}`}>
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
  return <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold capitalize tracking-wide ${colors[level] || "bg-gray-100 text-gray-600"}`}>{level}</span>;
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

      {d.executive_summary && (
        <SectionCard icon={Brain} title="Executive Summary" accent="border-l-indigo-500">
          <NarrativeBlock text={d.executive_summary} />
        </SectionCard>
      )}

      <SectionCard icon={Target} title="Screening Dimensions" accent="border-l-blue-500">
        <div className="space-y-4">
          {Object.entries(dims).map(([key, dim]: [string, any]) => {
            const ragColor = dim.rag === "GREEN" ? "border-l-green-500 bg-green-500/3" : dim.rag === "AMBER" ? "border-l-amber-500 bg-amber-500/3" : "border-l-red-500 bg-red-500/3";
            return (
              <div key={key} className={`border rounded-lg border-l-4 overflow-hidden ${ragColor}`}>
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm tracking-tight">{formatLabel(key)}</h4>
                    <div className="flex items-center gap-3">
                      <ScoreRing score={dim.score} size="sm" />
                      <RagBadge rag={dim.rag} size="lg" />
                    </div>
                  </div>
                  <ScoreBar score={dim.score} />
                  {dim.explanation && (
                    <p className="text-sm text-muted-foreground leading-relaxed">{dim.explanation}</p>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                    {Object.entries(dim)
                      .filter(([k]) => !["rag", "score", "explanation"].includes(k))
                      .map(([k, v]) => (
                        <div key={k} className="bg-background/60 rounded-lg px-3 py-2">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{formatLabel(k)}</p>
                          <p className="text-sm font-semibold mt-0.5">
                            {typeof v === "number"
                              ? k.includes("percent") ? formatPercent(v)
                              : k.includes("revenue") || k.includes("assets") || k.includes("cash") || k.includes("nbv") || k.includes("debt") ? formatCurrency(v)
                              : v.toLocaleString()
                              : String(v ?? "—")}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

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
        <SectionCard icon={FileText} title="Questions for Seller" accent="border-l-purple-500">
          <BulletList items={d.questions_for_seller} variant="question" />
        </SectionCard>
      )}

      {d.comparable_context && (
        <SectionCard icon={Building} title="Comparable Context" accent="border-l-slate-500">
          <NarrativeBlock text={d.comparable_context} />
        </SectionCard>
      )}

      {d.recommendation_justification && (
        <SectionCard icon={Brain} title="Recommendation Justification" accent="border-l-indigo-500">
          <NarrativeBlock text={d.recommendation_justification} />
        </SectionCard>
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

  const latestYear = years[years.length - 1];
  const latestData = yearlyMetrics[latestYear] || {};

  return (
    <div className="space-y-6">
      {latestYear && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard label="Revenue" value={formatCurrency(latestData.revenue)} subtext={latestYear} color={colorForValue(latestData.revenue)} />
          <MetricCard label="Gross Margin" value={formatPercent(latestData.gross_margin_percent)} subtext={latestYear} />
          <MetricCard label="EBITDA" value={formatCurrency(latestData.ebitda)} subtext={latestYear} color={colorForValue(latestData.ebitda)} />
          <MetricCard label="Net Margin" value={formatPercent(latestData.net_margin_percent)} subtext={latestYear} />
        </div>
      )}

      {years.length > 0 && (
        <SectionCard icon={DollarSign} title="Yearly Financial Metrics" accent="border-l-emerald-500">
          <div className="overflow-x-auto -mx-4 px-4">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="sticky left-0 bg-muted/30 font-bold">Metric</TableHead>
                  {years.map((y) => (
                    <TableHead key={y} className="text-right min-w-[100px] font-bold">{y}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  { key: "revenue", label: "Revenue", format: "currency" },
                  { key: "revenue_yoy_growth_percent", label: "Revenue Growth", format: "percent", colored: true },
                  { key: "gross_profit", label: "Gross Profit", format: "currency" },
                  { key: "gross_margin_percent", label: "Gross Margin", format: "percent" },
                  { key: "operating_profit", label: "Operating Profit", format: "currency" },
                  { key: "operating_margin_percent", label: "Operating Margin", format: "percent" },
                  { key: "ebitda", label: "EBITDA", format: "currency" },
                  { key: "net_profit", label: "Net Profit", format: "currency", colored: true },
                  { key: "net_margin_percent", label: "Net Margin", format: "percent" },
                  { key: "interest_coverage_ratio", label: "Interest Coverage", format: "number" },
                  { key: "effective_tax_rate_percent", label: "Effective Tax Rate", format: "percent" },
                ].map(({ key, label, format, colored }, idx) => (
                  <TableRow key={key} className={idx % 2 === 0 ? "bg-muted/10" : ""}>
                    <TableCell className="sticky left-0 bg-inherit font-medium text-sm whitespace-nowrap">{label}</TableCell>
                    {years.map((y) => {
                      const val = yearlyMetrics[y]?.[key];
                      return (
                        <TableCell key={y} className={`text-right text-sm font-mono ${colored ? colorForValue(val) : ""}`}>
                          {format === "currency" ? formatCurrency(val) : format === "percent" ? (
                            <span>{formatPercent(val)} <TrendIcon val={val} /></span>
                          ) : formatNumber(val)}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </SectionCard>
      )}

      {Object.keys(cagr).length > 0 && (
        <SectionCard icon={TrendingUp} title="Growth Rates (CAGR)" accent="border-l-teal-500">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(cagr).map(([key, val]: [string, any]) => (
              <div key={key} className="border rounded-xl p-4 text-center bg-gradient-to-br from-background to-muted/30">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{formatLabel(key)}</p>
                <p className={`text-xl font-bold ${colorForValue(val)}`}>
                  {typeof val === "number" ? formatPercent(val) : String(val ?? "—")} <TrendIcon val={typeof val === "number" ? val : null} />
                </p>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {Object.keys(costStructure).length > 0 && (
        <SectionCard icon={BarChart3} title="Cost Structure" accent="border-l-blue-500">
          <KeyValueGrid items={Object.entries(costStructure).map(([k, v]) => ({
            label: formatLabel(k),
            value: typeof v === "number" ? (k.includes("percent") ? formatPercent(v as number) : formatCurrency(v as number)) : String(v ?? "—"),
          }))} />
        </SectionCard>
      )}

      {Object.keys(earningsQuality).length > 0 && (
        <SectionCard icon={ShieldCheck} title="Earnings Quality" accent="border-l-amber-500">
          <KeyValueGrid items={Object.entries(earningsQuality).map(([k, v]) => ({
            label: formatLabel(k),
            value: typeof v === "number" ? (k.includes("percent") ? formatPercent(v as number) : formatCurrency(v as number)) : String(v ?? "—"),
          }))} />
        </SectionCard>
      )}

      {Object.keys(debtService).length > 0 && (
        <SectionCard icon={Shield} title="Debt Service" accent="border-l-red-500">
          <KeyValueGrid items={Object.entries(debtService).map(([k, v]) => ({
            label: formatLabel(k),
            value: typeof v === "number" ? formatCurrency(v as number) : String(v ?? "—"),
          }))} />
        </SectionCard>
      )}

      {d.key_findings?.length > 0 && (
        <SectionCard icon={CheckCircle2} title="Key Findings" accent="border-l-green-500">
          <BulletList items={d.key_findings} variant="strength" />
        </SectionCard>
      )}

      {d.narrative && (
        <SectionCard icon={Brain} title="Narrative" accent="border-l-indigo-500">
          <NarrativeBlock text={d.narrative} />
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
  const capex = d.capex || {};
  const workforce = d.workforce || {};
  const ownerDep = d.owner_dependency || {};
  const scalability = d.scalability || {};

  return (
    <div className="space-y-6">
      {wcYears.length > 0 && (
        <SectionCard icon={BarChart3} title="Working Capital" accent="border-l-blue-500">
          <div className="flex items-center gap-4 mb-4">
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
          <div className="overflow-x-auto -mx-4 px-4">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="sticky left-0 bg-muted/30 font-bold">Metric</TableHead>
                  {wcYears.map((y) => <TableHead key={y} className="text-right min-w-[90px] font-bold">{y}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {["debtor_days", "creditor_days", "stock_days", "cash_conversion_cycle_days", "net_working_capital", "working_capital_percent_revenue"].map((key, idx) => (
                  <TableRow key={key} className={idx % 2 === 0 ? "bg-muted/10" : ""}>
                    <TableCell className="sticky left-0 bg-inherit font-medium text-sm whitespace-nowrap">{formatLabel(key)}</TableCell>
                    {wcYears.map((y) => {
                      const val = wcMetrics[y]?.[key];
                      return (
                        <TableCell key={y} className="text-right text-sm font-mono">
                          {key === "net_working_capital" ? formatCurrency(val) : key.includes("percent") ? formatPercent(val) : formatNumber(val)}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {wc.observations?.length > 0 && <div className="mt-4"><BulletList items={wc.observations} variant="info" /></div>}
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

      {Object.keys(workforce).length > 0 && (
        <SectionCard icon={Users} title="Workforce & Productivity" accent="border-l-purple-500">
          <KeyValueGrid items={Object.entries(workforce).filter(([k]) => k !== "observations" && !Array.isArray(workforce[k])).map(([k, v]) => ({
            label: formatLabel(k),
            value: typeof v === "number" ? (k.includes("percent") ? formatPercent(v as number) : k.includes("revenue") || k.includes("cost") || k.includes("salary") ? formatCurrency(v as number) : formatNumber(v)) : String(v ?? "—"),
          }))} />
          {workforce.observations?.length > 0 && <div className="mt-4"><BulletList items={workforce.observations} variant="info" /></div>}
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

      {Object.keys(scalability).length > 0 && (
        <SectionCard icon={TrendingUp} title="Scalability Assessment" accent="border-l-green-500">
          <KeyValueGrid items={Object.entries(scalability).filter(([k]) => k !== "observations").map(([k, v]) => ({
            label: formatLabel(k),
            value: String(v ?? "—"),
          }))} />
          {scalability.observations?.length > 0 && <div className="mt-4"><BulletList items={scalability.observations} variant="info" /></div>}
        </SectionCard>
      )}

      {d.key_findings?.length > 0 && (
        <SectionCard icon={CheckCircle2} title="Key Findings" accent="border-l-green-500">
          <BulletList items={d.key_findings} variant="strength" />
        </SectionCard>
      )}

      {d.narrative && (
        <SectionCard icon={Brain} title="Narrative" accent="border-l-indigo-500">
          <NarrativeBlock text={d.narrative} />
        </SectionCard>
      )}
    </div>
  );
}

export function RiskReportView({ data }: { data: Record<string, unknown> }) {
  const d = data as any;

  const riskSections = [
    { key: "customer_concentration", label: "Customer Concentration", icon: Target, accent: "border-l-amber-500" },
    { key: "financial_risk", label: "Financial Risk", icon: DollarSign, accent: "border-l-red-500" },
    { key: "key_person_risk", label: "Key Person Risk", icon: Users, accent: "border-l-purple-500" },
    { key: "revenue_quality", label: "Revenue Quality", icon: TrendingUp, accent: "border-l-teal-500" },
    { key: "balance_sheet_risks", label: "Balance Sheet Risks", icon: BarChart3, accent: "border-l-blue-500" },
    { key: "bad_debt", label: "Bad Debt Risk", icon: AlertTriangle, accent: "border-l-orange-500" },
  ];

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

      {riskSections.map(({ key, label, icon, accent }) => {
        const section = d[key];
        if (!section || typeof section !== "object") return null;
        return (
          <SectionCard key={key} icon={icon} title={label} accent={accent}>
            <div className="space-y-4">
              {section.risk_level && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Risk Level:</span>
                  <RiskLevelBadge level={section.risk_level} />
                </div>
              )}
              <KeyValueGrid items={
                Object.entries(section)
                  .filter(([k]) => !["risk_level", "observations", "customers_over_15_percent"].includes(k) && !Array.isArray(section[k]))
                  .map(([k, v]) => ({
                    label: formatLabel(k),
                    value: typeof v === "boolean" ? (v ? "Yes" : "No") : typeof v === "number" ? (k.includes("percent") ? formatPercent(v as number) : formatNumber(v)) : String(v ?? "—"),
                  }))
              } />
              {section.customers_over_15_percent?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {section.customers_over_15_percent.map((c: string, i: number) => (
                    <Badge key={i} className="bg-red-600 text-white text-xs">{c}</Badge>
                  ))}
                </div>
              )}
              {section.observations?.length > 0 && <BulletList items={section.observations} variant="info" />}
            </div>
          </SectionCard>
        );
      })}

      {d.risk_register?.length > 0 && (
        <SectionCard icon={Shield} title="Risk Register" accent="border-l-red-500">
          <div className="space-y-3">
            {d.risk_register.map((risk: any, i: number) => (
              <div key={i} className="border rounded-lg p-4 space-y-2 bg-red-500/3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm">{risk.risk || risk.description}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {risk.likelihood && <Badge variant="outline" className="text-[10px]">L: {risk.likelihood}</Badge>}
                    {risk.impact && <Badge variant="outline" className="text-[10px]">I: {risk.impact}</Badge>}
                    {risk.severity && <RiskLevelBadge level={risk.severity} />}
                  </div>
                </div>
                {risk.mitigation && <p className="text-sm text-muted-foreground">{risk.mitigation}</p>}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {d.deal_breakers?.length > 0 && (
        <SectionCard icon={XCircle} title="Deal Breakers" accent="border-l-red-600">
          <BulletList items={d.deal_breakers.map((db: any) => typeof db === "string" ? db : db.description || db.risk)} variant="concern" />
        </SectionCard>
      )}

      {d.key_findings?.length > 0 && (
        <SectionCard icon={CheckCircle2} title="Key Findings" accent="border-l-green-500">
          <BulletList items={d.key_findings} variant="strength" />
        </SectionCard>
      )}

      {d.narrative && (
        <SectionCard icon={Brain} title="Narrative" accent="border-l-indigo-500">
          <NarrativeBlock text={d.narrative} />
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
  const sustainability = d.sustainability_assessment || {};

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Operating Profit" value={formatCurrency(reported.operating_profit)} color="text-emerald-600" />
        <MetricCard label="Depreciation" value={formatCurrency(reported.depreciation)} />
        <MetricCard label="Amortisation" value={formatCurrency(reported.amortisation)} />
        <MetricCard label="Reported EBITDA" value={formatCurrency(reported.reported_ebitda)} color="text-blue-600" subtext={reported.source_year ? `Year: ${reported.source_year}` : undefined} />
      </div>

      {addBacks.length > 0 && (
        <SectionCard icon={TrendingUp} title={`Add-Backs (${addBacks.length})`} accent="border-l-green-500">
          <div className="overflow-x-auto -mx-4 px-4">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="font-bold">Item</TableHead>
                  <TableHead className="font-bold">Category</TableHead>
                  <TableHead className="text-right font-bold">Amount</TableHead>
                  <TableHead className="font-bold">Confidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {addBacks.map((ab: any, i: number) => (
                  <TableRow key={i} className={i % 2 === 0 ? "bg-green-500/5" : ""}>
                    <TableCell className="text-sm font-medium">{ab.item}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px] capitalize">{formatLabel(ab.category || "")}</Badge></TableCell>
                    <TableCell className="text-right text-sm text-green-600 dark:text-green-400 font-bold font-mono">+{formatCurrency(ab.amount)}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px] capitalize">{ab.confidence}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {addBacks.map((ab: any) => ab.justification).filter(Boolean).length > 0 && (
            <div className="mt-3 space-y-2">
              {addBacks.filter((ab: any) => ab.justification).map((ab: any, i: number) => (
                <p key={i} className="text-xs text-muted-foreground"><strong>{ab.item}:</strong> {ab.justification}</p>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {deductions.length > 0 && (
        <SectionCard icon={AlertTriangle} title={`Deductions (${deductions.length})`} accent="border-l-red-500">
          <div className="overflow-x-auto -mx-4 px-4">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="font-bold">Item</TableHead>
                  <TableHead className="font-bold">Category</TableHead>
                  <TableHead className="text-right font-bold">Amount</TableHead>
                  <TableHead className="font-bold">Confidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deductions.map((ded: any, i: number) => (
                  <TableRow key={i} className={i % 2 === 0 ? "bg-red-500/5" : ""}>
                    <TableCell className="text-sm font-medium">{ded.item}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px] capitalize">{formatLabel(ded.category || "")}</Badge></TableCell>
                    <TableCell className="text-right text-sm text-red-600 dark:text-red-400 font-bold font-mono">-{formatCurrency(ded.amount)}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px] capitalize">{ded.confidence}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </SectionCard>
      )}

      {(adjusted.low || adjusted.mid || adjusted.high) && (
        <SectionCard icon={ShieldCheck} title="Adjusted EBITDA Range" accent="border-l-emerald-500">
          <div className="grid grid-cols-3 gap-4">
            {[
              { k: "low", l: "Conservative", color: "" },
              { k: "mid", l: "Base Case", color: "border-primary bg-primary/5 ring-1 ring-primary/20" },
              { k: "high", l: "Optimistic", color: "" },
            ].map(({ k, l, color }) => (
              <div key={k} className={`border rounded-xl p-5 text-center ${color}`}>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">{l}</p>
                <p className="text-2xl font-bold tracking-tight">{formatCurrency(adjusted[k])}</p>
              </div>
            ))}
          </div>
          {adjusted.adjustments_narrative && <div className="mt-4"><NarrativeBlock text={adjusted.adjustments_narrative} /></div>}
        </SectionCard>
      )}

      {Object.keys(directorSalary).length > 0 && (
        <SectionCard icon={Users} title="Director Salary Analysis" accent="border-l-purple-500">
          <KeyValueGrid items={Object.entries(directorSalary).filter(([k]) => k !== "observations").map(([k, v]) => ({
            label: formatLabel(k),
            value: typeof v === "number" ? (k.includes("percent") ? formatPercent(v as number) : formatCurrency(v as number)) : String(v ?? "—"),
          }))} />
        </SectionCard>
      )}

      {Object.keys(sustainability).length > 0 && (
        <SectionCard icon={Shield} title="Sustainability Assessment" accent="border-l-teal-500">
          <KeyValueGrid items={Object.entries(sustainability).filter(([k]) => !Array.isArray(sustainability[k]) && typeof sustainability[k] !== "object").map(([k, v]) => ({
            label: formatLabel(k),
            value: String(v ?? "—"),
          }))} />
        </SectionCard>
      )}

      {d.key_findings?.length > 0 && (
        <SectionCard icon={CheckCircle2} title="Key Findings" accent="border-l-green-500">
          <BulletList items={d.key_findings} variant="strength" />
        </SectionCard>
      )}

      {d.narrative && (
        <SectionCard icon={Brain} title="Narrative" accent="border-l-indigo-500">
          <NarrativeBlock text={d.narrative} />
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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {overview.growth_outlook && <MetricCard label="Growth Outlook" value={<span className="capitalize">{overview.growth_outlook}</span>} />}
        {overview.uk_market_size_estimate && <MetricCard label="UK Market Size" value={overview.uk_market_size_estimate} />}
        {positioning.company_size_classification && <MetricCard label="Company Size" value={<span className="capitalize">{positioning.company_size_classification}</span>} />}
      </div>

      {overview.key_trends?.length > 0 && (
        <SectionCard icon={TrendingUp} title="Key Sector Trends" accent="border-l-blue-500">
          <BulletList items={overview.key_trends} variant="info" />
        </SectionCard>
      )}

      {overview.regulatory_factors?.length > 0 && (
        <SectionCard icon={Shield} title="Regulatory Factors" accent="border-l-amber-500">
          <BulletList items={overview.regulatory_factors} variant="concern" />
        </SectionCard>
      )}

      {positioning.positioning_assessment && (
        <SectionCard icon={Target} title="Competitive Positioning" accent="border-l-purple-500">
          <NarrativeBlock text={positioning.positioning_assessment} />
          <div className="grid grid-cols-3 gap-3 mt-4">
            {[
              { k: "typical_gross_margin_range", l: "Gross Margin Range" },
              { k: "typical_operating_margin_range", l: "Operating Margin Range" },
              { k: "typical_ebitda_margin_range", l: "EBITDA Margin Range" },
            ].map(({ k, l }) => {
              const range = positioning[k];
              if (!range) return null;
              return (
                <div key={k} className="border rounded-xl p-4 text-center bg-gradient-to-br from-background to-muted/30">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{l}</p>
                  <p className="font-bold text-lg">{formatPercent(range.low)} — {formatPercent(range.high)}</p>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {(multiples.ev_revenue_range || multiples.ev_ebitda_range) && (
        <SectionCard icon={CircleDollarSign} title="Comparable Multiples" accent="border-l-emerald-500">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { k: "ev_revenue_range", l: "EV / Revenue" },
              { k: "ev_ebitda_range", l: "EV / EBITDA" },
            ].map(({ k, l }) => {
              const range = multiples[k];
              if (!range) return null;
              return (
                <div key={k} className="border rounded-xl p-5 bg-gradient-to-br from-background to-muted/20">
                  <p className="text-sm font-semibold mb-4">{l}</p>
                  <div className="flex justify-between items-end text-center">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Low</p>
                      <p className="text-xl font-bold text-muted-foreground">{range.low}x</p>
                    </div>
                    <div className="border-2 border-primary rounded-xl px-4 py-2 bg-primary/5">
                      <p className="text-xs text-primary mb-1">Mid</p>
                      <p className="text-2xl font-bold text-primary">{range.mid}x</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">High</p>
                      <p className="text-xl font-bold text-muted-foreground">{range.high}x</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {multiples.data_quality_note && <p className="text-xs text-muted-foreground mt-3 italic">{multiples.data_quality_note}</p>}
        </SectionCard>
      )}

      {(growth.organic?.length > 0 || growth.acquisition?.length > 0) && (
        <SectionCard icon={TrendingUp} title="Growth Opportunities" accent="border-l-green-500">
          {growth.organic?.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Organic Growth</p>
              <BulletList items={growth.organic} variant="strength" />
            </div>
          )}
          {growth.acquisition?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Acquisition Growth</p>
              <BulletList items={growth.acquisition} variant="strength" />
            </div>
          )}
        </SectionCard>
      )}

      {(sectorRisks.threats?.length > 0 || sectorRisks.cyclicality) && (
        <SectionCard icon={AlertTriangle} title="Sector Risks" accent="border-l-red-500">
          {sectorRisks.cyclicality && (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm text-muted-foreground">Cyclicality:</span>
              <Badge variant="outline" className="capitalize font-medium">{sectorRisks.cyclicality}</Badge>
            </div>
          )}
          {sectorRisks.threats?.length > 0 && <BulletList items={sectorRisks.threats} variant="concern" />}
        </SectionCard>
      )}

      {d.key_findings?.length > 0 && (
        <SectionCard icon={CheckCircle2} title="Key Findings" accent="border-l-green-500">
          <BulletList items={d.key_findings} variant="strength" />
        </SectionCard>
      )}

      {d.narrative && (
        <SectionCard icon={Brain} title="Narrative" accent="border-l-indigo-500">
          <NarrativeBlock text={d.narrative} />
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

  return (
    <div className="space-y-6">
      {Object.keys(ebitdaVal).length > 0 && (
        <SectionCard icon={DollarSign} title="EBITDA Multiple Valuation" accent="border-l-emerald-500">
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <MetricCard label="Adjusted EBITDA" value={formatCurrency(ebitdaVal.adjusted_ebitda_base)} color="text-emerald-600" />
              <MetricCard label="Selected Multiple" value={`${ebitdaVal.selected_multiple}x`} color="text-blue-600" />
              {ebitdaVal.sector_multiple_range && (
                <MetricCard label="Sector Range" value={`${ebitdaVal.sector_multiple_range.low}x – ${ebitdaVal.sector_multiple_range.high}x`} />
              )}
            </div>
            {ebitdaVal.enterprise_value_range && (
              <div className="grid grid-cols-3 gap-4">
                {[
                  { k: "conservative", l: "Conservative", color: "" },
                  { k: "base", l: "Base Case", color: "border-primary bg-primary/5 ring-1 ring-primary/20" },
                  { k: "optimistic", l: "Optimistic", color: "" },
                ].map(({ k, l, color }) => (
                  <div key={k} className={`border rounded-xl p-5 text-center ${color}`}>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">{l}</p>
                    <p className="text-2xl font-bold tracking-tight">{formatCurrency(ebitdaVal.enterprise_value_range[k])}</p>
                    <p className="text-xs text-muted-foreground mt-1">Enterprise Value</p>
                  </div>
                ))}
              </div>
            )}
            {ebitdaVal.multiple_justification && <NarrativeBlock text={ebitdaVal.multiple_justification} />}
          </div>
        </SectionCard>
      )}

      {Object.keys(bridge).length > 0 && (
        <SectionCard icon={BarChart3} title="EV to Equity Bridge" accent="border-l-blue-500">
          <div className="space-y-1 max-w-md mx-auto">
            {[
              { k: "enterprise_value_base", l: "Enterprise Value (Base)", sign: "" },
              { k: "plus_cash", l: "+ Cash at Bank", sign: "+" },
              { k: "minus_long_term_debt", l: "– Long-term Debt", sign: "–" },
              { k: "minus_director_loans", l: "– Director Loans", sign: "–" },
              { k: "minus_bad_debt_provision", l: "– Bad Debt Provision", sign: "–" },
              { k: "minus_working_capital_adjustment", l: "– Working Capital Adj.", sign: "–" },
            ].filter(({ k }) => bridge[k] !== undefined && bridge[k] !== null).map(({ k, l, sign }, i) => (
              <div key={k} className={`flex justify-between py-2.5 px-4 rounded-lg ${i === 0 ? "bg-muted/40 font-semibold" : "border-b border-dashed"}`}>
                <span className="text-sm">{l}</span>
                <span className={`text-sm font-mono font-semibold ${sign === "+" ? "text-green-600" : sign === "–" ? "text-red-600" : ""}`}>
                  {formatCurrency(Math.abs(bridge[k]))}
                </span>
              </div>
            ))}
            <Separator className="my-2" />
            {bridge.equity_value_range && (
              <div className="grid grid-cols-3 gap-3 pt-2">
                {["conservative", "base", "optimistic"].map((level) => (
                  <div key={level} className={`border rounded-xl p-4 text-center ${level === "base" ? "border-primary bg-primary/5 ring-1 ring-primary/20" : ""}`}>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1 capitalize">Equity ({level})</p>
                    <p className="text-lg font-bold">{formatCurrency(bridge.equity_value_range[level])}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {Object.keys(summary).length > 0 && (
        <SectionCard icon={Target} title="Valuation Summary" accent="border-l-teal-500">
          <KeyValueGrid items={Object.entries(summary).filter(([, v]) => typeof v !== "object").map(([k, v]) => ({
            label: formatLabel(k),
            value: typeof v === "number" ? formatCurrency(v as number) : String(v ?? "—"),
          }))} />
        </SectionCard>
      )}

      {d.key_findings?.length > 0 && (
        <SectionCard icon={CheckCircle2} title="Key Findings" accent="border-l-green-500">
          <BulletList items={d.key_findings} variant="strength" />
        </SectionCard>
      )}

      {d.narrative && (
        <SectionCard icon={Brain} title="Narrative" accent="border-l-indigo-500">
          <NarrativeBlock text={d.narrative} />
        </SectionCard>
      )}
    </div>
  );
}

export function DealStructureReportView({ data }: { data: Record<string, unknown> }) {
  const d = data as any;
  const structures = d.structures || [];
  const recommended = d.recommended_structure;

  return (
    <div className="space-y-6">
      {recommended && (
        <div className="rounded-xl p-5 border-2 border-primary/30 bg-primary/5 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Recommended Approach</p>
            <p className="text-lg font-bold">{recommended}</p>
          </div>
          <Badge className="bg-primary text-lg px-4 py-1.5">Recommended</Badge>
        </div>
      )}

      {d.recommendation_rationale && (
        <SectionCard icon={Brain} title="Rationale" accent="border-l-indigo-500">
          <NarrativeBlock text={d.recommendation_rationale} />
        </SectionCard>
      )}

      {structures.length > 0 && (
        <div className="space-y-4">
          {structures.map((struct: any, i: number) => {
            const isRec = struct.name === recommended;
            const consideration = struct.consideration || {};
            const effectivePrice = struct.effective_price_modeling || {};

            return (
              <div key={i} className={`border rounded-xl overflow-hidden ${isRec ? "border-primary ring-1 ring-primary/20" : ""}`}>
                <div className={`px-5 py-3.5 border-b flex items-center justify-between ${isRec ? "bg-primary/10" : "bg-muted/40"}`}>
                  <div className="flex items-center gap-3">
                    <Handshake className={`w-5 h-5 ${isRec ? "text-primary" : "text-muted-foreground"}`} />
                    <h3 className="font-bold text-sm">{struct.name}</h3>
                    {isRec && <Badge className="bg-primary text-xs">Recommended</Badge>}
                  </div>
                </div>
                <div className="p-5 space-y-4">
                  {struct.strategy && <p className="text-sm">{struct.strategy}</p>}
                  {struct.suitable_when && <p className="text-xs text-muted-foreground italic">Best suited when: {struct.suitable_when}</p>}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { k: "total_headline", l: "Total Headline" },
                      { k: "upfront_cash", l: "Upfront Cash" },
                      { k: "deferred", l: "Deferred" },
                      { k: "earnout_maximum", l: "Earnout Max" },
                    ].map(({ k, l }) => (
                      <div key={k} className="border rounded-lg p-3 text-center bg-gradient-to-br from-background to-muted/20">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{l}</p>
                        <p className="text-lg font-bold mt-1">{formatCurrency(consideration[k])}</p>
                      </div>
                    ))}
                  </div>
                  {consideration.upfront_percent && (
                    <p className="text-xs text-muted-foreground">Upfront: <strong>{consideration.upfront_percent}%</strong> of total consideration</p>
                  )}

                  {Object.keys(effectivePrice).length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Effective Price Modeling</p>
                      <KeyValueGrid items={Object.entries(effectivePrice).map(([k, v]) => ({
                        label: formatLabel(k),
                        value: typeof v === "number" ? (k.includes("percent") || k.includes("multiple") ? formatNumber(v) : formatCurrency(v as number)) : String(v ?? "—"),
                      }))} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {d.key_findings?.length > 0 && (
        <SectionCard icon={CheckCircle2} title="Key Findings" accent="border-l-green-500">
          <BulletList items={d.key_findings} variant="strength" />
        </SectionCard>
      )}

      {d.narrative && (
        <SectionCard icon={Brain} title="Narrative" accent="border-l-indigo-500">
          <NarrativeBlock text={d.narrative} />
        </SectionCard>
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

export function getReportViewForExpert(expertType: string, data: Record<string, unknown>) {
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
    default: return <GenericReportView data={data} />;
  }
}
