import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { apiClient } from '../api/client';
import {
  BenchmarkDirectionChart,
  BenchmarkLossChart,
  FeatureImportanceChart,
} from '../components/charts/ModelCharts';
import { Badge } from '../components/ui/Badge';
import { DataTable, type TableColumn } from '../components/ui/DataTable';
import { Panel, PanelHeader } from '../components/ui/Panel';
import { ErrorState, LoadingBlock } from '../components/ui/StateViews';
import { TooltipInfo } from '../components/ui/TooltipInfo';
import { useSystem } from '../context/SystemContext';
import type {
  AblationResponse,
  BenchmarkRecord,
  BenchmarkResponse,
  ModelsDetailsResponse,
} from '../types/api';

export function ModelsPage() {
  const { refreshTick } = useSystem();
  const [benchmarks, setBenchmarks] = useState<BenchmarkResponse | null>(null);
  const [ablation, setAblation] = useState<AblationResponse | null>(null);
  const [details, setDetails] = useState<ModelsDetailsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedArch, setExpandedArch] = useState<string | null>('Ridge Regressor');

  const loadModels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [bm, ab, dt] = await Promise.all([
        apiClient.getBenchmarks(),
        apiClient.getAblation(),
        apiClient.getModelsDetails(),
      ]);
      setBenchmarks(bm);
      setAblation(ab);
      setDetails(dt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load model evaluation metrics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadModels();
  }, [loadModels, refreshTick]);

  const benchRows = benchmarks?.records ?? [];

  const bestRmse = useMemo(
    () => (benchRows.length ? Math.min(...benchRows.map((r) => r.rmse)) : null),
    [benchRows],
  );
  const bestQlike = useMemo(
    () => (benchRows.length ? Math.min(...benchRows.map((r) => r.qlike_loss)) : null),
    [benchRows],
  );
  const bestDirAcc = useMemo(
    () => (benchRows.length ? Math.max(...benchRows.map((r) => r.directional_accuracy_pct)) : null),
    [benchRows],
  );

  const columns: TableColumn<BenchmarkRecord>[] = useMemo(
    () => [
      {
        key: 'model',
        header: 'Model Architecture',
        sortable: true,
        sortValue: (r) => r.model,
        render: (r) => (
          <span className="font-sans font-semibold text-[var(--text-primary)]">{r.model}</span>
        ),
      },
      {
        key: 'rmse',
        header: 'RMSE ↓',
        align: 'right',
        sortable: true,
        sortValue: (r) => r.rmse,
        render: (r) => (
          <span className={r.rmse === bestRmse ? 'font-semibold text-[var(--accent)]' : ''}>
            {r.rmse.toFixed(6)}
          </span>
        ),
      },
      {
        key: 'mae',
        header: 'MAE ↓',
        align: 'right',
        sortable: true,
        sortValue: (r) => r.mae,
        render: (r) => r.mae.toFixed(6),
      },
      {
        key: 'mape_pct',
        header: 'MAPE (%)',
        align: 'right',
        sortable: true,
        sortValue: (r) => r.mape_pct,
        render: (r) => `${r.mape_pct.toFixed(2)}%`,
      },
      {
        key: 'qlike_loss',
        header: 'QLIKE ↓',
        align: 'right',
        sortable: true,
        sortValue: (r) => r.qlike_loss,
        render: (r) => (
          <span className={r.qlike_loss === bestQlike ? 'font-semibold text-[var(--accent)]' : ''}>
            {r.qlike_loss.toFixed(6)}
          </span>
        ),
      },
      {
        key: 'pearson_corr',
        header: 'Pearson Corr ↑',
        align: 'right',
        sortable: true,
        sortValue: (r) => r.pearson_corr,
        render: (r) => (
          <span className={r.pearson_corr >= 0 ? 'text-[var(--positive)]' : 'text-[var(--negative)]'}>
            {r.pearson_corr >= 0 ? '+' : ''}
            {r.pearson_corr.toFixed(4)}
          </span>
        ),
      },
      {
        key: 'directional_accuracy_pct',
        header: 'Dir. Accuracy (%) ↑',
        align: 'right',
        sortable: true,
        sortValue: (r) => r.directional_accuracy_pct,
        render: (r) => (
          <span
            className={
              r.directional_accuracy_pct === bestDirAcc
                ? 'font-semibold text-[var(--positive)]'
                : ''
            }
          >
            {r.directional_accuracy_pct.toFixed(2)}%
          </span>
        ),
      },
    ],
    [bestRmse, bestQlike, bestDirAcc],
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 border-b border-[var(--border-subtle)] pb-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
            Model Performance & Evaluation
          </h1>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
            Strict chronological out-of-sample benchmarking, multimodal ablation, and permutation feature ranking.
          </p>
        </div>
        <Badge tone="accent">{benchmarks?.split_info ?? 'Held-Out 15% Test Split'}</Badge>
      </div>

      {error && <ErrorState message={error} onRetry={loadModels} />}

      {/* Model Leaderboard */}
      <Panel>
        <PanelHeader
          title="Model Leaderboard (Held-Out 15% Test Split)"
          subtitle="Evaluation across 70% Train / 15% Validation / 15% Test chronological partitioning; different metrics capture error magnitude vs directional expansion/contraction."
          right={
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
              <span>About QLIKE</span>
              <TooltipInfo text="Quasi-Likelihood (Patton, 2011): (y/ŷ) - ln(y/ŷ) - 1. Asymmetric volatility loss that penalizes under-forecasting spikes more heavily than over-forecasting." />
            </div>
          }
        />
        {loading ? (
          <LoadingBlock rows={5} />
        ) : (
          <DataTable
            columns={columns}
            rows={benchRows}
            rowKey={(r) => r.model}
            initialSortKey="rmse"
            initialSortDir="asc"
          />
        )}
      </Panel>

      {/* Visual Comparisons */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Error & QLIKE Loss Comparison"
            subtitle="Lower values indicate tighter point-forecast fit on the 15% held-out test set"
          />
          <div className="p-4">
            {loading ? <LoadingBlock rows={4} height="h-10" /> : <BenchmarkLossChart records={benchRows} />}
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Directional Accuracy (Expansion vs Compression)"
            subtitle="Percentage of correct volatility direction calls relative to 24H rolling baseline (50% random reference)"
          />
          <div className="p-4">
            {loading ? <LoadingBlock rows={4} height="h-10" /> : <BenchmarkDirectionChart records={benchRows} />}
          </div>
        </Panel>
      </div>

      {/* Ablation Study + Feature Importance */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Panel className="lg:col-span-6">
          <PanelHeader
            title="Multimodal Feature Ablation"
            subtitle={ablation?.split_info ?? 'Chronological 80/20 Split (Ridge Regressor)'}
            right={<Badge tone="neutral">Separate 80/20 Split</Badge>}
          />
          <div className="p-4 space-y-3">
            <div className="overflow-x-auto border border-[var(--border-subtle)] rounded-[3px]">
              <table className="w-full text-left font-mono text-[11px]">
                <thead className="border-b border-[var(--border-default)] bg-[var(--bg-inset)] text-[10px] uppercase text-[var(--text-secondary)]">
                  <tr>
                    <th className="px-3 py-2">Feature Subset</th>
                    <th className="px-3 py-2 text-right">Features</th>
                    <th className="px-3 py-2 text-right">RMSE ↓</th>
                    <th className="px-3 py-2 text-right">MAE ↓</th>
                    <th className="px-3 py-2 text-right">QLIKE ↓</th>
                    <th className="px-3 py-2 text-right">Dir Acc ↑</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {(ablation?.ablation ?? []).map((row) => (
                    <tr key={row.configuration} className="hover:bg-[var(--bg-hover)]">
                      <td className="px-3 py-2 font-sans font-medium text-[var(--text-primary)]">
                        {row.configuration}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-[var(--text-secondary)]">
                        {row.feature_count}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.rmse.toFixed(6)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.mae.toFixed(6)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.qlike_loss.toFixed(6)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {row.directional_accuracy_pct.toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
              Note: This ablation study evaluates Ridge Regressor on an 80/20 chronological split, which is
              separate from the 70/15/15 sequence split reported in the main leaderboard above.
            </p>
          </div>
        </Panel>

        <Panel className="lg:col-span-6">
          <PanelHeader
            title="Permutation Feature Importance"
            subtitle="RMSE increase when permuting each feature on the 20% held-out Ridge test slice (5 repeats)"
          />
          <div className="p-4">
            {loading ? (
              <LoadingBlock rows={5} height="h-8" />
            ) : (
              <FeatureImportanceChart records={ablation?.feature_importance ?? []} />
            )}
          </div>
        </Panel>
      </div>

      {/* Expandable Model Details + Hyperparameters */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Panel className="lg:col-span-7">
          <PanelHeader
            title="Model Architectures & Training Configuration"
            subtitle="Inspect layer specifications, loss objectives, and disk checkpoint availability"
          />
          <div className="divide-y divide-[var(--border-subtle)]">
            {(details?.architectures ?? []).map((arch) => {
              const isOpen = expandedArch === arch.name;
              const ckpt = arch.checkpoint_key ? details?.checkpoints?.[arch.checkpoint_key] : null;
              return (
                <div key={arch.name}>
                  <button
                    type="button"
                    onClick={() => setExpandedArch(isOpen ? null : arch.name)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-[var(--bg-hover)]"
                  >
                    <div className="flex items-center gap-2.5">
                      {isOpen ? (
                        <ChevronDown className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                      )}
                      <div>
                        <div className="text-xs font-semibold text-[var(--text-primary)]">{arch.name}</div>
                        <div className="font-mono text-[10px] text-[var(--text-secondary)]">{arch.family}</div>
                      </div>
                    </div>
                    {ckpt ? (
                      <Badge tone={ckpt.exists ? 'positive' : 'neutral'}>
                        {ckpt.exists ? 'Checkpoint Present' : 'No Checkpoint'}
                      </Badge>
                    ) : (
                      <Badge tone="neutral">Non-Parametric</Badge>
                    )}
                  </button>
                  {isOpen && (
                    <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-inset)] px-4 py-3 font-mono text-[11px] space-y-2">
                      <div>
                        <span className="text-[var(--text-muted)]">Input Representation: </span>
                        <span className="text-[var(--text-primary)]">{arch.input_representation}</span>
                      </div>
                      <div>
                        <span className="text-[var(--text-muted)]">Configuration: </span>
                        <span className="text-[var(--text-primary)]">{arch.configuration}</span>
                      </div>
                      <div>
                        <span className="text-[var(--text-muted)]">Loss Objective: </span>
                        <span className="text-[var(--text-primary)]">{arch.loss_function}</span>
                      </div>
                      <div>
                        <span className="text-[var(--text-muted)]">Evaluation Split: </span>
                        <span className="text-[var(--text-primary)]">{arch.evaluation_split}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel className="lg:col-span-5">
          <PanelHeader
            title="Validation & Hyperparameter Tuning"
            subtitle="Best recorded configuration from models/saved/best_hyperparams.json"
          />
          <div className="space-y-3 p-4">
            {details?.best_hyperparams ? (
              <div className="surface-inset p-3 font-mono text-[11px]">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Best Validation Trial
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {Object.entries(details.best_hyperparams).map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <dt className="text-[var(--text-secondary)]">{k}</dt>
                      <dd className="font-semibold text-[var(--text-primary)]">{String(v)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : (
              <div className="text-xs text-[var(--text-muted)]">No tuning artifact found.</div>
            )}

            <div className="space-y-1.5 text-[11px] text-[var(--text-secondary)]">
              <div className="font-semibold text-[var(--text-primary)]">Evaluation Protocol</div>
              <p>
                QLIKE Loss: <code className="font-mono text-[var(--text-primary)]">{details?.split_protocol.qlike_formula}</code>
              </p>
              <p>
                Benchmark Split: <span className="font-mono">{details?.split_protocol.benchmark_split}</span>
              </p>
              <p>
                Target Formula: <span className="font-mono">{details?.split_protocol.target_definition}</span>
              </p>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
