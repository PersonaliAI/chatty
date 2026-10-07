# Self-hosted LiveKit

The VPS deployment uses the official LiveKit server binary with Caddy providing
ACME TLS for `livekit.personaliai.com`. The API key and secret are generated on
the VPS and stored in `/etc/livekit/credentials.env` with mode `0600`; they are
never stored in this repository.

The Chatty worker uses the official LiveKit Agents Python packages from
`requirements-deploy.txt` and is managed by `chatty-voice-agent.service`. Its
runtime environment belongs in `/etc/chatty/voice-agent.env` with mode `0600`;
the Google service-account JSON belongs in `/etc/chatty/personaliai-sa.json`
with mode `0600`. Neither file is part of the repository.

Required public firewall ports:

- TCP 80 and 443 for ACME and secure WebSocket signaling
- TCP 7881 for ICE/TCP fallback
- UDP 50000-60000 for WebRTC media
