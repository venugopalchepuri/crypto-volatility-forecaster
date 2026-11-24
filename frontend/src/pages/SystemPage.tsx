import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, FileText } from 'lucide-react';
import { apiClient } from '../api/client';
import { Badge } from '../components/ui/Badge';
import { Panel, PanelHeader } from '../components/ui/Panel';
import { ErrorState, LoadingBlock } from '../components/ui/StateViews';
import { useSystem } from '../context/SystemContext';
import type { ReportResponse, SystemHealthResponse } from '../types/api';
import { formatBytes, formatTimestamp } from '../utils/format';

export function SystemPage() {
  const { refreshTick } = useSystem();
  const [health, setHealth] = useState<SystemHealthResponse | null>(null);
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);

  const loadSystem = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [h, r] = await Promise.all([apiClient.getSystemHealth(), apiClient.getReport()]);
      setHealth(h);
      setReport(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load system diagnostics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSystem();
  }, [loadSystem, refreshTick]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 border-b border-[var(--border-subtle)] pb-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
            System Diagnostics & Architecture
          </h1>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
            Genuine backend service health, model artifact status, pipeline configuration, and API endpoints.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/docs"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-[3px] bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
          >
            <span>Swagger API Docs (/docs)</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <a
            href="/redoc"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-[3px] border border-[var(--border-default)] bg-[var(--bg-panel)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
          >
            <span>ReDoc</span>
            <ExternalLink className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
          </a>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={loadSystem} />}

      {loading ? (
        <LoadingBlock rows={6} />
      ) : (
        <>
          {/* Runtime & Config Strip */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Panel>
              <PanelHeader title="API & Runtime Environment" />
              <div className="p-4">
                <dl className="space-y-2 font-mono text-[11px]">
                  <div className="flex justify-between">
                    <dt className="text-[var(--text-secondary)]">API Status</dt>
                    <dd>
                      <Badge tone={health?.api_status === 'online' ? 'positive' : 'negative'}>
                        {health?.api_status?.toUpperCase() ?? 'UNKNOWN'}
                      </Badge>
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[var(--text-secondary)]">Python Version</dt>
                    <dd className="text-[var(--text-primary)]">{health?.python_version ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="shrink-0 text-[var(--text-secondary)]">Platform</dt>
                    <dd className="truncate text-right text-[var(--text-primary)]">{health?.platform ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[var(--text-secondary)]">Last Pipeline Run</dt>
                    <dd className="text-[var(--text-primary)]">
                      {health?.runtime.last_pipeline_run
                        ? formatTimestamp(health.runtime.last_pipeline_run)
                        : 'Not run this session'}
                    </dd>
                  </div>
                </dl>
              </div>
            </Panel>

            <Panel>
              <PanelHeader title="Pipeline Configuration" />
              <div className="p-4">
                <dl className="space-y-2 font-mono text-[11px]">
                  <div className="flex justify-between">
                    <dt className="text-[var(--text-secondary)]">Default Symbol</dt>
                    <dd className="text-[var(--text-primary)]">{health?.config.default_symbol}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[var(--text-secondary)]">Candle Timeframe</dt>
                    <dd className="text-[var(--text-primary)]">{health?.config.default_timeframe}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[var(--text-secondary)]">Default Fetch Limit</dt>
                    <dd className="text-[var(--text-primary)]">{health?.config.default_limit} candles</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[var(--text-secondary)]">Volatility Horizon</dt>
                    <dd className="text-[var(--text-primary)]">{health?.config.volatility_horizon_hours} hours</dd>
                  </div>
                </dl>
              </div>
            </Panel>

            <Panel>
              <PanelHeader title="Installed Backend Packages" />
              <div className="flex flex-wrap gap-1.5 p-4">
                {Object.entries(health?.packages ?? {}).map(([pkg, installed]) => (
                  <Badge key={pkg} tone={installed ? 'positive' : 'neutral'}>
                    {pkg}: {installed ? 'installed' : 'missing'}
                  </Badge>
                ))}
              </div>
            </Panel>
          </div>

          {/* Model Artifacts & Dataset Inventory */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel>
              <PanelHeader
                title="Model Artifacts (models/saved/)"
                subtitle="On-disk checkpoints and scaler metadata"
              />
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-[11px]">
                  <thead className="border-b border-[var(--border-default)] bg-[var(--bg-inset)] text-[10px] uppercase text-[var(--text-secondary)]">
                    <tr>
                      <th className="px-3 py-2">Artifact</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2 text-right">Size</th>
                      <th className="px-3 py-2 text-right">Modified</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {(health?.model_artifacts ?? []).map((art) => (
                      <tr key={art.name} className="hover:bg-[var(--bg-hover)]">
                        <td className="px-3 py-2 font-medium text-[var(--text-primary)]">{art.name}</td>
                        <td className="px-3 py-2">
                          <Badge tone={art.exists ? 'positive' : 'neutral'}>
                            {art.exists ? 'Present' : 'Not Generated'}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-[var(--text-secondary)]">
                          {art.exists ? formatBytes(art.size_bytes) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right text-[var(--text-muted)]">
                          {art.modified_at ? formatTimestamp(art.modified_at) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel>
              <PanelHeader
                title="Dataset Availability"
                subtitle="Raw and processed CSV artifacts verified on disk"
              />
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-[11px]">
                  <thead className="border-b border-[var(--border-default)] bg-[var(--bg-inset)] text-[10px] uppercase text-[var(--text-secondary)]">
                    <tr>
                      <th className="px-3 py-2">Dataset</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2 text-right">Rows</th>
                      <th className="px-3 py-2 text-right">Size</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {(health?.datasets ?? []).map((ds) => (
                      <tr key={ds.id} className="hover:bg-[var(--bg-hover)]">
                        <td className="px-3 py-2 font-sans font-medium text-[var(--text-primary)]">{ds.name}</td>
                        <td className="px-3 py-2">
                          <Badge tone={ds.exists ? 'positive' : 'negative'}>
                            {ds.exists ? 'Available' : 'Missing'}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-[var(--text-primary)]">
                          {ds.row_count}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-[var(--text-secondary)]">
                          {formatBytes(ds.size_bytes)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>

          {/* REST API Endpoint Directory */}
          <Panel>
            <PanelHeader
              title="REST API Surface"
              subtitle="Active FastAPI endpoints powering the workstation"
            />
            <div className="grid grid-cols-1 divide-y divide-[var(--border-subtle)] md:grid-cols-2 md:divide-x md:divide-y-0">
              {(health?.endpoints ?? []).map((ep) => (
                <div key={ep.path} className="flex items-center justify-between gap-3 px-4 py-2 font-mono text-[11px]">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge tone={ep.method === 'POST' ? 'warning' : 'accent'}>{ep.method}</Badge>
                    <span className="truncate font-semibold text-[var(--text-primary)]">{ep.path}</span>
                  </div>
                  <span className="truncate font-sans text-[11px] text-[var(--text-secondary)]">
                    {ep.summary}
                  </span>
                </div>
              ))}
            </div>
          </Panel>

          {/* Academic Capstone Report & Figures */}
          <Panel>
            <PanelHeader
              title="Research Deliverables & Publication Figures"
              subtitle="Compiled FINAL_PROJECT_REPORT.md and matplotlib plates generated by src/utils/report_generator.py"
              right={
                <button
                  type="button"
                  onClick={() => setShowReport((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-[3px] border border-[var(--border-default)] bg-[var(--bg-inset)] px-2.5 py-1 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                >
                  <FileText className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                  <span>{showReport ? 'Hide Capstone Report' : 'View Capstone Report'}</span>
                </button>
              }
            />
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {(report?.available_charts ?? []).map((chart) => (
                  <div key={chart} className="surface-inset p-2.5 space-y-2">
                    <div className="flex items-center justify-between font-mono text-[11px]">
                      <span className="font-medium text-[var(--text-primary)]">{chart}</span>
                      <a
                        href={`/api/report/charts/${chart}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-[var(--accent)] hover:underline"
                      >
                        Full Res ↗
                      </a>
                    </div>
                    <img
                      src={`/api/report/charts/${chart}`}
                      alt={chart}
                      className="h-36 w-full rounded-[2px] border border-[var(--border-subtle)] object-cover"
                    />
                  </div>
                ))}
              </div>

              {showReport && (
                <div className="max-h-96 overflow-y-auto rounded-[3px] border border-[var(--border-default)] bg-[var(--bg-inset)] p-4">
                  <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-[var(--text-primary)]">
                    {report?.content_markdown || 'Report content unavailable.'}
                  </pre>
                </div>
              )}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
