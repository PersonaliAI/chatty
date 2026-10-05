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
    worker.build_realtime("google", worker.REALTIME_DEFAULT_MODEL["google"], None, "test-key")

    assert calls["input_audio_transcription"] is not None
    assert calls["output_audio_transcription"] is not None


def test_google_realtime_default_tracks_current_live_model():
    worker = _load_worker()

    assert worker.REALTIME_DEFAULT_MODEL["google"] in worker.GOOGLE_REALTIME_MODELS


def test_google_realtime_replaces_unsupported_saved_model(monkeypatch):
    worker = _load_worker()
    calls = {}

    class FakeRealtimeModel:
        def __init__(self, **kwargs):
            calls.update(kwargs)

    monkeypatch.setattr(worker.google.realtime, "RealtimeModel", FakeRealtimeModel)
    worker.build_realtime("google", "gemini-3.8-live", None, "test-key")

    assert calls["model"] == worker.REALTIME_DEFAULT_MODEL["google"]


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

    assert worker.DEFAULT_IDLE_PROCESSES == 1


def test_worker_defaults_to_native_vad_with_plugin_fallback():
    """Native LiveKit VAD avoids ONNX thread contention on the VPS."""
    source_path = Path(__file__).resolve().parents[1] / "voice-agent" / "voice_worker.py"
    source = source_path.read_text(encoding="utf-8")

    assert 'os.environ.get("VOICE_VAD_BACKEND", "native")' in source
    assert "inference.VAD(" in source
    assert "silero.VAD.load(" in source


def test_assistant_transcript_is_synchronized_with_tts_audio():
    """Prevent assistant text from being rendered ahead of its spoken audio."""
    source_path = Path(__file__).resolve().parents[1] / "voice-agent" / "voice_worker.py"
    source = source_path.read_text(encoding="utf-8")

    assert "TextOutputOptions(sync_transcription=True)" in source
    assert "TextOutputOptions(sync_transcription=False)" not in source


def test_pipeline_accepts_typed_voice_input():
    """Typed turns must enter the same AgentSession context as speech."""
    source_path = Path(__file__).resolve().parents[1] / "voice-agent" / "voice_worker.py"
    source = source_path.read_text(encoding="utf-8")

    assert "TextInputOptions(text_input_cb=_handle_text_input)" in source
    assert "sess.generate_reply(user_input=text, input_modality=\"text\")" in source


def test_pipeline_mode_fails_closed_instead_of_switching_to_realtime():
    """A missing pipeline credential must not change the selected product mode."""
    source_path = Path(__file__).resolve().parents[1] / "voice-agent" / "voice_worker.py"
    source = source_path.read_text(encoding="utf-8")

    assert "Google pipeline selected but GOOGLE_APPLICATION_CREDENTIALS" in source
    assert "refusing to fall back to realtime" in source
    assert "if voice_mode == \"realtime\":" in source


def test_typed_voice_input_has_failure_observability():
    """Typed composer failures must be visible instead of silently dropping."""
    source_path = Path(__file__).resolve().parents[1] / "voice-agent" / "voice_worker.py"
    source = source_path.read_text(encoding="utf-8")

    assert '"voice worker: typed input accepted chars=%d elapsed_ms=%d"' in source
    assert '"voice worker: typed input failed chars=%d"' in source
    assert "speech_handle.add_done_callback(_log_typed_reply)" in source
    assert '"voice worker: typed reply failed chars=%d error=%s"' in source
    assert "VOICE_DENOISE_ENABLED" in source
    assert "telephony_denoise.EchoReferenceTap" in source
    assert "audio_input=audio_input" in source


def test_typed_voice_input_claims_turn_and_requests_text_reply():
    """The composer callback must interrupt and schedule a text-modality turn."""
    source_path = Path(__file__).resolve().parents[1] / "voice-agent" / "voice_worker.py"
    tree = ast.parse(source_path.read_text(encoding="utf-8"))
    callback = next(
        node for node in ast.walk(tree)
        if isinstance(node, ast.AsyncFunctionDef) and node.name == "_handle_text_input"
    )
    calls = [
        node for node in ast.walk(callback)
        if isinstance(node, ast.Call)
    ]
    assert any(isinstance(call.func, ast.Attribute) and call.func.attr == "interrupt" for call in calls)
    assert any(
        isinstance(call.func, ast.Attribute)
        and call.func.attr == "generate_reply"
        and any(keyword.arg == "input_modality" for keyword in call.keywords)
        for call in calls
    )


def test_streamed_voice_reply_does_not_use_unbound_buffer_counter():
    """The token callback must remain safe when a provider streams a turn."""
    source_path = Path(__file__).resolve().parents[1] / "voice-agent" / "voice_worker.py"
    source = source_path.read_text(encoding="utf-8")

    assert "speech_buffer_length" not in source


def test_pipeline_google_tts_uses_chirp_default_not_gemini_flash():
    """Pipeline TTS must not silently consume the Gemini Flash TTS quota."""
    source_path = Path(__file__).resolve().parents[1] / "voice-agent" / "voice_worker.py"
    source = source_path.read_text(encoding="utf-8")

    assert '"model_name": "chirp_3"' in source
    assert '"en-US-Chirp3-HD-Charon"' in source


def test_idle_nudges_are_removed():
    """Silence must stay quiet instead of producing scripted follow-ups."""
    source_path = Path(__file__).resolve().parents[1] / "voice-agent" / "voice_worker.py"
    source = source_path.read_text(encoding="utf-8")

    assert "_nudge_when_idle" not in source
    assert "are you still there" not in source.lower()


def test_browser_voice_capture_requests_echo_noise_and_gain_processing():
    """The embedded widget must request the browser's audio safety baseline."""
    source_path = Path(__file__).resolve().parents[2] / "frontend" / "src" / "components" / "voice-call-widget.tsx"
    source = source_path.read_text(encoding="utf-8")

    assert "echoCancellation: true" in source
    assert "noiseSuppression: true" in source
    assert "autoGainControl: true" in source
