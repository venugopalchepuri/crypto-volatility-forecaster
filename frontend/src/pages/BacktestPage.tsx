import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import {
  BacktestDrawdownChart,
  BacktestEquityChart,
  BacktestWeightChart,
} from '../components/charts/BacktestCharts';
import { Badge } from '../components/ui/Badge';
import { Panel, PanelHeader } from '../components/ui/Panel';
import { ErrorState, LoadingBlock } from '../components/ui/StateViews';
import { TooltipInfo } from '../components/ui/TooltipInfo';
import { useSystem } from '../context/SystemContext';
import type { BacktestResponse } from '../types/api';
import { formatNumber, formatPct, formatTimestamp, formatUSD } from '../utils/format';

export function BacktestPage() {
  const { refreshTick } = useSystem();
  const [data, setData] = useState<BacktestResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBacktest = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.getBacktest(500);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load backtest results.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBacktest();
  }, [loadBacktest, refreshTick]);

  const s = data?.summary;
  const curve = data?.equity_curve ?? [];
  const latestPoint = curve.length ? curve[curve.length - 1] : null;

  const returnToneClass = (val: number | undefined) => {
    if (val === undefined) return 'text-[var(--text-muted)]';
    return val > 0 ? 'text-[var(--positive)]' : val < 0 ? 'text-[var(--negative)]' : 'text-[var(--text-primary)]';
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 border-b border-[var(--border-subtle)] pb-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
            Strategy & Backtesting — Volatility Targeting
          </h1>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
            Dynamic exposure scaling vs passive BTC/USDT buy-and-hold across {s?.total_periods ?? '—'} four-hour forward steps.
          </p>
        </div>
        {data?.time_range && (
          <Badge tone="neutral">
            {formatTimestamp(data.time_range.start)} → {formatTimestamp(data.time_range.end)}
          </Badge>
        )}
      </div>

      {error && <ErrorState message={error} onRetry={loadBacktest} />}

      {/* Honest Performance & Risk Summary Strip */}
      <div className="surface-panel grid grid-cols-2 divide-y divide-[var(--border-subtle)] sm:grid-cols-3 lg:grid-cols-6 lg:divide-x lg:divide-y-0">
        <div className="p-3.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Strategy Return
          </div>
          <div className={`mt-1 font-mono text-lg font-semibold tabular-nums ${returnToneClass(s?.strategy_cum_return_pct)}`}>
            {loading ? '...' : formatPct(s?.strategy_cum_return_pct, 2, true)}
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-[var(--text-secondary)]">
            B&H: {formatPct(s?.buy_and_hold_cum_return_pct, 2, true)}
          </div>
        </div>

        <div className="p-3.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Max Drawdown
          </div>
          <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-[var(--negative)]">
            {loading ? '...' : formatPct(s?.strategy_max_drawdown_pct, 2)}
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-[var(--text-secondary)]">
            B&H MDD: {formatPct(s?.buy_and_hold_max_drawdown_pct, 2)}
          </div>
        </div>

        <div className="p-3.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Annualized Vol
          </div>
          <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-[var(--text-primary)]">
            {loading ? '...' : formatPct(s?.strategy_annualized_vol_pct, 2)}
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-[var(--text-secondary)]">
            B&H Vol: {formatPct(s?.buy_and_hold_annualized_vol_pct, 2)}
          </div>
        </div>

        <div className="p-3.5">
          <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            <span>Vol Reduction</span>
            <TooltipInfo text="Percentage reduction in annualized portfolio volatility relative to passive Buy & Hold." />
          </div>
          <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-[var(--accent)]">
            {loading ? '...' : formatPct(s?.volatility_reduction_pct, 2)}
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-[var(--text-secondary)]">
            Risk compression vs B&H
          </div>
        </div>

        <div className="p-3.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Sharpe Ratio
          </div>
          <div className={`mt-1 font-mono text-lg font-semibold tabular-nums ${returnToneClass(s?.strategy_sharpe_ratio)}`}>
            {loading ? '...' : formatNumber(s?.strategy_sharpe_ratio, 2)}
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-[var(--text-secondary)]">
            B&H Sharpe: {formatNumber(s?.buy_and_hold_sharpe_ratio, 2)}
          </div>
        </div>

        <div className="p-3.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Win Rate / End Equity
          </div>
          <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-[var(--text-primary)]">
            {loading ? '...' : formatPct(s?.win_rate_pct, 2)}
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-[var(--text-secondary)]">
            End: {formatUSD(latestPoint?.strategy_equity, 0)} (B&H {formatUSD(latestPoint?.buy_and_hold_equity, 0)})
          </div>
        </div>
      </div>

      {/* Equity Curve */}
      <Panel>
        <PanelHeader
          title="Portfolio Equity Curve ($10,000 Initial Capital)"
          subtitle="Honest cumulative wealth trajectory over a bearish BTC regime; volatility targeting mitigated drawdown relative to passive exposure"
        />
        <div className="p-4">
          {loading ? <LoadingBlock rows={6} height="h-10" /> : <BacktestEquityChart records={curve} />}
        </div>
      </Panel>

      {/* Drawdown + Dynamic Weight */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Underwater Drawdown Comparison"
            subtitle="Percentage decline from prior equity peak (%)"
          />
          <div className="p-4">
            {loading ? <LoadingBlock rows={4} height="h-10" /> : <BacktestDrawdownChart records={curve} />}
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Dynamic Position Sizing & Volatility Signal"
            subtitle="Inverse volatility weight w_t bounded to [0.20x, 1.50x]"
          />
          <div className="p-4">
            {loading ? <LoadingBlock rows={4} height="h-10" /> : <BacktestWeightChart records={curve} />}
          </div>
        </Panel>
      </div>

      {/* Methodology & Limitations */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Panel className="lg:col-span-6">
          <PanelHeader
            title="Risk Comparison Table"
            subtitle="Side-by-side summary metrics from data/processed/backtest_summary.csv"
          />
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-[12px]">
              <thead className="border-b border-[var(--border-default)] bg-[var(--bg-inset)] text-[10px] uppercase text-[var(--text-secondary)]">
                <tr>
                  <th className="px-3 py-2">Metric</th>
                  <th className="px-3 py-2 text-right">Vol-Targeted Strategy</th>
                  <th className="px-3 py-2 text-right">Buy & Hold BTC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                <tr>
                  <td className="px-3 py-2 font-sans text-[var(--text-secondary)]">Cumulative Return</td>
                  <td className={`px-3 py-2 text-right tabular-nums font-medium ${returnToneClass(s?.strategy_cum_return_pct)}`}>
                    {formatPct(s?.strategy_cum_return_pct, 2, true)}
                  </td>
                  <td className={`px-3 py-2 text-right tabular-nums font-medium ${returnToneClass(s?.buy_and_hold_cum_return_pct)}`}>
                    {formatPct(s?.buy_and_hold_cum_return_pct, 2, true)}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-sans text-[var(--text-secondary)]">Maximum Drawdown</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--negative)]">
                    {formatPct(s?.strategy_max_drawdown_pct, 2)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--negative)]">
                    {formatPct(s?.buy_and_hold_max_drawdown_pct, 2)}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-sans text-[var(--text-secondary)]">Annualized Volatility</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatPct(s?.strategy_annualized_vol_pct, 2)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatPct(s?.buy_and_hold_annualized_vol_pct, 2)}</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-sans text-[var(--text-secondary)]">Annualized Sharpe Ratio</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${returnToneClass(s?.strategy_sharpe_ratio)}`}>
                    {formatNumber(s?.strategy_sharpe_ratio, 2)}
                  </td>
                  <td className={`px-3 py-2 text-right tabular-nums ${returnToneClass(s?.buy_and_hold_sharpe_ratio)}`}>
                    {formatNumber(s?.buy_and_hold_sharpe_ratio, 2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel className="lg:col-span-6">
          <PanelHeader
            title="Strategy Methodology, Assumptions & Limitations"
            subtitle="Parameters directly implemented in src/models/backtest.py"
          />
          <div className="space-y-3 p-4 text-xs leading-relaxed text-[var(--text-secondary)]">
            <div className="surface-inset px-3 py-2 font-mono text-[11px] text-[var(--text-primary)]">
              {data?.methodology?.sizing_formula ?? 'w_t = clip(sigma_target / sigma_hat_t, 0.20, 1.50)'}
            </div>
            <ul className="list-disc space-y-1.5 pl-4">
              <li>
                Target 4-hour volatility:{' '}
                <code className="font-mono text-[var(--text-primary)]">
                  {data?.methodology?.target_volatility_4h ?? 0.008}
                </code>{' '}
                (0.8%), weight bounds{' '}
                <code className="font-mono text-[var(--text-primary)]">[0.20x, 1.50x]</code>, transaction cost{' '}
                <code className="font-mono text-[var(--text-primary)]">
                  {data?.methodology?.transaction_cost_bps ?? 5} bps
                </code>{' '}
                per rebalance delta.
              </li>
              {(data?.methodology?.notes ?? []).map((note, idx) => (
                <li key={idx}>{note}</li>
              ))}
              <li>
                Negative absolute returns reflect the underlying BTC drawdown over the evaluated period; volatility
                targeting is a risk-scaling overlay rather than a directional alpha generator.
              </li>
            </ul>
          </div>
        </Panel>
      </div>
    </div>
  );
}
