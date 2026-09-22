"""Run a small, dependency-free smoke gate against a self-host deployment.

The gate intentionally exercises only public health and auth-boundary routes.
It is safe to run after deploys and in CI; it never sends customer data or
prints response bodies that could contain secrets.
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass


@dataclass(frozen=True)
class Response:
    status: int
    body: object | None


def fetch(base_url: str, path: str, timeout: float) -> Response:
    request = urllib.request.Request(
        f"{base_url.rstrip('/')}{path}",
        headers={"Accept": "application/json"},
        method="GET",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read()
            status = response.status
    except urllib.error.HTTPError as error:
        raw = error.read()
        status = error.code
    try:
        body = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        body = None
    return Response(status=status, body=body)


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def run(base_url: str, timeout: float) -> None:
    health = fetch(base_url, "/", timeout)
    require(health.status == 200, f"health returned HTTP {health.status}")
    require(isinstance(health.body, dict) and health.body.get("status") == "healthy", "health payload is invalid")

    ready = fetch(base_url, "/readyz", timeout)
    require(ready.status == 200, f"readyz returned HTTP {ready.status}: deployment is not ready")
    require(isinstance(ready.body, dict), "readyz did not return JSON")
    require(ready.body.get("status") == "ready", "readyz status is not ready")
    require(ready.body.get("profile") == "self_host", "readyz is not reporting self_host profile")
    dependencies = ready.body.get("dependencies")
    require(isinstance(dependencies, dict), "readyz did not include dependency checks")
    require(all(dependencies.get(name) is True for name in ("database", "queue", "object_store")), "one or more dependencies failed readiness")

    openapi = fetch(base_url, "/openapi.json", timeout)
    require(openapi.status == 200, f"openapi returned HTTP {openapi.status}")
    require(isinstance(openapi.body, dict) and isinstance(openapi.body.get("paths"), dict), "openapi payload is invalid")

    protected = fetch(base_url, "/api/capabilities", timeout)
    require(protected.status in (401, 403), f"auth boundary returned unexpected HTTP {protected.status}")
    print("self-host smoke passed: health, readiness, OpenAPI, and auth boundary")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8080")
    parser.add_argument("--timeout", type=float, default=5.0)
    args = parser.parse_args()
    try:
        run(args.base_url, args.timeout)
    except (OSError, RuntimeError, ValueError) as error:
        print(f"self-host smoke failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
