"""Abstract base class for retailer offer providers."""

from abc import ABC, abstractmethod
from typing import List, Optional
from .schemas import StandardizedProductOffer


class BaseOfferProvider(ABC):
    """Abstract interface that all retailer price scraping/API clients implement."""

    @property
    @abstractmethod
    def provider_id(self) -> str:
        """Unique provider identifier (e.g. 'carrefour_algolia', 'bennet_occ')."""
        pass

    @abstractmethod
    async def search_offers(
        self,
        query: str,
        store_id: str,
        limit: int = 20,
    ) -> List[StandardizedProductOffer]:
        """Search products and prices for a given keyword query and store location."""
        pass
