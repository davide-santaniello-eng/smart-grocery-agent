"""Schemas for household consumption intelligence and depletion forecasting."""

from datetime import date
from typing import List, Optional
from pydantic import BaseModel, Field


class DailyConsumptionEvent(BaseModel):
    """Daily consumption record (quantity consumed on a specific date)."""
    event_date: date
    quantity: float = Field(ge=0.0, description="Amount consumed in base units (g, ml, unit)")


class ForecastInput(BaseModel):
    """Input payload to estimate consumption and predict restocking dates."""
    product_id: str
    product_name: str
    base_unit: str = Field(description="'g', 'ml', or 'unit'")
    current_stock: float = Field(ge=0.0, description="Current quantity in household stock")
    lead_time_days: int = Field(default=2, ge=0, description="Days needed to shop/replenish")
    service_level: float = Field(default=0.95, ge=0.5, le=0.99, description="Desired service level (95% standard)")
    reference_date: Optional[date] = Field(default=None, description="Starting date for projection (defaults to today)")
    consumption_history: List[DailyConsumptionEvent] = Field(
        default_factory=list,
        description="Chronological sequence of daily consumption observations"
    )


class ForecastResult(BaseModel):
    """Forecasting output with depletion and reorder recommendations."""
    product_id: str
    product_name: str
    base_unit: str
    current_stock: float
    daily_avg_consumption: float = Field(description="Estimated daily consumption rate in base units")
    safety_stock: float = Field(description="Calculated safety stock buffer")
    reorder_point: float = Field(description="Stock level that triggers a reorder recommendation")
    days_until_depletion: Optional[float] = Field(
        default=None, 
        description="Estimated days until current stock reaches 0"
    )
    days_until_reorder: Optional[float] = Field(
        default=None,
        description="Estimated days until stock drops below the reorder point"
    )
    predicted_depletion_date: Optional[date] = None
    suggested_reorder_date: Optional[date] = None
    suggested_reorder_quantity: Optional[float] = None
    confidence_score: float = Field(
        ge=0.0, le=1.0, 
        description="Confidence score based on history length and stability"
    )
    status: str = Field(
        description="'SUFFICIENT_STOCK', 'REORDER_NOW', 'DEPLETED', 'INSUFFICIENT_DATA'"
    )
