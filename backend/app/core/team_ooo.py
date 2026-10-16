"""Out-of-office (OOO) helpers for team members.

Single source of truth for "is this teammate away right now?" so round-robin
booking, chat auto-assignment and the team API all agree. Pure functions - no
I/O - so they are trivially unit-testable.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

OOO_FIELDS = ("ooo_start", "ooo_end", "ooo_backup_email", "ooo_reason")


def _parse(value: Any) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, datetime):
        dt = value
    else:
        try:
            dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except ValueError:
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def is_out_of_office(row: dict[str, Any], now: Optional[datetime] = None) -> bool:
    """True when `now` falls inside the member's OOO window.

    - start + end: inside the closed interval.
    - start only: away indefinitely from start.
    - end only: away until end.
    - neither: not away.
    """
    start = _parse(row.get("ooo_start"))
    end = _parse(row.get("ooo_end"))
    if start is None and end is None:
        return False
    now = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    if start is not None and now < start:
        return False
    if end is not None and now > end:
        return False
    return True


def validate_ooo_window(start: Optional[str], end: Optional[str]) -> None:
    """Raise ValueError for an impossible window (end before start / unparsable)."""
    s, e = _parse(start), _parse(end)
    if start and s is None:
        raise ValueError("Invalid out-of-office start date")
    if end and e is None:
        raise ValueError("Invalid out-of-office end date")
    if s and e and e < s:
        raise ValueError("Out-of-office end must be after the start")


def resolve_backup(row: dict[str, Any], members_by_email: dict[str, dict[str, Any]],
                   now: Optional[datetime] = None) -> Optional[str]:
    """Email of the colleague covering for `row`, or None.

    The backup must exist on the roster and must not itself be away
    (prevents routing a customer into another empty desk).
    """
    backup = (row.get("ooo_backup_email") or "").strip().lower()
    if not backup:
        return None
    other = members_by_email.get(backup)
    if other is None or is_out_of_office(other, now):
        return None
    return backup
