"""Configuration for the local Chatty voice-agent CLI."""

from __future__ import annotations

import os
import json
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


DEFAULT_ORGANIZATION_EMAIL = "personaliai.com@gmail.com"
DEFAULT_LLM_MODEL = "gemini-2.5-flash"
DEFAULT_GCP_LOCATION = "us-central1"


def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def _bool_env(name: str, default: bool = False) -> bool:
    return _env(name, str(default)).lower() in {"1", "true", "yes", "on"}


def _float_env(name: str, default: float) -> float:
    try:
        return float(_env(name, str(default)))
    except ValueError:
        return default


@dataclass(frozen=True, slots=True)
class VoiceSettings:
    """Validated runtime settings without ever logging secret values."""

    organization_email: str
    chatty_bot_id: str
    supabase_url: str
    supabase_secret_key: str
    livekit_url: str
    livekit_api_key: str
    livekit_api_secret: str
    google_application_credentials: str
    google_cloud_project: str
    google_cloud_location: str
    stt_location: str
    tts_location: str
    llm_model: str
    llm_timeout_seconds: float
    stt_model: str
    stt_language: str
    tts_model: str
    tts_voice: str
    agent_name: str
    session_id: str
    visitor_timezone: str
    enable_video_input: bool
    greeting: str

    @classmethod
    def from_env(cls, env_file: str | None = None) -> "VoiceSettings":
        """Load local dotenv settings, then return a typed immutable config."""
        dotenv_path = env_file or _env("VOICE_AGENT_ENV_FILE")
        if dotenv_path:
            load_dotenv(dotenv_path, override=False)
        else:
            load_dotenv(override=False)

        return cls(
            # Deliberately fixed: this local CLI has no universal-account or
            # account-selector path. The only permitted Chatty owner is the
            # personaliai.com Gmail account requested for this tool.
            organization_email=DEFAULT_ORGANIZATION_EMAIL,
            chatty_bot_id=_env("CHATTY_BOT_ID"),
            supabase_url=_env("SUPABASE_URL"),
            supabase_secret_key=_env("SUPABASE_SECRET_KEY"),
            livekit_url=_env("LIVEKIT_URL"),
            livekit_api_key=_env("LIVEKIT_API_KEY"),
            livekit_api_secret=_env("LIVEKIT_API_SECRET"),
            google_application_credentials=_env("GOOGLE_APPLICATION_CREDENTIALS"),
            google_cloud_project=_env("GOOGLE_CLOUD_PROJECT"),
            google_cloud_location=_env("GOOGLE_CLOUD_LOCATION", DEFAULT_GCP_LOCATION),
            # Chirp 3 is served from Google's regional/multi-region Speech
            # endpoints; ``us`` is the supported multi-region for this model.
            stt_location=_env("VOICE_STT_LOCATION", "us"),
            tts_location=_env("VOICE_TTS_LOCATION", "global"),
            llm_model=_env("VOICE_LLM_MODEL", DEFAULT_LLM_MODEL),
            llm_timeout_seconds=_float_env("VOICE_LLM_TIMEOUT_SECONDS", 30.0),
            stt_model=_env("VOICE_STT_MODEL", "chirp_3"),
            stt_language=_env("VOICE_STT_LANGUAGE", "en-US"),
            tts_model=_env("VOICE_TTS_MODEL", "gemini-3.8-flash-tts"),
            tts_voice=_env("VOICE_TTS_VOICE", "Kore"),
            agent_name=_env("LIVEKIT_AGENT_NAME", "chatty-voice-agent"),
            session_id=_env("VOICE_SESSION_ID"),
            visitor_timezone=_env("VOICE_VISITOR_TIMEZONE", "UTC"),
            enable_video_input=_bool_env("VOICE_ENABLE_VIDEO_INPUT"),
            greeting=_env(
                "VOICE_GREETING", "Greet the visitor warmly and ask how you can help."
            ),
        )

    def apply_provider_environment(self) -> None:
        """Set provider SDK environment variables for this local process only."""
        if self.google_application_credentials:
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = (
                self.google_application_credentials
            )
        os.environ.setdefault("GOOGLE_GENAI_USE_VERTEXAI", "true")
        if self.google_cloud_project:
            os.environ.setdefault("GOOGLE_CLOUD_PROJECT", self.google_cloud_project)
        if self.google_cloud_location:
            os.environ.setdefault("GOOGLE_CLOUD_LOCATION", self.google_cloud_location)
        if self.supabase_url:
            os.environ.setdefault("SUPABASE_URL", self.supabase_url)
        if self.supabase_secret_key:
            os.environ.setdefault("SUPABASE_SECRET_KEY", self.supabase_secret_key)
    def missing_for_doctor(self) -> list[str]:
        """Return names needed before connecting to Chatty and LiveKit."""
        required = {
            "SUPABASE_URL": self.supabase_url,
            "SUPABASE_SECRET_KEY": self.supabase_secret_key,
            "LIVEKIT_URL": self.livekit_url,
            "LIVEKIT_API_KEY": self.livekit_api_key,
            "LIVEKIT_API_SECRET": self.livekit_api_secret,
            "GOOGLE_APPLICATION_CREDENTIALS": self.google_application_credentials,
            "GOOGLE_CLOUD_PROJECT": self.google_cloud_project,
        }
        return [name for name, value in required.items() if not value]

    def validate_paths(self) -> list[str]:
        """Return local path errors without exposing any credential contents."""
        if not self.google_application_credentials:
            return []
        path = Path(self.google_application_credentials).expanduser()
        if not path.is_file():
            return [f"GOOGLE_APPLICATION_CREDENTIALS file not found: {path}"]
        try:
            document = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, json.JSONDecodeError):
            return ["GOOGLE_APPLICATION_CREDENTIALS is not valid JSON"]
        if document.get("type") != "service_account":
            return ["GOOGLE_APPLICATION_CREDENTIALS is not a service-account JSON file"]
        required_fields = ("project_id", "client_email", "private_key")
        missing = [field for field in required_fields if not document.get(field)]
        if missing:
            return [
                "GOOGLE_APPLICATION_CREDENTIALS is missing fields: "
                + ", ".join(missing)
            ]
        return []
