"""Quantity and unit normalization for Italian grocery packaging."""

import re
from typing import Optional, Tuple
from pydantic import BaseModel


class ParsedQuantity(BaseModel):
    raw_match: str
    package_count: int
    package_size: float
    package_unit: str
    total_base_quantity: float
    base_unit: str  # 'g', 'ml', 'unit'


# Regex patterns tailored for Italian GDO packaging conventions
MULTIPACK_REGEX = re.compile(
    r"(?P<count>\d+)\s*[xX*]\s*(?P<size>\d+(?:[.,]\d+)?)\s*(?P<unit>kg|g|gr|grammi|l|lt|litro|litri|ml|cl|dl|pz|pezzi)\b",
    re.IGNORECASE,
)

SINGLE_QUANTITY_REGEX = re.compile(
    r"(?P<size>\d+(?:[.,]\d+)?)\s*(?P<unit>kg|g|gr|grammi|etti|etto|l|lt|litro|litri|ml|cl|dl|pz|pezzi|confezione|conf)\b",
    re.IGNORECASE,
)


def _to_float(num_str: str) -> float:
    return float(num_str.replace(",", "."))


def normalize_unit_and_quantity(amount: float, unit: str) -> Tuple[float, str]:
    """Converts quantity and unit into standard base units ('g', 'ml', 'unit')."""
    u = unit.lower().strip()

    # Mass -> grams (g)
    if u in ("g", "gr", "grammi"):
        return amount, "g"
    elif u == "kg":
        return amount * 1000.0, "g"
    elif u in ("etto", "etti"):
        return amount * 100.0, "g"

    # Volume -> milliliters (ml)
    elif u == "ml":
        return amount, "ml"
    elif u == "cl":
        return amount * 10.0, "ml"
    elif u == "dl":
        return amount * 100.0, "ml"
    elif u in ("l", "lt", "litro", "litri"):
        return amount * 1000.0, "ml"

    # Count -> unit
    elif u in ("pz", "pezzi", "unit", "conf", "confezione"):
        return amount, "unit"

    return amount, "unit"


def parse_grocery_quantity(text: str) -> Optional[ParsedQuantity]:
    """Extracts package count, size and total normalized base quantity from a product title string."""
    # 1. Try multipack first (e.g. 6x1.5L, 4x330ml, 3x200gr)
    multi_match = MULTIPACK_REGEX.search(text)
    if multi_match:
        count = int(multi_match.group("count"))
        size = _to_float(multi_match.group("size"))
        unit = multi_match.group("unit").lower()
        base_size, base_unit = normalize_unit_and_quantity(size, unit)
        return ParsedQuantity(
            raw_match=multi_match.group(0),
            package_count=count,
            package_size=size,
            package_unit=unit,
            total_base_quantity=round(count * base_size, 2),
            base_unit=base_unit,
        )

    # 2. Try single quantity (e.g. 500g, 1,5 kg, 75 cl, 2 etti)
    single_match = SINGLE_QUANTITY_REGEX.search(text)
    if single_match:
        size = _to_float(single_match.group("size"))
        unit = single_match.group("unit").lower()
        base_size, base_unit = normalize_unit_and_quantity(size, unit)
        return ParsedQuantity(
            raw_match=single_match.group(0),
            package_count=1,
            package_size=size,
            package_unit=unit,
            total_base_quantity=round(base_size, 2),
            base_unit=base_unit,
        )

    return None
