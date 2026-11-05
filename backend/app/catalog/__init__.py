"""Catalog matching and entity resolution package."""

from .matcher import CandidateVariant, GroceryProductMatcher, MatchScore
from .parser import ParsedQuantity, normalize_unit_and_quantity, parse_grocery_quantity

__all__ = [
    "CandidateVariant",
    "GroceryProductMatcher",
    "MatchScore",
    "ParsedQuantity",
    "normalize_unit_and_quantity",
    "parse_grocery_quantity",
]
