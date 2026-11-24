import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '../api/client';
import {
  OverviewForecastChart,
  type OverviewChartMode,
} from '../components/charts/OverviewForecastChart';
import { Badge } from '../components/ui/Badge';
import { Panel, PanelHeader } from '../components/ui/Panel';
import { ErrorState, LoadingBlock } from '../components/ui/StateViews';
import { TooltipInfo } from '../components/ui/TooltipInfo';
import { useSystem } from '../context/SystemContext';
import type { ForecastSeriesResponse, ModelKey } from '../types/api';
import { formatNumber, formatTimestamp, formatUSD, formatVolPct } from '../utils/format';

const MARKET_FEATURE_GROUPS: { key: string; label: string; category: string; format: 'pct' | 'usd' | 'num' }[] = [
  { key: 'log_return', label: '1H Log Return', category: 'Market Technical', format: 'pct' },
  { key: 'volatility_12h', label: 'Realized Volatility (12H)', category: 'Market Technical', format: 'pct' },
  { key: 'volatility_24h', label: 'Realized Volatility (24H)', category: 'Market Technical', format: 'pct' },
  { key: 'vol_change_pct', label: 'Volume Change %', category: 'Market Technical', format: 'pct' },
  { key: 'rsi_14', label: 'RSI (14)', category: 'Market Technical', format: 'num' },
  { key: 'macd', label: 'MACD Line (12,26)', category: 'Market Technical', format: 'num' },
  { key: 'macd_signal', label: 'MACD Signal (9)', category: 'Market Technical', format: 'num' },
  { key: 'macd_hist', label: 'MACD Histogram', category: 'Market Technical', format: 'num' },
  { key: 'bb_width', label: 'Bollinger Width', category: 'Market Technical', format: 'pct' },
  { key: 'bb_pct_b', label: 'Bollinger %B', category: 'Market Technical', format: 'num' },
  { key: 'momentum_4h', label: 'Momentum (4H)', category: 'Market Technical', format: 'pct' },
  { key: 'momentum_10h', label: 'Momentum (10H)', category: 'Market Technical', format: 'pct' },
  { key: 'avg_sentiment', label: 'Avg FinBERT Sentiment', category: 'NLP Sentiment', format: 'num' },
  { key: 'pct_positive', label: 'Positive Post Ratio', category: 'NLP Sentiment', format: 'pct' },
  { key: 'pct_negative', label: 'Negative Post Ratio', category: 'NLP Sentiment', format: 'pct' },
  { key: 'sentiment_variance', label: 'Sentiment Variance', category: 'NLP Sentiment', format: 'num' },
  { key: 'sentiment_shock', label: 'Sentiment Shock (vs 24H)', category: 'NLP Sentiment', format: 'num' },
  { key: 'sentiment_missing', label: 'Sentiment Missing Flag', category: 'NLP Sentiment', format: 'num' },
];

export function ForecastPage() {
  const { selectedModel, setSelectedModel, status, refreshTick } = useSystem();
  const [data, setData] = useState<ForecastSeriesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartMode, setChartMode] = useState<OverviewChartMode>('volatility');

  const loadForecast = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.getForecastSeries(200, selectedModel);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load volatility forecast.');
    } finally {
      setLoading(false);
    }
  }, [selectedModel]);

  useEffect(() => {
    loadForecast();
  }, [loadForecast, refreshTick]);

  const fc = data?.current_forecast;
  const features = fc?.latest_features ?? {};

  const testSeriesSummary = useMemo(() => {
    const testRows = (data?.records ?? []).filter(
      (r) => r.split === 'test' && r.target_future_volatility !== null && r.predicted_volatility !== null,
    );
    if (!testRows.length) return null;
    const sqErr = testRows.reduce(
      (acc, r) => acc + Math.pow((r.target_future_volatility ?? 0) - (r.predicted_volatility ?? 0), 2),
      0,
    );
    return {
      count: testRows.length,
      rmse: Math.sqrt(sqErr / testRows.length),
    };
  }, [data]);

  const regimeTone =
    fc?.volatility_regime === 'High Volatility'
      ? 'negative'
      : fc?.volatility_regime === 'Moderate Volatility'
      ? 'warning'
      : 'positive';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 border-b border-[var(--border-subtle)] pb-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
            Volatility Forecast Workspace
          </h1>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
            Short-horizon 4-hour forward realized volatility prediction and multimodal input inspection.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-[3px] border border-[var(--border-default)] bg-[var(--bg-panel)] p-0.5 font-mono text-[11px]">
            {(['gru', 'lstm', 'ridge'] as ModelKey[]).map((m) => {
              const available = status?.available_models?.[m];
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setSelectedModel(m)}
                  className={`rounded-[2px] px-2.5 py-1 uppercase transition-colors ${
                    selectedModel === m
                      ? 'bg-[var(--accent)] text-white'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {m}
                  {available === false ? ' *' : ''}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={loadForecast} />}

      {/* Forecast Summary Strip */}
      <div className="surface-panel grid grid-cols-1 divide-y divide-[var(--border-subtle)] sm:grid-cols-2 lg:grid-cols-5 lg:divide-x lg:divide-y-0">
        <div className="border-l-2 border-l-[var(--accent)] bg-[var(--accent-muted)]/25 p-4">
          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-[var(--accent)]">
            <span>Forecasted Volatility</span>
            <Badge tone={regimeTone}>{fc?.volatility_regime ?? '—'}</Badge>
          </div>
          <div className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-[var(--text-primary)]">
            {loading ? '...' : formatVolPct(fc?.forecast_next_4h_volatility)}
          </div>
          <div className="mt-1 font-mono text-[10px] text-[var(--text-secondary)]">
            Raw: {fc ? fc.forecast_next_4h_volatility.toFixed(6) : '—'}
          </div>
        </div>

        <div className="p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Forecast Horizon
          </div>
          <div className="mt-1.5 font-mono text-lg font-semibold text-[var(--text-primary)]">
            {fc?.horizon_hours ?? 4} Hours Forward
          </div>
          <div className="mt-1 font-mono text-[10px] text-[var(--text-secondary)]">
            Target: {data?.target_formula ?? 'sqrt(sum_{k=1..4} r_{t+k}^2)'}
          </div>
        </div>

        <div className="p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Active Model
          </div>
          <div className="mt-1.5 text-sm font-semibold text-[var(--text-primary)]">
            {fc?.model_used ?? '—'}
          </div>
          <div className="mt-1 font-mono text-[10px] text-[var(--text-secondary)]">
            {fc?.fallback_used
              ? `Requested ${fc.model_requested.toUpperCase()} unavailable; using fallback`
              : `Requested: ${fc?.model_requested?.toUpperCase() ?? '—'}`}
          </div>
        </div>

        <div className="p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Baseline (24H Realized Vol)
          </div>
          <div className="mt-1.5 font-mono text-lg font-semibold tabular-nums text-[var(--warning)]">
            {formatVolPct(fc?.historical_24h_volatility)}
          </div>
          <div className="mt-1 font-mono text-[10px] text-[var(--text-secondary)]">
            Spot: {formatUSD(fc?.current_price)}
          </div>
        </div>

        <div className="p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Latest Observation (T0)
          </div>
          <div className="mt-1.5 font-mono text-xs font-medium text-[var(--text-primary)]">
            {formatTimestamp(fc?.timestamp)}
          </div>
          <div className="mt-1 font-mono text-[10px] text-[var(--text-secondary)]">
            Source: {fc?.data_source ?? '—'}
          </div>
        </div>
      </div>

      {/* Main Forecast Visualization */}
      <Panel>
        <PanelHeader
          title="Historical Realized vs Forecasted Volatility"
          subtitle="Chronological observations up to T0 and projected 4-hour forward horizon step"
          right={
            <div className="inline-flex rounded-[3px] border border-[var(--border-default)] bg-[var(--bg-inset)] p-0.5 font-mono text-[10px]">
              <button
                type="button"
                onClick={() => setChartMode('volatility')}
                className={`rounded-[2px] px-2 py-0.5 ${
                  chartMode === 'volatility'
                    ? 'bg-[var(--bg-hover)] text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)]'
                }`}
              >
                Volatility
              </button>
              <button
                type="button"
                onClick={() => setChartMode('price_vol')}
                className={`rounded-[2px] px-2 py-0.5 ${
                  chartMode === 'price_vol'
                    ? 'bg-[var(--bg-hover)] text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)]'
                }`}
              >
                + Price Overlay
              </button>
            </div>
          }
        />
        <div className="p-4">
          {loading ? (
            <LoadingBlock rows={6} height="h-10" />
          ) : (
            <OverviewForecastChart
              records={data?.records ?? []}
              forecastVolatility={fc?.forecast_next_4h_volatility ?? null}
              forecastModelUsed={data?.prediction_model_used ?? fc?.model_used ?? 'Persistence'}
              mode={chartMode}
            />
          )}
        </div>
      </Panel>

      {/* Methodology + Prediction Metadata & Feature Vector */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Left: Methodology & Metadata (5 cols) */}
        <div className="space-y-4 lg:col-span-5">
          <Panel>
            <PanelHeader title="Forecast Methodology" subtitle="Target formulation & lookahead controls" />
            <div className="space-y-3 p-4 text-xs leading-relaxed text-[var(--text-secondary)]">
              <p>
                The system forecasts short-term realized volatility using a combination of market-derived
                technical features and FinBERT financial news sentiment.
              </p>
              <p>
                The target is the realized volatility over the subsequent four-hour horizon:
              </p>
              <div className="surface-inset px-3 py-2 font-mono text-[11px] text-[var(--text-primary)]">
                σ_target(t) = √( Σ_(k=1..4) r²_(t+k) )
              </div>
              <p>
                Input features at time <code className="font-mono text-[var(--text-primary)]">t</code>{' '}
                strictly exclude <code className="font-mono text-[var(--text-primary)]">r_(t+1..t+4)</code>.
                Deep sequence models (CryptoGRU, CryptoLSTM) ingest a 12-hour sliding window normalized by a{' '}
                <code className="font-mono text-[var(--text-primary)]">StandardScaler</code> fit solely on the
                chronological 70% training partition.
              </p>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Prediction Metadata" subtitle="Point estimate & regime classification" />
            <div className="p-4">
              <dl className="space-y-2.5 font-mono text-[11px]">
                <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
                  <dt className="text-[var(--text-secondary)]">Point Estimate</dt>
                  <dd className="font-semibold text-[var(--text-primary)]">
                    {fc ? `${(fc.forecast_next_4h_volatility * 100).toFixed(4)}%` : '—'}
                  </dd>
                </div>
                <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
                  <dt className="flex items-center gap-1 text-[var(--text-secondary)]">
                    Confidence Interval
                    <TooltipInfo text="Current models (Ridge, GRU, LSTM) output deterministic point forecasts via linear / Softplus heads without variance estimation." />
                  </dt>
                  <dd className="text-[var(--text-muted)]">Not computed (point model)</dd>
                </div>
                <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
                  <dt className="text-[var(--text-secondary)]">Regime Thresholds</dt>
                  <dd className="text-[var(--text-secondary)]">
                    &le;0.6% Low · &le;1.5% Mod · &gt;1.5% High
                  </dd>
                </div>
                <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
                  <dt className="text-[var(--text-secondary)]">Available Checkpoints</dt>
                  <dd className="text-[var(--text-primary)]">
                    {status?.available_models
                      ? Object.entries(status.available_models)
                          .filter(([, ok]) => ok)
                          .map(([k]) => k.toUpperCase())
                          .join(', ')
                      : '—'}
                  </dd>
                </div>
                {testSeriesSummary && (
                  <div className="flex items-center justify-between">
                    <dt className="text-[var(--text-secondary)]">Active Model Test RMSE</dt>
                    <dd className="text-[var(--text-primary)]">
                      {testSeriesSummary.rmse.toFixed(6)} ({testSeriesSummary.count} test rows)
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </Panel>
        </div>

        {/* Right: 18 Multimodal Input Features at T0 (7 cols) */}
        <Panel className="lg:col-span-7">
          <PanelHeader
            title="Latest Input Feature Vector (T0)"
            subtitle="18 synchronized features fed into the volatility forecasting pipeline"
          />
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-[11px]">
              <thead className="border-b border-[var(--border-default)] bg-[var(--bg-inset)] text-[10px] uppercase text-[var(--text-secondary)]">
                <tr>
                  <th className="px-3 py-2">Feature</th>
                  <th className="px-3 py-2">Key</th>
                  <th className="px-3 py-2">Modality</th>
                  <th className="px-3 py-2 text-right">Value at T0</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {MARKET_FEATURE_GROUPS.map((f) => {
                  const rawVal = features[f.key];
                  const numVal = typeof rawVal === 'number' ? rawVal : null;
                  const formatted =
                    numVal === null
                      ? '—'
                      : f.format === 'pct'
                      ? formatVolPct(numVal)
                      : formatNumber(numVal, 4);
                  return (
                    <tr key={f.key} className="hover:bg-[var(--bg-hover)]">
                      <td className="px-3 py-1.5 font-sans font-medium text-[var(--text-primary)]">
                        {f.label}
                      </td>
                      <td className="px-3 py-1.5 text-[var(--text-muted)]">{f.key}</td>
                      <td className="px-3 py-1.5">
                        <Badge tone={f.category === 'NLP Sentiment' ? 'accent' : 'neutral'}>
                          {f.category}
                        </Badge>
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-[var(--text-primary)]">
                        {formatted}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
