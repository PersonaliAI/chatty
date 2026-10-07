import base64
import json

from voice_agent_cli.media import VoiceMediaBuffer


def test_media_buffer_accepts_and_consumes_bounded_image():
    buffer = VoiceMediaBuffer()
    payload = json.dumps(
        {
            "mime_type": "image/png",
            "data": base64.b64encode(b"png-bytes").decode("ascii"),
        }
    ).encode("utf-8")

    assert buffer.accept_packet(payload) is True
    image = buffer.take_image()
    assert image is not None
    assert image.data == b"png-bytes"
    assert image.mime_type == "image/png"
    assert buffer.take_image() is None

def test_media_buffer_rejects_non_image_and_invalid_payloads():
    buffer = VoiceMediaBuffer()
    assert buffer.accept_packet(b"not-json") is False
    assert buffer.accept_packet(
        json.dumps({"mime_type": "text/plain", "data": "dGV4dA=="})
    ) is False
    assert buffer.take_image() is None
