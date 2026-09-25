from app.services import multimodal_service, woocommerce_service


def test_variable_product_normalizes_sellable_variant_facts():
    mapped = woocommerce_service._map_wc_product({
        "id": 42,
        "type": "variable",
        "name": "Trail shoe",
        "permalink": "https://shop.example/products/trail-shoe",
        "regular_price": "120.00",
        "stock_status": "instock",
        "variations": [{
            "id": 4201,
            "sku": "TRAIL-42-BLK",
            "price": "99.00",
            "stock_status": "instock",
            "stock_quantity": 3,
            "attributes": [{"name": "Size", "option": "42"}, {"name": "Color", "option": "Black"}],
            "permalink": "https://shop.example/products/trail-shoe?variation_id=4201",
        }],
    })

    variant = mapped["metadata"]["variations"][0]
    assert mapped["metadata"]["has_variants"] is True
    assert variant["id"] == 4201
    assert variant["sku"] == "TRAIL-42-BLK"
    assert variant["price"] == 99.0
    assert variant["in_stock"] is True
    assert variant["stock_quantity"] == 3
    assert variant["url"].endswith("variation_id=4201")


def test_product_context_requires_concrete_variant_card():
    context = multimodal_service.format_multimodal_context_for_prompt([{
        "id": "parent-42",
        "title": "Trail shoe",
        "price": 120.0,
        "currency": "USD",
        "url": "https://shop.example/products/trail-shoe",
        "metadata": {
            "in_stock": True,
            "variations": [{
                "id": 4201,
                "sku": "TRAIL-42-BLK",
                "price": 99.0,
                "in_stock": True,
                "attributes": [{"name": "Size", "option": "42"}],
                "url": "https://shop.example/products/trail-shoe?variation_id=4201",
            }],
        },
    }])

    assert "Concrete variants" in context
    assert "TRAIL-42-BLK" in context
    assert '"variant_id"' in context
    assert "concrete in-stock variant" in context
