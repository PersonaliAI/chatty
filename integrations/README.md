# Optional integrations

This directory contains integrations that are released separately from the
Chatty application. They are linked as Git submodules so their histories,
release cycles, and build systems remain independent.

## WordPress

`wordpress/chatty-wordpress-plugin` links the official open-source Chatty
WordPress plugin.

Clone it with submodules enabled:

```bash
git clone --recurse-submodules https://github.com/PersonaliAI/chatty.git
```

For an existing checkout:

```bash
git submodule update --init --recursive
```

The standalone `ai-voice-agents` project and the iOS, Android, React Native,
and Flutter SDKs are intentionally not vendored here. They remain separate
projects and are integrated through their documented APIs/packages.
