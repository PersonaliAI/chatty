"""Regression tests for the catalog/MM-RAG embedding contract."""

import asyncio

from app.services import multimodal_service


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
