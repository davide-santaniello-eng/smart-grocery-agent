"""Shopping optimization endpoint."""

from typing import List, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from backend.app.optimization.schemas import (
    ItemRequirement,
    OptimizationConfig,
    OptimizationResult,
    ProductOffer,
    Store,
)
from backend.app.optimization.solver import GroceryBasketOptimizer

router = APIRouter(prefix="/shopping", tags=["Shopping Optimization"])


class OptimizeRequest(BaseModel):
    items: List[ItemRequirement] = Field(..., description="List of required grocery items")
    stores: List[Store] = Field(..., description="List of candidate stores with visit costs")
    offers: List[ProductOffer] = Field(..., description="Available product offers across the stores")
    config: Optional[OptimizationConfig] = Field(default=None, description="Optimization configuration")


@router.post(
    "/optimize",
    response_model=OptimizationResult,
    summary="Optimize grocery basket across multiple stores",
    status_code=status.HTTP_200_OK,
)
async def optimize_basket(payload: OptimizeRequest) -> OptimizationResult:
    """Takes shopping requirements, candidate stores, and price offers,

    and computes the optimal product-to-store allocation using Google OR-Tools CP-SAT.
    """
    if not payload.items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Item requirements list cannot be empty.",
        )
    if not payload.stores:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one candidate store must be provided.",
        )

    optimizer = GroceryBasketOptimizer(
        items=payload.items,
        stores=payload.stores,
        offers=payload.offers,
        config=payload.config,
    )
    result = optimizer.solve()
    return result
