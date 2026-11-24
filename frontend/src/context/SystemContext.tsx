import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import type { ModelKey, SystemStatusResponse } from '../types/api';

interface SystemContextValue {
  status: SystemStatusResponse | null;
  statusLoading: boolean;
  statusError: string | null;
  selectedModel: ModelKey;
  setSelectedModel: (model: ModelKey) => void;
  refreshing: boolean;
  refreshNotice: { type: 'success' | 'error'; message: string } | null;
  clearRefreshNotice: () => void;
  triggerRefresh: () => Promise<void>;
  reloadStatus: () => Promise<void>;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  refreshTick: number;
}

const SystemContext = createContext<SystemContextValue | undefined>(undefined);

export function SystemProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SystemStatusResponse | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<ModelKey>('gru');
  const [refreshing, setRefreshing] = useState(false);
  const [refreshNotice, setRefreshNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('qvf-theme');
    return saved === 'light' ? 'light' : 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
    }
    localStorage.setItem('qvf-theme', theme);
  }, [theme]);

  const reloadStatus = useCallback(async () => {
    try {
      setStatusError(null);
      const data = await apiClient.getStatus();
      setStatus(data);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Unable to reach backend API');
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    reloadStatus();
  }, [reloadStatus]);

  const triggerRefresh = useCallback(async () => {
    setRefreshing(true);
    setRefreshNotice(null);
    try {
      const res = await apiClient.runPipeline('BTC/USDT', '1h', 100);
      await reloadStatus();
      setRefreshTick((t) => t + 1);
      setRefreshNotice({
        type: 'success',
        message: `Pipeline refreshed (${res.candles_fetched} candles, ${res.aligned_features_shape[0]} aligned rows).`,
      });
    } catch (err) {
      await reloadStatus();
      setRefreshTick((t) => t + 1);
      setRefreshNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'Pipeline refresh failed.',
      });
    } finally {
      setRefreshing(false);
    }
  }, [reloadStatus]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const clearRefreshNotice = useCallback(() => setRefreshNotice(null), []);

  return (
    <SystemContext.Provider
      value={{
        status,
        statusLoading,
        statusError,
        selectedModel,
        setSelectedModel,
        refreshing,
        refreshNotice,
        clearRefreshNotice,
        triggerRefresh,
        reloadStatus,
        theme,
        toggleTheme,
        refreshTick,
      }}
    >
      {children}
    </SystemContext.Provider>
  );
}

export function useSystem() {
  const ctx = useContext(SystemContext);
  if (!ctx) throw new Error('useSystem must be used inside SystemProvider');
  return ctx;
}
