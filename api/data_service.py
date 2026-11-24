"""Backend data access, caching, and analytical formatting helpers for FastAPI."""

from datetime import datetime, timezone
import hashlib
import importlib.util
import json
from pathlib import Path
import platform
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

from src.utils.config import (
    DEFAULT_LIMIT,
    DEFAULT_SYMBOL,
    DEFAULT_TIMEFRAME,
    PROCESSED_DIR,
    PROJECT_ROOT,
    RAW_MARKET_DIR,
    RAW_SOCIAL_DIR,
    SAVED_MODELS_DIR,
    VOLATILITY_HORIZON_HOURS,
)


DATASET_REGISTRY: Dict[str, Dict[str, Any]] = {
    "aligned_features": {
        "id": "aligned_features",
        "name": "Aligned Multimodal Features",
        "path": PROCESSED_DIR / "aligned_features.csv",
        "category": "Processed ML Matrix",
        "description": "Hourly market technical indicators aligned with FinBERT sentiment features and 4-hour forward realized volatility target.",
    },
    "market_features": {
        "id": "market_features",
        "name": "Market Technical Features",
        "path": PROCESSED_DIR / "market_features.csv",
        "category": "Processed Market",
        "description": "OHLCV candles enriched with log returns, rolling volatility (12h/24h), RSI(14), MACD(12,26,9), Bollinger Bands, SMA/EMA, and momentum.",
    },
    "raw_btc_usdt": {
        "id": "raw_btc_usdt",
        "name": "Raw BTC/USDT 1H OHLCV",
        "path": RAW_MARKET_DIR / "btc_usdt_1h.csv",
        "category": "Raw Market",
        "description": "Raw 1-hour OHLCV candles ingested from Binance CCXT (or labeled offline fallback).",
    },
    "hourly_sentiment": {
        "id": "hourly_sentiment",
        "name": "Hourly Sentiment Aggregation",
        "path": PROCESSED_DIR / "hourly_sentiment.csv",
        "category": "Processed NLP",
        "description": "Hourly aggregated FinBERT sentiment scores, class proportions, variance, post counts, and 24-hour sentiment shock.",
    },
    "social_posts": {
        "id": "social_posts",
        "name": "Social & News Headlines",
        "path": RAW_SOCIAL_DIR / "sample_social_posts.csv",
        "category": "Raw NLP",
        "description": "Timestamped cryptocurrency headlines and social posts used for FinBERT inference.",
    },
    "backtest_equity_curve": {
        "id": "backtest_equity_curve",
        "name": "Backtest Equity Curve",
        "path": PROCESSED_DIR / "backtest_equity_curve.csv",
        "category": "Evaluation",
        "description": "Period-by-period volatility-targeting strategy weights, returns, and equity curve vs passive buy-and-hold.",
    },
}


def df_to_clean_records(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """Converts a DataFrame into JSON-safe records (NaN/Inf -> None)."""
    if df.empty:
        return []
    cleaned = df.replace([np.inf, -np.inf], np.nan)
    return json.loads(cleaned.to_json(orient="records", date_format="iso"))


def _file_meta(path: Path) -> Dict[str, Any]:
    if not path.exists():
        return {
            "exists": False,
            "size_bytes": 0,
            "modified_at": None,
        }
    stat = path.stat()
    mtime = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    return {
        "exists": True,
        "size_bytes": stat.st_size,
        "modified_at": mtime,
    }


def _cache_key(text: str) -> str:
    return hashlib.md5(text.strip().lower().encode("utf-8")).hexdigest()


def _classify_sentiment(score: float) -> str:
    if score > 0.15:
        return "Bullish"
    if score < -0.15:
        return "Bearish"
    return "Neutral"


def load_sentiment_cache() -> Dict[str, Dict[str, float]]:
    cache_path = RAW_SOCIAL_DIR / "sentiment_cache.json"
    if not cache_path.exists():
        return {}
    try:
        return json.loads(cache_path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def get_market_overview_data(limit: int = 100) -> Dict[str, Any]:
    """Loads market features (or raw OHLCV fallback) and computes summary stats."""
    market_file = PROCESSED_DIR / "market_features.csv"
    is_processed = True
    if not market_file.exists():
        market_file = RAW_MARKET_DIR / "btc_usdt_1h.csv"
        is_processed = False
    if not market_file.exists():
        return {"exists": False, "records": [], "summary": None}

    df = pd.read_csv(market_file)
    total_rows = len(df)
    sliced = df.tail(max(1, min(limit, 1000))).copy()
    records = df_to_clean_records(sliced)

    summary: Dict[str, Any] = {}
    if not df.empty:
        latest = df.iloc[-1]
        close_now = float(latest["close"])
        prev_24_idx = max(0, len(df) - 25)
        close_24h_ago = float(df.iloc[prev_24_idx]["close"])
        change_24h_pct = ((close_now - close_24h_ago) / close_24h_ago * 100.0) if close_24h_ago > 0 else 0.0

        window_24 = df.tail(24)
        sources = sorted(df["data_source"].dropna().unique().tolist()) if "data_source" in df.columns else []
        summary = {
            "latest_timestamp": str(latest["timestamp"]),
            "earliest_timestamp": str(df.iloc[0]["timestamp"]),
            "total_rows": total_rows,
            "is_processed": is_processed,
            "data_sources": sources,
            "latest_close": round(close_now, 2),
            "change_24h_pct": round(change_24h_pct, 2),
            "high_24h": round(float(window_24["high"].max()), 2),
            "low_24h": round(float(window_24["low"].min()), 2),
            "volume_24h": round(float(window_24["volume"].sum()), 4),
            "volatility_12h": float(latest["volatility_12h"]) if "volatility_12h" in df.columns and pd.notna(latest["volatility_12h"]) else None,
            "volatility_24h": float(latest["volatility_24h"]) if "volatility_24h" in df.columns and pd.notna(latest["volatility_24h"]) else None,
            "rsi_14": float(latest["rsi_14"]) if "rsi_14" in df.columns and pd.notna(latest["rsi_14"]) else None,
            "macd": float(latest["macd"]) if "macd" in df.columns and pd.notna(latest["macd"]) else None,
            "macd_signal": float(latest["macd_signal"]) if "macd_signal" in df.columns and pd.notna(latest["macd_signal"]) else None,
            "macd_hist": float(latest["macd_hist"]) if "macd_hist" in df.columns and pd.notna(latest["macd_hist"]) else None,
            "bb_width": float(latest["bb_width"]) if "bb_width" in df.columns and pd.notna(latest["bb_width"]) else None,
            "bb_pct_b": float(latest["bb_pct_b"]) if "bb_pct_b" in df.columns and pd.notna(latest["bb_pct_b"]) else None,
            "momentum_4h": float(latest["momentum_4h"]) if "momentum_4h" in df.columns and pd.notna(latest["momentum_4h"]) else None,
            "momentum_10h": float(latest["momentum_10h"]) if "momentum_10h" in df.columns and pd.notna(latest["momentum_10h"]) else None,
        }

    return {
        "exists": True,
        "count": len(records),
        "total_available": total_rows,
        "records": records,
        "summary": summary,
    }


def get_sentiment_overview_data(
    limit: int = 50,
    offset: int = 0,
    sentiment_filter: str = "all",
    search: str = "",
) -> Dict[str, Any]:
    """Returns hourly sentiment aggregation, summary stats, and scored headlines."""
    hourly_file = PROCESSED_DIR / "hourly_sentiment.csv"
    posts_file = RAW_SOCIAL_DIR / "sample_social_posts.csv"
    cache = load_sentiment_cache()

    hourly_records: List[Dict[str, Any]] = []
    hourly_summary: Dict[str, Any] = {}

    if hourly_file.exists():
        hdf = pd.read_csv(hourly_file)
        hourly_records = df_to_clean_records(hdf)
        if not hdf.empty:
            latest_h = hdf.iloc[-1]
            total_posts = int(hdf["post_count"].sum()) if "post_count" in hdf.columns else 0
            hourly_summary = {
                "latest_timestamp": str(latest_h["timestamp"]),
                "earliest_timestamp": str(hdf.iloc[0]["timestamp"]),
                "hours_covered": len(hdf),
                "total_posts_aggregated": total_posts,
                "latest_avg_sentiment": float(latest_h["avg_sentiment"]),
                "latest_sentiment_shock": float(latest_h["sentiment_shock"]),
                "mean_avg_sentiment": round(float(hdf["avg_sentiment"].mean()), 4),
                "mean_pct_positive": round(float(hdf["pct_positive"].mean()), 4),
                "mean_pct_negative": round(float(hdf["pct_negative"].mean()), 4),
                "mean_pct_neutral": round(float(hdf["pct_neutral"].mean()), 4),
                "max_positive_shock": round(float(hdf["sentiment_shock"].max()), 4),
                "max_negative_shock": round(float(hdf["sentiment_shock"].min()), 4),
            }

    scored_headlines: List[Dict[str, Any]] = []
    data_sources: List[str] = []
    if posts_file.exists():
        pdf = pd.read_csv(posts_file)
        if "data_source" in pdf.columns:
            data_sources = sorted(pdf["data_source"].dropna().unique().tolist())

        # Sort newest first
        pdf = pdf.sort_values("timestamp", ascending=False).reset_index(drop=True)
        for _, row in pdf.iterrows():
            text = str(row.get("text", ""))
            cached = cache.get(_cache_key(text))
            score = float(cached["sentiment_score"]) if cached else None
            label = _classify_sentiment(score) if score is not None else "Unscored"
            scored_headlines.append(
                {
                    "timestamp": str(row.get("timestamp", "")),
                    "text": text,
                    "data_source": str(row.get("data_source", "unknown")),
                    "positive": float(cached["positive"]) if cached else None,
                    "negative": float(cached["negative"]) if cached else None,
                    "neutral": float(cached["neutral"]) if cached else None,
                    "sentiment_score": score,
                    "label": label,
                }
            )

    # Filter headlines
    filtered = scored_headlines
    if sentiment_filter and sentiment_filter.lower() != "all":
        target_label = sentiment_filter.lower()
        filtered = [h for h in filtered if h["label"].lower() == target_label]
    if search.strip():
        q = search.strip().lower()
        filtered = [h for h in filtered if q in h["text"].lower() or q in h["timestamp"].lower()]

    total_filtered = len(filtered)
    paginated = filtered[offset : offset + limit]

    # Headline-level label distribution
    dist = {"bullish": 0, "bearish": 0, "neutral": 0, "unscored": 0}
    for h in scored_headlines:
        key = h["label"].lower()
        if key in dist:
            dist[key] += 1

    return {
        "status": "available" if (hourly_records or scored_headlines) else "unavailable",
        "data_sources": data_sources,
        "hourly_summary": hourly_summary,
        "hourly_series": hourly_records,
        "headline_distribution": dist,
        "total_headlines": len(scored_headlines),
        "filtered_headlines": total_filtered,
        "headlines": paginated,
    }


def get_backtest_full_data(limit: int = 500) -> Dict[str, Any]:
    """Returns full backtest summary, equity curve with drawdown series, and methodology metadata."""
    sum_file = PROCESSED_DIR / "backtest_summary.csv"
    eq_file = PROCESSED_DIR / "backtest_equity_curve.csv"

    summary = df_to_clean_records(pd.read_csv(sum_file))[0] if sum_file.exists() else {}
    equity_records: List[Dict[str, Any]] = []
    time_range: Dict[str, Any] = {}

    if eq_file.exists():
        eq_df = pd.read_csv(eq_file)
        if not eq_df.empty:
            time_range = {
                "start": str(eq_df.iloc[0]["timestamp"]),
                "end": str(eq_df.iloc[-1]["timestamp"]),
                "total_rows": len(eq_df),
            }
            # Compute running drawdown % series honestly from equity curves
            strat_eq = eq_df["strategy_equity"].astype(float).values
            bnh_eq = eq_df["buy_and_hold_equity"].astype(float).values
            strat_peak = np.maximum.accumulate(strat_eq)
            bnh_peak = np.maximum.accumulate(bnh_eq)
            eq_df["strategy_drawdown_pct"] = ((strat_eq - strat_peak) / strat_peak) * 100.0
            eq_df["buy_and_hold_drawdown_pct"] = ((bnh_eq - bnh_peak) / bnh_peak) * 100.0

            sliced = eq_df.tail(max(1, min(limit, 2000)))
            equity_records = df_to_clean_records(sliced)

    return {
        "status": "available" if (summary or equity_records) else "unavailable",
        "summary": summary,
        "equity_curve": equity_records,
        "time_range": time_range,
        "methodology": {
            "sizing_formula": "w_t = clip(sigma_target / sigma_hat_t, 0.20, 1.50)",
            "target_volatility_4h": 0.008,
            "min_weight": 0.20,
            "max_weight": 1.50,
            "transaction_cost_bps": 5.0,
            "initial_capital_usd": 10000.0,
            "periods_per_year": 2190.0,
            "notes": [
                "In run_full_backtest(), target_future_volatility from aligned_features.csv is used as the volatility signal proxy for historical simulation.",
                "Forward 4-hour cumulative return is computed as (Close_{t+4} - Close_t) / Close_t with 5 bps transaction fee applied on absolute weight changes.",
            ],
        },
    }


def get_models_details_data() -> Dict[str, Any]:
    """Returns hyperparameter search artifacts, saved checkpoints, and architecture specs."""
    hp_file = SAVED_MODELS_DIR / "best_hyperparams.json"
    tuning_file = PROCESSED_DIR / "hyperparameter_tuning_results.csv"

    best_hyperparams = json.loads(hp_file.read_text(encoding="utf-8")) if hp_file.exists() else None
    tuning_results = df_to_clean_records(pd.read_csv(tuning_file)) if tuning_file.exists() else []

    checkpoints = {
        "baseline_ridge": _file_meta(SAVED_MODELS_DIR / "baseline_ridge.joblib"),
        "sequence_scaler": _file_meta(SAVED_MODELS_DIR / "sequence_scaler.joblib"),
        "crypto_lstm": _file_meta(SAVED_MODELS_DIR / "best_crypto_lstm.pt"),
        "crypto_gru": _file_meta(SAVED_MODELS_DIR / "best_crypto_gru.pt"),
        "best_hyperparams": _file_meta(hp_file),
    }

    architectures = [
        {
            "name": "Ridge Regressor",
            "family": "Linear Regularized Baseline",
            "checkpoint_key": "baseline_ridge",
            "input_representation": "Single timestep feature vector (18 multimodal features), StandardScaler fit on train split",
            "configuration": "L2 alpha = 1.0, random_state = 42, non-negativity clip max(0, y_hat)",
            "loss_function": "L2 Squared Error + Ridge Penalty",
            "evaluation_split": "Chronological 70% Train / 15% Val / 15% Test (last timestep of test sequences)",
        },
        {
            "name": "CryptoGRU",
            "family": "PyTorch Gated Recurrent Unit",
            "checkpoint_key": "crypto_gru",
            "input_representation": "Sliding sequence window (seq_len = 12 hours, 18 features)",
            "configuration": "2 stacked GRU layers, hidden_size = 64, dropout = 0.2, Linear(64->32)->ReLU->Dropout->Linear(32->1)->Softplus + 1e-6",
            "loss_function": "MSE / QLIKE (AdamW lr=2e-3, weight_decay=1e-4, ReduceLROnPlateau, grad clip=1.0)",
            "evaluation_split": "Chronological 70% Train / 15% Val / 15% Test",
        },
        {
            "name": "CryptoLSTM",
            "family": "PyTorch Long Short-Term Memory",
            "checkpoint_key": "crypto_lstm",
            "input_representation": "Sliding sequence window (seq_len = 12 hours, 18 features)",
            "configuration": "2 stacked LSTM layers, hidden_size = 64, dropout = 0.2, Linear(64->32)->ReLU->Dropout->Linear(32->1)->Softplus + 1e-6",
            "loss_function": "MSE / QLIKE (AdamW lr=2e-3, weight_decay=1e-4, ReduceLROnPlateau, grad clip=1.0)",
            "evaluation_split": "Chronological 70% Train / 15% Val / 15% Test",
        },
        {
            "name": "Naive Persistence (24h Vol)",
            "family": "Econometric Benchmark",
            "checkpoint_key": None,
            "input_representation": "Unscaled rolling 24-hour realized volatility at time t",
            "configuration": "y_hat_{t+1..t+4} = sigma_{24h, t} (zero parameters)",
            "loss_function": "N/A (non-parametric persistence)",
            "evaluation_split": "Chronological 15% Held-Out Test Slice",
        },
    ]

    return {
        "checkpoints": checkpoints,
        "best_hyperparams": best_hyperparams,
        "tuning_results": tuning_results,
        "architectures": architectures,
        "split_protocol": {
            "benchmark_split": "70% Train / 15% Validation / 15% Held-Out Test (strictly chronological)",
            "ablation_split": "80% Train / 20% Held-Out Test (Ridge Regressor, chronological)",
            "target_definition": "sqrt(sum_{k=1..4} r_{t+k}^2) where r is 1h log return",
            "qlike_formula": "(y / y_hat) - ln(y / y_hat) - 1",
        },
    }


def list_datasets_metadata() -> List[Dict[str, Any]]:
    """Inspects all registered CSV datasets and returns schema, missingness, and range metadata."""
    results: List[Dict[str, Any]] = []
    for ds_id, info in DATASET_REGISTRY.items():
        path: Path = info["path"]
        meta = _file_meta(path)
        entry: Dict[str, Any] = {
            "id": ds_id,
            "name": info["name"],
            "category": info["category"],
            "description": info["description"],
            "relative_path": str(path.relative_to(PROJECT_ROOT)).replace("\\", "/"),
            **meta,
            "row_count": 0,
            "column_count": 0,
            "missing_cells": 0,
            "columns": [],
            "time_range": None,
            "data_sources": [],
        }
        if meta["exists"]:
            try:
                df = pd.read_csv(path)
                entry["row_count"] = len(df)
                entry["column_count"] = len(df.columns)
                entry["missing_cells"] = int(df.isnull().sum().sum())
                entry["columns"] = [
                    {
                        "name": col,
                        "dtype": str(df[col].dtype),
                        "missing": int(df[col].isnull().sum()),
                    }
                    for col in df.columns
                ]
                if "timestamp" in df.columns and not df.empty:
                    entry["time_range"] = {
                        "start": str(df["timestamp"].iloc[0]),
                        "end": str(df["timestamp"].iloc[-1]),
                    }
                if "data_source" in df.columns:
                    entry["data_sources"] = sorted(df["data_source"].dropna().unique().tolist())
            except Exception as err:
                entry["error"] = str(err)
        results.append(entry)
    return results


def preview_dataset(
    dataset_id: str,
    page: int = 1,
    page_size: int = 25,
    search: str = "",
    sort_by: str = "",
    sort_dir: str = "desc",
) -> Dict[str, Any]:
    """Returns paginated, searchable, sortable rows for a registered dataset."""
    if dataset_id not in DATASET_REGISTRY:
        raise KeyError(f"Unknown dataset '{dataset_id}'")
    path: Path = DATASET_REGISTRY[dataset_id]["path"]
    if not path.exists():
        raise FileNotFoundError(f"Dataset file not found: {path}")

    df = pd.read_csv(path)
    total_rows = len(df)

    if search.strip():
        q = search.strip().lower()
        mask = df.astype(str).apply(lambda col: col.str.lower().str.contains(q, regex=False)).any(axis=1)
        df = df[mask]

    if sort_by and sort_by in df.columns:
        ascending = sort_dir.lower() == "asc"
        df = df.sort_values(by=sort_by, ascending=ascending, kind="mergesort")
    elif "timestamp" in df.columns:
        df = df.sort_values(by="timestamp", ascending=(sort_dir.lower() == "asc"), kind="mergesort")

    filtered_rows = len(df)
    page = max(1, page)
    page_size = max(1, min(page_size, 100))
    total_pages = max(1, (filtered_rows + page_size - 1) // page_size)
    start_idx = (page - 1) * page_size
    page_df = df.iloc[start_idx : start_idx + page_size]

    return {
        "dataset_id": dataset_id,
        "columns": df.columns.tolist(),
        "total_rows": total_rows,
        "filtered_rows": filtered_rows,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "rows": df_to_clean_records(page_df),
    }


def get_system_health_data(runtime_state: Dict[str, Any]) -> Dict[str, Any]:
    """Returns genuine backend system, library, model, dataset, and pipeline diagnostics."""
    packages = {}
    for pkg in ["fastapi", "uvicorn", "pandas", "numpy", "torch", "transformers", "sklearn", "joblib", "ccxt", "matplotlib"]:
        packages[pkg] = importlib.util.find_spec(pkg) is not None

    model_files = []
    for fname in [
        "baseline_ridge.joblib",
        "sequence_scaler.joblib",
        "best_crypto_lstm.pt",
        "best_crypto_gru.pt",
        "best_hyperparams.json",
    ]:
        fpath = SAVED_MODELS_DIR / fname
        model_files.append({"name": fname, **_file_meta(fpath)})

    report_files = []
    reports_dir = PROCESSED_DIR / "reports"
    if reports_dir.exists():
        for f in sorted(reports_dir.glob("*.png")):
            report_files.append({"name": f.name, **_file_meta(f)})

    return {
        "api_status": "online",
        "python_version": platform.python_version(),
        "platform": platform.platform(),
        "config": {
            "default_symbol": DEFAULT_SYMBOL,
            "default_timeframe": DEFAULT_TIMEFRAME,
            "default_limit": DEFAULT_LIMIT,
            "volatility_horizon_hours": VOLATILITY_HORIZON_HOURS,
        },
        "runtime": runtime_state,
        "packages": packages,
        "model_artifacts": model_files,
        "datasets": list_datasets_metadata(),
        "report_charts": report_files,
        "endpoints": [
            {"method": "GET", "path": "/api/status", "summary": "System status & active capabilities"},
            {"method": "GET", "path": "/api/market/latest", "summary": "OHLCV candles, technical indicators & 24h summary"},
            {"method": "GET", "path": "/api/predict/volatility", "summary": "Next-4h realized volatility forecast"},
            {"method": "GET", "path": "/api/forecast/series", "summary": "Historical vs predicted volatility & price series"},
            {"method": "GET", "path": "/api/sentiment/overview", "summary": "Hourly FinBERT aggregation & scored headlines"},
            {"method": "POST", "path": "/api/sentiment/analyze", "summary": "On-demand FinBERT headline scoring"},
            {"method": "GET", "path": "/api/benchmark", "summary": "Held-out 15% test split model benchmark"},
            {"method": "GET", "path": "/api/ablation", "summary": "Multimodal ablation & permutation importance"},
            {"method": "GET", "path": "/api/models/details", "summary": "Architectures, checkpoints & hyperparameter trials"},
            {"method": "GET", "path": "/api/backtest", "summary": "Volatility-targeting backtest summary & equity curve"},
            {"method": "GET", "path": "/api/data/datasets", "summary": "Dataset inventory & schema quality metrics"},
            {"method": "GET", "path": "/api/data/preview", "summary": "Paginated, searchable dataset table preview"},
            {"method": "GET", "path": "/api/data/export", "summary": "CSV download for registered datasets"},
            {"method": "GET", "path": "/api/system/health", "summary": "Runtime environment & artifact health diagnostics"},
            {"method": "GET", "path": "/api/report", "summary": "Academic capstone report markdown & figures"},
            {"method": "POST", "path": "/api/pipeline/run", "summary": "Trigger market, NLP & fusion pipeline refresh"},
        ],
    }
