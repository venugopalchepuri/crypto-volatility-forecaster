import React from 'react';

interface PanelProps {
  children: React.ReactNode;
  className?: string;
}

export function Panel({ children, className = '' }: PanelProps) {
  return <section className={`surface-panel ${className}`}>{children}</section>;
}

interface PanelHeaderProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  className?: string;
}

export function PanelHeader({ title, subtitle, right, className = '' }: PanelHeaderProps) {
  return (
    <div
      className={`flex flex-wrap items-start justify-between gap-2 border-b border-[var(--border-subtle)] px-4 py-3 ${className}`}
    >
      <div className="min-w-0">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--text-primary)]">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">{subtitle}</p>
        )}
      </div>
      {right && <div className="flex items-center gap-2 shrink-0">{right}</div>}
    </div>
  );
}
