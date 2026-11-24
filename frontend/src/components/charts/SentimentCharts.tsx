import { useMemo } from 'react';
import {
  Bar,
  BarChart,
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
import type { HourlySentimentRecord } from '../../types/api';
import { formatShortTimestamp } from '../../utils/format';
import { AXIS_TICK_STYLE, CHART_COLORS, InstitutionalTooltip } from './ChartCommon';

export function SentimentTimelineChart({ records }: { records: HourlySentimentRecord[] }) {
  const data = useMemo(
    () =>
      records.map((r) => ({
        label: formatShortTimestamp(r.timestamp),
        avgSentiment: r.avg_sentiment,
        shock: r.sentiment_shock,
        postCount: r.post_count,
      })),
    [records],
  );

  return (
    <div className="h-[270px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={AXIS_TICK_STYLE} tickLine={false} minTickGap={28} />
          <YAxis
            yAxisId="s"
            domain={[-1, 1]}
            ticks={[-1, -0.5, 0, 0.5, 1]}
            tick={AXIS_TICK_STYLE}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <YAxis
            yAxisId="c"
            orientation="right"
            tick={AXIS_TICK_STYLE}
            tickLine={false}
            axisLine={false}
            width={36}
          />
          <Tooltip
            content={
              <InstitutionalTooltip
                valueFormatter={(val, _n, key) =>
                  key === 'postCount' ? `${Math.round(val)} posts` : val.toFixed(4)
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
          <ReferenceLine yAxisId="s" y={0} stroke={CHART_COLORS.slate} strokeDasharray="3 3" />
          <Bar yAxisId="c" dataKey="postCount" name="Hourly Volume" fill="rgba(100,116,139,0.22)" />
          <Line
            yAxisId="s"
            type="monotone"
            dataKey="avgSentiment"
            name="Avg Sentiment"
            stroke={CHART_COLORS.accent}
            strokeWidth={1.7}
            dot={false}
          />
          <Line
            yAxisId="s"
            type="monotone"
            dataKey="shock"
            name="Sentiment Shock (vs 24H)"
            stroke={CHART_COLORS.amber}
            strokeWidth={1.4}
            strokeDasharray="3 2"
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SentimentClassStackedChart({ records }: { records: HourlySentimentRecord[] }) {
  const data = useMemo(
    () =>
      records.map((r) => ({
        label: formatShortTimestamp(r.timestamp),
        pos: Number((r.pct_positive * 100).toFixed(1)),
        neu: Number((r.pct_neutral * 100).toFixed(1)),
        neg: Number((r.pct_negative * 100).toFixed(1)),
      })),
    [records],
  );

  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={AXIS_TICK_STYLE} tickLine={false} minTickGap={28} />
          <YAxis
            domain={[0, 100]}
            tick={AXIS_TICK_STYLE}
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Tooltip content={<InstitutionalTooltip valueFormatter={(val) => `${val.toFixed(1)}%`} />} />
          <Legend
            verticalAlign="top"
            align="right"
            height={26}
            wrapperStyle={{ fontSize: '10px', fontFamily: 'IBM Plex Mono, monospace' }}
          />
          <Bar dataKey="pos" stackId="mix" name="Positive %" fill={CHART_COLORS.emerald} fillOpacity={0.78} />
          <Bar dataKey="neu" stackId="mix" name="Neutral %" fill={CHART_COLORS.slate} fillOpacity={0.55} />
          <Bar dataKey="neg" stackId="mix" name="Negative %" fill={CHART_COLORS.red} fillOpacity={0.78} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
