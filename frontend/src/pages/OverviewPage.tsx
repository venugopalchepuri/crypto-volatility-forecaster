import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, RefreshCw } from 'lucide-react';
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
import type {
  AblationResponse,
  BenchmarkResponse,
  ForecastSeriesResponse,
  MarketLatestResponse,
  ModelKey,
  SentimentOverviewResponse,
} from '../types/api';
import {
  formatNumber,
  formatPct,
  formatTimestamp,
  formatUSD,
  formatVolPct,
} from '../utils/format';

interface RangeOption {
  key: string;
  label: string;
  hours: number;
}

const ALL_RANGE_CANDIDATES: RangeOption[] = [
  { key: '24H', label: '24H', hours: 24 },
  { key: '48H', label: '48H', hours: 48 },
  { key: '72H', label: '72H', hours: 72 },
  { key: '7D', label: '7D', hours: 168 },
  { key: '30D', label: '30D', hours: 720 },
  { key: '90D', label: '90D', hours: 2160 },
];

export function OverviewPage() {
  const { status, selectedModel, setSelectedModel, refreshing, triggerRefresh, refreshTick } =
    useSystem();

  const [rangeKey, setRangeKey] = useState<string>('72H');
  const [chartMode, setChartMode] = useState<OverviewChartMode>('volatility');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [forecastData, setForecastData] = useState<ForecastSeriesResponse | null>(null);
  const [marketData, setMarketData] = useState<MarketLatestResponse | null>(null);
  const [benchmarks, setBenchmarks] = useState<BenchmarkResponse | null>(null);
  const [ablation, setAblation] = useState<AblationResponse | null>(null);
  const [sentiment, setSentiment] = useState<SentimentOverviewResponse | null>(null);

  const availableRanges = useMemo(() => {
    const maxRows = forecastData?.total_available ?? status?.aligned_dataset_rows ?? 72;
    const supported = ALL_RANGE_CANDIDATES.filter((r) => r.hours <= maxRows);
    if (supported.length === 0) {
      return [{ key: 'ALL', label: `${maxRows}H`, hours: maxRows }];
    }
    return supported;
  }, [forecastData?.total_available, status?.aligned_dataset_rows]);

  const activeHours = useMemo(() => {
    const match = availableRanges.find((r) => r.key === rangeKey);
    return match ? match.hours : availableRanges[availableRanges.length - 1].hours;
  }, [availableRanges, rangeKey]);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [fc, mk, bm, ab, st] = await Promise.all([
        apiClient.getForecastSeries(500, selectedModel),
        apiClient.getMarketLatest(100),
        apiClient.getBenchmarks(),
        apiClient.getAblation(),
        apiClient.getSentimentOverview({ limit: 5 }),
      ]);
      setForecastData(fc);
      setMarketData(mk);
      setBenchmarks(bm);
      setAblation(ab);
      setSentiment(st);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load overview data.');
    } finally {
      setLoading(false);
    }
  }, [selectedModel]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview, refreshTick]);

  const visibleSeries = useMemo(() => {
    const all = forecastData?.records ?? [];
    return all.slice(-activeHours);
  }, [forecastData, activeHours]);

  const currentFc = forecastData?.current_forecast;
  const marketSummary = marketData?.summary;

  // Identify best models by explicit metric on Held-Out 15% Test Split
  const bestByRmse = useMemo(() => {
    const rows = benchmarks?.records ?? [];
    if (!rows.length) return null;
    return [...rows].sort((a, b) => a.rmse - b.rmse)[0];
  }, [benchmarks]);

  const bestByDirAcc = useMemo(() => {
    const rows = benchmarks?.records ?? [];
    if (!rows.length) return null;
    return [...rows].sort((a, b) => b.directional_accuracy_pct - a.directional_accuracy_pct)[0];
  }, [benchmarks]);

  const change24h = marketSummary?.change_24h_pct;
  const sentScore = currentFc?.latest_sentiment_score;

  const regimeTone =
    currentFc?.volatility_regime === 'High Volatility'
      ? 'negative'
      : currentFc?.volatility_regime === 'Moderate Volatility'
      ? 'warning'
      : 'positive';

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-3 border-b border-[var(--border-subtle)] pb-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
            Algorithmic Crypto Volatility Forecaster
          </h1>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
            Market intelligence and short-horizon volatility analytics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Instrument Badge */}
          <div className="flex items-center gap-1.5 rounded-[3px] border border-[var(--border-default)] bg-[var(--bg-panel)] px-2.5 py-1 font-mono text-[11px]">
            <span className="text-[var(--text-muted)]">INSTRUMENT</span>
            <span className="font-semibold text-[var(--text-primary)]">
              {status?.trading_pair ?? 'BTC/USDT'}
            </span>
          </div>

          {/* Model Selector */}
          <label className="flex items-center gap-1.5 rounded-[3px] border border-[var(--border-default)] bg-[var(--bg-panel)] px-2 py-1 font-mono text-[11px]">
            <span className="text-[var(--text-muted)]">MODEL</span>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value as ModelKey)}
              className="bg-transparent font-mono text-[11px] font-medium text-[var(--text-primary)] focus:outline-none"
            >
              <option value="gru" className="bg-[var(--bg-panel)]">
                CryptoGRU {status?.available_models?.gru ? '' : '(fallback)'}
              </option>
              <option value="lstm" className="bg-[var(--bg-panel)]">
                CryptoLSTM {status?.available_models?.lstm ? '' : '(fallback)'}
              </option>
              <option value="ridge" className="bg-[var(--bg-panel)]">
                Ridge {status?.available_models?.ridge ? '' : '(fallback)'}
              </option>
            </select>
          </label>

          {/* Supported Time Range Selector */}
          <div
            role="group"
            aria-label="Chart time range"
            className="inline-flex rounded-[3px] border border-[var(--border-default)] bg-[var(--bg-panel)] p-0.5 font-mono text-[11px]"
          >
            {availableRanges.map((opt) => {
              const active = opt.hours === activeHours;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setRangeKey(opt.key)}
                  className={`rounded-[2px] px-2 py-0.5 transition-colors ${
                    active
                      ? 'bg-[var(--accent)] text-white'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={triggerRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-[3px] border border-[var(--border-default)] bg-[var(--bg-panel)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Refreshing' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={loadOverview} />}

      {/* Market Summary Strip */}
      <div className="surface-panel grid grid-cols-2 divide-y divide-[var(--border-subtle)] sm:grid-cols-3 lg:grid-cols-6 lg:divide-x lg:divide-y-0">
        <div className="p-3.5">
          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--text-secondary)]">
            <span>BTC Price</span>
            <span className="font-mono text-[var(--text-muted)]">SPOT</span>
          </div>
          <div className="mt-1.5 font-mono text-lg font-semibold tabular-nums text-[var(--text-primary)]">
            {loading ? '...' : formatUSD(marketSummary?.latest_close ?? currentFc?.current_price)}
          </div>
          <div className="mt-1 font-mono text-[10px] text-[var(--text-muted)]">
            {marketSummary?.latest_timestamp ? formatTimestamp(marketSummary.latest_timestamp) : 'Unavailable'}
          </div>
        </div>

        <div className="p-3.5">
          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--text-secondary)]">
            <span>24H Change</span>
            <span className="font-mono text-[var(--text-muted)]">1D</span>
          </div>
          <div
            className={`mt-1.5 font-mono text-lg font-semibold tabular-nums ${
              change24h === undefined
                ? 'text-[var(--text-muted)]'
                : change24h >= 0
                ? 'text-[var(--positive)]'
                : 'text-[var(--negative)]'
            }`}
          >
            {loading ? '...' : formatPct(change24h, 2, true)}
          </div>
          <div className="mt-1 font-mono text-[10px] text-[var(--text-muted)]">
            Range: {formatUSD(marketSummary?.low_24h, 0)}–{formatUSD(marketSummary?.high_24h, 0)}
          </div>
        </div>

        <div className="p-3.5">
          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--text-secondary)]">
            <span className="inline-flex items-center gap-1">
              Realized Vol (24H)
              <TooltipInfo text="Rolling 24-hour standard deviation of 1-hour log returns." />
            </span>
            <span className="font-mono text-[var(--text-muted)]">σ₂₄ₕ</span>
          </div>
          <div className="mt-1.5 font-mono text-lg font-semibold tabular-nums text-[var(--warning)]">
            {loading ? '...' : formatVolPct(currentFc?.historical_24h_volatility)}
          </div>
          <div className="mt-1 font-mono text-[10px] text-[var(--text-muted)]">
            12H: {formatVolPct(currentFc?.historical_12h_volatility)}
          </div>
        </div>

        <div className="border-l-2 border-l-[var(--accent)] bg-[var(--accent-muted)]/30 p-3.5">
          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--accent)]">
            <span className="inline-flex items-center gap-1">
              Forecast Vol (4H)
              <TooltipInfo text="Predicted realized volatility over the subsequent 4 hours: sqrt(sum r²_{t+1..t+4})." />
            </span>
            <Badge tone={regimeTone}>{currentFc?.volatility_regime ?? '—'}</Badge>
          </div>
          <div className="mt-1.5 font-mono text-lg font-semibold tabular-nums text-[var(--text-primary)]">
            {loading ? '...' : formatVolPct(currentFc?.forecast_next_4h_volatility)}
          </div>
          <div className="mt-1 truncate font-mono text-[10px] text-[var(--text-secondary)]">
            {currentFc?.model_used ?? 'Unavailable'}
            {currentFc?.fallback_used ? ' (fallback)' : ''}
          </div>
        </div>

        <div className="p-3.5">
          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--text-secondary)]">
            <span className="inline-flex items-center gap-1">
              Sentiment Score
              <TooltipInfo text="Hourly FinBERT composite score: P(positive) - P(negative) in [-1, +1]." />
            </span>
            <span className="font-mono text-[var(--text-muted)]">FINBERT</span>
          </div>
          <div
            className={`mt-1.5 font-mono text-lg font-semibold tabular-nums ${
              sentScore === undefined
                ? 'text-[var(--text-muted)]'
                : sentScore > 0.15
                ? 'text-[var(--positive)]'
                : sentScore < -0.15
                ? 'text-[var(--negative)]'
                : 'text-[var(--text-primary)]'
            }`}
          >
            {loading ? '...' : formatNumber(sentScore, 3, true)}
          </div>
          <div className="mt-1 font-mono text-[10px] text-[var(--text-muted)]">
            Shock: {formatNumber(sentiment?.hourly_summary?.latest_sentiment_shock, 3, true)}
          </div>
        </div>

        <div className="p-3.5">
          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--text-secondary)]">
            <span>Data Status</span>
            <span className="font-mono text-[var(--text-muted)]">FEED</span>
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 font-mono text-sm font-semibold text-[var(--text-primary)]">
            <span
              className={`h-2 w-2 rounded-full ${
                status?.status === 'online' ? 'bg-[var(--positive)]' : 'bg-[var(--negative)]'
              }`}
            />
            <span>{status?.data_source ?? 'Unavailable'}</span>
          </div>
          <div className="mt-1 font-mono text-[10px] text-[var(--text-muted)]">
            {status?.aligned_dataset_rows ?? 0} aligned · {status?.market_dataset_rows ?? 0} mkt rows
          </div>
        </div>
      </div>

      {/* Main Forecast Visualization (Centerpiece) */}
      <Panel>
        <PanelHeader
          title="Short-Horizon Realized Volatility & Forecast Horizon"
          subtitle={`Historical 24H rolling volatility, actual 4H forward realized target √(Σr²), and next-4H forecast (${visibleSeries.length} hourly observations)`}
          right={
            <div className="flex items-center gap-2">
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
                  Volatility Series
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
                  Price + Volatility
                </button>
              </div>
              <Link
                to="/forecast"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--accent)] hover:underline"
              >
                <span>Forecast Workspace</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          }
        />
        <div className="p-4">
          {loading ? (
            <LoadingBlock rows={6} height="h-10" />
          ) : (
            <OverviewForecastChart
              records={visibleSeries}
              forecastVolatility={currentFc?.forecast_next_4h_volatility ?? null}
              forecastModelUsed={forecastData?.prediction_model_used ?? currentFc?.model_used ?? 'Persistence'}
              mode={chartMode}
            />
          )}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-2 font-mono text-[10px] text-[var(--text-muted)]">
            <span>
              T0 Observation: {formatTimestamp(currentFc?.timestamp)} · Horizon: Next 4 Hours
            </span>
            <span>
              {forecastData?.prediction_model_used
                ? `Active historical estimate overlay: ${forecastData.prediction_model_used}`
                : 'Deep model checkpoints (.pt) not loaded in current runtime; showing historical realized series + active fallback forecast.'}
            </span>
          </div>
        </div>
      </Panel>

      {/* Model Snapshot + Market Intelligence */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Model Snapshot (5 cols) */}
        <Panel className="lg:col-span-5">
          <PanelHeader
            title="Model Snapshot"
            subtitle={benchmarks?.split_info ?? 'Held-Out 15% Test Split'}
            right={
              <Link
                to="/models"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--accent)] hover:underline"
              >
                <span>Full Evaluation</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            }
          />
          <div className="p-4 space-y-3">
            {loading ? (
              <LoadingBlock rows={4} />
            ) : bestByRmse ? (
              <>
                <div className="surface-inset grid grid-cols-2 gap-3 p-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Best by RMSE & QLIKE
                    </div>
                    <div className="mt-1 text-xs font-semibold text-[var(--text-primary)]">
                      {bestByRmse.model}
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] text-[var(--text-secondary)]">
                      RMSE {bestByRmse.rmse.toFixed(6)} · QLIKE {bestByRmse.qlike_loss.toFixed(4)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Best by Directional Acc.
                    </div>
                    <div className="mt-1 text-xs font-semibold text-[var(--text-primary)]">
                      {bestByDirAcc?.model ?? '—'}
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] text-[var(--positive)]">
                      {bestByDirAcc ? `${bestByDirAcc.directional_accuracy_pct.toFixed(2)}%` : '—'}
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto border border-[var(--border-subtle)] rounded-[3px]">
                  <table className="w-full text-left font-mono text-[11px]">
                    <thead className="border-b border-[var(--border-default)] bg-[var(--bg-inset)] text-[10px] uppercase text-[var(--text-secondary)]">
                      <tr>
                        <th className="px-2.5 py-1.5">Model (15% Test)</th>
                        <th className="px-2.5 py-1.5 text-right">RMSE</th>
                        <th className="px-2.5 py-1.5 text-right">MAE</th>
                        <th className="px-2.5 py-1.5 text-right">QLIKE</th>
                        <th className="px-2.5 py-1.5 text-right">Dir Acc</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)]">
                      {(benchmarks?.records ?? []).map((row) => (
                        <tr key={row.model} className="hover:bg-[var(--bg-hover)]">
                          <td className="px-2.5 py-1.5 font-sans font-medium text-[var(--text-primary)]">
                            {row.model}
                          </td>
                          <td className="px-2.5 py-1.5 text-right tabular-nums text-[var(--text-secondary)]">
                            {row.rmse.toFixed(6)}
                          </td>
                          <td className="px-2.5 py-1.5 text-right tabular-nums text-[var(--text-secondary)]">
                            {row.mae.toFixed(6)}
                          </td>
                          <td className="px-2.5 py-1.5 text-right tabular-nums text-[var(--text-secondary)]">
                            {row.qlike_loss.toFixed(4)}
                          </td>
                          <td className="px-2.5 py-1.5 text-right tabular-nums text-[var(--text-primary)]">
                            {row.directional_accuracy_pct.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="py-6 text-center font-mono text-xs text-[var(--text-muted)]">
                Benchmark metrics unavailable. Run training pipeline.
              </div>
            )}
          </div>
        </Panel>

        {/* Market Intelligence (7 cols) */}
        <Panel className="lg:col-span-7">
          <PanelHeader
            title="Market Intelligence"
            subtitle="Technical indicator state, FinBERT NLP summary, and permutation feature drivers"
            right={
              <Link
                to="/market"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--accent)] hover:underline"
              >
                <span>Market Workspace</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            }
          />
          <div className="grid grid-cols-1 divide-y divide-[var(--border-subtle)] md:grid-cols-3 md:divide-x md:divide-y-0">
            {/* Column 1: Technical Indicators */}
            <div className="p-4">
              <div className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]">
                Technical Indicators
              </div>
              <dl className="space-y-2 font-mono text-[11px]">
                <div className="flex items-center justify-between">
                  <dt className="text-[var(--text-secondary)]">RSI (14)</dt>
                  <dd className="tabular-nums font-medium text-[var(--text-primary)]">
                    {formatNumber(marketSummary?.rsi_14, 2)}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-[var(--text-secondary)]">MACD Hist</dt>
                  <dd
                    className={`tabular-nums font-medium ${
                      (marketSummary?.macd_hist ?? 0) >= 0
                        ? 'text-[var(--positive)]'
                        : 'text-[var(--negative)]'
                    }`}
                  >
                    {formatNumber(marketSummary?.macd_hist, 2, true)}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-[var(--text-secondary)]">Bollinger %B</dt>
                  <dd className="tabular-nums font-medium text-[var(--text-primary)]">
                    {formatNumber(marketSummary?.bb_pct_b, 3)}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-[var(--text-secondary)]">BB Width</dt>
                  <dd className="tabular-nums font-medium text-[var(--text-primary)]">
                    {formatPct((marketSummary?.bb_width ?? 0) * 100, 2)}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-[var(--text-secondary)]">Momentum 4H</dt>
                  <dd
                    className={`tabular-nums font-medium ${
                      (marketSummary?.momentum_4h ?? 0) >= 0
                        ? 'text-[var(--positive)]'
                        : 'text-[var(--negative)]'
                    }`}
                  >
                    {formatPct((marketSummary?.momentum_4h ?? 0) * 100, 2, true)}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Column 2: Sentiment Summary */}
            <div className="p-4">
              <div className="mb-2.5 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]">
                  Sentiment Summary
                </span>
                <Link to="/sentiment" className="font-mono text-[10px] text-[var(--accent)] hover:underline">
                  NLP
                </Link>
              </div>
              <dl className="space-y-2 font-mono text-[11px]">
                <div className="flex items-center justify-between">
                  <dt className="text-[var(--text-secondary)]">Latest Score</dt>
                  <dd className="tabular-nums font-medium text-[var(--text-primary)]">
                    {formatNumber(sentiment?.hourly_summary?.latest_avg_sentiment, 4, true)}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-[var(--text-secondary)]">24H Shock</dt>
                  <dd className="tabular-nums font-medium text-[var(--text-primary)]">
                    {formatNumber(sentiment?.hourly_summary?.latest_sentiment_shock, 4, true)}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-[var(--text-secondary)]">Headlines</dt>
                  <dd className="tabular-nums font-medium text-[var(--text-primary)]">
                    {sentiment?.total_headlines ?? '—'}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-[var(--text-secondary)]">Pos / Neg / Neu</dt>
                  <dd className="tabular-nums text-[var(--text-secondary)]">
                    {sentiment
                      ? `${sentiment.headline_distribution.bullish} / ${sentiment.headline_distribution.bearish} / ${sentiment.headline_distribution.neutral}`
                      : '—'}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-[var(--text-secondary)]">Source</dt>
                  <dd className="truncate text-[10px] text-[var(--text-muted)]">
                    {sentiment?.data_sources?.[0] ?? '—'}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Column 3: Top Permutation Drivers */}
            <div className="p-4">
              <div className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]">
                Top Feature Drivers
              </div>
              <div className="space-y-2">
                {(ablation?.feature_importance ?? []).slice(0, 5).map((feat) => (
                  <div key={feat.feature} className="space-y-0.5">
                    <div className="flex items-center justify-between font-mono text-[11px]">
                      <span className="truncate text-[var(--text-primary)]">{feat.feature}</span>
                      <span className="tabular-nums text-[var(--text-secondary)]">
                        {feat.relative_importance_pct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-1 w-full overflow-hidden rounded-[1px] bg-[var(--bg-inset)]">
                      <div
                        className="h-full bg-[var(--accent)]"
                        style={{ width: `${Math.min(100, feat.relative_importance_pct)}%` }}
                      />
                    </div>
                  </div>
                ))}
                {!ablation?.feature_importance?.length && (
                  <div className="font-mono text-[11px] text-[var(--text-muted)]">Unavailable</div>
                )}
              </div>
            </div>
          </div>
        </Panel>
      </div>

      {/* System Activity / Pipeline Health Strip */}
      <Panel>
        <PanelHeader
          title="System Activity & Pipeline Health"
          subtitle="Live runtime status reported by the FastAPI backend"
          right={
            <Link
              to="/system"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--accent)] hover:underline"
            >
              <span>Diagnostics</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          }
        />
        <div className="grid grid-cols-1 divide-y divide-[var(--border-subtle)] sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-y-0">
          <div className="px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              API & Pipeline
            </div>
            <div className="mt-1 flex items-center gap-2 font-mono text-xs text-[var(--text-primary)]">
              <Badge tone={status?.status === 'online' ? 'positive' : 'negative'}>
                {status?.status === 'online' ? 'ONLINE' : 'OFFLINE'}
              </Badge>
              <span className="text-[var(--text-secondary)]">{status?.exchange ?? '—'}</span>
            </div>
          </div>

          <div className="px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Model Availability
            </div>
            <div className="mt-1 flex flex-wrap gap-1 font-mono text-[10px]">
              <Badge tone={status?.available_models?.ridge ? 'positive' : 'neutral'}>
                Ridge {status?.available_models?.ridge ? 'Ready' : 'Off'}
              </Badge>
              <Badge tone={status?.available_models?.gru ? 'positive' : 'neutral'}>
                GRU {status?.available_models?.gru ? 'Ready' : 'Unloaded'}
              </Badge>
              <Badge tone={status?.available_models?.lstm ? 'positive' : 'neutral'}>
                LSTM {status?.available_models?.lstm ? 'Ready' : 'Unloaded'}
              </Badge>
            </div>
          </div>

          <div className="px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              NLP & Datasets
            </div>
            <div className="mt-1 font-mono text-[11px] text-[var(--text-secondary)]">
              FinBERT: {status?.finbert_active ? (status.finbert_fallback ? 'Fallback' : 'Active') : 'Cached/Inactive'} ·{' '}
              Aligned: {status?.aligned_dataset_rows ?? 0} rows
            </div>
          </div>

          <div className="px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Last Pipeline Execution
            </div>
            <div className="mt-1 font-mono text-[11px] text-[var(--text-secondary)]">
              {status?.last_pipeline_run
                ? formatTimestamp(status.last_pipeline_run)
                : status?.latest_timestamp
                ? `Data through ${formatTimestamp(status.latest_timestamp)}`
                : 'Not recorded'}
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}
