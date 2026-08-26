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
