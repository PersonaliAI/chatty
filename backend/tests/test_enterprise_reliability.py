"""Enterprise-Grade Reliability, Fault Tolerance, and Observability Test Suite.

Verifies:
  * Circuit Breaker: closed -> open -> half-open -> closed transitions and fast-fail.
  * Idempotency: Duplicate requests return cached responses with Idempotent-Replayed header.
  * PII and Credential Masking: Zero credential/key leaks in structured logs.
  * Deep Health Probes: /health/live, /health/ready, and /health/deep.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any
import pytest
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.testclient import TestClient

from app.core.circuit_breaker import (
    CircuitBreaker,
    CircuitBreakerOpenError,
    CircuitBreakerRegistry,
    CircuitState,
)
from app.core.idempotency import (
    IdempotencyRecord,
    IdempotencyStore,
    get_idempotency_store,
)
from app.core.logging_config import (
    StructuredJsonFormatter,
    redact_sensitive_text,
)
from app.core.health_probes import (
    check_database_health,
    check_redis_health,
    get_deep_health_report,
    get_system_uptime,
)
from main import app


# ==============================================================================
# 1. Circuit Breaker Unit Tests
# ==============================================================================


def test_circuit_breaker_state_transitions():
    async def _test():
        breaker = CircuitBreaker(
            name="test_service",
            failure_threshold=3,
            recovery_timeout=0.1,  # 100ms for fast test execution
            half_open_successes=2,
        )

        assert breaker.state == CircuitState.CLOSED
        assert breaker.get_retry_after() == 0.0

        async def successful_call():
            return "success"

        async def failing_call():
            raise RuntimeError("Service unavailable")

        # 1. Calls pass in CLOSED state
        res = await breaker.call(successful_call)
        assert res == "success"

        # 2. Trigger failures up to threshold
        for _ in range(2):
            with pytest.raises(RuntimeError):
                await breaker.call(failing_call)
            assert breaker.state == CircuitState.CLOSED

        # 3rd failure trips the breaker to OPEN
        with pytest.raises(RuntimeError):
            await breaker.call(failing_call)

        assert breaker.state == CircuitState.OPEN

        # 3. Subsequent calls fast-fail without calling the underlying service
        call_executed = False

        async def should_not_run():
            nonlocal call_executed
            call_executed = True
            return "nope"

        with pytest.raises(CircuitBreakerOpenError) as exc_info:
            await breaker.call(should_not_run)

        assert call_executed is False
        assert "OPEN" in str(exc_info.value)
        assert exc_info.value.retry_after > 0

        # 4. Wait for recovery timeout to transition to HALF_OPEN
        await asyncio.sleep(0.12)
        assert breaker.state == CircuitState.HALF_OPEN

        # 5. Execute 2 successful calls in HALF_OPEN to close the circuit
        res1 = await breaker.call(successful_call)
        assert res1 == "success"
        assert breaker.state == CircuitState.HALF_OPEN

        res2 = await breaker.call(successful_call)
        assert res2 == "success"
        assert breaker.state == CircuitState.CLOSED

        # Snapshots for APM inspection
        summary = breaker.to_dict()
        assert summary["name"] == "test_service"
        assert summary["state"] == "closed"
        assert summary["total_calls"] >= 5

    asyncio.run(_test())


def test_circuit_breaker_registry_preseeded():
    registry = CircuitBreakerRegistry.get_instance()
    summary = registry.summary()

    assert summary["status"] == "healthy"
    assert "gemini" in summary["services"]
    assert "woocommerce" in summary["services"]
    assert "slack" in summary["services"]
    assert "redis" in summary["services"]


# ==============================================================================
# 2. Idempotency Engine Unit Tests
# ==============================================================================


def test_idempotency_store_lifecycle():
    async def _test():
        store = IdempotencyStore(ttl=60)
        key = "idem:test_route:uuid-12345"

        # 1. First request acquires in_flight
        acquired = await store.start(key)
        assert acquired is True

        # 2. Concurrent duplicate request gets rejected
        concurrent_acquired = await store.start(key)
        assert concurrent_acquired is False

        # 3. Complete request and store response
        await store.complete(
            key,
            status_code=201,
            headers={"content-type": "application/json", "x-custom": "enterprise"},
            body=json.dumps({"order_id": "ord_999"}),
        )

        # 4. Subsequent lookup returns completed cached record
        rec = await store.get(key)
        assert rec is not None
        assert rec.status == "completed"
        assert rec.status_code == 201
        assert json.loads(rec.body)["order_id"] == "ord_999"
        assert rec.headers["x-custom"] == "enterprise"

        # 5. Clear allows fresh execution
        await store.clear(key)
        assert await store.get(key) is None

    asyncio.run(_test())


# ==============================================================================
# 3. Sensitive Data Redaction & Logging Tests
# ==============================================================================


def test_redact_sensitive_credentials():
    mock_slack_tok = f"{'xoxb'}-{'123456789012'}-{'123456789012'}-{'a'*26}"
    raw_text = (
        "User authenticated with Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz.123 "
        "and Chatty key chatty_sk_enterprise_live_key_99999. "
        "Connecting to WooCommerce ck_abcdef123456789012345678 with secret cs_9876543210987654321098. "
        f"Slack webhook token {mock_slack_tok} and OpenAI key sk-live-1234567890abcdefghijkl. "
        "Customer card charged: 4111 2222 3333 4444."
    )

    clean = redact_sensitive_text(raw_text)

    # All credentials and cards must be redacted
    assert "eyJhbGciOiJIUzI1Ni" not in clean
    assert "[REDACTED_BEARER]" in clean
    assert "chatty_sk_enterprise_live_key_99999" not in clean
    assert "[REDACTED_CHATTY_KEY]" in clean
    assert "ck_abcdef123456789012345678" not in clean
    assert "[REDACTED_WC_KEY]" in clean
    assert "cs_9876543210987654321098" not in clean
    assert "[REDACTED_WC_SECRET]" in clean
    assert "xoxb-" not in clean
    assert "[REDACTED_SLACK_TOKEN]" in clean
    assert "sk-live-" not in clean
    assert "[REDACTED_AI_KEY]" in clean
    assert "4111 2222 3333 4444" not in clean
    assert "[REDACTED_CARD_NUMBER]" in clean


def test_structured_json_formatter():
    formatter = StructuredJsonFormatter()
    record = logging.LogRecord(
        name="chatty.test",
        level=logging.ERROR,
        pathname=__file__,
        lineno=100,
        msg="Error processing order for key ck_123456789012345678901234",
        args=(),
        exc_info=None,
    )
    record.request_id = "req-abc-999"
    record.duration_ms = 42.5

    output = formatter.format(record)
    parsed = json.loads(output)

    assert parsed["level"] == "ERROR"
    assert parsed["logger"] == "chatty.test"
    assert parsed["request_id"] == "req-abc-999"
    assert parsed["duration_ms"] == 42.5
    assert "ck_123456789012345678901234" not in parsed["message"]
    assert "[REDACTED_WC_KEY]" in parsed["message"]


# ==============================================================================
# 4. Enterprise Deep Health Probes
# ==============================================================================


def test_health_probe_components():
    async def _test():
        db_res = await check_database_health(timeout_sec=0.5)
        assert "status" in db_res
        assert "latency_ms" in db_res

        redis_res = await check_redis_health(timeout_sec=0.5)
        assert "status" in redis_res
        assert redis_res["status"] in ("healthy", "in_memory_fallback", "degraded")

        uptime = get_system_uptime()
        assert uptime["uptime_seconds"] >= 0

        deep = await get_deep_health_report()
        assert deep["service"] == "chatty-api"
        assert "status" in deep
        assert "components" in deep
        assert "circuit_breakers" in deep["components"]

    asyncio.run(_test())


# ==============================================================================
# 5. FastAPI End-to-End Enterprise Contract Tests
# ==============================================================================


def test_fastapi_enterprise_probes_and_headers():
    client = TestClient(app)

    # 1. Liveness
    resp_live = client.get("/health/live")
    assert resp_live.status_code == 200
    assert resp_live.json()["status"] == "ok"
    assert "x-request-id" in resp_live.headers
    assert "x-content-type-options" in resp_live.headers
    assert "strict-transport-security" in resp_live.headers

    # 2. Readiness
    resp_ready = client.get("/health/ready")
    assert resp_ready.status_code == 200
    ready_data = resp_ready.json()
    assert "status" in ready_data
    assert "circuits" in ready_data

    # 3. Deep Diagnostics
    resp_deep = client.get("/health/deep")
    assert resp_deep.status_code == 200
    deep_data = resp_deep.json()
    assert deep_data["service"] == "chatty-api"
    assert "components" in deep_data
    assert "circuit_breakers" in deep_data["components"]


def test_fastapi_idempotency_middleware_integration():
    client = TestClient(app)
    idem_key = "test-idem-key-888"

    # Send first request with idempotency key
    resp1 = client.post(
        "/api/v1/chat",
        headers={
            "Idempotency-Key": idem_key,
            "Authorization": "Bearer invalid_key_for_test",
        },
        json={"message": "hello"},
    )
    # The endpoint validates or rejects request (< 500)
    assert resp1.status_code in (401, 422)
    resp1_body = resp1.json()

    # Immediate second request with exact same Idempotency-Key
    resp2 = client.post(
        "/api/v1/chat",
        headers={
            "Idempotency-Key": idem_key,
            "Authorization": "Bearer invalid_key_for_test",
        },
        json={"message": "hello"},
    )

    # Second response should replay cached response with Idempotent-Replayed header
    assert resp2.status_code == resp1.status_code
    assert resp2.headers.get("Idempotent-Replayed") == "true"
    assert resp2.json() == resp1_body
