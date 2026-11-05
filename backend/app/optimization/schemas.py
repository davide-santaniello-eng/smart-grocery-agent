"""Pydantic schemas for the grocery basket optimization engine."""

from typing import List, Optional
from pydantic import BaseModel, Field


class ItemRequirement(BaseModel):
    """A single canonical grocery item requested by the user."""
    item_id: str = Field(description="Unique identifier for the canonical product (e.g. UUID or 'spaghetti')")
    name: str = Field(description="Display name of the product")
    min_quantity: float = Field(gt=0, description="Minimum quantity needed in base units (g, ml, or unit)")
    base_unit: str = Field(description="Base unit: 'g', 'ml', or 'unit'")
    max_quantity: Optional[float] = Field(default=None, description="Maximum acceptable quantity in base units")
    is_mandatory: bool = Field(default=True, description="Whether this item must be fulfilled")
    preferred_brands: List[str] = Field(default_factory=list, description="Brands preferred by the user")
    acceptable_brands: Optional[List[str]] = Field(default=None, description="Allowed brands. If None, all brands are acceptable")


class Store(BaseModel):
    """A supermarket location with an associated visit cost."""
    store_id: str = Field(description="Unique store identifier")
    name: str = Field(description="Store display name, e.g. 'Esselunga - Via Washington'")
    chain: str = Field(description="Supermarket chain, e.g. 'Esselunga', 'Lidl', 'Coop'")
    visit_cost: float = Field(ge=0.0, default=2.00, description="Cost of visiting this store in EUR (inconvenience, fuel, distance)")


class ProductOffer(BaseModel):
    """An offer for a specific product variant at a store."""
    offer_id: str = Field(description="Offer identifier")
    store_id: str = Field(description="Store where the offer is located")
    item_id: str = Field(description="Parent canonical item ID")
    variant_id: str = Field(description="Specific variant ID")
    variant_name: str = Field(description="e.g. 'Spaghetti N. 5 Barilla 500g'")
    brand: Optional[str] = Field(default=None, description="Brand name")
    package_price: float = Field(gt=0.0, description="Price of 1 package in EUR")
    package_base_quantity: float = Field(gt=0.0, description="Amount in base unit per package (e.g. 500 for 500g)")
    is_promotion: bool = Field(default=False, description="Whether this is a promotional discount")
    promo_description: Optional[str] = Field(default=None, description="Promo details")


class OptimizationConfig(BaseModel):
    """Configuration options for the solver."""
    max_stores: int = Field(default=2, ge=1, description="Maximum number of stores to visit in one trip")
    enforce_single_sku_per_item: bool = Field(
        default=True, 
        description="Prevent splitting the same item into multiple brands/SKUs"
    )
    overfill_penalty_weight: float = Field(
        default=0.02, 
        ge=0.0, 
        description="Penalty factor for excess quantity (prevents unnecessarily large packages)"
    )
    time_limit_seconds: float = Field(default=5.0, gt=0.0, description="Maximum solver execution time")


class AllocatedItem(BaseModel):
    """An item allocated for purchase at a specific store."""
    item_id: str
    item_name: str
    variant_id: str
    variant_name: str
    brand: Optional[str] = None
    package_quantity: int
    unit_price: float
    total_price: float
    base_quantity_per_pack: float
    total_base_quantity: float
    is_promotion: bool = False


class StoreAllocation(BaseModel):
    """A store selected for the shopping trip with its allocated items."""
    store_id: str
    store_name: str
    store_chain: str
    visit_cost: float
    items: List[AllocatedItem] = Field(default_factory=list)
    subtotal_products: float = 0.0


class OptimizationResult(BaseModel):
    """Deterministic output produced by the OR-Tools optimizer."""
    status: str = Field(description="Solver status: 'OPTIMAL', 'FEASIBLE', 'INFEASIBLE', 'UNKNOWN'")
    total_cost: float = Field(description="Total cost in EUR: products + travel")
    product_cost: float = Field(description="Sum of all purchased products in EUR")
    travel_cost: float = Field(description="Sum of store visit costs in EUR")
    estimated_savings_vs_single_store: Optional[float] = Field(
        default=None, 
        description="Estimated EUR saved compared to buying everything at the best single store"
    )
    selected_stores: List[StoreAllocation] = Field(default_factory=list)
    unfulfilled_items: List[str] = Field(default_factory=list)
    solver_time_ms: float = 0.0
