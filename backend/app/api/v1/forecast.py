"""Forecasting API endpoint."""

from fastapi import APIRouter, status
from backend.app.forecasting.engine import TSBConsumptionForecaster
from backend.app.forecasting.schemas import ForecastInput, ForecastResult

router = APIRouter(prefix="/forecast", tags=["Demand Forecasting"])
forecaster = TSBConsumptionForecaster()


@router.post(
    "/depletion",
    response_model=ForecastResult,
    summary="Predict product depletion and suggested restocking date",
    status_code=status.HTTP_200_OK,
)
async def predict_depletion(payload: ForecastInput) -> ForecastResult:
    """Takes consumption history and current stock, and computes daily consumption,

    safety stock, depletion date, and reorder recommendation using the TSB model.
    """
    return forecaster.forecast(payload)
