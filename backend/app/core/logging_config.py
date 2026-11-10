"""Enterprise Structured JSON Logging and Sensitive Data Masking.

Provides:
  * StructuredJsonFormatter: Formats log records into JSON with ISO timestamps,
    correlation IDs, and context metrics for Datadog, ELK, CloudWatch, Cloud Run.
  * PII and Secret Sanitizer: Automatic redactor preventing leak of API keys,
    bearer tokens, card numbers, or passwords into logs.
  * EnterpriseLoggingMiddleware: Records request completion latency, status codes,
    and client IPs with zero secret leaks.
"""

from __future__ import annotations

import json
import logging
import re
import sys
import time
from typing import Any, Optional

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

logger = logging.getLogger("chatty.logging")

# Compiled redaction patterns for enterprise log security
_SECRET_PATTERNS = [
    # API keys and bearer tokens
    (re.compile(r"(Bearer\s+)[A-Za-z0-9_\-\.]{8,}", re.IGNORECASE), r"\1[REDACTED_BEARER]"),
    (re.compile(r"(chatty_sk_[a-zA-Z0-9_\-]{8,})", re.IGNORECASE), "[REDACTED_CHATTY_KEY]"),
    (re.compile(r"(ck_[a-zA-Z0-9]{20,})", re.IGNORECASE), "[REDACTED_WC_KEY]"),
    (re.compile(r"(cs_[a-zA-Z0-9]{20,})", re.IGNORECASE), "[REDACTED_WC_SECRET]"),
    (re.compile(r"(xoxb-[0-9]{10,}-[0-9]{10,}-[a-zA-Z0-9]{20,})", re.IGNORECASE), "[REDACTED_SLACK_TOKEN]"),
    (re.compile(r"(sk-(?:live|test|ant|proj)?[A-Za-z0-9_\-]{20,})", re.IGNORECASE), "[REDACTED_AI_KEY]"),
    # Credit Card Numbers (13-16 digits with optional dashes/spaces)
    (re.compile(r"\b(?:\d[ -]*?){13,16}\b"), "[REDACTED_CARD_NUMBER]"),
    # Password parameters
    (re.compile(r"(password['\"]?\s*[:=]\s*['\"])[^'\"]+(['\"])", re.IGNORECASE), r"\1[REDACTED_PASSWORD]\2"),
]


def redact_sensitive_text(text: str) -> str:
    """Mask credentials, tokens, and payment identifiers in string data."""
    if not text or not isinstance(text, str):
        return text
    clean = text
    for pattern, repl in _SECRET_PATTERNS:
        clean = pattern.sub(repl, clean)
    return clean


class StructuredJsonFormatter(logging.Formatter):
    """Formats log records as single-line JSON with security scrubbing."""

    def format(self, record: logging.LogRecord) -> str:
        log_obj: dict[str, Any] = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "message": redact_sensitive_text(record.getMessage()),
        }

        # Attach request_id if present in record attributes
        if hasattr(record, "request_id") and record.request_id:
            log_obj["request_id"] = record.request_id
        if hasattr(record, "duration_ms") and record.duration_ms is not None:
            log_obj["duration_ms"] = record.duration_ms
        if hasattr(record, "client_ip") and record.client_ip:
            log_obj["client_ip"] = record.client_ip
        if hasattr(record, "path") and record.path:
            log_obj["path"] = record.path
        if hasattr(record, "status_code") and record.status_code:
            log_obj["status_code"] = record.status_code

        if record.exc_info:
            log_obj["exception"] = redact_sensitive_text(self.formatException(record.exc_info))

        return json.dumps(log_obj, ensure_ascii=False)


def setup_structured_logging(level: int = logging.INFO, json_format: bool = True) -> None:
    """Configure root logger with structured JSON formatting and scrubbing."""
    handler = logging.StreamHandler(sys.stdout)
    if json_format:
        formatter = StructuredJsonFormatter()
    else:
        formatter = logging.Formatter(
            "%(asctime)s [%(levelname)s] %(name)s (req=%(request_id)s): %(message)s",
            defaults={"request_id": "-"},
        )
    handler.setFormatter(formatter)

    root = logging.getLogger()
    # Avoid duplicate handlers
    if not any(isinstance(h.formatter, StructuredJsonFormatter) for h in root.handlers):
        root.handlers = [handler]
        root.setLevel(level)


class EnterpriseLoggingMiddleware(BaseHTTPMiddleware):
    """Logs incoming HTTP requests with latency and correlation IDs without noise."""

    _SKIP_PATHS = frozenset({"/health", "/ready", "/health/live", "/health/ready", "/favicon.ico"})

    async def dispatch(self, request: Request, call_next):
        start_time = time.perf_counter()
        req_id = getattr(request.state, "request_id", "") or request.headers.get("x-request-id", "")
        path = request.url.path

        try:
            response = await call_next(request)
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

            if path not in self._SKIP_PATHS:
                client_ip = (
                    request.headers.get("x-forwarded-for", "").split(",")[0].strip()
                    or (request.client.host if request.client else "")
                )
                logger.info(
                    "HTTP %s %s -> %d in %sms",
                    request.method,
                    path,
                    response.status_code,
                    duration_ms,
                    extra={
                        "request_id": req_id,
                        "path": path,
                        "method": request.method,
                        "status_code": response.status_code,
                        "duration_ms": duration_ms,
                        "client_ip": client_ip,
                    },
                )
            return response

        except Exception as exc:
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            logger.error(
                "HTTP %s %s failed in %sms: %s",
                request.method,
                path,
                duration_ms,
                exc,
                extra={
                    "request_id": req_id,
                    "path": path,
                    "method": request.method,
                    "status_code": 500,
                    "duration_ms": duration_ms,
                },
            )
            raise
