"""Price Intelligence & Promotional Anomaly Detection Engine.

Implements:
1. EU Omnibus Directive (Directive 2019/2161 / Italian D.Lgs. 26/2023) 30-day baseline check.
2. Fake Discount & Promotional Anomaly Detection (Markup Fittizio, Negative Discount).
3. Forward-Buying & Pantry Stockpiling Optimization (Hendel & Nevo model) tied to household consumption.
"""

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from enum import Enum
import math
from typing import Any, Dict, List, Optional


class DiscountClassification(str, Enum):
    GENUINE_DISCOUNT = "GENUINE_DISCOUNT"         # Real discount vs 30-day low
    OMNIBUS_VIOLATION = "OMNIBUS_VIOLATION"       # Inflated reference price (violates EU 2019/2161)
    NEGATIVE_DISCOUNT = "NEGATIVE_DISCOUNT"       # Promo price is higher than recent regular price
    NEUTRAL_PROMO = "NEUTRAL_PROMO"               # Routine price with fake promo tag
    INSUFFICIENT_DATA = "INSUFFICIENT_DATA"       # Not enough history (< 7 days)


@dataclass
class PricePoint:
    date: date
    price: float
    is_promo: bool = False
    store_id: Optional[str] = None


@dataclass
class OmnibusEvaluationResult:
    classification: DiscountClassification
    promo_price: float
    claimed_ref_price: Optional[float]
    omnibus_baseline_30d: float
    real_discount_pct: float
    claimed_discount_pct: Optional[float]
    fake_markup_amount: float
    is_genuine_bargain: bool
    verdict_message: str


@dataclass
class StockpileRecommendation:
    should_stockpile: bool
    recommended_units: int
    cycle_days_covered: int
    estimated_savings_eur: float
    reason: str


class PriceIntelligenceEngine:
    """Evaluates promotional integrity under the EU Omnibus Directive and suggests optimal forward-buying."""

    @staticmethod
    def evaluate_discount(
        history: List[PricePoint],
        promo_price: float,
        claimed_ref_price: Optional[float] = None,
        evaluation_date: Optional[date] = None,
    ) -> OmnibusEvaluationResult:
        """Evaluates whether a current promotion is genuine or a fake discount under D.Lgs. 26/2023.

        Rule: The reference price must be the lowest price applied in the preceding 30 days.
        """
        ref_date = evaluation_date or date.today()
        cutoff_30d = ref_date - timedelta(days=30)

        # Filter observations in the [ref_date - 30d, ref_date) window
        window_prices = [
            p.price for p in history
            if cutoff_30d <= p.date < ref_date and p.price > 0.0
        ]

        if not window_prices:
            # Fallback if no prior history exists in the 30-day window
            base_ref = claimed_ref_price or promo_price
            claimed_pct = round(((base_ref - promo_price) / base_ref) * 100, 1) if base_ref > promo_price else 0.0
            return OmnibusEvaluationResult(
                classification=DiscountClassification.INSUFFICIENT_DATA,
                promo_price=promo_price,
                claimed_ref_price=claimed_ref_price,
                omnibus_baseline_30d=base_ref,
                real_discount_pct=claimed_pct,
                claimed_discount_pct=claimed_pct,
                fake_markup_amount=0.0,
                is_genuine_bargain=False,
                verdict_message="Dati storici insufficienti negli ultimi 30 giorni per verificare il prezzo barrato.",
            )

        # Canonical Omnibus Baseline = minimum price in the last 30 days
        omnibus_baseline = min(window_prices)

        # Check latest price prior to promotion (e.g. last 7 days)
        cutoff_7d = ref_date - timedelta(days=7)
        recent_prices = [p.price for p in history if cutoff_7d <= p.date < ref_date and p.price > 0.0]
        recent_price = recent_prices[-1] if recent_prices else window_prices[-1]

        # 1. Negative Discount: Promo price is higher than recent selling price
        if promo_price > recent_price:
            return OmnibusEvaluationResult(
                classification=DiscountClassification.NEGATIVE_DISCOUNT,
                promo_price=promo_price,
                claimed_ref_price=claimed_ref_price,
                omnibus_baseline_30d=omnibus_baseline,
                real_discount_pct=round(((recent_price - promo_price) / recent_price) * 100, 1),
                claimed_discount_pct=None,
                fake_markup_amount=max(0.0, (claimed_ref_price or 0.0) - omnibus_baseline),
                is_genuine_bargain=False,
                verdict_message=f"Falso sconto peggiorativo! La settimana scorsa costava {recent_price:.2f}€ (ora {promo_price:.2f}€).",
            )

        # 2. Check Claimed Reference Price (Fake Markup / Omnibus Violation)
        fake_markup = 0.0
        if claimed_ref_price and claimed_ref_price > omnibus_baseline:
            fake_markup = round(claimed_ref_price - omnibus_baseline, 2)

        claimed_pct = None
        if claimed_ref_price and claimed_ref_price > 0:
            claimed_pct = round(((claimed_ref_price - promo_price) / claimed_ref_price) * 100, 1)

        real_discount_pct = round(((omnibus_baseline - promo_price) / omnibus_baseline) * 100, 1)

        # Evaluation Decision
        if fake_markup > 0.05 and (claimed_ref_price or 0) > promo_price:
            # The retailer claimed a higher regular price than the minimum of the past 30 days
            return OmnibusEvaluationResult(
                classification=DiscountClassification.OMNIBUS_VIOLATION,
                promo_price=promo_price,
                claimed_ref_price=claimed_ref_price,
                omnibus_baseline_30d=omnibus_baseline,
                real_discount_pct=real_discount_pct,
                claimed_discount_pct=claimed_pct,
                fake_markup_amount=fake_markup,
                is_genuine_bargain=real_discount_pct > 15.0,
                verdict_message=(
                    f"Violazione Direttiva Omnibus: prezzo barrato gonfiato di +{fake_markup:.2f}€. "
                    f"Il minimo a 30gg era {omnibus_baseline:.2f}€ (sconto reale: {real_discount_pct}% vs {claimed_pct}% dichiarato)."
                ),
            )

        if promo_price < omnibus_baseline:
            # Genuine discount below the 30-day lowest price
            return OmnibusEvaluationResult(
                classification=DiscountClassification.GENUINE_DISCOUNT,
                promo_price=promo_price,
                claimed_ref_price=claimed_ref_price,
                omnibus_baseline_30d=omnibus_baseline,
                real_discount_pct=real_discount_pct,
                claimed_discount_pct=claimed_pct,
                fake_markup_amount=0.0,
                is_genuine_bargain=True,
                verdict_message=f"Vero Affare! Minimo storico a 30 giorni ({real_discount_pct}% di risparmio reale rispetto a {omnibus_baseline:.2f}€).",
            )

        # Promo equals the 30-day baseline (no real discount)
        return OmnibusEvaluationResult(
            classification=DiscountClassification.NEUTRAL_PROMO,
            promo_price=promo_price,
            claimed_ref_price=claimed_ref_price,
            omnibus_baseline_30d=omnibus_baseline,
            real_discount_pct=0.0,
            claimed_discount_pct=claimed_pct,
            fake_markup_amount=fake_markup,
            is_genuine_bargain=False,
            verdict_message=f"Offerta Neutra: il prezzo promo di {promo_price:.2f}€ coincide con il prezzo abituale.",
        )

    @staticmethod
    def calculate_stockpile(
        evaluation: OmnibusEvaluationResult,
        daily_consumption: float,
        package_base_qty: float,
        shelf_life_days: int = 180,
        avg_promo_cycle_days: int = 42,  # Average FMCG flyer rotation in Italian retail
        max_pantry_capacity_units: int = 10,
    ) -> StockpileRecommendation:
        """Determines forward-buying stockpile quantity when a genuine discount is detected."""
        if not evaluation.is_genuine_bargain or daily_consumption <= 0 or package_base_qty <= 0:
            return StockpileRecommendation(
                should_stockpile=False,
                recommended_units=1,
                cycle_days_covered=0,
                estimated_savings_eur=0.0,
                reason="Nessuna convenienza o consumo nullo: acquista solo il fabbisogno immediato.",
            )

        # Quantity needed to cover the household until the next promotional flyer cycle
        needed_base_qty = daily_consumption * avg_promo_cycle_days
        ideal_units = math.ceil(needed_base_qty / package_base_qty)

        # Constrain by shelf-life and maximum pantry storage capacity
        max_units_by_expiry = math.floor((daily_consumption * shelf_life_days) / package_base_qty)
        max_units = max(1, min(max_units_by_expiry, max_pantry_capacity_units))

        recommended_units = min(ideal_units, max_units)

        # Ensure we suggest at least 2 units for forward-buying
        if recommended_units < 2:
            recommended_units = 2 if max_units >= 2 else 1

        # Savings = (Omnibus baseline - promo price) * recommended units
        unit_savings = max(0.0, evaluation.omnibus_baseline_30d - evaluation.promo_price)
        total_savings = round(unit_savings * recommended_units, 2)
        covered_days = math.floor((recommended_units * package_base_qty) / daily_consumption)

        return StockpileRecommendation(
            should_stockpile=recommended_units > 1,
            recommended_units=recommended_units,
            cycle_days_covered=covered_days,
            estimated_savings_eur=total_savings,
            reason=(
                f"Scorta consigliata: compra {recommended_units} confezioni per coprire i prossimi {covered_days} giorni "
                f"fino al prossimo ciclo volantino. Risparmio netto stimato: €{total_savings:.2f}."
            ),
        )
