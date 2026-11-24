import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, ExternalLink, Menu, Moon, RefreshCw, Sun } from 'lucide-react';
import { useSystem } from '../../context/SystemContext';
import { formatTimestamp } from '../../utils/format';
import { NAV_ITEMS } from './Sidebar';

interface TopBarProps {
  onOpenMobileMenu: () => void;
}

export function TopBar({ onOpenMobileMenu }: TopBarProps) {
  const { pathname } = useLocation();
  const { status, refreshing, triggerRefresh, theme, toggleTheme, refreshNotice, clearRefreshNotice } =
    useSystem();

  const currentNav = NAV_ITEMS.find((n) => (n.to === '/' ? pathname === '/' : pathname.startsWith(n.to)));

  const statusText =
    status?.status === 'online'
      ? status.data_source === 'binance_live'
        ? 'API Online · Binance Data'
        : 'API Online · Local Data'
      : 'API Offline';

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border-default)] bg-[var(--bg-canvas)]/95 backdrop-blur-sm">
      <div className="flex h-12 items-center justify-between gap-3 px-4 lg:px-6">
        {/* Left: mobile menu + breadcrumb */}
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Open navigation menu"
            className="rounded-[3px] border border-[var(--border-default)] bg-[var(--bg-panel)] p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] lg:hidden"
          >
            <Menu className="h-4 w-4" />
          </button>

          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-[12px]">
            <Link
              to="/"
              className="truncate font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              ACVF
            </Link>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
            <span className="truncate font-semibold text-[var(--text-primary)]">
              {currentNav?.label ?? 'Workspace'}
            </span>
          </nav>
        </div>

        {/* Right: backend timestamp, status pill, theme toggle, refresh, docs */}
        <div className="flex shrink-0 items-center gap-2">
          {status?.latest_timestamp && (
            <span className="hidden font-mono text-[11px] text-[var(--text-muted)] xl:inline">
              OBS: <span className="text-[var(--text-secondary)]">{formatTimestamp(status.latest_timestamp)}</span>
            </span>
          )}

          <div
            className="hidden items-center gap-1.5 rounded-[2px] border border-[var(--border-default)] bg-[var(--bg-panel)] px-2 py-1 font-mono text-[10px] text-[var(--text-secondary)] sm:flex"
            title="Live backend API and dataset status"
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                status?.status === 'online' ? 'bg-[var(--positive)]' : 'bg-[var(--negative)]'
              }`}
            />
            <span>{statusText}</span>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            className="inline-flex items-center justify-center rounded-[3px] border border-[var(--border-default)] bg-[var(--bg-panel)] p-1.5 text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
          >
            {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>

          <button
            type="button"
            onClick={triggerRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-[3px] border border-[var(--border-default)] bg-[var(--bg-panel)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-primary)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)] disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 text-[var(--text-secondary)] ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{refreshing ? 'Running...' : 'Refresh Pipeline'}</span>
          </button>

          <a
            href="/docs"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-[3px] bg-[var(--accent)] px-2.5 py-1 text-[11px] font-medium text-white hover:opacity-90"
          >
            <span>API Docs</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* Pipeline refresh feedback bar */}
      {refreshNotice && (
        <div
          role="status"
          className={`flex items-center justify-between border-t px-4 py-1.5 font-mono text-[11px] lg:px-6 ${
            refreshNotice.type === 'success'
              ? 'border-[var(--positive)]/30 bg-[var(--positive-muted)] text-[var(--positive)]'
              : 'border-[var(--negative)]/30 bg-[var(--negative-muted)] text-[var(--negative)]'
          }`}
        >
          <span>{refreshNotice.message}</span>
          <button
            type="button"
            onClick={clearRefreshNotice}
            className="ml-4 text-[10px] underline hover:opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}
    </header>
  );
}
