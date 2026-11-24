import { useMemo } from 'react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
import type { MarketRecord } from '../../types/api';
import { formatShortTimestamp, formatUSD } from '../../utils/format';
import { AXIS_TICK_STYLE, CHART_COLORS, InstitutionalTooltip } from './ChartCommon';

export interface PriceOverlaysState {
  bollinger: boolean;
  sma7: boolean;
  sma24: boolean;
  ema7: boolean;
  ema24: boolean;
}

export function PriceAndVolumeChart({
  records,
  overlays,
}: {
  records: MarketRecord[];
  overlays: PriceOverlaysState;
}) {
  const data = useMemo(
    () =>
      records.map((r) => ({
        label: formatShortTimestamp(r.timestamp),
        close: r.close,
        bb_upper: r.bb_upper ?? null,
        bb_lower: r.bb_lower ?? null,
        bb_middle: r.bb_middle ?? null,
        sma_7: r.sma_7 ?? null,
        sma_24: r.sma_24 ?? null,
        ema_7: r.ema_7 ?? null,
        ema_24: r.ema_24 ?? null,
        volume: r.volume,
        isUp: (r.log_return ?? 0) >= 0,
      })),
    [records],
  );

  return (
    <div className="space-y-3">
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
            <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tick={AXIS_TICK_STYLE}
              tickLine={false}
              axisLine={{ stroke: CHART_COLORS.grid }}
              minTickGap={28}
            />
            <YAxis
              tick={AXIS_TICK_STYLE}
              tickLine={false}
              axisLine={false}
              width={64}
              domain={['auto', 'auto']}
              tickFormatter={(v: number) => `$${Math.round(v).toLocaleString()}`}
            />
            <Tooltip
              content={
                <InstitutionalTooltip valueFormatter={(val) => formatUSD(val)} />
              }
            />
            <Legend
              verticalAlign="top"
              align="right"
              height={26}
              iconType="plainline"
              wrapperStyle={{ fontSize: '10px', fontFamily: 'IBM Plex Mono, monospace' }}
            />

            {overlays.bollinger && (
              <>
                <Line
                  type="monotone"
                  dataKey="bb_upper"
                  name="BB Upper (+2σ)"
                  stroke={CHART_COLORS.slate}
                  strokeDasharray="3 3"
                  strokeWidth={1}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="bb_middle"
                  name="BB Mid (SMA 20)"
                  stroke="rgba(100,116,139,0.55)"
                  strokeWidth={1}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="bb_lower"
                  name="BB Lower (-2σ)"
                  stroke={CHART_COLORS.slate}
                  strokeDasharray="3 3"
                  strokeWidth={1}
                  dot={false}
                />
              </>
            )}

            {overlays.sma7 && (
              <Line
                type="monotone"
                dataKey="sma_7"
                name="SMA 7"
                stroke={CHART_COLORS.amber}
                strokeWidth={1.2}
                dot={false}
              />
            )}
            {overlays.sma24 && (
              <Line
                type="monotone"
                dataKey="sma_24"
                name="SMA 24"
                stroke={CHART_COLORS.violet}
                strokeWidth={1.2}
                dot={false}
              />
            )}
            {overlays.ema7 && (
              <Line
                type="monotone"
                dataKey="ema_7"
                name="EMA 7"
                stroke={CHART_COLORS.emerald}
                strokeWidth={1.2}
                strokeDasharray="2 2"
                dot={false}
              />
            )}
            {overlays.ema24 && (
              <Line
                type="monotone"
                dataKey="ema_24"
                name="EMA 24"
                stroke={CHART_COLORS.red}
                strokeWidth={1.2}
                strokeDasharray="2 2"
                dot={false}
              />
            )}

            <Line
              type="monotone"
              dataKey="close"
              name="BTC Close"
              stroke={CHART_COLORS.cyan}
              strokeWidth={1.8}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Synchronized Volume Bars */}
      <div className="h-[110px] w-full border-t border-[var(--border-subtle)] pt-2">
        <div className="mb-1 px-1 font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
          Hourly Volume (BTC)
        </div>
        <ResponsiveContainer width="100%" height="88%">
          <BarChart data={data} margin={{ top: 2, right: 12, left: 4, bottom: 0 }}>
            <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" hide />
            <YAxis
              tick={AXIS_TICK_STYLE}
              tickLine={false}
              axisLine={false}
              width={64}
              tickFormatter={(v: number) => `${Math.round(v)}`}
            />
            <Tooltip
              content={
                <InstitutionalTooltip valueFormatter={(val) => `${val.toFixed(2)} BTC`} />
              }
            />
            <Bar dataKey="volume" name="Volume (BTC)" radius={[1, 1, 0, 0]}>
              {data.map((entry, idx) => (
                <Cell
                  key={idx}
                  fill={entry.isUp ? 'rgba(16, 185, 129, 0.55)' : 'rgba(239, 68, 68, 0.55)'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export type MarketIndicatorTab = 'volatility' | 'rsi' | 'macd' | 'momentum';

export function MarketIndicatorChart({
  records,
  tab,
}: {
  records: MarketRecord[];
  tab: MarketIndicatorTab;
}) {
  const data = useMemo(
    () =>
      records.map((r) => ({
        label: formatShortTimestamp(r.timestamp),
        vol12h: r.volatility_12h !== null && r.volatility_12h !== undefined ? Number((r.volatility_12h * 100).toFixed(4)) : null,
        vol24h: r.volatility_24h !== null && r.volatility_24h !== undefined ? Number((r.volatility_24h * 100).toFixed(4)) : null,
        logRet: r.log_return !== null && r.log_return !== undefined ? Number((r.log_return * 100).toFixed(4)) : null,
        rsi14: r.rsi_14 ?? null,
        macd: r.macd ?? null,
        macdSignal: r.macd_signal ?? null,
        macdHist: r.macd_hist ?? null,
        mom4h: r.momentum_4h !== null && r.momentum_4h !== undefined ? Number((r.momentum_4h * 100).toFixed(3)) : null,
        mom10h: r.momentum_10h !== null && r.momentum_10h !== undefined ? Number((r.momentum_10h * 100).toFixed(3)) : null,
      })),
    [records],
  );

  if (tab === 'volatility') {
    return (
      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
            <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={AXIS_TICK_STYLE} tickLine={false} minTickGap={28} />
            <YAxis
              yAxisId="v"
              tick={AXIS_TICK_STYLE}
              tickLine={false}
              axisLine={false}
              width={52}
              tickFormatter={(v: number) => `${v.toFixed(2)}%`}
            />
            <YAxis
              yAxisId="r"
              orientation="right"
              tick={AXIS_TICK_STYLE}
              tickLine={false}
              axisLine={false}
              width={52}
              tickFormatter={(v: number) => `${v.toFixed(1)}%`}
            />
            <Tooltip
              content={<InstitutionalTooltip valueFormatter={(val) => `${val.toFixed(3)}%`} />}
            />
            <Legend
              verticalAlign="top"
              align="right"
              height={24}
              wrapperStyle={{ fontSize: '10px', fontFamily: 'IBM Plex Mono, monospace' }}
            />
            <Bar yAxisId="r" dataKey="logRet" name="1H Log Return (%)" fill="rgba(59,130,246,0.28)" />
            <Line yAxisId="v" type="monotone" dataKey="vol12h" name="12H Realized Vol" stroke={CHART_COLORS.cyan} strokeWidth={1.5} dot={false} />
            <Line yAxisId="v" type="monotone" dataKey="vol24h" name="24H Realized Vol" stroke={CHART_COLORS.amber} strokeWidth={1.6} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (tab === 'rsi') {
    return (
      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
            <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={AXIS_TICK_STYLE} tickLine={false} minTickGap={28} />
            <YAxis domain={[0, 100]} ticks={[0, 30, 50, 70, 100]} tick={AXIS_TICK_STYLE} tickLine={false} axisLine={false} width={44} />
            <Tooltip content={<InstitutionalTooltip valueFormatter={(val) => val.toFixed(2)} />} />
            <ReferenceLine y={70} stroke={CHART_COLORS.red} strokeDasharray="3 3" />
            <ReferenceLine y={30} stroke={CHART_COLORS.emerald} strokeDasharray="3 3" />
            <Line type="monotone" dataKey="rsi14" name="RSI (14)" stroke={CHART_COLORS.accent} strokeWidth={1.7} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (tab === 'macd') {
    return (
      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
            <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={AXIS_TICK_STYLE} tickLine={false} minTickGap={28} />
            <YAxis tick={AXIS_TICK_STYLE} tickLine={false} axisLine={false} width={54} />
            <Tooltip content={<InstitutionalTooltip valueFormatter={(val) => val.toFixed(2)} />} />
            <Legend
              verticalAlign="top"
              align="right"
              height={24}
              wrapperStyle={{ fontSize: '10px', fontFamily: 'IBM Plex Mono, monospace' }}
            />
            <ReferenceLine y={0} stroke={CHART_COLORS.slate} />
            <Bar dataKey="macdHist" name="MACD Hist">
              {data.map((d, i) => (
                <Cell
                  key={i}
                  fill={(d.macdHist ?? 0) >= 0 ? 'rgba(16,185,129,0.55)' : 'rgba(239,68,68,0.55)'}
                />
              ))}
            </Bar>
            <Line type="monotone" dataKey="macd" name="MACD (12,26)" stroke={CHART_COLORS.cyan} strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="macdSignal" name="Signal (9)" stroke={CHART_COLORS.amber} strokeWidth={1.4} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={AXIS_TICK_STYLE} tickLine={false} minTickGap={28} />
          <YAxis tick={AXIS_TICK_STYLE} tickLine={false} axisLine={false} width={52} tickFormatter={(v: number) => `${v.toFixed(1)}%`} />
          <Tooltip content={<InstitutionalTooltip valueFormatter={(val) => `${val.toFixed(3)}%`} />} />
          <Legend
            verticalAlign="top"
            align="right"
            height={24}
            wrapperStyle={{ fontSize: '10px', fontFamily: 'IBM Plex Mono, monospace' }}
          />
          <ReferenceLine y={0} stroke={CHART_COLORS.slate} />
          <Area type="monotone" dataKey="mom4h" name="Momentum 4H (%)" stroke={CHART_COLORS.accent} fill={CHART_COLORS.accent} fillOpacity={0.08} strokeWidth={1.5} dot={false} />
          <Line type="monotone" dataKey="mom10h" name="Momentum 10H (%)" stroke={CHART_COLORS.amber} strokeWidth={1.4} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
