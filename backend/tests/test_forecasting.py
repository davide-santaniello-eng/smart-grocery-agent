"""Unit tests for the TSB consumption forecasting engine."""

from datetime import date, timedelta
from backend.app.forecasting.engine import TSBConsumptionForecaster
from backend.app.forecasting.schemas import DailyConsumptionEvent, ForecastInput


def test_regular_milk_consumption():
    """Test realistic milk consumption: 500ml consumed every 2 days."""
    forecaster = TSBConsumptionForecaster(alpha=0.2, beta=0.2)
    base_date = date(2026, 11, 1)

    history = [
        DailyConsumptionEvent(event_date=base_date + timedelta(days=0), quantity=500),
        DailyConsumptionEvent(event_date=base_date + timedelta(days=2), quantity=500),
        DailyConsumptionEvent(event_date=base_date + timedelta(days=4), quantity=500),
        DailyConsumptionEvent(event_date=base_date + timedelta(days=6), quantity=500),
        DailyConsumptionEvent(event_date=base_date + timedelta(days=8), quantity=500),
    ]

    req = ForecastInput(
        product_id="latte_1",
        product_name="Latte UHT",
        base_unit="ml",
        current_stock=2000.0,
        lead_time_days=2,
        reference_date=base_date + timedelta(days=8),
        consumption_history=history,
    )

    result = forecaster.forecast(req)

    # 500ml every 2 days is approx 250ml/day
    assert 180 <= result.daily_avg_consumption <= 320
    assert result.status == "SUFFICIENT_STOCK"
    assert result.safety_stock > 0
    # With 2000ml in stock and ~250ml/day, depletion should be around 7-10 days
    assert 6 <= result.days_until_depletion <= 12
    assert result.confidence_score >= 0.7


def test_reorder_trigger_when_stock_low():
    """When stock falls below the calculated reorder point, flag REORDER_NOW."""
    forecaster = TSBConsumptionForecaster()
    base_date = date(2026, 11, 1)

    history = [
        DailyConsumptionEvent(event_date=base_date + timedelta(days=0), quantity=300),
        DailyConsumptionEvent(event_date=base_date + timedelta(days=3), quantity=300),
        DailyConsumptionEvent(event_date=base_date + timedelta(days=6), quantity=300),
    ]

    req = ForecastInput(
        product_id="pasta_1",
        product_name="Pasta Spaghetti",
        base_unit="g",
        current_stock=100.0,  # Only 100g left!
        lead_time_days=2,
        reference_date=base_date + timedelta(days=6),
        consumption_history=history,
    )

    result = forecaster.forecast(req)

    assert result.status == "REORDER_NOW"
    assert result.suggested_reorder_date == base_date + timedelta(days=6)
    assert result.days_until_reorder == 0.0


def test_depleted_stock_alert():
    """When stock is 0, status must be DEPLETED."""
    forecaster = TSBConsumptionForecaster()
    base_date = date(2026, 11, 1)

    history = [
        DailyConsumptionEvent(event_date=base_date, quantity=250),
        DailyConsumptionEvent(event_date=base_date + timedelta(days=2), quantity=250),
    ]

    req = ForecastInput(
        product_id="caffe_1",
        product_name="Caffè Lavazza",
        base_unit="g",
        current_stock=0.0,
        lead_time_days=1,
        reference_date=base_date + timedelta(days=2),
        consumption_history=history,
    )

    result = forecaster.forecast(req)
    assert result.status == "DEPLETED"


def test_insufficient_data_handled_gracefully():
    """With empty or single-point history, do not crash and report INSUFFICIENT_DATA."""
    forecaster = TSBConsumptionForecaster()

    req = ForecastInput(
        product_id="item_new",
        product_name="Prodotto Nuovo",
        base_unit="unit",
        current_stock=5.0,
        consumption_history=[],
    )

    result = forecaster.forecast(req)
    assert result.status == "INSUFFICIENT_DATA"
    assert result.confidence_score == 0.0
    assert result.daily_avg_consumption == 0.0
