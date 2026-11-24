import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { BacktestEquityPoint } from '../../types/api';
import { formatShortTimestamp, formatUSD } from '../../utils/format';
import { AXIS_TICK_STYLE, CHART_COLORS, InstitutionalTooltip } from './ChartCommon';

export function BacktestEquityChart({ records }: { records: BacktestEquityPoint[] }) {
  const data = useMemo(
    () =>
      records.map((r) => ({
        label: formatShortTimestamp(r.timestamp),
        strategyEquity: r.strategy_equity,
        bnhEquity: r.buy_and_hold_equity,
      })),
    [records],
  );

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 14, left: 6, bottom: 0 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={AXIS_TICK_STYLE} tickLine={false} minTickGap={34} />
          <YAxis
            tick={AXIS_TICK_STYLE}
            tickLine={false}
            axisLine={false}
            width={68}
            domain={['auto', 'auto']}
            tickFormatter={(v: number) => `$${Math.round(v).toLocaleString()}`}
          />
          <Tooltip content={<InstitutionalTooltip valueFormatter={(val) => formatUSD(val)} />} />
          <Legend
            verticalAlign="top"
            align="right"
            height={26}
            wrapperStyle={{ fontSize: '10px', fontFamily: 'IBM Plex Mono, monospace' }}
          />
          <ReferenceLine
            y={10000}
            stroke={CHART_COLORS.slate}
            strokeDasharray="3 3"
            label={{
              value: '$10,000 Initial',
              position: 'insideTopLeft',
              fill: CHART_COLORS.axisText,
              fontSize: 10,
              fontFamily: 'IBM Plex Mono, monospace',
            }}
          />
          <Line
            type="monotone"
            dataKey="strategyEquity"
            name="Vol-Targeted Strategy ($)"
            stroke={CHART_COLORS.accent}
            strokeWidth={1.8}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="bnhEquity"
            name="Buy & Hold BTC ($)"
            stroke={CHART_COLORS.slate}
            strokeWidth={1.5}
            strokeDasharray="3 2"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BacktestDrawdownChart({ records }: { records: BacktestEquityPoint[] }) {
  const data = useMemo(
    () =>
      records.map((r) => ({
        label: formatShortTimestamp(r.timestamp),
        stratDD: Number(r.strategy_drawdown_pct.toFixed(2)),
        bnhDD: Number(r.buy_and_hold_drawdown_pct.toFixed(2)),
      })),
    [records],
  );

  return (
    <div className="h-[230px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 14, left: 6, bottom: 0 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={AXIS_TICK_STYLE} tickLine={false} minTickGap={34} />
          <YAxis
            tick={AXIS_TICK_STYLE}
            tickLine={false}
            axisLine={false}
            width={54}
            domain={['auto', 0]}
            tickFormatter={(v: number) => `${v.toFixed(0)}%`}
          />
          <Tooltip content={<InstitutionalTooltip valueFormatter={(val) => `${val.toFixed(2)}%`} />} />
          <Legend
            verticalAlign="top"
            align="right"
            height={26}
            wrapperStyle={{ fontSize: '10px', fontFamily: 'IBM Plex Mono, monospace' }}
          />
          <ReferenceLine y={0} stroke={CHART_COLORS.slate} />
          <Area
            type="monotone"
            dataKey="bnhDD"
            name="Buy & Hold Drawdown (%)"
            stroke={CHART_COLORS.red}
            fill={CHART_COLORS.red}
            fillOpacity={0.1}
            strokeWidth={1.3}
            dot={false}
          />
          <Area
            type="monotone"
            dataKey="stratDD"
            name="Strategy Drawdown (%)"
            stroke={CHART_COLORS.amber}
            fill={CHART_COLORS.amber}
            fillOpacity={0.14}
            strokeWidth={1.6}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BacktestWeightChart({ records }: { records: BacktestEquityPoint[] }) {
  const data = useMemo(
    () =>
      records.map((r) => ({
        label: formatShortTimestamp(r.timestamp),
        weight: Number(r.weight.toFixed(3)),
        volPct: Number((r.forecast_volatility * 100).toFixed(3)),
      })),
    [records],
  );

  return (
    <div className="h-[230px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 14, left: 6, bottom: 0 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={AXIS_TICK_STYLE} tickLine={false} minTickGap={34} />
          <YAxis
            yAxisId="w"
            domain={[0, 1.6]}
            ticks={[0.2, 0.5, 1.0, 1.5]}
            tick={AXIS_TICK_STYLE}
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={(v: number) => `${v.toFixed(1)}x`}
          />
          <YAxis
            yAxisId="v"
            orientation="right"
            tick={AXIS_TICK_STYLE}
            tickLine={false}
            axisLine={false}
            width={50}
            tickFormatter={(v: number) => `${v.toFixed(1)}%`}
          />
          <Tooltip
            content={
              <InstitutionalTooltip
                valueFormatter={(val, _n, key) =>
                  key === 'weight' ? `${val.toFixed(3)}x` : `${val.toFixed(3)}%`
                }
              />
            }
          />
          <Legend
            verticalAlign="top"
            align="right"
            height={26}
            wrapperStyle={{ fontSize: '10px', fontFamily: 'IBM Plex Mono, monospace' }}
          />
          <ReferenceLine yAxisId="w" y={1.0} stroke={CHART_COLORS.slate} strokeDasharray="3 3" />
          <Line
            yAxisId="w"
            type="stepAfter"
            dataKey="weight"
            name="Exposure Weight (x)"
            stroke={CHART_COLORS.cyan}
            strokeWidth={1.5}
            dot={false}
          />
          <Line
            yAxisId="v"
            type="monotone"
            dataKey="volPct"
            name="Volatility Signal (%)"
            stroke={CHART_COLORS.amber}
            strokeWidth={1.2}
            strokeOpacity={0.8}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
