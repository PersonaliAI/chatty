"""Secure S3-compatible object storage boundary for self-host deployments."""

from __future__ import annotations

import posixpath

from app.core.config import S3_ACCESS_KEY, S3_BUCKET, S3_ENDPOINT, S3_PUBLIC_URL, S3_SECRET_KEY


def safe_object_key(key: str) -> str:
    if not key or "\x00" in key:
        raise ValueError("object key is empty or contains a NUL byte")
    normalized = posixpath.normpath(key.replace("\\", "/")).lstrip("/")
    if normalized in {"", ".", ".."} or normalized.startswith("../"):
        raise ValueError("object key escapes the storage root")
    if any(ord(ch) < 32 for ch in normalized):
        raise ValueError("object key contains a control character")
    return normalized


def _client():
    if not (S3_ENDPOINT and S3_ACCESS_KEY and S3_SECRET_KEY):
        raise RuntimeError("self-host S3 storage is not configured")
    import boto3
    return boto3.client("s3", endpoint_url=S3_ENDPOINT, aws_access_key_id=S3_ACCESS_KEY,
                        aws_secret_access_key=S3_SECRET_KEY, region_name="us-east-1")


def put_bytes(key: str, data: bytes, content_type: str) -> str:
    object_key = safe_object_key(key)
    if not data:
        raise ValueError("cannot store an empty object")
    if not S3_PUBLIC_URL:
        raise RuntimeError("S3_PUBLIC_URL is required when returning public asset URLs")
    _client().put_object(Bucket=S3_BUCKET, Key=object_key, Body=data,
                         ContentType=content_type or "application/octet-stream",
                         ServerSideEncryption="AES256")
    return f"{S3_PUBLIC_URL}/{S3_BUCKET}/{object_key}"


def delete_object(key: str) -> None:
    """Delete one object after a failed metadata write (best-effort compensation)."""
    object_key = safe_object_key(key)
    _client().delete_object(Bucket=S3_BUCKET, Key=object_key)


def presigned_get_url(key: str, expires_seconds: int = 900) -> str:
    if not 60 <= expires_seconds <= 86400:
        raise ValueError("expires_seconds must be between 60 and 86400")
    return _client().generate_presigned_url("get_object",
        Params={"Bucket": S3_BUCKET, "Key": safe_object_key(key)}, ExpiresIn=expires_seconds)
