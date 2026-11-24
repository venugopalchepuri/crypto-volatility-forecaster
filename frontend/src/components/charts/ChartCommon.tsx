export const CHART_COLORS = {
  grid: 'rgba(141, 151, 168, 0.12)',
  axisText: '#6B7688',
  accent: '#3B82F6',
  cyan: '#38BDF8',
  amber: '#F59E0B',
  emerald: '#10B981',
  red: '#EF4444',
  slate: '#64748B',
  violet: '#818CF8',
};

export const AXIS_TICK_STYLE = {
  fill: CHART_COLORS.axisText,
  fontSize: 10,
  fontFamily: 'IBM Plex Mono, monospace',
};

interface TooltipPayloadEntry {
  name?: string;
  value?: number | string | null;
  color?: string;
  dataKey?: string;
}

export function InstitutionalTooltip({
  active,
  payload,
  label,
  valueFormatter,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
  valueFormatter?: (val: number, name: string, dataKey?: string) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-[3px] border border-[var(--border-strong)] bg-[var(--bg-panel)] px-2.5 py-2 shadow-lg">
      {label && (
        <div className="mb-1 border-b border-[var(--border-subtle)] pb-1 font-mono text-[10px] text-[var(--text-secondary)]">
          {label}
        </div>
      )}
      <div className="space-y-1">
        {payload.map((entry, i) => {
          if (entry.value === null || entry.value === undefined) return null;
          const numVal = typeof entry.value === 'number' ? entry.value : Number(entry.value);
          const display = Number.isFinite(numVal) && valueFormatter
            ? valueFormatter(numVal, entry.name ?? '', entry.dataKey)
            : String(entry.value);
          return (
            <div key={`${entry.dataKey}-${i}`} className="flex items-center justify-between gap-4 font-mono text-[11px]">
              <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                <span
                  className="inline-block h-2 w-2 rounded-[1px]"
                  style={{ backgroundColor: entry.color ?? CHART_COLORS.accent }}
                />
                <span>{entry.name}</span>
              </span>
              <span className="font-semibold tabular-nums text-[var(--text-primary)]">{display}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
