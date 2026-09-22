"""Provider profile validation for managed and self-host deployments."""

from __future__ import annotations

from dataclasses import dataclass

from app.core.config import (
    DATABASE_URL,
    DEPLOYMENT_PROFILE,
    OIDC_AUDIENCE,
    OIDC_ISSUER_URL,
    REDIS_URL,
    S3_ACCESS_KEY,
    S3_ENDPOINT,
    S3_PUBLIC_URL,
    S3_SECRET_KEY,
    S3_BUCKET,
)
from app.core.db_pool import connection


@dataclass(frozen=True)
class ProviderStatus:
    profile: str
    database_configured: bool
    queue_configured: bool
    object_store_configured: bool

    @property
    def ready_for_self_host_adapters(self) -> bool:
        return all((self.database_configured, self.queue_configured, self.object_store_configured))


def provider_status() -> ProviderStatus:
    return ProviderStatus(DEPLOYMENT_PROFILE, bool(DATABASE_URL), bool(REDIS_URL), bool(S3_ENDPOINT and S3_ACCESS_KEY and S3_SECRET_KEY))


def validate_self_host_contract() -> None:
    if DEPLOYMENT_PROFILE != "self_host":
        return
    status = provider_status()
    missing = []
    if not status.database_configured:
        missing.append("DATABASE_URL")
    if not status.queue_configured:
        missing.append("REDIS_URL")
    if not status.object_store_configured:
        missing.append("S3_ENDPOINT/S3_ACCESS_KEY/S3_SECRET_KEY")
    if not S3_PUBLIC_URL:
        missing.append("S3_PUBLIC_URL")
    if not OIDC_ISSUER_URL:
        missing.append("OIDC_ISSUER_URL")
    if not OIDC_AUDIENCE:
        missing.append("OIDC_AUDIENCE")
    if missing:
        raise RuntimeError("self_host deployment is missing: " + ", ".join(missing))


def check_self_host_dependencies() -> dict[str, bool]:
    """Probe configured self-host dependencies without exposing credentials."""
    if DEPLOYMENT_PROFILE != "self_host":
        return {"database": True, "queue": True, "object_store": True}

    checks: dict[str, bool] = {"database": False, "queue": False, "object_store": False}
    try:
        with connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
                checks["database"] = cur.fetchone() == (1,)
    except Exception:  # noqa: BLE001 - readiness must fail closed
        checks["database"] = False

    try:
        import redis

        client = redis.Redis.from_url(REDIS_URL, socket_connect_timeout=2, socket_timeout=2)
        checks["queue"] = bool(client.ping())
        client.close()
    except Exception:  # noqa: BLE001
        checks["queue"] = False

    try:
        import boto3

        client = boto3.client(
            "s3",
            endpoint_url=S3_ENDPOINT,
            aws_access_key_id=S3_ACCESS_KEY,
            aws_secret_access_key=S3_SECRET_KEY,
            region_name="us-east-1",
            config=boto3.session.Config(connect_timeout=2, read_timeout=2, retries={"max_attempts": 1}),
        )
        client.head_bucket(Bucket=S3_BUCKET)
        checks["object_store"] = True
    except Exception:  # noqa: BLE001
        checks["object_store"] = False
    return checks
