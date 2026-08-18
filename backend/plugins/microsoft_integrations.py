"""Microsoft 365 (Graph API) helpers — Outlook + OneDrive + ToDo.

Mirrors google_integrations.py structure:
  * OAuth via Microsoft identity platform (v2 endpoint, common tenant).
  * Token auto-refresh via stored refresh_token.
  * Outlook: list / get / send / reply / move / delete / mark-read.
  * OneDrive: list / metadata / download / export / upload.
  * ToDo: list lists / list tasks / create / update / delete.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from urllib.parse import urlencode

import httpx

logger = logging.getLogger("kin.microsoft")

AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token"
GRAPH_BASE = "https://graph.microsoft.com/v1.0"

# Scopes for the four services we expose. `offline_access` is needed to get a
# refresh token. Each scope must be the short-form Graph permission name.
#
# IMPORTANT: keep this list in sync with the tools registered in agent_tools.py.
# A missing scope here = silent 403s on the corresponding Graph endpoint, even
# though the tool dispatches successfully (e.g. /me/events needs
# Calendars.ReadWrite, /me/contacts needs Contacts.ReadWrite).
SCOPES = [
    "offline_access",
    "User.Read",
    # Outlook mail
    "Mail.ReadWrite",
    "Mail.Send",
    # Outlook calendar (events + calendars)
    "Calendars.ReadWrite",
    # Outlook contacts
    "Contacts.ReadWrite",
    # OneDrive (read + write)
    "Files.ReadWrite",
    # Microsoft ToDo
    "Tasks.ReadWrite",
]


class MicrosoftNotConnected(Exception):
    pass


# ---------------------------------------------------------------------------
# OAuth flow
# ---------------------------------------------------------------------------


def auth_url(state: str) -> str:
    if not os.environ.get("MICROSOFT_CLIENT_ID"):
        raise RuntimeError("MICROSOFT_CLIENT_ID not configured")
    params = {
        "client_id": os.environ["MICROSOFT_CLIENT_ID"],
        "redirect_uri": os.environ["MICROSOFT_REDIRECT_URI"],
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "response_mode": "query",
        "state": state,
        "prompt": "consent",
    }
    return f"{AUTH_URL}?{urlencode(params)}"


async def exchange_code(code: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.post(
            TOKEN_URL,
            data={
                "client_id": os.environ["MICROSOFT_CLIENT_ID"],
                "client_secret": os.environ["MICROSOFT_CLIENT_SECRET"],
                "code": code,
                "redirect_uri": os.environ["MICROSOFT_REDIRECT_URI"],
                "grant_type": "authorization_code",
                "scope": " ".join(SCOPES),
            },
        )
        r.raise_for_status()
        return r.json()


async def refresh_access_token(refresh_token: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.post(
            TOKEN_URL,
            data={
                "client_id": os.environ["MICROSOFT_CLIENT_ID"],
                "client_secret": os.environ["MICROSOFT_CLIENT_SECRET"],
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
                "scope": " ".join(SCOPES),
            },
        )
        r.raise_for_status()
        return r.json()


async def me(access_token: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.get(
            f"{GRAPH_BASE}/me",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        r.raise_for_status()
        return r.json()


async def _valid_access_token(
    supabase, user: dict[str, Any]
) -> Optional[str]:
    token = user.get("microsoft_access_token")
    refresh = user.get("microsoft_refresh_token")
    expiry = user.get("microsoft_token_expiry")
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
    new_refresh = data.get("refresh_token") or refresh
    expires_in = int(data.get("expires_in", 3600))
    new_exp = now + timedelta(seconds=expires_in)
    user["microsoft_access_token"] = new_token
    user["microsoft_refresh_token"] = new_refresh
    user["microsoft_token_expiry"] = new_exp.isoformat()
    supabase.table("users").update(
        {
            "microsoft_access_token": new_token,
            "microsoft_refresh_token": new_refresh,
            "microsoft_token_expiry": new_exp.isoformat(),
        }
    ).eq("id", user["id"]).execute()
    return new_token


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
    timeout: float = 30,
    return_raw: bool = False,
    headers: Optional[dict[str, str]] = None,
) -> Any:
    token = await _valid_access_token(supabase, user)
    if not token:
        raise MicrosoftNotConnected("Microsoft account not connected")
    req_headers: dict[str, str] = {"Authorization": f"Bearer {token}"}
    if content_type:
        req_headers["Content-Type"] = content_type
    if headers:
        req_headers.update(headers)
    # Graph endpoints like /me/drive/items/{id}/content respond with a 302
    # to a short-lived download URL — httpx does NOT follow redirects by
    # default, so without this raw bytes downloads come back empty.
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as c:
        r = await c.request(
            method,
            url,
            params=params,
            json=json_body,
            content=raw_body,
            headers=req_headers,
        )
        if r.status_code == 202 or r.status_code == 204:
            return {}
        if r.status_code >= 400:
            try:
                err = r.json()
            except Exception:  # noqa: BLE001
                err = {"raw": r.text}
            raise RuntimeError(
                f"Graph {method} {url} failed [{r.status_code}]: {err}"
            )
        if return_raw:
            return r.content
        if not r.content:
            return {}
        try:
            return r.json()
        except Exception:  # noqa: BLE001
            return {"raw": r.text}


# ---------------------------------------------------------------------------
# Outlook — messages
# ---------------------------------------------------------------------------


def _clean_snippet(text: str, limit: int = 280) -> str:
    """Trim a body preview to a clean sentence/word boundary + ellipsis.

    Outlook's `bodyPreview` is ~255 chars and frequently ends mid-word
    ("Initially, we identified a"). We collapse whitespace, then cut at the
    last sentence boundary, then last word boundary, then add an ellipsis so
    it reads as a deliberate truncation instead of a glitch.
    """
    if not text:
        return ""
    s = " ".join(text.split())  # collapse newlines + repeated spaces
    if len(s) <= limit:
        return s
    cut = s[:limit]
    # Prefer last sentence boundary in the second half.
    sentence = max(cut.rfind(". "), cut.rfind("! "), cut.rfind("? "))
    if sentence >= limit // 2:
        return cut[: sentence + 1] + " …"
    space = cut.rfind(" ")
    if space >= limit // 2:
        return cut[:space].rstrip(",;:") + " …"
    return cut.rstrip(",;:") + "…"


def _format_outlook_msg(m: dict[str, Any]) -> dict[str, Any]:
    from_field = (m.get("from") or {}).get("emailAddress", {}) or {}
    return {
        "id": m.get("id"),
        "conversation_id": m.get("conversationId"),
        "subject": m.get("subject") or "(no subject)",
        "from": f"{from_field.get('name', '')} <{from_field.get('address', '')}>".strip(),
        "from_email": from_field.get("address"),
        "to": ", ".join(
            (r.get("emailAddress") or {}).get("address", "")
            for r in m.get("toRecipients", [])
        ),
        "snippet": _clean_snippet(m.get("bodyPreview") or ""),
        "received_at": m.get("receivedDateTime"),
        "is_read": m.get("isRead", False),
        "url": m.get("webLink"),
    }


async def list_outlook_messages(
    supabase,
    user: dict[str, Any],
    *,
    limit: int = 15,
    query: str = "",
    folder: str = "Inbox",
    max_days_old: Optional[int] = None,
) -> list[dict[str, Any]]:
    """Fetch Outlook messages.

    Strategy:
      - If `max_days_old` is given: use Graph's server-side `$filter` on
        receivedDateTime so we get every message in the window (not just the
        top N then filtered down). Combine with `$top` for paging.
      - If `query` is given: use `$search`. Graph requires
        `ConsistencyLevel: eventual` and does NOT allow `$orderby` with
        $search, so we strip it.
      - Otherwise: default to most-recent N.
    """
    # When the caller wants "last N days", we want EVERY message in the window,
    # so use a bigger top and Graph's server-side date filter.
    effective_limit = min(max(limit, 1), 100)
    if max_days_old is not None and effective_limit < 50:
        effective_limit = 50

    params: dict[str, Any] = {
        "$top": effective_limit,
        "$orderby": "receivedDateTime desc",
        "$select": "id,conversationId,subject,from,toRecipients,bodyPreview,receivedDateTime,isRead,webLink",
    }
    headers: dict[str, str] = {}

    if max_days_old is not None:
        cutoff = datetime.now(timezone.utc) - timedelta(days=max_days_old)
        cutoff_iso = cutoff.isoformat().replace("+00:00", "Z")
        params["$filter"] = f"receivedDateTime ge {cutoff_iso}"

    if query.strip():
        # $search and $filter together require ConsistencyLevel: eventual.
        params["$search"] = f'"{query.strip()}"'
        params.pop("$orderby", None)
        headers["ConsistencyLevel"] = "eventual"

    try:
        res = await _api(
            supabase,
            user,
            "GET",
            f"{GRAPH_BASE}/me/mailFolders/{folder}/messages",
            params=params,
            headers=headers or None,
        )
    except RuntimeError as exc:
        # If $search + $filter combination is rejected, retry without $search.
        if query.strip() and "$search" in str(exc):
            params.pop("$search", None)
            params["$orderby"] = "receivedDateTime desc"
            headers.pop("ConsistencyLevel", None)
            res = await _api(
                supabase,
                user,
                "GET",
                f"{GRAPH_BASE}/me/mailFolders/{folder}/messages",
                params=params,
                headers=headers or None,
            )
        else:
            raise

    return [_format_outlook_msg(m) for m in res.get("value", [])]


async def get_outlook_message(
    supabase, user: dict[str, Any], *, message_id: str
) -> dict[str, Any]:
    m = await _api(
        supabase,
        user,
        "GET",
        f"{GRAPH_BASE}/me/messages/{message_id}",
    )
    base = _format_outlook_msg(m)
    body = (m.get("body") or {}).get("content") or ""
    base["body"] = body[:8000]
    return base


async def send_outlook_message(
    supabase,
    user: dict[str, Any],
    *,
    to: list[str],
    subject: str,
    body: str,
    cc: Optional[list[str]] = None,
    bcc: Optional[list[str]] = None,
    html: bool = False,
) -> dict[str, Any]:
    payload = {
        "message": {
            "subject": subject,
            "body": {
                "contentType": "HTML" if html else "Text",
                "content": body,
            },
            "toRecipients": [
                {"emailAddress": {"address": a}} for a in to
            ],
            **(
                {"ccRecipients": [{"emailAddress": {"address": a}} for a in cc]}
                if cc
                else {}
            ),
            **(
                {"bccRecipients": [{"emailAddress": {"address": a}} for a in bcc]}
                if bcc
                else {}
            ),
        },
        "saveToSentItems": True,
    }
    await _api(
        supabase, user, "POST", f"{GRAPH_BASE}/me/sendMail", json_body=payload
    )
    return {"sent": True, "to": to}


async def reply_outlook_message(
    supabase, user: dict[str, Any], *, message_id: str, body: str, html: bool = False
) -> dict[str, Any]:
    await _api(
        supabase,
        user,
        "POST",
        f"{GRAPH_BASE}/me/messages/{message_id}/reply",
        json_body={
            "comment": "",
            "message": {
                "body": {
                    "contentType": "HTML" if html else "Text",
                    "content": body,
                }
            },
        },
    )
    return {"replied": True, "message_id": message_id}


async def mark_outlook_read(
    supabase, user: dict[str, Any], *, message_id: str, is_read: bool = True
) -> dict[str, Any]:
    await _api(
        supabase,
        user,
        "PATCH",
        f"{GRAPH_BASE}/me/messages/{message_id}",
        json_body={"isRead": is_read},
    )
    return {"id": message_id, "is_read": is_read}


async def delete_outlook_message(
    supabase, user: dict[str, Any], *, message_id: str
) -> dict[str, Any]:
    """Soft delete — moves to Deleted Items."""
    await _api(
        supabase, user, "DELETE", f"{GRAPH_BASE}/me/messages/{message_id}"
    )
    return {"deleted": True, "id": message_id}


async def move_outlook_message(
    supabase,
    user: dict[str, Any],
    *,
    message_id: str,
    destination_folder: str = "archive",
) -> dict[str, Any]:
    """destination_folder: well-known name or folder ID (e.g. 'archive', 'junkemail', 'inbox')."""
    res = await _api(
        supabase,
        user,
        "POST",
        f"{GRAPH_BASE}/me/messages/{message_id}/move",
        json_body={"destinationId": destination_folder},
    )
    return {"id": res.get("id"), "moved_to": destination_folder}


async def list_outlook_folders(
    supabase, user: dict[str, Any]
) -> list[dict[str, Any]]:
    res = await _api(
        supabase, user, "GET", f"{GRAPH_BASE}/me/mailFolders",
        params={"$select": "id,displayName,totalItemCount,unreadItemCount"},
    )
    return [
        {
            "id": f.get("id"),
            "name": f.get("displayName"),
            "total": f.get("totalItemCount"),
            "unread": f.get("unreadItemCount"),
        }
        for f in res.get("value", [])
    ]


# ---------------------------------------------------------------------------
# OneDrive
# ---------------------------------------------------------------------------

# MIME types we can extract text from (mirrors google_integrations.SUPPORTED_BINARY_MIMES)
ONEDRIVE_SUPPORTED_MIMES = {
    "application/pdf",
    "text/plain",
    "text/markdown",
    "text/csv",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}


def _format_onedrive_item(item: dict[str, Any]) -> dict[str, Any]:
    file_part = item.get("file") or {}
    folder_part = item.get("folder")
    return {
        "id": item.get("id"),
        "name": item.get("name"),
        "mime_type": file_part.get("mimeType") if file_part else None,
        "is_folder": folder_part is not None,
        "size_bytes": item.get("size"),
        "modified_at": item.get("lastModifiedDateTime"),
        "web_view_link": item.get("webUrl"),
        "parent_folder_id": (item.get("parentReference") or {}).get("id"),
    }


async def list_onedrive_files(
    supabase,
    user: dict[str, Any],
    *,
    folder_id: Optional[str] = None,
    query: Optional[str] = None,
    page_size: int = 50,
) -> dict[str, Any]:
    if query and query.strip():
        url = f"{GRAPH_BASE}/me/drive/root/search(q='{query.strip()}')"
    elif folder_id:
        url = f"{GRAPH_BASE}/me/drive/items/{folder_id}/children"
    else:
        url = f"{GRAPH_BASE}/me/drive/root/children"
    res = await _api(
        supabase,
        user,
        "GET",
        url,
        params={"$top": min(max(page_size, 1), 100)},
    )
    return {
        "files": [_format_onedrive_item(i) for i in res.get("value", [])],
        "next_page_token": res.get("@odata.nextLink"),
    }


async def get_onedrive_metadata(
    supabase, user: dict[str, Any], *, item_id: str
) -> dict[str, Any]:
    res = await _api(
        supabase, user, "GET", f"{GRAPH_BASE}/me/drive/items/{item_id}"
    )
    return _format_onedrive_item(res)


async def download_onedrive_file(
    supabase, user: dict[str, Any], *, item_id: str
) -> bytes:
    """Download raw bytes for a OneDrive file."""
    return await _api(
        supabase,
        user,
        "GET",
        f"{GRAPH_BASE}/me/drive/items/{item_id}/content",
        return_raw=True,
        timeout=60,
    )


async def upload_onedrive_file(
    supabase,
    user: dict[str, Any],
    *,
    name: str,
    content: bytes,
    parent_folder_id: Optional[str] = None,
    mime_type: str = "application/octet-stream",
) -> dict[str, Any]:
    """Upload a small (<4MB) file to OneDrive via simple upload."""
    parent = parent_folder_id or "root"
    # Path style for simple upload: /me/drive/items/{parent-id}:/{filename}:/content
    safe_name = name.replace("/", "_")
    url = f"{GRAPH_BASE}/me/drive/items/{parent}:/{safe_name}:/content"
    token = await _valid_access_token(supabase, user)
    if not token:
        raise MicrosoftNotConnected("Microsoft not connected")
    async with httpx.AsyncClient(timeout=120) as c:
        r = await c.put(
            url,
            content=content,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": mime_type,
            },
        )
        if r.status_code >= 400:
            raise RuntimeError(f"upload failed [{r.status_code}]: {r.text[:200]}")
        return _format_onedrive_item(r.json())


async def upload_onedrive_text_file(
    supabase,
    user: dict[str, Any],
    *,
    name: str,
    text: str,
    parent_folder_id: Optional[str] = None,
    mime_type: str = "text/plain",
) -> dict[str, Any]:
    return await upload_onedrive_file(
        supabase,
        user,
        name=name,
        content=text.encode("utf-8"),
        parent_folder_id=parent_folder_id,
        mime_type=mime_type,
    )


async def create_onedrive_folder(
    supabase,
    user: dict[str, Any],
    *,
    name: str,
    parent_folder_id: Optional[str] = None,
) -> dict[str, Any]:
    parent = parent_folder_id or "root"
    res = await _api(
        supabase,
        user,
        "POST",
        f"{GRAPH_BASE}/me/drive/items/{parent}/children",
        json_body={
            "name": name,
            "folder": {},
            "@microsoft.graph.conflictBehavior": "rename",
        },
    )
    return _format_onedrive_item(res)


async def rename_onedrive_item(
    supabase, user: dict[str, Any], *, item_id: str, new_name: str
) -> dict[str, Any]:
    res = await _api(
        supabase,
        user,
        "PATCH",
        f"{GRAPH_BASE}/me/drive/items/{item_id}",
        json_body={"name": new_name},
    )
    return _format_onedrive_item(res)


async def delete_onedrive_item(
    supabase, user: dict[str, Any], *, item_id: str
) -> dict[str, Any]:
    await _api(supabase, user, "DELETE", f"{GRAPH_BASE}/me/drive/items/{item_id}")
    return {"deleted": True, "id": item_id}


async def copy_onedrive_item(
    supabase,
    user: dict[str, Any],
    *,
    item_id: str,
    new_name: Optional[str] = None,
    parent_folder_id: Optional[str] = None,
) -> dict[str, Any]:
    body: dict[str, Any] = {}
    if new_name:
        body["name"] = new_name
    if parent_folder_id:
        body["parentReference"] = {"id": parent_folder_id}
    # Returns 202 Accepted with a monitor URL — we just confirm it was accepted.
    await _api(
        supabase,
        user,
        "POST",
        f"{GRAPH_BASE}/me/drive/items/{item_id}/copy",
        json_body=body or None,
    )
    return {"copying": True, "source_id": item_id}


async def move_onedrive_item(
    supabase,
    user: dict[str, Any],
    *,
    item_id: str,
    new_parent_folder_id: str,
) -> dict[str, Any]:
    res = await _api(
        supabase,
        user,
        "PATCH",
        f"{GRAPH_BASE}/me/drive/items/{item_id}",
        json_body={"parentReference": {"id": new_parent_folder_id}},
    )
    return _format_onedrive_item(res)


async def share_onedrive_item(
    supabase,
    user: dict[str, Any],
    *,
    item_id: str,
    email: Optional[str] = None,
    role: str = "read",
    require_sign_in: bool = True,
    send_invitation: bool = True,
) -> dict[str, Any]:
    """Share a OneDrive item. role: 'read' or 'write'. If email omitted, returns a sharing link."""
    if email:
        res = await _api(
            supabase,
            user,
            "POST",
            f"{GRAPH_BASE}/me/drive/items/{item_id}/invite",
            json_body={
                "recipients": [{"email": email}],
                "message": "",
                "requireSignIn": require_sign_in,
                "sendInvitation": send_invitation,
                "roles": [role],
            },
        )
        result = {"shared_with": email, "role": role, "raw": res}
        # The invite response has no item-level fields — fetch the name/link
        # too so callers (and the assistant composing a follow-up email)
        # always have something to reference the shared file by.
        try:
            meta = await get_onedrive_metadata(supabase, user, item_id=item_id)
            result["file_name"] = meta.get("name")
            result["web_view_link"] = meta.get("web_view_link")
        except Exception:  # noqa: BLE001
            pass
        return result
    # No email — create a sharing link
    res = await _api(
        supabase,
        user,
        "POST",
        f"{GRAPH_BASE}/me/drive/items/{item_id}/createLink",
        json_body={"type": role if role in ("view", "edit") else "view", "scope": "anonymous"},
    )
    link = (res.get("link") or {}).get("webUrl")
    return {"share_link": link, "scope": "anonymous"}


# ---------------------------------------------------------------------------
# Outlook — drafts (create, get, update, send)
# ---------------------------------------------------------------------------


def _build_message_payload(
    *,
    to: list[str],
    subject: str,
    body: str,
    cc: Optional[list[str]] = None,
    bcc: Optional[list[str]] = None,
    html: bool = False,
) -> dict[str, Any]:
    msg: dict[str, Any] = {
        "subject": subject,
        "body": {"contentType": "HTML" if html else "Text", "content": body},
        "toRecipients": [{"emailAddress": {"address": a}} for a in to],
    }
    if cc:
        msg["ccRecipients"] = [{"emailAddress": {"address": a}} for a in cc]
    if bcc:
        msg["bccRecipients"] = [{"emailAddress": {"address": a}} for a in bcc]
    return msg


async def create_outlook_draft(
    supabase,
    user: dict[str, Any],
    *,
    to: list[str],
    subject: str,
    body: str,
    cc: Optional[list[str]] = None,
    html: bool = False,
) -> dict[str, Any]:
    payload = _build_message_payload(to=to, subject=subject, body=body, cc=cc, html=html)
    res = await _api(supabase, user, "POST", f"{GRAPH_BASE}/me/messages", json_body=payload)
    return {"id": res.get("id"), "subject": res.get("subject"), "is_draft": res.get("isDraft")}


async def get_outlook_draft(
    supabase, user: dict[str, Any], *, draft_id: str
) -> dict[str, Any]:
    return await get_outlook_message(supabase, user, message_id=draft_id)


async def update_outlook_draft(
    supabase,
    user: dict[str, Any],
    *,
    draft_id: str,
    subject: Optional[str] = None,
    body: Optional[str] = None,
    to: Optional[list[str]] = None,
    html: bool = False,
) -> dict[str, Any]:
    payload: dict[str, Any] = {}
    if subject is not None:
        payload["subject"] = subject
    if body is not None:
        payload["body"] = {"contentType": "HTML" if html else "Text", "content": body}
    if to is not None:
        payload["toRecipients"] = [{"emailAddress": {"address": a}} for a in to]
    res = await _api(
        supabase, user, "PATCH", f"{GRAPH_BASE}/me/messages/{draft_id}", json_body=payload
    )
    return {"id": res.get("id"), "subject": res.get("subject")}


async def send_outlook_draft(
    supabase, user: dict[str, Any], *, draft_id: str
) -> dict[str, Any]:
    await _api(supabase, user, "POST", f"{GRAPH_BASE}/me/messages/{draft_id}/send")
    return {"sent": True, "draft_id": draft_id}


async def update_outlook_message(
    supabase,
    user: dict[str, Any],
    *,
    message_id: str,
    is_read: Optional[bool] = None,
    flag: Optional[str] = None,  # "notFlagged" | "flagged" | "complete"
    categories: Optional[list[str]] = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {}
    if is_read is not None:
        payload["isRead"] = is_read
    if flag is not None:
        payload["flag"] = {"flagStatus": flag}
    if categories is not None:
        payload["categories"] = categories
    res = await _api(
        supabase, user, "PATCH", f"{GRAPH_BASE}/me/messages/{message_id}", json_body=payload
    )
    return _format_outlook_msg(res)


async def list_outlook_folder_messages(
    supabase,
    user: dict[str, Any],
    *,
    folder_id: str,
    limit: int = 25,
) -> list[dict[str, Any]]:
    res = await _api(
        supabase,
        user,
        "GET",
        f"{GRAPH_BASE}/me/mailFolders/{folder_id}/messages",
        params={
            "$top": min(max(limit, 1), 100),
            "$orderby": "receivedDateTime desc",
            "$select": "id,conversationId,subject,from,toRecipients,bodyPreview,receivedDateTime,isRead,webLink",
        },
    )
    return [_format_outlook_msg(m) for m in res.get("value", [])]


async def create_outlook_folder(
    supabase, user: dict[str, Any], *, name: str, parent_folder_id: Optional[str] = None
) -> dict[str, Any]:
    if parent_folder_id:
        url = f"{GRAPH_BASE}/me/mailFolders/{parent_folder_id}/childFolders"
    else:
        url = f"{GRAPH_BASE}/me/mailFolders"
    res = await _api(supabase, user, "POST", url, json_body={"displayName": name})
    return {"id": res.get("id"), "name": res.get("displayName")}


async def get_outlook_folder(
    supabase, user: dict[str, Any], *, folder_id: str
) -> dict[str, Any]:
    res = await _api(supabase, user, "GET", f"{GRAPH_BASE}/me/mailFolders/{folder_id}")
    return {
        "id": res.get("id"),
        "name": res.get("displayName"),
        "total": res.get("totalItemCount"),
        "unread": res.get("unreadItemCount"),
    }


# ---------------------------------------------------------------------------
# Outlook — calendars + events
# ---------------------------------------------------------------------------


def _format_outlook_event(e: dict[str, Any]) -> dict[str, Any]:
    start = e.get("start", {}) or {}
    end = e.get("end", {}) or {}
    body = (e.get("body") or {}).get("content") or ""
    return {
        "id": e.get("id"),
        "subject": e.get("subject") or "(no title)",
        "body": body[:2000],
        "location": (e.get("location") or {}).get("displayName"),
        "start": start.get("dateTime"),
        "end": end.get("dateTime"),
        "is_all_day": e.get("isAllDay"),
        "attendees": [
            (a.get("emailAddress") or {}).get("address")
            for a in e.get("attendees", [])
            if (a.get("emailAddress") or {}).get("address")
        ],
        "organizer": (e.get("organizer") or {})
        .get("emailAddress", {})
        .get("address"),
        "web_link": e.get("webLink"),
        "online_meeting_url": (e.get("onlineMeeting") or {}).get("joinUrl")
        or e.get("onlineMeetingUrl"),
    }


async def list_outlook_calendars(
    supabase, user: dict[str, Any]
) -> list[dict[str, Any]]:
    res = await _api(supabase, user, "GET", f"{GRAPH_BASE}/me/calendars")
    return [
        {"id": c.get("id"), "name": c.get("name"), "owner": (c.get("owner") or {}).get("address")}
        for c in res.get("value", [])
    ]


async def create_outlook_calendar(
    supabase, user: dict[str, Any], *, name: str
) -> dict[str, Any]:
    res = await _api(
        supabase, user, "POST", f"{GRAPH_BASE}/me/calendars", json_body={"name": name}
    )
    return {"id": res.get("id"), "name": res.get("name")}


async def get_outlook_calendar(
    supabase, user: dict[str, Any], *, calendar_id: str
) -> dict[str, Any]:
    res = await _api(
        supabase, user, "GET", f"{GRAPH_BASE}/me/calendars/{calendar_id}"
    )
    return {"id": res.get("id"), "name": res.get("name")}


async def list_outlook_events(
    supabase,
    user: dict[str, Any],
    *,
    calendar_id: Optional[str] = None,
    time_min: Optional[datetime] = None,
    time_max: Optional[datetime] = None,
    limit: int = 25,
) -> list[dict[str, Any]]:
    if calendar_id:
        base = f"{GRAPH_BASE}/me/calendars/{calendar_id}/events"
    else:
        base = f"{GRAPH_BASE}/me/events"
    params: dict[str, Any] = {
        "$top": min(max(limit, 1), 50),
        "$orderby": "start/dateTime",
    }
    if time_min and time_max:
        base = base.replace("/events", "/calendarView") if "/calendars/" in base else (
            f"{GRAPH_BASE}/me/calendarView"
        )
        params["startDateTime"] = time_min.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
        params["endDateTime"] = time_max.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    res = await _api(supabase, user, "GET", base, params=params)
    return [_format_outlook_event(e) for e in res.get("value", [])]


async def get_outlook_event(
    supabase, user: dict[str, Any], *, event_id: str
) -> dict[str, Any]:
    res = await _api(supabase, user, "GET", f"{GRAPH_BASE}/me/events/{event_id}")
    return _format_outlook_event(res)


def _event_payload(
    *,
    subject: str,
    start: str,
    end: str,
    body: Optional[str] = None,
    location: Optional[str] = None,
    attendees: Optional[list[str]] = None,
    is_all_day: bool = False,
    timezone_str: str = "UTC",
    online_meeting: bool = False,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "subject": subject,
        "start": {"dateTime": start, "timeZone": timezone_str},
        "end": {"dateTime": end, "timeZone": timezone_str},
        "isAllDay": is_all_day,
    }
    if online_meeting:
        payload["isOnlineMeeting"] = True
        payload["onlineMeetingProvider"] = "teamsForBusiness"
    if body:
        payload["body"] = {"contentType": "Text", "content": body}
    if location:
        payload["location"] = {"displayName": location}
    if attendees:
        payload["attendees"] = [
            {"emailAddress": {"address": a}, "type": "required"} for a in attendees
        ]
    return payload


async def create_outlook_event(
    supabase,
    user: dict[str, Any],
    *,
    subject: str,
    start: str,
    end: str,
    body: Optional[str] = None,
    location: Optional[str] = None,
    attendees: Optional[list[str]] = None,
    is_all_day: bool = False,
    calendar_id: Optional[str] = None,
    online_meeting: bool = False,
) -> dict[str, Any]:
    tz_str = user.get("timezone") or "UTC"
    payload = _event_payload(
        subject=subject,
        start=start,
        end=end,
        body=body,
        location=location,
        attendees=attendees,
        is_all_day=is_all_day,
        timezone_str=tz_str,
        online_meeting=online_meeting,
    )
    url = (
        f"{GRAPH_BASE}/me/calendars/{calendar_id}/events"
        if calendar_id
        else f"{GRAPH_BASE}/me/events"
    )
    res = await _api(supabase, user, "POST", url, json_body=payload)
    return _format_outlook_event(res)


async def update_outlook_event(
    supabase,
    user: dict[str, Any],
    *,
    event_id: str,
    subject: Optional[str] = None,
    start: Optional[str] = None,
    end: Optional[str] = None,
    body: Optional[str] = None,
    location: Optional[str] = None,
    attendees: Optional[list[str]] = None,
) -> dict[str, Any]:
    tz_str = user.get("timezone") or "UTC"
    payload: dict[str, Any] = {}
    if subject is not None:
        payload["subject"] = subject
    if start is not None:
        payload["start"] = {"dateTime": start, "timeZone": tz_str}
    if end is not None:
        payload["end"] = {"dateTime": end, "timeZone": tz_str}
    if body is not None:
        payload["body"] = {"contentType": "Text", "content": body}
    if location is not None:
        payload["location"] = {"displayName": location}
    if attendees is not None:
        payload["attendees"] = [
            {"emailAddress": {"address": a}, "type": "required"} for a in attendees
        ]
    res = await _api(
        supabase, user, "PATCH", f"{GRAPH_BASE}/me/events/{event_id}", json_body=payload
    )
    return _format_outlook_event(res)


async def delete_outlook_event(
    supabase, user: dict[str, Any], *, event_id: str
) -> dict[str, Any]:
    await _api(supabase, user, "DELETE", f"{GRAPH_BASE}/me/events/{event_id}")
    return {"deleted": True, "id": event_id}


# ---------------------------------------------------------------------------
# Outlook — contacts
# ---------------------------------------------------------------------------


def _format_outlook_contact(c: dict[str, Any]) -> dict[str, Any]:
    emails = [(e.get("address") or "") for e in c.get("emailAddresses", [])]
    return {
        "id": c.get("id"),
        "name": c.get("displayName")
        or f"{c.get('givenName') or ''} {c.get('surname') or ''}".strip(),
        "given_name": c.get("givenName"),
        "family_name": c.get("surname"),
        "emails": [e for e in emails if e],
        "phones": [
            *(c.get("businessPhones") or []),
            *(c.get("homePhones") or []),
            *(([c.get("mobilePhone")]) if c.get("mobilePhone") else []),
        ],
        "company": c.get("companyName"),
        "job_title": c.get("jobTitle"),
    }


async def list_outlook_contacts(
    supabase, user: dict[str, Any], *, limit: int = 50
) -> list[dict[str, Any]]:
    res = await _api(
        supabase,
        user,
        "GET",
        f"{GRAPH_BASE}/me/contacts",
        params={"$top": min(max(limit, 1), 100), "$orderby": "displayName"},
    )
    return [_format_outlook_contact(c) for c in res.get("value", [])]


async def get_outlook_contact(
    supabase, user: dict[str, Any], *, contact_id: str
) -> dict[str, Any]:
    res = await _api(supabase, user, "GET", f"{GRAPH_BASE}/me/contacts/{contact_id}")
    return _format_outlook_contact(res)


async def create_outlook_contact(
    supabase,
    user: dict[str, Any],
    *,
    name: str,
    email: Optional[str] = None,
    phone: Optional[str] = None,
    company: Optional[str] = None,
    job_title: Optional[str] = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {"givenName": name}
    if email:
        payload["emailAddresses"] = [{"address": email, "name": name}]
    if phone:
        payload["mobilePhone"] = phone
    if company:
        payload["companyName"] = company
    if job_title:
        payload["jobTitle"] = job_title
    res = await _api(supabase, user, "POST", f"{GRAPH_BASE}/me/contacts", json_body=payload)
    return _format_outlook_contact(res)


async def delete_outlook_contact(
    supabase, user: dict[str, Any], *, contact_id: str
) -> dict[str, Any]:
    await _api(supabase, user, "DELETE", f"{GRAPH_BASE}/me/contacts/{contact_id}")
    return {"deleted": True, "id": contact_id}


# ---------------------------------------------------------------------------
# Outlook — attachments
# ---------------------------------------------------------------------------


async def list_outlook_attachments(
    supabase, user: dict[str, Any], *, message_id: str
) -> list[dict[str, Any]]:
    res = await _api(
        supabase,
        user,
        "GET",
        f"{GRAPH_BASE}/me/messages/{message_id}/attachments",
    )
    return [
        {
            "id": a.get("id"),
            "name": a.get("name"),
            "content_type": a.get("contentType"),
            "size_bytes": a.get("size"),
        }
        for a in res.get("value", [])
    ]


async def get_outlook_attachment(
    supabase, user: dict[str, Any], *, message_id: str, attachment_id: str
) -> dict[str, Any]:
    a = await _api(
        supabase,
        user,
        "GET",
        f"{GRAPH_BASE}/me/messages/{message_id}/attachments/{attachment_id}",
    )
    return {
        "id": a.get("id"),
        "name": a.get("name"),
        "content_type": a.get("contentType"),
        "size_bytes": a.get("size"),
    }


# ---------------------------------------------------------------------------
# ToDo — list create
# ---------------------------------------------------------------------------


async def create_todo_list(
    supabase, user: dict[str, Any], *, display_name: str
) -> dict[str, Any]:
    res = await _api(
        supabase,
        user,
        "POST",
        f"{GRAPH_BASE}/me/todo/lists",
        json_body={"displayName": display_name},
    )
    return {"id": res.get("id"), "name": res.get("displayName")}


# ---------------------------------------------------------------------------
# ToDo
# ---------------------------------------------------------------------------


async def list_todo_lists(
    supabase, user: dict[str, Any]
) -> list[dict[str, Any]]:
    res = await _api(supabase, user, "GET", f"{GRAPH_BASE}/me/todo/lists")
    return [
        {
            "id": l.get("id"),
            "name": l.get("displayName"),
            "is_owner": l.get("isOwner"),
        }
        for l in res.get("value", [])
    ]


async def list_todo_tasks(
    supabase,
    user: dict[str, Any],
    *,
    list_id: Optional[str] = None,
    show_completed: bool = False,
    limit: int = 50,
) -> list[dict[str, Any]]:
    if not list_id:
        # Default to the first list (usually "Tasks").
        lists = await list_todo_lists(supabase, user)
        if not lists:
            return []
        list_id = lists[0]["id"]
    params: dict[str, Any] = {"$top": min(max(limit, 1), 100), "$orderby": "createdDateTime desc"}
    if not show_completed:
        params["$filter"] = "status ne 'completed'"
    res = await _api(
        supabase,
        user,
        "GET",
        f"{GRAPH_BASE}/me/todo/lists/{list_id}/tasks",
        params=params,
    )
    return [
        {
            "id": t.get("id"),
            "list_id": list_id,
            "title": t.get("title"),
            "body": (t.get("body") or {}).get("content"),
            "status": t.get("status"),
            "importance": t.get("importance"),
            "due": (t.get("dueDateTime") or {}).get("dateTime"),
            "completed_at": (t.get("completedDateTime") or {}).get("dateTime"),
            "created_at": t.get("createdDateTime"),
        }
        for t in res.get("value", [])
    ]


async def create_todo_task(
    supabase,
    user: dict[str, Any],
    *,
    title: str,
    body: Optional[str] = None,
    due: Optional[str] = None,
    importance: str = "normal",
    list_id: Optional[str] = None,
) -> dict[str, Any]:
    if not list_id:
        lists = await list_todo_lists(supabase, user)
        list_id = lists[0]["id"] if lists else None
    if not list_id:
        raise RuntimeError("no Microsoft ToDo list available")
    body_payload: dict[str, Any] = {"title": title, "importance": importance}
    if body:
        body_payload["body"] = {"contentType": "text", "content": body}
    if due:
        body_payload["dueDateTime"] = {"dateTime": due, "timeZone": "UTC"}
    res = await _api(
        supabase,
        user,
        "POST",
        f"{GRAPH_BASE}/me/todo/lists/{list_id}/tasks",
        json_body=body_payload,
    )
    return {"id": res.get("id"), "title": res.get("title"), "list_id": list_id}


async def update_todo_task(
    supabase,
    user: dict[str, Any],
    *,
    task_id: str,
    list_id: str,
    title: Optional[str] = None,
    body: Optional[str] = None,
    completed: Optional[bool] = None,
    due: Optional[str] = None,
    importance: Optional[str] = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {}
    if title is not None:
        payload["title"] = title
    if body is not None:
        payload["body"] = {"contentType": "text", "content": body}
    if completed is not None:
        payload["status"] = "completed" if completed else "notStarted"
    if due is not None:
        payload["dueDateTime"] = {"dateTime": due, "timeZone": "UTC"}
    if importance is not None:
        payload["importance"] = importance
    res = await _api(
        supabase,
        user,
        "PATCH",
        f"{GRAPH_BASE}/me/todo/lists/{list_id}/tasks/{task_id}",
        json_body=payload,
    )
    return {"id": res.get("id"), "status": res.get("status")}


async def delete_todo_task(
    supabase, user: dict[str, Any], *, task_id: str, list_id: str
) -> dict[str, Any]:
    await _api(
        supabase,
        user,
        "DELETE",
        f"{GRAPH_BASE}/me/todo/lists/{list_id}/tasks/{task_id}",
    )
    return {"deleted": True, "task_id": task_id}
