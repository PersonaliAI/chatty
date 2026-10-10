# Chatty Client SDKs

Official Chatty client SDKs for embedding text chatbots and real-time LiveKit Voice Agents across mobile, desktop, and web applications.

| SDK | Platform / Language | Voice Agent UI Component | Token Helper |
| :--- | :--- | :--- | :--- |
| **`ios`** | iOS / Swift / SwiftUI | `ChattyVoiceView(botId: "...")` | `ChattyClient.createVoiceToken(...)` |
| **`android`** | Android / Kotlin / Jetpack Compose | `ChattyVoiceScreen(botId = "...")` | `ChattyApi.createVoiceToken(...)` |
| **`react-native`** | iOS & Android / TypeScript | `<ChattyVoiceView botId="..." />` | `ChattyClient.createVoiceToken(...)` |
| **`flutter`** | iOS, Android, Web / Dart | `ChattyVoiceScreen(botId: '...')` | `ChattyClient.createVoiceToken(...)` |
| **`@personaliai/react-widget`** | React / Next.js / Web | `<VoiceAgent botId="..." />` / `<ChattyWidget mode="voice" />` | Built-in LiveKit Session Manager |
| **`widget.js`** | Vanilla HTML / JavaScript | `<script data-mode="voice" data-display="modal">` | `window.Chatty.openVoice()` |

---

## Repository Submodules

These SDKs are maintained as independent open-source packages and linked as Git submodules for repository discoverability:

```bash
git clone --recurse-submodules https://github.com/PersonaliAI/chatty.git
```

For an existing checkout:

```bash
git submodule update --init --recursive
```

---

## Voice Agent Integration

Every Chatty SDK provides two integration paths for voice:

### Option 1: Drop-In Voice Agent UI (Recommended)

Each SDK provides a pre-built, production-ready Voice Agent component that embeds the official Chatty voice surface (featuring real-time WebRTC audio, reactive waveform visualizers, live speech transcription cards, session reset, and interactive meeting booking):

#### iOS (SwiftUI)

```swift
import SwiftUI
import ChattySDK

struct SupportScreen: View {
    var body: some View {
        ChattyVoiceView(botId: "YOUR_BOT_UUID")
            .edgesIgnoringSafeArea(.all)
    }
}
```

#### Android (Jetpack Compose)

```kotlin
import androidx.compose.runtime.Composable
import com.personaliai.chatty.ChattyVoiceScreen

@Composable
fun SupportScreen() {
    ChattyVoiceScreen(botId = "YOUR_BOT_UUID")
}
```

#### Flutter

```dart
import 'package:flutter/material.dart';
import 'package:chatty_flutter/chatty_flutter.dart';

class SupportScreen extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: ChattyVoiceScreen(botId: 'YOUR_BOT_UUID'),
      ),
    );
  }
}
```

#### React Native

```tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ChattyVoiceView } from '@personaliai/chatty-react-native';

export function SupportScreen() {
  return (
    <View style={styles.container}>
      <ChattyVoiceView botId="YOUR_BOT_UUID" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
```

---

### Option 2: Custom LiveKit Client with `createVoiceToken`

If you are building your own fully custom native LiveKit audio interface, use the client's `createVoiceToken` helper:

```ts
// Example: React Native / TypeScript
const tokenData = await chattyClient.createVoiceToken({
  botId: "YOUR_BOT_UUID",
  sessionId: "visitor-session-123",
  roomNonce: "nonce-xyz", // optional fresh nonce for reconnects
  visitorTimezone: "America/New_York",
});

// Use tokenData.token and tokenData.url with the official LiveKit SDK
await room.connect(tokenData.url, tokenData.token);
```

### Security & Privacy Contract

- **Zero Secret Leakage**: The token endpoint returns a single, tenant-scoped, time-limited participant JWT. It **never** returns LiveKit API secrets or model provider BYOK keys.
- **Session Isolation**: Each voice conversation generates a dedicated LiveKit room nonce. Memory reset endpoints (`POST /api/widget/voice/reset`) purge conversation database history without leaking tenant data.
