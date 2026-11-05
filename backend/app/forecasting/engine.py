"""Pure Python implementation of the Teunter-Syntetos-Babai (TSB) forecasting model

for household intermittent consumption.
"""

from datetime import date, timedelta
import math
from typing import Dict, List, Optional
from .schemas import ForecastInput, ForecastResult


def _get_z_score(service_level: float) -> float:
    """Approximate Z-score for standard normal distribution for common service levels."""
    if service_level >= 0.99:
        return 2.326
    elif service_level >= 0.98:
        return 2.054
    elif service_level >= 0.95:
        return 1.645
    elif service_level >= 0.90:
        return 1.282
    elif service_level >= 0.85:
        return 1.036
    elif service_level >= 0.80:
        return 0.842
    return 0.674  # 75%


class TSBConsumptionForecaster:
    """Forecaster based on Teunter-Syntetos-Babai (2011) algorithm."""

    def __init__(self, alpha: float = 0.15, beta: float = 0.15):
        """Args:

        alpha: Smoothing factor for demand probability p_t (0 < alpha < 1).
        beta: Smoothing factor for demand magnitude z_t (0 < beta < 1).
        """
        self.alpha = alpha
        self.beta = beta

    def forecast(self, req: ForecastInput) -> ForecastResult:
        today = req.reference_date or date.today()

        # If history is missing or too short, return INSUFFICIENT_DATA
        if not req.consumption_history or len(req.consumption_history) < 2:
            return ForecastResult(
                product_id=req.product_id,
                product_name=req.product_name,
                base_unit=req.base_unit,
                current_stock=req.current_stock,
                daily_avg_consumption=0.0,
                safety_stock=0.0,
                reorder_point=0.0,
                confidence_score=0.0,
                status="DEPLETED" if req.current_stock <= 0 else "INSUFFICIENT_DATA",
            )

        # 1. Expand history to continuous daily calendar sequence
        sorted_events = sorted(req.consumption_history, key=lambda e: e.event_date)
        start_date = sorted_events[0].event_date
        end_date = sorted_events[-1].event_date
        total_days = (end_date - start_date).days + 1

        # Aggregate daily consumption in case of multiple events on the same day
        daily_amounts: Dict[date, float] = {}
        for ev in sorted_events:
            daily_amounts[ev.event_date] = daily_amounts.get(ev.event_date, 0.0) + ev.quantity

        # Create continuous array y_t
        y: List[float] = []
        for i in range(total_days):
            d = start_date + timedelta(days=i)
            y.append(daily_amounts.get(d, 0.0))

        positive_demands = [qty for qty in y if qty > 0.0]
        if not positive_demands:
            return ForecastResult(
                product_id=req.product_id,
                product_name=req.product_name,
                base_unit=req.base_unit,
                current_stock=req.current_stock,
                daily_avg_consumption=0.0,
                safety_stock=0.0,
                reorder_point=0.0,
                confidence_score=0.1,
                status="DEPLETED" if req.current_stock <= 0 else "SUFFICIENT_STOCK",
            )

        # 2. Initialization of TSB
        # p_0: initial probability of demand occurrence
        p_t = len(positive_demands) / len(y)
        # z_0: initial expected non-zero demand size
        z_t = sum(positive_demands) / len(positive_demands)

        # 3. Iterative TSB updates
        for yt in y:
            if yt > 0.0:
                p_t = p_t + self.alpha * (1.0 - p_t)
                z_t = z_t + self.beta * (yt - z_t)
            else:
                p_t = p_t + self.alpha * (0.0 - p_t)
                # z_t remains unchanged on zero-demand days

        # Ensure bounds
        p_t = max(0.0001, min(1.0, p_t))
        z_t = max(0.0001, z_t)

        # Daily estimated consumption rate
        daily_avg = p_t * z_t

        # 4. Variance and Safety Stock calculation
        if len(positive_demands) > 1:
            mean_pos = sum(positive_demands) / len(positive_demands)
            var_z = sum((val - mean_pos) ** 2 for val in positive_demands) / (len(positive_demands) - 1)
        else:
            var_z = 0.0

        # Bernoulli composite variance for intermittent process: Var(Y) = p*Var(Z) + p*(1-p)*E[Z]^2
        var_y = (p_t * var_z) + (p_t * (1.0 - p_t) * (z_t ** 2))
        lead_time = max(1, req.lead_time_days)
        std_lead_time = math.sqrt(lead_time * max(0.0, var_y))

        z_score = _get_z_score(req.service_level)
        safety_stock = round(z_score * std_lead_time, 2)
        reorder_point = round((daily_avg * lead_time) + safety_stock, 2)

        # 5. Restocking and Depletion Timing
        days_to_depletion: Optional[float] = None
        predicted_depletion_date: Optional[date] = None
        days_to_reorder: Optional[float] = None
        suggested_reorder_date: Optional[date] = None

        if daily_avg > 0.0:
            days_to_depletion = round(req.current_stock / daily_avg, 1)
            predicted_depletion_date = today + timedelta(days=int(math.floor(days_to_depletion)))

            net_available = req.current_stock - reorder_point
            if net_available <= 0:
                days_to_reorder = 0.0
                suggested_reorder_date = today
            else:
                days_to_reorder = round(net_available / daily_avg, 1)
                suggested_reorder_date = today + timedelta(days=int(math.floor(days_to_reorder)))

        # Default recommended purchase quantity: cover 14 days of average consumption + safety stock
        suggested_qty = round((daily_avg * 14.0) + safety_stock, 2) if daily_avg > 0 else 0.0

        # 6. Status determination
        if req.current_stock <= 0:
            status = "DEPLETED"
        elif req.current_stock <= reorder_point:
            status = "REORDER_NOW"
        else:
            status = "SUFFICIENT_STOCK"

        # Confidence: scales with number of positive observations and total history length
        confidence = min(1.0, (len(positive_demands) / 5.0) * 0.7 + (min(total_days, 30) / 30.0) * 0.3)

        return ForecastResult(
            product_id=req.product_id,
            product_name=req.product_name,
            base_unit=req.base_unit,
            current_stock=req.current_stock,
            daily_avg_consumption=round(daily_avg, 4),
            safety_stock=safety_stock,
            reorder_point=reorder_point,
            days_until_depletion=days_to_depletion,
            days_until_reorder=days_to_reorder,
            predicted_depletion_date=predicted_depletion_date,
            suggested_reorder_date=suggested_reorder_date,
            suggested_reorder_quantity=suggested_qty,
            confidence_score=round(confidence, 2),
            status=status,
        )
