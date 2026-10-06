import asyncio
from types import SimpleNamespace

from app.services import multimodal_service


def test_shopper_image_uses_cross_modal_rpc_and_grounded_catalog_result(monkeypatch):
    captured = {}

    class RpcQuery:
        def execute(self):
            return SimpleNamespace(data=[{
                "id": "media-1",
                "title": "Trail shoe",
                "price": 99.0,
                "currency": "USD",
                "url": "https://shop.example/trail",
                "metadata": {"source": "woocommerce", "in_stock": True},
                "similarity": 0.91,
            }])

    class FakeSupabase:
        def rpc(self, name, params):
            captured["name"] = name
            captured["params"] = params
            return RpcQuery()

    async def fake_run_db(callback):
        return callback()

    async def fake_embed_image(image_bytes, mime_type):
        return [0.2] * 768

    async def fake_embed_text(text):
        return [0.1] * 768

    async def fake_analyze(image_bytes, mime_type, user_text):
        return {"search_query": "trail shoe", "detailed_description": "A trail shoe"}

    async def no_live_refresh(bot_id, items):
        return items

    monkeypatch.setattr(multimodal_service, "supabase", FakeSupabase())
    monkeypatch.setattr(multimodal_service, "run_db", fake_run_db)
    monkeypatch.setattr(multimodal_service, "embed_image_bytes", fake_embed_image)
    monkeypatch.setattr(multimodal_service, "embed_multimodal_text", fake_embed_text)
    monkeypatch.setattr(multimodal_service, "analyze_visual_query", fake_analyze)
    monkeypatch.setattr("app.services.woocommerce_service.refresh_live_product_facts", no_live_refresh)

    results, visual = asyncio.run(multimodal_service.search_multimodal_catalog(
        bot_id="bot-1", image_bytes=b"image", mime_type="image/jpeg", query_text="how much?"
    ))

    assert captured["name"] == "match_media_items_multimodal"
    assert captured["params"]["query_image_embedding"] == [0.2] * 768
    assert results[0]["title"] == "Trail shoe"
    assert results[0]["price"] == 99.0
    assert visual["search_query"] == "trail shoe"


def test_low_confidence_catalog_match_returns_no_recommendation(monkeypatch):
    class Query:
        def eq(self, *args):
            return self

        def limit(self, *args):
            return self

        def execute(self):
            return SimpleNamespace(data=[])

    class FakeSupabase:
        def rpc(self, name, params):
            return SimpleNamespace(execute=lambda: SimpleNamespace(data=[{
                "id": "weak-match",
                "title": "Unrelated item",
                "metadata": {"in_stock": True},
                "similarity": 0.12,
            }]))

        def table(self, name):
            return Query()

    async def fake_run_db(callback):
        return callback()

    async def fake_embed(text):
        return [0.1] * 768

    monkeypatch.setattr(multimodal_service, "supabase", FakeSupabase())
    monkeypatch.setattr(multimodal_service, "run_db", fake_run_db)
    monkeypatch.setattr(multimodal_service, "embed_multimodal_text", fake_embed)

    results, _ = asyncio.run(multimodal_service.search_multimodal_catalog(
        bot_id="bot-1", query_text="rare blue item"
    ))

    assert results == []


def test_typed_catalog_query_searches_product_text_and_gallery_images(monkeypatch):
    captured = {}

    class RpcQuery:
        def execute(self):
            return SimpleNamespace(data=[
                {
                    "id": "media-red",
                    "title": "DNK Red Sports Shoes",
                    "metadata": {"in_stock": True, "woocommerce_id": 1},
                    "similarity": 0.62,
                },
                {
                    "id": "media-red-gallery",
                    "title": "DNK Red Sports Shoes",
                    "metadata": {"in_stock": True, "woocommerce_id": 1},
                    "similarity": 0.60,
                },
                {
                    "id": "media-black",
                    "title": "DNK Black Shoes",
                    "metadata": {"in_stock": True, "woocommerce_id": 2},
                    "similarity": 0.55,
                },
                {
                    "id": "media-green",
                    "title": "DNK Green Shoes",
                    "metadata": {"in_stock": True, "woocommerce_id": 3},
                    "similarity": 0.51,
                },
            ])

    class FakeSupabase:
        def rpc(self, name, params):
            captured["name"] = name
            captured["params"] = params
            return RpcQuery()

    async def fake_run_db(callback):
        return callback()

    async def fake_embed(text):
        return [0.4] * 768

    async def no_live_refresh(bot_id, items):
        return items

    monkeypatch.setattr(multimodal_service, "supabase", FakeSupabase())
    monkeypatch.setattr(multimodal_service, "run_db", fake_run_db)
    monkeypatch.setattr(multimodal_service, "embed_multimodal_text", fake_embed)
    monkeypatch.setattr("app.services.woocommerce_service.refresh_live_product_facts", no_live_refresh)

    results, _ = asyncio.run(multimodal_service.search_multimodal_catalog(
        bot_id="bot-1", query_text="black pink athletic running shoes"
    ))

    assert captured["name"] == "match_media_items_multimodal"
    assert captured["params"]["query_image_embedding"] == [0.4] * 768
    assert captured["params"]["query_embedding"] == [0.4] * 768
    assert captured["params"]["query_text"] == "black pink athletic running shoes"
    assert [item["title"] for item in results] == [
        "DNK Red Sports Shoes",
        "DNK Black Shoes",
        "DNK Green Shoes",
    ]
