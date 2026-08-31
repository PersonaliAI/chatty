"""SSRF guard — resolve a URL's hostname and reject it if it points at a
private, link-local, loopback, or other non-public IP range (including the
cloud metadata address, which falls in link-local space).

Used anywhere the backend makes an outbound request to a URL an
authenticated user supplies (site crawling, webhook registration) — without
this, a user could point the backend at internal infrastructure (Cloud Run's
own metadata server, other internal services on the VPC, localhost) that
isn't otherwise reachable from outside the deployment.

`assert_safe_url[_async]` alone only checks the IP at validation time, not
connection time — a DNS-rebinding attacker can have their hostname resolve
to a public IP during this check and a private IP moments later, at actual
connection time, if the caller re-resolves DNS itself (e.g. by handing the
original URL straight to httpx). `request()` / `request_async()` below close
that window: they resolve the hostname exactly once, validate every
resolved address, and then connect directly to the validated IP (with the
original Host header, and — for https — the original hostname pinned as the
TLS SNI/cert-verification target via httpcore's `sni_hostname` request
extension) so there is no second, attacker-controllable DNS lookup between
check and connect. Prefer these over calling `assert_safe_url*` and then
making the request yourself.
"""
from __future__ import annotations

import asyncio
import ipaddress
import socket
from urllib.parse import urlparse, urlunparse

import httpx


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


def _resolve_pinned_ip(host: str) -> str:
    """Resolve `host` once and return a single validated public IP.

    Raises UnsafeURLError if resolution fails or every resolved address is
    unsafe. Prefers an IPv4 result (simplifies building the pinned URL —
    IPv6 literals need bracket syntax) but falls back to IPv6 if that's all
    there is.
    """
    try:
        addrinfo = socket.getaddrinfo(host, None)
    except socket.gaierror as exc:
        raise UnsafeURLError(f"could not resolve host: {host}") from exc

    resolved_ips = [info[4][0] for info in addrinfo]
    if not resolved_ips:
        raise UnsafeURLError(f"could not resolve host: {host}")

    safe_ips = [ip for ip in resolved_ips if _is_public_ip(ip)]
    if not safe_ips:
        raise UnsafeURLError(f"{host} resolves to a non-public address ({resolved_ips[0]})")

    for ip in safe_ips:
        if ipaddress.ip_address(ip).version == 4:
            return ip
    return safe_ips[0]


def _build_pinned_request(url: str) -> tuple[str, dict[str, str], dict[str, object]]:
    """Return (pinned_url, headers, extensions) for issuing `url` against a
    single already-validated IP instead of letting the HTTP client re-resolve
    the hostname itself.

    - `pinned_url` has its host replaced with the resolved IP (bracketed for
      IPv6), so the TCP connection target is exactly the address we checked.
    - `headers["Host"]` carries the original hostname so virtual-hosted
      servers still route correctly.
    - `extensions["sni_hostname"]` (consumed by httpcore) makes TLS use the
      original hostname for SNI and certificate verification, so an https
      pinned request still validates the cert it would have gotten by
      connecting through DNS normally.
    """
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise UnsafeURLError(f"disallowed URL scheme: {parsed.scheme!r}")
    host = parsed.hostname
    if not host:
        raise UnsafeURLError("URL has no host")

    ip = _resolve_pinned_ip(host)
    ip_for_netloc = f"[{ip}]" if ":" in ip else ip
    netloc = ip_for_netloc
    if parsed.port:
        netloc = f"{ip_for_netloc}:{parsed.port}"
    if parsed.username:
        creds = parsed.username + (f":{parsed.password}" if parsed.password else "")
        netloc = f"{creds}@{netloc}"

    pinned_url = urlunparse(parsed._replace(netloc=netloc))
    headers = {"Host": host}
    extensions: dict[str, object] = {}
    if parsed.scheme == "https":
        extensions["sni_hostname"] = host
    return pinned_url, headers, extensions


def request(
    client: httpx.Client, method: str, url: str, **kwargs: object
) -> httpx.Response:
    """Sync equivalent of `request_async` — issue `method` `url` through
    `client`, pinned to a single validated IP so DNS can't rebind between
    validation and connection. Raises UnsafeURLError if the URL is unsafe."""
    pinned_url, host_header, extensions = _build_pinned_request(url)
    headers = httpx.Headers(kwargs.pop("headers", None))
    headers.update(host_header)
    merged_extensions = dict(kwargs.pop("extensions", None) or {})
    merged_extensions.update(extensions)
    return client.request(method, pinned_url, headers=headers, extensions=merged_extensions, **kwargs)


async def request_async(
    client: httpx.AsyncClient, method: str, url: str, **kwargs: object
) -> httpx.Response:
    """Issue `method` `url` through `client` (an httpx.AsyncClient), pinned to
    a single IP resolved and validated right here — not re-resolved by the
    client — so a DNS record can't be flipped to a private address between
    the SSRF check and the actual connection (DNS rebinding).

    Sets the `Host` header to the original hostname and, for https, pins
    `sni_hostname` so TLS still verifies the certificate against the real
    hostname even though the connection is made directly to its IP. Raises
    UnsafeURLError if the URL is unsafe or the scheme is disallowed.
    """
    pinned_url, host_header, extensions = await asyncio.to_thread(_build_pinned_request, url)
    headers = httpx.Headers(kwargs.pop("headers", None))
    headers.update(host_header)
    merged_extensions = dict(kwargs.pop("extensions", None) or {})
    merged_extensions.update(extensions)
    return await client.request(method, pinned_url, headers=headers, extensions=merged_extensions, **kwargs)
