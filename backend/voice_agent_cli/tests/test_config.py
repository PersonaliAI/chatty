from voice_agent_cli.config import DEFAULT_ORGANIZATION_EMAIL, VoiceSettings


def test_defaults_to_the_fixed_personaliai_account(monkeypatch):
    for name in (
        "CHATTY_ORGANIZATION_EMAIL",
        "CHATTY_BOT_ID",
        "SUPABASE_URL",
        "SUPABASE_SECRET_KEY",
        "LIVEKIT_URL",
        "LIVEKIT_API_KEY",
        "LIVEKIT_API_SECRET",
        "GOOGLE_APPLICATION_CREDENTIALS",
        "GOOGLE_CLOUD_PROJECT",
    ):
        monkeypatch.delenv(name, raising=False)

    settings = VoiceSettings.from_env(env_file="")

    assert settings.organization_email == DEFAULT_ORGANIZATION_EMAIL
    assert settings.llm_model == "gemini-2.5-flash"
    assert settings.stt_model == "chirp_3"
    assert settings.tts_model == "gemini-3.8-flash-tts"
    assert settings.tts_voice == "Kore"
    assert settings.enable_video_input is False


def test_required_values_are_reported_by_name_only(monkeypatch):
    monkeypatch.setenv("CHATTY_ORGANIZATION_EMAIL", "another-account@example.com")
    settings = VoiceSettings.from_env(env_file="")

    missing = settings.missing_for_doctor()

    assert settings.organization_email == DEFAULT_ORGANIZATION_EMAIL
    assert "SUPABASE_SECRET_KEY" in missing
    assert all("=" not in name for name in missing)


def test_adc_validation_checks_shape_without_exposing_values(monkeypatch, tmp_path):
    credentials = tmp_path / "service-account.json"
    credentials.write_text(
        '{"type":"service_account","project_id":"p","client_email":"a@p","private_key":"secret"}',
        encoding="utf-8",
    )
    monkeypatch.setenv("GOOGLE_APPLICATION_CREDENTIALS", str(credentials))

    settings = VoiceSettings.from_env(env_file="")

    assert settings.validate_paths() == []
