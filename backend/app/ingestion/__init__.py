"""GDO and external price ingestion package."""

from .base import BaseOfferProvider
from .carrefour import CarrefourAlgoliaProvider
from .schemas import StandardizedProductOffer

__all__ = [
    "BaseOfferProvider",
    "CarrefourAlgoliaProvider",
    "StandardizedProductOffer",
]
