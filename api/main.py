"""FastAPI web server and REST API for Algorithmic Crypto Volatility Forecaster.

Provides RESTful analytical endpoints and serves the React quantitative workstation UI.
"""

from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from api.data_service import (
    DATASET_REGISTRY,
    _cache_key,
    _classify_sentiment,
    df_to_clean_records,
    get_backtest_full_data,
    get_market_overview_data,
    get_models_details_data,
    get_sentiment_overview_data,
    get_system_health_data,
    list_datasets_metadata,
    load_sentiment_cache,
    preview_dataset,
)
from src.utils.config import (
    PROCESSED_DIR,
    PROJECT_ROOT,
    RAW_MARKET_DIR,
    SAVED_MODELS_DIR,
    VOLATILITY_HORIZON_HOURS,
)
from src.utils.logger import get_logger

try:
    import joblib
except ImportError:  # pragma: no cover - optional in lightweight API mode
    joblib = None

try:
    import torch
    from src.models.deep_models import CryptoGRU, CryptoLSTM
except ImportError:  # pragma: no cover - optional in lightweight API mode
    torch = None
    CryptoGRU = None
    CryptoLSTM = None

try:
    from src.models.baseline import CryptoVolatilityForecaster
except ImportError:  # pragma: no cover
    CryptoVolatilityForecaster = None

try:
    from src.nlp.finbert_sentiment import FinBERTSentimentAnalyzer
except ImportError:  # pragma: no cover
    FinBERTSentimentAnalyzer = None

logger = get_logger("APIServer")

FRONTEND_DIST_DIR = PROJECT_ROOT / "frontend" / "dist"

# Global instances loaded on startup
sentiment_analyzer: Optional[Any] = None
forecaster_model: Optional[Any] = None
lstm_model: Optional[Any] = None
gru_model: Optional[Any] = None
seq_scaler_meta: Optional[Dict] = None
last_pipeline_run: Optional[str] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initializes models and resources on server startup."""
    global sentiment_analyzer, forecaster_model, lstm_model, gru_model, seq_scaler_meta
    logger.info("Initializing FinBERT analyzer and forecasting models...")

    if FinBERTSentimentAnalyzer is not None:
        try:
            sentiment_analyzer = FinBERTSentimentAnalyzer(enable_cache=True)
        except Exception as e:
            logger.warning("Could not initialize FinBERT analyzer: %s", str(e))

    # Load Ridge baseline
    model_path = SAVED_MODELS_DIR / "baseline_ridge.joblib"
    if model_path.exists() and CryptoVolatilityForecaster is not None:
        try:
            forecaster_model = CryptoVolatilityForecaster.load(model_path)
            logger.info("Forecaster Ridge model loaded successfully.")
        except Exception as e:
            logger.warning("Failed to load baseline model: %s", str(e))

    # Load sequence scaler and PyTorch models
    scaler_path = SAVED_MODELS_DIR / "sequence_scaler.joblib"
    if scaler_path.exists() and joblib is not None:
        try:
            seq_scaler_meta = joblib.load(scaler_path)
            in_dim = len(seq_scaler_meta["feature_cols"])

            if torch is not None and CryptoLSTM is not None:
                lstm_path = SAVED_MODELS_DIR / "best_crypto_lstm.pt"
                if lstm_path.exists():
                    lstm_model = CryptoLSTM(input_size=in_dim, hidden_size=64, num_layers=2)
                    ckpt = torch.load(lstm_path, map_location="cpu")
                    lstm_model.load_state_dict(ckpt["model_state_dict"])
                    lstm_model.eval()
                    logger.info("Loaded PyTorch CryptoLSTM model.")

            if torch is not None and CryptoGRU is not None:
                gru_path = SAVED_MODELS_DIR / "best_crypto_gru.pt"
                if gru_path.exists():
                    gru_model = CryptoGRU(input_size=in_dim, hidden_size=64, num_layers=2)
                    ckpt = torch.load(gru_path, map_location="cpu")
                    gru_model.load_state_dict(ckpt["model_state_dict"])
                    gru_model.eval()
                    logger.info("Loaded PyTorch CryptoGRU model.")
        except Exception as e:
            logger.warning("Error loading deep models: %s", str(e))

    yield


app = FastAPI(
    title="Algorithmic Crypto Volatility Forecaster API",
    description="Combines OHLCV market indicators with FinBERT NLP sentiment to forecast short-term BTC/USDT volatility.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class HeadlineRequest(BaseModel):
    text: str


class PipelineRunRequest(BaseModel):
    symbol: str = "BTC/USDT"
    timeframe: str = "1h"
    limit: int = 100


def _available_models_map() -> Dict[str, bool]:
    return {
        "gru": gru_model is not None,
        "lstm": lstm_model is not None,
        "ridge": forecaster_model is not None and bool(getattr(forecaster_model, "is_trained", False)),
        "persistence": True,
    }


def _predict_row_volatility(df: pd.DataFrame, model: str = "gru") -> Dict[str, Any]:
    """Predicts next-4h volatility from the latest row/sequence in aligned_features."""
    latest_row = df.iloc[-1]
    hist_vol = float(latest_row.get("volatility_24h", 0.0))
    hist_vol_12h = float(latest_row.get("volatility_12h", 0.0))
    current_price = float(latest_row.get("close", 0.0))

    selected_model_name = model.lower()
    forecast_val: Optional[float] = None
    active_model = ""
    fallback_used = False

    if selected_model_name in ("gru", "lstm") and seq_scaler_meta is not None and torch is not None:
        seq_len = seq_scaler_meta.get("seq_len", 12)
        feature_cols = seq_scaler_meta.get("feature_cols", [])
        if len(df) >= seq_len and all(c in df.columns for c in feature_cols):
            seq_window = df[feature_cols].tail(seq_len).values
            scaler = seq_scaler_meta["scaler"]
            seq_scaled = scaler.transform(seq_window)
            tensor_in = torch.tensor(seq_scaled.reshape(1, seq_len, -1), dtype=torch.float32)

            with torch.no_grad():
                if selected_model_name == "gru" and gru_model is not None:
                    forecast_val = float(gru_model(tensor_in).cpu().numpy().flatten()[0])
                    active_model = "CryptoGRU (Deep Learning)"
                elif selected_model_name == "lstm" and lstm_model is not None:
                    forecast_val = float(lstm_model(tensor_in).cpu().numpy().flatten()[0])
                    active_model = "CryptoLSTM (Deep Learning)"

    if forecast_val is None:
        if selected_model_name in ("gru", "lstm"):
            fallback_used = True
        feature_cols = (
            forecaster_model.feature_cols
            if (forecaster_model is not None and getattr(forecaster_model, "is_trained", False))
            else seq_scaler_meta.get("feature_cols", [])
            if seq_scaler_meta
            else []
        )
        if (
            forecaster_model is not None
            and getattr(forecaster_model, "is_trained", False)
            and feature_cols
            and all(c in df.columns for c in feature_cols)
        ):
            feat_vals = np.array([float(latest_row[col]) for col in feature_cols]).reshape(1, -1)
            forecast_val = float(forecaster_model.predict(feat_vals))
            active_model = "Ridge Regressor (Baseline)"
        else:
            if selected_model_name == "ridge":
                fallback_used = True
            forecast_val = hist_vol
            active_model = "Historical Rolling Persistence"

    forecast_val = max(0.0, float(forecast_val))
    regime = (
        "High Volatility"
        if forecast_val > 0.015
        else "Moderate Volatility"
        if forecast_val > 0.006
        else "Low / Compression"
    )

    return {
        "timestamp": str(latest_row.get("timestamp", "")),
        "model_requested": selected_model_name,
        "model_used": active_model,
        "fallback_used": fallback_used,
        "available_models": _available_models_map(),
        "horizon_hours": VOLATILITY_HORIZON_HOURS,
        "current_price": current_price,
        "historical_24h_volatility": round(hist_vol, 6),
        "historical_12h_volatility": round(hist_vol_12h, 6),
        "forecast_next_4h_volatility": round(forecast_val, 6),
        "volatility_regime": regime,
        "latest_sentiment_score": float(latest_row.get("avg_sentiment", 0.0)),
        "rsi_14": float(latest_row.get("rsi_14", 50.0)),
        "latest_features": {
            col: (None if pd.isna(latest_row[col]) else (str(latest_row[col]) if isinstance(latest_row[col], str) else float(latest_row[col])))
            for col in df.columns
            if col != "timestamp" and col != "data_source"
        },
        "data_source": str(latest_row.get("data_source", "unknown")),
    }


@app.get("/api/status")
def get_system_status() -> Dict:
    """Returns system status, active models, and dataset shapes."""
    aligned_file = PROCESSED_DIR / "aligned_features.csv"
    market_file = PROCESSED_DIR / "market_features.csv"
    aligned_rows = 0
    market_rows = 0
    latest_timestamp = None
    data_source = None

    if aligned_file.exists():
        try:
            adf = pd.read_csv(aligned_file)
            aligned_rows = len(adf)
            if not adf.empty:
                latest_timestamp = str(adf.iloc[-1].get("timestamp", ""))
                data_source = str(adf.iloc[-1].get("data_source", ""))
        except Exception:
            pass

    if market_file.exists():
        try:
            mdf = pd.read_csv(market_file)
            market_rows = len(mdf)
            if latest_timestamp is None and not mdf.empty:
                latest_timestamp = str(mdf.iloc[-1].get("timestamp", ""))
                data_source = str(mdf.iloc[-1].get("data_source", ""))
        except Exception:
            pass

    return {
        "status": "online",
        "model_loaded": forecaster_model is not None and bool(getattr(forecaster_model, "is_trained", False)),
        "available_models": _available_models_map(),
        "finbert_active": sentiment_analyzer is not None,
        "finbert_fallback": bool(getattr(sentiment_analyzer, "is_fallback", False)) if sentiment_analyzer else False,
        "aligned_dataset_rows": aligned_rows,
        "market_dataset_rows": market_rows,
        "latest_timestamp": latest_timestamp,
        "data_source": data_source,
        "last_pipeline_run": last_pipeline_run,
        "exchange": "Binance CCXT",
        "trading_pair": "BTC/USDT",
        "timeframe": "1h",
        "forecast_horizon": "4 hours",
    }


@app.get("/api/market/latest")
def get_latest_market_data(limit: int = Query(default=100, ge=1, le=1000)) -> Dict:
    """Returns recent market candles, technical features, and 24h summary."""
    data = get_market_overview_data(limit=limit)
    if not data["exists"]:
        raise HTTPException(status_code=404, detail="Market data not found. Run pipeline first.")
    return {
        "count": data["count"],
        "total_available": data["total_available"],
        "summary": data["summary"],
        "records": data["records"],
    }


@app.post("/api/sentiment/analyze")
def analyze_headline(req: HeadlineRequest) -> Dict:
    """Performs real-time FinBERT sentiment analysis on input text (with cache fallback)."""
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    global sentiment_analyzer
    if sentiment_analyzer is None and FinBERTSentimentAnalyzer is not None:
        try:
            sentiment_analyzer = FinBERTSentimentAnalyzer()
        except Exception as e:
            logger.warning("Failed to lazy-load FinBERT: %s", str(e))

    if sentiment_analyzer is not None:
        result = sentiment_analyzer.predict_single(text)
        source_mode = "rule_fallback" if getattr(sentiment_analyzer, "is_fallback", False) else "finbert"
    else:
        cache = load_sentiment_cache()
        cached = cache.get(_cache_key(text))
        if cached is None:
            raise HTTPException(
                status_code=503,
                detail="FinBERT runtime dependencies (torch/transformers) are not installed in this environment, and the input text is not in the local sentiment cache.",
            )
        result = cached
        source_mode = "cache"

    score = float(result["sentiment_score"])
    return {
        "text": text,
        "source_mode": source_mode,
        "probabilities": {
            "positive": float(result["positive"]),
            "negative": float(result["negative"]),
            "neutral": float(result["neutral"]),
        },
        "sentiment_score": score,
        "label": (
            "Bullish (Positive)"
            if score > 0.15
            else "Bearish (Negative)"
            if score < -0.15
            else "Neutral"
        ),
    }


@app.get("/api/sentiment/overview")
def get_sentiment_overview(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    sentiment: str = Query(default="all"),
    search: str = Query(default=""),
) -> Dict:
    """Returns hourly FinBERT sentiment time series and scored headline records."""
    return get_sentiment_overview_data(
        limit=limit,
        offset=offset,
        sentiment_filter=sentiment,
        search=search,
    )


@app.get("/api/predict/volatility")
def predict_current_volatility(model: str = "gru") -> Dict:
    """Forecasts next-4-hour realized volatility using latest aligned features."""
    aligned_file = PROCESSED_DIR / "aligned_features.csv"
    if not aligned_file.exists():
        raise HTTPException(status_code=404, detail="Aligned feature dataset not found.")

    df = pd.read_csv(aligned_file)
    if df.empty:
        raise HTTPException(status_code=400, detail="Aligned feature dataset is empty.")

    return _predict_row_volatility(df, model=model)


@app.get("/api/forecast/series")
def get_forecast_series(
    limit: int = Query(default=72, ge=1, le=500),
    model: str = Query(default="gru"),
) -> Dict:
    """Returns aligned historical volatility, 4h target volatility, and model predictions."""
    aligned_file = PROCESSED_DIR / "aligned_features.csv"
    if not aligned_file.exists():
        raise HTTPException(status_code=404, detail="Aligned feature dataset not found.")

    df = pd.read_csv(aligned_file)
    if df.empty:
        return {"records": [], "total_available": 0, "prediction_available": False}

    n_total = len(df)
    train_end = int(n_total * 0.70)
    val_end = int(n_total * 0.85)

    splits = []
    for idx in range(n_total):
        if idx < train_end:
            splits.append("train")
        elif idx < val_end:
            splits.append("val")
        else:
            splits.append("test")
    df["split"] = splits

    # Generate historical model predictions if a trained model is loaded
    pred_col = [None] * n_total
    pred_model_used = None
    selected = model.lower()

    if selected in ("gru", "lstm") and seq_scaler_meta is not None and torch is not None:
        net = gru_model if selected == "gru" else lstm_model
        if net is not None:
            seq_len = seq_scaler_meta.get("seq_len", 12)
            feature_cols = seq_scaler_meta.get("feature_cols", [])
            if all(c in df.columns for c in feature_cols) and n_total >= seq_len:
                scaled = seq_scaler_meta["scaler"].transform(df[feature_cols].values)
                with torch.no_grad():
                    for idx in range(seq_len - 1, n_total):
                        win = scaled[idx - seq_len + 1 : idx + 1]
                        t_in = torch.tensor(win.reshape(1, seq_len, -1), dtype=torch.float32)
                        pred_col[idx] = round(max(0.0, float(net(t_in).cpu().numpy().flatten()[0])), 6)
                pred_model_used = f"Crypto{selected.upper()}"

    if pred_model_used is None and forecaster_model is not None and getattr(forecaster_model, "is_trained", False):
        f_cols = forecaster_model.feature_cols
        if all(c in df.columns for c in f_cols):
            for idx in range(n_total):
                vec = df.iloc[idx][f_cols].values.astype(float).reshape(1, -1)
                pred_col[idx] = round(float(forecaster_model.predict(vec)), 6)
            pred_model_used = "Ridge Regressor"

    df["predicted_volatility"] = pred_col
    cols_to_keep = [
        "timestamp",
        "close",
        "log_return",
        "volatility_12h",
        "volatility_24h",
        "target_future_volatility",
        "predicted_volatility",
        "avg_sentiment",
        "sentiment_shock",
        "split",
    ]
    available_cols = [c for c in cols_to_keep if c in df.columns]
    sliced = df[available_cols].tail(limit)
    current_forecast = _predict_row_volatility(df, model=model)

    return {
        "total_available": n_total,
        "count": len(sliced),
        "prediction_model_used": pred_model_used,
        "horizon_hours": VOLATILITY_HORIZON_HOURS,
        "target_formula": "sqrt(sum_{k=1..4} r_{t+k}^2)",
        "current_forecast": current_forecast,
        "records": df_to_clean_records(sliced),
    }


@app.get("/api/benchmark")
def get_model_benchmarks() -> Dict:
    """Returns test set evaluation metrics across all trained models."""
    bench_file = PROCESSED_DIR / "model_benchmark_results.csv"
    if not bench_file.exists():
        return {"status": "pending", "split_info": "Held-Out 15% Test Split", "records": []}
    df = pd.read_csv(bench_file)
    return {
        "status": "available",
        "split_info": "Held-Out 15% Test Split (70% Train / 15% Val / 15% Test)",
        "records": df_to_clean_records(df),
    }


@app.get("/api/ablation")
def get_ablation_results() -> Dict:
    """Returns multimodal ablation study results and feature importance ranking."""
    abl_file = PROCESSED_DIR / "ablation_study_results.csv"
    imp_file = PROCESSED_DIR / "feature_importance.csv"
    abl_records = df_to_clean_records(pd.read_csv(abl_file)) if abl_file.exists() else []
    imp_records = df_to_clean_records(pd.read_csv(imp_file)) if imp_file.exists() else []
    return {
        "status": "available",
        "split_info": "Chronological 80/20 Split (Ridge Regressor)",
        "ablation": abl_records,
        "feature_importance": imp_records,
    }


@app.get("/api/models/details")
def get_models_details() -> Dict:
    """Returns model architectures, checkpoint availability, and hyperparameter tuning logs."""
    return get_models_details_data()


@app.get("/api/backtest")
def get_backtest_results(limit: int = Query(default=500, ge=1, le=2000)) -> Dict:
    """Returns volatility targeting portfolio backtest metrics and full equity curve."""
    return get_backtest_full_data(limit=limit)


@app.get("/api/data/datasets")
def get_datasets_inventory() -> Dict:
    """Lists all datasets with schema, row counts, missingness, and time ranges."""
    return {"datasets": list_datasets_metadata()}


@app.get("/api/data/preview")
def get_dataset_preview(
    dataset: str = Query(default="aligned_features"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    search: str = Query(default=""),
    sort_by: str = Query(default=""),
    sort_dir: str = Query(default="desc"),
) -> Dict:
    """Returns paginated, searchable rows from a registered dataset."""
    try:
        return preview_dataset(
            dataset_id=dataset,
            page=page,
            page_size=page_size,
            search=search,
            sort_by=sort_by,
            sort_dir=sort_dir,
        )
    except KeyError as err:
        raise HTTPException(status_code=404, detail=str(err))
    except FileNotFoundError as err:
        raise HTTPException(status_code=404, detail=str(err))


@app.get("/api/data/export")
def export_dataset_csv(dataset: str = Query(default="aligned_features")):
    """Streams a registered dataset as a CSV file download."""
    if dataset not in DATASET_REGISTRY:
        raise HTTPException(status_code=404, detail=f"Unknown dataset '{dataset}'")
    path: Path = DATASET_REGISTRY[dataset]["path"]
    if not path.exists():
        raise HTTPException(status_code=404, detail="Dataset file does not exist.")
    return FileResponse(path, media_type="text/csv", filename=path.name)


@app.get("/api/system/health")
def get_system_health() -> Dict:
    """Returns genuine backend diagnostics, package availability, and artifact health."""
    runtime_state = {
        "available_models": _available_models_map(),
        "finbert_active": sentiment_analyzer is not None,
        "finbert_fallback": bool(getattr(sentiment_analyzer, "is_fallback", False)) if sentiment_analyzer else False,
        "last_pipeline_run": last_pipeline_run,
    }
    return get_system_health_data(runtime_state)


@app.get("/api/report")
def get_academic_report() -> Dict:
    """Returns the compiled final academic capstone project report and figure metadata."""
    report_file = PROJECT_ROOT / "FINAL_PROJECT_REPORT.md"
    if not report_file.exists():
        from src.utils.report_generator import compile_academic_report

        compile_academic_report()

    report_text = report_file.read_text(encoding="utf-8") if report_file.exists() else ""
    reports_dir = PROCESSED_DIR / "reports"
    available_charts = [f.name for f in reports_dir.glob("*.png")] if reports_dir.exists() else []

    return {
        "status": "available" if report_file.exists() else "not_generated",
        "report_path": str(report_file),
        "available_charts": available_charts,
        "content_markdown": report_text,
    }


@app.get("/api/report/charts/{chart_name}")
def get_report_chart(chart_name: str):
    """Serves high-resolution figures generated for the academic report."""
    reports_dir = PROCESSED_DIR / "reports"
    chart_path = reports_dir / chart_name
    if not chart_path.exists() or not chart_name.endswith(".png"):
        raise HTTPException(status_code=404, detail="Chart not found.")
    return FileResponse(chart_path, media_type="image/png")


@app.post("/api/pipeline/run")
def trigger_pipeline_refresh(req: PipelineRunRequest) -> Dict:
    """Refreshes market data, FinBERT sentiment, and feature fusion."""
    global sentiment_analyzer, forecaster_model, last_pipeline_run
    try:
        from src.data.market_data import fetch_market_data
        from src.features.feature_fusion import fuse_market_and_sentiment_features
        from src.features.market_features import compute_market_features
        from src.nlp.sentiment_aggregation import aggregate_hourly_sentiment, generate_sample_social_posts
    except ImportError as err:
        raise HTTPException(
            status_code=503,
            detail=f"Pipeline refresh requires ML/data dependencies not installed in this environment: {err}",
        )

    try:
        raw_df = fetch_market_data(symbol=req.symbol, timeframe=req.timeframe, limit=req.limit)
        features_df = compute_market_features(raw_df)

        if sentiment_analyzer is None and FinBERTSentimentAnalyzer is not None:
            sentiment_analyzer = FinBERTSentimentAnalyzer()
        if sentiment_analyzer is None:
            raise HTTPException(
                status_code=503,
                detail="FinBERT sentiment analyzer is unavailable in this environment.",
            )

        posts_df = generate_sample_social_posts()
        scored_posts = sentiment_analyzer.analyze_dataframe(posts_df, text_col="text")
        hourly_sentiment = aggregate_hourly_sentiment(scored_posts)

        aligned_df = fuse_market_and_sentiment_features(
            df_market=features_df,
            df_sentiment=hourly_sentiment,
        )

        if forecaster_model is None or not getattr(forecaster_model, "is_trained", False):
            from src.models.baseline import train_and_save_baseline

            forecaster_model, _ = train_and_save_baseline()

        from datetime import datetime, timezone

        last_pipeline_run = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        return {
            "success": True,
            "timestamp": last_pipeline_run,
            "candles_fetched": len(raw_df),
            "market_features_rows": len(features_df),
            "sentiment_periods": len(hourly_sentiment),
            "aligned_features_shape": list(aligned_df.shape),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Mount built frontend assets if available
if (FRONTEND_DIST_DIR / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST_DIR / "assets")), name="assets")


def _serve_spa_index():
    index_file = FRONTEND_DIST_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file, media_type="text/html")
    return HTMLResponse(
        content=(
            "<!doctype html><html><body style='background:#0b0d12;color:#e5e7eb;font-family:sans-serif;padding:40px;'>"
            "<h2>Frontend build not found</h2>"
            "<p>Run <code>cd frontend && npm install && npm run build</code> to compile the UI.</p>"
            "</body></html>"
        ),
        status_code=200,
    )


@app.get("/", response_class=HTMLResponse)
def serve_root():
    """Serves the React SPA entrypoint."""
    return _serve_spa_index()


@app.get("/{full_path:path}", response_class=HTMLResponse)
def serve_spa_routes(full_path: str):
    """SPA fallback for client-side routes while keeping API/docs paths 404 if unknown."""
    if full_path.startswith(("api/", "docs", "redoc", "openapi.json")):
        raise HTTPException(status_code=404, detail="Endpoint not found.")
    candidate = FRONTEND_DIST_DIR / full_path
    if candidate.is_file():
        return FileResponse(candidate)
    return _serve_spa_index()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("api.main:app", host="127.0.0.1", port=8000, reload=False)
