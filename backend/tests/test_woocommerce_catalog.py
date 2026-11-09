from app.services import multimodal_service, woocommerce_service
from types import SimpleNamespace

import asyncio


def test_sync_progress_persists_next_page_checkpoint(monkeypatch):
    captured = []

    class Table:
        def update(self, fields):
            captured.append(fields)
            return self

        def eq(self, *args):
            return self

        def execute(self):
            return SimpleNamespace(data=[])

    async def fake_run_db(callback):
        return callback()

    monkeypatch.setattr(woocommerce_service, "run_db", fake_run_db)
    monkeypatch.setattr(woocommerce_service, "supabase", SimpleNamespace(table=lambda _: Table()))

    asyncio.run(woocommerce_service._update_sync_progress(
        "bot-1", status="syncing", progress=47, synced=100, total=250, next_page=3
    ))

    assert captured[0]["sync_page"] == 3
    assert captured[0]["synced_products"] == 100
    assert captured[0]["sync_checkpoint_at"]


def test_variable_product_normalizes_sellable_variant_facts():
    mapped = woocommerce_service._map_wc_product({
        "id": 42,
        "type": "variable",
        "name": "Trail shoe",
        "permalink": "https://shop.example/products/trail-shoe",
        "regular_price": "120.00",
        "stock_status": "instock",
        "date_modified_gmt": "2026-09-25T10:00:00",
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
    assert mapped["source_updated_at"] == "2026-09-25T10:00:00"
    assert mapped["catalog_version"].startswith("woocommerce:42:")


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


def test_product_card_is_canonicalized_from_retrieved_variant_facts():
    reply = ('Here it is [PRODUCT_CARD:{"id":"42","variant_id":"4201",'
             '"title":"Wrong","price":"1","url":"https://evil.example/buy",'
             '"in_stock":true}]')
    sanitized = multimodal_service.sanitize_product_cards(reply, [{
        "id": "media-42", "title": "Trail shoe", "price": 120.0, "currency": "USD",
        "url": "https://shop.example/products/trail-shoe",
        "thumbnail_url": "https://shop.example/images/trail.jpg",
        "metadata": {"woocommerce_id": 42, "in_stock": True, "variations": [{
            "id": 4201, "sku": "TRAIL-42-BLK", "price": 99.0, "in_stock": True,
            "url": "https://shop.example/products/trail-shoe?variation_id=4201",
        }]},
    }])
    assert '"title":"Trail shoe"' in sanitized
    assert '"price":99.0' in sanitized
    assert "evil.example" not in sanitized
    assert "TRAIL-42-BLK" in sanitized


def test_variable_product_card_resolves_unambiguous_query_variant():
    reply = '[PRODUCT_CARD:{"id":"42","title":"Trail shoe"}]'
    item = {
        "id": "media-42", "title": "Trail shoe", "price": 120.0,
        "currency": "USD", "url": "https://shop.example/products/trail-shoe",
        "metadata": {
            "source": "woocommerce", "woocommerce_id": 42,
            "live_check_status": "fresh", "live_variant_ids": ["4201", "4202"],
            "variations": [
                {"id": 4201, "sku": "TRAIL-42-BLK", "price": 99.0, "in_stock": True,
                 "attributes": [{"name": "Size", "option": "42"}, {"name": "Color", "option": "Black"}],
                 "url": "https://shop.example/products/trail-shoe?variation_id=4201"},
                {"id": 4202, "sku": "TRAIL-41-WHT", "price": 95.0, "in_stock": True,
                 "attributes": [{"name": "Size", "option": "41"}, {"name": "Color", "option": "White"}],
                 "url": "https://shop.example/products/trail-shoe?variation_id=4202"},
            ],
        },
    }
    sanitized = multimodal_service.sanitize_product_cards(reply, [item], query_text="I need size 42 in black")
    assert '"variant_id":"4201"' in sanitized
    assert '"price":99.0' in sanitized


def test_variable_product_card_is_suppressed_when_variant_is_ambiguous():
    reply = '[PRODUCT_CARD:{"id":"42","title":"Trail shoe"}]'
    item = {
        "id": "media-42", "title": "Trail shoe", "metadata": {
            "source": "woocommerce", "woocommerce_id": 42, "live_check_status": "fresh",
            "live_variant_ids": ["4201", "4202"],
            "variations": [
                {"id": 4201, "price": 99.0, "in_stock": True},
                {"id": 4202, "price": 95.0, "in_stock": True},
            ],
        },
    }
    sanitized = multimodal_service.sanitize_product_cards(reply, [item], query_text="show me this shoe")
    assert "PRODUCT_CARD" not in sanitized


def test_single_available_variant_does_not_override_conflicting_query():
    reply = '[PRODUCT_CARD:{"id":"42","title":"Trail shoe"}]'
    item = {"id": "media-42", "title": "Trail shoe", "metadata": {
        "source": "woocommerce", "woocommerce_id": 42, "live_check_status": "fresh",
        "live_variant_ids": ["4201"],
        "variations": [{"id": 4201, "price": 99.0, "in_stock": True,
                        "attributes": [{"name": "Color", "option": "Blue"}]}],
    }}
    sanitized = multimodal_service.sanitize_product_cards(reply, [item], query_text="I need red")
    assert "PRODUCT_CARD" not in sanitized


def test_live_woocommerce_refresh_updates_facts_and_preserves_snapshot_on_failure(monkeypatch):
    item = {
        "title": "Trail shoe",
        "price": 120.0,
        "metadata": {"source": "woocommerce", "woocommerce_id": 42, "in_stock": True},
    }
    monkeypatch.setattr(woocommerce_service, "get_integration", lambda bot_id: asyncio.sleep(0, result={
        "store_url": "https://shop.example",
        "consumer_key": "ck_read",
        "consumer_secret": "cs_read",
    }))

    class FakeResponse:
        status_code = 200

        def json(self):
            return {
                "id": 42,
                "name": "Trail shoe",
                "price": "99.00",
                "stock_status": "outofstock",
                "status": "publish",
            }

    async def fake_request(client, method, url, **kwargs):
        assert url.endswith("/products/42")
        return FakeResponse()

    monkeypatch.setattr(woocommerce_service.ssrf, "request_async", fake_request)
    refreshed = asyncio.run(woocommerce_service.refresh_live_product_facts("bot-1", [item]))
    assert refreshed[0]["price"] == 99.0
    assert refreshed[0]["metadata"]["in_stock"] is False
    assert refreshed[0]["metadata"]["live_check_status"] == "fresh"


def test_live_woocommerce_refresh_expands_variable_product_facts(monkeypatch):
    item = {
        "price": 120.0,
        "currency": "USD",
        "metadata": {"source": "woocommerce", "woocommerce_id": 42, "variations": [{"id": 4201, "price": 120.0}]},
    }
    monkeypatch.setattr(woocommerce_service, "get_integration", lambda bot_id: asyncio.sleep(0, result={
        "store_url": "https://shop.example", "consumer_key": "ck", "consumer_secret": "cs",
    }))

    class Response:
        def __init__(self, payload): self.status_code, self.payload = 200, payload
        def json(self): return self.payload

    async def fake_request(client, method, url, **kwargs):
        if url.endswith("/products/42"):
            return Response({"id": 42, "type": "variable", "name": "Trail shoe", "price": "120", "stock_status": "instock", "variations": [4201]})
        assert url.endswith("/products/42/variations")
        return Response([{"id": 4201, "sku": "TRAIL-42", "price": "99", "stock_status": "instock", "attributes": [{"name": "Size", "option": "42"}]}])

    monkeypatch.setattr(woocommerce_service.ssrf, "request_async", fake_request)
    refreshed = asyncio.run(woocommerce_service.refresh_live_product_facts("bot-1", [item]))
    assert refreshed[0]["metadata"]["live_variant_ids"] == ["4201"]
    assert refreshed[0]["metadata"]["variations"][0]["price"] == 99.0


def test_search_reapplies_stock_filter_after_live_refresh(monkeypatch):
    item = {
        "id": "item-1",
        "title": "Trail shoe",
        "similarity": 0.9,
        "metadata": {"source": "woocommerce", "woocommerce_id": 42, "in_stock": True},
    }

    async def fake_embed(_text, **kwargs):
        return [0.1]

    async def fake_refresh(bot_id, items):
        items[0]["metadata"]["in_stock"] = False
        return items

    monkeypatch.setattr(multimodal_service, "embed_multimodal_text", fake_embed)
    monkeypatch.setattr(multimodal_service, "run_db", lambda callback: asyncio.sleep(0, result=SimpleNamespace(data=[item])))
    monkeypatch.setattr(multimodal_service, "supabase", SimpleNamespace(
        rpc=lambda *args: SimpleNamespace(execute=lambda: SimpleNamespace(data=[])),
        table=lambda *args: SimpleNamespace(select=lambda *a: SimpleNamespace(eq=lambda *b: SimpleNamespace(limit=lambda *c: SimpleNamespace(execute=lambda: SimpleNamespace(data=[])))))
    ))
    monkeypatch.setattr(woocommerce_service, "refresh_live_product_facts", fake_refresh)
    results, _ = asyncio.run(multimodal_service.search_multimodal_catalog(bot_id="bot-1", query_text="shoe"))
    assert results == []



def test_search_products_live_filters_by_price_sale_and_category(monkeypatch):
    monkeypatch.setattr(woocommerce_service, "get_integration", lambda bot_id: asyncio.sleep(0, result={
        "store_url": "https://shop.example",
        "consumer_key": "ck_read",
        "consumer_secret": "cs_read",
    }))
    monkeypatch.setattr(
        woocommerce_service,
        "run_db",
        lambda callback: asyncio.sleep(0, result=SimpleNamespace(data=[])),
    )

    class Response:
        def __init__(self, payload):
            self.status_code = 200
            self.payload = payload

        def json(self):
            return self.payload

    captured_params = {}

    async def fake_request(client, method, url, **kwargs):
        if url.endswith("/products/categories"):
            return Response([{"id": 9, "name": "Hoodies", "slug": "hoodies", "count": 4}])
        if url.endswith("/products"):
            captured_params.update(kwargs.get("params") or {})
            return Response([
                {
                    "id": 77,
                    "type": "simple",
                    "name": "Fleece Pullover Hoodie",
                    "sku": "HD-77",
                    "price": "39.00",
                    "regular_price": "59.00",
                    "sale_price": "39.00",
                    "on_sale": True,
                    "stock_status": "instock",
                    "permalink": "https://shop.example/products/fleece-hoodie",
                    "images": [{"src": "https://shop.example/images/hoodie.jpg"}],
                    "categories": [{"id": 9, "name": "Hoodies"}],
                    "short_description": "<p>Warm fleece pullover hoodie.</p>",
                }
            ])
        raise AssertionError(f"Unexpected URL: {url}")

    monkeypatch.setattr(woocommerce_service.ssrf, "request_async", fake_request)

    res = asyncio.run(
        woocommerce_service.search_products_live(
            "bot-1",
            category="Hoodies",
            max_price=50.0,
            on_sale=True,
            sort_by="price_asc",
        )
    )
    assert res["found"] is True
    assert res["count"] == 1
    assert captured_params["category"] == "9"
    assert captured_params["max_price"] == "50.0"
    assert captured_params["on_sale"] == "true"
    assert captured_params["orderby"] == "price"
    assert captured_params["order"] == "asc"
    prod = res["products"][0]
    assert prod["title"] == "Fleece Pullover Hoodie"
    assert prod["price"] == 39.0
    assert prod["on_sale"] is True
    assert prod["product_card_token"].startswith("[PRODUCT_CARD:")
    sanitized = multimodal_service.sanitize_product_cards(
        f"Here is a hoodie on sale: {prod['product_card_token']}",
        res["_catalog_items"],
    )
    assert '"title":"Fleece Pullover Hoodie"' in sanitized
    assert '"price":39.0' in sanitized


def test_get_store_info_live_validates_coupon_and_lists_categories(monkeypatch):
    monkeypatch.setattr(woocommerce_service, "get_integration", lambda bot_id: asyncio.sleep(0, result={
        "store_url": "https://shop.example",
        "consumer_key": "ck_read",
        "consumer_secret": "cs_read",
    }))

    class Response:
        def __init__(self, payload):
            self.status_code = 200
            self.payload = payload

        def json(self):
            return self.payload

    async def fake_request(client, method, url, **kwargs):
        if url.endswith("/products/categories"):
            return Response([{"id": 3, "name": "Skincare", "slug": "skincare", "count": 12, "description": "Natural skincare"}])
        if url.endswith("/coupons"):
            assert kwargs.get("params", {}).get("code") == "SAVE20"
            return Response([{
                "id": 10,
                "code": "save20",
                "amount": "20.00",
                "discount_type": "percent",
                "description": "20% off orders over $50",
                "minimum_amount": "50.00",
                "free_shipping": True,
                "usage_limit": 100,
                "usage_count": 14,
                "date_expires_gmt": "2099-12-31T23:59:59",
            }])
        raise AssertionError(f"Unexpected URL: {url}")

    monkeypatch.setattr(woocommerce_service.ssrf, "request_async", fake_request)

    cats = asyncio.run(woocommerce_service.get_store_info_live("bot-1", info_type="categories"))
    assert cats["found"] is True
    assert cats["categories"][0]["name"] == "Skincare"
    assert cats["categories"][0]["count"] == 12

    coupon = asyncio.run(woocommerce_service.get_store_info_live("bot-1", info_type="coupon", coupon_code="SAVE20"))
    assert coupon["found"] is True
    assert coupon["valid"] is True
    assert coupon["discount_type"] == "percent"
    assert coupon["amount"] == "20.00"
    assert coupon["free_shipping"] is True



def test_get_store_info_live_supports_payment_methods_shipping_locations_attributes_and_taxes(monkeypatch):
    monkeypatch.setattr(woocommerce_service, "get_integration", lambda bot_id: asyncio.sleep(0, result={
        "store_url": "https://shop.example",
        "consumer_key": "ck_read",
        "consumer_secret": "cs_read",
    }))

    class Response:
        def __init__(self, payload):
            self.status_code = 200
            self.payload = payload

        def json(self):
            return self.payload

    async def fake_request(client, method, url, **kwargs):
        if url.endswith("/payment_gateways"):
            return Response([
                {"id": "stripe", "title": "Credit / Debit Card (Stripe)", "description": "Pay securely via Stripe", "enabled": True},
                {"id": "cheque", "title": "Check payments", "enabled": False},
            ])
        if url.endswith("/shipping/zones"):
            return Response([{"id": 1, "name": "North America"}])
        if url.endswith("/shipping/zones/1/locations"):
            return Response([{"code": "US", "type": "country"}, {"code": "CA", "type": "country"}])
        if url.endswith("/shipping/zones/1/methods"):
            return Response([{
                "id": 11,
                "title": "Free Shipping",
                "method_id": "free_shipping",
                "enabled": True,
                "settings": {"min_amount": {"value": "75.00"}},
            }])
        if url.endswith("/products/shipping_classes"):
            return Response([{"name": "Express", "slug": "express", "description": "1-2 day air"}])
        if url.endswith("/products/attributes"):
            return Response([{"id": 5, "name": "Size", "slug": "pa_size"}])
        if url.endswith("/products/attributes/5/terms"):
            return Response([{"name": "Large", "slug": "large", "count": 8}])
        if url.endswith("/settings/general"):
            return Response([{"id": "woocommerce_currency", "value": "USD"}, {"id": "woocommerce_calc_taxes", "value": "yes"}])
        if url.endswith("/settings/products"):
            return Response([{"id": "woocommerce_weight_unit", "value": "kg"}, {"id": "woocommerce_dimension_unit", "value": "cm"}])
        if url.endswith("/taxes"):
            return Response([{"country": "US", "state": "NY", "rate": "8.8750", "name": "NY Sales Tax", "shipping": True}])
        raise AssertionError(f"Unexpected URL: {url}")

    monkeypatch.setattr(woocommerce_service.ssrf, "request_async", fake_request)

    pm = asyncio.run(woocommerce_service.get_store_info_live("bot-1", info_type="payment_methods"))
    assert pm["found"] is True
    assert pm["count"] == 1
    assert pm["payment_methods"][0]["id"] == "stripe"

    ship = asyncio.run(woocommerce_service.get_store_info_live("bot-1", info_type="shipping"))
    assert ship["found"] is True
    assert ship["zones"][0]["locations"] == [{"code": "US", "type": "country"}, {"code": "CA", "type": "country"}]
    assert ship["zones"][0]["methods"][0]["min_amount_for_free_shipping"] == "75.00"
    assert ship["shipping_classes"][0]["slug"] == "express"

    attrs = asyncio.run(woocommerce_service.get_store_info_live("bot-1", info_type="attributes"))
    assert attrs["found"] is True
    assert attrs["attributes"][0]["name"] == "Size"
    assert attrs["attributes"][0]["terms"][0]["name"] == "Large"

    taxes = asyncio.run(woocommerce_service.get_store_info_live("bot-1", info_type="taxes_and_policies"))
    assert taxes["found"] is True
    assert taxes["store_settings"]["woocommerce_weight_unit"] == "kg"
    assert taxes["tax_rates"][0]["rate_percent"] == "8.8750"



def test_search_products_live_supports_tag_featured_sku_and_date_ordering(monkeypatch):
    monkeypatch.setattr(woocommerce_service, "get_integration", lambda bot_id: asyncio.sleep(0, result={
        "store_url": "https://shop.example",
        "consumer_key": "ck_read",
        "consumer_secret": "cs_read",
    }))
    monkeypatch.setattr(
        woocommerce_service,
        "run_db",
        lambda callback: asyncio.sleep(0, result=SimpleNamespace(data=[])),
    )

    class Response:
        def __init__(self, payload):
            self.status_code = 200
            self.payload = payload

        def json(self):
            return self.payload

    captured_calls = []

    async def fake_request(client, method, url, **kwargs):
        captured_calls.append((method, url, kwargs.get("params") or {}))
        if url.endswith("/products/tags"):
            return Response([{"id": 15, "name": "Summer Collection", "slug": "summer-collection", "count": 9}])
        if url.endswith("/products"):
            return Response([
                {
                    "id": 88,
                    "type": "simple",
                    "name": "Linen Resort Shirt",
                    "sku": "LINEN-88",
                    "price": "65.00",
                    "regular_price": "65.00",
                    "featured": True,
                    "on_sale": False,
                    "stock_status": "instock",
                    "permalink": "https://shop.example/products/linen-shirt",
                    "images": [{"src": "https://shop.example/images/linen.jpg"}],
                    "tags": [{"id": 15, "name": "Summer Collection"}],
                }
            ])
        raise AssertionError(f"Unexpected URL: {url}")

    monkeypatch.setattr(woocommerce_service.ssrf, "request_async", fake_request)

    res = asyncio.run(
        woocommerce_service.search_products_live(
            "bot-1",
            tag="summer-collection",
            featured=True,
            sku="LINEN-88",
            sort_by="date",
            in_stock_only=True,
        )
    )
    assert res["found"] is True
    assert res["count"] == 1
    assert res["products"][0]["featured"] is True
    prod_call = [c for c in captured_calls if c[1].endswith("/products")][0]
    assert prod_call[0] == "GET"
    assert prod_call[2]["tag"] == "15"
    assert prod_call[2]["featured"] == "true"
    assert prod_call[2]["sku"] == "LINEN-88"
    assert prod_call[2]["stock_status"] == "instock"
    assert prod_call[2]["orderby"] == "date"
    assert prod_call[2]["order"] == "desc"


def test_get_product_variations_live_list_and_single_variation(monkeypatch):
    monkeypatch.setattr(woocommerce_service, "get_integration", lambda bot_id: asyncio.sleep(0, result={
        "store_url": "https://shop.example",
        "consumer_key": "ck_read",
        "consumer_secret": "cs_read",
    }))

    class Response:
        def __init__(self, payload):
            self.status_code = 200
            self.payload = payload

        def json(self):
            return self.payload

    async def fake_request(client, method, url, **kwargs):
        assert method == "GET"
        if url.endswith("/products/42"):
            return Response({
                "id": 42,
                "name": "Trail Runner Pro",
                "permalink": "https://shop.example/products/trail-runner-pro",
                "currency": "USD",
            })
        if url.endswith("/products/42/variations"):
            return Response([
                {
                    "id": 4201,
                    "sku": "TRP-42-BLK",
                    "price": "110.00",
                    "regular_price": "130.00",
                    "sale_price": "110.00",
                    "on_sale": True,
                    "stock_status": "instock",
                    "stock_quantity": 7,
                    "attributes": [{"name": "Size", "option": "42"}, {"name": "Color", "option": "Black"}],
                },
                {
                    "id": 4202,
                    "sku": "TRP-43-BLU",
                    "price": "110.00",
                    "stock_status": "outofstock",
                    "stock_quantity": 0,
                    "attributes": [{"name": "Size", "option": "43"}, {"name": "Color", "option": "Blue"}],
                },
            ])
        if url.endswith("/products/42/variations/4201"):
            return Response({
                "id": 4201,
                "sku": "TRP-42-BLK",
                "price": "110.00",
                "regular_price": "130.00",
                "sale_price": "110.00",
                "on_sale": True,
                "stock_status": "instock",
                "stock_quantity": 7,
                "attributes": [{"name": "Size", "option": "42"}, {"name": "Color", "option": "Black"}],
            })
        raise AssertionError(f"Unexpected URL: {url}")

    monkeypatch.setattr(woocommerce_service.ssrf, "request_async", fake_request)

    # 1. All variations: GET /products/{id}/variations
    all_vars = asyncio.run(woocommerce_service.get_product_variations_live("bot-1", "42"))
    assert all_vars["found"] is True
    assert all_vars["count"] == 2
    assert all_vars["variations"][0]["sku"] == "TRP-42-BLK"
    assert all_vars["variations"][0]["in_stock"] is True

    # 2. Single variation: GET /products/{id}/variations/{variation_id} via get_store_info_live(info_type="variations")
    single_var = asyncio.run(
        woocommerce_service.get_store_info_live("bot-1", info_type="variations", product_id="42", variation_id="4201")
    )
    assert single_var["found"] is True
    assert single_var["variation_id"] == 4201
    assert single_var["variation"]["sku"] == "TRP-42-BLK"
    assert single_var["variation"]["price"] == 110.0


def test_get_store_info_live_single_resource_endpoints(monkeypatch):
    """Verify single-ID read-only endpoints for categories/{id}, tags/{id}, attributes/{id}/terms/{term_id},
    reviews/{id} + product rating summary, shipping/zones/{id}, payment_gateways/{id} (sanitized), and coupons/{id}."""
    monkeypatch.setattr(woocommerce_service, "get_integration", lambda bot_id: asyncio.sleep(0, result={
        "store_url": "https://shop.example",
        "consumer_key": "ck_read",
        "consumer_secret": "cs_read",
    }))

    class Response:
        def __init__(self, payload):
            self.status_code = 200
            self.payload = payload

        def json(self):
            return self.payload

    async def fake_request(client, method, url, **kwargs):
        assert method == "GET"
        if url.endswith("/products/categories/3"):
            return Response({"id": 3, "name": "Skincare", "slug": "skincare", "count": 12, "parent": 0, "description": "<p>Clean beauty</p>"})
        if url.endswith("/products/tags/15"):
            return Response({"id": 15, "name": "Vegan", "slug": "vegan", "count": 8, "description": "100% plant-based"})
        if url.endswith("/products/attributes/5"):
            return Response({"id": 5, "name": "Color", "slug": "pa_color", "type": "select"})
        if url.endswith("/products/attributes/5/terms/22"):
            return Response({"id": 22, "name": "Emerald Green", "slug": "emerald-green", "count": 4, "description": "Rich green"})
        if url.endswith("/products/reviews/501"):
            return Response({
                "id": 501,
                "product_id": 42,
                "reviewer": "Liam K.",
                "rating": 5,
                "review": "<p>Best running shoes I have owned!</p>",
                "verified": True,
                "status": "approved",
                "date_created": "2026-10-01T12:00:00",
            })
        if url.endswith("/products/42"):
            return Response({
                "id": 42,
                "name": "Trail Runner Pro",
                "average_rating": "4.85",
                "rating_count": 27,
                "reviews_allowed": True,
            })
        if url.endswith("/shipping/zones/2"):
            return Response({"id": 2, "name": "Europe", "order": 1})
        if url.endswith("/shipping/zones/2/locations"):
            return Response([{"code": "DE", "type": "country"}, {"code": "FR", "type": "country"}])
        if url.endswith("/shipping/zones/2/methods"):
            return Response([{
                "id": 21,
                "title": "DHL Express",
                "method_id": "flat_rate",
                "enabled": True,
                "settings": {"cost": {"value": "14.99"}},
            }])
        if url.endswith("/products/shipping_classes"):
            return Response([{"id": 7, "name": "Standard Parcel", "slug": "standard-parcel", "count": 30}])
        if url.endswith("/payment_gateways/stripe"):
            return Response({
                "id": "stripe",
                "title": "Credit Card (Stripe)",
                "description": "Pay with Visa, Mastercard, or Amex",
                "enabled": True,
                "method_title": "Stripe",
                "method_supports": ["products", "refunds"],
                "settings": {
                    "secret_key": {"value": "sk_live_SUPER_SECRET_DO_NOT_LEAK"},
                    "webhook_secret": {"value": "whsec_SUPER_SECRET"},
                },
            })
        if url.endswith("/coupons/10"):
            return Response({
                "id": 10,
                "code": "welcome15",
                "amount": "15.00",
                "discount_type": "percent",
                "description": "15% welcome discount",
                "minimum_amount": "30.00",
                "free_shipping": False,
            })
        raise AssertionError(f"Unexpected URL: {url}")

    monkeypatch.setattr(woocommerce_service.ssrf, "request_async", fake_request)

    # Category by ID
    cat = asyncio.run(woocommerce_service.get_store_info_live("bot-1", info_type="categories", category_id="3"))
    assert cat["found"] is True
    assert cat["category"]["id"] == 3
    assert cat["category"]["name"] == "Skincare"
    assert cat["category"]["description"] == "Clean beauty"

    # Tag by ID
    tag = asyncio.run(woocommerce_service.get_store_info_live("bot-1", info_type="tags", tag_id="15"))
    assert tag["found"] is True
    assert tag["tag"]["id"] == 15
    assert tag["tag"]["slug"] == "vegan"

    # Attribute + specific term by ID
    attr = asyncio.run(
        woocommerce_service.get_store_info_live("bot-1", info_type="attributes", attribute_id="5", term_id="22")
    )
    assert attr["found"] is True
    assert attr["attribute"]["name"] == "Color"
    assert attr["term"]["id"] == 22
    assert attr["term"]["name"] == "Emerald Green"

    # Review by ID + product rating summary from GET /products/{id}
    rev = asyncio.run(woocommerce_service.get_store_info_live("bot-1", info_type="reviews", review_id="501"))
    assert rev["found"] is True
    assert rev["review"]["id"] == 501
    assert rev["review"]["rating"] == 5
    assert rev["product_rating_summary"]["average_rating"] == "4.85"
    assert rev["product_rating_summary"]["rating_count"] == 27

    # Shipping zone by ID
    zone = asyncio.run(woocommerce_service.get_store_info_live("bot-1", info_type="shipping", zone_id="2"))
    assert zone["found"] is True
    assert zone["zone"]["id"] == 2
    assert zone["zone"]["name"] == "Europe"
    assert zone["zone"]["methods"][0]["cost"] == "14.99"

    # Payment gateway by ID (must strip secret settings!)
    gw = asyncio.run(woocommerce_service.get_store_info_live("bot-1", info_type="payment_methods", gateway_id="stripe"))
    assert gw["found"] is True
    assert gw["payment_method"]["id"] == "stripe"
    assert "settings" not in gw["payment_method"]
    assert "sk_live" not in str(gw)

    # Coupon by ID + anti-enumeration guard when neither code nor ID is given
    cpn = asyncio.run(woocommerce_service.get_store_info_live("bot-1", info_type="coupon", coupon_id="10"))
    assert cpn["found"] is True
    assert cpn["code"] == "WELCOME15"
    assert "checkout_note" in cpn

    no_enum = asyncio.run(woocommerce_service.get_store_info_live("bot-1", info_type="coupon"))
    assert no_enum["found"] is False
    assert "ask the visitor for the exact coupon code" in no_enum["message"]


def test_lookup_customer_profile_enforces_strict_ownership_verification(monkeypatch):
    monkeypatch.setattr(woocommerce_service, "get_integration", lambda bot_id: asyncio.sleep(0, result={
        "store_url": "https://shop.example",
        "consumer_key": "ck_read",
        "consumer_secret": "cs_read",
    }))

    class Response:
        def __init__(self, payload):
            self.status_code = 200
            self.payload = payload

        def json(self):
            return self.payload

    async def fake_request(client, method, url, **kwargs):
        assert method == "GET"
        if url.endswith("/customers/55"):
            return Response({
                "id": 55,
                "email": "alice@example.com",
                "first_name": "Alice",
                "last_name": "Carter",
                "username": "alicec",
                "date_created": "2025-01-10T08:00:00",
                "is_paying_customer": True,
                "orders_count": 4,
                "total_spent": "320.00",
                "billing": {
                    "first_name": "Alice",
                    "last_name": "Carter",
                    "email": "alice@example.com",
                    "phone": "+1-555-234-5678",
                    "city": "Austin",
                    "state": "TX",
                    "postcode": "78701",
                    "country": "US",
                },
                "shipping": {
                    "first_name": "Alice",
                    "last_name": "Carter",
                    "city": "Austin",
                    "state": "TX",
                    "postcode": "78701",
                    "country": "US",
                },
            })
        raise AssertionError(f"Unexpected URL: {url}")

    monkeypatch.setattr(woocommerce_service.ssrf, "request_async", fake_request)

    # 1. Missing email/phone -> rejected before calling API
    unverified = asyncio.run(woocommerce_service.lookup_customer_profile("bot-1", customer_id="55"))
    assert unverified["found"] is False
    assert unverified["verification_required"] is True

    # 2. Wrong email for customer_id 55 -> ownership check blocks access
    wrong_owner = asyncio.run(
        woocommerce_service.lookup_customer_profile("bot-1", customer_id="55", email="intruder@evil.com")
    )
    assert wrong_owner["found"] is False
    assert wrong_owner["verification_failed"] is True

    # 3. Matching email for customer_id 55 -> returns sanitized customer profile
    valid_owner = asyncio.run(
        woocommerce_service.lookup_customer_profile("bot-1", customer_id="55", email="alice@example.com")
    )
    assert valid_owner["found"] is True
    assert valid_owner["verified"] is True
    assert valid_owner["customer"]["id"] == 55
    assert valid_owner["customer"]["email"] == "alice@example.com"
    assert valid_owner["customer"]["orders_count"] == 4


def test_order_lookup_fetches_notes_refunds_and_shipping_subendpoint(monkeypatch):
    monkeypatch.setattr(woocommerce_service, "get_integration", lambda bot_id: asyncio.sleep(0, result={
        "store_url": "https://shop.example",
        "consumer_key": "ck_read",
        "consumer_secret": "cs_read",
    }))

    class Response:
        def __init__(self, payload, status_code=200):
            self.status_code = status_code
            self.payload = payload

        def json(self):
            return self.payload

    async def fake_request(client, method, url, **kwargs):
        assert method == "GET"
        if url.endswith("/orders/1042"):
            return Response({
                "id": 1042,
                "number": "1042",
                "status": "completed",
                "currency": "USD",
                "total": "120.00",
                "total_tax": "10.00",
                "shipping_total": "0.00",
                "discount_total": "0.00",
                "date_created": "2026-10-15T10:00:00",
                "billing": {
                    "first_name": "Alice",
                    "last_name": "Carter",
                    "email": "alice@example.com",
                    "phone": "+15552345678",
                },
                "shipping": {
                    "first_name": "Alice",
                    "last_name": "Carter",
                    "city": "Austin",
                    "state": "TX",
                    "country": "US",
                },
                "line_items": [{"name": "Trail Runner Pro", "quantity": 1, "total": "110.00", "sku": "TRP-42"}],
                "meta_data": [],
            })
        if url.endswith("/orders/1042/notes"):
            return Response([
                {"id": 1, "customer_note": True, "note": "<p>Handed to UPS courier at hub.</p>", "date_created": "2026-10-16T09:00:00"},
                {"id": 2, "customer_note": False, "note": "Internal staff note - never expose", "date_created": "2026-10-16T08:00:00"},
            ])
        if url.endswith("/orders/1042/refunds"):
            return Response([
                {"id": 901, "amount": "15.00", "reason": "Courtesy shipping adjustment", "date_created": "2026-10-17T11:00:00"}
            ])
        if url.endswith("/orders/1042/shipping"):
            return Response([
                {"carrier": "UPS", "tracking_number": "1Z999AA10123456784", "status": "in_transit"}
            ])
        raise AssertionError(f"Unexpected URL: {url}")

    monkeypatch.setattr(woocommerce_service.ssrf, "request_async", fake_request)

    order = asyncio.run(
        woocommerce_service.lookup_order("bot-1", "1042", email="alice@example.com")
    )
    assert order["found"] is True
    assert order["verified"] is True
    assert len(order["customer_notes"]) == 1
    assert "Handed to UPS courier" in order["customer_notes"][0]["note"]
    assert "Internal staff note" not in str(order)
    assert len(order["refunds"]) == 1
    assert order["refunds"][0]["amount"] == "15.00"
    assert len(order["shipping_details"]["extension_shipments"]) == 1
    assert order["shipping_details"]["extension_shipments"][0]["carrier"] == "UPS"



def test_agent_tools_and_router_expose_all_readonly_woocommerce_capabilities(monkeypatch):
    from plugins import agent_tools
    from app.routers import woocommerce as wc_router

    tool_names = {d["function"]["name"] for d in agent_tools.DECLARATIONS}
    assert "lookup_woocommerce_order" in tool_names
    assert "lookup_woocommerce_customer" in tool_names
    assert "search_woocommerce_products" in tool_names
    assert "get_woocommerce_store_info" in tool_names

    store_info_schema = next(
        d["function"]["parameters"]
        for d in agent_tools.DECLARATIONS
        if d["function"]["name"] == "get_woocommerce_store_info"
    )
    assert "variations" in store_info_schema["properties"]["info_type"]["enum"]
    for param in (
        "variation_id",
        "category_id",
        "tag_id",
        "attribute_id",
        "term_id",
        "review_id",
        "zone_id",
        "gateway_id",
        "coupon_id",
    ):
        assert param in store_info_schema["properties"]

    async def fake_verify_perm(bot_id, user, perm):
        return True

    monkeypatch.setattr(wc_router, "verify_bot_permission", fake_verify_perm)
    monkeypatch.setattr(
        woocommerce_service,
        "get_product_variations_live",
        lambda bot_id, product_id, variation_id=None: asyncio.sleep(
            0,
            result={"found": True, "product_id": product_id, "variation_id": variation_id, "variations": [{"id": 4201}]},
        ),
    )
    monkeypatch.setattr(
        woocommerce_service,
        "lookup_customer_profile",
        lambda bot_id, customer_id=None, email=None, phone=None: asyncio.sleep(
            0,
            result={"found": True, "verified": True, "customer": {"id": customer_id, "email": email}},
        ),
    )

    var_res = asyncio.run(
        wc_router.get_woocommerce_single_variation_endpoint(
            "bot-1", "42", "4201", user={"id": "u1"}
        )
    )
    assert var_res["found"] is True
    assert var_res["variation_id"] == "4201"

    cust_res = asyncio.run(
        wc_router.lookup_woocommerce_customer_endpoint(
            "bot-1",
            wc_router.WooCommerceCustomerLookupRequest(customer_id="55", email="alice@example.com"),
            user={"id": "u1"},
        )
    )
    assert cust_res["found"] is True
    assert cust_res["verified"] is True
    assert cust_res["customer"]["email"] == "alice@example.com"
