"""Fast Entity Resolution and product matching using RapidFuzz."""

from typing import List, Optional
from pydantic import BaseModel
from rapidfuzz import fuzz

from .parser import parse_grocery_quantity


class CandidateVariant(BaseModel):
    variant_id: str
    product_id: str
    brand: Optional[str]
    name: str
    base_quantity: float
    base_unit: str


class MatchScore(BaseModel):
    variant_id: str
    product_id: str
    brand: Optional[str]
    name: str
    score: float  # 0.0 to 1.0
    quantity_matched: bool


class GroceryProductMatcher:
    """Matches noisy text strings from receipts and flyers to canonical variants."""

    def __init__(self, catalog: List[CandidateVariant]):
        self.catalog = catalog

    def match(
        self,
        raw_text: str,
        top_k: int = 5,
        min_threshold: float = 0.50,
    ) -> List[MatchScore]:
        """Performs multi-factor fuzzy matching between raw_text and catalog variants."""
        parsed_qty = parse_grocery_quantity(raw_text)
        results: List[MatchScore] = []

        cleaned_query = raw_text.lower().strip()

        for item in self.catalog:
            item_name_lower = item.name.lower()

            # 1. Name Similarity: Weighted combination of token_sort_ratio and token_set_ratio
            sort_score = fuzz.token_sort_ratio(cleaned_query, item_name_lower) / 100.0
            set_score = fuzz.token_set_ratio(cleaned_query, item_name_lower) / 100.0
            name_score = (sort_score * 0.4) + (set_score * 0.6)

            # 2. Brand Bonus/Check
            brand_bonus = 0.0
            if item.brand:
                brand_lower = item.brand.lower()
                if brand_lower in cleaned_query:
                    brand_bonus = 0.15

            # 3. Quantity matching
            qty_match = False
            qty_penalty = 0.0
            if parsed_qty and parsed_qty.base_unit == item.base_unit:
                # Compare base quantity (e.g. 500g vs 500g)
                if abs(parsed_qty.total_base_quantity - item.base_quantity) < 1.0:
                    qty_match = True
                    brand_bonus += 0.10
                else:
                    qty_penalty = 0.15

            final_score = min(1.0, max(0.0, name_score + brand_bonus - qty_penalty))

            if final_score >= min_threshold:
                results.append(
                    MatchScore(
                        variant_id=item.variant_id,
                        product_id=item.product_id,
                        brand=item.brand,
                        name=item.name,
                        score=round(final_score, 3),
                        quantity_matched=qty_match,
                    )
                )

        results.sort(key=lambda r: r.score, reverse=True)
        return results[:top_k]
