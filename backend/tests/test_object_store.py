import pytest

from app.core.object_store import safe_object_key


def test_safe_object_key_normalizes_nested_paths():
    assert safe_object_key("/avatars\\user-1/photo.png") == "avatars/user-1/photo.png"


@pytest.mark.parametrize("key", ["", "../secret", "a/../../secret", "a\x00b"])
def test_safe_object_key_rejects_traversal_and_invalid_input(key):
    with pytest.raises(ValueError):
        safe_object_key(key)
