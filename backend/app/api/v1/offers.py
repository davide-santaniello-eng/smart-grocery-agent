"""External retailer offers search API."""

from typing import List
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from backend.app.ingestion.carrefour import CarrefourAlgoliaProvider
from backend.app.ingestion.schemas import StandardizedProductOffer

router = APIRouter(prefix="/offers", tags=["Retailer Offers Ingestion"])

# Providers registry
carrefour_provider = CarrefourAlgoliaProvider()


class SearchOffersRequest(BaseModel):
    query: str = Field(..., description="Product keyword search, e.g. 'pasta barilla'")
    store_id: str = Field(default="store_carrefour_default", description="Associated store ID")
    provider: str = Field(default="carrefour", description="Retailer provider ('carrefour')")
    limit: int = Field(default=20, ge=1, le=50)


@router.post(
    "/search-external",
    response_model=List[StandardizedProductOffer],
    summary="Search real-time offers from external GDO providers",
    status_code=status.HTTP_200_OK,
)
async def search_external_offers(payload: SearchOffersRequest) -> List[StandardizedProductOffer]:
    if payload.provider.lower() == "carrefour":
        return await carrefour_provider.search_offers(
            query=payload.query,
            store_id=payload.store_id,
            limit=payload.limit,
        )
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Unsupported provider '{payload.provider}'. Currently supported: 'carrefour'",
    )
