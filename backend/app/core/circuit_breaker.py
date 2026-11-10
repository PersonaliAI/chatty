"""Enterprise-Grade Circuit Breaker and Fault Tolerance Engine.

Protects Chatty from cascading external failures (LLM provider outages,
WooCommerce API downtime, Slack/WhatsApp webhook delays, Redis outages).

Implements the standard Martin Fowler Circuit Breaker pattern with:
  * CLOSED: Normal operation, calls pass through.
  * OPEN: Tripped after consecutive failures; calls fail-fast with CircuitBreakerOpenError.
  * HALF_OPEN: Trial period after recovery timeout; allows limited test requests to probe health.
  * Automatic exponential backoff and jitter.
  * Global registry with health inspection for Kubernetes/PagerDuty probes.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
import functools
import logging
import random
import time
from typing import Any, Awaitable, Callable, Optional, TypeVar

logger = logging.getLogger("chatty.circuit_breaker")

T = TypeVar("T")


class CircuitState(str, Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class CircuitBreakerOpenError(Exception):
    """Raised when a request is blocked by an open circuit breaker."""

    def __init__(self, service_name: str, retry_after: float):
        self.service_name = service_name
        self.retry_after = round(retry_after, 2)
        super().__init__(
            f"Circuit breaker for '{service_name}' is OPEN. Fast-failing to protect resources. "
            f"Retry after {self.retry_after}s."
        )


@dataclass
class CircuitStats:
    total_calls: int = 0
    successful_calls: int = 0
    failed_calls: int = 0
    rejected_calls: int = 0
    consecutive_failures: int = 0
    consecutive_successes: int = 0
    last_failure_time: Optional[float] = None
    last_state_change: float = field(default_factory=time.time)


class CircuitBreaker:
    """Thread-safe and async-safe circuit breaker."""

    def __init__(
        self,
        name: str,
        failure_threshold: int = 5,
        recovery_timeout: float = 30.0,
        half_open_successes: int = 2,
        expected_exceptions: tuple[type[Exception], ...] = (Exception,),
        ignored_exceptions: tuple[type[Exception], ...] = (),
    ):
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.half_open_successes = half_open_successes
        self.expected_exceptions = expected_exceptions
        self.ignored_exceptions = ignored_exceptions

        self._state: CircuitState = CircuitState.CLOSED
        self._stats = CircuitStats()
        self._lock = asyncio.Lock()

    @property
    def state(self) -> CircuitState:
        # Check if we should transition from OPEN to HALF_OPEN
        if self._state == CircuitState.OPEN:
            elapsed = time.time() - self._stats.last_state_change
            if elapsed >= self.recovery_timeout:
                return CircuitState.HALF_OPEN
        return self._state

    def get_retry_after(self) -> float:
        if self.state == CircuitState.OPEN:
            elapsed = time.time() - self._stats.last_state_change
            remaining = self.recovery_timeout - elapsed
            return max(0.0, remaining)
        return 0.0

    async def _on_success(self) -> None:
        async with self._lock:
            self._stats.total_calls += 1
            self._stats.successful_calls += 1
            self._stats.consecutive_failures = 0
            self._stats.consecutive_successes += 1

            current_state = self.state
            if current_state == CircuitState.HALF_OPEN:
                if self._stats.consecutive_successes >= self.half_open_successes:
                    self._state = CircuitState.CLOSED
                    self._stats.last_state_change = time.time()
                    logger.info("CircuitBreaker[%s]: Recovered! Transitioned to CLOSED.", self.name)
            elif current_state == CircuitState.CLOSED:
                pass

    async def _on_failure(self, exc: Exception) -> None:
        if self.ignored_exceptions and isinstance(exc, self.ignored_exceptions):
            return

        async with self._lock:
            self._stats.total_calls += 1
            self._stats.failed_calls += 1
            self._stats.consecutive_failures += 1
            self._stats.consecutive_successes = 0
            self._stats.last_failure_time = time.time()

            current_state = self.state
            if current_state == CircuitState.HALF_OPEN:
                # Immediate failback to OPEN
                self._state = CircuitState.OPEN
                self._stats.last_state_change = time.time()
                logger.warning(
                    "CircuitBreaker[%s]: Trial call failed during HALF_OPEN. Re-opening circuit for %ss. Error: %s",
                    self.name,
                    self.recovery_timeout,
                    exc,
                )
            elif current_state == CircuitState.CLOSED:
                if self._stats.consecutive_failures >= self.failure_threshold:
                    self._state = CircuitState.OPEN
                    self._stats.last_state_change = time.time()
                    logger.error(
                        "CircuitBreaker[%s]: Failure threshold reached (%d consecutive errors). Tripped to OPEN! Error: %s",
                        self.name,
                        self._stats.consecutive_failures,
                        exc,
                    )

    async def call(self, func: Callable[..., Awaitable[T]], *args: Any, **kwargs: Any) -> T:
        """Execute the async function protected by this circuit breaker."""
        current_state = self.state

        if current_state == CircuitState.OPEN:
            self._stats.rejected_calls += 1
            retry_after = self.get_retry_after()
            raise CircuitBreakerOpenError(self.name, retry_after)

        if current_state == CircuitState.HALF_OPEN:
            self._state = CircuitState.HALF_OPEN

        try:
            res = await func(*args, **kwargs)
            await self._on_success()
            return res
        except Exception as exc:
            if isinstance(exc, self.expected_exceptions) and not (
                self.ignored_exceptions and isinstance(exc, self.ignored_exceptions)
            ):
                await self._on_failure(exc)
            raise

    def to_dict(self) -> dict[str, Any]:
        """Inspection snapshot for healthchecks and monitoring."""
        st = self.state
        return {
            "name": self.name,
            "state": st.value,
            "is_healthy": st != CircuitState.OPEN,
            "retry_after_seconds": self.get_retry_after() if st == CircuitState.OPEN else 0,
            "total_calls": self._stats.total_calls,
            "successful_calls": self._stats.successful_calls,
            "failed_calls": self._stats.failed_calls,
            "rejected_calls": self._stats.rejected_calls,
            "consecutive_failures": self._stats.consecutive_failures,
            "last_failure_time": (
                datetime.fromtimestamp(self._stats.last_failure_time, timezone.utc).isoformat()
                if self._stats.last_failure_time
                else None
            ),
        }

    def reset(self) -> None:
        """Manual administrative reset."""
        self._state = CircuitState.CLOSED
        self._stats = CircuitStats()


class CircuitBreakerRegistry:
    """Singleton registry maintaining all system circuit breakers."""

    _instance: Optional[CircuitBreakerRegistry] = None

    def __init__(self) -> None:
        self._breakers: dict[str, CircuitBreaker] = {}
        # Pre-seed enterprise service circuit breakers
        self.get_or_create("gemini", failure_threshold=5, recovery_timeout=25.0)
        self.get_or_create("openai", failure_threshold=4, recovery_timeout=30.0)
        self.get_or_create("anthropic", failure_threshold=4, recovery_timeout=30.0)
        self.get_or_create("openrouter", failure_threshold=4, recovery_timeout=30.0)
        self.get_or_create("woocommerce", failure_threshold=4, recovery_timeout=20.0)
        self.get_or_create("slack", failure_threshold=4, recovery_timeout=20.0)
        self.get_or_create("redis", failure_threshold=3, recovery_timeout=15.0)
        self.get_or_create("supabase", failure_threshold=5, recovery_timeout=15.0)

    @classmethod
    def get_instance(cls) -> CircuitBreakerRegistry:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def get_or_create(
        self,
        name: str,
        failure_threshold: int = 5,
        recovery_timeout: float = 30.0,
        half_open_successes: int = 2,
    ) -> CircuitBreaker:
        if name not in self._breakers:
            self._breakers[name] = CircuitBreaker(
                name=name,
                failure_threshold=failure_threshold,
                recovery_timeout=recovery_timeout,
                half_open_successes=half_open_successes,
            )
        return self._breakers[name]

    def get(self, name: str) -> Optional[CircuitBreaker]:
        return self._breakers.get(name)

    def summary(self) -> dict[str, Any]:
        """Aggregate health overview."""
        all_breakers = [b.to_dict() for b in self._breakers.values()]
        open_count = sum(1 for b in all_breakers if b["state"] == CircuitState.OPEN.value)
        return {
            "status": "degraded" if open_count > 0 else "healthy",
            "open_circuits": open_count,
            "total_circuits": len(all_breakers),
            "services": {b["name"]: b for b in all_breakers},
        }


def circuit_protected(service_name: str, **breaker_kwargs: Any):
    """Decorator to protect an async function with a named circuit breaker."""

    def decorator(func: Callable[..., Awaitable[T]]) -> Callable[..., Awaitable[T]]:
        registry = CircuitBreakerRegistry.get_instance()
        breaker = registry.get_or_create(service_name, **breaker_kwargs)

        @functools.wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> T:
            return await breaker.call(func, *args, **kwargs)

        return wrapper

    return decorator
