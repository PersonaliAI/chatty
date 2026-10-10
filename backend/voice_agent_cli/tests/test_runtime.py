import asyncio
from types import SimpleNamespace

from voice_agent_cli import providers
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


def test_voice_dependency_warmup_is_best_effort(monkeypatch):
    calls = []

    monkeypatch.setattr(
        "voice_agent_cli.bootstrap.warm_voice_dependencies",
        lambda: calls.append(True),
    )
    monkeypatch.setattr(
        "voice_agent_cli.bootstrap.load_chatty_modules",
        lambda _settings: None,
    )

    process = SimpleNamespace(userdata={}, pid=123)
    runtime._setup_job_process(process)

    assert calls == [True]


def test_pipeline_provider_construction_runs_off_event_loop(monkeypatch):
    calls = []

    def fake_build_components(organization, settings):
        calls.append((organization, settings))
        return ("stt", "llm", "tts")

    monkeypatch.setattr(runtime, "build_components", fake_build_components)

    result = asyncio.run(runtime._build_pipeline_components("organization", "settings"))

    assert result == ("stt", "llm", "tts")
    assert calls == [("organization", "settings")]


def test_realtime_provider_construction_runs_off_event_loop(monkeypatch):
    calls = []

    def fake_build_realtime_model(organization, settings, *, expression_enabled):
        calls.append((organization, settings, expression_enabled))
        return "realtime"

    monkeypatch.setattr(runtime, "build_realtime_model", fake_build_realtime_model)

    result = asyncio.run(
        runtime._build_realtime_component(
            "organization", "settings", expression_enabled=False
        )
    )

    assert result == "realtime"
    assert calls == [("organization", "settings", False)]


def test_google_realtime_disables_vertex_affective_dialog(monkeypatch):
    captured = {}

    class FakeRealtimeModel:
        def __init__(self, **kwargs):
            captured.update(kwargs)

    monkeypatch.setattr(providers.google.realtime, "RealtimeModel", FakeRealtimeModel)
    organization = SimpleNamespace(
        bot={
            "voice_realtime_provider": "google",
            "voice_realtime_model": "gemini-live-2.5-flash-native-audio",
            "voice_tts_voice": "Kore",
            "voice_stt_language": "en-US",
        }
    )
    settings = SimpleNamespace(
        google_cloud_location="global",
        google_cloud_project="project",
        stt_language="en-US",
    )

    providers.build_realtime_model(organization, settings, expression_enabled=True)

    assert captured["enable_affective_dialog"] is False


def test_google_realtime_receives_warmed_adc_credentials(monkeypatch):
    captured = {}
    credentials = object()

    class FakeRealtimeModel:
        def __init__(self, **kwargs):
            captured.update(kwargs)

    monkeypatch.setattr(providers.google.realtime, "RealtimeModel", FakeRealtimeModel)
    monkeypatch.setattr(providers, "_load_google_credentials", lambda _settings: credentials)
    organization = SimpleNamespace(
        bot={
            "voice_realtime_provider": "google",
            "voice_realtime_model": "gemini-live-2.5-flash-native-audio",
            "voice_tts_voice": "Kore",
            "voice_stt_language": "en-US",
        }
    )
    settings = SimpleNamespace(
        google_cloud_location="global",
        google_cloud_project="project",
        stt_language="en-US",
    )

    providers.build_realtime_model(organization, settings, expression_enabled=True)

    assert captured["credentials"] is credentials


def test_all_configured_realtime_plugins_receive_official_constructor_arguments(monkeypatch):
    """Keep the dashboard's realtime provider catalog aligned with SDK APIs."""
    captured = {}

    class FakeRealtimeModel:
        def __init__(self, **kwargs):
            captured.clear()
            captured.update(kwargs)

    class FakePlugin:
        realtime = SimpleNamespace(
            GPTLiveModel=FakeRealtimeModel,
            RealtimeModel=FakeRealtimeModel,
        )
        RealtimeModel = FakeRealtimeModel

    monkeypatch.setattr(providers, "_import_realtime_plugin", lambda _provider: FakePlugin)
    monkeypatch.setattr(providers, "_azure_transcription_options", lambda language: {
        "model": "whisper-1",
        "language": language,
    })

    settings = SimpleNamespace(
        google_cloud_location="global",
        google_cloud_project="project",
        stt_language="en-US",
    )
    expected = {
        "openai": {"model": "gpt-live-1", "voice": "marin", "api_key": None},
        "azure": {
            "model": "gpt-realtime",
            "voice": "en-US-AvaNeural",
            "api_key": None,
            "input_audio_transcription": {"model": "whisper-1", "language": "en-US"},
        },
        "aws": {"model": "amazon.nova-2-sonic-v1:0", "voice": "tiffany"},
        "nvidia": {"voice": "NATF2"},
        "phonic": {
            "phonic_model": "phonic_v1_1",
            "voice": None,
            "api_key": None,
            "default_language": "en-US",
        },
        "spacexai": {"model": "grok-voice-latest", "voice": "Ara", "api_key": None},
        "ultravox": {
            "model": "fixie-ai/ultravox",
            "voice": "Mark",
            "api_key": None,
            "language_hint": "en-US",
        },
    }

    for provider, provider_expected in expected.items():
        organization = SimpleNamespace(bot={"voice_realtime_provider": provider})
        providers.build_realtime_model(organization, settings, expression_enabled=True)
        assert captured == provider_expected, provider


def test_runtime_normalizes_max_duration_minutes():
    assert runtime._resolve_max_duration_minutes(None) == 15
    assert runtime._resolve_max_duration_minutes("30") == 30
    assert runtime._resolve_max_duration_minutes(0) == 1
    assert runtime._resolve_max_duration_minutes(120) == 60
    assert runtime._resolve_max_duration_minutes("invalid") == 15


def test_runtime_closes_session_when_max_duration_is_reached(monkeypatch):
    class FakeSession:
        def __init__(self):
            self.closed = False

        async def aclose(self):
            self.closed = True

    class FakeRoom:
        def __init__(self):
            self.disconnected = False

        async def disconnect(self):
            self.disconnected = True

    async def instant_sleep(_seconds):
        return None

    monkeypatch.setattr(runtime.asyncio, "sleep", instant_sleep)
    session = FakeSession()
    room = FakeRoom()

    asyncio.run(runtime._close_session_after_timeout(session, room, 1))

    assert session.closed is True
    assert room.disconnected is True
