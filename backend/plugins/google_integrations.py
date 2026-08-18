"""Google OAuth + Gmail / Calendar / Tasks / People API helpers.

Self-contained: no google-auth-oauthlib dependency. We talk to Google's REST
endpoints directly with httpx so the Cloud Run image stays small.

Coverage mirrors n8n's Google nodes:
  Gmail:    message {send, reply, get, list, modify-labels, trash},
            draft {create}, label {list, get, create}, thread {get, reply}
  Calendar: event {create, get, list, update, delete}, free/busy
  Tasks:    list, get, create, update, delete + task-list management
  People:   contact {list, get, create, update}
"""

from __future__ import annotations

import base64
import logging
import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr
from typing import Any, Optional
from urllib.parse import urlencode

import httpx

logger = logging.getLogger("kin.google")

# OAuth ---------------------------------------------------------------------

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

# API base URLs -------------------------------------------------------------

GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me"
CALENDAR_BASE = "https://www.googleapis.com/calendar/v3"
TASKS_BASE = "https://tasks.googleapis.com/tasks/v1"
PEOPLE_BASE = "https://people.googleapis.com/v1"
DRIVE_BASE = "https://www.googleapis.com/drive/v3"
DOCS_BASE = "https://docs.googleapis.com/v1"
SHEETS_BASE = "https://sheets.googleapis.com/v4"
SLIDES_BASE = "https://slides.googleapis.com/v1"

# Scopes: read + modify across all surfaces.
SCOPES = [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/tasks",
    "https://www.googleapis.com/auth/contacts",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/presentations",
]

DRIVE_UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3/files"


# ---------------------------------------------------------------------------
# OAuth flow
# ---------------------------------------------------------------------------


def auth_url(state: str) -> str:
    params = {
        "client_id": os.environ["GOOGLE_CLIENT_ID"],
        "redirect_uri": os.environ["GOOGLE_REDIRECT_URI"],
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "access_type": "offline",
        "prompt": "consent",
        "include_granted_scopes": "true",
        "state": state,
    }
    return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"


async def exchange_code(code: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": os.environ["GOOGLE_CLIENT_ID"],
                "client_secret": os.environ["GOOGLE_CLIENT_SECRET"],
                "redirect_uri": os.environ["GOOGLE_REDIRECT_URI"],
                "grant_type": "authorization_code",
            },
        )
        r.raise_for_status()
        return r.json()


async def refresh_access_token(refresh_token: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.post(
            GOOGLE_TOKEN_URL,
            data={
                "refresh_token": refresh_token,
                "client_id": os.environ["GOOGLE_CLIENT_ID"],
                "client_secret": os.environ["GOOGLE_CLIENT_SECRET"],
                "grant_type": "refresh_token",
            },
        )
        r.raise_for_status()
        return r.json()


async def userinfo(access_token: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        r.raise_for_status()
        return r.json()


async def _valid_access_token(
    supabase, user: dict[str, Any], *, table: str = "users"
) -> Optional[str]:
    """Return a usable Google access token, refreshing if expired.

    `table` is "users" for a person's primary Google connection, or
    "kin_connected_accounts" for one of their extra Pro/Executive accounts
    (see agent_tools._read_gmail/_read_calendar) — same column names on
    both tables, so this needs no other change to work against either.
    """
    token = user.get("google_access_token")
    refresh = user.get("google_refresh_token")
    expiry = user.get("google_token_expiry")
    if not token or not refresh:
        return None

    now = datetime.now(tz=timezone.utc)
    if expiry:
        exp_dt = (
            datetime.fromisoformat(expiry.replace("Z", "+00:00"))
            if isinstance(expiry, str)
            else expiry
        )
        if exp_dt > now + timedelta(seconds=60):
            return token

    data = await refresh_access_token(refresh)
    new_token = data["access_token"]
    expires_in = int(data.get("expires_in", 3600))
    new_exp = now + timedelta(seconds=expires_in)
    # Refresh the in-memory user dict so subsequent calls don't re-refresh.
    user["google_access_token"] = new_token
    user["google_token_expiry"] = new_exp.isoformat()
    supabase.table(table).update(
        {
            "google_access_token": new_token,
            "google_token_expiry": new_exp.isoformat(),
        }
    ).eq("id", user["id"]).execute()
    return new_token


# ---------------------------------------------------------------------------
# Generic API helper
# ---------------------------------------------------------------------------


class GoogleNotConnected(Exception):
    pass


async def _api(
    supabase,
    user: dict[str, Any],
    method: str,
    url: str,
    *,
    params: Optional[dict[str, Any]] = None,
    json_body: Optional[dict[str, Any]] = None,
    raw_body: Optional[bytes] = None,
    content_type: Optional[str] = None,
    timeout: float = 20,
    table: str = "users",
) -> dict[str, Any]:
    token = await _valid_access_token(supabase, user, table=table)
    if not token:
        raise GoogleNotConnected("Google account not connected")
    headers: dict[str, str] = {"Authorization": f"Bearer {token}"}
    if content_type:
        headers["Content-Type"] = content_type
    async with httpx.AsyncClient(timeout=timeout) as c:
        r = await c.request(
            method,
            url,
            params=params,
            json=json_body,
            content=raw_body,
            headers=headers,
        )
        if r.status_code == 204:
            return {}
        if r.status_code >= 400:
            try:
                err = r.json()
            except Exception:  # noqa: BLE001
                err = {"raw": r.text}
            raise RuntimeError(
                f"Google API {method} {url} failed [{r.status_code}]: {err}"
            )
        if not r.content:
            return {}
        try:
            return r.json()
        except Exception:  # noqa: BLE001
            return {"raw": r.text}


# ---------------------------------------------------------------------------
# Gmail — header helpers
# ---------------------------------------------------------------------------


def _decode_header_value(payload: dict, name: str) -> str:
    for h in payload.get("headers", []):
        if h.get("name", "").lower() == name.lower():
            return h.get("value", "")
    return ""


def _decode_snippet(msg: dict) -> str:
    """Return Gmail's snippet, cleaned up.

    Gmail's `snippet` field can end mid-word. We collapse whitespace and trim
    to a word boundary with an ellipsis so the model relays a clean preview
    instead of fragments like "Initially, we identified a".
    """
    raw = msg.get("snippet", "") or ""
    if not raw:
        return ""
    s = " ".join(raw.split())
    if len(s) <= 280:
        return s
    cut = s[:280]
    sentence = max(cut.rfind(". "), cut.rfind("! "), cut.rfind("? "))
    if sentence >= 140:
        return cut[: sentence + 1] + " …"
    space = cut.rfind(" ")
    if space >= 140:
        return cut[:space].rstrip(",;:") + " …"
    return cut.rstrip(",;:") + "…"


def _extract_body(payload: dict) -> str:
    """Walk a Gmail payload and return the best text/plain (or text/html) body."""
    if not payload:
        return ""
    mime = payload.get("mimeType", "")
    body = payload.get("body", {}) or {}
    data = body.get("data")
    if mime.startswith("text/plain") and data:
        return _b64url_decode(data)
    if mime.startswith("text/html") and data and not _has_text_plain(payload):
        return _strip_html(_b64url_decode(data))
    for part in payload.get("parts") or []:
        v = _extract_body(part)
        if v:
            return v
    if data:
        return _b64url_decode(data)
    return ""


def _has_text_plain(payload: dict) -> bool:
    if payload.get("mimeType", "").startswith("text/plain"):
        return True
    return any(_has_text_plain(p) for p in payload.get("parts") or [])


def _b64url_decode(s: str) -> str:
    pad = "=" * (-len(s) % 4)
    try:
        return base64.urlsafe_b64decode(s + pad).decode("utf-8", errors="replace")
    except Exception:  # noqa: BLE001
        return ""


def _strip_html(html: str) -> str:
    import re
    text = re.sub(r"<style[^>]*>.*?</style>", "", html, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<script[^>]*>.*?</script>", "", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


# ---------------------------------------------------------------------------
# Gmail — operations
# ---------------------------------------------------------------------------


async def list_gmail_messages(
    supabase,
    user: dict[str, Any],
    limit: int = 15,
    query: str = "-category:promotions -category:social",
    table: str = "users",
) -> list[dict[str, Any]]:
    """List recent messages (metadata only). `table` lets this run against an
    extra Pro/Executive connected account (kin_connected_accounts) instead of
    the primary one — see _valid_access_token."""
    out: list[dict[str, Any]] = []
    res = await _api(
        supabase,
        user,
        "GET",
        f"{GMAIL_BASE}/messages",
        params={"maxResults": min(max(limit, 1), 50), "q": query},
        table=table,
    )
    ids = [m["id"] for m in res.get("messages", [])]
    for mid in ids:
        m = await _api(
            supabase,
            user,
            "GET",
            f"{GMAIL_BASE}/messages/{mid}",
            params={
                "format": "metadata",
                "metadataHeaders": ["From", "Subject", "Date", "To"],
            },
            table=table,
        )
        payload = m.get("payload", {})
        internal_ms = int(m.get("internalDate", "0") or 0)
        out.append(
            {
                "id": m.get("id"),
                "thread_id": m.get("threadId"),
                "from": _decode_header_value(payload, "From"),
                "to": _decode_header_value(payload, "To"),
                "subject": _decode_header_value(payload, "Subject") or "(no subject)",
                "snippet": _decode_snippet(m),
                "received_at": datetime.fromtimestamp(
                    internal_ms / 1000, tz=timezone.utc
                ).isoformat(),
                "unread": "UNREAD" in (m.get("labelIds") or []),
                "labels": m.get("labelIds") or [],
                "url": f"https://mail.google.com/mail/u/0/#inbox/{m.get('threadId')}",
            }
        )
    return out


async def get_gmail_message(
    supabase, user: dict[str, Any], message_id: str
) -> dict[str, Any]:
    """Return full message with body."""
    m = await _api(
        supabase,
        user,
        "GET",
        f"{GMAIL_BASE}/messages/{message_id}",
        params={"format": "full"},
    )
    payload = m.get("payload", {})
    return {
        "id": m.get("id"),
        "thread_id": m.get("threadId"),
        "from": _decode_header_value(payload, "From"),
        "to": _decode_header_value(payload, "To"),
        "cc": _decode_header_value(payload, "Cc"),
        "subject": _decode_header_value(payload, "Subject") or "(no subject)",
        "date": _decode_header_value(payload, "Date"),
        "snippet": _decode_snippet(m),
        "body": _extract_body(payload)[:8000],
        "labels": m.get("labelIds") or [],
        "url": f"https://mail.google.com/mail/u/0/#inbox/{m.get('threadId')}",
    }


def _build_mime(
    *,
    to: list[str],
    subject: str,
    body: str,
    from_addr: Optional[str] = None,
    cc: Optional[list[str]] = None,
    bcc: Optional[list[str]] = None,
    html: bool = False,
    in_reply_to: Optional[str] = None,
    references: Optional[str] = None,
    thread_id: Optional[str] = None,
    attachments: Optional[list[dict[str, Any]]] = None,
) -> dict[str, Any]:
    """Build a base64url-encoded raw RFC2822 message body for Gmail.

    `attachments` is a list of {filename, mime_type, data (bytes)} — when
    present the message becomes multipart/mixed (body + attachment parts)
    instead of just multipart/alternative.
    """
    body_part = MIMEMultipart("alternative")
    body_part.attach(MIMEText(body, "html" if html else "plain", "utf-8"))

    if attachments:
        msg = MIMEMultipart("mixed")
        msg.attach(body_part)
        for att in attachments:
            main_type, _, sub_type = (att.get("mime_type") or "application/octet-stream").partition("/")
            part = MIMEApplication(att["data"], _subtype=sub_type or "octet-stream")
            part.add_header(
                "Content-Disposition", "attachment", filename=att.get("filename") or "attachment"
            )
            msg.attach(part)
    else:
        msg = body_part

    msg["To"] = ", ".join(to)
    if cc:
        msg["Cc"] = ", ".join(cc)
    if bcc:
        msg["Bcc"] = ", ".join(bcc)
    if from_addr:
        msg["From"] = from_addr
    msg["Subject"] = subject
    if in_reply_to:
        msg["In-Reply-To"] = in_reply_to
    if references:
        msg["References"] = references
    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode("ascii").rstrip("=")
    out: dict[str, Any] = {"raw": raw}
    if thread_id:
        out["threadId"] = thread_id
    return out


async def send_gmail(
    supabase,
    user: dict[str, Any],
    *,
    to: list[str],
    subject: str,
    body: str,
    cc: Optional[list[str]] = None,
    bcc: Optional[list[str]] = None,
    html: bool = False,
    attachments: Optional[list[dict[str, Any]]] = None,
) -> dict[str, Any]:
    payload = _build_mime(
        to=to, subject=subject, body=body, cc=cc, bcc=bcc, html=html, attachments=attachments
    )
    res = await _api(
        supabase, user, "POST", f"{GMAIL_BASE}/messages/send", json_body=payload
    )
    return {"id": res.get("id"), "thread_id": res.get("threadId")}


async def reply_gmail(
    supabase,
    user: dict[str, Any],
    *,
    message_id: str,
    body: str,
    html: bool = False,
    attachments: Optional[list[dict[str, Any]]] = None,
) -> dict[str, Any]:
    """Reply within the existing thread."""
    orig = await _api(
        supabase,
        user,
        "GET",
        f"{GMAIL_BASE}/messages/{message_id}",
        params={"format": "metadata", "metadataHeaders": ["From", "To", "Subject", "Message-ID", "References"]},
    )
    p = orig.get("payload", {})
    from_h = _decode_header_value(p, "From")
    subj = _decode_header_value(p, "Subject") or ""
    msgid = _decode_header_value(p, "Message-ID")
    refs = _decode_header_value(p, "References")
    reply_subject = subj if subj.lower().startswith("re:") else f"Re: {subj}"
    payload = _build_mime(
        to=[from_h],
        subject=reply_subject,
        body=body,
        html=html,
        in_reply_to=msgid,
        references=f"{refs} {msgid}".strip(),
        thread_id=orig.get("threadId"),
        attachments=attachments,
    )
    res = await _api(
        supabase, user, "POST", f"{GMAIL_BASE}/messages/send", json_body=payload
    )
    return {"id": res.get("id"), "thread_id": res.get("threadId")}


async def create_gmail_draft(
    supabase,
    user: dict[str, Any],
    *,
    to: list[str],
    subject: str,
    body: str,
    cc: Optional[list[str]] = None,
    html: bool = False,
) -> dict[str, Any]:
    raw = _build_mime(to=to, subject=subject, body=body, cc=cc, html=html)
    res = await _api(
        supabase,
        user,
        "POST",
        f"{GMAIL_BASE}/drafts",
        json_body={"message": raw},
    )
    return {"id": res.get("id"), "message_id": (res.get("message") or {}).get("id")}


async def modify_gmail_labels(
    supabase,
    user: dict[str, Any],
    *,
    message_id: str,
    add: Optional[list[str]] = None,
    remove: Optional[list[str]] = None,
) -> dict[str, Any]:
    res = await _api(
        supabase,
        user,
        "POST",
        f"{GMAIL_BASE}/messages/{message_id}/modify",
        json_body={"addLabelIds": add or [], "removeLabelIds": remove or []},
    )
    return {"id": res.get("id"), "labels": res.get("labelIds") or []}


async def trash_gmail(
    supabase, user: dict[str, Any], *, message_id: str
) -> dict[str, Any]:
    res = await _api(
        supabase, user, "POST", f"{GMAIL_BASE}/messages/{message_id}/trash"
    )
    return {"id": res.get("id"), "trashed": True}


async def list_promotional_senders(
    supabase, user: dict[str, Any], *, days: int = 30, limit: int = 50
) -> dict[str, Any]:
    """Fetch recent promotional/social Gmail and aggregate by sender, so the
    user can see what's cluttering their inbox before deciding what to clean
    up — a bulk-aggregation server-side, rather than hoping the model
    manually tallies 50 individual messages itself."""
    messages = await list_gmail_messages(
        supabase, user, limit=limit, query=f"category:promotions newer_than:{days}d"
    )
    by_sender: dict[str, dict[str, Any]] = {}
    for m in messages:
        sender = m.get("from") or "(unknown sender)"
        entry = by_sender.setdefault(
            sender, {"sender": sender, "count": 0, "sample_subject": m.get("subject")}
        )
        entry["count"] += 1
    senders = sorted(by_sender.values(), key=lambda s: -s["count"])
    return {"scanned": len(messages), "days": days, "senders": senders}


async def declutter_gmail_sender(
    supabase, user: dict[str, Any], *, sender_query: str, action: str, days: int = 30
) -> dict[str, Any]:
    """Bulk-archive or bulk-trash every promotional message from one sender
    in a single call. `sender_query` should be the sender's email address
    (or domain) as returned by list_promotional_senders — matched via
    Gmail's `from:` search operator."""
    query = f"from:({sender_query}) category:promotions newer_than:{days}d"
    messages = await list_gmail_messages(supabase, user, limit=50, query=query)
    processed = 0
    for m in messages:
        mid = m.get("id")
        if not mid:
            continue
        if action == "trash":
            await trash_gmail(supabase, user, message_id=mid)
        else:
            await modify_gmail_labels(supabase, user, message_id=mid, remove=["INBOX"])
        processed += 1
    return {"sender": sender_query, "action": action, "processed": processed}


async def find_receipt_emails(
    supabase, user: dict[str, Any], *, days: int = 30, limit: int = 20
) -> list[dict[str, Any]]:
    """Find likely receipt/invoice/order-confirmation emails and return each
    with enough body text to extract vendor/amount/date from — deliberately
    returns raw text rather than trying to regex-parse amounts here, since
    receipt formats vary too much (ride receipts, SaaS invoices, food
    delivery, subscription charges...) for a fixed parser to handle
    reliably. The model reads the excerpt and extracts the real numbers."""
    # -category:promotions matters more than it looks — without it this
    # matched marketing email that merely mentions "order" in passing (an
    # Uber Eats "50% off" promo, an Etsy "we miss you" win-back email),
    # confirmed against a real inbox before landing on this query.
    query = (
        '(receipt OR invoice OR "order confirmation" OR "payment confirmation" '
        'OR "trip receipt" OR "payment receipt") '
        f"-category:promotions -category:social newer_than:{days}d"
    )
    messages = await list_gmail_messages(supabase, user, limit=min(max(limit, 1), 30), query=query)
    out: list[dict[str, Any]] = []
    for m in messages:
        mid = m.get("id")
        if not mid:
            continue
        try:
            full = await get_gmail_message(supabase, user, mid)
        except Exception:  # noqa: BLE001
            continue
        out.append(
            {
                "id": mid,
                "from": m.get("from"),
                "subject": m.get("subject"),
                "date": m.get("received_at"),
                "body_excerpt": (full.get("body") or "")[:1500],
            }
        )
    return out


async def list_gmail_labels(
    supabase, user: dict[str, Any]
) -> list[dict[str, Any]]:
    res = await _api(supabase, user, "GET", f"{GMAIL_BASE}/labels")
    return [
        {"id": l["id"], "name": l["name"], "type": l.get("type", "user")}
        for l in res.get("labels", [])
    ]


async def get_gmail_label(
    supabase, user: dict[str, Any], *, label_id: str
) -> dict[str, Any]:
    res = await _api(supabase, user, "GET", f"{GMAIL_BASE}/labels/{label_id}")
    return {
        "id": res.get("id"),
        "name": res.get("name"),
        "type": res.get("type"),
        "messages_total": res.get("messagesTotal"),
        "messages_unread": res.get("messagesUnread"),
    }


async def create_gmail_label(
    supabase,
    user: dict[str, Any],
    *,
    name: str,
    label_list_visibility: str = "labelShow",
    message_list_visibility: str = "show",
) -> dict[str, Any]:
    res = await _api(
        supabase,
        user,
        "POST",
        f"{GMAIL_BASE}/labels",
        json_body={
            "name": name,
            "labelListVisibility": label_list_visibility,
            "messageListVisibility": message_list_visibility,
        },
    )
    return {"id": res.get("id"), "name": res.get("name")}


async def delete_gmail_message(
    supabase, user: dict[str, Any], *, message_id: str
) -> dict[str, Any]:
    """Permanently delete (NOT trash) — irreversible."""
    await _api(
        supabase, user, "DELETE", f"{GMAIL_BASE}/messages/{message_id}"
    )
    return {"deleted": True, "id": message_id}


# ---------------------------------------------------------------------------
# Gmail — drafts
# ---------------------------------------------------------------------------


async def list_gmail_drafts(
    supabase, user: dict[str, Any], *, limit: int = 20
) -> list[dict[str, Any]]:
    res = await _api(
        supabase,
        user,
        "GET",
        f"{GMAIL_BASE}/drafts",
        params={"maxResults": min(max(limit, 1), 50)},
    )
    out: list[dict[str, Any]] = []
    for d in res.get("drafts", []) or []:
        # Each draft has just {id, message:{id, threadId}} in the list response
        out.append(
            {
                "id": d.get("id"),
                "message_id": (d.get("message") or {}).get("id"),
                "thread_id": (d.get("message") or {}).get("threadId"),
            }
        )
    return out


async def get_gmail_draft(
    supabase, user: dict[str, Any], *, draft_id: str
) -> dict[str, Any]:
    res = await _api(
        supabase,
        user,
        "GET",
        f"{GMAIL_BASE}/drafts/{draft_id}",
        params={"format": "metadata", "metadataHeaders": ["To", "Cc", "Subject"]},
    )
    msg = res.get("message", {}) or {}
    payload = msg.get("payload", {}) or {}
    return {
        "id": res.get("id"),
        "message_id": msg.get("id"),
        "thread_id": msg.get("threadId"),
        "to": _decode_header_value(payload, "To"),
        "cc": _decode_header_value(payload, "Cc"),
        "subject": _decode_header_value(payload, "Subject") or "(no subject)",
        "snippet": _decode_snippet(msg),
    }


async def delete_gmail_draft(
    supabase, user: dict[str, Any], *, draft_id: str
) -> dict[str, Any]:
    await _api(supabase, user, "DELETE", f"{GMAIL_BASE}/drafts/{draft_id}")
    return {"deleted": True, "id": draft_id}


# ---------------------------------------------------------------------------
# Gmail — threads
# ---------------------------------------------------------------------------


async def list_gmail_threads(
    supabase,
    user: dict[str, Any],
    *,
    query: str = "",
    limit: int = 20,
) -> list[dict[str, Any]]:
    params: dict[str, Any] = {"maxResults": min(max(limit, 1), 50)}
    if query.strip():
        params["q"] = query
    res = await _api(supabase, user, "GET", f"{GMAIL_BASE}/threads", params=params)
    out: list[dict[str, Any]] = []
    for t in res.get("threads", []) or []:
        out.append(
            {
                "id": t.get("id"),
                "snippet": t.get("snippet", ""),
                "history_id": t.get("historyId"),
            }
        )
    return out


async def get_gmail_thread(
    supabase, user: dict[str, Any], *, thread_id: str
) -> dict[str, Any]:
    """Fetch a thread and all its messages (compact form)."""
    res = await _api(
        supabase,
        user,
        "GET",
        f"{GMAIL_BASE}/threads/{thread_id}",
        params={"format": "full"},
    )
    messages: list[dict[str, Any]] = []
    for m in res.get("messages", []) or []:
        payload = m.get("payload", {}) or {}
        internal_ms = int(m.get("internalDate", "0") or 0)
        messages.append(
            {
                "id": m.get("id"),
                "from": _decode_header_value(payload, "From"),
                "to": _decode_header_value(payload, "To"),
                "subject": _decode_header_value(payload, "Subject") or "",
                "date": datetime.fromtimestamp(
                    internal_ms / 1000, tz=timezone.utc
                ).isoformat(),
                "snippet": _decode_snippet(m),
                "body": _extract_body(payload)[:3000],
                "labels": m.get("labelIds") or [],
            }
        )
    return {
        "id": res.get("id"),
        "history_id": res.get("historyId"),
        "message_count": len(messages),
        "messages": messages,
    }


async def reply_gmail_thread(
    supabase,
    user: dict[str, Any],
    *,
    thread_id: str,
    body: str,
    html: bool = False,
    attachments: Optional[list[dict[str, Any]]] = None,
) -> dict[str, Any]:
    """Reply to a thread (uses its last message as the parent)."""
    thread = await _api(
        supabase,
        user,
        "GET",
        f"{GMAIL_BASE}/threads/{thread_id}",
        params={
            "format": "metadata",
            "metadataHeaders": ["From", "To", "Subject", "Message-ID", "References"],
        },
    )
    msgs = thread.get("messages", []) or []
    if not msgs:
        raise RuntimeError(f"thread {thread_id} has no messages")
    last = msgs[-1]
    return await reply_gmail(
        supabase, user, message_id=last["id"], body=body, html=html, attachments=attachments
    )


async def trash_gmail_thread(
    supabase, user: dict[str, Any], *, thread_id: str
) -> dict[str, Any]:
    await _api(
        supabase, user, "POST", f"{GMAIL_BASE}/threads/{thread_id}/trash"
    )
    return {"trashed": True, "thread_id": thread_id}


async def modify_gmail_thread_labels(
    supabase,
    user: dict[str, Any],
    *,
    thread_id: str,
    add: Optional[list[str]] = None,
    remove: Optional[list[str]] = None,
) -> dict[str, Any]:
    res = await _api(
        supabase,
        user,
        "POST",
        f"{GMAIL_BASE}/threads/{thread_id}/modify",
        json_body={"addLabelIds": add or [], "removeLabelIds": remove or []},
    )
    return {"id": res.get("id"), "messages": len(res.get("messages") or [])}


# ---------------------------------------------------------------------------
# Calendar — operations
# ---------------------------------------------------------------------------


def _format_event_row(ev: dict[str, Any]) -> dict[str, Any]:
    start = ev.get("start", {})
    end = ev.get("end", {})
    return {
        "id": ev.get("id"),
        "summary": ev.get("summary") or "(no title)",
        "description": ev.get("description") or "",
        "location": ev.get("location"),
        "html_link": ev.get("htmlLink"),
        "start": start.get("dateTime") or start.get("date"),
        "end": end.get("dateTime") or end.get("date"),
        "all_day": "date" in start and "dateTime" not in start,
        "attendees": [a.get("email") for a in ev.get("attendees", []) if a.get("email")],
        "status": ev.get("status"),
    }


async def list_calendar_events(
    supabase,
    user: dict[str, Any],
    time_min: datetime,
    time_max: datetime,
    calendar_id: str = "primary",
    table: str = "users",
) -> list[dict[str, Any]]:
    """`table` lets this run against an extra Pro/Executive connected account
    (kin_connected_accounts) instead of the primary one."""
    params = {
        "timeMin": time_min.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
        "timeMax": time_max.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
        "singleEvents": "true",
        "orderBy": "startTime",
        "maxResults": 50,
    }
    res = await _api(
        supabase,
        user,
        "GET",
        f"{CALENDAR_BASE}/calendars/{calendar_id}/events",
        params=params,
        table=table,
    )
    return [_format_event_row(e) for e in res.get("items", [])]


async def get_calendar_event(
    supabase, user: dict[str, Any], event_id: str, calendar_id: str = "primary"
) -> dict[str, Any]:
    res = await _api(
        supabase,
        user,
        "GET",
        f"{CALENDAR_BASE}/calendars/{calendar_id}/events/{event_id}",
    )
    return _format_event_row(res)


def _with_explicit_offset(naive_str: str, tz_name: Optional[str]) -> str:
    """Resolve a possibly-naive local datetime string to an ISO string with an
    explicit UTC offset (e.g. '2026-07-13T09:30:00+05:30').

    The Google Calendar API accepts a naive dateTime + a separate timeZone
    field and is documented to use timeZone to resolve the offset — but
    relying on that split-field contract has repeatedly produced the wrong
    absolute instant in practice (e.g. a naive '09:30:00' + timeZone
    'Asia/Colombo' landing 5.5 hours later than intended). Attaching the
    offset ourselves removes that ambiguity: the instant is then unambiguous
    from the dateTime string alone, regardless of how any given API client
    reconciles a separate timeZone field. If naive_str already carries an
    offset or 'Z', it's returned unchanged (never double-convert)."""
    if not naive_str:
        return naive_str
    s = naive_str.strip()
    if s.endswith("Z") or re.search(r"[+-]\d{2}:?\d{2}$", s):
        return s  # already unambiguous
    try:
        import pytz
        tz = pytz.timezone(tz_name or "UTC")
        naive_dt = datetime.fromisoformat(s)
        localized = tz.localize(naive_dt)
        return localized.isoformat()
    except Exception:
        logger.exception("Failed to localize %r to %r; sending as-is", naive_str, tz_name)
        return naive_str


def _event_payload(
    *,
    summary: str,
    start: str,
    end: str,
    description: Optional[str] = None,
    location: Optional[str] = None,
    attendees: Optional[list[str]] = None,
    all_day: bool = False,
    timezone_str: Optional[str] = None,
) -> dict[str, Any]:
    body: dict[str, Any] = {"summary": summary}
    if description:
        body["description"] = description
    if location:
        body["location"] = location
    if attendees:
        body["attendees"] = [{"email": a} for a in attendees]
    if all_day:
        body["start"] = {"date": start[:10]}
        body["end"] = {"date": end[:10]}
    else:
        body["start"] = {"dateTime": _with_explicit_offset(start, timezone_str)}
        body["end"] = {"dateTime": _with_explicit_offset(end, timezone_str)}
        if timezone_str:
            body["start"]["timeZone"] = timezone_str
            body["end"]["timeZone"] = timezone_str
    return body


async def create_calendar_event(
    supabase,
    user: dict[str, Any],
    *,
    summary: str,
    start: str,
    end: str,
    description: Optional[str] = None,
    location: Optional[str] = None,
    attendees: Optional[list[str]] = None,
    all_day: bool = False,
    calendar_id: str = "primary",
) -> dict[str, Any]:
    tz_str = user.get("timezone") or "UTC"
    body = _event_payload(
        summary=summary,
        start=start,
        end=end,
        description=description,
        location=location,
        attendees=attendees,
        all_day=all_day,
        timezone_str=tz_str,
    )
    res = await _api(
        supabase,
        user,
        "POST",
        f"{CALENDAR_BASE}/calendars/{calendar_id}/events",
        json_body=body,
    )
    return _format_event_row(res)


async def add_meet_to_event(
    supabase,
    user: dict[str, Any],
    *,
    event_id: str,
    calendar_id: str = "primary",
) -> dict[str, Any]:
    """Attach a real Google Meet conference to an existing event and return
    its join link. Requires conferenceDataVersion=1 on the request."""
    body = {
        "conferenceData": {
            "createRequest": {
                "requestId": uuid.uuid4().hex,
                "conferenceSolutionKey": {"type": "hangoutsMeet"},
            }
        }
    }
    res = await _api(
        supabase,
        user,
        "PATCH",
        f"{CALENDAR_BASE}/calendars/{calendar_id}/events/{event_id}",
        params={"conferenceDataVersion": "1"},
        json_body=body,
    )
    link = res.get("hangoutLink")
    if not link:
        for ep in (res.get("conferenceData", {}).get("entryPoints") or []):
            if ep.get("entryPointType") == "video" and ep.get("uri"):
                link = ep["uri"]
                break
    return {"hangout_link": link, "html_link": res.get("htmlLink")}


async def update_calendar_event(
    supabase,
    user: dict[str, Any],
    *,
    event_id: str,
    summary: Optional[str] = None,
    start: Optional[str] = None,
    end: Optional[str] = None,
    description: Optional[str] = None,
    location: Optional[str] = None,
    attendees: Optional[list[str]] = None,
    calendar_id: str = "primary",
) -> dict[str, Any]:
    body: dict[str, Any] = {}
    if summary is not None:
        body["summary"] = summary
    if description is not None:
        body["description"] = description
    if location is not None:
        body["location"] = location
    if attendees is not None:
        body["attendees"] = [{"email": a} for a in attendees]
    if start:
        body["start"] = {"dateTime": start, "timeZone": user.get("timezone") or "UTC"}
    if end:
        body["end"] = {"dateTime": end, "timeZone": user.get("timezone") or "UTC"}
    res = await _api(
        supabase,
        user,
        "PATCH",
        f"{CALENDAR_BASE}/calendars/{calendar_id}/events/{event_id}",
        json_body=body,
    )
    return _format_event_row(res)


async def delete_calendar_event(
    supabase,
    user: dict[str, Any],
    *,
    event_id: str,
    calendar_id: str = "primary",
) -> dict[str, Any]:
    await _api(
        supabase,
        user,
        "DELETE",
        f"{CALENDAR_BASE}/calendars/{calendar_id}/events/{event_id}",
    )
    return {"deleted": True, "event_id": event_id}


async def check_calendar_availability(
    supabase,
    user: dict[str, Any],
    *,
    time_min: datetime,
    time_max: datetime,
    calendar_ids: Optional[list[str]] = None,
) -> dict[str, Any]:
    """Free/busy query — returns busy intervals for the requested calendars."""
    items = [{"id": c} for c in (calendar_ids or ["primary"])]
    res = await _api(
        supabase,
        user,
        "POST",
        f"{CALENDAR_BASE}/freeBusy",
        json_body={
            "timeMin": time_min.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
            "timeMax": time_max.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
            "items": items,
        },
    )
    cals = res.get("calendars", {}) or {}
    return {
        "busy": {
            cid: [
                {"start": b.get("start"), "end": b.get("end")}
                for b in (data.get("busy") or [])
            ]
            for cid, data in cals.items()
        }
    }


# ---------------------------------------------------------------------------
# Google Tasks
# ---------------------------------------------------------------------------


async def list_google_task_lists(
    supabase, user: dict[str, Any]
) -> list[dict[str, Any]]:
    res = await _api(supabase, user, "GET", f"{TASKS_BASE}/users/@me/lists")
    return [
        {"id": l.get("id"), "title": l.get("title")} for l in res.get("items", [])
    ]


async def list_google_tasks(
    supabase,
    user: dict[str, Any],
    *,
    task_list_id: str = "@default",
    show_completed: bool = False,
    limit: int = 50,
) -> list[dict[str, Any]]:
    res = await _api(
        supabase,
        user,
        "GET",
        f"{TASKS_BASE}/lists/{task_list_id}/tasks",
        params={
            "showCompleted": "true" if show_completed else "false",
            "showHidden": "false",
            "maxResults": min(max(limit, 1), 100),
        },
    )
    return [
        {
            "id": t.get("id"),
            "title": t.get("title"),
            "notes": t.get("notes"),
            "status": t.get("status"),  # "needsAction" | "completed"
            "due": t.get("due"),
            "completed_at": t.get("completed"),
            "updated_at": t.get("updated"),
        }
        for t in res.get("items", [])
    ]


async def get_google_task(
    supabase, user: dict[str, Any], *, task_id: str, task_list_id: str = "@default"
) -> dict[str, Any]:
    t = await _api(
        supabase, user, "GET", f"{TASKS_BASE}/lists/{task_list_id}/tasks/{task_id}"
    )
    return {
        "id": t.get("id"),
        "title": t.get("title"),
        "notes": t.get("notes"),
        "status": t.get("status"),
        "due": t.get("due"),
        "completed_at": t.get("completed"),
        "updated_at": t.get("updated"),
    }


async def create_google_task(
    supabase,
    user: dict[str, Any],
    *,
    title: str,
    notes: Optional[str] = None,
    due: Optional[str] = None,
    task_list_id: str = "@default",
) -> dict[str, Any]:
    body: dict[str, Any] = {"title": title}
    if notes:
        body["notes"] = notes
    if due:
        body["due"] = due  # RFC 3339 timestamp
    res = await _api(
        supabase,
        user,
        "POST",
        f"{TASKS_BASE}/lists/{task_list_id}/tasks",
        json_body=body,
    )
    return {"id": res.get("id"), "title": res.get("title")}


async def update_google_task(
    supabase,
    user: dict[str, Any],
    *,
    task_id: str,
    title: Optional[str] = None,
    notes: Optional[str] = None,
    due: Optional[str] = None,
    completed: Optional[bool] = None,
    task_list_id: str = "@default",
) -> dict[str, Any]:
    body: dict[str, Any] = {}
    if title is not None:
        body["title"] = title
    if notes is not None:
        body["notes"] = notes
    if due is not None:
        body["due"] = due
    if completed is not None:
        body["status"] = "completed" if completed else "needsAction"
    res = await _api(
        supabase,
        user,
        "PATCH",
        f"{TASKS_BASE}/lists/{task_list_id}/tasks/{task_id}",
        json_body=body,
    )
    return {"id": res.get("id"), "status": res.get("status")}


async def delete_google_task(
    supabase,
    user: dict[str, Any],
    *,
    task_id: str,
    task_list_id: str = "@default",
) -> dict[str, Any]:
    await _api(
        supabase,
        user,
        "DELETE",
        f"{TASKS_BASE}/lists/{task_list_id}/tasks/{task_id}",
    )
    return {"deleted": True, "task_id": task_id}


# ---------------------------------------------------------------------------
# Google Contacts (People API)
# ---------------------------------------------------------------------------


_PEOPLE_FIELDS = "names,emailAddresses,phoneNumbers,organizations,biographies,addresses"


def _format_person(p: dict[str, Any]) -> dict[str, Any]:
    names = (p.get("names") or [{}])[0]
    emails = [e.get("value") for e in (p.get("emailAddresses") or []) if e.get("value")]
    phones = [ph.get("value") for ph in (p.get("phoneNumbers") or []) if ph.get("value")]
    orgs = (p.get("organizations") or [{}])[0]
    bios = (p.get("biographies") or [{}])[0]
    return {
        "resource_name": p.get("resourceName"),
        "name": names.get("displayName") or "",
        "given_name": names.get("givenName") or "",
        "family_name": names.get("familyName") or "",
        "emails": emails,
        "phones": phones,
        "company": orgs.get("name") or "",
        "title": orgs.get("title") or "",
        "notes": bios.get("value") or "",
    }


async def list_google_contacts(
    supabase, user: dict[str, Any], *, limit: int = 50, query: str = ""
) -> list[dict[str, Any]]:
    if query.strip():
        # People API search endpoint
        res = await _api(
            supabase,
            user,
            "GET",
            f"{PEOPLE_BASE}/people:searchContacts",
            params={
                "query": query.strip(),
                "readMask": _PEOPLE_FIELDS,
                "pageSize": min(max(limit, 1), 30),
            },
        )
        people = [r.get("person", {}) for r in res.get("results", [])]
    else:
        res = await _api(
            supabase,
            user,
            "GET",
            f"{PEOPLE_BASE}/people/me/connections",
            params={
                "personFields": _PEOPLE_FIELDS,
                "pageSize": min(max(limit, 1), 100),
                "sortOrder": "LAST_MODIFIED_DESCENDING",
            },
        )
        people = res.get("connections", []) or []
    return [_format_person(p) for p in people if p]


async def get_google_contact(
    supabase, user: dict[str, Any], *, resource_name: str
) -> dict[str, Any]:
    res = await _api(
        supabase,
        user,
        "GET",
        f"{PEOPLE_BASE}/{resource_name}",
        params={"personFields": _PEOPLE_FIELDS},
    )
    return _format_person(res)


async def create_google_contact(
    supabase,
    user: dict[str, Any],
    *,
    name: str,
    email: Optional[str] = None,
    phone: Optional[str] = None,
    company: Optional[str] = None,
    notes: Optional[str] = None,
) -> dict[str, Any]:
    body: dict[str, Any] = {"names": [{"givenName": name}]}
    if email:
        body["emailAddresses"] = [{"value": email}]
    if phone:
        body["phoneNumbers"] = [{"value": phone}]
    if company:
        body["organizations"] = [{"name": company}]
    if notes:
        body["biographies"] = [{"value": notes, "contentType": "TEXT_PLAIN"}]
    res = await _api(
        supabase, user, "POST", f"{PEOPLE_BASE}/people:createContact", json_body=body
    )
    return _format_person(res)


# ---------------------------------------------------------------------------
# Drive — listing + downloads + native export
# ---------------------------------------------------------------------------

# Google native MIME types and the formats we export them to (best for text RAG).
NATIVE_EXPORT = {
    "application/vnd.google-apps.document": "text/plain",
    "application/vnd.google-apps.spreadsheet": "text/csv",
    "application/vnd.google-apps.presentation": "text/plain",
    # Drawings, Forms, etc. — skip for now.
}

SUPPORTED_BINARY_MIMES = {
    "application/pdf",
    "text/plain",
    "text/markdown",
    "text/csv",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  # docx
    "application/msword",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",  # xlsx
    "application/vnd.ms-excel",  # legacy xls
}


def _drive_query(folder_id: Optional[str], query: Optional[str]) -> str:
    parts: list[str] = ["trashed = false"]
    if folder_id:
        parts.append(f"'{folder_id}' in parents")
    if query:
        parts.append(f"name contains '{query.replace(chr(39), '')}'")
    return " and ".join(parts)


async def list_drive_files(
    supabase,
    user: dict[str, Any],
    *,
    folder_id: Optional[str] = None,
    query: Optional[str] = None,
    page_size: int = 50,
    page_token: Optional[str] = None,
    mime_filter: Optional[list[str]] = None,
) -> dict[str, Any]:
    """List or search Drive files. Returns {files, next_page_token}."""
    q = _drive_query(folder_id, query)
    if mime_filter:
        clause = " or ".join(f"mimeType = '{m}'" for m in mime_filter)
        q = f"{q} and ({clause})"
    params = {
        "q": q,
        "pageSize": min(max(page_size, 1), 100),
        "fields": (
            "nextPageToken,files(id,name,mimeType,size,modifiedTime,"
            "webViewLink,parents,iconLink,owners(displayName,emailAddress))"
        ),
        "orderBy": "modifiedTime desc",
    }
    if page_token:
        params["pageToken"] = page_token
    res = await _api(supabase, user, "GET", f"{DRIVE_BASE}/files", params=params)
    files = [
        {
            "id": f.get("id"),
            "name": f.get("name"),
            "mime_type": f.get("mimeType"),
            "size_bytes": int(f.get("size") or 0) if f.get("size") else None,
            "modified_at": f.get("modifiedTime"),
            "web_view_link": f.get("webViewLink"),
            "parent_folder_id": (f.get("parents") or [None])[0],
            "icon_link": f.get("iconLink"),
            "owner": (f.get("owners") or [{}])[0].get("emailAddress"),
        }
        for f in res.get("files", [])
    ]
    return {"files": files, "next_page_token": res.get("nextPageToken")}


async def get_drive_file_metadata(
    supabase, user: dict[str, Any], *, file_id: str
) -> dict[str, Any]:
    res = await _api(
        supabase,
        user,
        "GET",
        f"{DRIVE_BASE}/files/{file_id}",
        params={
            "fields": "id,name,mimeType,size,modifiedTime,webViewLink,parents,description",
        },
    )
    return {
        "id": res.get("id"),
        "name": res.get("name"),
        "mime_type": res.get("mimeType"),
        "size_bytes": int(res.get("size") or 0) if res.get("size") else None,
        "modified_at": res.get("modifiedTime"),
        "web_view_link": res.get("webViewLink"),
        "parent_folder_id": (res.get("parents") or [None])[0],
        "description": res.get("description"),
    }


async def download_drive_file(
    supabase, user: dict[str, Any], *, file_id: str
) -> tuple[bytes, str]:
    """Download a binary Drive file (PDF/DOCX/text). Returns (bytes, mime_type)."""
    token = await _valid_access_token(supabase, user)
    if not token:
        raise GoogleNotConnected("Google not connected")
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.get(
            f"{DRIVE_BASE}/files/{file_id}",
            params={"alt": "media"},
            headers={"Authorization": f"Bearer {token}"},
        )
        if r.status_code >= 400:
            raise RuntimeError(f"download failed [{r.status_code}]: {r.text[:200]}")
        return r.content, r.headers.get("Content-Type", "application/octet-stream")


async def export_drive_file(
    supabase, user: dict[str, Any], *, file_id: str, export_mime: str
) -> bytes:
    """Export a Google-native file (Doc/Sheet/Slides) as the given MIME type."""
    token = await _valid_access_token(supabase, user)
    if not token:
        raise GoogleNotConnected("Google not connected")
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.get(
            f"{DRIVE_BASE}/files/{file_id}/export",
            params={"mimeType": export_mime},
            headers={"Authorization": f"Bearer {token}"},
        )
        if r.status_code >= 400:
            raise RuntimeError(f"export failed [{r.status_code}]: {r.text[:200]}")
        return r.content


# ---------------------------------------------------------------------------
# Google Docs — read structured content
# ---------------------------------------------------------------------------


def _walk_doc_text(content: list[dict[str, Any]]) -> str:
    """Recursively pull text runs from a Docs structuralElement tree."""
    out: list[str] = []
    for el in content or []:
        para = el.get("paragraph")
        if para:
            for run in para.get("elements") or []:
                tr = (run.get("textRun") or {}).get("content")
                if tr:
                    out.append(tr)
        table = el.get("table")
        if table:
            for row in table.get("tableRows") or []:
                for cell in row.get("tableCells") or []:
                    out.append(_walk_doc_text(cell.get("content") or []))
                    out.append("\t")
                out.append("\n")
        toc = el.get("tableOfContents")
        if toc:
            out.append(_walk_doc_text(toc.get("content") or []))
    return "".join(out)


async def read_google_doc(
    supabase, user: dict[str, Any], *, document_id: str
) -> dict[str, Any]:
    """Read a Google Doc as structured + plain text."""
    res = await _api(
        supabase, user, "GET", f"{DOCS_BASE}/documents/{document_id}"
    )
    body = (res.get("body") or {}).get("content") or []
    return {
        "id": res.get("documentId"),
        "title": res.get("title"),
        "text": _walk_doc_text(body)[:50000],
    }


# ---------------------------------------------------------------------------
# Google Sheets — read values
# ---------------------------------------------------------------------------


async def list_sheet_tabs(
    supabase, user: dict[str, Any], *, spreadsheet_id: str
) -> list[dict[str, Any]]:
    res = await _api(
        supabase,
        user,
        "GET",
        f"{SHEETS_BASE}/spreadsheets/{spreadsheet_id}",
        params={"fields": "properties.title,sheets.properties"},
    )
    tabs = []
    for s in res.get("sheets", []) or []:
        p = s.get("properties", {})
        tabs.append(
            {
                "id": p.get("sheetId"),
                "title": p.get("title"),
                "row_count": (p.get("gridProperties") or {}).get("rowCount"),
                "column_count": (p.get("gridProperties") or {}).get("columnCount"),
            }
        )
    return tabs


async def read_sheet_values(
    supabase,
    user: dict[str, Any],
    *,
    spreadsheet_id: str,
    range_a1: str = "A1:Z100",
) -> dict[str, Any]:
    """Read a range like 'Sheet1!A1:Z100' or 'A1:Z100'."""
    res = await _api(
        supabase,
        user,
        "GET",
        f"{SHEETS_BASE}/spreadsheets/{spreadsheet_id}/values/{range_a1}",
    )
    rows = res.get("values", []) or []
    return {
        "range": res.get("range"),
        "row_count": len(rows),
        "values": rows,
    }


def _sheet_values_to_text(values: list[list[Any]]) -> str:
    """Turn cell values into a CSV-like string for RAG indexing."""
    out: list[str] = []
    for row in values:
        out.append(",".join('"' + str(c).replace('"', '""') + '"' for c in row))
    return "\n".join(out)


# ---------------------------------------------------------------------------
# Google Slides — read presentation text
# ---------------------------------------------------------------------------


def _walk_slide_text(elements: list[dict[str, Any]]) -> str:
    out: list[str] = []
    for el in elements or []:
        shape = el.get("shape")
        if shape:
            text = shape.get("text", {}) or {}
            for te in text.get("textElements", []) or []:
                tr = (te.get("textRun") or {}).get("content")
                if tr:
                    out.append(tr)
        table = el.get("table")
        if table:
            for row in table.get("tableRows", []) or []:
                for cell in row.get("tableCells", []) or []:
                    out.append(_walk_slide_text(cell.get("text", {}).get("textElements", []) or []))
                    out.append("\t")
                out.append("\n")
    return "".join(out)


# ---------------------------------------------------------------------------
# Drive — write ops (files + folders)
# ---------------------------------------------------------------------------


async def upload_drive_file(
    supabase,
    user: dict[str, Any],
    *,
    name: str,
    content: bytes,
    mime_type: str = "application/octet-stream",
    parent_folder_id: Optional[str] = None,
) -> dict[str, Any]:
    """Upload a new file via multipart Drive upload."""
    token = await _valid_access_token(supabase, user)
    if not token:
        raise GoogleNotConnected("Google not connected")
    metadata: dict[str, Any] = {"name": name, "mimeType": mime_type}
    if parent_folder_id:
        metadata["parents"] = [parent_folder_id]

    boundary = "kin_upload_boundary"
    body_parts = [
        f"--{boundary}".encode(),
        b"Content-Type: application/json; charset=UTF-8",
        b"",
        __import__("json").dumps(metadata).encode(),
        f"--{boundary}".encode(),
        f"Content-Type: {mime_type}".encode(),
        b"",
        content,
        f"--{boundary}--".encode(),
    ]
    body = b"\r\n".join(body_parts)

    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.post(
            DRIVE_UPLOAD_BASE,
            params={"uploadType": "multipart", "fields": "id,name,mimeType,webViewLink,parents"},
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": f"multipart/related; boundary={boundary}",
            },
            content=body,
        )
        if r.status_code >= 400:
            raise RuntimeError(f"upload failed [{r.status_code}]: {r.text[:200]}")
        return r.json()


async def create_drive_text_file(
    supabase,
    user: dict[str, Any],
    *,
    name: str,
    text: str,
    parent_folder_id: Optional[str] = None,
    mime_type: str = "text/plain",
) -> dict[str, Any]:
    return await upload_drive_file(
        supabase,
        user,
        name=name,
        content=text.encode("utf-8"),
        mime_type=mime_type,
        parent_folder_id=parent_folder_id,
    )


async def create_drive_folder(
    supabase,
    user: dict[str, Any],
    *,
    name: str,
    parent_folder_id: Optional[str] = None,
) -> dict[str, Any]:
    body: dict[str, Any] = {
        "name": name,
        "mimeType": "application/vnd.google-apps.folder",
    }
    if parent_folder_id:
        body["parents"] = [parent_folder_id]
    res = await _api(
        supabase,
        user,
        "POST",
        f"{DRIVE_BASE}/files",
        params={"fields": "id,name,webViewLink,parents"},
        json_body=body,
    )
    return res


async def copy_drive_file(
    supabase,
    user: dict[str, Any],
    *,
    file_id: str,
    name: Optional[str] = None,
    parent_folder_id: Optional[str] = None,
) -> dict[str, Any]:
    body: dict[str, Any] = {}
    if name:
        body["name"] = name
    if parent_folder_id:
        body["parents"] = [parent_folder_id]
    return await _api(
        supabase,
        user,
        "POST",
        f"{DRIVE_BASE}/files/{file_id}/copy",
        params={"fields": "id,name,mimeType,webViewLink,parents"},
        json_body=body,
    )


async def move_drive_file(
    supabase,
    user: dict[str, Any],
    *,
    file_id: str,
    new_parent_folder_id: str,
) -> dict[str, Any]:
    # Drive needs you to know the current parent to remove it.
    current = await _api(
        supabase,
        user,
        "GET",
        f"{DRIVE_BASE}/files/{file_id}",
        params={"fields": "parents"},
    )
    old_parents = ",".join(current.get("parents") or [])
    return await _api(
        supabase,
        user,
        "PATCH",
        f"{DRIVE_BASE}/files/{file_id}",
        params={
            "addParents": new_parent_folder_id,
            "removeParents": old_parents,
            "fields": "id,name,parents",
        },
    )


async def delete_drive_item(
    supabase,
    user: dict[str, Any],
    *,
    file_id: str,
    permanent: bool = False,
) -> dict[str, Any]:
    if permanent:
        await _api(supabase, user, "DELETE", f"{DRIVE_BASE}/files/{file_id}")
        return {"deleted": True, "id": file_id, "permanent": True}
    # Trash via patch
    await _api(
        supabase,
        user,
        "PATCH",
        f"{DRIVE_BASE}/files/{file_id}",
        json_body={"trashed": True},
    )
    return {"trashed": True, "id": file_id, "permanent": False}


async def update_drive_file_metadata(
    supabase,
    user: dict[str, Any],
    *,
    file_id: str,
    name: Optional[str] = None,
    description: Optional[str] = None,
    starred: Optional[bool] = None,
) -> dict[str, Any]:
    body: dict[str, Any] = {}
    if name is not None:
        body["name"] = name
    if description is not None:
        body["description"] = description
    if starred is not None:
        body["starred"] = starred
    return await _api(
        supabase,
        user,
        "PATCH",
        f"{DRIVE_BASE}/files/{file_id}",
        params={"fields": "id,name,description,starred"},
        json_body=body,
    )


async def share_drive_item(
    supabase,
    user: dict[str, Any],
    *,
    file_id: str,
    email: Optional[str] = None,
    role: str = "reader",
    permission_type: str = "user",
    send_notification: bool = True,
) -> dict[str, Any]:
    """Share a file or folder. role: reader/commenter/writer. type: user/group/domain/anyone."""
    body: dict[str, Any] = {"role": role, "type": permission_type}
    if email and permission_type in ("user", "group"):
        body["emailAddress"] = email
    permission = await _api(
        supabase,
        user,
        "POST",
        f"{DRIVE_BASE}/files/{file_id}/permissions",
        params={
            "sendNotificationEmail": "true" if send_notification else "false",
            "fields": "id,role,type,emailAddress",
        },
        json_body=body,
    )
    # The permission response has no file-level fields — fetch the name/link
    # too so callers (and the assistant composing a follow-up email) always
    # have something to reference the shared file by.
    try:
        meta = await get_drive_file_metadata(supabase, user, file_id=file_id)
        permission["file_name"] = meta.get("name")
        permission["web_view_link"] = meta.get("web_view_link")
    except Exception:  # noqa: BLE001
        pass
    return permission


# ---------------------------------------------------------------------------
# Drive — shared drives (Team Drives)
# ---------------------------------------------------------------------------


async def list_shared_drives(
    supabase, user: dict[str, Any], *, page_size: int = 50
) -> list[dict[str, Any]]:
    res = await _api(
        supabase,
        user,
        "GET",
        f"{DRIVE_BASE}/drives",
        params={"pageSize": min(max(page_size, 1), 100)},
    )
    return [
        {"id": d.get("id"), "name": d.get("name"), "created_at": d.get("createdTime")}
        for d in res.get("drives", [])
    ]


async def get_shared_drive(
    supabase, user: dict[str, Any], *, drive_id: str
) -> dict[str, Any]:
    return await _api(supabase, user, "GET", f"{DRIVE_BASE}/drives/{drive_id}")


async def create_shared_drive(
    supabase, user: dict[str, Any], *, name: str
) -> dict[str, Any]:
    import uuid as _uuid
    return await _api(
        supabase,
        user,
        "POST",
        f"{DRIVE_BASE}/drives",
        params={"requestId": str(_uuid.uuid4())},
        json_body={"name": name},
    )


async def update_shared_drive(
    supabase, user: dict[str, Any], *, drive_id: str, name: str
) -> dict[str, Any]:
    return await _api(
        supabase,
        user,
        "PATCH",
        f"{DRIVE_BASE}/drives/{drive_id}",
        json_body={"name": name},
    )


# ---------------------------------------------------------------------------
# Docs — write ops
# ---------------------------------------------------------------------------


async def create_google_doc(
    supabase, user: dict[str, Any], *, title: str
) -> dict[str, Any]:
    res = await _api(
        supabase, user, "POST", f"{DOCS_BASE}/documents", json_body={"title": title}
    )
    return {
        "id": res.get("documentId"),
        "title": res.get("title"),
        "url": f"https://docs.google.com/document/d/{res.get('documentId')}/edit",
    }


async def append_text_to_google_doc(
    supabase, user: dict[str, Any], *, document_id: str, text: str
) -> dict[str, Any]:
    """Append text at the end of a Doc using batchUpdate."""
    # Find the end of the document body
    doc = await _api(
        supabase,
        user,
        "GET",
        f"{DOCS_BASE}/documents/{document_id}",
        params={"fields": "body.content"},
    )
    body = (doc.get("body") or {}).get("content") or []
    end_index = 1
    for el in body:
        ei = el.get("endIndex")
        if isinstance(ei, int):
            end_index = max(end_index, ei)
    # endIndex of the body itself includes a trailing newline; insert before it.
    insert_at = max(1, end_index - 1)
    res = await _api(
        supabase,
        user,
        "POST",
        f"{DOCS_BASE}/documents/{document_id}:batchUpdate",
        json_body={
            "requests": [
                {
                    "insertText": {
                        "location": {"index": insert_at},
                        "text": text,
                    }
                }
            ]
        },
    )
    return {"document_id": document_id, "replies": len(res.get("replies") or [])}


async def replace_text_in_google_doc(
    supabase,
    user: dict[str, Any],
    *,
    document_id: str,
    find: str,
    replace: str,
    match_case: bool = False,
) -> dict[str, Any]:
    res = await _api(
        supabase,
        user,
        "POST",
        f"{DOCS_BASE}/documents/{document_id}:batchUpdate",
        json_body={
            "requests": [
                {
                    "replaceAllText": {
                        "containsText": {"text": find, "matchCase": match_case},
                        "replaceText": replace,
                    }
                }
            ]
        },
    )
    occurrences = (
        (res.get("replies") or [{}])[0]
        .get("replaceAllText", {})
        .get("occurrencesChanged", 0)
    )
    return {"document_id": document_id, "occurrences_changed": occurrences}


# ---------------------------------------------------------------------------
# Slides — write + extra reads
# ---------------------------------------------------------------------------


async def get_slides_page(
    supabase, user: dict[str, Any], *, presentation_id: str, page_id: str
) -> dict[str, Any]:
    return await _api(
        supabase,
        user,
        "GET",
        f"{SLIDES_BASE}/presentations/{presentation_id}/pages/{page_id}",
    )


async def get_slides_page_thumbnail(
    supabase,
    user: dict[str, Any],
    *,
    presentation_id: str,
    page_id: str,
    size: str = "MEDIUM",
) -> dict[str, Any]:
    """Returns {content_url, width, height} for a slide thumbnail PNG."""
    res = await _api(
        supabase,
        user,
        "GET",
        f"{SLIDES_BASE}/presentations/{presentation_id}/pages/{page_id}/thumbnail",
        params={"thumbnailProperties.thumbnailSize": size},
    )
    return {
        "content_url": res.get("contentUrl"),
        "width": res.get("width"),
        "height": res.get("height"),
    }


async def replace_text_in_slides(
    supabase,
    user: dict[str, Any],
    *,
    presentation_id: str,
    find: str,
    replace: str,
    match_case: bool = False,
) -> dict[str, Any]:
    res = await _api(
        supabase,
        user,
        "POST",
        f"{SLIDES_BASE}/presentations/{presentation_id}:batchUpdate",
        json_body={
            "requests": [
                {
                    "replaceAllText": {
                        "containsText": {"text": find, "matchCase": match_case},
                        "replaceText": replace,
                    }
                }
            ]
        },
    )
    occurrences = (
        (res.get("replies") or [{}])[0]
        .get("replaceAllText", {})
        .get("occurrencesChanged", 0)
    )
    return {"presentation_id": presentation_id, "occurrences_changed": occurrences}


# ---------------------------------------------------------------------------
# Sheets — write ops
# ---------------------------------------------------------------------------


async def create_spreadsheet(
    supabase,
    user: dict[str, Any],
    *,
    title: str,
    sheet_titles: Optional[list[str]] = None,
) -> dict[str, Any]:
    body: dict[str, Any] = {"properties": {"title": title}}
    if sheet_titles:
        body["sheets"] = [{"properties": {"title": t}} for t in sheet_titles]
    res = await _api(
        supabase, user, "POST", f"{SHEETS_BASE}/spreadsheets", json_body=body
    )
    return {
        "id": res.get("spreadsheetId"),
        "title": (res.get("properties") or {}).get("title"),
        "url": res.get("spreadsheetUrl"),
    }


async def delete_spreadsheet(
    supabase, user: dict[str, Any], *, spreadsheet_id: str
) -> dict[str, Any]:
    """Sheets has no native delete — we delete the underlying Drive file."""
    return await delete_drive_item(
        supabase, user, file_id=spreadsheet_id, permanent=False
    )


async def add_sheet_tab(
    supabase,
    user: dict[str, Any],
    *,
    spreadsheet_id: str,
    title: str,
) -> dict[str, Any]:
    res = await _api(
        supabase,
        user,
        "POST",
        f"{SHEETS_BASE}/spreadsheets/{spreadsheet_id}:batchUpdate",
        json_body={
            "requests": [{"addSheet": {"properties": {"title": title}}}]
        },
    )
    reply = (res.get("replies") or [{}])[0].get("addSheet", {})
    return {
        "sheet_id": (reply.get("properties") or {}).get("sheetId"),
        "title": (reply.get("properties") or {}).get("title"),
    }


async def delete_sheet_tab(
    supabase,
    user: dict[str, Any],
    *,
    spreadsheet_id: str,
    sheet_id: int,
) -> dict[str, Any]:
    await _api(
        supabase,
        user,
        "POST",
        f"{SHEETS_BASE}/spreadsheets/{spreadsheet_id}:batchUpdate",
        json_body={"requests": [{"deleteSheet": {"sheetId": sheet_id}}]},
    )
    return {"deleted": True, "sheet_id": sheet_id}


async def append_sheet_values(
    supabase,
    user: dict[str, Any],
    *,
    spreadsheet_id: str,
    range_a1: str,
    values: list[list[Any]],
    value_input: str = "USER_ENTERED",
) -> dict[str, Any]:
    res = await _api(
        supabase,
        user,
        "POST",
        f"{SHEETS_BASE}/spreadsheets/{spreadsheet_id}/values/{range_a1}:append",
        params={
            "valueInputOption": value_input,
            "insertDataOption": "INSERT_ROWS",
        },
        json_body={"values": values},
    )
    upd = res.get("updates", {}) or {}
    return {
        "updated_range": upd.get("updatedRange"),
        "updated_rows": upd.get("updatedRows"),
        "updated_cells": upd.get("updatedCells"),
    }


async def update_sheet_values(
    supabase,
    user: dict[str, Any],
    *,
    spreadsheet_id: str,
    range_a1: str,
    values: list[list[Any]],
    value_input: str = "USER_ENTERED",
) -> dict[str, Any]:
    res = await _api(
        supabase,
        user,
        "PUT",
        f"{SHEETS_BASE}/spreadsheets/{spreadsheet_id}/values/{range_a1}",
        params={"valueInputOption": value_input},
        json_body={"values": values},
    )
    return {
        "updated_range": res.get("updatedRange"),
        "updated_rows": res.get("updatedRows"),
        "updated_cells": res.get("updatedCells"),
    }


async def clear_sheet_values(
    supabase,
    user: dict[str, Any],
    *,
    spreadsheet_id: str,
    range_a1: str,
) -> dict[str, Any]:
    res = await _api(
        supabase,
        user,
        "POST",
        f"{SHEETS_BASE}/spreadsheets/{spreadsheet_id}/values/{range_a1}:clear",
    )
    return {"cleared_range": res.get("clearedRange")}


async def read_google_slides(
    supabase, user: dict[str, Any], *, presentation_id: str
) -> dict[str, Any]:
    res = await _api(
        supabase, user, "GET", f"{SLIDES_BASE}/presentations/{presentation_id}"
    )
    slides_out: list[dict[str, Any]] = []
    for idx, s in enumerate(res.get("slides", []) or []):
        text = _walk_slide_text(s.get("pageElements", []) or [])
        slides_out.append(
            {
                "index": idx + 1,
                "object_id": s.get("objectId"),
                "text": text.strip(),
            }
        )
    return {
        "id": res.get("presentationId"),
        "title": res.get("title"),
        "slide_count": len(slides_out),
        "slides": slides_out,
        "full_text": "\n\n".join(f"--- Slide {s['index']} ---\n{s['text']}" for s in slides_out),
    }


async def update_google_contact(
    supabase,
    user: dict[str, Any],
    *,
    resource_name: str,
    name: Optional[str] = None,
    email: Optional[str] = None,
    phone: Optional[str] = None,
    company: Optional[str] = None,
    notes: Optional[str] = None,
) -> dict[str, Any]:
    # Need current etag for update.
    current = await _api(
        supabase,
        user,
        "GET",
        f"{PEOPLE_BASE}/{resource_name}",
        params={"personFields": _PEOPLE_FIELDS},
    )
    body: dict[str, Any] = {"etag": current.get("etag")}
    fields: list[str] = []
    if name is not None:
        body["names"] = [{"givenName": name}]
        fields.append("names")
    if email is not None:
        body["emailAddresses"] = [{"value": email}] if email else []
        fields.append("emailAddresses")
    if phone is not None:
        body["phoneNumbers"] = [{"value": phone}] if phone else []
        fields.append("phoneNumbers")
    if company is not None:
        body["organizations"] = [{"name": company}] if company else []
        fields.append("organizations")
    if notes is not None:
        body["biographies"] = (
            [{"value": notes, "contentType": "TEXT_PLAIN"}] if notes else []
        )
        fields.append("biographies")
    if not fields:
        return _format_person(current)
    res = await _api(
        supabase,
        user,
        "PATCH",
        f"{PEOPLE_BASE}/{resource_name}:updateContact",
        params={"updatePersonFields": ",".join(fields)},
        json_body=body,
    )
    return _format_person(res)
