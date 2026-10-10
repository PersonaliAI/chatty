"""Voice Agent management and embed service for Chatty MCP tools.

Provides configuration, status verification, and multi-framework embed code
generation for Chatty's LiveKit-backed voice agent integration.
"""

from __future__ import annotations

import os
from typing import Any, Optional
from fastapi import HTTPException

from app.core import oauth as _oauth
from app.core.clients import supabase
from app.core.crypto import encrypt_secret
from app.core.db import run_db
from app.routers.voice import (
    _CONFIG_FIELDS,
    _public_voice_config,
    _voice_configuration_error,
    _livekit_inference_available,
)


async def get_voice_agent_config(principal: dict[str, Any], bot_id: str) -> dict[str, Any]:
    """Retrieve the active voice agent configuration for a bot."""
    await _oauth.require_bot_access(principal, bot_id)
    result = await run_db(
        lambda: supabase.table("chatty_bots")
        .select(_CONFIG_FIELDS)
        .eq("id", bot_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Bot not found")
    row = result.data[0]
    return _public_voice_config(row) | {
        "bot_id": bot_id,
        "realtime_key_configured": bool(row.get("voice_realtime_byok_key_encrypted")),
        "llm_key_configured": bool(row.get("voice_llm_byok_key_encrypted")),
        "stt_key_configured": bool(row.get("voice_stt_byok_key_encrypted")),
        "tts_key_configured": bool(row.get("voice_tts_byok_key_encrypted")),
        "livekit_url": os.environ.get("LIVEKIT_URL", "").strip(),
        "livekit_inference_available": _livekit_inference_available(),
    }


async def configure_voice_agent(
    principal: dict[str, Any],
    bot_id: str,
    enabled: Optional[bool] = None,
    mode: Optional[str] = None,
    welcome_message: Optional[str] = None,
    visualizer: Optional[str] = None,
    expression_enabled: Optional[bool] = None,
    agent_name: Optional[str] = None,
    realtime_provider: Optional[str] = None,
    realtime_model: Optional[str] = None,
    realtime_api_key: Optional[str] = None,
    llm_provider: Optional[str] = None,
    llm_model: Optional[str] = None,
    llm_api_key: Optional[str] = None,
    stt_provider: Optional[str] = None,
    stt_model: Optional[str] = None,
    stt_language: Optional[str] = None,
    stt_api_key: Optional[str] = None,
    tts_provider: Optional[str] = None,
    tts_model: Optional[str] = None,
    tts_voice: Optional[str] = None,
    tts_api_key: Optional[str] = None,
    max_duration_minutes: Optional[int] = None,
) -> dict[str, Any]:
    """Update voice agent settings, BYOK keys, and visualizer for a bot."""
    await _oauth.require_bot_access(principal, bot_id)

    current_result = await run_db(
        lambda: supabase.table("chatty_bots")
        .select(_CONFIG_FIELDS)
        .eq("id", bot_id)
        .limit(1)
        .execute()
    )
    if not current_result.data:
        raise HTTPException(status_code=404, detail="Bot not found")
    current = dict(current_result.data[0])

    updates: dict[str, Any] = {}
    field_map = {
        "welcome_message": (welcome_message, "welcome_message"),
        "enabled": (enabled, "voice_enabled"),
        "mode": (mode, "voice_mode"),
        "expression_enabled": (expression_enabled, "voice_expression_enabled"),
        "visualizer": (visualizer, "voice_visualizer"),
        "agent_name": (agent_name, "voice_agent_name"),
        "realtime_provider": (realtime_provider, "voice_realtime_provider"),
        "realtime_model": (realtime_model, "voice_realtime_model"),
        "llm_provider": (llm_provider, "voice_llm_provider"),
        "llm_model": (llm_model, "voice_llm_model"),
        "stt_provider": (stt_provider, "voice_stt_provider"),
        "stt_model": (stt_model, "voice_stt_model"),
        "stt_language": (stt_language, "voice_stt_language"),
        "tts_provider": (tts_provider, "voice_tts_provider"),
        "tts_model": (tts_model, "voice_tts_model"),
        "tts_voice": (tts_voice, "voice_tts_voice"),
        "max_duration_minutes": (max_duration_minutes, "voice_max_duration_minutes"),
    }

    for _, (val, col) in field_map.items():
        if val is not None:
            updates[col] = val.strip() if isinstance(val, str) else val

    # Encrypted BYOK keys
    key_map = {
        "realtime_api_key": (realtime_api_key, "voice_realtime_byok_key_encrypted"),
        "llm_api_key": (llm_api_key, "voice_llm_byok_key_encrypted"),
        "stt_api_key": (stt_api_key, "voice_stt_byok_key_encrypted"),
        "tts_api_key": (tts_api_key, "voice_tts_byok_key_encrypted"),
    }
    for _, (key_val, col) in key_map.items():
        if key_val is not None:
            updates[col] = encrypt_secret(key_val.strip()) if key_val.strip() else None

    if not updates:
        raise HTTPException(status_code=400, detail="No voice settings provided to update")

    effective = current | updates
    error = _voice_configuration_error(effective)
    if error:
        raise HTTPException(status_code=422, detail=error)

    result = await run_db(
        lambda: supabase.table("chatty_bots")
        .update(updates)
        .eq("id", bot_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to save voice configuration")
    row = result.data[0]
    return _public_voice_config(row) | {
        "bot_id": bot_id,
        "realtime_key_configured": bool(row.get("voice_realtime_byok_key_encrypted")),
        "llm_key_configured": bool(row.get("voice_llm_byok_key_encrypted")),
        "stt_key_configured": bool(row.get("voice_stt_byok_key_encrypted")),
        "tts_key_configured": bool(row.get("voice_tts_byok_key_encrypted")),
        "livekit_url": os.environ.get("LIVEKIT_URL", "").strip(),
        "livekit_inference_available": _livekit_inference_available(),
        "status": "updated",
    }


async def generate_voice_embed_code(
    principal: dict[str, Any],
    bot_id: str,
    framework: str = "html_script",
    display: str = "modal",
) -> dict[str, Any]:
    """Generate voice embed snippets across web, React, and mobile SDKs."""
    await _oauth.require_bot_access(principal, bot_id)
    fw = framework.lower().strip()
    disp = "drawer" if display.lower() == "drawer" else "modal"

    if "react" in fw or "next" in fw:
        snippet = f"""// React / Next.js with @personaliai/react-widget
import {{ ChattyWidget, VoiceAgent }} from "@personaliai/react-widget";

// Option A: Floating launcher button that opens the Voice Agent {disp}
export function VoiceLauncher() {{
  return (
    <ChattyWidget
      botId="{bot_id}"
      mode="voice"
      display="{disp}"
    />
  );
}}

// Option B: Standalone embedded voice UI (full audio visualizer & live transcription)
export function EmbeddedVoice() {{
  return (
    <VoiceAgent
      botId="{bot_id}"
      className="max-w-md mx-auto h-[540px] rounded-2xl shadow-xl"
    />
  );
}}"""
    elif "iframe" in fw or "embed" in fw:
        snippet = f"""<!-- Standalone Chatty Voice Agent Iframe -->
<iframe
  src="https://chatty.personaliai.com/embed/{bot_id}?voice=only"
  allow="microphone; camera"
  width="100%"
  height="600"
  style="border: none; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.1);"
></iframe>"""
    elif "ios" in fw or "swift" in fw:
        snippet = f"""// Swift / iOS - ChattySDK (github.com/PersonaliAI/chatty-ios-sdk)
import SwiftUI
import ChattySDK

struct VoiceAgentScreen: View {{
    var body: some View {{
        ChattyVoiceView(botId: "{bot_id}")
            .edgesIgnoringSafeArea(.all)
    }}
}}"""
    elif "android" in fw or "kotlin" in fw:
        snippet = f"""// Kotlin / Android - Jetpack Compose (github.com/PersonaliAI/chatty-android-sdk)
import androidx.compose.runtime.Composable
import com.personaliai.chatty.ChattyVoiceScreen

@Composable
fun VoiceAgentScreen() {{
    ChattyVoiceScreen(botId = "{bot_id}")
}}"""
    elif "flutter" in fw or "dart" in fw:
        snippet = f"""// Flutter (package:chatty_flutter)
import 'package:flutter/material.dart';
import 'package:chatty_flutter/chatty_flutter.dart';

class VoiceAgentScreen extends StatelessWidget {{
  @override
  Widget build(BuildContext context) {{
    return Scaffold(
      body: SafeArea(
        child: ChattyVoiceScreen(botId: '{bot_id}'),
      ),
    );
  }}
}}"""
    elif "react-native" in fw or "rn" in fw:
        snippet = f"""// React Native (@personaliai/chatty-react-native)
import React from 'react';
import {{ View, StyleSheet }} from 'react-native';
import {{ ChattyVoiceView }} from '@personaliai/chatty-react-native';

export function VoiceAgentScreen() {{
  return (
    <View style={{styles.container}}>
      <ChattyVoiceView botId="{bot_id}" />
    </View>
  );
}}

const styles = StyleSheet.create({{
  container: {{ flex: 1 }},
}});"""
    else:
        # Default: html_script
        snippet = f"""<!-- Chatty Voice Agent Script Embed -->
<!-- Put before </body> -->
<script
  src="https://chatty.personaliai.com/widget.js"
  data-id="{bot_id}"
  data-mode="voice"
  data-display="{disp}"
  defer
></script>

<!-- Programmatic trigger: window.Chatty.openVoice() -->"""

    return {
        "bot_id": bot_id,
        "framework": framework,
        "display": disp,
        "code_snippet": snippet,
        "direct_embed_url": f"https://chatty.personaliai.com/embed/{bot_id}?voice=only",
        "script_url": "https://chatty.personaliai.com/widget.js",
    }
