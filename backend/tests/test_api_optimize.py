"""API integration tests for the /api/v1/shopping/optimize endpoint."""

from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_api_optimize_endpoint():
    payload = {
        "items": [
            {"item_id": "spaghetti", "name": "Spaghetti", "min_quantity": 1000, "base_unit": "g"}
        ],
        "stores": [
            {"store_id": "store_a", "name": "Esselunga", "chain": "Esselunga", "visit_cost": 1.00},
            {"store_id": "store_b", "name": "Lidl", "chain": "Lidl", "visit_cost": 1.00}
        ],
        "offers": [
            {
                "offer_id": "off_1", "store_id": "store_a", "item_id": "spaghetti",
                "variant_id": "var_barilla", "variant_name": "Spaghetti Barilla 500g",
                "package_price": 1.40, "package_base_quantity": 500
            },
            {
                "offer_id": "off_2", "store_id": "store_b", "item_id": "spaghetti",
                "variant_id": "var_combino", "variant_name": "Spaghetti Combino 500g",
                "package_price": 0.80, "package_base_quantity": 500
            }
        ],
        "config": {
            "max_stores": 1
        }
    }

    response = client.post("/api/v1/shopping/optimize", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "OPTIMAL"
    assert len(data["selected_stores"]) == 1
    assert data["selected_stores"][0]["store_id"] == "store_b"
    # 2 packs of Combino at 0.80 = 1.60 products + 1.00 visit = 2.60
    assert data["product_cost"] == 1.60
    assert data["travel_cost"] == 1.00
    assert data["total_cost"] == 2.60


def test_api_optimize_empty_items_validation():
    payload = {
        "items": [],
        "stores": [{"store_id": "s1", "name": "Test Store", "chain": "Test", "visit_cost": 1.0}],
        "offers": []
    }
    response = client.post("/api/v1/shopping/optimize", json=payload)
    assert response.status_code == 400
