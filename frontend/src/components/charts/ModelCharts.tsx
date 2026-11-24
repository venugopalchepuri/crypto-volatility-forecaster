import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { BenchmarkRecord, FeatureImportanceRecord } from '../../types/api';
import { AXIS_TICK_STYLE, CHART_COLORS, InstitutionalTooltip } from './ChartCommon';

export function BenchmarkLossChart({ records }: { records: BenchmarkRecord[] }) {
  const data = useMemo(
    () =>
      records.map((r) => ({
        model: r.model.replace(' (24h Vol)', ''),
        rmse: r.rmse,
        mae: r.mae,
        qlike: r.qlike_loss,
      })),
    [records],
  );

  return (
    <div className="h-[250px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 12, left: 4, bottom: 8 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="model" tick={AXIS_TICK_STYLE} tickLine={false} />
          <YAxis yAxisId="err" tick={AXIS_TICK_STYLE} tickLine={false} axisLine={false} width={56} />
          <YAxis
            yAxisId="ql"
            orientation="right"
            tick={AXIS_TICK_STYLE}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <Tooltip content={<InstitutionalTooltip valueFormatter={(val) => val.toFixed(6)} />} />
          <Legend
            verticalAlign="top"
            align="right"
            height={26}
            wrapperStyle={{ fontSize: '10px', fontFamily: 'IBM Plex Mono, monospace' }}
          />
          <Bar yAxisId="err" dataKey="rmse" name="RMSE (left)" fill={CHART_COLORS.accent} radius={[2, 2, 0, 0]} />
          <Bar yAxisId="err" dataKey="mae" name="MAE (left)" fill={CHART_COLORS.cyan} radius={[2, 2, 0, 0]} />
          <Bar yAxisId="ql" dataKey="qlike" name="QLIKE (right)" fill={CHART_COLORS.amber} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BenchmarkDirectionChart({ records }: { records: BenchmarkRecord[] }) {
  const data = useMemo(
    () =>
      records.map((r) => ({
        model: r.model.replace(' (24h Vol)', ''),
        dirAcc: r.directional_accuracy_pct,
        pearson: r.pearson_corr,
      })),
    [records],
  );

  return (
    <div className="h-[250px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 12, left: 4, bottom: 8 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="model" tick={AXIS_TICK_STYLE} tickLine={false} />
          <YAxis
            domain={[0, 100]}
            tick={AXIS_TICK_STYLE}
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Tooltip content={<InstitutionalTooltip valueFormatter={(val) => `${val.toFixed(2)}%`} />} />
          <ReferenceLine y={50} stroke={CHART_COLORS.slate} strokeDasharray="3 3" />
          <Bar dataKey="dirAcc" name="Directional Accuracy (%)" radius={[2, 2, 0, 0]}>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={d.dirAcc >= 50 ? CHART_COLORS.emerald : CHART_COLORS.red}
                fillOpacity={0.8}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function FeatureImportanceChart({ records }: { records: FeatureImportanceRecord[] }) {
  const data = useMemo(
    () =>
      records.slice(0, 10).map((r) => ({
        feature: r.feature,
        pct: r.relative_importance_pct,
        category: r.category,
      })),
    [records],
  );

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 6, right: 20, left: 16, bottom: 4 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            tick={AXIS_TICK_STYLE}
            tickLine={false}
            tickFormatter={(v: number) => `${v}%`}
          />
          <YAxis
            type="category"
            dataKey="feature"
            width={120}
            tick={AXIS_TICK_STYLE}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<InstitutionalTooltip valueFormatter={(val) => `${val.toFixed(2)}%`} />} />
          <Bar dataKey="pct" name="Relative Importance (%)" radius={[0, 2, 2, 0]}>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={d.category.includes('NLP') ? CHART_COLORS.emerald : CHART_COLORS.accent}
                fillOpacity={0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
