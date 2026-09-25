"""Regression tests for the catalog/MM-RAG embedding contract."""

import asyncio
from types import SimpleNamespace

from app.services import multimodal_service


def test_image_embedding_uses_gemini_cross_modal_model(monkeypatch):
    captured = {}

    class Models:
        def embed_content(self, **kwargs):
            captured.update(kwargs)
            return SimpleNamespace(embeddings=[SimpleNamespace(values=[1.0] * 768)])

    monkeypatch.setattr(multimodal_service, "genai_client", SimpleNamespace(models=Models()))
    vector = asyncio.run(multimodal_service.embed_image_bytes(b"image-bytes", "image/png"))

    assert len(vector) == 768
    assert captured["model"] == multimodal_service.IMAGE_EMBEDDING_MODEL
    assert captured["config"].output_dimensionality == 768


def test_catalog_embedding_fits_native_provider_vector_to_schema_width(monkeypatch):
    """A native Gemini vector must be reduced before it reaches pgvector.

    Gemini can return 3072 dimensions even when ``output_dimensionality=768``
    is requested.  This exercises the same service path used by product
    ingestion, rather than only testing the lower-level dimension helper.
    """

    calls = []

    class EmbeddingResponse:
        data = [{"embedding": [1.0] * 3072}]

    async def fake_embed(**kwargs):
        calls.append(kwargs)
        return EmbeddingResponse()

    monkeypatch.setattr(multimodal_service.ai_client, "embed", fake_embed)

    vector = asyncio.run(multimodal_service.embed_multimodal_text("Planet Earth"))

    assert len(vector) == 768
    assert abs(sum(value * value for value in vector) - 1.0) < 1e-6
    assert calls and calls[0]["output_dimensionality"] == 768


def test_catalog_ingest_never_sends_native_width_vector_to_database(monkeypatch):
    """The product-ingest boundary must preserve the pgvector contract."""

    captured = {}

    class FakeQuery:
        def insert(self, row):
            captured.update(row)
            return self

        def execute(self):
            return SimpleNamespace(data=[captured])

    class FakeSupabase:
        def table(self, name):
            assert name == "chatty_media_items"
            return FakeQuery()

    class EmbeddingResponse:
        data = [{"embedding": [1.0] * 3072}]

    async def fake_embed(**kwargs):
        return EmbeddingResponse()

    async def run_inline(callback):
        return callback()

    monkeypatch.setattr(multimodal_service, "supabase", FakeSupabase())
    monkeypatch.setattr(multimodal_service, "run_db", run_inline)
    monkeypatch.setattr(multimodal_service.ai_client, "embed", fake_embed)
    monkeypatch.setattr(multimodal_service, "embed_catalog_images", lambda urls: asyncio.sleep(0, result=[]))

    row = asyncio.run(
        multimodal_service.ingest_media_item(
            bot_id="bot-1",
            title="Planet Earth",
            media_url="https://example.test/planet.jpg",
        )
    )

    assert len(row["embedding"]) == 768
    assert len(captured["embedding"]) == 768
    assert captured["metadata"]["_embedding_schema"] == multimodal_service.EMBEDDING_SCHEMA_VERSION
    assert captured["metadata"]["_embedding_status"] == "ready"
    assert captured["ingestion_status"] == "ready"
    assert captured["synced_at"]


def test_catalog_embedding_uses_document_task_and_changes_with_product_facts(monkeypatch):
    calls = []

    async def fake_embed(texts, *, is_query, titles=None, **kwargs):
        calls.append({"texts": texts, "is_query": is_query, "titles": titles})
        return [[0.25] * 768]

    monkeypatch.setattr(multimodal_service.mem, "_embed_with_retry", fake_embed)
    vector = asyncio.run(
        multimodal_service.embed_catalog_item(
            title="Blue shirt", description="Cotton shirt", sku="SKU-1",
            metadata={"in_stock": True},
        )
    )
    first_fingerprint = multimodal_service.catalog_embedding_fingerprint(
        title="Blue shirt", description="Cotton shirt", sku="SKU-1",
        metadata={"in_stock": True},
    )
    second_fingerprint = multimodal_service.catalog_embedding_fingerprint(
        title="Blue shirt", description="Cotton shirt", sku="SKU-1",
        metadata={"in_stock": False},
    )
    assert len(vector) == 768
    assert calls[0]["is_query"] is False
    assert calls[0]["titles"] == ["Blue shirt"]
    assert first_fingerprint != second_fingerprint
