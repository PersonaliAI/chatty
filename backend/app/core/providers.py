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
)


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
