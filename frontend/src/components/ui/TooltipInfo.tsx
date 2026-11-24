import { useState } from 'react';
import { HelpCircle } from 'lucide-react';

interface TooltipInfoProps {
  text: string;
  label?: string;
}

export function TooltipInfo({ text, label = 'Metric definition' }: TooltipInfoProps) {
  const [open, setOpen] = useState(false);

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={label}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center justify-center rounded-[2px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
      >
        <HelpCircle className="h-3 w-3" />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 z-50 mb-1.5 w-60 -translate-x-1/2 rounded-[3px] border border-[var(--border-strong)] bg-[var(--bg-panel)] px-2.5 py-2 text-[11px] font-normal leading-snug text-[var(--text-primary)] shadow-lg"
        >
          {text}
        </span>
      )}
    </span>
  );
}
