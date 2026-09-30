"""Deterministic campaign telemetry aggregation for dashboards and MCP."""

from __future__ import annotations

from collections import Counter
from typing import Any


def aggregate_campaign_events(events: list[dict[str, Any]] | None) -> dict[str, Any]:
    counts = Counter({kind: 0 for kind in ("impression", "click", "conversion")})
    by_device: Counter[str] = Counter()
    by_channel: Counter[str] = Counter()
    rows = events or []
    for event in rows:
        kind = str(event.get("event_type") or "").strip().lower()
        if kind not in counts:
            continue
        counts[kind] += 1
        metadata = event.get("metadata") if isinstance(event.get("metadata"), dict) else {}
        device = str(metadata.get("device") or "unknown").strip().lower()[:32] or "unknown"
        channel = str(metadata.get("channel") or "web").strip().lower()[:32] or "web"
        by_device[device] += 1
        by_channel[channel] += 1
    impressions = counts["impression"]
    return {
        "impression": counts["impression"],
        "click": counts["click"],
        "conversion": counts["conversion"],
        "click_rate": round(counts["click"] / impressions, 4) if impressions else 0,
        "conversion_rate": round(counts["conversion"] / impressions, 4) if impressions else 0,
        "sample_size": len(rows),
        "by_device": dict(sorted(by_device.items())),
        "by_channel": dict(sorted(by_channel.items())),
    }


def aggregate_campaign_deliveries(deliveries: list[dict[str, Any]] | None) -> dict[str, Any]:
    """Summarize durable provider execution state for operators."""
    counts = Counter({kind: 0 for kind in ("queued", "sent", "failed", "suppressed")})
    by_channel: Counter[str] = Counter()
    for row in deliveries or []:
        status = str(row.get("status") or "").strip().lower()
        if status not in counts:
            continue
        counts[status] += 1
        channel = str(row.get("channel") or "unknown").strip().lower()[:32] or "unknown"
        by_channel[channel] += 1
    attempted = counts["sent"] + counts["failed"] + counts["suppressed"]
    return {
        "queued": counts["queued"],
        "sent": counts["sent"],
        "failed": counts["failed"],
        "suppressed": counts["suppressed"],
        "delivery_success_rate": round(counts["sent"] / attempted, 4) if attempted else 0,
        "delivery_sample_size": len(deliveries or []),
        "delivery_by_channel": dict(sorted(by_channel.items())),
    }
