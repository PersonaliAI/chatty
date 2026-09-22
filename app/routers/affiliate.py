"""Affiliate Partner Portal API: profile, registration, analytics, referrals,
payout settings, and real-time referral code availability.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timezone, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.clients import supabase
from app.core.db import run_db
from app.core.deps import require_user
from app.core.config import DEPLOYMENT_PROFILE
from app.core.db_pool import connection
from app.schemas.affiliate import (
    AffiliateJoinRequest,
    AffiliateSettingsUpdateRequest,
)

logger = logging.getLogger("chatty.affiliate")

router = APIRouter(prefix="/api/affiliate", tags=["affiliate"])

RESERVED_CODES = frozenset({
    "admin", "administrator", "api", "dashboard", "affiliate", "affiliates",
    "partner", "partners", "checkout", "pricing", "login", "signup", "register",
    "help", "docs", "documentation", "support", "root", "auth", "null", "undefined",
    "chatty", "personaliai", "official", "billing", "terms", "privacy", "blog",
})

DEFAULT_COMMISSION_RATE_BPS = 3000  # 30%
DEFAULT_COOKIE_WINDOW_DAYS = 60
DEFAULT_PAYOUT_HOLD_DAYS = 30
DEFAULT_MINIMUM_PAYOUT_CENTS = 5000  # $50.00


def _self_host() -> bool:
    return DEPLOYMENT_PROFILE == "self_host"


async def _sql(fn):
    """Run a parameterized PostgreSQL adapter operation off the event loop."""
    return await run_db(fn)


def clean_code(raw: str) -> str | None:
    if not isinstance(raw, str):
        return None
    code = raw.strip().lower()
    if len(code) < 3 or len(code) > 80:
        return None
    if not re.match(r"^[a-z0-9][a-z0-9_-]{2,79}$", code):
        return None
    if code in RESERVED_CODES:
        return None
    return code


def mask_email(email: str | None) -> str:
    if not email or "@" not in email:
        return "Customer"
    parts = email.split("@", 1)
    username = parts[0]
    domain = parts[1]
    if len(username) <= 2:
        masked_user = username[0] + "***"
    else:
        masked_user = username[:2] + "***"
    return f"{masked_user}@{domain}"


@router.get("/check-code")
async def check_referral_code(code: str = Query(..., min_length=2, max_length=80)):
    """Pre-flight validation to check if a referral code is valid and available."""
    cleaned = clean_code(code)
    if not cleaned:
        if code.strip().lower() in RESERVED_CODES:
            return {"available": False, "code": code, "reason": "This referral code is reserved."}
        return {
            "available": False,
            "code": code,
            "reason": "Code must be 3-80 characters using only lowercase letters, numbers, hyphens, or underscores.",
        }

    if _self_host():
        def _exists() -> bool:
            with connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT 1 FROM affiliate_profiles WHERE referral_code = %s LIMIT 1", (cleaned,))
                    return cur.fetchone() is not None
        exists = await _sql(_exists)
    else:
        res = await run_db(
            lambda: supabase.table("affiliate_profiles")
            .select("id")
            .eq("referral_code", cleaned)
            .limit(1)
            .execute()
        )
        exists = bool(res.data)
    if exists:
        return {"available": False, "code": cleaned, "reason": "This referral code is already taken."}

    return {"available": True, "code": cleaned, "reason": None}


@router.get("/me")
async def get_my_affiliate_profile(user: dict[str, Any] = Depends(require_user)):
    """Fetch the authenticated user's affiliate profile, statistics, earnings, and recent activity."""
    auth_user_id = user.get("auth_user_id")
    if not auth_user_id:
        raise HTTPException(status_code=401, detail="User authentication required")

    if _self_host():
        def _read() -> dict[str, Any]:
            with connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT * FROM affiliate_profiles WHERE user_id = %s LIMIT 1", (auth_user_id,))
                    profile_row = cur.fetchone()
                    if not profile_row:
                        return {"profile": None}
                    cols = [d[0] for d in cur.description]
                    profile = dict(zip(cols, profile_row))
                    aid = profile["id"]
                    cur.execute("SELECT COUNT(*) FROM affiliate_clicks WHERE affiliate_id = %s", (aid,))
                    clicks_all = int(cur.fetchone()[0] or 0)
                    cur.execute("SELECT COUNT(*) FROM affiliate_clicks WHERE affiliate_id = %s AND created_at >= NOW() - INTERVAL '30 days'", (aid,))
                    clicks_30d = int(cur.fetchone()[0] or 0)
                    cur.execute("SELECT id, status, created_at, converted_at, first_seen_at FROM affiliate_referrals WHERE affiliate_id = %s ORDER BY created_at DESC LIMIT 10", (aid,))
                    ref_cols = [d[0] for d in cur.description]
                    refs = [dict(zip(ref_cols, row)) for row in cur.fetchall()]
                    cur.execute("SELECT COUNT(*) FROM affiliate_referrals WHERE affiliate_id = %s", (aid,))
                    total_refs = int(cur.fetchone()[0] or 0)
                    cur.execute("SELECT COUNT(*) FROM affiliate_referrals WHERE affiliate_id = %s AND status = 'paid'", (aid,))
                    paid_refs = int(cur.fetchone()[0] or 0)
                    cur.execute("SELECT commission_amount_cents, status, hold_until FROM affiliate_commissions WHERE affiliate_id = %s", (aid,))
                    pending = payable = paid = earned = 0
                    now = datetime.now(timezone.utc)
                    for amount, status, hold_until in cur.fetchall():
                        amount = int(amount or 0)
                        if status in ("pending", "approved"):
                            if hold_until and hold_until <= now:
                                payable += amount
                            else:
                                pending += amount
                            earned += amount
                        elif status == "payable":
                            payable += amount; earned += amount
                        elif status == "paid":
                            paid += amount; earned += amount
                    cur.execute("SELECT COALESCE(SUM(amount_cents), 0) FROM affiliate_payouts WHERE affiliate_id = %s AND status = 'paid'", (aid,))
                    paid_payouts = int(cur.fetchone()[0] or 0)
                    cur.execute("SELECT amount_cents, status, paid_at, payout_method, external_payout_id, created_at FROM affiliate_payouts WHERE affiliate_id = %s ORDER BY created_at DESC LIMIT 10", (aid,))
                    payout_cols = [d[0] for d in cur.description]
                    payouts = [dict(zip(payout_cols, row)) for row in cur.fetchall()]
                    app_url = "https://chatty.personaliai.com"
                    return {"profile": profile, "clicks_all": clicks_all, "clicks_30d": clicks_30d, "refs": refs,
                            "total_refs": total_refs, "paid_refs": paid_refs, "pending": pending, "payable": payable,
                            "paid": paid, "earned": earned, "paid_payouts": paid_payouts, "payouts": payouts, "app_url": app_url}
        data = await _sql(_read)
        profile = data.get("profile")
        if not profile:
            return {"is_affiliate": False, "profile": None, "stats": None}
        referral_code = profile["referral_code"]
        return {
            "is_affiliate": True,
            "profile": {"id": str(profile["id"]), "referral_code": referral_code,
                        "referral_url": f"{data['app_url']}?ref={referral_code}",
                        "display_name": profile.get("display_name"), "website_url": profile.get("website_url"),
                        "payout_email": profile.get("payout_email") or user.get("email"),
                        "status": profile.get("status") or "active", "commission_rate_bps": profile.get("commission_rate_bps") or DEFAULT_COMMISSION_RATE_BPS,
                        "commission_percentage": (profile.get("commission_rate_bps") or DEFAULT_COMMISSION_RATE_BPS) / 100,
                        "cookie_window_days": profile.get("cookie_window_days") or DEFAULT_COOKIE_WINDOW_DAYS,
                        "payout_hold_days": profile.get("payout_hold_days") or DEFAULT_PAYOUT_HOLD_DAYS,
                        "minimum_payout_cents": profile.get("minimum_payout_cents") or DEFAULT_MINIMUM_PAYOUT_CENTS,
                        "created_at": profile.get("created_at")},
            "stats": {"clicks_all_time": data["clicks_all"], "clicks_last_30d": data["clicks_30d"],
                      "referrals_total": data["total_refs"], "referrals_paid": data["paid_refs"],
                      "conversion_rate_percent": round((data["paid_refs"] / data["clicks_all"]) * 100, 1) if data["clicks_all"] else 0.0,
                      "pending_cents": data["pending"], "payable_cents": data["payable"], "paid_cents": data["paid"],
                      "lifetime_earnings_cents": data["earned"], "currency": "USD"},
            "recent_clicks": [], "recent_referrals": data["refs"], "recent_payouts": data["payouts"],
        }

    profile_res = await run_db(
        lambda: supabase.table("affiliate_profiles")
        .select("*")
        .eq("user_id", auth_user_id)
        .limit(1)
        .execute()
    )

    if not profile_res.data:
        return {
            "is_affiliate": False,
            "profile": None,
            "stats": None,
        }

    profile = profile_res.data[0]
    affiliate_id = profile["id"]

    # 1. Click statistics
    clicks_res = await run_db(
        lambda: supabase.table("affiliate_clicks")
        .select("id, created_at, landing_page, country", count="exact")
        .eq("affiliate_id", affiliate_id)
        .order("created_at", desc=True)
        .limit(10)
        .execute()
    )
    total_clicks = clicks_res.count if clicks_res.count is not None else len(clicks_res.data or [])

    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    recent_clicks_res = await run_db(
        lambda: supabase.table("affiliate_clicks")
        .select("id", count="exact")
        .eq("affiliate_id", affiliate_id)
        .gte("created_at", thirty_days_ago)
        .execute()
    )
    clicks_30d = recent_clicks_res.count if recent_clicks_res.count is not None else 0

    # 2. Referrals statistics
    referrals_res = await run_db(
        lambda: supabase.table("affiliate_referrals")
        .select("id, status, created_at, converted_at, referred_user_id", count="exact")
        .eq("affiliate_id", affiliate_id)
        .order("created_at", desc=True)
        .limit(10)
        .execute()
    )
    total_referrals = referrals_res.count if referrals_res.count is not None else len(referrals_res.data or [])

    paid_referrals_count = 0
    all_refs = await run_db(
        lambda: supabase.table("affiliate_referrals")
        .select("status")
        .eq("affiliate_id", affiliate_id)
        .execute()
    )
    if all_refs.data:
        paid_referrals_count = sum(1 for r in all_refs.data if r.get("status") == "paid")

    # 3. Commissions & Earnings breakdown
    commissions_res = await run_db(
        lambda: supabase.table("affiliate_commissions")
        .select("commission_amount_cents, status, hold_until")
        .eq("affiliate_id", affiliate_id)
        .execute()
    )

    now_iso = datetime.now(timezone.utc).isoformat()
    pending_cents = 0
    payable_cents = 0
    total_earned_cents = 0

    if commissions_res.data:
        for c in commissions_res.data:
            c_status = c.get("status")
            amt = int(c.get("commission_amount_cents") or 0)
            if c_status in ("pending", "approved"):
                # If past hold_until, treat as payable
                hold_until = c.get("hold_until")
                if hold_until and hold_until <= now_iso:
                    payable_cents += amt
                else:
                    pending_cents += amt
                total_earned_cents += amt
            elif c_status == "payable":
                payable_cents += amt
                total_earned_cents += amt
            elif c_status == "paid":
                total_earned_cents += amt

    # 4. Payouts statistics
    paid_payouts_res = await run_db(
        lambda: supabase.table("affiliate_payouts")
        .select("amount_cents")
        .eq("affiliate_id", affiliate_id)
        .eq("status", "paid")
        .execute()
    )
    paid_cents = sum(
        int(p.get("amount_cents") or 0)
        for p in (paid_payouts_res.data or [])
    )

    payouts_res = await run_db(
        lambda: supabase.table("affiliate_payouts")
        .select("amount_cents, status, paid_at, payout_method, external_payout_id")
        .eq("affiliate_id", affiliate_id)
        .order("created_at", desc=True)
        .limit(10)
        .execute()
    )

    conversion_rate = (
        round((paid_referrals_count / total_clicks) * 100, 1)
        if total_clicks > 0
        else 0.0
    )

    app_url = "https://chatty.personaliai.com"
    referral_code = profile["referral_code"]
    referral_url = f"{app_url}?ref={referral_code}"

    return {
        "is_affiliate": True,
        "profile": {
            "id": profile["id"],
            "referral_code": referral_code,
            "referral_url": referral_url,
            "display_name": profile.get("display_name"),
            "website_url": profile.get("website_url"),
            "payout_email": profile.get("payout_email") or user.get("email"),
            "status": profile.get("status") or "active",
            "commission_rate_bps": profile.get("commission_rate_bps") or DEFAULT_COMMISSION_RATE_BPS,
            "commission_percentage": (profile.get("commission_rate_bps") or DEFAULT_COMMISSION_RATE_BPS) / 100,
            "cookie_window_days": profile.get("cookie_window_days") or DEFAULT_COOKIE_WINDOW_DAYS,
            "payout_hold_days": profile.get("payout_hold_days") or DEFAULT_PAYOUT_HOLD_DAYS,
            "minimum_payout_cents": profile.get("minimum_payout_cents") or DEFAULT_MINIMUM_PAYOUT_CENTS,
            "created_at": profile.get("created_at"),
        },
        "stats": {
            "clicks_all_time": total_clicks,
            "clicks_last_30d": clicks_30d,
            "referrals_total": total_referrals,
            "referrals_paid": paid_referrals_count,
            "conversion_rate_percent": conversion_rate,
            "pending_cents": pending_cents,
            "payable_cents": payable_cents,
            "paid_cents": paid_cents,
            "lifetime_earnings_cents": total_earned_cents,
            "currency": "USD",
        },
        "recent_clicks": clicks_res.data or [],
        "recent_referrals": referrals_res.data or [],
        "recent_payouts": payouts_res.data or [],
    }


@router.post("/join")
async def join_affiliate_program(
    body: AffiliateJoinRequest,
    user: dict[str, Any] = Depends(require_user),
):
    """Register the current user as an affiliate partner."""
    auth_user_id = user.get("auth_user_id")
    if not auth_user_id:
        raise HTTPException(status_code=401, detail="User authentication required")

    if _self_host():
        def _join() -> dict[str, Any]:
            cleaned = clean_code(body.referral_code)
            if not cleaned:
                raise ValueError("invalid referral code")
            now = datetime.now(timezone.utc)
            with connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT id, referral_code, status FROM affiliate_profiles WHERE user_id = %s LIMIT 1", (auth_user_id,))
                    existing = cur.fetchone()
                    if existing:
                        return {"success": True, "already_joined": True, "profile": {"id": str(existing[0]), "referral_code": existing[1], "status": existing[2]}, "message": "You are already registered for the Chatty affiliate program."}
                    cur.execute("SELECT 1 FROM affiliate_profiles WHERE referral_code = %s LIMIT 1", (cleaned,))
                    if cur.fetchone():
                        raise RuntimeError("This referral code is already in use by another affiliate.")
                    cur.execute("""
                        INSERT INTO affiliate_profiles (user_id, referral_code, display_name, website_url, payout_email,
                            status, commission_rate_bps, cookie_window_days, payout_hold_days, minimum_payout_cents,
                            terms_accepted_at, approved_at)
                        VALUES (%s, %s, %s, %s, %s, 'active', %s, %s, %s, %s, %s, %s)
                        RETURNING id, referral_code, display_name, website_url, payout_email, status, commission_rate_bps, created_at
                    """, (auth_user_id, cleaned, body.display_name or user.get("name") or user.get("email"), body.website_url,
                          str(body.payout_email).strip().lower(), DEFAULT_COMMISSION_RATE_BPS, DEFAULT_COOKIE_WINDOW_DAYS,
                          DEFAULT_PAYOUT_HOLD_DAYS, DEFAULT_MINIMUM_PAYOUT_CENTS, now, now))
                    row = cur.fetchone()
                    cols = [d[0] for d in cur.description]
                    return {"success": True, "profile": {**dict(zip(cols, row)), "id": str(row[0]), "referral_url": f"https://chatty.personaliai.com?ref={cleaned}"}, "message": "Welcome to the Chatty Affiliate Program! Your referral link is live."}
        try:
            return await _sql(_join)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid referral code")
        except RuntimeError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

    # Check if already registered
    existing_res = await run_db(
        lambda: supabase.table("affiliate_profiles")
        .select("id, referral_code, status")
        .eq("user_id", auth_user_id)
        .limit(1)
        .execute()
    )
    if existing_res.data:
        return {
            "success": True,
            "already_joined": True,
            "profile": existing_res.data[0],
            "message": "You are already registered for the Chatty affiliate program.",
        }

    # Validate referral code
    cleaned_code = clean_code(body.referral_code)
    if not cleaned_code:
        if body.referral_code.strip().lower() in RESERVED_CODES:
            raise HTTPException(status_code=400, detail="This referral code is reserved. Please choose another.")
        raise HTTPException(
            status_code=400,
            detail="Invalid referral code. Must be 3-80 characters using lowercase letters, numbers, hyphens, or underscores.",
        )

    # Check code uniqueness
    taken_res = await run_db(
        lambda: supabase.table("affiliate_profiles")
        .select("id")
        .eq("referral_code", cleaned_code)
        .limit(1)
        .execute()
    )
    if taken_res.data:
        raise HTTPException(status_code=400, detail="This referral code is already in use by another affiliate.")

    now_iso = datetime.now(timezone.utc).isoformat()
    insert_payload = {
        "user_id": auth_user_id,
        "referral_code": cleaned_code,
        "display_name": body.display_name or user.get("name") or user.get("email"),
        "website_url": body.website_url,
        "payout_email": str(body.payout_email).strip().lower(),
        "status": "active",  # Auto-activate so partners can start sharing immediately
        "commission_rate_bps": DEFAULT_COMMISSION_RATE_BPS,
        "cookie_window_days": DEFAULT_COOKIE_WINDOW_DAYS,
        "payout_hold_days": DEFAULT_PAYOUT_HOLD_DAYS,
        "minimum_payout_cents": DEFAULT_MINIMUM_PAYOUT_CENTS,
        "terms_accepted_at": now_iso,
        "approved_at": now_iso,
    }

    try:
        new_prof = await run_db(
            lambda: supabase.table("affiliate_profiles").insert(insert_payload).execute()
        )
    except Exception as e:
        logger.exception("Failed to create affiliate profile")
        raise HTTPException(status_code=500, detail="Failed to register affiliate profile") from e

    created = new_prof.data[0] if new_prof.data else insert_payload
    referral_url = f"https://chatty.personaliai.com?ref={cleaned_code}"

    return {
        "success": True,
        "profile": {
            **created,
            "referral_url": referral_url,
        },
        "message": "Welcome to the Chatty Affiliate Program! Your referral link is live.",
    }


@router.patch("/settings")
async def update_affiliate_settings(
    body: AffiliateSettingsUpdateRequest,
    user: dict[str, Any] = Depends(require_user),
):
    """Update payout email or display details for the caller's affiliate profile."""
    auth_user_id = user.get("auth_user_id")
    if not auth_user_id:
        raise HTTPException(status_code=401, detail="User authentication required")

    if _self_host():
        def _update() -> bool:
            updates: list[str] = []
            values: list[Any] = []
            if body.payout_email:
                updates.append("payout_email = %s"); values.append(str(body.payout_email).strip().lower())
            if body.display_name is not None:
                updates.append("display_name = %s"); values.append(body.display_name.strip() or None)
            if body.website_url is not None:
                updates.append("website_url = %s"); values.append(body.website_url.strip() or None)
            if not updates:
                return False
            updates.append("updated_at = NOW()")
            with connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(f"UPDATE affiliate_profiles SET {', '.join(updates)} WHERE user_id = %s", (*values, auth_user_id))
                    return cur.rowcount > 0
        if not await _sql(_update):
            raise HTTPException(status_code=404, detail="Affiliate profile not found")
        return {"success": True, "message": "Affiliate settings updated successfully"}

    profile_res = await run_db(
        lambda: supabase.table("affiliate_profiles")
        .select("id")
        .eq("user_id", auth_user_id)
        .limit(1)
        .execute()
    )
    if not profile_res.data:
        raise HTTPException(status_code=404, detail="Affiliate profile not found")

    affiliate_id = profile_res.data[0]["id"]
    updates: dict[str, Any] = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if body.payout_email:
        updates["payout_email"] = str(body.payout_email).strip().lower()
    if body.display_name is not None:
        updates["display_name"] = body.display_name.strip() or None
    if body.website_url is not None:
        updates["website_url"] = body.website_url.strip() or None

    await run_db(
        lambda: supabase.table("affiliate_profiles")
        .update(updates)
        .eq("id", affiliate_id)
        .execute()
    )

    return {"success": True, "message": "Affiliate settings updated successfully"}


@router.get("/referrals")
async def get_affiliate_referrals(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: dict[str, Any] = Depends(require_user),
):
    """List referred customers with conversion state and commissions earned."""
    auth_user_id = user.get("auth_user_id")
    if _self_host():
        def _refs() -> list[dict[str, Any]]:
            with connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT id FROM affiliate_profiles WHERE user_id = %s LIMIT 1", (auth_user_id,))
                    row = cur.fetchone()
                    if not row:
                        return []
                    cur.execute("""
                        SELECT r.id, r.status, r.referral_code, r.created_at, r.converted_at, r.first_seen_at,
                               COALESCE(SUM(CASE WHEN c.status <> 'void' THEN c.commission_amount_cents ELSE 0 END), 0) AS total_commission_cents,
                               COUNT(c.id) AS commissions_count
                        FROM affiliate_referrals r
                        LEFT JOIN affiliate_commissions c ON c.referral_id = r.id
                        WHERE r.affiliate_id = %s
                        GROUP BY r.id
                        ORDER BY r.created_at DESC LIMIT %s OFFSET %s
                    """, (row[0], limit, offset))
                    cols = [d[0] for d in cur.description]
                    return [dict(zip(cols, item)) for item in cur.fetchall()]
        return {"referrals": await _sql(_refs), "limit": limit, "offset": offset}

    profile_res = await run_db(
        lambda: supabase.table("affiliate_profiles")
        .select("id")
        .eq("user_id", auth_user_id)
        .limit(1)
        .execute()
    )
    if not profile_res.data:
        raise HTTPException(status_code=404, detail="Affiliate profile not found")

    affiliate_id = profile_res.data[0]["id"]

    refs_res = await run_db(
        lambda: supabase.table("affiliate_referrals")
        .select("id, status, referral_code, first_landing_page, first_seen_at, converted_at, created_at, referred_user_id")
        .eq("affiliate_id", affiliate_id)
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )

    # Fetch corresponding commission rows
    ref_ids = [r["id"] for r in (refs_res.data or []) if r.get("id")]
    commissions_map: dict[str, list[dict[str, Any]]] = {}
    if ref_ids:
        comm_res = await run_db(
            lambda: supabase.table("affiliate_commissions")
            .select("referral_id, gross_amount_cents, commission_amount_cents, status, created_at")
            .in_("referral_id", ref_ids)
            .execute()
        )
        for c in (comm_res.data or []):
            rid = c.get("referral_id")
            if rid:
                commissions_map.setdefault(rid, []).append(c)

    results: list[dict[str, Any]] = []
    for r in (refs_res.data or []):
        r_comms = commissions_map.get(r["id"], [])
        total_comm = sum(int(c.get("commission_amount_cents") or 0) for c in r_comms if c.get("status") != "void")
        results.append({
            "id": r["id"],
            "status": r.get("status"),
            "referral_code": r.get("referral_code"),
            "created_at": r.get("created_at"),
            "converted_at": r.get("converted_at"),
            "first_seen_at": r.get("first_seen_at"),
            "total_commission_cents": total_comm,
            "commissions_count": len(r_comms),
        })

    return {"referrals": results, "limit": limit, "offset": offset}


@router.get("/payouts")
async def get_affiliate_payouts(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: dict[str, Any] = Depends(require_user),
):
    """List historical commission payouts for the affiliate."""
    auth_user_id = user.get("auth_user_id")
    if _self_host():
        def _payouts() -> list[dict[str, Any]]:
            with connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT id FROM affiliate_profiles WHERE user_id = %s LIMIT 1", (auth_user_id,))
                    row = cur.fetchone()
                    if not row:
                        return []
                    cur.execute("SELECT * FROM affiliate_payouts WHERE affiliate_id = %s ORDER BY created_at DESC LIMIT %s OFFSET %s", (row[0], limit, offset))
                    cols = [d[0] for d in cur.description]
                    return [dict(zip(cols, item)) for item in cur.fetchall()]
        return {"payouts": await _sql(_payouts), "limit": limit, "offset": offset}

    profile_res = await run_db(
        lambda: supabase.table("affiliate_profiles")
        .select("id")
        .eq("user_id", auth_user_id)
        .limit(1)
        .execute()
    )
    if not profile_res.data:
        raise HTTPException(status_code=404, detail="Affiliate profile not found")

    affiliate_id = profile_res.data[0]["id"]
    payouts = await run_db(
        lambda: supabase.table("affiliate_payouts")
        .select("*")
        .eq("affiliate_id", affiliate_id)
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )

    return {"payouts": payouts.data or [], "limit": limit, "offset": offset}
