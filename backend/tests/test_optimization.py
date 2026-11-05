"""Unit tests for the Google OR-Tools grocery basket optimizer."""

import pytest
from backend.app.optimization.schemas import (
    ItemRequirement,
    OptimizationConfig,
    ProductOffer,
    Store,
)
from backend.app.optimization.solver import GroceryBasketOptimizer


@pytest.fixture
def sample_stores():
    return [
        Store(store_id="s_esselunga", name="Esselunga", chain="Esselunga", visit_cost=1.50),
        Store(store_id="s_lidl", name="Lidl", chain="Lidl", visit_cost=1.00),
    ]


def test_single_store_optimal(sample_stores):
    """When one store has everything cheaper including travel cost, pick that single store."""
    items = [
        ItemRequirement(item_id="pasta", name="Spaghetti", min_quantity=1000, base_unit="g"),
        ItemRequirement(item_id="latte", name="Latte UHT", min_quantity=2000, base_unit="ml"),
    ]

    offers = [
        # Esselunga offers (more expensive)
        ProductOffer(
            offer_id="o1", store_id="s_esselunga", item_id="pasta", variant_id="v_barilla",
            variant_name="Spaghetti Barilla 500g", brand="Barilla", package_price=1.40,
            package_base_quantity=500
        ),
        ProductOffer(
            offer_id="o2", store_id="s_esselunga", item_id="latte", variant_id="v_granarolo",
            variant_name="Latte Granarolo 1L", brand="Granarolo", package_price=1.60,
            package_base_quantity=1000
        ),
        # Lidl offers (cheaper)
        ProductOffer(
            offer_id="o3", store_id="s_lidl", item_id="pasta", variant_id="v_combino",
            variant_name="Spaghetti Combino 500g", brand="Combino", package_price=0.79,
            package_base_quantity=500
        ),
        ProductOffer(
            offer_id="o4", store_id="s_lidl", item_id="latte", variant_id="v_milsani",
            variant_name="Latte Milbona 1L", brand="Milbona", package_price=0.99,
            package_base_quantity=1000
        ),
    ]

    optimizer = GroceryBasketOptimizer(items=items, stores=sample_stores, offers=offers)
    result = optimizer.solve()

    assert result.status == "OPTIMAL"
    assert len(result.selected_stores) == 1
    assert result.selected_stores[0].store_id == "s_lidl"

    # Lidl: 2 packs pasta (2 * 0.79 = 1.58) + 2 packs latte (2 * 0.99 = 1.98) = 3.56 products + 1.00 visit = 4.56
    assert result.product_cost == 3.56
    assert result.travel_cost == 1.00
    assert result.total_cost == 4.56


def test_split_basket_cheaper_than_single_store():
    """When price disparities outweigh the second store visit cost, split the basket."""
    stores = [
        Store(store_id="s_coop", name="Coop", chain="Coop", visit_cost=1.00),
        Store(store_id="s_conad", name="Conad", chain="Conad", visit_cost=1.00),
    ]

    items = [
        ItemRequirement(item_id="olio", name="Olio EVO", min_quantity=1000, base_unit="ml"),
        ItemRequirement(item_id="caffe", name="Caffè", min_quantity=500, base_unit="g"),
    ]

    offers = [
        # Coop has huge promo on Olio (€6 vs €12), but expensive Caffè (€6 vs €3)
        ProductOffer(
            offer_id="o_olio_coop", store_id="s_coop", item_id="olio", variant_id="v_olio_1",
            variant_name="Olio EVO 1L", brand="Monini", package_price=6.00,
            package_base_quantity=1000, is_promotion=True
        ),
        ProductOffer(
            offer_id="o_caffe_coop", store_id="s_coop", item_id="caffe", variant_id="v_caffe_1",
            variant_name="Caffè 250g", brand="Lavazza", package_price=6.00,
            package_base_quantity=250
        ),
        # Conad has expensive Olio (€12), but cheap Caffè (€3)
        ProductOffer(
            offer_id="o_olio_conad", store_id="s_conad", item_id="olio", variant_id="v_olio_1",
            variant_name="Olio EVO 1L", brand="Monini", package_price=12.00,
            package_base_quantity=1000
        ),
        ProductOffer(
            offer_id="o_caffe_conad", store_id="s_conad", item_id="caffe", variant_id="v_caffe_1",
            variant_name="Caffè 250g", brand="Lavazza", package_price=3.00,
            package_base_quantity=250
        ),
    ]

    # Analysis:
    # Coop alone: Olio (6) + Caffè (2x6=12) + 1.00 = 19.00
    # Conad alone: Olio (12) + Caffè (2x3=6) + 1.00 = 19.00
    # Split basket: Olio at Coop (6) + Caffè at Conad (6) + 2 visits (2.00) = 14.00
    # Savings = 19.00 - 14.00 = 5.00

    optimizer = GroceryBasketOptimizer(
        items=items, stores=stores, offers=offers, config=OptimizationConfig(max_stores=2)
    )
    result = optimizer.solve()

    assert result.status == "OPTIMAL"
    assert len(result.selected_stores) == 2
    assert result.product_cost == 12.00
    assert result.travel_cost == 2.00
    assert result.total_cost == 14.00
    assert result.estimated_savings_vs_single_store == 5.00


def test_visit_cost_prevents_unprofitable_split():
    """If visit cost is higher than item savings, stay at a single store."""
    stores = [
        Store(store_id="s_store1", name="Store 1", chain="Chain 1", visit_cost=5.00),
        Store(store_id="s_store2", name="Store 2", chain="Chain 2", visit_cost=5.00),
    ]

    items = [
        ItemRequirement(item_id="latte", name="Latte", min_quantity=1000, base_unit="ml"),
        ItemRequirement(item_id="biscotti", name="Biscotti", min_quantity=500, base_unit="g"),
    ]

    offers = [
        # Store 1: Latte 1.20, Biscotti 2.00 -> Products: 3.20 + 5.00 visit = 8.20
        ProductOffer(offer_id="o1", store_id="s_store1", item_id="latte", variant_id="v1",
                     variant_name="Latte 1L", package_price=1.20, package_base_quantity=1000),
        ProductOffer(offer_id="o2", store_id="s_store1", item_id="biscotti", variant_id="v2",
                     variant_name="Biscotti 500g", package_price=2.00, package_base_quantity=500),
        # Store 2: Latte 1.00 (saves 0.20), Biscotti 2.20 -> Products: 3.20 + 5.00 visit = 8.20
        # If split: Latte from Store 2 (1.00), Biscotti from Store 1 (2.00) = 3.00 + 10.00 visits = 13.00!
        ProductOffer(offer_id="o3", store_id="s_store2", item_id="latte", variant_id="v1",
                     variant_name="Latte 1L", package_price=1.00, package_base_quantity=1000),
        ProductOffer(offer_id="o4", store_id="s_store2", item_id="biscotti", variant_id="v2",
                     variant_name="Biscotti 500g", package_price=2.20, package_base_quantity=500),
    ]

    optimizer = GroceryBasketOptimizer(items=items, stores=stores, offers=offers)
    result = optimizer.solve()

    assert result.status == "OPTIMAL"
    assert len(result.selected_stores) == 1
    assert result.travel_cost == 5.00
    assert result.total_cost == 8.20


def test_single_sku_per_item_enforced(sample_stores):
    """Ensure optimizer picks multiple packages of the SAME brand instead of mixing brands."""
    items = [
        ItemRequirement(item_id="pasta", name="Spaghetti", min_quantity=1000, base_unit="g"),
    ]

    offers = [
        # Store has Barilla 500g at 1.00 and De Cecco 500g at 1.40
        ProductOffer(offer_id="o_barilla", store_id="s_esselunga", item_id="pasta", variant_id="v_barilla",
                     variant_name="Barilla 500g", brand="Barilla", package_price=1.00, package_base_quantity=500),
        ProductOffer(offer_id="o_dececco", store_id="s_esselunga", item_id="pasta", variant_id="v_dececco",
                     variant_name="De Cecco 500g", brand="De Cecco", package_price=1.40, package_base_quantity=500),
    ]

    optimizer = GroceryBasketOptimizer(
        items=items, stores=sample_stores, offers=offers,
        config=OptimizationConfig(enforce_single_sku_per_item=True)
    )
    result = optimizer.solve()

    assert result.status == "OPTIMAL"
    store_alloc = result.selected_stores[0]
    assert len(store_alloc.items) == 1
    assert store_alloc.items[0].variant_id == "v_barilla"
    assert store_alloc.items[0].package_quantity == 2
    assert store_alloc.items[0].total_price == 2.00


def test_acceptable_brands_filtering(sample_stores):
    """When user restricts acceptable brands, ignore cheaper unaccepted brands."""
    items = [
        ItemRequirement(
            item_id="pasta", name="Spaghetti", min_quantity=1000, base_unit="g",
            acceptable_brands=["De Cecco"]
        ),
    ]

    offers = [
        # Barilla is cheaper (0.80) but not acceptable; De Cecco is 1.50
        ProductOffer(offer_id="o_barilla", store_id="s_esselunga", item_id="pasta", variant_id="v_barilla",
                     variant_name="Barilla 500g", brand="Barilla", package_price=0.80, package_base_quantity=500),
        ProductOffer(offer_id="o_dececco", store_id="s_esselunga", item_id="pasta", variant_id="v_dececco",
                     variant_name="De Cecco 500g", brand="De Cecco", package_price=1.50, package_base_quantity=500),
    ]

    optimizer = GroceryBasketOptimizer(items=items, stores=sample_stores, offers=offers)
    result = optimizer.solve()

    assert result.status == "OPTIMAL"
    store_alloc = result.selected_stores[0]
    assert store_alloc.items[0].brand == "De Cecco"
    assert store_alloc.items[0].package_quantity == 2
    assert store_alloc.items[0].total_price == 3.00


def test_infeasible_when_mandatory_item_missing(sample_stores):
    """When a mandatory item has no valid offers anywhere, report INFEASIBLE cleanly."""
    items = [
        ItemRequirement(item_id="caviale", name="Caviale Beluga", min_quantity=100, base_unit="g", is_mandatory=True),
    ]
    offers = []  # No offers

    optimizer = GroceryBasketOptimizer(items=items, stores=sample_stores, offers=offers)
    result = optimizer.solve()

    assert result.status == "INFEASIBLE"
    assert "caviale" in result.unfulfilled_items
