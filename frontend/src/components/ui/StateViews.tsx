import { AlertCircle, Database } from 'lucide-react';

export function LoadingBlock({ rows = 4, height = 'h-6' }: { rows?: number; height?: string }) {
  return (
    <div className="space-y-2 p-4" aria-busy="true" aria-label="Loading data">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={`${height} w-full animate-pulse rounded-[2px] bg-[var(--bg-hover)]`}
        />
      ))}
    </div>
  );
}

export function ErrorState({
  title = 'Failed to load data',
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start justify-between gap-3 rounded-[3px] border border-[var(--negative)]/30 bg-[var(--negative-muted)] p-4 sm:flex-row sm:items-center"
    >
      <div className="flex items-start gap-2.5">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--negative)]" />
        <div>
          <p className="text-xs font-semibold text-[var(--text-primary)]">{title}</p>
          <p className="mt-0.5 font-mono text-[11px] text-[var(--text-secondary)]">{message}</p>
        </div>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-[3px] border border-[var(--border-strong)] bg-[var(--bg-panel)] px-2.5 py-1 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title = 'No records available',
  description,
}: {
  title?: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
      <Database className="mb-2 h-5 w-5 text-[var(--text-muted)]" />
      <p className="text-xs font-medium text-[var(--text-primary)]">{title}</p>
      <p className="mt-1 max-w-md text-[11px] text-[var(--text-secondary)]">{description}</p>
    </div>
  );
}
