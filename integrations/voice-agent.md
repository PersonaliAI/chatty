# Chatty LiveKit voice agent

Chatty voice uses the self-hosted LiveKit server at `wss://livekit.personaliai.com`.
Clients never receive LiveKit API keys or secrets. They request a short-lived
participant token from Chatty and then connect with an official LiveKit client.

## Browser and embedded widget

The dashboard's Voice agent tab enables the bot and configures the provider
pipeline. The widget exposes two controls when voice is enabled: a wave button
in the header and a wave button beside the microphone in the composer.

The panel uses LiveKit's official React components (`SessionProvider`,
`VoiceAssistantControlBar`, `BarVisualizer`, `RoomAudioRenderer`, and the
session message stream) for microphone state, audio playback, visualisation,
and real-time transcription.

## Token contract

```http
POST /api/widget/voice/token
Content-Type: application/json

{
  "bot_id": "YOUR_BOT_ID",
  "session_id": "chatty-session-id",
  "room_nonce": "fresh-connection-attempt-id",
  "participant_name": "Visitor",
  "visitor_timezone": "Asia/Colombo"
}
```

`room_nonce` is optional for backwards compatibility, but clients should send
a fresh opaque value for every connection or reconnect attempt. Chatty keeps
the same `session_id` for conversation history while using the nonce to avoid
rejoining a stale LiveKit room or participant thread.

`visitor_timezone` is an optional IANA timezone identifier. The browser and
SDKs should send the visitor's actual timezone so Chatty's existing booking
guardrails can present and validate slots in the visitor's local time. It is
not used for authentication or tenant selection.

Response:

```json
{
  "serverUrl": "wss://livekit.personaliai.com",
  "participantToken": "short-lived-jwt",
  "roomName": "chatty-YOUR_BOT_ID-chatty-session-id",
  "participantName": "Visitor"
}
```

Only pass `participantToken` to the LiveKit client. Never expose
`LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, Supabase credentials, provider keys,
or service-account JSON in an SDK or browser bundle.

## Provider and BYOK model

The dashboard stores provider keys encrypted at rest. The worker decrypts a
key only for the active session and passes it to the matching official LiveKit
plugin. Supported pipeline choices include Google Vertex/ADC, LiveKit
Inference, OpenAI, Anthropic, OpenRouter, Deepgram, Cartesia, AssemblyAI,
Soniox, ElevenLabs, and Fish Audio where the selected LiveKit plugin supports
the requested modality. Google uses the supplied Vertex ADC service account;
other providers require a bot-scoped BYOK key.

## Native SDKs

The iOS, Android, Flutter, and React Native SDKs expose the same token contract
through `createVoiceToken`. Hosts can connect with the corresponding official
LiveKit client SDK and render native controls, or use the SDK's existing
`ChattyEmbedScreen`/WebView path to get the complete official LiveKit widget UI.

## Local verification

```powershell
cd D:\Documents\_personaliai\chatty\backend
$env:CHATTY_BOT_ID = "YOUR_BOT_ID"
.\voice_agent_cli\run-local.ps1 doctor
.\voice_agent_cli\run-local.ps1 console
```

The Chatty HTTP backend must be running with the voice migration applied and
the LiveKit settings configured. The worker must use the same agent name as
the backend's `LIVEKIT_AGENT_NAME` setting.
