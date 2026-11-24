"""Integration tests for FastAPI REST endpoints."""

from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)


def test_api_status_endpoint():
    response = client.get("/api/status")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert data["trading_pair"] == "BTC/USDT"
    assert data["forecast_horizon"] == "4 hours"
    assert "available_models" in data


def test_api_report_endpoint():
    response = client.get("/api/report")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "available_charts" in data
    assert "content_markdown" in data
    assert len(data["content_markdown"]) > 0


def test_api_benchmark_endpoint():
    response = client.get("/api/benchmark")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "records" in data


def test_api_ablation_endpoint():
    response = client.get("/api/ablation")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "ablation" in data
    assert "feature_importance" in data


def test_api_backtest_endpoint():
    response = client.get("/api/backtest")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "summary" in data
    assert "equity_curve" in data
    assert len(data["equity_curve"]) > 30


def test_api_predict_volatility():
    response = client.get("/api/predict/volatility")
    assert response.status_code == 200
    data = response.json()
    assert "forecast_next_4h_volatility" in data
    assert "volatility_regime" in data
    assert data["forecast_next_4h_volatility"] >= 0.0


def test_api_forecast_series():
    response = client.get("/api/forecast/series?limit=48&model=gru")
    assert response.status_code == 200
    data = response.json()
    assert "records" in data
    assert "current_forecast" in data
    assert data["horizon_hours"] == 4


def test_api_sentiment_overview():
    response = client.get("/api/sentiment/overview?limit=10")
    assert response.status_code == 200
    data = response.json()
    assert "hourly_series" in data
    assert "headlines" in data
    assert len(data["headlines"]) <= 10


def test_api_models_details():
    response = client.get("/api/models/details")
    assert response.status_code == 200
    data = response.json()
    assert "architectures" in data
    assert "checkpoints" in data


def test_api_data_explorer_and_system():
    inv = client.get("/api/data/datasets")
    assert inv.status_code == 200
    assert len(inv.json()["datasets"]) >= 5

    prev = client.get("/api/data/preview?dataset=aligned_features&page=1&page_size=10")
    assert prev.status_code == 200
    assert len(prev.json()["rows"]) == 10

    health = client.get("/api/system/health")
    assert health.status_code == 200
    assert health.json()["api_status"] == "online"
