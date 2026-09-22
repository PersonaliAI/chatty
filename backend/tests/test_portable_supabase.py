import pytest

from app.core.portable_supabase import PortablePostgresClient, PortableRpc


def test_portable_rpc_rejects_unknown_functions():
    rpc = PortableRpc("not_a_supported_rpc", {"query_embedding": [0.1] * 768})
    with pytest.raises(ValueError, match="unsupported self-host RPC"):
        rpc.execute()


def test_portable_rpc_requires_768_dimension_vectors():
    rpc = PortableRpc("match_media_items", {"query_embedding": [0.1]})
    with pytest.raises(ValueError, match="768"):
        rpc.execute()


def test_portable_storage_surface_is_available():
    bucket = PortablePostgresClient().storage.from_("chatty-uploads")
    assert bucket.bucket == "chatty-uploads"
    assert PortablePostgresClient().storage.create_bucket("chatty-uploads")["public"] is False
