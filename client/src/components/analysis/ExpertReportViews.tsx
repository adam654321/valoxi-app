import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  const color =
    rag === "GREEN"
      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
      : rag === "AMBER"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
        : rag === "RED"
          ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
          : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400";
  const sizing = size === "lg" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs";
  return (
    <span className={`inline-flex rounded-full font-semibold ${color} ${sizing}`}>
      {rag}
    </span>
  );
}

function ScoreBar({ score, max = 100, showLabel = true }: { score: number; max?: number; showLabel?: boolean }) {
  const pct = Math.min((score / max) * 100, 100);
  const color = pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      {showLabel && <span className="text-sm font-semibold w-10 text-right">{score}</span>}
    </div>
  );
}

function SectionCard({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: React.ReactNode }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-muted/50 border-b">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function KeyValueRow({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={`flex justify-between items-center py-1.5 text-sm ${className || ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
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

function colorForValue(val: number | null | undefined, inverse = false): string {
  if (val === null || val === undefined) return "";
  const positive = inverse ? val < 0 : val > 0;
  return positive ? "text-green-600 dark:text-green-400" : val < 0 ? "text-red-600 dark:text-red-400" : "";
}

function RiskLevelBadge({ level }: { level: string }) {
  const color =
    level === "low"
      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
      : level === "moderate"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
        : level === "high" || level === "critical"
          ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
          : "bg-gray-100 text-gray-800";
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${color}`}>{level}</span>;
}

function BulletList({ items, icon }: { items: string[]; icon?: "check" | "alert" | "info" }) {
  if (!items || items.length === 0) return <p className="text-sm text-muted-foreground italic">None identified</p>;
  const IconComp = icon === "check" ? CheckCircle2 : icon === "alert" ? AlertTriangle : Info;
  const iconColor = icon === "check" ? "text-green-500" : icon === "alert" ? "text-amber-500" : "text-blue-500";
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-sm">
          <IconComp className={`w-4 h-4 mt-0.5 flex-shrink-0 ${iconColor}`} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function NarrativeBlock({ text }: { text: string | undefined | null }) {
  if (!text) return null;
  return <p className="text-sm leading-relaxed whitespace-pre-wrap">{text}</p>;
}

export function DataQualityReportView({ data }: { data: Record<string, unknown> }) {
  const d = data as any;
  const sources = d.data_sources || {};
  const checks = d.consistency_checks || {};

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="border rounded-lg p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Completeness Score</p>
          <p className="text-3xl font-bold">{d.overall_completeness_score ?? "—"}</p>
          <ScoreBar score={d.overall_completeness_score || 0} showLabel={false} />
        </div>
        <div className="border rounded-lg p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Rating</p>
          <p className="text-lg font-semibold capitalize">{d.overall_completeness_rating ?? "—"}</p>
        </div>
        <div className="border rounded-lg p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Confidence for Analysis</p>
          <p className="text-lg font-semibold capitalize">{d.confidence_for_analysis ?? "—"}</p>
        </div>
      </div>

      <SectionCard icon={BarChart3} title="Data Sources">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(sources).map(([key, src]: [string, any]) => (
            <div key={key} className="border rounded p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{formatLabel(key)}</span>
                <Badge variant={src.status === "complete" ? "default" : "destructive"} className={src.status === "complete" ? "bg-green-600" : ""}>
                  {src.status}
                </Badge>
              </div>
              {src.years_available !== undefined && (
                <KeyValueRow label="Years Available" value={src.years_available} />
              )}
              {src.key_fields_populated?.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Fields Populated:</p>
                  <div className="flex flex-wrap gap-1">
                    {src.key_fields_populated.map((f: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-xs">{formatLabel(f)}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {src.key_fields_missing?.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Fields Missing:</p>
                  <div className="flex flex-wrap gap-1">
                    {src.key_fields_missing.map((f: string, i: number) => (
                      <Badge key={i} variant="destructive" className="text-xs">{formatLabel(f)}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {src.headcount_reported !== undefined && <KeyValueRow label="Headcount" value={src.headcount_reported} />}
              {src.asset_count !== undefined && <KeyValueRow label="Assets" value={src.asset_count} />}
              {src.customer_count !== undefined && <KeyValueRow label="Customers" value={src.customer_count} />}
            </div>
          ))}
        </div>
      </SectionCard>

      {Object.keys(checks).length > 0 && (
        <SectionCard icon={ShieldCheck} title="Consistency Checks">
          <div className="space-y-2">
            {Object.entries(checks).map(([key, check]: [string, any]) => (
              <div key={key} className="flex items-center justify-between py-2 border-b border-dashed last:border-0">
                <span className="text-sm">{formatLabel(key)}</span>
                <div className="flex items-center gap-3">
                  {check.variance_percent !== null && check.variance_percent !== undefined && (
                    <span className="text-xs text-muted-foreground">{check.variance_percent}% variance</span>
                  )}
                  <Badge variant={check.result === "consistent" ? "default" : check.result === "minor_discrepancy" ? "secondary" : "destructive"}
                    className={check.result === "consistent" ? "bg-green-600" : ""}>
                    {check.result?.replace(/_/g, " ")}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {d.red_flags?.length > 0 && (
        <SectionCard icon={AlertTriangle} title="Red Flags">
          <BulletList items={d.red_flags} icon="alert" />
        </SectionCard>
      )}

      {d.gaps_requiring_seller_action?.length > 0 && (
        <SectionCard icon={Info} title="Gaps Requiring Seller Action">
          <BulletList items={d.gaps_requiring_seller_action} icon="info" />
        </SectionCard>
      )}

      {d.analysis_limitations?.length > 0 && (
        <SectionCard icon={Shield} title="Analysis Limitations">
          <BulletList items={d.analysis_limitations} icon="info" />
        </SectionCard>
      )}
    </div>
  );
}

export function ScreeningReportView({ data }: { data: Record<string, unknown> }) {
  const d = data as any;
  const dims = d.dimensions || {};
  const recommendation = d.recommendation || d.overall_recommendation;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/30">
        <div className="flex-1">
          <p className="text-xs text-muted-foreground mb-1">Recommendation</p>
          <Badge className={`text-base px-3 py-1 ${
            recommendation === "PROCEED" || recommendation === "STRONG_PROCEED"
              ? "bg-green-600 hover:bg-green-700"
              : recommendation === "REVIEW"
                ? "bg-amber-600 hover:bg-amber-700"
                : "bg-red-600 hover:bg-red-700"
          }`}>
            {recommendation?.replace(/_/g, " ") || "—"}
          </Badge>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground mb-1">Overall Score</p>
          <p className="text-3xl font-bold">{d.overall_score ?? "—"}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground mb-1">Data Quality</p>
          <p className="text-lg font-semibold">{d.data_quality_score ?? "—"}/100</p>
        </div>
      </div>

      {d.executive_summary && (
        <SectionCard icon={Brain} title="Executive Summary">
          <NarrativeBlock text={d.executive_summary} />
        </SectionCard>
      )}

      <SectionCard icon={Target} title="Screening Dimensions">
        <div className="space-y-4">
          {Object.entries(dims).map(([key, dim]: [string, any]) => (
            <div key={key} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">{formatLabel(key)}</h4>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">{dim.score}/100</span>
                  <RagBadge rag={dim.rag} />
                </div>
              </div>
              <ScoreBar score={dim.score} />
              {dim.explanation && (
                <p className="text-sm text-muted-foreground leading-relaxed">{dim.explanation}</p>
              )}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1">
                {Object.entries(dim)
                  .filter(([k]) => !["rag", "score", "explanation"].includes(k))
                  .map(([k, v]) => (
                    <div key={k} className="flex justify-between text-xs py-0.5 border-b border-dashed border-muted">
                      <span className="text-muted-foreground">{formatLabel(k)}</span>
                      <span className="font-medium">
                        {typeof v === "number"
                          ? k.includes("percent") ? formatPercent(v) : v.toLocaleString()
                          : String(v ?? "—")}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {d.key_strengths?.length > 0 && (
        <SectionCard icon={CheckCircle2} title="Key Strengths">
          <BulletList items={d.key_strengths} icon="check" />
        </SectionCard>
      )}

      {d.key_concerns?.length > 0 && (
        <SectionCard icon={AlertTriangle} title="Key Concerns">
          <BulletList items={d.key_concerns} icon="alert" />
        </SectionCard>
      )}

      {d.questions_for_seller?.length > 0 && (
        <SectionCard icon={Info} title="Questions for Seller">
          <BulletList items={d.questions_for_seller} icon="info" />
        </SectionCard>
      )}

      {d.comparable_context && (
        <SectionCard icon={Layers} title="Comparable Context">
          <NarrativeBlock text={d.comparable_context} />
        </SectionCard>
      )}

      {d.recommendation_justification && (
        <SectionCard icon={Brain} title="Recommendation Justification">
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

  return (
    <div className="space-y-6">
      {years.length > 0 && (
        <SectionCard icon={DollarSign} title="Yearly Financial Metrics">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background">Metric</TableHead>
                  {years.map((y) => (
                    <TableHead key={y} className="text-right min-w-[100px]">{y}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  { key: "revenue", label: "Revenue", format: "currency" },
                  { key: "revenue_yoy_growth_percent", label: "Revenue Growth", format: "percent" },
                  { key: "gross_profit", label: "Gross Profit", format: "currency" },
                  { key: "gross_margin_percent", label: "Gross Margin", format: "percent" },
                  { key: "operating_profit", label: "Operating Profit", format: "currency" },
                  { key: "operating_margin_percent", label: "Operating Margin", format: "percent" },
                  { key: "ebitda", label: "EBITDA", format: "currency" },
                  { key: "net_profit", label: "Net Profit", format: "currency" },
                  { key: "net_margin_percent", label: "Net Margin", format: "percent" },
                  { key: "interest_coverage_ratio", label: "Interest Coverage", format: "number" },
                  { key: "effective_tax_rate_percent", label: "Effective Tax Rate", format: "percent" },
                ].map(({ key, label, format }) => (
                  <TableRow key={key}>
                    <TableCell className="sticky left-0 bg-background font-medium text-sm">{label}</TableCell>
                    {years.map((y) => {
                      const val = yearlyMetrics[y]?.[key];
                      return (
                        <TableCell key={y} className={`text-right text-sm ${key.includes("growth") || key.includes("margin") ? colorForValue(val) : ""}`}>
                          {format === "currency" ? formatCurrency(val) : format === "percent" ? formatPercent(val) : formatNumber(val)}
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
        <SectionCard icon={TrendingUp} title="Growth Rates (CAGR)">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Object.entries(cagr).map(([key, val]: [string, any]) => (
              <div key={key} className="border rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">{formatLabel(key)}</p>
                <p className={`text-lg font-bold ${colorForValue(val)}`}>
                  {typeof val === "number" ? formatPercent(val) : String(val ?? "—")}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {Object.keys(costStructure).length > 0 && (
        <SectionCard icon={BarChart3} title="Cost Structure">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            {Object.entries(costStructure).map(([k, v]) => (
              <KeyValueRow key={k} label={formatLabel(k)} value={
                typeof v === "number" ? (k.includes("percent") ? formatPercent(v) : formatCurrency(v)) : String(v ?? "—")
              } />
            ))}
          </div>
        </SectionCard>
      )}

      {Object.keys(earningsQuality).length > 0 && (
        <SectionCard icon={ShieldCheck} title="Earnings Quality">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            {Object.entries(earningsQuality).map(([k, v]) => (
              <KeyValueRow key={k} label={formatLabel(k)} value={
                typeof v === "number" ? (k.includes("percent") ? formatPercent(v) : formatCurrency(v)) : String(v ?? "—")
              } />
            ))}
          </div>
        </SectionCard>
      )}

      {Object.keys(debtService).length > 0 && (
        <SectionCard icon={Shield} title="Debt Service">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            {Object.entries(debtService).map(([k, v]) => (
              <KeyValueRow key={k} label={formatLabel(k)} value={
                typeof v === "number" ? formatCurrency(v) : String(v ?? "—")
              } />
            ))}
          </div>
        </SectionCard>
      )}

      {d.key_findings?.length > 0 && (
        <SectionCard icon={CheckCircle2} title="Key Findings">
          <BulletList items={d.key_findings} icon="check" />
        </SectionCard>
      )}

      {d.narrative && (
        <SectionCard icon={Brain} title="Narrative">
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
        <SectionCard icon={BarChart3} title="Working Capital">
          <div className="flex items-center gap-4 mb-4">
            {wc.trend && <KeyValueRow label="Trend" value={<Badge variant="outline" className="capitalize">{wc.trend}</Badge>} />}
            {wc.working_capital_intensity && <KeyValueRow label="Intensity" value={<Badge variant="outline" className="capitalize">{wc.working_capital_intensity}</Badge>} />}
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background">Metric</TableHead>
                  {wcYears.map((y) => <TableHead key={y} className="text-right min-w-[90px]">{y}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {["debtor_days", "creditor_days", "stock_days", "cash_conversion_cycle_days", "net_working_capital", "working_capital_percent_revenue"].map((key) => (
                  <TableRow key={key}>
                    <TableCell className="sticky left-0 bg-background font-medium text-sm">{formatLabel(key)}</TableCell>
                    {wcYears.map((y) => {
                      const val = wcMetrics[y]?.[key];
                      return (
                        <TableCell key={y} className="text-right text-sm">
                          {key === "net_working_capital" ? formatCurrency(val) : key.includes("percent") ? formatPercent(val) : formatNumber(val)}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {wc.observations?.length > 0 && (
            <div className="mt-3">
              <BulletList items={wc.observations} icon="info" />
            </div>
          )}
        </SectionCard>
      )}

      {Object.keys(capex).length > 0 && (
        <SectionCard icon={TrendingUp} title="Capital Expenditure">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { k: "total_gross_asset_value", l: "Gross Asset Value", f: formatCurrency },
              { k: "total_nbv", l: "Net Book Value", f: formatCurrency },
              { k: "asset_freshness_percent", l: "Asset Freshness", f: formatPercent },
              { k: "recent_additions_24m_value", l: "Recent Additions (24m)", f: formatCurrency },
              { k: "recent_additions_percent", l: "Recent Additions %", f: formatPercent },
              { k: "estimated_annual_maintenance_capex", l: "Est. Annual Maint. Capex", f: formatCurrency },
            ].map(({ k, l, f }) =>
              capex[k] !== undefined && capex[k] !== null ? (
                <div key={k} className="border rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">{l}</p>
                  <p className="text-lg font-semibold">{f(capex[k])}</p>
                </div>
              ) : null
            )}
          </div>
          {capex.observations?.length > 0 && <div className="mt-3"><BulletList items={capex.observations} icon="info" /></div>}
        </SectionCard>
      )}

      {Object.keys(workforce).length > 0 && (
        <SectionCard icon={Layers} title="Workforce & Productivity">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            {Object.entries(workforce).filter(([k]) => k !== "observations" && !Array.isArray(workforce[k])).map(([k, v]) => (
              <KeyValueRow key={k} label={formatLabel(k)} value={
                typeof v === "number" ? (k.includes("percent") ? formatPercent(v) : k.includes("revenue") || k.includes("cost") || k.includes("salary") ? formatCurrency(v) : formatNumber(v)) : String(v ?? "—")
              } />
            ))}
          </div>
          {workforce.observations?.length > 0 && <div className="mt-3"><BulletList items={workforce.observations} icon="info" /></div>}
        </SectionCard>
      )}

      {Object.keys(ownerDep).length > 0 && (
        <SectionCard icon={Shield} title="Owner Dependency">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            {Object.entries(ownerDep).filter(([k]) => k !== "observations").map(([k, v]) => (
              <KeyValueRow key={k} label={formatLabel(k)} value={
                typeof v === "boolean" ? (v ? "Yes" : "No") : typeof v === "number" ? (k.includes("percent") ? formatPercent(v) : formatCurrency(v)) : String(v ?? "—")
              } />
            ))}
          </div>
          {ownerDep.observations?.length > 0 && <div className="mt-3"><BulletList items={ownerDep.observations} icon="info" /></div>}
        </SectionCard>
      )}

      {Object.keys(scalability).length > 0 && (
        <SectionCard icon={TrendingUp} title="Scalability Assessment">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            {Object.entries(scalability).filter(([k]) => k !== "observations").map(([k, v]) => (
              <KeyValueRow key={k} label={formatLabel(k)} value={String(v ?? "—")} />
            ))}
          </div>
          {scalability.observations?.length > 0 && <div className="mt-3"><BulletList items={scalability.observations} icon="info" /></div>}
        </SectionCard>
      )}

      {d.key_findings?.length > 0 && (
        <SectionCard icon={CheckCircle2} title="Key Findings">
          <BulletList items={d.key_findings} icon="check" />
        </SectionCard>
      )}

      {d.narrative && (
        <SectionCard icon={Brain} title="Narrative">
          <NarrativeBlock text={d.narrative} />
        </SectionCard>
      )}
    </div>
  );
}

export function RiskReportView({ data }: { data: Record<string, unknown> }) {
  const d = data as any;

  const riskSections = [
    { key: "customer_concentration", label: "Customer Concentration", icon: Target },
    { key: "financial_risk", label: "Financial Risk", icon: DollarSign },
    { key: "key_person_risk", label: "Key Person Risk", icon: Layers },
    { key: "revenue_quality", label: "Revenue Quality", icon: TrendingUp },
    { key: "balance_sheet_risks", label: "Balance Sheet Risks", icon: BarChart3 },
    { key: "bad_debt", label: "Bad Debt Risk", icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6">
      {riskSections.map(({ key, label, icon }) => {
        const section = d[key];
        if (!section || typeof section !== "object") return null;
        return (
          <SectionCard key={key} icon={icon} title={label}>
            <div className="space-y-3">
              {section.risk_level && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Risk Level:</span>
                  <RiskLevelBadge level={section.risk_level} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                {Object.entries(section)
                  .filter(([k]) => !["risk_level", "observations", "customers_over_15_percent"].includes(k) && !Array.isArray(section[k]))
                  .map(([k, v]) => (
                    <KeyValueRow key={k} label={formatLabel(k)} value={
                      typeof v === "boolean" ? (v ? "Yes" : "No") : typeof v === "number" ? (k.includes("percent") ? formatPercent(v) : formatNumber(v)) : String(v ?? "—")
                    } />
                  ))}
              </div>
              {section.customers_over_15_percent?.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Customers Over 15%:</p>
                  <div className="flex flex-wrap gap-1">
                    {section.customers_over_15_percent.map((c: string, i: number) => (
                      <Badge key={i} variant="destructive" className="text-xs">{c}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {section.observations?.length > 0 && <BulletList items={section.observations} icon="info" />}
            </div>
          </SectionCard>
        );
      })}

      {d.risk_register?.length > 0 && (
        <SectionCard icon={Shield} title="Risk Register">
          <div className="space-y-3">
            {d.risk_register.map((risk: any, i: number) => (
              <div key={i} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{risk.risk || risk.description}</span>
                  <div className="flex items-center gap-2">
                    {risk.likelihood && <Badge variant="outline" className="text-xs">Likelihood: {risk.likelihood}</Badge>}
                    {risk.impact && <Badge variant="outline" className="text-xs">Impact: {risk.impact}</Badge>}
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
        <SectionCard icon={XCircle} title="Deal Breakers">
          <BulletList items={d.deal_breakers.map((db: any) => typeof db === "string" ? db : db.description || db.risk)} icon="alert" />
        </SectionCard>
      )}

      {d.key_findings?.length > 0 && (
        <SectionCard icon={CheckCircle2} title="Key Findings">
          <BulletList items={d.key_findings} icon="check" />
        </SectionCard>
      )}

      {d.narrative && (
        <SectionCard icon={Brain} title="Narrative">
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
      <SectionCard icon={DollarSign} title="Reported Figures">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { k: "operating_profit", l: "Operating Profit" },
            { k: "depreciation", l: "Depreciation" },
            { k: "amortisation", l: "Amortisation" },
            { k: "reported_ebitda", l: "Reported EBITDA" },
          ].map(({ k, l }) => (
            <div key={k} className="border rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">{l}</p>
              <p className="text-lg font-semibold">{formatCurrency(reported[k])}</p>
            </div>
          ))}
        </div>
        {reported.source_year && <p className="text-xs text-muted-foreground mt-2">Source Year: {reported.source_year}</p>}
      </SectionCard>

      {addBacks.length > 0 && (
        <SectionCard icon={TrendingUp} title="Add-Backs">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Confidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {addBacks.map((ab: any, i: number) => (
                <TableRow key={i}>
                  <TableCell className="text-sm">{ab.item}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{formatLabel(ab.category || "")}</Badge></TableCell>
                  <TableCell className="text-right text-sm text-green-600 font-medium">{formatCurrency(ab.amount)}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs capitalize">{ab.confidence}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>
      )}

      {deductions.length > 0 && (
        <SectionCard icon={AlertTriangle} title="Deductions">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Confidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deductions.map((ded: any, i: number) => (
                <TableRow key={i}>
                  <TableCell className="text-sm">{ded.item}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{formatLabel(ded.category || "")}</Badge></TableCell>
                  <TableCell className="text-right text-sm text-red-600 font-medium">{formatCurrency(ded.amount)}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs capitalize">{ded.confidence}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>
      )}

      {Object.keys(adjusted).length > 0 && (
        <SectionCard icon={ShieldCheck} title="Adjusted EBITDA">
          <div className="grid grid-cols-3 gap-4">
            {["low", "mid", "high"].map((level) => (
              <div key={level} className={`border rounded-lg p-4 text-center ${level === "mid" ? "border-primary bg-primary/5" : ""}`}>
                <p className="text-xs text-muted-foreground mb-1 capitalize">{level} Estimate</p>
                <p className="text-xl font-bold">{formatCurrency(adjusted[level])}</p>
              </div>
            ))}
          </div>
          {adjusted.adjustments_narrative && <NarrativeBlock text={adjusted.adjustments_narrative} />}
        </SectionCard>
      )}

      {Object.keys(directorSalary).length > 0 && (
        <SectionCard icon={Layers} title="Director Salary Analysis">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            {Object.entries(directorSalary).filter(([k]) => k !== "observations").map(([k, v]) => (
              <KeyValueRow key={k} label={formatLabel(k)} value={
                typeof v === "number" ? (k.includes("percent") ? formatPercent(v) : formatCurrency(v)) : String(v ?? "—")
              } />
            ))}
          </div>
        </SectionCard>
      )}

      {Object.keys(sustainability).length > 0 && (
        <SectionCard icon={Shield} title="Sustainability Assessment">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            {Object.entries(sustainability).filter(([k]) => !Array.isArray(sustainability[k]) && typeof sustainability[k] !== "object").map(([k, v]) => (
              <KeyValueRow key={k} label={formatLabel(k)} value={String(v ?? "—")} />
            ))}
          </div>
        </SectionCard>
      )}

      {d.key_findings?.length > 0 && (
        <SectionCard icon={CheckCircle2} title="Key Findings">
          <BulletList items={d.key_findings} icon="check" />
        </SectionCard>
      )}

      {d.narrative && (
        <SectionCard icon={Brain} title="Narrative">
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
      <SectionCard icon={Layers} title="Sector Overview">
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            {overview.growth_outlook && (
              <div>
                <span className="text-xs text-muted-foreground">Growth Outlook: </span>
                <Badge variant="outline" className="capitalize">{overview.growth_outlook}</Badge>
              </div>
            )}
            {overview.uk_market_size_estimate && (
              <div>
                <span className="text-xs text-muted-foreground">UK Market Size: </span>
                <span className="font-medium text-sm">{overview.uk_market_size_estimate}</span>
              </div>
            )}
          </div>
          {overview.key_trends?.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1 font-medium">Key Trends</p>
              <BulletList items={overview.key_trends} icon="info" />
            </div>
          )}
          {overview.regulatory_factors?.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1 font-medium">Regulatory Factors</p>
              <BulletList items={overview.regulatory_factors} icon="alert" />
            </div>
          )}
        </div>
      </SectionCard>

      {Object.keys(positioning).length > 0 && (
        <SectionCard icon={Target} title="Competitive Positioning">
          <div className="space-y-3">
            {positioning.company_size_classification && (
              <KeyValueRow label="Size Classification" value={<Badge variant="outline" className="capitalize">{positioning.company_size_classification}</Badge>} />
            )}
            {positioning.positioning_assessment && <NarrativeBlock text={positioning.positioning_assessment} />}
            <div className="grid grid-cols-3 gap-4 mt-2">
              {[
                { k: "typical_gross_margin_range", l: "Typical Gross Margin" },
                { k: "typical_operating_margin_range", l: "Typical Operating Margin" },
                { k: "typical_ebitda_margin_range", l: "Typical EBITDA Margin" },
              ].map(({ k, l }) => {
                const range = positioning[k];
                if (!range) return null;
                return (
                  <div key={k} className="border rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">{l}</p>
                    <p className="font-semibold text-sm">{formatPercent(range.low)} – {formatPercent(range.high)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </SectionCard>
      )}

      {Object.keys(multiples).length > 0 && (
        <SectionCard icon={TrendingUp} title="Comparable Multiples">
          <div className="grid grid-cols-2 gap-4">
            {[
              { k: "ev_revenue_range", l: "EV/Revenue" },
              { k: "ev_ebitda_range", l: "EV/EBITDA" },
            ].map(({ k, l }) => {
              const range = multiples[k];
              if (!range) return null;
              return (
                <div key={k} className="border rounded-lg p-4">
                  <p className="text-sm font-medium mb-2">{l}</p>
                  <div className="flex justify-between text-center">
                    <div><p className="text-xs text-muted-foreground">Low</p><p className="font-semibold">{range.low}x</p></div>
                    <div><p className="text-xs text-muted-foreground">Mid</p><p className="font-bold text-primary">{range.mid}x</p></div>
                    <div><p className="text-xs text-muted-foreground">High</p><p className="font-semibold">{range.high}x</p></div>
                  </div>
                </div>
              );
            })}
          </div>
          {multiples.data_quality_note && <p className="text-xs text-muted-foreground mt-2 italic">{multiples.data_quality_note}</p>}
        </SectionCard>
      )}

      {(growth.organic?.length > 0 || growth.acquisition?.length > 0) && (
        <SectionCard icon={TrendingUp} title="Growth Opportunities">
          {growth.organic?.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-muted-foreground mb-1 font-medium">Organic</p>
              <BulletList items={growth.organic} icon="check" />
            </div>
          )}
          {growth.acquisition?.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1 font-medium">Acquisition</p>
              <BulletList items={growth.acquisition} icon="check" />
            </div>
          )}
        </SectionCard>
      )}

      {(sectorRisks.threats?.length > 0 || sectorRisks.cyclicality) && (
        <SectionCard icon={AlertTriangle} title="Sector Risks">
          {sectorRisks.cyclicality && <KeyValueRow label="Cyclicality" value={<Badge variant="outline" className="capitalize">{sectorRisks.cyclicality}</Badge>} />}
          {sectorRisks.threats?.length > 0 && <BulletList items={sectorRisks.threats} icon="alert" />}
        </SectionCard>
      )}

      {d.key_findings?.length > 0 && (
        <SectionCard icon={CheckCircle2} title="Key Findings">
          <BulletList items={d.key_findings} icon="check" />
        </SectionCard>
      )}

      {d.narrative && (
        <SectionCard icon={Brain} title="Narrative">
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
  const assetBased = d.asset_based_valuation || {};
  const revMultiple = d.revenue_multiple_crosscheck || {};
  const summary = d.valuation_summary || {};
  const sensitivity = d.sensitivity || {};
  const sellerExp = d.seller_expectations || {};

  return (
    <div className="space-y-6">
      {Object.keys(ebitdaVal).length > 0 && (
        <SectionCard icon={DollarSign} title="EBITDA Multiple Valuation">
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="border rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">Adjusted EBITDA Base</p>
                <p className="text-lg font-bold">{formatCurrency(ebitdaVal.adjusted_ebitda_base)}</p>
              </div>
              <div className="border rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">Selected Multiple</p>
                <p className="text-lg font-bold">{ebitdaVal.selected_multiple}x</p>
              </div>
              {ebitdaVal.sector_multiple_range && (
                <div className="border rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Sector Range</p>
                  <p className="text-sm font-semibold">{ebitdaVal.sector_multiple_range.low}x – {ebitdaVal.sector_multiple_range.high}x</p>
                </div>
              )}
            </div>
            {ebitdaVal.enterprise_value_range && (
              <div className="grid grid-cols-3 gap-4">
                {["conservative", "base", "optimistic"].map((level) => (
                  <div key={level} className={`border rounded-lg p-4 text-center ${level === "base" ? "border-primary bg-primary/5" : ""}`}>
                    <p className="text-xs text-muted-foreground mb-1 capitalize">{level}</p>
                    <p className="text-xl font-bold">{formatCurrency(ebitdaVal.enterprise_value_range[level])}</p>
                  </div>
                ))}
              </div>
            )}
            {ebitdaVal.multiple_justification && <NarrativeBlock text={ebitdaVal.multiple_justification} />}
          </div>
        </SectionCard>
      )}

      {Object.keys(bridge).length > 0 && (
        <SectionCard icon={BarChart3} title="EV to Equity Bridge">
          <div className="space-y-2">
            {[
              { k: "enterprise_value_base", l: "Enterprise Value (Base)", positive: true },
              { k: "plus_cash", l: "+ Cash", positive: true },
              { k: "minus_long_term_debt", l: "- Long-term Debt", positive: false },
              { k: "minus_director_loans", l: "- Director Loans", positive: false },
              { k: "minus_bad_debt_provision", l: "- Bad Debt Provision", positive: false },
              { k: "minus_working_capital_adjustment", l: "- Working Capital Adj.", positive: false },
            ].map(({ k, l, positive }) => {
              if (bridge[k] === undefined || bridge[k] === null) return null;
              return (
                <div key={k} className="flex justify-between py-1 border-b border-dashed">
                  <span className="text-sm">{l}</span>
                  <span className={`text-sm font-medium ${positive ? "text-green-600" : "text-red-600"}`}>
                    {formatCurrency(bridge[k])}
                  </span>
                </div>
              );
            })}
            <Separator />
            {bridge.equity_value_range && (
              <div className="grid grid-cols-3 gap-4 pt-2">
                {["conservative", "base", "optimistic"].map((level) => (
                  <div key={level} className={`border rounded-lg p-3 text-center ${level === "base" ? "border-primary bg-primary/5" : ""}`}>
                    <p className="text-xs text-muted-foreground mb-1 capitalize">Equity ({level})</p>
                    <p className="text-lg font-bold">{formatCurrency(bridge.equity_value_range[level])}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {Object.keys(summary).length > 0 && (
        <SectionCard icon={Target} title="Valuation Summary">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            {Object.entries(summary).filter(([, v]) => typeof v !== "object").map(([k, v]) => (
              <KeyValueRow key={k} label={formatLabel(k)} value={
                typeof v === "number" ? formatCurrency(v) : String(v ?? "—")
              } />
            ))}
          </div>
        </SectionCard>
      )}

      {d.key_findings?.length > 0 && (
        <SectionCard icon={CheckCircle2} title="Key Findings">
          <BulletList items={d.key_findings} icon="check" />
        </SectionCard>
      )}

      {d.narrative && (
        <SectionCard icon={Brain} title="Narrative">
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
        <div className="flex items-center gap-3 p-4 border rounded-lg bg-muted/30">
          <span className="text-sm text-muted-foreground">Recommended Structure:</span>
          <Badge className="bg-primary text-sm px-3 py-1">{recommended}</Badge>
        </div>
      )}

      {d.recommendation_rationale && (
        <SectionCard icon={Brain} title="Recommendation Rationale">
          <NarrativeBlock text={d.recommendation_rationale} />
        </SectionCard>
      )}

      {structures.length > 0 && (
        <div className="space-y-4">
          {structures.map((struct: any, i: number) => {
            const isRecommended = struct.name === recommended;
            const consideration = struct.consideration || {};
            const sellerOb = struct.seller_obligations || {};
            const effectivePrice = struct.effective_price_modeling || {};

            return (
              <div key={i} className={`border rounded-lg overflow-hidden ${isRecommended ? "border-primary ring-1 ring-primary/20" : ""}`}>
                <div className={`px-4 py-3 border-b flex items-center justify-between ${isRecommended ? "bg-primary/10" : "bg-muted/50"}`}>
                  <div className="flex items-center gap-2">
                    <Handshake className="w-4 h-4" />
                    <h3 className="font-semibold text-sm">{struct.name}</h3>
                    {isRecommended && <Badge className="bg-primary text-xs">Recommended</Badge>}
                  </div>
                </div>
                <div className="p-4 space-y-4">
                  {struct.strategy && <p className="text-sm text-muted-foreground">{struct.strategy}</p>}
                  {struct.suitable_when && <p className="text-xs text-muted-foreground italic">Suitable when: {struct.suitable_when}</p>}

                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Consideration</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { k: "total_headline", l: "Total Headline" },
                        { k: "upfront_cash", l: "Upfront Cash" },
                        { k: "deferred", l: "Deferred" },
                        { k: "earnout_maximum", l: "Earnout Max" },
                      ].map(({ k, l }) => (
                        <div key={k} className="border rounded p-2 text-center">
                          <p className="text-xs text-muted-foreground">{l}</p>
                          <p className="font-semibold text-sm">{formatCurrency(consideration[k])}</p>
                        </div>
                      ))}
                    </div>
                    {consideration.upfront_percent && <p className="text-xs text-muted-foreground mt-1">Upfront: {consideration.upfront_percent}%</p>}
                  </div>

                  {Object.keys(effectivePrice).length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Effective Price Modeling</p>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                        {Object.entries(effectivePrice).map(([k, v]) => (
                          <KeyValueRow key={k} label={formatLabel(k)} value={
                            typeof v === "number" ? (k.includes("percent") || k.includes("multiple") ? formatNumber(v) : formatCurrency(v)) : String(v ?? "—")
                          } />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {d.key_findings?.length > 0 && (
        <SectionCard icon={CheckCircle2} title="Key Findings">
          <BulletList items={d.key_findings} icon="check" />
        </SectionCard>
      )}

      {d.narrative && (
        <SectionCard icon={Brain} title="Narrative">
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
      if (value.length > 100) return <p className="text-sm whitespace-pre-wrap">{value}</p>;
      return value;
    }
    if (Array.isArray(value)) {
      if (value.length === 0) return <span className="text-muted-foreground italic">None</span>;
      if (typeof value[0] === "string") {
        return (
          <ul className="space-y-1">
            {value.map((item, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="text-muted-foreground">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        );
      }
      return (
        <div className="space-y-2">
          {value.map((item, i) => (
            <div key={i} className="border rounded p-3 text-sm">
              {renderValue(item, depth + 1)}
            </div>
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
            <SectionCard key={key} icon={Info} title={formatLabel(key)}>
              {renderValue(value)}
            </SectionCard>
          );
        }
        return (
          <div key={key}>
            <p className="text-xs text-muted-foreground mb-1 font-medium">{formatLabel(key)}</p>
            <div className="text-sm">{renderValue(value)}</div>
          </div>
        );
      })}

      {keyFindings && (
        <SectionCard icon={CheckCircle2} title="Key Findings">
          <BulletList items={keyFindings[1] as string[]} icon="check" />
        </SectionCard>
      )}

      {narrativeEntry && (
        <SectionCard icon={Brain} title="Narrative">
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
