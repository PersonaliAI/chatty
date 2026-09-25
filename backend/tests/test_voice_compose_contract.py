"""Static contract checks for the deployable voice-worker Compose stack."""

from pathlib import Path


COMPOSE = Path(__file__).resolve().parents[1] / "voice-agent" / "docker-compose.yml"


def test_voice_healthcheck_uses_configured_port():
    text = COMPOSE.read_text(encoding="utf-8")

    assert "os.environ.get('PORT', '8081')" in text
    assert "127.0.0.1:8081/" not in text


def test_voice_worker_healthcheck_stays_inside_worker_container():
    text = COMPOSE.read_text(encoding="utf-8")

    assert "urllib.request.urlopen" in text
    assert "127.0.0.1:" in text
    assert "healthcheck:" in text
