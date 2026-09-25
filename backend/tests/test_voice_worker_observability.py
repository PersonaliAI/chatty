"""Focused tests for voice-worker runtime metrics and provider safety."""

import importlib.util
import ast
from pathlib import Path
from types import SimpleNamespace


def _load_worker():
    path = Path(__file__).resolve().parents[1] / "voice-agent" / "voice_worker.py"
    spec = importlib.util.spec_from_file_location("chatty_voice_worker_under_test", path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def test_peak_rss_reports_linux_ru_maxrss_in_megabytes(monkeypatch):
    worker = _load_worker()
    fake_resource = SimpleNamespace(
        RUSAGE_SELF=object(),
        getrusage=lambda _kind: SimpleNamespace(ru_maxrss=1024 * 512),
    )
    monkeypatch.setattr(worker, "resource", fake_resource)

    assert worker._process_rss_mb() == 512.0


def test_google_realtime_rejects_cloud_tts_voice_ids(monkeypatch):
    worker = _load_worker()
    calls = {}

    class FakeRealtimeModel:
        def __init__(self, **kwargs):
            calls.update(kwargs)

    monkeypatch.setattr(worker.google.realtime, "RealtimeModel", FakeRealtimeModel)
    worker.build_realtime("google", "gemini-test", "en-US-Chirp3-HD-Aoede", "test-key")

    assert calls["voice"] == worker.REALTIME_DEFAULT_VOICE["google"]


def test_google_realtime_uses_a_supported_default_voice(monkeypatch):
    worker = _load_worker()
    calls = {}

    class FakeRealtimeModel:
        def __init__(self, **kwargs):
            calls.update(kwargs)

    monkeypatch.setattr(worker.google.realtime, "RealtimeModel", FakeRealtimeModel)
    worker.build_realtime("google", "gemini-test", None, "test-key")

    assert calls["voice"] == worker.REALTIME_DEFAULT_VOICE["google"]


def test_google_realtime_enables_input_and_output_transcription(monkeypatch):
    worker = _load_worker()
    calls = {}

    class FakeRealtimeModel:
        def __init__(self, **kwargs):
            calls.update(kwargs)

    monkeypatch.setattr(worker.google.realtime, "RealtimeModel", FakeRealtimeModel)
    worker.build_realtime("google", "gemini-3.8-live", None, "test-key")

    assert calls["input_audio_transcription"] is not None
    assert calls["output_audio_transcription"] is not None


def test_google_realtime_default_tracks_current_live_model():
    worker = _load_worker()

    assert worker.REALTIME_DEFAULT_MODEL["google"] == "gemini-3.8-live"


def test_realtime_usage_uses_cumulative_session_totals():
    worker = _load_worker()
    totals = worker._RealtimeUsageTotals()
    usage = SimpleNamespace(model_usage=[SimpleNamespace(
        type="llm_usage",
        input_tokens=11,
        output_tokens=7,
        input_audio_tokens=3,
        output_audio_tokens=2,
        input_text_tokens=8,
        output_text_tokens=5,
    )])

    totals.replace_from_session_usage(SimpleNamespace(usage=usage))

    assert (totals.input_tokens, totals.output_tokens) == (11, 7)
    assert (totals.input_audio_tokens, totals.output_audio_tokens) == (3, 2)


def test_worker_default_idle_pool_matches_realtime_sizing():
    worker = _load_worker()

    assert worker.DEFAULT_IDLE_PROCESSES == 2


def test_idle_nudge_closure_declares_metric_counter_nonlocal():
    """Prevent the old UnboundLocalError from returning in a worker image."""
    source_path = Path(__file__).resolve().parents[1] / "voice-agent" / "voice_worker.py"
    tree = ast.parse(source_path.read_text(encoding="utf-8"))
    nudge_functions = [
        node
        for node in ast.walk(tree)
        if isinstance(node, ast.AsyncFunctionDef) and node.name == "_nudge_when_idle"
    ]
    assert len(nudge_functions) == 1
    nonlocal_names = {
        name
        for node in ast.walk(nudge_functions[0])
        if isinstance(node, ast.Nonlocal)
        for name in node.names
    }
    assert {"idle_nudge_count", "nudge_count"}.issubset(nonlocal_names)
