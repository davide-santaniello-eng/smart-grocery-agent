"""Catalog and entity resolution API endpoints."""

from typing import List
from fastapi import APIRouter, status
from pydantic import BaseModel, Field

from backend.app.catalog.matcher import CandidateVariant, GroceryProductMatcher, MatchScore
from backend.app.catalog.parser import ParsedQuantity, parse_grocery_quantity

router = APIRouter(prefix="/catalog", tags=["Catalog & Entity Resolution"])


class ParseQuantityRequest(BaseModel):
    text: str = Field(..., description="Raw text, e.g. 'Birra 4x330ml' or 'Spaghetti 500g'")


class MatchRequest(BaseModel):
    raw_text: str = Field(..., description="Raw item description from receipt or flyer")
    catalog: List[CandidateVariant] = Field(..., description="Candidate catalog variants to match against")
    top_k: int = Field(default=5, ge=1, le=20)
    min_threshold: float = Field(default=0.50, ge=0.0, le=1.0)


@router.post(
    "/parse-quantity",
    response_model=ParsedQuantity,
    summary="Parse retail multipack and units from text",
    status_code=status.HTTP_200_OK,
)
async def parse_quantity_endpoint(payload: ParseQuantityRequest):
    result = parse_grocery_quantity(payload.text)
    if not result:
        return ParsedQuantity(
            raw_match="",
            package_count=1,
            package_size=1.0,
            package_unit="unit",
            total_base_quantity=1.0,
            base_unit="unit",
        )
    return result


@router.post(
    "/match-variant",
    response_model=List[MatchScore],
    summary="Fuzzy match raw description to candidate product variants",
    status_code=status.HTTP_200_OK,
)
async def match_variant_endpoint(payload: MatchRequest):
    matcher = GroceryProductMatcher(payload.catalog)
    return matcher.match(
        raw_text=payload.raw_text,
        top_k=payload.top_k,
        min_threshold=payload.min_threshold,
    )
