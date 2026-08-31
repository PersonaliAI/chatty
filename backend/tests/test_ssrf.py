"""Unit tests for app/core/ssrf.py's SSRF guard — no real DNS lookups,
socket.getaddrinfo is mocked.
"""
from __future__ import annotations

import asyncio
import socket
from unittest.mock import patch

import pytest

from app.core import ssrf


def _addrinfo_for(*ips: str):
    """Build a socket.getaddrinfo()-shaped return value for the given IPs."""
    return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (ip, 0)) for ip in ips]


def test_rejects_non_http_scheme():
    with pytest.raises(ssrf.UnsafeURLError, match="scheme"):
        ssrf.assert_safe_url("ftp://example.com/file")


def test_rejects_url_with_no_host():
    with pytest.raises(ssrf.UnsafeURLError, match="no host"):
        ssrf.assert_safe_url("http:///path")


def test_rejects_dns_resolution_failure():
    with patch.object(socket, "getaddrinfo", side_effect=socket.gaierror("nxdomain")):
        with pytest.raises(ssrf.UnsafeURLError, match="could not resolve"):
            ssrf.assert_safe_url("http://this-domain-does-not-resolve.invalid/")


def test_allows_public_ip():
    with patch.object(socket, "getaddrinfo", return_value=_addrinfo_for("93.184.216.34")):
        ssrf.assert_safe_url("http://example.com/")  # must not raise


def test_rejects_loopback():
    with patch.object(socket, "getaddrinfo", return_value=_addrinfo_for("127.0.0.1")):
        with pytest.raises(ssrf.UnsafeURLError, match="non-public"):
            ssrf.assert_safe_url("http://localhost/")


def test_rejects_private_rfc1918_ranges():
    for ip in ("10.0.0.5", "172.16.0.1", "192.168.1.1"):
        with patch.object(socket, "getaddrinfo", return_value=_addrinfo_for(ip)):
            with pytest.raises(ssrf.UnsafeURLError, match="non-public"):
                ssrf.assert_safe_url("http://internal.example/")


def test_rejects_link_local_including_cloud_metadata_address():
    # 169.254.169.254 is the GCP/AWS/Azure cloud metadata endpoint — falls
    # inside the link-local range, which is exactly why it must be blocked.
    with patch.object(socket, "getaddrinfo", return_value=_addrinfo_for("169.254.169.254")):
        with pytest.raises(ssrf.UnsafeURLError, match="non-public"):
            ssrf.assert_safe_url("http://metadata.google.internal/computeMetadata/v1/")


def test_rejects_if_any_resolved_address_is_private():
    # A hostname with multiple A records — reject if even one is unsafe,
    # since the client could connect to any of them.
    with patch.object(socket, "getaddrinfo", return_value=_addrinfo_for("93.184.216.34", "10.0.0.1")):
        with pytest.raises(ssrf.UnsafeURLError, match="non-public"):
            ssrf.assert_safe_url("http://mixed.example/")


def test_rejects_unspecified_address():
    with patch.object(socket, "getaddrinfo", return_value=_addrinfo_for("0.0.0.0")):
        with pytest.raises(ssrf.UnsafeURLError, match="non-public"):
            ssrf.assert_safe_url("http://zero.example/")


def test_rejects_ipv6_loopback_and_link_local():
    with patch.object(socket, "getaddrinfo", return_value=_addrinfo_for("::1")):
        with pytest.raises(ssrf.UnsafeURLError, match="non-public"):
            ssrf.assert_safe_url("http://v6loopback.example/")
    with patch.object(socket, "getaddrinfo", return_value=_addrinfo_for("fe80::1")):
        with pytest.raises(ssrf.UnsafeURLError, match="non-public"):
            ssrf.assert_safe_url("http://v6linklocal.example/")


def test_async_wrapper_delegates_to_sync_check():
    with patch.object(socket, "getaddrinfo", return_value=_addrinfo_for("10.0.0.1")):
        with pytest.raises(ssrf.UnsafeURLError):
            asyncio.run(ssrf.assert_safe_url_async("http://internal.example/"))
    with patch.object(socket, "getaddrinfo", return_value=_addrinfo_for("93.184.216.34")):
        asyncio.run(ssrf.assert_safe_url_async("http://example.com/"))  # must not raise


# ---------------------------------------------------------------------------
# DNS-rebinding: request()/request_async() must connect to the IP resolved
# during validation, never re-resolve (and thus never see a second, attacker-
# controlled answer) at connect time.
# ---------------------------------------------------------------------------


def test_build_pinned_request_targets_resolved_ip_not_hostname():
    """A hostname that resolves to a public IP at check-time should produce a
    pinned URL whose host IS that IP — so even if the attacker's DNS record
    is flipped to a private address a moment later, nothing re-resolves the
    hostname to pick that up."""
    with patch.object(socket, "getaddrinfo", return_value=_addrinfo_for("93.184.216.34")):
        pinned_url, headers, extensions = ssrf._build_pinned_request("https://rebind.example/webhook?x=1")
    assert pinned_url == "https://93.184.216.34/webhook?x=1"
    assert headers["Host"] == "rebind.example"
    assert extensions["sni_hostname"] == "rebind.example"


def test_build_pinned_request_rejects_when_resolved_ip_is_private():
    with patch.object(socket, "getaddrinfo", return_value=_addrinfo_for("127.0.0.1")):
        with pytest.raises(ssrf.UnsafeURLError, match="non-public"):
            ssrf._build_pinned_request("http://rebind.example/")


def test_request_async_never_lets_the_http_client_resolve_the_hostname():
    """Simulates DNS rebinding end-to-end: getaddrinfo is patched to return a
    public IP (this is what the SSRF check sees), and the fake httpx client
    records exactly what URL/Host it was asked to connect to. If the guard
    were checking the hostname and then handing the *hostname* to the client
    (the old, vulnerable pattern), a rebound DNS record would let the second,
    real resolution return a private IP. Here we assert the client only ever
    sees the pre-resolved IP, so a later DNS flip can't matter."""

    class _FakeResponse:
        status_code = 200
        is_redirect = False

    class _FakeClient:
        def __init__(self):
            self.calls = []

        async def request(self, method, url, **kwargs):
            self.calls.append((method, url, kwargs.get("headers"), kwargs.get("extensions")))
            return _FakeResponse()

    client = _FakeClient()
    with patch.object(socket, "getaddrinfo", return_value=_addrinfo_for("93.184.216.34")):
        resp = asyncio.run(ssrf.request_async(client, "POST", "https://rebind.example/hook"))

    assert resp.status_code == 200
    assert len(client.calls) == 1
    method, url, headers, extensions = client.calls[0]
    # The client was handed the literal validated IP, never the hostname —
    # so even if "rebind.example" now resolves to 10.0.0.5, this request
    # can't reach it, because nothing asks DNS about it again.
    assert url == "https://93.184.216.34/hook"
    assert "rebind.example" not in url
    assert headers["Host"] == "rebind.example"
    assert extensions["sni_hostname"] == "rebind.example"


def test_request_async_rejects_url_that_rebinds_to_private_before_connect():
    """Even though this models an attacker whose hostname is *about* to
    rebind to a private IP, validation happens against the single resolution
    result we get here — so if that resolution itself is already private
    (e.g. the attacker won the race, or simply pointed the domain at a
    private IP from the start), the request must never reach the client."""

    class _FakeClient:
        async def request(self, *a, **kw):
            raise AssertionError("must not attempt a connection for an unsafe host")

    with patch.object(socket, "getaddrinfo", return_value=_addrinfo_for("169.254.169.254")):
        with pytest.raises(ssrf.UnsafeURLError):
            asyncio.run(ssrf.request_async(_FakeClient(), "GET", "http://rebind.example/"))
