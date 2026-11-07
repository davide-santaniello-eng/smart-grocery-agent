from datetime import date, timedelta
import pytest

from backend.app.analytics.price_intelligence import (
    DiscountClassification,
    PriceIntelligenceEngine,
    PricePoint,
)


def test_genuine_discount_detection():
    today = date(2026, 11, 7)
    # Price was 1.49 EUR for the past 30 days
    history = [
        PricePoint(date=today - timedelta(days=25), price=1.49),
        PricePoint(date=today - timedelta(days=15), price=1.49),
        PricePoint(date=today - timedelta(days=5), price=1.49),
    ]

    # Flyer offers Barilla at 0.99 EUR with claimed ref 1.49 EUR
    result = PriceIntelligenceEngine.evaluate_discount(
        history=history,
        promo_price=0.99,
        claimed_ref_price=1.49,
        evaluation_date=today,
    )

    assert result.classification == DiscountClassification.GENUINE_DISCOUNT
    assert result.is_genuine_bargain is True
    assert result.omnibus_baseline_30d == 1.49
    assert result.real_discount_pct > 30.0
    assert result.fake_markup_amount == 0.0


def test_omnibus_violation_fake_markup():
    today = date(2026, 11, 7)
    # Actual price in past 30 days was 1.20 EUR
    history = [
        PricePoint(date=today - timedelta(days=20), price=1.20),
        PricePoint(date=today - timedelta(days=10), price=1.20),
        PricePoint(date=today - timedelta(days=3), price=1.20),
    ]

    # Store claims "Was 1.80 EUR, Now only 1.15 EUR (36% off!)"
    result = PriceIntelligenceEngine.evaluate_discount(
        history=history,
        promo_price=1.15,
        claimed_ref_price=1.80,
        evaluation_date=today,
    )

    assert result.classification == DiscountClassification.OMNIBUS_VIOLATION
    assert result.omnibus_baseline_30d == 1.20
    assert result.fake_markup_amount == 0.60
    assert result.claimed_discount_pct == 36.1
    assert result.real_discount_pct == 4.2  # Real saving is only 4.2%, not 36%!


def test_negative_discount_detection():
    today = date(2026, 11, 7)
    # Was 1.00 EUR last week, but 1.30 EUR 25 days ago
    history = [
        PricePoint(date=today - timedelta(days=25), price=1.30),
        PricePoint(date=today - timedelta(days=5), price=1.00),
    ]

    # Store claims "Special Promo: 1.10 EUR!"
    result = PriceIntelligenceEngine.evaluate_discount(
        history=history,
        promo_price=1.10,
        claimed_ref_price=1.30,
        evaluation_date=today,
    )

    assert result.classification == DiscountClassification.NEGATIVE_DISCOUNT
    assert result.is_genuine_bargain is False


def test_stockpile_recommendation():
    today = date(2026, 11, 7)
    history = [PricePoint(date=today - timedelta(days=10), price=11.50)]

    # Genuine bargain: EVO Oil at 6.90 EUR instead of 11.50 EUR
    eval_res = PriceIntelligenceEngine.evaluate_discount(
        history=history,
        promo_price=6.90,
        claimed_ref_price=11.50,
        evaluation_date=today,
    )

    # Family consumes 30 ml of oil per day, package is 1000 ml
    rec = PriceIntelligenceEngine.calculate_stockpile(
        evaluation=eval_res,
        daily_consumption=30.0,
        package_base_qty=1000.0,
        shelf_life_days=365,
        avg_promo_cycle_days=45,
    )

    assert rec.should_stockpile is True
    assert rec.recommended_units >= 2
    assert rec.estimated_savings_eur > 0
