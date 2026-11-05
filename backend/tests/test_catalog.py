"""Unit tests for catalog entity resolution and quantity parsing."""

from backend.app.catalog.matcher import CandidateVariant, GroceryProductMatcher
from backend.app.catalog.parser import parse_grocery_quantity


def test_multipack_quantity_parsing():
    q1 = parse_grocery_quantity("Acqua San Benedetto 6x1.5L minerale")
    assert q1 is not None
    assert q1.package_count == 6
    assert q1.package_size == 1.5
    assert q1.package_unit == "l"
    assert q1.total_base_quantity == 9000.0
    assert q1.base_unit == "ml"

    q2 = parse_grocery_quantity("Birra Moretti 4x330ml bottiglia")
    assert q2 is not None
    assert q2.package_count == 4
    assert q2.package_size == 330.0
    assert q2.total_base_quantity == 1320.0
    assert q2.base_unit == "ml"


def test_italian_units_and_comma_parsing():
    q1 = parse_grocery_quantity("Spaghetti Barilla 500g")
    assert q1 is not None
    assert q1.total_base_quantity == 500.0
    assert q1.base_unit == "g"

    q2 = parse_grocery_quantity("Farina Tipo 0 1,5 kg")
    assert q2 is not None
    assert q2.total_base_quantity == 1500.0
    assert q2.base_unit == "g"

    q3 = parse_grocery_quantity("Prosciutto Crudo di Parma 2 etti")
    assert q3 is not None
    assert q3.total_base_quantity == 200.0
    assert q3.base_unit == "g"

    q4 = parse_grocery_quantity("Uova Fresche Conad 6 pz")
    assert q4 is not None
    assert q4.total_base_quantity == 6.0
    assert q4.base_unit == "unit"


def test_fuzzy_entity_resolution():
    catalog = [
        CandidateVariant(
            variant_id="var_barilla_500",
            product_id="prod_spaghetti",
            brand="Barilla",
            name="Spaghetti N. 5 Barilla 500g",
            base_quantity=500.0,
            base_unit="g",
        ),
        CandidateVariant(
            variant_id="var_barilla_1000",
            product_id="prod_spaghetti",
            brand="Barilla",
            name="Spaghetti N. 5 Barilla Formato Convenienza 1kg",
            base_quantity=1000.0,
            base_unit="g",
        ),
        CandidateVariant(
            variant_id="var_dececco_500",
            product_id="prod_spaghetti",
            brand="De Cecco",
            name="Spaghetti N. 12 De Cecco 500g",
            base_quantity=500.0,
            base_unit="g",
        ),
    ]

    matcher = GroceryProductMatcher(catalog)

    # Receipt raw text: "BARILLA SPAGH. N5 500G"
    matches = matcher.match("BARILLA SPAGH. N5 500G", top_k=3)
    assert len(matches) > 0
    top = matches[0]
    assert top.variant_id == "var_barilla_500"
    assert top.brand == "Barilla"
    assert top.quantity_matched is True
    assert top.score >= 0.80

    # Receipt raw text: "SPAGHETTI DE CECCO 500 GR"
    matches_dececco = matcher.match("SPAGHETTI DE CECCO 500 GR")
    assert matches_dececco[0].variant_id == "var_dececco_500"
