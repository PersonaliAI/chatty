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
