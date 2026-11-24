import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '../api/client';
import {
  MarketIndicatorChart,
  PriceAndVolumeChart,
  type MarketIndicatorTab,
  type PriceOverlaysState,
} from '../components/charts/MarketCharts';
import { Badge } from '../components/ui/Badge';
import { DataTable, type TableColumn } from '../components/ui/DataTable';
import { Panel, PanelHeader } from '../components/ui/Panel';
import { ErrorState, LoadingBlock } from '../components/ui/StateViews';
import { useSystem } from '../context/SystemContext';
import type { MarketLatestResponse, MarketRecord } from '../types/api';
import {
  formatCompactNumber,
  formatNumber,
  formatPct,
  formatShortTimestamp,
  formatTimestamp,
  formatUSD,
  formatVolPct,
} from '../utils/format';

export function MarketPage() {
  const { refreshTick } = useSystem();
  const [data, setData] = useState<MarketLatestResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [limitHours, setLimitHours] = useState<number>(76);
  const [indicatorTab, setIndicatorTab] = useState<MarketIndicatorTab>('volatility');
  const [overlays, setOverlays] = useState<PriceOverlaysState>({
    bollinger: true,
    sma7: false,
    sma24: true,
    ema7: false,
    ema24: false,
  });

  const loadMarket = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.getMarketLatest(500);
      setData(res);
      setLimitHours(res.records.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load market data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMarket();
  }, [loadMarket, refreshTick]);

  const visibleRecords = useMemo(() => {
    const all = data?.records ?? [];
    return all.slice(-limitHours);
  }, [data, limitHours]);

  const summary = data?.summary;
  const totalAvailable = data?.total_available ?? 0;

  const toggleOverlay = (key: keyof PriceOverlaysState) => {
    setOverlays((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const columns: TableColumn<MarketRecord>[] = useMemo(
    () => [
      {
        key: 'timestamp',
        header: 'Timestamp',
        sortable: true,
        sortValue: (r) => r.timestamp,
        render: (r) => (
          <span className="font-mono text-[11px] text-[var(--text-secondary)]">
            {formatShortTimestamp(r.timestamp)}
          </span>
        ),
      },
      {
        key: 'open',
        header: 'Open',
        align: 'right',
        sortable: true,
        sortValue: (r) => r.open,
        render: (r) => formatUSD(r.open),
      },
      {
        key: 'high',
        header: 'High',
        align: 'right',
        sortable: true,
        sortValue: (r) => r.high,
        render: (r) => formatUSD(r.high),
      },
      {
        key: 'low',
        header: 'Low',
        align: 'right',
        sortable: true,
        sortValue: (r) => r.low,
        render: (r) => formatUSD(r.low),
      },
      {
        key: 'close',
        header: 'Close',
        align: 'right',
        sortable: true,
        sortValue: (r) => r.close,
        render: (r) => <span className="font-semibold text-[var(--text-primary)]">{formatUSD(r.close)}</span>,
      },
      {
        key: 'volume',
        header: 'Volume',
        align: 'right',
        sortable: true,
        sortValue: (r) => r.volume,
        render: (r) => formatCompactNumber(r.volume),
      },
      {
        key: 'log_return',
        header: '1H Return',
        align: 'right',
        sortable: true,
        sortValue: (r) => r.log_return ?? 0,
        render: (r) => {
          const val = (r.log_return ?? 0) * 100;
          return (
            <span className={val >= 0 ? 'text-[var(--positive)]' : 'text-[var(--negative)]'}>
              {formatPct(val, 2, true)}
            </span>
          );
        },
      },
      {
        key: 'volatility_24h',
        header: 'Vol 24H',
        align: 'right',
        sortable: true,
        sortValue: (r) => r.volatility_24h ?? 0,
        render: (r) => formatVolPct(r.volatility_24h),
      },
      {
        key: 'rsi_14',
        header: 'RSI (14)',
        align: 'right',
        sortable: true,
        sortValue: (r) => r.rsi_14 ?? 50,
        render: (r) => formatNumber(r.rsi_14, 1),
      },
      {
        key: 'macd_hist',
        header: 'MACD Hist',
        align: 'right',
        sortable: true,
        sortValue: (r) => r.macd_hist ?? 0,
        render: (r) => formatNumber(r.macd_hist, 2, true),
      },
      {
        key: 'bb_pct_b',
        header: 'BB %B',
        align: 'right',
        sortable: true,
        sortValue: (r) => r.bb_pct_b ?? 0,
        render: (r) => formatNumber(r.bb_pct_b, 3),
      },
    ],
    [],
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 border-b border-[var(--border-subtle)] pb-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
            Market Analysis — BTC/USDT (1H)
          </h1>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
            Historical OHLCV candles, rolling volatility, momentum, and technical oscillator diagnostics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">{summary?.data_sources?.[0] ?? 'unknown'}</Badge>
          <div className="inline-flex rounded-[3px] border border-[var(--border-default)] bg-[var(--bg-panel)] p-0.5 font-mono text-[11px]">
            {[
              { label: '24H', val: 24 },
              { label: '48H', val: 48 },
              { label: `All (${totalAvailable}H)`, val: totalAvailable || 76 },
            ]
              .filter((r) => r.val <= Math.max(totalAvailable, 24))
              .map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => setLimitHours(opt.val)}
                  className={`rounded-[2px] px-2 py-0.5 ${
                    limitHours === opt.val
                      ? 'bg-[var(--accent)] text-white'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
          </div>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={loadMarket} />}

      {/* Summary Strip */}
      <div className="surface-panel grid grid-cols-2 divide-y divide-[var(--border-subtle)] sm:grid-cols-4 lg:grid-cols-7 lg:divide-x lg:divide-y-0">
        <div className="p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Last Close
          </div>
          <div className="mt-1 font-mono text-sm font-semibold tabular-nums">
            {formatUSD(summary?.latest_close)}
          </div>
        </div>
        <div className="p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            24H Change
          </div>
          <div
            className={`mt-1 font-mono text-sm font-semibold tabular-nums ${
              (summary?.change_24h_pct ?? 0) >= 0 ? 'text-[var(--positive)]' : 'text-[var(--negative)]'
            }`}
          >
            {formatPct(summary?.change_24h_pct, 2, true)}
          </div>
        </div>
        <div className="p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            24H High / Low
          </div>
          <div className="mt-1 font-mono text-xs font-medium tabular-nums">
            {formatUSD(summary?.high_24h, 0)} / {formatUSD(summary?.low_24h, 0)}
          </div>
        </div>
        <div className="p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            24H Volume
          </div>
          <div className="mt-1 font-mono text-sm font-semibold tabular-nums">
            {formatCompactNumber(summary?.volume_24h)} BTC
          </div>
        </div>
        <div className="p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Realized Vol (24H)
          </div>
          <div className="mt-1 font-mono text-sm font-semibold tabular-nums text-[var(--warning)]">
            {formatVolPct(summary?.volatility_24h)}
          </div>
        </div>
        <div className="p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            RSI (14)
          </div>
          <div className="mt-1 font-mono text-sm font-semibold tabular-nums">
            {formatNumber(summary?.rsi_14, 2)}
          </div>
        </div>
        <div className="p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            MACD Hist
          </div>
          <div
            className={`mt-1 font-mono text-sm font-semibold tabular-nums ${
              (summary?.macd_hist ?? 0) >= 0 ? 'text-[var(--positive)]' : 'text-[var(--negative)]'
            }`}
          >
            {formatNumber(summary?.macd_hist, 2, true)}
          </div>
        </div>
      </div>

      {/* Price + Overlays + Volume */}
      <Panel>
        <PanelHeader
          title="BTC/USDT Price & Technical Overlays"
          subtitle={
            summary
              ? `${formatTimestamp(visibleRecords[0]?.timestamp)} → ${formatTimestamp(
                  visibleRecords[visibleRecords.length - 1]?.timestamp,
                )}`
              : 'Hourly candle close and moving averages'
          }
          right={
            <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
              {(
                [
                  ['bollinger', 'BB (20,2σ)'],
                  ['sma7', 'SMA 7'],
                  ['sma24', 'SMA 24'],
                  ['ema7', 'EMA 7'],
                  ['ema24', 'EMA 24'],
                ] as [keyof PriceOverlaysState, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleOverlay(key)}
                  className={`rounded-[2px] border px-2 py-0.5 transition-colors ${
                    overlays[key]
                      ? 'border-[var(--accent)]/60 bg-[var(--accent-muted)] text-[var(--accent)]'
                      : 'border-[var(--border-default)] bg-[var(--bg-inset)] text-[var(--text-secondary)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          }
        />
        <div className="p-4">
          {loading ? <LoadingBlock rows={6} height="h-10" /> : <PriceAndVolumeChart records={visibleRecords} overlays={overlays} />}
        </div>
      </Panel>

      {/* Oscillators & Volatility Sub-Panel */}
      <Panel>
        <PanelHeader
          title="Quantitative Indicators & Oscillators"
          subtitle="Switch analytical indicator view without cluttering the primary price canvas"
          right={
            <div className="inline-flex flex-wrap rounded-[3px] border border-[var(--border-default)] bg-[var(--bg-inset)] p-0.5 font-mono text-[10px]">
              {(
                [
                  ['volatility', 'Vol & Returns'],
                  ['rsi', 'RSI (14)'],
                  ['macd', 'MACD (12,26,9)'],
                  ['momentum', 'Momentum (4H/10H)'],
                ] as [MarketIndicatorTab, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setIndicatorTab(key)}
                  className={`rounded-[2px] px-2.5 py-0.5 ${
                    indicatorTab === key
                      ? 'bg-[var(--accent)] text-white'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          }
        />
        <div className="p-4">
          {loading ? <LoadingBlock rows={4} height="h-10" /> : <MarketIndicatorChart records={visibleRecords} tab={indicatorTab} />}
        </div>
      </Panel>

      {/* Historical Market Data Table */}
      <Panel>
        <PanelHeader
          title="Historical Market Data & Indicators"
          subtitle={`Showing ${visibleRecords.length} hourly observations (sortable by column)`}
        />
        {loading ? (
          <LoadingBlock rows={6} />
        ) : (
          <DataTable
            columns={columns}
            rows={visibleRecords}
            rowKey={(r) => r.timestamp}
            initialSortKey="timestamp"
            initialSortDir="desc"
            compact
          />
        )}
      </Panel>
    </div>
  );
}
