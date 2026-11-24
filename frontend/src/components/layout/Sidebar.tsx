import { NavLink } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  CandlestickChart,
  Cpu,
  Database,
  LayoutDashboard,
  MessageSquareText,
  Server,
  X,
} from 'lucide-react';
import { useSystem } from '../../context/SystemContext';

export interface NavItem {
  to: string;
  label: string;
  shortDesc: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const NAV_ITEMS: NavItem[] = [
  {
    to: '/',
    label: 'Overview',
    shortDesc: 'System & forecast summary',
    icon: LayoutDashboard,
  },
  {
    to: '/market',
    label: 'Market Analysis',
    shortDesc: 'BTC/USDT OHLCV & indicators',
    icon: CandlestickChart,
  },
  {
    to: '/forecast',
    label: 'Volatility Forecast',
    shortDesc: '4H forward volatility model',
    icon: Activity,
  },
  {
    to: '/sentiment',
    label: 'Sentiment Analysis',
    shortDesc: 'FinBERT NLP & headline stream',
    icon: MessageSquareText,
  },
  {
    to: '/models',
    label: 'Model Performance',
    shortDesc: 'Benchmarks & ablation study',
    icon: Cpu,
  },
  {
    to: '/backtest',
    label: 'Strategy & Backtesting',
    shortDesc: 'Volatility targeting simulation',
    icon: BarChart3,
  },
  {
    to: '/data',
    label: 'Data Explorer',
    shortDesc: 'Datasets, schema & quality',
    icon: Database,
  },
  {
    to: '/system',
    label: 'System / About',
    shortDesc: 'Pipeline health & API docs',
    icon: Server,
  },
];

interface SidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({ mobileOpen, onCloseMobile }: SidebarProps) {
  const { status } = useSystem();

  const navContent = (
    <div className="flex h-full flex-col justify-between bg-[var(--bg-sidebar)] text-[var(--text-primary)]">
      <div>
        {/* Brand Header */}
        <div className="flex h-12 items-center justify-between border-b border-[var(--border-subtle)] px-4">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-5 items-center rounded-[2px] border border-[var(--accent)]/40 bg-[var(--accent-muted)] px-1.5 font-mono text-[10px] font-semibold tracking-wider text-[var(--accent)]">
              ACVF
            </span>
            <span className="text-[12px] font-semibold tracking-tight text-[var(--text-primary)]">
              Volatility Desk
            </span>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation"
            className="rounded-[2px] p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Instrument Context */}
        <div className="border-b border-[var(--border-subtle)] px-4 py-2.5">
          <div className="flex items-center justify-between font-mono text-[11px]">
            <span className="font-semibold text-[var(--text-primary)]">
              {status?.trading_pair ?? 'BTC/USDT'}
            </span>
            <span className="text-[var(--text-muted)]">
              {status?.timeframe?.toUpperCase() ?? '1H'} · {status?.forecast_horizon ?? '4H FWD'}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 font-mono text-[10px] text-[var(--text-secondary)]">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                status?.status === 'online' ? 'bg-[var(--positive)]' : 'bg-[var(--text-muted)]'
              }`}
            />
            <span>{status?.exchange ?? 'Binance CCXT'}</span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav aria-label="Primary navigation" className="space-y-0.5 px-2 py-3">
          <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--text-muted)]">
            Workspaces
          </div>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={onCloseMobile}
                className={({ isActive }) =>
                  `group flex items-center gap-2.5 rounded-[3px] px-2.5 py-2 text-[12px] font-medium transition-colors ${
                    isActive
                      ? 'bg-[var(--bg-hover)] text-[var(--text-primary)] border-l-2 border-[var(--accent)] pl-[8px]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]/60 hover:text-[var(--text-primary)]'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={`h-3.5 w-3.5 shrink-0 ${
                        isActive
                          ? 'text-[var(--accent)]'
                          : 'text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Sidebar Footer Metadata */}
      <div className="border-t border-[var(--border-subtle)] px-4 py-3 font-mono text-[10px] text-[var(--text-muted)]">
        <div className="flex items-center justify-between">
          <span>Aligned rows</span>
          <span className="text-[var(--text-secondary)]">
            {status?.aligned_dataset_rows ?? '—'}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span>Data feed</span>
          <span className="text-[var(--text-secondary)]">
            {status?.data_source ?? '—'}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop persistent sidebar */}
      <aside className="hidden w-56 shrink-0 border-r border-[var(--border-default)] lg:block">
        <div className="sticky top-0 h-screen overflow-y-auto">{navContent}</div>
      </aside>

      {/* Mobile slide-over sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/60"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-10 h-full w-64 border-r border-[var(--border-default)]">
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
}
