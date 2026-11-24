import { useMemo } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ForecastSeriesPoint } from '../../types/api';
import { formatShortTimestamp, formatUSD } from '../../utils/format';
import { AXIS_TICK_STYLE, CHART_COLORS, InstitutionalTooltip } from './ChartCommon';

export type OverviewChartMode = 'volatility' | 'price_vol';

interface OverviewForecastChartProps {
  records: ForecastSeriesPoint[];
  forecastVolatility: number | null;
  forecastModelUsed: string;
  mode: OverviewChartMode;
}

interface ChartPoint {
  label: string;
  timestamp: string;
  histVol24hPct: number | null;
  targetVol4hPct: number | null;
  predictedVolPct: number | null;
  forecastHorizonPct: number | null;
  closePrice: number | null;
  isForecastStep?: boolean;
}

export function OverviewForecastChart({
  records,
  forecastVolatility,
  forecastModelUsed,
  mode,
}: OverviewForecastChartProps) {
  const { chartData, latestObsLabel } = useMemo(() => {
    if (!records.length) {
      return { chartData: [] as ChartPoint[], latestObsLabel: '' };
    }

    const mapped: ChartPoint[] = records.map((r) => ({
      label: formatShortTimestamp(r.timestamp),
      timestamp: r.timestamp,
      histVol24hPct: r.volatility_24h !== null ? Number((r.volatility_24h * 100).toFixed(4)) : null,
      targetVol4hPct:
        r.target_future_volatility !== null
          ? Number((r.target_future_volatility * 100).toFixed(4))
          : null,
      predictedVolPct:
        r.predicted_volatility !== null
          ? Number((r.predicted_volatility * 100).toFixed(4))
          : null,
      forecastHorizonPct: null,
      closePrice: r.close ?? null,
    }));

    const lastIdx = mapped.length - 1;
    const lastObs = mapped[lastIdx];
    const t0Label = lastObs.label;

    // Anchor dashed forecast line from latest actual/historical point to T+4H point
    if (forecastVolatility !== null) {
      const anchorVal =
        lastObs.predictedVolPct ?? lastObs.targetVol4hPct ?? lastObs.histVol24hPct;
      if (anchorVal !== null) {
        lastObs.forecastHorizonPct = anchorVal;
      }
      mapped.push({
        label: 'T+4H Fwd',
        timestamp: 'Next 4-Hour Horizon',
        histVol24hPct: null,
        targetVol4hPct: null,
        predictedVolPct: null,
        forecastHorizonPct: Number((forecastVolatility * 100).toFixed(4)),
        closePrice: null,
        isForecastStep: true,
      });
    }

    return { chartData: mapped, latestObsLabel: t0Label };
  }, [records, forecastVolatility]);

  if (!chartData.length) {
    return (
      <div className="flex h-80 items-center justify-center font-mono text-xs text-[var(--text-muted)]">
        No volatility series data available.
      </div>
    );
  }

  const hasModelPreds = chartData.some((d) => d.predictedVolPct !== null);

  return (
    <div className="h-[340px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 12, right: 16, left: 4, bottom: 4 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={AXIS_TICK_STYLE}
            tickLine={false}
            axisLine={{ stroke: CHART_COLORS.grid }}
            minTickGap={28}
          />
          <YAxis
            yAxisId="vol"
            tick={AXIS_TICK_STYLE}
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={(v: number) => `${v.toFixed(2)}%`}
          />
          {mode === 'price_vol' && (
            <YAxis
              yAxisId="price"
              orientation="right"
              tick={AXIS_TICK_STYLE}
              tickLine={false}
              axisLine={false}
              width={66}
              domain={['auto', 'auto']}
              tickFormatter={(v: number) => `$${Math.round(v).toLocaleString()}`}
            />
          )}
          <Tooltip
            content={
              <InstitutionalTooltip
                valueFormatter={(val, _name, dataKey) => {
                  if (dataKey === 'closePrice') return formatUSD(val);
                  return `${val.toFixed(3)}%`;
                }}
              />
            }
          />
          <Legend
            verticalAlign="top"
            align="right"
            height={28}
            iconType="plainline"
            wrapperStyle={{ fontSize: '11px', fontFamily: 'IBM Plex Mono, monospace' }}
          />
          {latestObsLabel && (
            <ReferenceLine
              yAxisId="vol"
              x={latestObsLabel}
              stroke={CHART_COLORS.slate}
              strokeDasharray="3 3"
              label={{
                value: 'T0',
                position: 'insideTopRight',
                fill: CHART_COLORS.axisText,
                fontSize: 10,
                fontFamily: 'IBM Plex Mono, monospace',
              }}
            />
          )}

          {mode === 'price_vol' && (
            <Line
              yAxisId="price"
              type="monotone"
              dataKey="closePrice"
              name="BTC Close (USD)"
              stroke={CHART_COLORS.cyan}
              strokeWidth={1.5}
              dot={false}
              connectNulls={false}
            />
          )}

          <Area
            yAxisId="vol"
            type="monotone"
            dataKey="targetVol4hPct"
            name="Actual 4H Realized Vol"
            stroke={CHART_COLORS.accent}
            fill={CHART_COLORS.accent}
            fillOpacity={0.08}
            strokeWidth={1.75}
            dot={false}
            connectNulls={false}
          />

          <Line
            yAxisId="vol"
            type="monotone"
            dataKey="histVol24hPct"
            name="24H Rolling Vol"
            stroke={CHART_COLORS.amber}
            strokeWidth={1.4}
            dot={false}
            connectNulls={false}
          />

          {hasModelPreds && (
            <Line
              yAxisId="vol"
              type="monotone"
              dataKey="predictedVolPct"
              name={`Model Estimate (${forecastModelUsed})`}
              stroke={CHART_COLORS.emerald}
              strokeWidth={1.4}
              strokeDasharray="2 2"
              dot={false}
              connectNulls={false}
            />
          )}

          <Line
            yAxisId="vol"
            type="linear"
            dataKey="forecastHorizonPct"
            name="Next-4H Forecast"
            stroke={CHART_COLORS.red}
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={{ r: 4, fill: CHART_COLORS.red, strokeWidth: 0 }}
            connectNulls={true}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
