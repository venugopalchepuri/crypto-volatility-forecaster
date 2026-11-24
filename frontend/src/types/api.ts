export type ModelKey = 'gru' | 'lstm' | 'ridge';

export interface AvailableModelsMap {
  gru: boolean;
  lstm: boolean;
  ridge: boolean;
  persistence: boolean;
}

export interface SystemStatusResponse {
  status: string;
  model_loaded: boolean;
  available_models: AvailableModelsMap;
  finbert_active: boolean;
  finbert_fallback: boolean;
  aligned_dataset_rows: number;
  market_dataset_rows: number;
  latest_timestamp: string | null;
  data_source: string | null;
  last_pipeline_run: string | null;
  exchange: string;
  trading_pair: string;
  timeframe: string;
  forecast_horizon: string;
}

export interface MarketRecord {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  data_source?: string;
  log_return?: number | null;
  volatility_12h?: number | null;
  volatility_24h?: number | null;
  vol_change_pct?: number | null;
  rsi_14?: number | null;
  macd?: number | null;
  macd_signal?: number | null;
  macd_hist?: number | null;
  bb_middle?: number | null;
  bb_upper?: number | null;
  bb_lower?: number | null;
  bb_width?: number | null;
  bb_pct_b?: number | null;
  sma_7?: number | null;
  sma_24?: number | null;
  ema_7?: number | null;
  ema_24?: number | null;
  momentum_4h?: number | null;
  momentum_10h?: number | null;
}

export interface MarketSummary {
  latest_timestamp: string;
  earliest_timestamp: string;
  total_rows: number;
  is_processed: boolean;
  data_sources: string[];
  latest_close: number;
  change_24h_pct: number;
  high_24h: number;
  low_24h: number;
  volume_24h: number;
  volatility_12h: number | null;
  volatility_24h: number | null;
  rsi_14: number | null;
  macd: number | null;
  macd_signal: number | null;
  macd_hist: number | null;
  bb_width: number | null;
  bb_pct_b: number | null;
  momentum_4h: number | null;
  momentum_10h: number | null;
}

export interface MarketLatestResponse {
  count: number;
  total_available: number;
  summary: MarketSummary | null;
  records: MarketRecord[];
}

export interface VolatilityPredictionResponse {
  timestamp: string;
  model_requested: string;
  model_used: string;
  fallback_used: boolean;
  available_models: AvailableModelsMap;
  horizon_hours: number;
  current_price: number;
  historical_24h_volatility: number;
  historical_12h_volatility: number;
  forecast_next_4h_volatility: number;
  volatility_regime: string;
  latest_sentiment_score: number;
  rsi_14: number;
  latest_features?: Record<string, number | string | null>;
  data_source?: string;
}

export interface ForecastSeriesPoint {
  timestamp: string;
  close: number;
  log_return: number | null;
  volatility_12h: number | null;
  volatility_24h: number | null;
  target_future_volatility: number | null;
  predicted_volatility: number | null;
  avg_sentiment: number | null;
  sentiment_shock: number | null;
  split: 'train' | 'val' | 'test';
}

export interface ForecastSeriesResponse {
  total_available: number;
  count: number;
  prediction_model_used: string | null;
  horizon_hours: number;
  target_formula: string;
  current_forecast: VolatilityPredictionResponse;
  records: ForecastSeriesPoint[];
}

export interface SentimentAnalyzeResponse {
  text: string;
  source_mode?: string;
  probabilities: {
    positive: number;
    negative: number;
    neutral: number;
  };
  sentiment_score: number;
  label: string;
}

export interface HourlySentimentRecord {
  timestamp: string;
  avg_sentiment: number;
  pct_positive: number;
  pct_negative: number;
  pct_neutral: number;
  sentiment_variance: number;
  post_count: number;
  sentiment_shock: number;
}

export interface ScoredHeadline {
  timestamp: string;
  text: string;
  data_source: string;
  positive: number | null;
  negative: number | null;
  neutral: number | null;
  sentiment_score: number | null;
  label: string;
}

export interface SentimentOverviewResponse {
  status: string;
  data_sources: string[];
  hourly_summary: {
    latest_timestamp?: string;
    earliest_timestamp?: string;
    hours_covered?: number;
    total_posts_aggregated?: number;
    latest_avg_sentiment?: number;
    latest_sentiment_shock?: number;
    mean_avg_sentiment?: number;
    mean_pct_positive?: number;
    mean_pct_negative?: number;
    mean_pct_neutral?: number;
    max_positive_shock?: number;
    max_negative_shock?: number;
  };
  hourly_series: HourlySentimentRecord[];
  headline_distribution: {
    bullish: number;
    bearish: number;
    neutral: number;
    unscored: number;
  };
  total_headlines: number;
  filtered_headlines: number;
  headlines: ScoredHeadline[];
}

export interface BenchmarkRecord {
  model: string;
  rmse: number;
  mae: number;
  mape_pct: number;
  qlike_loss: number;
  pearson_corr: number;
  directional_accuracy_pct: number;
}

export interface BenchmarkResponse {
  status: string;
  split_info?: string;
  records: BenchmarkRecord[];
}

export interface AblationRecord {
  configuration: string;
  feature_count: number;
  rmse: number;
  mae: number;
  qlike_loss: number;
  directional_accuracy_pct: number;
}

export interface FeatureImportanceRecord {
  feature: string;
  category: string;
  importance_score: number;
  relative_importance_pct: number;
}

export interface AblationResponse {
  status: string;
  split_info?: string;
  ablation: AblationRecord[];
  feature_importance: FeatureImportanceRecord[];
}

export interface FileArtifactMeta {
  name?: string;
  exists: boolean;
  size_bytes: number;
  modified_at: string | null;
}

export interface ModelArchitectureSpec {
  name: string;
  family: string;
  checkpoint_key: string | null;
  input_representation: string;
  configuration: string;
  loss_function: string;
  evaluation_split: string;
}

export interface ModelsDetailsResponse {
  checkpoints: Record<string, FileArtifactMeta>;
  best_hyperparams: Record<string, number | string> | null;
  tuning_results: Record<string, number | string>[];
  architectures: ModelArchitectureSpec[];
  split_protocol: {
    benchmark_split: string;
    ablation_split: string;
    target_definition: string;
    qlike_formula: string;
  };
}

export interface BacktestSummary {
  strategy_cum_return_pct: number;
  buy_and_hold_cum_return_pct: number;
  strategy_sharpe_ratio: number;
  buy_and_hold_sharpe_ratio: number;
  strategy_max_drawdown_pct: number;
  buy_and_hold_max_drawdown_pct: number;
  strategy_annualized_vol_pct: number;
  buy_and_hold_annualized_vol_pct: number;
  volatility_reduction_pct: number;
  win_rate_pct: number;
  total_periods: number;
}

export interface BacktestEquityPoint {
  timestamp: string;
  forecast_volatility: number;
  weight: number;
  asset_return: number;
  strategy_return: number;
  strategy_equity: number;
  buy_and_hold_equity: number;
  strategy_drawdown_pct: number;
  buy_and_hold_drawdown_pct: number;
}

export interface BacktestResponse {
  status: string;
  summary: Partial<BacktestSummary>;
  equity_curve: BacktestEquityPoint[];
  time_range?: {
    start: string;
    end: string;
    total_rows: number;
  };
  methodology?: {
    sizing_formula: string;
    target_volatility_4h: number;
    min_weight: number;
    max_weight: number;
    transaction_cost_bps: number;
    initial_capital_usd: number;
    periods_per_year: number;
    notes: string[];
  };
}

export interface DatasetColumnMeta {
  name: string;
  dtype: string;
  missing: number;
}

export interface DatasetInventoryItem {
  id: string;
  name: string;
  category: string;
  description: string;
  relative_path: string;
  exists: boolean;
  size_bytes: number;
  modified_at: string | null;
  row_count: number;
  column_count: number;
  missing_cells: number;
  columns: DatasetColumnMeta[];
  time_range: { start: string; end: string } | null;
  data_sources: string[];
}

export interface DatasetPreviewResponse {
  dataset_id: string;
  columns: string[];
  total_rows: number;
  filtered_rows: number;
  page: number;
  page_size: number;
  total_pages: number;
  rows: Record<string, string | number | null>[];
}

export interface SystemHealthResponse {
  api_status: string;
  python_version: string;
  platform: string;
  config: {
    default_symbol: string;
    default_timeframe: string;
    default_limit: number;
    volatility_horizon_hours: number;
  };
  runtime: {
    available_models: AvailableModelsMap;
    finbert_active: boolean;
    finbert_fallback: boolean;
    last_pipeline_run: string | null;
  };
  packages: Record<string, boolean>;
  model_artifacts: FileArtifactMeta[];
  datasets: DatasetInventoryItem[];
  report_charts: FileArtifactMeta[];
  endpoints: { method: string; path: string; summary: string }[];
}

export interface ReportResponse {
  status: string;
  report_path: string;
  available_charts: string[];
  content_markdown: string;
}
