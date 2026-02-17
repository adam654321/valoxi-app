import { formatCurrency } from '@/lib/format-utils';

export interface ImpactMetrics {
  y5Ebitda: number;
  cumulativeFcf: number;
  irr: number | null;
  moic: number | null;
  worstDscr: number;
}

interface ImpactSummaryBarProps {
  current: ImpactMetrics | null;
  previous: ImpactMetrics | null;
}

function deltaPercent(prev: number, curr: number): number {
  if (prev === 0) return curr === 0 ? 0 : 100;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

function DeltaItem({ label, prev, curr, format, invertColor }: {
  label: string;
  prev: number;
  curr: number;
  format: (v: number) => string;
  invertColor?: boolean;
}) {
  if (prev === curr) return null;
  const delta = curr - prev;
  const pct = deltaPercent(prev, curr);
  const positive = invertColor ? delta < 0 : delta >= 0;

  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-mono text-muted-foreground">{format(prev)}</span>
      <span className="text-xs text-muted-foreground">&rarr;</span>
      <span className="text-xs font-mono font-semibold">{format(curr)}</span>
      <span className={`text-[10px] font-mono ${positive ? 'text-green-600' : 'text-red-600'}`}>
        ({delta >= 0 ? '+' : ''}{pct.toFixed(1)}%)
      </span>
    </div>
  );
}

export default function ImpactSummaryBar({ current, previous }: ImpactSummaryBarProps) {
  if (!previous || !current) return null;

  const changed = JSON.stringify(current) !== JSON.stringify(previous);
  if (!changed) return null;

  const formatIrrVal = (v: number) => {
    if (!isFinite(v) || isNaN(v) || Math.abs(v) > 10) return '∞';
    if (v < -1) return '< -100%';
    return `${(v * 100).toFixed(1)}%`;
  };

  const formatMoicVal = (v: number) => {
    if (!isFinite(v)) return '∞';
    return `${v.toFixed(2)}x`;
  };

  const formatDscr = (v: number) => {
    if (v >= 100) return '∞';
    return `${v.toFixed(2)}x`;
  };

  const items: JSX.Element[] = [];

  items.push(
    <DeltaItem key="ebitda" label="EBITDA" prev={previous.y5Ebitda} curr={current.y5Ebitda} format={formatCurrency} />
  );

  items.push(
    <DeltaItem key="fcf" label="FCF" prev={previous.cumulativeFcf} curr={current.cumulativeFcf} format={formatCurrency} />
  );

  if (previous.irr !== null && current.irr !== null) {
    items.push(
      <DeltaItem key="irr" label="IRR" prev={previous.irr} curr={current.irr} format={formatIrrVal} />
    );
  }

  if (previous.moic !== null && current.moic !== null) {
    items.push(
      <DeltaItem key="moic" label="MOIC" prev={previous.moic} curr={current.moic} format={formatMoicVal} />
    );
  }

  items.push(
    <DeltaItem key="dscr" label="DSCR" prev={previous.worstDscr} curr={current.worstDscr} format={formatDscr} />
  );

  const rendered = items.filter(Boolean);
  if (rendered.length === 0) return null;

  return (
    <div className="rounded-lg border bg-muted/30 border-l-4 border-l-primary px-4 py-2 flex items-center gap-4 overflow-x-auto animate-in fade-in slide-in-from-bottom-1 duration-300">
      {rendered.map((item, i) => (
        <div key={i} className="contents">
          {i > 0 && <span className="text-muted-foreground/30">&middot;</span>}
          {item}
        </div>
      ))}
    </div>
  );
}
