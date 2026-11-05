"""Carrefour Italia public Algolia search client."""

import logging
from typing import Any, Dict, List, Optional
import httpx

from backend.app.catalog.parser import normalize_unit_and_quantity, parse_grocery_quantity
from .base import BaseOfferProvider
from .schemas import StandardizedProductOffer

logger = logging.getLogger(__name__)

# Public Algolia configuration used by Carrefour Italia client webapp
CARREFOUR_ALGOLIA_APP_ID = "6N0Y620H6S"
CARREFOUR_ALGOLIA_API_KEY = "646399990ee42813589b2db7f903e134"
CARREFOUR_INDEX_NAME = "prod_carrefour_it_products"


class CarrefourAlgoliaProvider(BaseOfferProvider):
    """Fetches real-time prices from Carrefour Italia using their public Algolia search index."""

    def __init__(
        self,
        app_id: str = CARREFOUR_ALGOLIA_APP_ID,
        api_key: str = CARREFOUR_ALGOLIA_API_KEY,
        index_name: str = CARREFOUR_INDEX_NAME,
        timeout: float = 10.0,
    ):
        self.app_id = app_id
        self.api_key = api_key
        self.index_name = index_name
        self.timeout = timeout
        self.endpoint_url = f"https://{self.app_id}-dsn.algolia.net/1/indexes/{self.index_name}/query"

    @property
    def provider_id(self) -> str:
        return "carrefour_algolia"

    def _parse_hit(self, hit: Dict[str, Any], store_id: str) -> Optional[StandardizedProductOffer]:
        """Converts an Algolia product hit into a normalized StandardizedProductOffer."""
        try:
            external_id = str(hit.get("objectID") or hit.get("id") or "")
            if not external_id:
                return None

            name = hit.get("name") or hit.get("title") or "Prodotto senza nome"
            brand = hit.get("brand") or hit.get("brand_name")
            barcode = hit.get("ean") or hit.get("gtin") or hit.get("barcode")

            # Extract pricing
            price_data = hit.get("pricing") or hit.get("price") or {}
            if isinstance(price_data, dict):
                price = float(price_data.get("price") or price_data.get("final_price") or 0.0)
                std_price = float(price_data.get("original_price") or price_data.get("standard_price") or price)
                is_promo = bool(price_data.get("is_promo") or (std_price > price > 0.0))
                promo_desc = price_data.get("discount_label")
            elif isinstance(price_data, (int, float)):
                price = float(price_data)
                std_price = price
                is_promo = False
                promo_desc = None
            else:
                price = 0.0
                std_price = None
                is_promo = False
                promo_desc = None

            if price <= 0.0:
                return None

            # Parse physical quantity from product title or packaging field
            packaging_str = hit.get("packaging") or hit.get("format") or name
            parsed_qty = parse_grocery_quantity(str(packaging_str))

            if parsed_qty:
                pkg_size = parsed_qty.package_size * parsed_qty.package_count
                pkg_unit = parsed_qty.package_unit
                base_qty = parsed_qty.total_base_quantity
                base_unit = parsed_qty.base_unit
            else:
                # Default fallback: 1 unit
                pkg_size = 1.0
                pkg_unit = "unit"
                base_qty = 1.0
                base_unit = "unit"

            price_per_base = round(price / base_qty, 6) if base_qty > 0 else price

            # Image
            images = hit.get("images") or []
            image_url = images[0] if isinstance(images, list) and images else hit.get("image_url")

            return StandardizedProductOffer(
                provider=self.provider_id,
                external_id=external_id,
                store_id=store_id,
                name=name,
                brand=brand,
                barcode=str(barcode) if barcode else None,
                price=price,
                standard_price=std_price if std_price and std_price > price else None,
                package_size=pkg_size,
                package_unit=pkg_unit,
                base_quantity=base_qty,
                base_unit=base_unit,
                price_per_base_unit=price_per_base,
                is_promotion=is_promo,
                promo_description=promo_desc,
                image_url=str(image_url) if image_url else None,
                raw_payload=hit,
            )
        except Exception as e:
            logger.warning(f"Error parsing Carrefour product hit {hit}: {e}")
            return None

    async def search_offers(
        self,
        query: str,
        store_id: str,
        limit: int = 20,
    ) -> List[StandardizedProductOffer]:
        headers = {
            "X-Algolia-Application-Id": self.app_id,
            "X-Algolia-API-Key": self.api_key,
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        }
        payload = {
            "query": query,
            "hitsPerPage": min(limit, 50),
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.post(self.endpoint_url, json=payload, headers=headers)
                response.raise_for_status()
                data = response.json()
                hits = data.get("hits", [])
                offers: List[StandardizedProductOffer] = []
                for hit in hits:
                    offer = self._parse_hit(hit, store_id=store_id)
                    if offer:
                        offers.append(offer)
                return offers
            except Exception as e:
                logger.error(f"Failed to fetch Carrefour offers for '{query}': {e}")
                return []
