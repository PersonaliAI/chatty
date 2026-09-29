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
