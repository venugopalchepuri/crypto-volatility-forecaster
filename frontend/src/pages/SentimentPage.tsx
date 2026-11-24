import { useCallback, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { apiClient } from '../api/client';
import {
  SentimentClassStackedChart,
  SentimentTimelineChart,
} from '../components/charts/SentimentCharts';
import { Badge } from '../components/ui/Badge';
import { Panel, PanelHeader } from '../components/ui/Panel';
import { ErrorState, LoadingBlock } from '../components/ui/StateViews';
import { useSystem } from '../context/SystemContext';
import type { SentimentAnalyzeResponse, SentimentOverviewResponse } from '../types/api';
import { formatNumber, formatPct, formatTimestamp } from '../utils/format';

export function SentimentPage() {
  const { refreshTick } = useSystem();
  const [data, setData] = useState<SentimentOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sentimentFilter, setSentimentFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [page, setPage] = useState(0);
  const pageSize = 20;

  // Live FinBERT Scorer state
  const [headlineText, setHeadlineText] = useState('');
  const [scoring, setScoring] = useState(false);
  const [scoreError, setScoreError] = useState<string | null>(null);
  const [scoreResult, setScoreResult] = useState<SentimentAnalyzeResponse | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(0);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadSentiment = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.getSentimentOverview({
        limit: pageSize,
        offset: page * pageSize,
        sentiment: sentimentFilter,
        search: debouncedSearch,
      });
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sentiment analytics');
    } finally {
      setLoading(false);
    }
  }, [page, sentimentFilter, debouncedSearch]);

  useEffect(() => {
    loadSentiment();
  }, [loadSentiment, refreshTick]);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!headlineText.trim()) return;
    setScoring(true);
    setScoreError(null);
    try {
      const res = await apiClient.analyzeHeadline(headlineText.trim());
      setScoreResult(res);
    } catch (err) {
      setScoreError(err instanceof Error ? err.message : 'FinBERT scoring failed');
    } finally {
      setScoring(false);
    }
  };

  const summary = data?.hourly_summary;
  const dist = data?.headline_distribution;
  const totalPages = Math.max(1, Math.ceil((data?.filtered_headlines ?? 0) / pageSize));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 border-b border-[var(--border-subtle)] pb-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
            Sentiment Analysis — FinBERT NLP
          </h1>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
            Hourly aggregated financial sentiment, sentiment shock vs 24H rolling mean, and headline scoring.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="accent">ProsusAI/finbert</Badge>
          <Badge tone="neutral">{data?.data_sources?.[0] ?? 'offline corpus'}</Badge>
        </div>
      </div>

      {/* Scientific / Financial Disclaimer */}
      <div className="rounded-[3px] border border-[var(--border-default)] bg-[var(--bg-inset)] px-3.5 py-2 font-mono text-[11px] text-[var(--text-secondary)]">
        METHODOLOGY NOTE: FinBERT sentiment scores represent automated NLP probability outputs (
        <code>P(positive) - P(negative)</code>) on financial text, not investment or financial advice.
      </div>

      {error && <ErrorState message={error} onRetry={loadSentiment} />}

      {/* Summary Strip */}
      <div className="surface-panel grid grid-cols-2 divide-y divide-[var(--border-subtle)] sm:grid-cols-3 lg:grid-cols-6 lg:divide-x lg:divide-y-0">
        <div className="p-3.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Latest Hourly Score
          </div>
          <div
            className={`mt-1 font-mono text-lg font-semibold tabular-nums ${
              (summary?.latest_avg_sentiment ?? 0) > 0.15
                ? 'text-[var(--positive)]'
                : (summary?.latest_avg_sentiment ?? 0) < -0.15
                ? 'text-[var(--negative)]'
                : 'text-[var(--text-primary)]'
            }`}
          >
            {formatNumber(summary?.latest_avg_sentiment, 4, true)}
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-[var(--text-muted)]">
            Period mean: {formatNumber(summary?.mean_avg_sentiment, 4, true)}
          </div>
        </div>

        <div className="p-3.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Sentiment Shock
          </div>
          <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-[var(--warning)]">
            {formatNumber(summary?.latest_sentiment_shock, 4, true)}
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-[var(--text-muted)]">
            Deviation vs 24H mean
          </div>
        </div>

        <div className="p-3.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Positive Share
          </div>
          <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-[var(--positive)]">
            {formatPct((summary?.mean_pct_positive ?? 0) * 100, 1)}
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-[var(--text-muted)]">
            {dist?.bullish ?? 0} bullish headlines
          </div>
        </div>

        <div className="p-3.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Negative Share
          </div>
          <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-[var(--negative)]">
            {formatPct((summary?.mean_pct_negative ?? 0) * 100, 1)}
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-[var(--text-muted)]">
            {dist?.bearish ?? 0} bearish headlines
          </div>
        </div>

        <div className="p-3.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Neutral Share
          </div>
          <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-[var(--text-primary)]">
            {formatPct((summary?.mean_pct_neutral ?? 0) * 100, 1)}
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-[var(--text-muted)]">
            {dist?.neutral ?? 0} neutral headlines
          </div>
        </div>

        <div className="p-3.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Headline Volume
          </div>
          <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-[var(--text-primary)]">
            {data?.total_headlines ?? 0}
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-[var(--text-muted)]">
            Across {summary?.hours_covered ?? 0} hourly bins
          </div>
        </div>
      </div>

      {/* Charts + Live FinBERT Scorer */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Left: Sentiment Timeline + Class Mix (8 cols) */}
        <div className="space-y-4 lg:col-span-8">
          <Panel>
            <PanelHeader
              title="Hourly Sentiment & Shock Timeline"
              subtitle="Hourly mean sentiment score [-1, +1], 24-hour sentiment shock, and post volume"
            />
            <div className="p-4">
              {loading ? (
                <LoadingBlock rows={5} height="h-10" />
              ) : (
                <SentimentTimelineChart records={data?.hourly_series ?? []} />
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Hourly Sentiment Class Composition"
              subtitle="Proportion of positive, neutral, and negative headlines per hourly aggregation window"
            />
            <div className="p-4">
              {loading ? (
                <LoadingBlock rows={4} height="h-9" />
              ) : (
                <SentimentClassStackedChart records={data?.hourly_series ?? []} />
              )}
            </div>
          </Panel>
        </div>

        {/* Right: Live FinBERT Scorer (4 cols) */}
        <Panel className="lg:col-span-4 flex flex-col justify-between">
          <div>
            <PanelHeader
              title="Live FinBERT Scoring"
              subtitle="Evaluate custom crypto headline probabilities"
              right={<Badge tone="accent">POST /api/sentiment/analyze</Badge>}
            />
            <form onSubmit={handleAnalyze} className="space-y-3 p-4">
              <div>
                <label
                  htmlFor="finbert-input"
                  className="mb-1.5 block text-[11px] font-medium text-[var(--text-secondary)]"
                >
                  Headline or Market Post
                </label>
                <textarea
                  id="finbert-input"
                  rows={4}
                  value={headlineText}
                  onChange={(e) => setHeadlineText(e.target.value)}
                  placeholder="e.g., Bitcoin surges to new weekly high as institutional inflows accelerate"
                  className="w-full rounded-[3px] border border-[var(--border-default)] bg-[var(--bg-inset)] p-2.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                />
              </div>

              <div className="flex flex-wrap gap-1.5">
                {[
                  'Bitcoin surges to new weekly high as institutional inflows accelerate',
                  'Crypto derivatives liquidations surpass 300M in abrupt market flush',
                ].map((sample, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setHeadlineText(sample)}
                    className="rounded-[2px] border border-[var(--border-subtle)] bg-[var(--bg-inset)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    Sample {idx + 1}
                  </button>
                ))}
              </div>

              <button
                type="submit"
                disabled={scoring || !headlineText.trim()}
                className="w-full rounded-[3px] bg-[var(--accent)] px-3 py-2 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {scoring ? 'Evaluating...' : 'Evaluate Sentiment'}
              </button>

              {scoreError && (
                <div className="rounded-[3px] border border-[var(--negative)]/30 bg-[var(--negative-muted)] p-2.5 font-mono text-[11px] text-[var(--negative)]">
                  {scoreError}
                </div>
              )}

              <div className="surface-inset space-y-2.5 p-3 font-mono text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-secondary)]">Classification</span>
                  <span
                    className={`font-semibold ${
                      scoreResult
                        ? scoreResult.sentiment_score > 0.15
                          ? 'text-[var(--positive)]'
                          : scoreResult.sentiment_score < -0.15
                          ? 'text-[var(--negative)]'
                          : 'text-[var(--text-primary)]'
                        : 'text-[var(--text-muted)]'
                    }`}
                  >
                    {scoreResult?.label ?? 'Awaiting input'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-secondary)]">Composite Score</span>
                  <span className="font-semibold text-[var(--text-primary)]">
                    {scoreResult ? formatNumber(scoreResult.sentiment_score, 4, true) : '—'}
                  </span>
                </div>
                {scoreResult?.source_mode && (
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-[var(--text-muted)]">Inference Mode</span>
                    <span className="text-[var(--text-secondary)]">{scoreResult.source_mode}</span>
                  </div>
                )}

                <div className="space-y-1.5 border-t border-[var(--border-subtle)] pt-2">
                  <div className="flex justify-between text-[10px] text-[var(--text-secondary)]">
                    <span>
                      Pos:{' '}
                      <strong className="text-[var(--positive)]">
                        {scoreResult ? `${(scoreResult.probabilities.positive * 100).toFixed(1)}%` : '—'}
                      </strong>
                    </span>
                    <span>
                      Neu:{' '}
                      <strong className="text-[var(--text-primary)]">
                        {scoreResult ? `${(scoreResult.probabilities.neutral * 100).toFixed(1)}%` : '—'}
                      </strong>
                    </span>
                    <span>
                      Neg:{' '}
                      <strong className="text-[var(--negative)]">
                        {scoreResult ? `${(scoreResult.probabilities.negative * 100).toFixed(1)}%` : '—'}
                      </strong>
                    </span>
                  </div>
                  <div className="flex h-2 w-full overflow-hidden rounded-[2px] bg-[var(--bg-panel)]">
                    <div
                      className="bg-[var(--positive)] transition-all"
                      style={{
                        width: `${(scoreResult?.probabilities.positive ?? 0.33) * 100}%`,
                      }}
                    />
                    <div
                      className="bg-[var(--text-muted)] transition-all"
                      style={{
                        width: `${(scoreResult?.probabilities.neutral ?? 0.34) * 100}%`,
                      }}
                    />
                    <div
                      className="bg-[var(--negative)] transition-all"
                      style={{
                        width: `${(scoreResult?.probabilities.negative ?? 0.33) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </form>
          </div>
        </Panel>
      </div>

      {/* News Headline Table */}
      <Panel>
        <PanelHeader
          title="Scored Financial Headlines"
          subtitle={`Showing ${data?.headlines.length ?? 0} of ${data?.filtered_headlines ?? 0} matching records`}
          right={
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter headlines..."
                  className="rounded-[3px] border border-[var(--border-default)] bg-[var(--bg-inset)] py-1 pl-7 pr-2.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                />
              </div>
              <div className="inline-flex rounded-[3px] border border-[var(--border-default)] bg-[var(--bg-inset)] p-0.5 font-mono text-[10px]">
                {['all', 'bullish', 'neutral', 'bearish'].map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      setSentimentFilter(opt);
                      setPage(0);
                    }}
                    className={`rounded-[2px] px-2 py-0.5 capitalize ${
                      sentimentFilter === opt
                        ? 'bg-[var(--accent)] text-white'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          }
        />

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead className="border-b border-[var(--border-default)] bg-[var(--bg-inset)] font-mono text-[10px] uppercase text-[var(--text-secondary)]">
              <tr>
                <th className="px-3 py-2">Timestamp</th>
                <th className="px-3 py-2">Headline</th>
                <th className="px-3 py-2">Class</th>
                <th className="px-3 py-2 text-right">Score</th>
                <th className="px-3 py-2 text-right">P(+)</th>
                <th className="px-3 py-2 text-right">P(0)</th>
                <th className="px-3 py-2 text-right">P(-)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center font-mono text-xs text-[var(--text-muted)]">
                    Loading headlines...
                  </td>
                </tr>
              ) : (data?.headlines ?? []).length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center font-mono text-xs text-[var(--text-muted)]">
                    No headlines match the active filters.
                  </td>
                </tr>
              ) : (
                (data?.headlines ?? []).map((h, i) => {
                  const tone =
                    h.label === 'Bullish'
                      ? 'positive'
                      : h.label === 'Bearish'
                      ? 'negative'
                      : 'neutral';
                  return (
                    <tr key={`${h.timestamp}-${i}`} className="hover:bg-[var(--bg-hover)]">
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-[var(--text-secondary)]">
                        {formatTimestamp(h.timestamp)}
                      </td>
                      <td className="max-w-xl px-3 py-2 text-[var(--text-primary)]">{h.text}</td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <Badge tone={tone}>{h.label}</Badge>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right font-mono tabular-nums font-medium">
                        {formatNumber(h.sentiment_score, 4, true)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right font-mono tabular-nums text-[var(--positive)]">
                        {h.positive !== null ? `${(h.positive * 100).toFixed(1)}%` : '—'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right font-mono tabular-nums text-[var(--text-secondary)]">
                        {h.neutral !== null ? `${(h.neutral * 100).toFixed(1)}%` : '—'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right font-mono tabular-nums text-[var(--negative)]">
                        {h.negative !== null ? `${(h.negative * 100).toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-[var(--border-subtle)] px-4 py-2.5 font-mono text-[11px] text-[var(--text-secondary)]">
          <span>
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="rounded-[2px] border border-[var(--border-default)] bg-[var(--bg-inset)] px-2.5 py-1 hover:bg-[var(--bg-hover)] disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-[2px] border border-[var(--border-default)] bg-[var(--bg-inset)] px-2.5 py-1 hover:bg-[var(--bg-hover)] disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
