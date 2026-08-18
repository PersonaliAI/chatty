"""Pure unit tests — no network, no database, always run. Complements
test_integration_live.py and test_security_live.py, which verify the same
class of behavior end-to-end against the real schema/database when real
credentials are available."""
from plugins.agent_tools import _dedupe_doubled
from plugins.google_integrations import CHATTY_SCOPES, SCOPES, auth_url

# Scopes Kin uses that Chatty's tools never touch — Gmail, Tasks, Contacts,
# Docs, Sheets, Slides. A Chatty-initiated OAuth connection should never
# request any of these; that was the actual incident (a Chatty customer's
# Google consent screen asked for full inbox/Docs/Sheets/Slides access to
# enable calendar scheduling).
_KIN_ONLY_SCOPES = {
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/tasks",
    "https://www.googleapis.com/auth/contacts",
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/presentations",
}


def test_chatty_scopes_exclude_everything_kin_only_uses():
    overreach = set(CHATTY_SCOPES) & _KIN_ONLY_SCOPES
    assert not overreach, f"CHATTY_SCOPES requests Kin-only permissions: {sorted(overreach)}"


def test_chatty_scopes_is_a_subset_of_the_full_bundle():
    # Sanity: every Chatty scope should be a real, recognized scope — not a
    # typo that would silently no-op in the OAuth request.
    assert set(CHATTY_SCOPES) <= set(SCOPES)


def test_chatty_scopes_still_covers_calendar_and_drive():
    # The two things Chatty's tools actually use — regression guard against
    # someone trimming this list too far in the other direction.
    assert "https://www.googleapis.com/auth/calendar" in CHATTY_SCOPES
    assert "https://www.googleapis.com/auth/calendar.events" in CHATTY_SCOPES
    assert "https://www.googleapis.com/auth/drive" in CHATTY_SCOPES


def test_auth_url_honors_a_narrower_scope_override(monkeypatch):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "test-client-id")
    monkeypatch.setenv("GOOGLE_REDIRECT_URI", "https://example.com/callback")
    url = auth_url("state123", scopes=CHATTY_SCOPES)
    assert "gmail" not in url
    assert "calendar" in url


def test_auth_url_defaults_to_the_full_bundle_without_an_override(monkeypatch):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "test-client-id")
    monkeypatch.setenv("GOOGLE_REDIRECT_URI", "https://example.com/callback")
    url = auth_url("state123")
    assert "gmail" in url


def test_dedupe_doubled_collapses_exact_repeat():
    assert _dedupe_doubled("da@g.comda@g.com") == "da@g.com"
    assert _dedupe_doubled("TharinduTharindu") == "Tharindu"


def test_dedupe_doubled_leaves_normal_values_alone():
    assert _dedupe_doubled("da@g.com") == "da@g.com"
    assert _dedupe_doubled("Tharindu") == "Tharindu"
    assert _dedupe_doubled("") == ""
    assert _dedupe_doubled(None) is None


def test_dedupe_doubled_ignores_odd_length_and_coincidental_halves():
    # Odd length can never split into two identical halves — left untouched.
    assert _dedupe_doubled("abc") == "abc"
    # Even length, but the two halves genuinely differ — left untouched.
    assert _dedupe_doubled("abcd") == "abcd"


def test_dedupe_doubled_passes_through_non_strings():
    assert _dedupe_doubled(42) == 42
    assert _dedupe_doubled(None) is None
