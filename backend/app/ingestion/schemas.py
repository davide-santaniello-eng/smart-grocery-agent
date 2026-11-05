"""Schemas for external grocery offer ingestion and normalization."""

from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class StandardizedProductOffer(BaseModel):
    """Normalized product offer extracted from any retailer provider."""
    provider: str = Field(description="Provider identifier, e.g. 'carrefour_algolia', 'bennet_occ'")
    external_id: str = Field(description="Unique product ID in the retailer catalog")
    store_id: str = Field(description="Assigned internal store ID")
    name: str = Field(description="Product title, e.g. 'Spaghetti N. 5 Barilla'")
    brand: Optional[str] = Field(default=None, description="Brand name if detected")
    barcode: Optional[str] = Field(default=None, description="EAN-13 / GTIN barcode")
    price: float = Field(ge=0.0, description="Package selling price in EUR")
    standard_price: Optional[float] = Field(default=None, description="Regular price before discount")
    package_size: float = Field(gt=0.0, description="Extracted package size (e.g. 500)")
    package_unit: str = Field(description="Extracted package unit (e.g. 'g', 'l')")
    base_quantity: float = Field(gt=0.0, description="Amount normalized to base unit (e.g. 500 for 500g)")
    base_unit: str = Field(description="Canonical base unit: 'g', 'ml', 'unit'")
    price_per_base_unit: float = Field(ge=0.0, description="EUR price per base unit (e.g. EUR/g or EUR/ml)")
    is_promotion: bool = Field(default=False, description="Whether currently on promo")
    promo_description: Optional[str] = None
    image_url: Optional[str] = None
    raw_payload: Optional[Dict[str, Any]] = None
