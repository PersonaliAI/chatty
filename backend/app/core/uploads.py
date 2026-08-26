"""Bounded upload reads — cap enforced while streaming, not after buffering
the whole body into memory (a large-enough POST body would otherwise let a
client force full buffering before the size check ever runs)."""
from __future__ import annotations

from fastapi import HTTPException, UploadFile

_CHUNK_SIZE = 1024 * 1024  # 1 MB


async def read_upload_capped(file: UploadFile, max_bytes: int, *, detail: str) -> bytes:
    """Read `file` in chunks, aborting with HTTP 413 as soon as `max_bytes`
    is exceeded — never buffers more than max_bytes + one chunk."""
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(_CHUNK_SIZE)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            raise HTTPException(status_code=413, detail=detail)
        chunks.append(chunk)
    return b"".join(chunks)
