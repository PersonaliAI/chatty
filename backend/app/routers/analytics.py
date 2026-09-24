"""Industrial-grade analytics endpoints (/api/admin/analytics/*).

All aggregations run server-side so the browser never receives raw rows -
only pre-computed numbers. Every endpoint verifies bot ownership/team-member
access before touching any data.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.clients import supabase
from app.core.db import run_db
from app.core.deps import require_user
from app.core.permissions import get_bot_role_and_permissions

logger = logging.getLogger("chatty")

router = APIRouter()


# ---------------------------------------------------------------------------
# Auth helper
# ---------------------------------------------------------------------------

async def _require_bot_access(bot_id: str, user: dict[str, Any]) -> None:
    """Raise 403 unless the caller owns or is a team-member of `bot_id`."""
    try:
        await get_bot_role_and_permissions(bot_id, user)
    except HTTPException:
        raise HTTPException(status_code=403, detail="Unauthorized")


def _iso(dt: datetime) -> str:
    return dt.isoformat()


def _parse_date_param(val: Optional[str], default: datetime) -> datetime:
    """Parse an ISO date string from a query param; fall back to `default`."""
    if not val:
        return default
    try:
        dt = datetime.fromisoformat(val.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except ValueError:
        return default


def _session_channel(row: dict[str, Any]) -> str:
    """Return a stable channel, including legacy namespaced sessions."""
    session_id = str(row.get("session_id") or "").lower()
    if session_id.startswith("wa:"):
        return "whatsapp"
    if session_id.startswith("email_"):
        return "email"
    channel = str(row.get("channel") or "").strip().lower()
    return channel or "web"


def _priced_cost_stats(rows: list[dict[str, Any]]) -> tuple[float, int, int]:
    """Sum known costs and count calls whose provider price is unavailable."""
    total = 0.0
    priced = 0
    unpriced = 0
    for row in rows:
        raw_cost = row.get("cost_usd")
        if raw_cost is None:
            # A failed call with no response is not necessarily billable. A
            # successful/token-bearing call without a price is unknown, not $0.
            if row.get("success") or int(row.get("total_tokens") or 0) > 0:
                unpriced += 1
            continue
        try:
            total += float(raw_cost)
            priced += 1
        except (TypeError, ValueError):
            unpriced += 1
    return total, priced, unpriced


def _percentile(values: list[float], percentile: float) -> Optional[float]:
    if not values:
        return None
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, int(round((percentile / 100) * (len(ordered) - 1)))))
    return round(ordered[index], 2)


# ---------------------------------------------------------------------------
# 1. Overview — KPI summary with period-over-period deltas
# ---------------------------------------------------------------------------

@router.get("/api/admin/analytics/overview", tags=["Dashboard - Analytics"])
async def analytics_overview(
    bot_id: str = Query(...),
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    user: dict[str, Any] = Depends(require_user),
):
    """Return 8 top-level KPI metrics plus period-over-period delta percentages."""
    await _require_bot_access(bot_id, user)

    now = datetime.now(timezone.utc)
    to_dt = _parse_date_param(to_date, now)
    from_dt = _parse_date_param(from_date, to_dt - timedelta(days=30))
    period_len = (to_dt - from_dt).total_seconds()
    prev_from = from_dt - timedelta(seconds=period_len)
    prev_to = from_dt

    from_iso = _iso(from_dt)
    to_iso = _iso(to_dt)
    prev_from_iso = _iso(prev_from)
    prev_to_iso = _iso(prev_to)

    # --- current period ---
    sess_res = await run_db(lambda: supabase.table("chatty_sessions")
        .select("id, needs_attention, status, sla_status, channel, first_response_due_at, first_responded_at, resolved_at, created_at", count="exact")
        .eq("bot_id", bot_id)
        .gte("created_at", from_iso).lte("created_at", to_iso)
        .execute())
    sessions = sess_res.data or []
    total_sessions = sess_res.count or 0

    msg_res = await run_db(lambda: supabase.table("chatty_conversations")
        .select("id, sender, created_at", count="exact")
        .eq("bot_id", bot_id)
        .in_("sender", ["user", "visitor"])
        .gte("created_at", from_iso).lte("created_at", to_iso)
        .execute())
    total_messages = msg_res.count or 0

    leads_res = await run_db(lambda: supabase.table("chatty_leads")
        .select("id", count="exact")
        .eq("bot_id", bot_id)
        .gte("created_at", from_iso).lte("created_at", to_iso)
        .execute())
    total_leads = leads_res.count or 0

    meetings_res = await run_db(lambda: supabase.table("chatty_meetings")
        .select("id", count="exact")
        .eq("bot_id", bot_id)
        .gte("created_at", from_iso).lte("created_at", to_iso)
        .execute())
    total_meetings = meetings_res.count or 0

    ai_res = await run_db(lambda: supabase.table("chatty_ai_usage")
        .select("total_tokens, cost_usd, success, latency_ms")
        .eq("bot_id", bot_id)
        .eq("success", True)
        .gte("created_at", from_iso).lte("created_at", to_iso)
        .execute())
    ai_rows = ai_res.data or []
    ai_cost, ai_priced_calls, ai_unpriced_calls = _priced_cost_stats(ai_rows)
    ai_tokens = sum(int(r.get("total_tokens") or 0) for r in ai_rows)

    csat_res = await run_db(lambda: supabase.table("chatty_csat_feedback")
        .select("rating")
        .eq("bot_id", bot_id)
        .gte("created_at", from_iso).lte("created_at", to_iso)
        .execute())
    csat_rows = csat_res.data or []

    # Derived metrics
    deflected = sum(1 for s in sessions if not s.get("needs_attention"))
    deflection_rate = round((deflected / total_sessions * 100), 1) if total_sessions else 0.0

    lead_conversion = round((total_leads / total_sessions * 100), 1) if total_sessions else 0.0

    csat_avg = round(sum(r["rating"] for r in csat_rows) / len(csat_rows), 2) if csat_rows else None

    resolved_sessions = [s for s in sessions if s.get("resolved_at") and s.get("created_at")]
    if resolved_sessions:
        durations = []
        for s in resolved_sessions:
            try:
                c = datetime.fromisoformat(s["created_at"].replace("Z", "+00:00"))
                r = datetime.fromisoformat(s["resolved_at"].replace("Z", "+00:00"))
                durations.append((r - c).total_seconds() / 60)
            except Exception:
                pass
        avg_resolution_min = round(sum(durations) / len(durations), 1) if durations else None
    else:
        avg_resolution_min = None

    sla_breached = sum(1 for s in sessions if s.get("sla_status") == "breached")
    sla_breach_rate = round((sla_breached / total_sessions * 100), 1) if total_sessions else 0.0

    # --- previous period for deltas ---
    prev_sess_res = await run_db(lambda: supabase.table("chatty_sessions")
        .select("id", count="exact")
        .eq("bot_id", bot_id)
        .gte("created_at", prev_from_iso).lte("created_at", prev_to_iso)
        .execute())
    prev_sessions = prev_sess_res.count or 0

    prev_msg_res = await run_db(lambda: supabase.table("chatty_conversations")
        .select("id", count="exact")
        .eq("bot_id", bot_id).in_("sender", ["user", "visitor"])
        .gte("created_at", prev_from_iso).lte("created_at", prev_to_iso)
        .execute())
    prev_messages = prev_msg_res.count or 0

    prev_leads_res = await run_db(lambda: supabase.table("chatty_leads")
        .select("id", count="exact")
        .eq("bot_id", bot_id)
        .gte("created_at", prev_from_iso).lte("created_at", prev_to_iso)
        .execute())
    prev_leads = prev_leads_res.count or 0

    prev_ai_res = await run_db(lambda: supabase.table("chatty_ai_usage")
        .select("cost_usd")
        .eq("bot_id", bot_id).eq("success", True)
        .gte("created_at", prev_from_iso).lte("created_at", prev_to_iso)
        .execute())
    prev_ai_cost, _, _ = _priced_cost_stats(prev_ai_res.data or [])

    def delta(curr, prev):
        if prev == 0:
            return None
        return round(((curr - prev) / prev) * 100, 1)

    return {
        "period": {"from": from_iso, "to": to_iso},
        "kpis": {
            "total_sessions": {"value": total_sessions, "delta": delta(total_sessions, prev_sessions)},
            "total_messages": {"value": total_messages, "delta": delta(total_messages, prev_messages)},
            "deflection_rate": {"value": deflection_rate, "delta": None},
            "lead_conversion": {"value": lead_conversion, "delta": delta(total_leads, prev_leads)},
            "avg_resolution_min": {"value": avg_resolution_min, "delta": None},
            "csat_avg": {"value": csat_avg, "delta": None},
            "total_meetings": {"value": total_meetings, "delta": None},
            "ai_cost_usd": {"value": round(ai_cost, 4), "delta": delta(ai_cost, prev_ai_cost)},
            "ai_cost_priced_calls": {"value": ai_priced_calls, "delta": None},
            "ai_cost_unpriced_calls": {"value": ai_unpriced_calls, "delta": None},
            "ai_tokens": {"value": ai_tokens, "delta": None},
            "sla_breach_rate": {"value": sla_breach_rate, "delta": None},
            "total_csat_responses": {"value": len(csat_rows), "delta": None},
        },
    }


# ---------------------------------------------------------------------------
# 2. Volume — time-series conversation + message counts
# ---------------------------------------------------------------------------

@router.get("/api/admin/analytics/volume", tags=["Dashboard - Analytics"])
async def analytics_volume(
    bot_id: str = Query(...),
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    granularity: str = Query("day", pattern="^(day|hour)$"),
    user: dict[str, Any] = Depends(require_user),
):
    """Return daily or hourly conversation and message counts for a line chart."""
    await _require_bot_access(bot_id, user)

    now = datetime.now(timezone.utc)
    to_dt = _parse_date_param(to_date, now)
    from_dt = _parse_date_param(from_date, to_dt - timedelta(days=30))

    from_iso = _iso(from_dt)
    to_iso = _iso(to_dt)

    sess_res = await run_db(lambda: supabase.table("chatty_sessions")
        .select("created_at")
        .eq("bot_id", bot_id)
        .gte("created_at", from_iso).lte("created_at", to_iso)
        .execute())

    msg_res = await run_db(lambda: supabase.table("chatty_conversations")
        .select("created_at")
        .eq("bot_id", bot_id).in_("sender", ["user", "visitor"])
        .gte("created_at", from_iso).lte("created_at", to_iso)
        .execute())

    # Build bucket map
    sess_counts: dict[str, int] = defaultdict(int)
    for row in (sess_res.data or []):
        try:
            dt = datetime.fromisoformat(row["created_at"].replace("Z", "+00:00"))
            key = dt.strftime("%Y-%m-%dT%H:00:00" if granularity == "hour" else "%Y-%m-%d")
            sess_counts[key] += 1
        except Exception:
            pass

    msg_counts: dict[str, int] = defaultdict(int)
    for row in (msg_res.data or []):
        try:
            dt = datetime.fromisoformat(row["created_at"].replace("Z", "+00:00"))
            key = dt.strftime("%Y-%m-%dT%H:00:00" if granularity == "hour" else "%Y-%m-%d")
            msg_counts[key] += 1
        except Exception:
            pass

    # Generate complete bucket list (no gaps)
    buckets = []
    cursor = from_dt
    step = timedelta(hours=1) if granularity == "hour" else timedelta(days=1)
    while cursor <= to_dt:
        key = cursor.strftime("%Y-%m-%dT%H:00:00" if granularity == "hour" else "%Y-%m-%d")
        buckets.append({
            "date": key,
            "sessions": sess_counts.get(key, 0),
            "messages": msg_counts.get(key, 0),
        })
        cursor += step

    return {"granularity": granularity, "data": buckets}


# ---------------------------------------------------------------------------
# 3. Channel breakdown
# ---------------------------------------------------------------------------

@router.get("/api/admin/analytics/channels", tags=["Dashboard - Analytics"])
async def analytics_channels(
    bot_id: str = Query(...),
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    user: dict[str, Any] = Depends(require_user),
):
    """Return per-channel session counts (web, email, whatsapp, voice, slack, …)."""
    await _require_bot_access(bot_id, user)

    now = datetime.now(timezone.utc)
    to_dt = _parse_date_param(to_date, now)
    from_dt = _parse_date_param(from_date, to_dt - timedelta(days=30))

    res = await run_db(lambda: supabase.table("chatty_sessions")
        .select("channel, session_id")
        .eq("bot_id", bot_id)
        .gte("created_at", _iso(from_dt)).lte("created_at", _iso(to_dt))
        .execute())

    counts: dict[str, int] = defaultdict(int)
    seen_session_ids: set[str] = set()
    for row in (res.data or []):
        session_id = str(row.get("session_id") or "")
        if session_id and session_id in seen_session_ids:
            continue
        if session_id:
            seen_session_ids.add(session_id)
        counts[_session_channel(row)] += 1

    # Older WhatsApp traffic may predate the session upsert. Recover those
    # sessions from message rows so the breakdown reflects actual channels.
    msg_res = await run_db(lambda: supabase.table("chatty_conversations")
        .select("session_id")
        .eq("bot_id", bot_id)
        .in_("sender", ["user", "visitor"])
        .gte("created_at", _iso(from_dt)).lte("created_at", _iso(to_dt))
        .execute())
    for row in (msg_res.data or []):
        session_id = str(row.get("session_id") or "")
        if not session_id or session_id in seen_session_ids:
            continue
        seen_session_ids.add(session_id)
        counts[_session_channel({"session_id": session_id})] += 1

    total = sum(counts.values()) or 1
    return {
        "data": [
            {"channel": ch, "sessions": cnt, "pct": round(cnt / total * 100, 1)}
            for ch, cnt in sorted(counts.items(), key=lambda x: -x[1])
        ]
    }


# ---------------------------------------------------------------------------
# 4. Traffic heatmap — hour-of-day × day-of-week density
# ---------------------------------------------------------------------------

@router.get("/api/admin/analytics/heatmap", tags=["Dashboard - Analytics"])
async def analytics_heatmap(
    bot_id: str = Query(...),
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    user: dict[str, Any] = Depends(require_user),
):
    """Return a 7×24 matrix of session counts by weekday and hour of day."""
    await _require_bot_access(bot_id, user)

    now = datetime.now(timezone.utc)
    to_dt = _parse_date_param(to_date, now)
    from_dt = _parse_date_param(from_date, to_dt - timedelta(days=90))

    res = await run_db(lambda: supabase.table("chatty_sessions")
        .select("created_at")
        .eq("bot_id", bot_id)
        .gte("created_at", _iso(from_dt)).lte("created_at", _iso(to_dt))
        .execute())

    # grid[weekday 0=Mon][hour] = count
    grid: list[list[int]] = [[0] * 24 for _ in range(7)]
    for row in (res.data or []):
        try:
            dt = datetime.fromisoformat(row["created_at"].replace("Z", "+00:00"))
            grid[dt.weekday()][dt.hour] += 1
        except Exception:
            pass

    max_val = max((max(row) for row in grid), default=1) or 1
    days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

    return {
        "max": max_val,
        "data": [
            {"day": days[d], "hour": h, "count": grid[d][h], "intensity": round(grid[d][h] / max_val, 3)}
            for d in range(7)
            for h in range(24)
        ],
    }


# ---------------------------------------------------------------------------
# 5. Agent performance
# ---------------------------------------------------------------------------

@router.get("/api/admin/analytics/agents", tags=["Dashboard - Analytics"])
async def analytics_agents(
    bot_id: str = Query(...),
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    user: dict[str, Any] = Depends(require_user),
):
    """Per-agent: assigned tickets, resolved, avg first-reply time (min), CSAT, SLA compliance."""
    await _require_bot_access(bot_id, user)

    now = datetime.now(timezone.utc)
    to_dt = _parse_date_param(to_date, now)
    from_dt = _parse_date_param(from_date, to_dt - timedelta(days=30))
    from_iso = _iso(from_dt)
    to_iso = _iso(to_dt)

    sess_res = await run_db(lambda: supabase.table("chatty_sessions")
        .select("id, session_id, assigned_agent_email, assigned_agent_name, status, sla_status, first_responded_at, first_response_due_at, resolved_at, created_at")
        .eq("bot_id", bot_id)
        .not_.is_("assigned_agent_email", "null")
        .gte("created_at", from_iso).lte("created_at", to_iso)
        .execute())

    csat_res = await run_db(lambda: supabase.table("chatty_csat_feedback")
        .select("rating, session_id")
        .eq("bot_id", bot_id)
        .gte("created_at", from_iso).lte("created_at", to_iso)
        .execute())

    # map session_id -> CSAT rating for joining
    sess_to_csat: dict[str, int] = {}
    for c in (csat_res.data or []):
        if c.get("session_id"):
            sess_to_csat[c["session_id"]] = c["rating"]

    # aggregate per agent
    agents: dict[str, dict] = {}
    for s in (sess_res.data or []):
        email = s.get("assigned_agent_email") or ""
        if not email:
            continue
        if email not in agents:
            agents[email] = {
                "email": email,
                "name": s.get("assigned_agent_name") or email,
                "assigned": 0,
                "resolved": 0,
                "first_reply_times_min": [],
                "csat_ratings": [],
                "sla_met": 0,
                "sla_breached": 0,
            }
        a = agents[email]
        a["assigned"] += 1

        if s.get("status") in ("resolved", "closed"):
            a["resolved"] += 1

        if s.get("first_responded_at") and s.get("created_at"):
            try:
                c_dt = datetime.fromisoformat(s["created_at"].replace("Z", "+00:00"))
                r_dt = datetime.fromisoformat(s["first_responded_at"].replace("Z", "+00:00"))
                a["first_reply_times_min"].append((r_dt - c_dt).total_seconds() / 60)
            except Exception:
                pass

        sid = s.get("id") or s.get("session_id")
        if sid and sid in sess_to_csat:
            a["csat_ratings"].append(sess_to_csat[sid])

        sl = s.get("sla_status")
        if sl == "met":
            a["sla_met"] += 1
        elif sl == "breached":
            a["sla_breached"] += 1

    result = []
    for a in agents.values():
        frt = a["first_reply_times_min"]
        csat = a["csat_ratings"]
        sla_total = a["sla_met"] + a["sla_breached"]
        result.append({
            "email": a["email"],
            "name": a["name"],
            "assigned": a["assigned"],
            "resolved": a["resolved"],
            "resolution_rate": round(a["resolved"] / a["assigned"] * 100, 1) if a["assigned"] else 0,
            "avg_first_reply_min": round(sum(frt) / len(frt), 1) if frt else None,
            "csat_avg": round(sum(csat) / len(csat), 2) if csat else None,
            "sla_compliance_pct": round(a["sla_met"] / sla_total * 100, 1) if sla_total else None,
        })

    result.sort(key=lambda x: -x["assigned"])
    return {"data": result}


# ---------------------------------------------------------------------------
# 6. SLA compliance time series
# ---------------------------------------------------------------------------

@router.get("/api/admin/analytics/sla", tags=["Dashboard - Analytics"])
async def analytics_sla(
    bot_id: str = Query(...),
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    user: dict[str, Any] = Depends(require_user),
):
    """Return daily SLA on_track / met / breached counts for a stacked bar chart."""
    await _require_bot_access(bot_id, user)

    now = datetime.now(timezone.utc)
    to_dt = _parse_date_param(to_date, now)
    from_dt = _parse_date_param(from_date, to_dt - timedelta(days=30))

    res = await run_db(lambda: supabase.table("chatty_sessions")
        .select("sla_status, created_at")
        .eq("bot_id", bot_id)
        .gte("created_at", _iso(from_dt)).lte("created_at", _iso(to_dt))
        .execute())

    daily: dict[str, dict[str, int]] = defaultdict(lambda: {"on_track": 0, "met": 0, "breached": 0})
    for row in (res.data or []):
        try:
            dt = datetime.fromisoformat(row["created_at"].replace("Z", "+00:00"))
            key = dt.strftime("%Y-%m-%d")
            status = row.get("sla_status") or "on_track"
            if status in daily[key]:
                daily[key][status] += 1
        except Exception:
            pass

    # Fill all days
    data = []
    cursor = from_dt
    while cursor <= to_dt:
        key = cursor.strftime("%Y-%m-%d")
        d = daily.get(key, {"on_track": 0, "met": 0, "breached": 0})
        data.append({"date": key, **d})
        cursor += timedelta(days=1)

    return {"data": data}


# ---------------------------------------------------------------------------
# 7. AI cost breakdown (per-model, per-day sparkline)
# ---------------------------------------------------------------------------

@router.get("/api/admin/analytics/ai-cost", tags=["Dashboard - Analytics"])
async def analytics_ai_cost(
    bot_id: str = Query(...),
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    user: dict[str, Any] = Depends(require_user),
):
    """Return per-model totals AND a daily cost time series for sparkline charts."""
    await _require_bot_access(bot_id, user)

    now = datetime.now(timezone.utc)
    to_dt = _parse_date_param(to_date, now)
    from_dt = _parse_date_param(from_date, to_dt - timedelta(days=30))

    res = await run_db(lambda: supabase.table("chatty_ai_usage")
        .select("model, provider, call_type, prompt_tokens, completion_tokens, total_tokens, cost_usd, latency_ms, success, is_byok, created_at")
        .eq("bot_id", bot_id)
        .gte("created_at", _iso(from_dt)).lte("created_at", _iso(to_dt))
        .execute())
    rows = res.data or []

    # Per-model summary
    by_model: dict[str, dict] = defaultdict(lambda: {
        "calls": 0, "successful_calls": 0, "failed_calls": 0,
        "prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0,
        "cost_usd": 0.0, "priced_calls": 0, "unpriced_calls": 0,
        "latency_ms_sum": 0, "latency_count": 0,
    })
    daily_cost: dict[str, float] = defaultdict(float)

    for r in rows:
        m = r.get("model") or "unknown"
        entry = by_model[m]
        entry["calls"] += 1
        if r.get("success"):
            entry["successful_calls"] += 1
        else:
            entry["failed_calls"] += 1
        entry["prompt_tokens"] += int(r.get("prompt_tokens") or 0)
        entry["completion_tokens"] += int(r.get("completion_tokens") or 0)
        entry["total_tokens"] += int(r.get("total_tokens") or 0)
        raw_cost = r.get("cost_usd")
        if raw_cost is None:
            if r.get("success") or int(r.get("total_tokens") or 0) > 0:
                entry["unpriced_calls"] += 1
        else:
            try:
                entry["cost_usd"] += float(raw_cost)
                entry["priced_calls"] += 1
            except (TypeError, ValueError):
                entry["unpriced_calls"] += 1
        if r.get("latency_ms"):
            entry["latency_ms_sum"] += int(r["latency_ms"])
            entry["latency_count"] += 1

        try:
            dt = datetime.fromisoformat(r["created_at"].replace("Z", "+00:00"))
            if r.get("cost_usd") is not None:
                daily_cost[dt.strftime("%Y-%m-%d")] += float(r["cost_usd"])
        except Exception:
            pass

    model_rows = []
    for model, e in sorted(by_model.items(), key=lambda x: -x[1]["cost_usd"]):
        model_rows.append({
            "model": model,
            "calls": e["calls"],
            "successful_calls": e["successful_calls"],
            "failed_calls": e["failed_calls"],
            "prompt_tokens": e["prompt_tokens"],
            "completion_tokens": e["completion_tokens"],
            "total_tokens": e["total_tokens"],
            "cost_usd": round(e["cost_usd"], 6),
            "priced_calls": e["priced_calls"],
            "unpriced_calls": e["unpriced_calls"],
            "avg_latency_ms": round(e["latency_ms_sum"] / e["latency_count"]) if e["latency_count"] else None,
        })

    # Daily series (no gaps)
    daily_series = []
    cursor = from_dt
    while cursor <= to_dt:
        key = cursor.strftime("%Y-%m-%d")
        daily_series.append({"date": key, "cost_usd": round(daily_cost.get(key, 0), 6)})
        cursor += timedelta(days=1)

    total_cost = sum(e["cost_usd"] for e in by_model.values())
    total_tokens = sum(e["total_tokens"] for e in by_model.values())
    priced_calls = sum(e["priced_calls"] for e in by_model.values())
    unpriced_calls = sum(e["unpriced_calls"] for e in by_model.values())

    return {
        "total_cost_usd": round(total_cost, 6),
        "total_tokens": total_tokens,
        "cost_status": {
            "complete": unpriced_calls == 0,
            "priced_calls": priced_calls,
            "unpriced_calls": unpriced_calls,
        },
        "by_model": model_rows,
        "daily_series": daily_series,
    }


# ---------------------------------------------------------------------------
# 8. Voice agent health and capacity
# ---------------------------------------------------------------------------

@router.get("/api/admin/analytics/voice", tags=["Dashboard - Analytics"])
async def analytics_voice(
    bot_id: str = Query(...),
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    user: dict[str, Any] = Depends(require_user),
):
    """Return aggregate voice latency, resource and cost telemetry only."""
    await _require_bot_access(bot_id, user)
    now = datetime.now(timezone.utc)
    to_dt = _parse_date_param(to_date, now)
    from_dt = _parse_date_param(from_date, to_dt - timedelta(days=30))
    columns = (
        "mode, provider, model, duration_seconds, input_tokens, output_tokens, cost_usd, "
        "peak_rss_mb, cpu_seconds, avg_cpu_percent, first_response_latency_ms, turn_count, "
        "nudge_count, error_count, created_at"
    )
    try:
        res = await run_db(lambda: supabase.table("chatty_voice_calls")
            .select(columns)
            .eq("bot_id", bot_id)
            .gte("created_at", _iso(from_dt)).lte("created_at", _iso(to_dt))
            .execute())
        rows = res.data or []
    except Exception:
        # Rolling deploys can briefly run before the additive telemetry
        # migration. Fall back to the legacy columns so calls/duration/cost
        # remain visible instead of turning the panel blank.
        logger.warning("voice analytics telemetry columns unavailable; using legacy fields")
        try:
            res = await run_db(lambda: supabase.table("chatty_voice_calls")
                .select("mode, provider, model, duration_seconds, input_tokens, output_tokens, cost_usd, created_at")
                .eq("bot_id", bot_id)
                .gte("created_at", _iso(from_dt)).lte("created_at", _iso(to_dt))
                .execute())
            rows = res.data or []
        except Exception:
            logger.exception("voice analytics query failed")
            rows = []

    def nums(name: str) -> list[float]:
        out: list[float] = []
        for row in rows:
            try:
                if row.get(name) is not None:
                    out.append(float(row[name]))
            except (TypeError, ValueError):
                pass
        return out

    duration = nums("duration_seconds")
    latency = nums("first_response_latency_ms")
    rss = nums("peak_rss_mb")
    cpu = nums("avg_cpu_percent")
    costs = _priced_cost_stats(rows)
    by_mode: dict[str, dict[str, Any]] = defaultdict(lambda: {"calls": 0, "cost_usd": 0.0})
    for row in rows:
        mode = str(row.get("mode") or "unknown")
        by_mode[mode]["calls"] += 1
        if row.get("cost_usd") is not None:
            try: by_mode[mode]["cost_usd"] += float(row["cost_usd"])
            except (TypeError, ValueError): pass

    return {
        "period": {"from": _iso(from_dt), "to": _iso(to_dt)},
        "calls": len(rows),
        "duration_seconds": {"avg": round(sum(duration) / len(duration), 2) if duration else None, "p95": _percentile(duration, 95)},
        "first_response_latency_ms": {"avg": round(sum(latency) / len(latency), 2) if latency else None, "p95": _percentile(latency, 95)},
        "peak_rss_mb": {"avg": round(sum(rss) / len(rss), 2) if rss else None, "p95": _percentile(rss, 95)},
        "avg_cpu_percent": {"avg": round(sum(cpu) / len(cpu), 2) if cpu else None, "p95": _percentile(cpu, 95)},
        "turns": sum(int(row.get("turn_count") or 0) for row in rows),
        "nudges": sum(int(row.get("nudge_count") or 0) for row in rows),
        "errors": sum(int(row.get("error_count") or 0) for row in rows),
        "cost_usd": round(costs[0], 6),
        "cost_status": {"priced_calls": costs[1], "unpriced_calls": costs[2], "complete": costs[2] == 0},
        "by_mode": [{"mode": mode, "calls": value["calls"], "cost_usd": round(value["cost_usd"], 6)} for mode, value in sorted(by_mode.items())],
    }


# ---------------------------------------------------------------------------
# 9. CSAT trend
# ---------------------------------------------------------------------------

@router.get("/api/admin/analytics/csat", tags=["Dashboard - Analytics"])
async def analytics_csat(
    bot_id: str = Query(...),
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    user: dict[str, Any] = Depends(require_user),
):
    """Return daily average CSAT rating and distribution for a trend chart."""
    await _require_bot_access(bot_id, user)

    now = datetime.now(timezone.utc)
    to_dt = _parse_date_param(to_date, now)
    from_dt = _parse_date_param(from_date, to_dt - timedelta(days=30))

    res = await run_db(lambda: supabase.table("chatty_csat_feedback")
        .select("rating, created_at")
        .eq("bot_id", bot_id)
        .gte("created_at", _iso(from_dt)).lte("created_at", _iso(to_dt))
        .execute())
    rows = res.data or []

    daily_ratings: dict[str, list[int]] = defaultdict(list)
    distribution = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    for r in rows:
        rating = int(r.get("rating") or 0)
        if rating in distribution:
            distribution[rating] += 1
        try:
            dt = datetime.fromisoformat(r["created_at"].replace("Z", "+00:00"))
            daily_ratings[dt.strftime("%Y-%m-%d")].append(rating)
        except Exception:
            pass

    daily_series = []
    cursor = from_dt
    while cursor <= to_dt:
        key = cursor.strftime("%Y-%m-%d")
        ratings = daily_ratings.get(key, [])
        daily_series.append({
            "date": key,
            "avg": round(sum(ratings) / len(ratings), 2) if ratings else None,
            "count": len(ratings),
        })
        cursor += timedelta(days=1)

    all_ratings = [r["rating"] for r in rows if r.get("rating")]
    overall_avg = round(sum(all_ratings) / len(all_ratings), 2) if all_ratings else None

    return {
        "overall_avg": overall_avg,
        "total_responses": len(all_ratings),
        "distribution": [{"stars": k, "count": v} for k, v in distribution.items()],
        "daily_series": daily_series,
    }
