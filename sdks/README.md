# Chatty SDKs

These are official Chatty client SDKs maintained as independent projects:

- `ios` — Swift / SwiftUI
- `android` — Kotlin / Jetpack Compose
- `react-native` — React Native
- `flutter` — Flutter

They are linked as recursive Git submodules for discoverability. Chatty’s
runtime does not build them as backend or frontend dependencies.

```bash
git clone --recurse-submodules https://github.com/PersonaliAI/chatty.git
```

For an existing checkout:

```bash
git submodule update --init --recursive
```

## Voice agent

Each SDK exposes a `createVoiceToken` helper on its Chatty client. The helper
returns a short-lived token for the official LiveKit client SDK; it never
exposes LiveKit API keys or provider BYOK values. The existing embed
component/screen renders the complete Chatty web voice UI, including the
LiveKit visualizer and real-time transcript. See
[`../integrations/voice-agent.md`](../integrations/voice-agent.md) for the
shared contract.
