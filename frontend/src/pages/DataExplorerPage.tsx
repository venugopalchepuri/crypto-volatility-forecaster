import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { apiClient } from '../api/client';
import { Badge } from '../components/ui/Badge';
import { Panel, PanelHeader } from '../components/ui/Panel';
import { ErrorState, LoadingBlock } from '../components/ui/StateViews';
import { useSystem } from '../context/SystemContext';
import type { DatasetInventoryItem, DatasetPreviewResponse } from '../types/api';
import { formatBytes, formatTimestamp } from '../utils/format';

export function DataExplorerPage() {
  const { refreshTick } = useSystem();
  const [datasets, setDatasets] = useState<DatasetInventoryItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>('aligned_features');
  const [preview, setPreview] = useState<DatasetPreviewResponse | null>(null);

  const [invLoading, setInvLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showSchema, setShowSchema] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  const loadInventory = useCallback(async () => {
    setInvLoading(true);
    setError(null);
    try {
      const res = await apiClient.getDatasets();
      setDatasets(res.datasets);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dataset inventory');
    } finally {
      setInvLoading(false);
    }
  }, []);

  const loadPreview = useCallback(async () => {
    setPreviewLoading(true);
    setError(null);
    try {
      const res = await apiClient.getDatasetPreview({
        dataset: selectedId,
        page,
        pageSize,
        search: debouncedSearch,
        sortBy,
        sortDir,
      });
      setPreview(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dataset preview');
    } finally {
      setPreviewLoading(false);
    }
  }, [selectedId, page, pageSize, debouncedSearch, sortBy, sortDir]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory, refreshTick]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview, refreshTick]);

  const activeMeta = useMemo(
    () => datasets.find((d) => d.id === selectedId) ?? null,
    [datasets, selectedId],
  );

  const handleDatasetChange = (id: string) => {
    setSelectedId(id);
    setPage(1);
    setSortBy('');
    setSearch('');
    setDebouncedSearch('');
  };

  const toggleSort = (col: string) => {
    if (sortBy === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
    setPage(1);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 border-b border-[var(--border-subtle)] pb-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
            Data Explorer & Quality Inspector
          </h1>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
            Inspect raw and processed CSV datasets, column schemas, missingness counts, and export paginated slices.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={apiClient.getDatasetExportUrl(selectedId)}
            download
            className="inline-flex items-center gap-1.5 rounded-[3px] border border-[var(--border-default)] bg-[var(--bg-panel)] px-2.5 py-1 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
          >
            <Download className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
            <span>Export CSV</span>
          </a>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={loadPreview} />}

      {/* Dataset Selector Strip */}
      <div className="flex flex-wrap gap-2">
        {invLoading ? (
          <div className="font-mono text-xs text-[var(--text-muted)]">Loading datasets...</div>
        ) : (
          datasets.map((ds) => {
            const active = ds.id === selectedId;
            return (
              <button
                key={ds.id}
                type="button"
                onClick={() => handleDatasetChange(ds.id)}
                className={`rounded-[3px] border px-3 py-1.5 text-left transition-colors ${
                  active
                    ? 'border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--text-primary)]'
                    : 'border-[var(--border-default)] bg-[var(--bg-panel)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                }`}
              >
                <div className="text-xs font-semibold">{ds.name}</div>
                <div className="font-mono text-[10px] text-[var(--text-muted)]">
                  {ds.row_count} rows · {ds.column_count} cols
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Selected Dataset Overview */}
      {activeMeta && (
        <Panel>
          <PanelHeader
            title={activeMeta.name}
            subtitle={activeMeta.description}
            right={
              <div className="flex items-center gap-2">
                <Badge tone="neutral">{activeMeta.category}</Badge>
                <button
                  type="button"
                  onClick={() => setShowSchema((s) => !s)}
                  className="rounded-[2px] border border-[var(--border-default)] bg-[var(--bg-inset)] px-2 py-0.5 font-mono text-[10px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                >
                  {showSchema ? 'Hide Schema' : `Inspect Schema (${activeMeta.column_count} cols)`}
                </button>
              </div>
            }
          />
          <div className="grid grid-cols-2 divide-y divide-[var(--border-subtle)] sm:grid-cols-3 lg:grid-cols-6 lg:divide-x lg:divide-y-0">
            <div className="p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Row Count
              </div>
              <div className="mt-1 font-mono text-sm font-semibold tabular-nums">
                {activeMeta.row_count.toLocaleString()}
              </div>
            </div>
            <div className="p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Columns
              </div>
              <div className="mt-1 font-mono text-sm font-semibold tabular-nums">
                {activeMeta.column_count}
              </div>
            </div>
            <div className="p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Missing Cells
              </div>
              <div
                className={`mt-1 font-mono text-sm font-semibold tabular-nums ${
                  activeMeta.missing_cells === 0 ? 'text-[var(--positive)]' : 'text-[var(--warning)]'
                }`}
              >
                {activeMeta.missing_cells}
              </div>
            </div>
            <div className="p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Data Source
              </div>
              <div className="mt-1 truncate font-mono text-xs text-[var(--text-primary)]">
                {activeMeta.data_sources.length ? activeMeta.data_sources.join(', ') : 'Derived'}
              </div>
            </div>
            <div className="p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Time Range
              </div>
              <div className="mt-1 font-mono text-[10px] text-[var(--text-secondary)]">
                {activeMeta.time_range
                  ? `${activeMeta.time_range.start.slice(0, 16)} → ${activeMeta.time_range.end.slice(0, 16)}`
                  : 'N/A'}
              </div>
            </div>
            <div className="p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                File Size / Updated
              </div>
              <div className="mt-1 font-mono text-[10px] text-[var(--text-secondary)]">
                {formatBytes(activeMeta.size_bytes)} · {formatTimestamp(activeMeta.modified_at)}
              </div>
            </div>
          </div>

          {showSchema && (
            <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-inset)] p-4">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Column Schema & Null Check ({activeMeta.relative_path})
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {activeMeta.columns.map((c) => (
                  <div
                    key={c.name}
                    className="rounded-[2px] border border-[var(--border-subtle)] bg-[var(--bg-panel)] px-2.5 py-1.5 font-mono text-[11px]"
                  >
                    <div className="truncate font-semibold text-[var(--text-primary)]">{c.name}</div>
                    <div className="flex justify-between text-[10px] text-[var(--text-muted)]">
                      <span>{c.dtype}</span>
                      <span>{c.missing} null</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Panel>
      )}

      {/* Paginated Dataset Preview Table */}
      <Panel>
        <PanelHeader
          title="Dataset Preview"
          subtitle={`Filtered ${preview?.filtered_rows ?? 0} of ${preview?.total_rows ?? 0} rows · Click column header to sort`}
          right={
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search rows..."
                  className="rounded-[3px] border border-[var(--border-default)] bg-[var(--bg-inset)] py-1 pl-7 pr-2.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                />
              </div>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                aria-label="Rows per page"
                className="rounded-[3px] border border-[var(--border-default)] bg-[var(--bg-inset)] px-2 py-1 font-mono text-[11px] text-[var(--text-primary)]"
              >
                <option value={15}>15 / page</option>
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
              </select>
            </div>
          }
        />

        {previewLoading ? (
          <LoadingBlock rows={6} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-[11px]">
              <thead className="border-b border-[var(--border-default)] bg-[var(--bg-inset)] text-[10px] uppercase text-[var(--text-secondary)]">
                <tr>
                  {(preview?.columns ?? []).map((col) => (
                    <th key={col} className="whitespace-nowrap px-2.5 py-2">
                      <button
                        type="button"
                        onClick={() => toggleSort(col)}
                        className="hover:text-[var(--text-primary)]"
                      >
                        {col}
                        {sortBy === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {(preview?.rows ?? []).length === 0 ? (
                  <tr>
                    <td
                      colSpan={Math.max(1, preview?.columns.length ?? 1)}
                      className="px-4 py-8 text-center text-xs text-[var(--text-muted)]"
                    >
                      No rows match the search filter.
                    </td>
                  </tr>
                ) : (
                  (preview?.rows ?? []).map((row, idx) => (
                    <tr key={idx} className="hover:bg-[var(--bg-hover)]">
                      {(preview?.columns ?? []).map((col) => {
                        const val = row[col];
                        const formatted =
                          val === null || val === undefined
                            ? 'null'
                            : typeof val === 'number'
                            ? Number.isInteger(val)
                              ? String(val)
                              : val.toFixed(6)
                            : String(val);
                        return (
                          <td
                            key={col}
                            className={`whitespace-nowrap px-2.5 py-1.5 tabular-nums ${
                              val === null ? 'text-[var(--text-muted)]' : 'text-[var(--text-primary)]'
                            }`}
                          >
                            {formatted}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-[var(--border-subtle)] px-4 py-2.5 font-mono text-[11px] text-[var(--text-secondary)]">
          <span>
            Page {preview?.page ?? 1} of {preview?.total_pages ?? 1}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={(preview?.page ?? 1) <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-[2px] border border-[var(--border-default)] bg-[var(--bg-inset)] px-2.5 py-1 hover:bg-[var(--bg-hover)] disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={(preview?.page ?? 1) >= (preview?.total_pages ?? 1)}
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
