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

    async def fake_embed(_text):
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
