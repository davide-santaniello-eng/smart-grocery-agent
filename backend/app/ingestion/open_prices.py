"""Open Prices (Open Food Facts) public API client.

Fetches crowdsourced real-world grocery prices, supermarket receipts and historical EAN prices.
Zero-cost (€0/month), Open Database License (ODbL).
Endpoint: https://prices.openfoodfacts.org/api/v1
"""

import logging
from typing import Any, Dict, List, Optional
import httpx

from .schemas import StandardizedProductOffer

logger = logging.getLogger(__name__)

OPEN_PRICES_BASE_URL = "https://prices.openfoodfacts.org/api/v1"


class OpenPricesProvider:
    """Client for Open Food Facts 'Open Prices' crowdsourced database."""

    def __init__(self, base_url: str = OPEN_PRICES_BASE_URL, timeout: float = 10.0):
        self.base_url = base_url
        self.timeout = timeout

    async def get_price_history_for_barcode(
        self,
        barcode: str,
        country: str = "IT",
        size: int = 20,
    ) -> List[Dict[str, Any]]:
        """Retrieves price history for an EAN-13 product in Italy."""
        url = f"{self.base_url}/prices"
        params = {
            "product_code": barcode,
            "order_by": "-date",
            "size": size,
        }
        headers = {
            "User-Agent": "SmartGroceryAgent/1.0 (https://github.com/davide-santaniello-eng/smart-grocery-agent)",
            "Accept": "application/json",
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                res = await client.get(url, params=params, headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    return data.get("items", [])
                else:
                    logger.warning(f"Open Prices returned status {res.status_code} for EAN {barcode}")
                    return []
            except Exception as e:
                logger.error(f"Failed to query Open Prices API for EAN {barcode}: {e}")
                return []
