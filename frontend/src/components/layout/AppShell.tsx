import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      <Sidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenMobileMenu={() => setMobileOpen(true)} />
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-5 lg:px-6">
          {children}
        </main>
        <footer className="border-t border-[var(--border-subtle)] px-4 py-3 font-mono text-[10px] text-[var(--text-muted)] lg:px-6">
          <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-2">
            <span>ALGORITHMIC CRYPTO VOLATILITY FORECASTER · BTC/USDT 1H → 4H HORIZON</span>
            <span>MODEL OUTPUTS ARE QUANTITATIVE RESEARCH ESTIMATES, NOT FINANCIAL ADVICE</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
