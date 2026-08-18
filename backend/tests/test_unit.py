"""Pure unit tests — no network, no database, always run. Complements
test_integration_live.py, which verifies the same behavior end-to-end
against the real schema when real credentials are available."""
from plugins.agent_tools import _dedupe_doubled


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
