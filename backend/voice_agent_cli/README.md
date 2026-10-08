# Chatty local voice-agent CLI

This is a local-only LiveKit voice backend for the Chatty account
`personaliai.com@gmail.com`. It is intentionally module-based and reuses the
Chatty backend's existing booking, lead capture, scheduling guardrails, and
knowledge search code.

## Providers

- LiveKit: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
- STT: Google Cloud Speech-to-Text Chirp through ADC, or LiveKit's OpenAI,
  Deepgram, Cartesia, AssemblyAI, and Soniox plugins with bot-scoped BYOK
- TTS: Vertex AI Gemini TTS with LiveKit expressive mode through ADC, or
  LiveKit's OpenAI, Cartesia, Deepgram, ElevenLabs, and Fish Audio plugins
- LLM: Vertex AI Gemini through ADC (`GOOGLE_APPLICATION_CREDENTIALS`), or
  LiveKit's OpenAI-compatible, Anthropic, and OpenRouter plugins with BYOK
- Account and bot: Supabase server credentials plus the fixed organization email

When `LIVEKIT_URL` points to the self-hosted Chatty server, choose direct
provider plugins (Google ADC or a provider with BYOK). LiveKit Inference is a
LiveKit Cloud gateway and is intentionally rejected by the Chatty API for a
self-hosted URL; selecting it would otherwise produce a token that can never
start a worker session. The dashboard exposes the same capability state.

Set `VOICE_VISITOR_TIMEZONE` for a local console session when the client cannot
publish the visitor's timezone; it defaults to UTC and is passed to Chatty's
booking guardrails.

`VOICE_ENABLE_VIDEO_INPUT` is disabled by default. The Google STT/Gemini TTS path is
audio-first; camera tracks are not forwarded to the standard Vertex Gemini
request. For cross-modal catalog lookup, a client may publish one bounded image
payload on the LiveKit data topic `chatty.voice.media`:

```json
{"mime_type":"image/jpeg","data":"<base64 image bytes>"}
```

The image is held in memory for the current voice turn, attached to the Vertex
Gemini `ImageContent`, and available to the next `search_catalog` call; it is
then cleared.

The service-account JSON remains outside this repository. ADC is configured for
the current process only and no credential value is printed by the CLI.

## Local setup

1. Copy `.env.example` to a local env file outside version control and fill in
   the missing values. Set `CHATTY_BOT_ID` when more than one bot belongs to the
   organization; the CLI refuses to guess between multiple bots.
2. Use the local LiveKit Agents workspace to provide the 1.8.x packages:

```powershell
cd D:\Documents\_personaliai\agents-main\agents-main
uv sync --package livekit-example-voice-agents
```

3. Run the CLI from the Chatty backend so `app` and `plugins` resolve:

```powershell
cd D:\Documents\_personaliai\chatty\backend
$env:VOICE_AGENT_ENV_FILE = "D:\path\to\chatty-voice.env"
$python = "D:\Documents\_personaliai\agents-main\agents-main\.venv\Scripts\python.exe"
& $python -m voice_agent_cli doctor
& $python -m voice_agent_cli schema
& $python -m voice_agent_cli account
& $python -m voice_agent_cli list-tools
& $python -m voice_agent_cli console
```

On this workstation, the convenience launcher loads Chatty's current Supabase
Secret Key from Google Secret Manager and the Google ADC service-account JSON
without printing secret values. It explicitly targets Chatty's Supabase project
rather than inheriting the Kin backend's Supabase URL. Because
this account currently owns two bots, select one explicitly for account and
runtime commands:

```powershell
cd D:\Documents\_personaliai\chatty\backend
$env:CHATTY_BOT_ID = "ad32f373-7694-43f4-9465-f8d65ce291e3" # Chatty
.\voice_agent_cli\run-local.ps1 doctor
.\voice_agent_cli\run-local.ps1 schema
.\voice_agent_cli\run-local.ps1 account
.\voice_agent_cli\run-local.ps1 console
.\voice_agent_cli\run-local.ps1 connect -Room "demo-room" -Identity "visitor-1"
.\voice_agent_cli\run-local.ps1 token -Room "demo-room" -Identity "visitor-1"
```

`account` verifies that the fixed email owns the selected bot. The target
Supabase project must already have the Chatty `chatty_bots` and related
migrations applied; this CLI does not migrate or mutate the database. The
read-only schema check currently reports `chatty_flow_connections` as the one
missing optional flow table in this project.

Use `dev` to connect to LiveKit with reload behavior or `start` for the normal
worker command. `console` is the quickest local audio smoke test. `connect`
creates or joins the named room through the official LiveKit Agents CLI.
`token` explicitly prints a short-lived participant JWT for a local client;
handle that output as a credential.

The local Agents workspace includes the Google, OpenAI, Deepgram, Cartesia,
and ElevenLabs plugins. If a bot selects an optional plugin that is not
installed in the active environment, install that official workspace extra
before starting the worker, for example:

```powershell
cd D:\Documents\_personaliai\agents-main\agents-main
uv run --package livekit-example-voice-agents `
  --with livekit-plugins-anthropic `
  --with livekit-plugins-assemblyai `
  --with livekit-plugins-fishaudio `
  --with livekit-plugins-soniox `
  -- python -c "import livekit.plugins.anthropic, livekit.plugins.assemblyai, livekit.plugins.fishaudio, livekit.plugins.soniox"
```

## Current capability boundary

Voice automatically grounds turns with the selected bot's Chatty knowledge
sources and exposes `search_knowledge` to the model. Booking and lead capture
are delegated to the same backend dispatcher used by the text widget, including
its ownership checks and booking guardrails. For voice, calendar event tools
are confirmation-gated: the agent must read the exact date, time, timezone,
visitor name, and email back and call the tool with `confirmed=true` only after
an explicit yes. Lead capture follows the same pattern for the configured
required fields. Existing booking email OTP verification remains enforced by
the shared dispatcher and cannot be bypassed by the voice agent. Human-handoff
and sentiment escalation reuse Chatty's existing session and Slack escalation
services.
Published Chatty flows receive the same `message.user` event and can return an
inline voice reply; Gemini handles the turn when no flow returns a reply.
Text catalog search is available through `search_catalog`. The current Google
STT/Gemini TTS pipeline is audio-first: LiveKit camera tracks are not forwarded into
the non-realtime Vertex Gemini request. Image understanding and image-to-catalog
retrieval are available through the bounded data-channel adapter above; live
camera/video-track understanding remains outside this audio pipeline.

No deployment, commit, or credential file is part of this setup.

## Reference procedures

- LiveKit Agents: https://docs.livekit.io/agents/
- LiveKit Google / Vertex AI: https://docs.livekit.io/agents/integrations/google/
- LiveKit function tools: https://docs.livekit.io/agents/logic/tools/definition/
- Google ADC: https://cloud.google.com/docs/authentication/provide-credentials-adc
