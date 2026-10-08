"""Build tenant-scoped LiveKit provider components from Chatty settings.

Provider API keys are decrypted only in the worker process and passed directly
to the official LiveKit plugin constructors. They are never copied into global
environment variables or returned to a client.
"""

from __future__ import annotations

from typing import Any

from app.core.crypto import decrypt_secret
from livekit.agents import inference
from livekit.plugins import google

from .config import VoiceSettings
from .organization import OrganizationContext


def _value(bot: dict[str, Any], key: str, default: str) -> str:
    return str(bot.get(key) or default).strip()


def _secret(bot: dict[str, Any], key: str) -> str | None:
    raw = str(bot.get(key) or "").strip()
    return decrypt_secret(raw) if raw else None


def build_components(
    organization: OrganizationContext, settings: VoiceSettings
) -> tuple[Any, Any, Any]:
    """Return ``(stt, llm, tts)`` using the bot's configured providers.

    Google uses the account's Vertex ADC configuration. Other providers use
    the encrypted BYOK value saved on the bot and are imported lazily so a
    Google-only installation does not need every optional provider package.
    """
    bot = organization.bot
    llm_provider = _value(bot, "voice_llm_provider", "google").lower()
    stt_provider = _value(bot, "voice_stt_provider", "google").lower()
    tts_provider = _value(bot, "voice_tts_provider", "google").lower()

    if llm_provider == "livekit-inference":
        llm = inference.LLM(
            model=_value(bot, "voice_llm_model", "google/gemma-4-31b-it"),
            api_key=settings.livekit_api_key,
            api_secret=settings.livekit_api_secret,
        )
    elif llm_provider == "google":
        llm_kwargs: dict[str, Any] = {
            "model": _value(bot, "voice_llm_model", settings.llm_model),
            "vertexai": True,
            "location": settings.google_cloud_location,
        }
        if settings.google_cloud_project:
            llm_kwargs["project"] = settings.google_cloud_project
        llm = google.LLM(**llm_kwargs)
    elif llm_provider in {"openai", "openrouter", "anthropic"}:
        if llm_provider == "anthropic":
            from livekit.plugins import anthropic  # type: ignore[import-not-found]

            llm = anthropic.LLM(
                model=_value(bot, "voice_llm_model", "claude-3-5-sonnet-latest"),
                api_key=_secret(bot, "voice_llm_byok_key_encrypted"),
            )
        else:
            from livekit.plugins import openai  # type: ignore[import-not-found]

            llm_kwargs = {
                "model": _value(bot, "voice_llm_model", "gpt-4o-mini"),
                "api_key": _secret(bot, "voice_llm_byok_key_encrypted"),
            }
            if llm_provider == "openrouter":
                llm_kwargs["base_url"] = "https://openrouter.ai/api/v1"
                llm_kwargs["_provider_fmt"] = "openai"
            llm = openai.LLM(**llm_kwargs)
    else:
        raise RuntimeError(f"Unsupported voice LLM provider: {llm_provider}")

    if stt_provider == "livekit-inference":
        stt = inference.STT(
            model=_value(bot, "voice_stt_model", "deepgram/nova-3"),
            language=_value(bot, "voice_stt_language", settings.stt_language),
            api_key=settings.livekit_api_key,
            api_secret=settings.livekit_api_secret,
        )
    elif stt_provider == "google":
        stt = google.STT(
            model=_value(bot, "voice_stt_model", settings.stt_model),
            languages=_value(bot, "voice_stt_language", settings.stt_language),
            project=settings.google_cloud_project,
            location=settings.stt_location,
        )
    elif stt_provider == "openai":
        from livekit.plugins import openai  # type: ignore[import-not-found]

        stt = openai.STT(
            model=_value(bot, "voice_stt_model", "gpt-4o-mini-transcribe"),
            language=_value(bot, "voice_stt_language", "en"),
            api_key=_secret(bot, "voice_stt_byok_key_encrypted"),
        )
    elif stt_provider == "deepgram":
        from livekit.plugins import deepgram  # type: ignore[import-not-found]

        stt = deepgram.STT(
            model=_value(bot, "voice_stt_model", "nova-3"),
            language=_value(bot, "voice_stt_language", "en-US"),
            api_key=_secret(bot, "voice_stt_byok_key_encrypted"),
        )
    elif stt_provider == "cartesia":
        from livekit.plugins import cartesia  # type: ignore[import-not-found]

        stt = cartesia.STT(
            model=_value(bot, "voice_stt_model", "ink-2"),
            language=_value(bot, "voice_stt_language", "en"),
            api_key=_secret(bot, "voice_stt_byok_key_encrypted"),
        )
    elif stt_provider == "assemblyai":
        from livekit.plugins import assemblyai  # type: ignore[import-not-found]

        stt = assemblyai.STT(
            model=_value(bot, "voice_stt_model", "universal-3-6-pro"),
            language_code=_value(bot, "voice_stt_language", "en"),
            api_key=_secret(bot, "voice_stt_byok_key_encrypted"),
        )
    elif stt_provider == "soniox":
        from livekit.plugins import soniox  # type: ignore[import-not-found]

        stt = soniox.STT(api_key=_secret(bot, "voice_stt_byok_key_encrypted"))
    else:
        raise RuntimeError(f"Unsupported voice STT provider: {stt_provider}")

    if tts_provider == "livekit-inference":
        tts = inference.TTS(
            model=_value(bot, "voice_tts_model", "cartesia/sonic-3"),
            voice=_value(bot, "voice_tts_voice", ""),
            language=_value(bot, "voice_stt_language", settings.stt_language),
            api_key=settings.livekit_api_key,
            api_secret=settings.livekit_api_secret,
        )
    elif tts_provider == "google":
        tts = google.beta.GeminiTTS(
            model=_value(bot, "voice_tts_model", settings.tts_model),
            voice_name=_value(bot, "voice_tts_voice", settings.tts_voice),
            vertexai=True,
            project=settings.google_cloud_project,
            location=settings.tts_location,
        )
    elif tts_provider == "openai":
        from livekit.plugins import openai  # type: ignore[import-not-found]

        tts = openai.TTS(
            model=_value(bot, "voice_tts_model", "gpt-4o-mini-tts"),
            voice=_value(bot, "voice_tts_voice", "alloy"),
            api_key=_secret(bot, "voice_tts_byok_key_encrypted"),
        )
    elif tts_provider == "cartesia":
        from livekit.plugins import cartesia  # type: ignore[import-not-found]

        tts = cartesia.TTS(
            model=_value(bot, "voice_tts_model", "sonic-3"),
            voice=_value(bot, "voice_tts_voice", "f786b574-daa5-4673-aa0c-cbe3e8534c02"),
            api_key=_secret(bot, "voice_tts_byok_key_encrypted"),
        )
    elif tts_provider == "deepgram":
        from livekit.plugins import deepgram  # type: ignore[import-not-found]

        tts = deepgram.TTS(
            model=_value(bot, "voice_tts_model", "aura-2-thalia-en"),
            api_key=_secret(bot, "voice_tts_byok_key_encrypted"),
        )
    elif tts_provider == "elevenlabs":
        from livekit.plugins import elevenlabs  # type: ignore[import-not-found]

        tts = elevenlabs.TTS(
            model=_value(bot, "voice_tts_model", "eleven_turbo_v2_5"),
            voice_id=_value(bot, "voice_tts_voice", "21m00Tcm4TlvDq8ikWAM"),
            api_key=_secret(bot, "voice_tts_byok_key_encrypted"),
        )
    elif tts_provider == "fishaudio":
        from livekit.plugins import fishaudio  # type: ignore[import-not-found]

        fish_kwargs: dict[str, Any] = {
            "model": _value(bot, "voice_tts_model", "s2.1-pro"),
            "api_key": _secret(bot, "voice_tts_byok_key_encrypted"),
        }
        voice_id = str(bot.get("voice_tts_voice") or "").strip()
        if voice_id:
            fish_kwargs["voice_id"] = voice_id
        tts = fishaudio.TTS(**fish_kwargs)
    else:
        raise RuntimeError(f"Unsupported voice TTS provider: {tts_provider}")

    return stt, llm, tts


def build_realtime_model(
    organization: OrganizationContext,
    settings: VoiceSettings,
    *,
    expression_enabled: bool,
) -> Any:
    """Build a tenant-scoped LiveKit realtime model from the selected plugin.

    Realtime providers are intentionally lazy-imported: a deployment that uses
    Google ADC or LiveKit Inference must not import optional provider SDKs at
    process startup. Provider credentials are read only in this worker.
    """
    bot = organization.bot
    provider = _value(bot, "voice_realtime_provider", "google").lower()
    model = _value(bot, "voice_realtime_model", "")
    voice = _value(bot, "voice_tts_voice", "Puck")
    api_key = _secret(bot, "voice_realtime_byok_key_encrypted")
    language = _value(bot, "voice_stt_language", settings.stt_language)

    if provider == "google":
        realtime_model = model or "gemini-live-2.5-flash-native-audio"
        kwargs: dict[str, Any] = {
            "model": realtime_model,
            "voice": voice,
            "vertexai": True,
            "location": settings.google_cloud_location,
            "enable_affective_dialog": expression_enabled,
        }
        if settings.google_cloud_project:
            kwargs["project"] = settings.google_cloud_project
        return google.realtime.RealtimeModel(**kwargs)

    if provider == "openai":
        from livekit.plugins import openai  # type: ignore[import-not-found]

        return openai.realtime.GPTLiveModel(
            model=model or "gpt-realtime",
            voice=voice or "marin",
            api_key=api_key,
        )

    if provider == "azure":
        from livekit.plugins import azure  # type: ignore[import-not-found]

        return azure.realtime.RealtimeModel(
            model=model or "gpt-realtime",
            voice=voice or "en-US-AvaNeural",
            api_key=api_key,
            input_audio_transcription={"model": "whisper-1", "language": language},
        )

    if provider == "aws":
        from livekit.plugins import aws  # type: ignore[import-not-found]

        # Nova Sonic authenticates through the standard boto credential chain.
        # The dashboard key is retained for the common single-secret contract,
        # while production AWS deployments should use an IAM role or secret
        # manager-backed AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY pair.
        return aws.realtime.RealtimeModel(model=model or "amazon.nova-2-sonic-v1:0", voice=voice or "tiffany")

    if provider == "nvidia":
        from livekit.plugins import nvidia  # type: ignore[import-not-found]

        return nvidia.realtime.RealtimeModel(voice=voice or "NATF2")

    if provider == "phonic":
        from livekit.plugins import phonic  # type: ignore[import-not-found]

        return phonic.realtime.RealtimeModel(
            phonic_model=model or "phonic_v1_1",
            voice=voice or None,
            api_key=api_key,
            default_language=language,
        )

    if provider == "spacexai":
        from livekit.plugins import xai  # type: ignore[import-not-found]

        return xai.realtime.RealtimeModel(model=model or "grok-voice-1", voice=voice or "Ara", api_key=api_key)

    if provider == "ultravox":
        from livekit.plugins import ultravox  # type: ignore[import-not-found]

        return ultravox.RealtimeModel(
            model_id=model or "fixie-ai/ultravox",
            voice=voice or "Mark",
            api_key=api_key,
            language_hint=language,
        )

    raise RuntimeError(f"Unsupported voice realtime provider: {provider}")
