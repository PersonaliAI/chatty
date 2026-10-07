import sys
from dataclasses import replace

from voice_agent_cli import cli
from voice_agent_cli.config import VoiceSettings


def test_connect_forwards_room_and_identity_to_livekit(monkeypatch):
    captured = {}

    def fake_run_livekit_cli(argv):
        captured["argv"] = argv
        captured["sys_argv"] = list(sys.argv)

    monkeypatch.setattr("voice_agent_cli.runtime.run_livekit_cli", fake_run_livekit_cli)

    assert cli.main(["connect", "--room", "demo-room", "--identity", "visitor-1"]) == 0
    assert captured == {
        "argv": ["connect"],
        "sys_argv": [
            sys.argv[0],
            "connect",
            "--room",
            "demo-room",
            "--participant-identity",
            "visitor-1",
        ],
    }


def test_token_command_mints_a_short_lived_room_jwt(capsys):
    settings = replace(
        VoiceSettings.from_env(env_file=""),
        livekit_url="wss://example.livekit.cloud",
        livekit_api_key="APIkey",
        livekit_api_secret="secret-value",
    )

    assert cli._token(settings, "demo-room", "visitor-1", 60) == 0
    token = capsys.readouterr().out.strip()

    assert token.count(".") == 2
