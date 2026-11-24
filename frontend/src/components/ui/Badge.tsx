import React from 'react';

type BadgeTone = 'neutral' | 'accent' | 'positive' | 'negative' | 'warning';

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'bg-[var(--bg-inset)] text-[var(--text-secondary)] border-[var(--border-default)]',
  accent: 'bg-[var(--accent-muted)] text-[var(--accent)] border-[var(--accent)]/30',
  positive: 'bg-[var(--positive-muted)] text-[var(--positive)] border-[var(--positive)]/30',
  negative: 'bg-[var(--negative-muted)] text-[var(--negative)] border-[var(--negative)]/30',
  warning: 'bg-[var(--warning-muted)] text-[var(--warning)] border-[var(--warning)]/30',
};

interface BadgeProps {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
}

export function Badge({ children, tone = 'neutral', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-[2px] border px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-tight ${toneClasses[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
