"""Browser preflight regressions for signed visitor widget requests."""

import pytest
from fastapi.testclient import TestClient

from app.core.app_factory import create_app


@pytest.mark.parametrize("origin", ["https://chatty.personaliai.com", "https://customer.example"])
@pytest.mark.parametrize("path,method", [
    ("/api/widget/theme", "GET"),
    ("/api/widget/identity", "POST"),
    ("/api/widget/identity/logout", "POST"),
    ("/api/widget/poll", "GET"),
])
def test_widget_preflight_allows_signed_visitor_header(origin, path, method):
    with TestClient(create_app()) as client:
        response = client.options(path, headers={
            "Origin": origin,
            "Access-Control-Request-Method": method,
            "Access-Control-Request-Headers": "content-type,x-chatty-visitor,x-widget-token",
        })
    assert response.status_code == 204
    assert response.headers["access-control-allow-origin"] == origin
    allowed = {header.strip().lower() for header in response.headers["access-control-allow-headers"].split(",")}
    assert {"content-type", "x-chatty-visitor", "x-widget-token"} <= allowed
    assert "*" not in allowed
    assert "x-untrusted-header" not in allowed


def test_widget_cors_does_not_open_dashboard_endpoints():
    with TestClient(create_app()) as client:
        response = client.options("/api/admin/inbox", headers={
            "Origin": "https://customer.example",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "x-chatty-visitor",
        })
    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers
