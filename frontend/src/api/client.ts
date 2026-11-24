import type {
  AblationResponse,
  BacktestResponse,
  BenchmarkResponse,
  DatasetInventoryItem,
  DatasetPreviewResponse,
  ForecastSeriesResponse,
  MarketLatestResponse,
  ModelKey,
  ModelsDetailsResponse,
  ReportResponse,
  SentimentAnalyzeResponse,
  SentimentOverviewResponse,
  SystemHealthResponse,
  SystemStatusResponse,
  VolatilityPredictionResponse,
} from '../types/api';

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body?.detail) {
        detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail);
      }
    } catch {
      // ignore JSON parse failure
    }
    throw new ApiError(detail, res.status);
  }
  return res.json() as Promise<T>;
}

export const apiClient = {
  getStatus: () => request<SystemStatusResponse>('/api/status'),

  getMarketLatest: (limit = 100) =>
    request<MarketLatestResponse>(`/api/market/latest?limit=${limit}`),

  getVolatilityPrediction: (model: ModelKey = 'gru') =>
    request<VolatilityPredictionResponse>(`/api/predict/volatility?model=${encodeURIComponent(model)}`),

  getForecastSeries: (limit = 72, model: ModelKey = 'gru') =>
    request<ForecastSeriesResponse>(`/api/forecast/series?limit=${limit}&model=${encodeURIComponent(model)}`),

  getSentimentOverview: (params: {
    limit?: number;
    offset?: number;
    sentiment?: string;
    search?: string;
  } = {}) => {
    const qs = new URLSearchParams();
    if (params.limit !== undefined) qs.set('limit', String(params.limit));
    if (params.offset !== undefined) qs.set('offset', String(params.offset));
    if (params.sentiment) qs.set('sentiment', params.sentiment);
    if (params.search) qs.set('search', params.search);
    return request<SentimentOverviewResponse>(`/api/sentiment/overview?${qs.toString()}`);
  },

  analyzeHeadline: (text: string) =>
    request<SentimentAnalyzeResponse>('/api/sentiment/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    }),

  getBenchmarks: () => request<BenchmarkResponse>('/api/benchmark'),

  getAblation: () => request<AblationResponse>('/api/ablation'),

  getModelsDetails: () => request<ModelsDetailsResponse>('/api/models/details'),

  getBacktest: (limit = 500) => request<BacktestResponse>(`/api/backtest?limit=${limit}`),

  getDatasets: () => request<{ datasets: DatasetInventoryItem[] }>('/api/data/datasets'),

  getDatasetPreview: (params: {
    dataset: string;
    page?: number;
    pageSize?: number;
    search?: string;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
  }) => {
    const qs = new URLSearchParams({
      dataset: params.dataset,
      page: String(params.page ?? 1),
      page_size: String(params.pageSize ?? 25),
      search: params.search ?? '',
      sort_by: params.sortBy ?? '',
      sort_dir: params.sortDir ?? 'desc',
    });
    return request<DatasetPreviewResponse>(`/api/data/preview?${qs.toString()}`);
  },

  getDatasetExportUrl: (dataset: string) => `/api/data/export?dataset=${encodeURIComponent(dataset)}`,

  getSystemHealth: () => request<SystemHealthResponse>('/api/system/health'),

  getReport: () => request<ReportResponse>('/api/report'),

  runPipeline: (symbol = 'BTC/USDT', timeframe = '1h', limit = 100) =>
    request<{
      success: boolean;
      timestamp?: string;
      candles_fetched: number;
      market_features_rows: number;
      sentiment_periods: number;
      aligned_features_shape: number[];
    }>('/api/pipeline/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, timeframe, limit }),
    }),
};
