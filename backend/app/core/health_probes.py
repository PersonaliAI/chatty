"""Enterprise Liveness, Readiness, and Deep Diagnostics Probes.

Standardized for Kubernetes, AWS ECS, Google Cloud Run, and PagerDuty monitoring.
"""

from __future__ import annotations

import asyncio
import os
import time
from typing import Any

import httpx

from app.core.circuit_breaker import CircuitBreakerRegistry
from app.core.clients import supabase
from app.core.config import SUPABASE_URL
from app.core.db import run_db

START_TIME = time.time()


async def check_database_health(timeout_sec: float = 2.5) -> dict[str, Any]:
    """Verify database ping with strict timeout to prevent hung probes."""
    t0 = time.perf_counter()
    if not str(SUPABASE_URL or "").strip():
        return {
            "status": "unconfigured",
            "latency_ms": 0,
            "message": "Supabase URL is not configured",
        }

    try:
        # Perform lightweight read
        await asyncio.wait_for(
            run_db(lambda: supabase.table("chatty_bots").select("id").limit(1).execute()),
            timeout=timeout_sec,
        )
        latency = round((time.perf_counter() - t0) * 1000, 2)
        return {
            "status": "healthy",
            "latency_ms": latency,
        }
    except asyncio.TimeoutError:
        return {
            "status": "unhealthy",
            "latency_ms": round((time.perf_counter() - t0) * 1000, 2),
            "error": f"Database probe timed out after {timeout_sec}s",
        }
    except Exception as exc:
        return {
            "status": "unhealthy",
            "latency_ms": round((time.perf_counter() - t0) * 1000, 2),
            "error": str(exc)[:200],
        }


async def check_redis_health(timeout_sec: float = 1.5) -> dict[str, Any]:
    """Check Upstash Redis REST connectivity or report graceful memory fallback."""
    url = os.environ.get("UPSTASH_REDIS_REST_URL", "").rstrip("/")
    token = os.environ.get("UPSTASH_REDIS_REST_TOKEN", "")

    if not url or not token:
        return {
            "status": "in_memory_fallback",
            "mode": "standalone_memory_cache",
            "message": "Distributed Redis unconfigured; using in-memory fallback",
        }

    t0 = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=timeout_sec) as client:
            resp = await client.post(
                f"{url}/ping",
                headers={"Authorization": f"Bearer {token}"},
            )
            latency = round((time.perf_counter() - t0) * 1000, 2)
            if resp.status_code == 200:
                return {
                    "status": "healthy",
                    "latency_ms": latency,
                }
            return {
                "status": "degraded",
                "latency_ms": latency,
                "error": f"Redis ping returned HTTP {resp.status_code}",
            }
    except Exception as exc:
        return {
            "status": "degraded",
            "latency_ms": round((time.perf_counter() - t0) * 1000, 2),
            "error": str(exc)[:200],
        }


def get_system_uptime() -> dict[str, Any]:
    uptime_seconds = round(time.time() - START_TIME, 2)
    return {
        "uptime_seconds": uptime_seconds,
        "uptime_human": f"{int(uptime_seconds // 3600)}h {int((uptime_seconds % 3600) // 60)}m {int(uptime_seconds % 60)}s",
    }


async def get_deep_health_report() -> dict[str, Any]:
    """Comprehensive health diagnostic combining DB, Cache, Breakers, and Uptime."""
    db_health_task = asyncio.create_task(check_database_health())
    redis_health_task = asyncio.create_task(check_redis_health())

    db_health, redis_health = await asyncio.gather(db_health_task, redis_health_task)

    breakers = CircuitBreakerRegistry.get_instance().summary()
    uptime = get_system_uptime()

    is_ready = db_health["status"] in ("healthy", "unconfigured")
    is_degraded = (
        redis_health["status"] in ("degraded", "unhealthy")
        or breakers["status"] == "degraded"
    )

    overall_status = "healthy"
    if not is_ready:
        overall_status = "unhealthy"
    elif is_degraded:
        overall_status = "degraded"

    return {
        "status": overall_status,
        "service": "chatty-api",
        "ready": is_ready,
        "degraded": is_degraded,
        "uptime": uptime,
        "components": {
            "database": db_health,
            "cache": redis_health,
            "circuit_breakers": breakers,
        },
    }
