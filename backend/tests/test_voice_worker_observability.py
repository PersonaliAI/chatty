"""Focused tests for voice-worker runtime metrics and provider safety."""

import importlib.util
import ast
import asyncio
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


def test_selected_provider_failures_are_not_silently_rerouted():
    """A configured provider must fail visibly rather than changing engines."""
    source_path = Path(__file__).resolve().parents[1] / "voice-agent" / "voice_worker.py"
    source = source_path.read_text(encoding="utf-8")

    assert "Unsupported voice_stt_provider" in source
    assert "Unsupported voice_tts_provider" in source
    assert "selected provider setup failed" in source
    assert "_publish_setup_error" in source
    assert "falling back to google" not in source.lower()
    assert "falling back to openai" not in source.lower()


def test_pipeline_brain_failures_publish_recovery_guidance():
    """A brain/provider exception must not leave a connected call silent."""
    source_path = Path(__file__).resolve().parents[1] / "voice-agent" / "voice_worker.py"
    source = source_path.read_text(encoding="utf-8")

    assert '"type": "voice_error"' in source
    assert "assistant turn failed mode=pipeline" in source
    assert "try again or type your message instead" in source
    assert "task_error = task.exception()" in source


def test_elevenlabs_is_a_first_class_pipeline_stt_provider():
    """ElevenLabs Scribe v2 realtime must be selectable without a mode switch."""
    source_path = Path(__file__).resolve().parents[1] / "voice-agent" / "voice_worker.py"
    source = source_path.read_text(encoding="utf-8")

    assert 'if provider == "elevenlabs":' in source
    assert 'model="scribe_v2_realtime"' in source
    assert 'ELEVENLABS_API_KEY' in source
    assert "ElevenLabs STT selected but no BYOK/ElevenLabs API key is configured" in source


def test_selected_tts_provider_errors_are_not_reported_as_success():
    """SpeechHandle background failures must be surfaced to the widget."""
    source_path = Path(__file__).resolve().parents[1] / "voice-agent" / "voice_worker.py"
    source = source_path.read_text(encoding="utf-8")

    assert 'speech_error = None' in source
    assert 'speech_error = exception_fn()' in source
    assert '"type": "voice_error"' in source
    assert "speech provider failed" in source


def test_legacy_elevenlabs_voice_names_are_normalized_to_ids():
    source_path = Path(__file__).resolve().parents[1] / "voice-agent" / "voice_worker.py"
    source = source_path.read_text(encoding="utf-8")

    assert "ELEVENLABS_VOICE_ALIASES" in source
    assert '"rachel": "21m00Tcm4TlvDq8ikWAM"' in source
    assert 'kwargs["voice_id"] = ELEVENLABS_VOICE_ALIASES.get' in source


def test_voice_session_logs_selected_mode_and_providers_without_secrets():
    """Production logs must make pipeline/realtime selection diagnosable."""
    source_path = Path(__file__).resolve().parents[1] / "voice-agent" / "voice_worker.py"
    source = source_path.read_text(encoding="utf-8")

    assert '"voice worker: session configuration mode=%s stt_provider=%s tts_provider=%s "' in source
    assert 'configured_realtime_model = realtime_model if voice_mode == "realtime" else "not-used"' in source
    assert 'configured_realtime_model or "default"' in source
    assert "denoiser is not None" in source
    # The diagnostic line must not interpolate any API key or credential value.
    assert "GEMINI_API_KEY" not in source.split('"voice worker: session configuration', 1)[1].split('realtime_usage', 1)[0]


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


def test_optional_denoise_plugin_is_lazy_loaded():
    """Native audio libraries must not block worker import or test discovery."""
    source_path = Path(__file__).resolve().parents[1] / "voice-agent" / "voice_worker.py"
    source = source_path.read_text(encoding="utf-8")

    assert 'importlib.import_module("livekit.plugins.telephony_denoise")' in source
    assert "from livekit.plugins import telephony_denoise" not in source
    assert "_load_telephony_denoise()" in source


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


def test_typed_voice_input_executes_the_same_speech_handle_path():
    """A composer turn must actually schedule the agent response, not only parse it."""
    worker = _load_worker()

    class FakeTurnClaim:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return False

    class FakeSpeechHandle:
        def __init__(self):
            self.callback = None

        def add_done_callback(self, callback):
            self.callback = callback

        def exception(self):
            return None

    class FakeSession:
        def __init__(self):
            self.handle = FakeSpeechHandle()
            self.interrupted = False
            self.reply_args = None

        def _claim_user_turn(self):
            return FakeTurnClaim()

        async def interrupt(self):
            self.interrupted = True

        def generate_reply(self, **kwargs):
            self.reply_args = kwargs
            return self.handle

    session = FakeSession()
    asyncio.run(worker._handle_text_input(session, SimpleNamespace(text="pricing please")))

    assert session.interrupted is True
    assert session.reply_args == {"user_input": "pricing please", "input_modality": "text"}
    assert session.handle.callback is not None


def test_streamed_voice_reply_does_not_use_unbound_buffer_counter():
    """The token callback must remain safe when a provider streams a turn."""
    source_path = Path(__file__).resolve().parents[1] / "voice-agent" / "voice_worker.py"
    source = source_path.read_text(encoding="utf-8")

    assert "speech_buffer_length" not in source


def test_voice_generation_has_a_hard_response_budget():
    """Voice TTS turns must not stay open behind an unbounded chat answer."""
    source_path = Path(__file__).resolve().parents[1] / "plugins" / "widget_brain.py"
    source = source_path.read_text(encoding="utf-8")
    assert "VOICE_MAX_OUTPUT_TOKENS = 512" in source
    assert source.count("max_tokens=VOICE_MAX_OUTPUT_TOKENS if voice_mode else 4096") == 2


def test_voice_rag_skips_extra_translation_round_trip():
    """Pipeline voice turns should not pay for a duplicate translation LLM call."""
    brain = Path(__file__).resolve().parents[1] / "plugins" / "widget_brain.py"
    worker = Path(__file__).resolve().parents[1] / "voice-agent" / "voice_worker.py"
    brain_source = brain.read_text(encoding="utf-8")
    worker_source = worker.read_text(encoding="utf-8")
    assert "translate_query=not voice_mode" in brain_source
    assert "translate_query=False" in worker_source


def test_streamed_voice_reply_flushes_on_sentences_not_short_clauses():
    """TTS buffering should not turn punctuation inside a sentence into a new burst."""
    source_path = Path(__file__).resolve().parents[1] / "voice-agent" / "voice_worker.py"
    source = source_path.read_text(encoding="utf-8")

    assert "class _SpeechChunker" in source
    assert "_SENTENCE_END = re.compile" in source
    assert "_MIN_SPLIT_CHARS" in source
    assert "[.!?;:]" not in source


def test_speech_chunker_never_splits_words_and_flushes_sentences():
    """Streaming TTS chunks must be complete phrases, not token fragments."""
    worker = _load_worker()
    chunker = worker._SpeechChunker()

    assert chunker.add("The first answer is ready. ") == ["The first answer is ready."]
    long_text = "This is a long sentence without punctuation " * 6
    chunks = chunker.add(long_text)
    tail = chunker.flush()
    assert chunks
    assert tail
    assert all(not chunk.endswith(" ") for chunk in [*chunks, *tail])
    assert all(len(chunk) <= worker._SpeechChunker._MAX_CHARS for chunk in [*chunks, *tail])
    assert " ".join([*chunks, *tail]).replace("  ", " ") == long_text.strip()


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


def test_published_voice_widget_uses_livekit_for_typed_replies_and_recovery():
    """The shipped React package must keep typed input in the active voice turn."""
    source_path = Path(__file__).resolve().parents[2] / "frontend" / "packages" / "chatty-react" / "src" / "voice-call-widget.tsx"
    source = source_path.read_text(encoding="utf-8")

    assert 'topic: "lk.chat"' in source
    assert "echoCancellation: true" in source
    assert "noiseSuppression: true" in source
    assert "autoGainControl: true" in source
    assert 'The voice connection was lost. Reconnect to continue.' in source
    assert "case \"reconnecting\": return \"Reconnecting…\";" in source


def test_interim_user_transcripts_keep_one_id_and_tolerate_missing_timestamps():
    """Interim STT updates must replace one line even with sparse provider events."""
    source_path = Path(__file__).resolve().parents[2] / "backend" / "voice-agent" / "voice_worker.py"
    source = source_path.read_text(encoding="utf-8")

    assert "active_transcript_id: Optional[str] = None" in source
    assert "if active_transcript_id is None:" in source
    assert "raw_created_at = getattr(ev, \"created_at\", None)" in source
    assert "if start_seconds > 100_000_000_000:" in source


def test_visitor_transcripts_use_remote_participant_identity():
    """Published visitor STT must not be attributed to the worker agent."""
    source_path = Path(__file__).resolve().parents[1] / "voice-agent" / "voice_worker.py"
    source = source_path.read_text(encoding="utf-8")

    assert "def _visitor_identity() -> Optional[str]:" in source
    assert "participant_identity=visitor_identity" in source
    assert "participant_identity=ctx.room.local_participant.identity" not in source


def test_voice_widget_offers_recovery_after_unexpected_disconnect():
    """A transport loss must be recoverable without pretending it was a clean hangup."""
    source_path = Path(__file__).resolve().parents[2] / "frontend" / "src" / "components" / "voice-call-widget.tsx"
    source = source_path.read_text(encoding="utf-8")

    assert "roomRef.current === room" in source
    assert "The voice connection was lost. Reconnect to continue." in source
    assert "Reconnect voice" in source
