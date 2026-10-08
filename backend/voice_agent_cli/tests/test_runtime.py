from types import SimpleNamespace

from voice_agent_cli import runtime
from voice_agent_cli.timezone import resolve_visitor_timezone


def test_runtime_accepts_valid_iana_visitor_timezone():
    assert resolve_visitor_timezone("Asia/Colombo", "UTC") == "Asia/Colombo"


def test_runtime_falls_back_for_missing_or_invalid_visitor_timezone():
    assert resolve_visitor_timezone(None, "UTC") == "UTC"
    assert resolve_visitor_timezone("not/a-timezone", "UTC") == "UTC"


def test_job_process_setup_warms_chatty_modules(monkeypatch):
    warmed = []

    def fake_load_chatty_modules(settings):
        warmed.append(settings)

    monkeypatch.setattr(
        "voice_agent_cli.bootstrap.load_chatty_modules", fake_load_chatty_modules
    )
    process = SimpleNamespace(userdata={}, pid=123)

    runtime._setup_job_process(process)

    assert warmed == [runtime.settings]
    assert process.userdata["chatty_modules_warmed"] is True
