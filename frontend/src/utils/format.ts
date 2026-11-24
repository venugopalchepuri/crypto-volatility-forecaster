export function formatUSD(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatVolPct(value: number | null | undefined, decimals = 3): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${(value * 100).toFixed(decimals)}%`;
}

export function formatPct(value: number | null | undefined, decimals = 2, signed = false): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const prefix = signed && value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(decimals)}%`;
}

export function formatNumber(value: number | null | undefined, decimals = 4, signed = false): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const prefix = signed && value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(decimals)}`;
}

export function formatCompactNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatTimestamp(ts: string | null | undefined): string {
  if (!ts) return 'Unavailable';
  // Handle ISO or "YYYY-MM-DD HH:MM:SS" cleanly without shifting local timezone unexpectedly
  return ts.replace('T', ' ').replace('+00:00', ' UTC').replace('Z', ' UTC');
}

export function formatShortTimestamp(ts: string | null | undefined): string {
  if (!ts) return '';
  const normalized = ts.replace('T', ' ').replace('+00:00', '').replace('Z', '');
  // Return MM-DD HH:MM
  return normalized.length >= 16 ? normalized.slice(5, 16) : normalized;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
