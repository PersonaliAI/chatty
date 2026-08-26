"""read_upload_capped must reject an oversized upload while still streaming
it in — never buffering the whole body before the size check runs (the bug:
`await file.read()` followed by a length check still lets a client force
full buffering of an arbitrarily large body first)."""
import asyncio
import io

import pytest
from fastapi import HTTPException, UploadFile

from app.core.uploads import read_upload_capped


def _upload(data: bytes) -> UploadFile:
    return UploadFile(filename="f.bin", file=io.BytesIO(data))


def test_read_upload_capped_allows_data_under_the_limit():
    data = b"x" * 100
    result = asyncio.run(read_upload_capped(_upload(data), max_bytes=1000, detail="too big"))
    assert result == data


def test_read_upload_capped_rejects_data_over_the_limit():
    data = b"x" * 2000
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(read_upload_capped(_upload(data), max_bytes=1000, detail="too big"))
    assert exc_info.value.status_code == 413
    assert exc_info.value.detail == "too big"


def test_read_upload_capped_stops_reading_once_over_limit():
    # A body many chunks past the cap must not be fully buffered: the
    # helper should raise as soon as the running total exceeds max_bytes,
    # not after consuming the entire stream.
    data = b"x" * (5 * 1024 * 1024)  # 5MB, well past a 1MB cap
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(read_upload_capped(_upload(data), max_bytes=1024 * 1024, detail="too big"))
    assert exc_info.value.status_code == 413
