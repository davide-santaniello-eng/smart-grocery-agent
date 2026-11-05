"""Unit tests for retailer price ingestion and normalization."""

from backend.app.ingestion.carrefour import CarrefourAlgoliaProvider


def test_carrefour_parse_hit_regular_item():
    provider = CarrefourAlgoliaProvider()

    mock_hit = {
        "objectID": "carrefour_1001",
        "name": "Spaghetti N. 5 Barilla 500g",
        "brand": "Barilla",
        "ean": "8076809513753",
        "pricing": {
            "price": 1.29,
            "original_price": 1.49,
            "is_promo": True,
            "discount_label": "-13%",
        },
        "images": ["https://images.carrefour.it/spaghetti_500g.jpg"],
    }

    offer = provider._parse_hit(mock_hit, store_id="store_carrefour_milano")

    assert offer is not None
    assert offer.provider == "carrefour_algolia"
    assert offer.external_id == "carrefour_1001"
    assert offer.store_id == "store_carrefour_milano"
    assert offer.name == "Spaghetti N. 5 Barilla 500g"
    assert offer.brand == "Barilla"
    assert offer.barcode == "8076809513753"
    assert offer.price == 1.29
    assert offer.standard_price == 1.49
    assert offer.is_promotion is True
    assert offer.package_size == 500.0
    assert offer.package_unit == "g"
    assert offer.base_quantity == 500.0
    assert offer.base_unit == "g"
    # 1.29 / 500 = 0.00258 €/g
    assert offer.price_per_base_unit == 0.00258
    assert offer.image_url == "https://images.carrefour.it/spaghetti_500g.jpg"


def test_carrefour_parse_hit_multipack_volume():
    provider = CarrefourAlgoliaProvider()

    mock_hit = {
        "objectID": "carrefour_2002",
        "name": "Acqua Minerale Naturale San Benedetto 6x1.5L",
        "brand": "San Benedetto",
        "ean": "8001620001004",
        "pricing": {
            "price": 2.10,
        },
    }

    offer = provider._parse_hit(mock_hit, store_id="store_carrefour_roma")

    assert offer is not None
    assert offer.price == 2.10
    assert offer.is_promotion is False
    assert offer.base_quantity == 9000.0
    assert offer.base_unit == "ml"
    # 2.10 / 9000 = 0.000233 €/ml
    assert round(offer.price_per_base_unit, 6) == 0.000233
