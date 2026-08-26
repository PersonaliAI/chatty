"""_client_ip must trust the LAST X-Forwarded-For hop (Cloud Run's own
append), not the first (attacker-controlled) — see app/core/security.py and
main.py. security.py's _client_ip previously trusted the first hop, which
let an API-key IP allowlist be bypassed by spoofing the header.
"""
from starlette.requests import Request

import app.core.security as security
import main


def _request(headers: dict[str, str]) -> Request:
    encoded = [(k.lower().encode(), v.encode()) for k, v in headers.items()]
    scope = {
        "type": "http",
        "headers": encoded,
        "client": ("203.0.113.9", 12345),
    }
    return Request(scope)


def test_security_client_ip_trusts_last_hop_not_first():
    req = _request({"x-forwarded-for": "1.2.3.4, 5.6.7.8, 9.9.9.9"})
    assert security._client_ip(req) == "9.9.9.9"


def test_main_client_ip_trusts_last_hop_not_first():
    req = _request({"x-forwarded-for": "1.2.3.4, 5.6.7.8, 9.9.9.9"})
    assert main._client_ip(req) == "9.9.9.9"


def test_client_ip_falls_back_to_socket_when_header_absent():
    req = _request({})
    assert security._client_ip(req) == "203.0.113.9"
    assert main._client_ip(req) == "203.0.113.9"
