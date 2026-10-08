from voice_agent_cli.timezone import resolve_visitor_timezone


def test_runtime_accepts_valid_iana_visitor_timezone():
    assert resolve_visitor_timezone("Asia/Colombo", "UTC") == "Asia/Colombo"


def test_runtime_falls_back_for_missing_or_invalid_visitor_timezone():
    assert resolve_visitor_timezone(None, "UTC") == "UTC"
    assert resolve_visitor_timezone("not/a-timezone", "UTC") == "UTC"
