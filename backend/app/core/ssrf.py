"""SSRF guard — resolve a URL's hostname and reject it if it points at a
private, link-local, loopback, or other non-public IP range (including the
cloud metadata address, which falls in link-local space).

Used anywhere the backend makes an outbound request to a URL an
authenticated user supplies (site crawling, webhook registration) — without
this, a user could point the backend at internal infrastructure (Cloud Run's
own metadata server, other internal services on the VPC, localhost) that
isn't otherwise reachable from outside the deployment.

This checks the IP at validation time, not connection time, so it doesn't
fully close a DNS-rebinding attack (an attacker's DNS record could resolve
to a public IP during this check and a private IP moments later, at actual
connection time). Closing that fully requires resolving once and connecting
to that specific IP with the original Host header — a larger change to how
httpx.AsyncClient is used at each call site. This is a real, practical
improvement over the previous no-check-at-all state; not a complete fix.
"""
from __future__ import annotations

import asyncio
import ipaddress
import socket
from urllib.parse import urlparse


class UnsafeURLError(ValueError):
    """Raised when a URL resolves to a non-public IP or uses a disallowed scheme."""


def _is_public_ip(ip_str: str) -> bool:
    try:
        ip = ipaddress.ip_address(ip_str)
    except ValueError:
        return False
    return not (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local  # covers 169.254.0.0/16, which includes the cloud metadata address
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    )


def assert_safe_url(url: str) -> None:
    """Raise UnsafeURLError if `url` isn't a public http(s) URL.

    Resolves the hostname via DNS and checks every resolved address (a
    hostname can have multiple A/AAAA records) — rejects if the scheme isn't
    http/https, if the host is missing, or if ANY resolved address is
    private/loopback/link-local/reserved.
    """
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise UnsafeURLError(f"disallowed URL scheme: {parsed.scheme!r}")
    host = parsed.hostname
    if not host:
        raise UnsafeURLError("URL has no host")

    try:
        addrinfo = socket.getaddrinfo(host, None)
    except socket.gaierror as exc:
        raise UnsafeURLError(f"could not resolve host: {host}") from exc

    resolved_ips = {info[4][0] for info in addrinfo}
    if not resolved_ips:
        raise UnsafeURLError(f"could not resolve host: {host}")
    for ip_str in resolved_ips:
        if not _is_public_ip(ip_str):
            raise UnsafeURLError(f"{host} resolves to a non-public address ({ip_str})")


async def assert_safe_url_async(url: str) -> None:
    """Async wrapper — DNS resolution is blocking, so this offloads it to a
    worker thread instead of blocking the event loop."""
    await asyncio.to_thread(assert_safe_url, url)
