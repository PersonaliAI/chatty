from __future__ import annotations

import math
from typing import Any, Optional
from fastapi import HTTPException

from app.core import oauth as _oauth


def _hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    hex_color = hex_color.lstrip("#")
    if len(hex_color) == 3:
        hex_color = "".join([c * 2 for c in hex_color])
    if len(hex_color) != 6:
        return (249, 115, 22)  # default #f97316
    try:
        return (int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16))
    except ValueError:
        return (249, 115, 22)


def _relative_luminance(rgb: tuple[int, int, int]) -> float:
    def _channel_lum(c: int) -> float:
        s = c / 255.0
        return s / 12.92 if s <= 0.03928 else math.pow((s + 0.055) / 1.055, 2.4)
    r, g, b = rgb
    return 0.2126 * _channel_lum(r) + 0.7152 * _channel_lum(g) + 0.0722 * _channel_lum(b)


def calculate_contrast_ratio(hex1: str, hex2: str) -> float:
    lum1 = _relative_luminance(_hex_to_rgb(hex1))
    lum2 = _relative_luminance(_hex_to_rgb(hex2))
    lighter = max(lum1, lum2)
    darker = min(lum1, lum2)
    return round((lighter + 0.05) / (darker + 0.05), 2)


async def analyze_widget_design(principal: dict[str, Any], bot_id: str) -> dict[str, Any]:
    bot = await _oauth.require_bot_access(principal, bot_id)
    primary_color = bot.get("primary_color") or "#f97316"
    welcome_msg = bot.get("welcome_message") or "Hello! How can I help you today?"
    teaser_msg = bot.get("teaser_text") or bot.get("teaser_message") or ""
    mobile_fullscreen = bot.get("mobile_fullscreen", True)

    # 1. WCAG 2.1 Contrast Calculations
    white_contrast = calculate_contrast_ratio(primary_color, "#ffffff")
    dark_contrast = calculate_contrast_ratio(primary_color, "#0f172a")

    wcag_white_level = "AAA" if white_contrast >= 7.0 else ("AA" if white_contrast >= 4.5 else "AA Large" if white_contrast >= 3.0 else "Fail")
    wcag_dark_level = "AAA" if dark_contrast >= 7.0 else ("AA" if dark_contrast >= 4.5 else "AA Large" if dark_contrast >= 3.0 else "Fail")

    # 2. Readability & Microcopy Evaluation
    words = welcome_msg.split()
    word_count = len(words)
    readability = "Concise & Fast" if word_count <= 18 else ("Moderate" if word_count <= 35 else "Verbose (consider shortening for mobile)")

    recommendations: list[str] = []
    if white_contrast < 4.5:
        recommendations.append(f"Primary accent '{primary_color}' has a low contrast ratio ({white_contrast}:1) with white text. Consider a slightly darker shade for WCAG AA compliance.")
    else:
        recommendations.append(f"Primary accent '{primary_color}' passes WCAG compliance ({white_contrast}:1 with white text).")

    if word_count > 25:
        recommendations.append(f"Welcome message is {word_count} words long. Shortening to under 15 words improves initial visitor engagement.")

    if not mobile_fullscreen:
        recommendations.append("Mobile fullscreen is currently disabled. Enabling it provides a cleaner UX on small screens.")

    return {
        "bot_id": bot_id,
        "primary_color": primary_color,
        "wcag_contrast": {
            "white_text_ratio": f"{white_contrast}:1",
            "white_text_level": wcag_white_level,
            "dark_bg_ratio": f"{dark_contrast}:1",
            "dark_bg_level": wcag_dark_level,
            "compliant": white_contrast >= 4.5,
        },
        "microcopy_metrics": {
            "welcome_message_word_count": word_count,
            "welcome_message_char_count": len(welcome_msg),
            "readability_assessment": readability,
            "has_teaser_bubble": bool(teaser_msg),
        },
        "mobile_ergonomics": {
            "fullscreen_enabled": mobile_fullscreen,
            "recommended_launcher_touch_target_px": 56,
            "safe_area_padding": "16px from viewport edges",
        },
        "recommendations": recommendations,
    }


async def preview_widget_html(principal: dict[str, Any], bot_id: str, test_theme: str = "light") -> str:
    bot = await _oauth.require_bot_access(principal, bot_id)
    name = bot.get("name", "Chatty Assistant")
    primary_color = bot.get("primary_color", "#f97316")
    welcome_msg = bot.get("welcome_message", "Hello! How can I help you today?")
    is_dark = test_theme.lower() == "dark"

    bg_body = "#09090b" if is_dark else "#f8fafc"
    card_bg = "#18181b" if is_dark else "#ffffff"
    text_color = "#f4f4f5" if is_dark else "#0f172a"
    sub_text = "#a1a1aa" if is_dark else "#64748b"

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Chatty Widget Live Preview - {name}</title>
  <style>
    body {{
      margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: {bg_body}; color: {text_color}; display: flex; justify-content: center; align-items: center; min-height: 90vh;
    }}
    .preview-container {{
      width: 100%; max-width: 400px; background: {card_bg}; border: 1px solid rgba(128,128,128,0.2);
      border-radius: 20px; box-shadow: 0 20px 40px rgba(0,0,0,0.15); overflow: hidden; display: flex; flex-direction: column;
    }}
    .header {{
      background: {primary_color}; color: #ffffff; padding: 18px 20px; font-weight: 600; font-size: 16px;
      display: flex; align-items: center; gap: 10px;
    }}
    .chat-body {{
      padding: 20px; min-height: 280px; display: flex; flex-direction: column; gap: 14px;
    }}
    .bot-bubble {{
      background: {primary_color}18; color: {text_color}; border: 1px solid {primary_color}33;
      padding: 12px 16px; border-radius: 16px 16px 16px 4px; max-width: 82%; font-size: 14px; line-height: 1.5;
    }}
    .input-bar {{
      padding: 14px 18px; border-top: 1px solid rgba(128,128,128,0.15); display: flex; gap: 8px;
    }}
    .input-mock {{
      flex: 1; padding: 10px 14px; border: 1px solid rgba(128,128,128,0.3); border-radius: 24px;
      background: transparent; color: {text_color}; font-size: 13px; outline: none;
    }}
  </style>
</head>
<body>
  <div class="preview-container">
    <div class="header">
      <span>⚡</span>
      <span>{name}</span>
    </div>
    <div class="chat-body">
      <div class="bot-bubble">{welcome_msg}</div>
    </div>
    <div class="input-bar">
      <input type="text" class="input-mock" placeholder="Ask a question..." readonly />
    </div>
  </div>
</body>
</html>"""
    return html


async def generate_embed_code(principal: dict[str, Any], bot_id: str, framework: str = "html_script") -> dict[str, str]:
    bot = await _oauth.require_bot_access(principal, bot_id)
    primary_color = bot.get("primary_color") or "#f97316"
    fw = framework.lower()

    if "next" in fw or "react" in fw:
        code = f"""import Script from "next/script";

export default function Layout({{ children }}: {{ children: React.ReactNode }}) {{
  return (
    <>
      {{children}}
      <Script
        src="https://chatty.personaliai.com/widget.js"
        data-id="{bot_id}"
        strategy="afterInteractive"
      />
    </>
  );
}}"""
    elif "wordpress" in fw:
        code = f"""<!-- In WordPress Admin: Settings -> Chatty Widget -> Enter Bot ID -->
Bot ID: {bot_id}

<!-- Or add manually to your theme header/footer: -->
<script src="https://chatty.personaliai.com/widget.js" data-id="{bot_id}" defer></script>"""
    elif "shopify" in fw:
        code = f"""<!-- In Shopify: Online Store -> Themes -> Edit code -> theme.liquid -> before </body> -->
<script src="https://chatty.personaliai.com/widget.js" data-id="{bot_id}" defer></script>"""
    elif "ios" in fw or "swift" in fw:
        # The real chatty-ios-sdk renders natively (SwiftUI, zero WebView/JS
        # bridge) — a WKWebView pointed at /embed/{bot_id} works but throws
        # away exactly what the native SDK exists to provide.
        code = f"""// Swift / iOS — native SDK (github.com/PersonaliAI/chatty-ios-sdk)
// Add via Swift Package Manager or CocoaPods, then:
import ChattySDK

ChattyChatView(botId: "{bot_id}")"""
    elif "android" in fw or "kotlin" in fw:
        # Same reasoning: chatty-android-sdk (Jetpack Compose) is the real
        # native integration, not a WebView loading the iframe embed page.
        code = f"""// Android Kotlin — native SDK (github.com/PersonaliAI/chatty-android-sdk)
// Add the Maven Central dependency, then:
ChattyChatScreen(botId = "{bot_id}")"""
    else:
        code = f"""<!-- Standard HTML Embed (Paste before </body>) -->
<script src="https://chatty.personaliai.com/widget.js" data-id="{bot_id}" defer></script>"""

    return {
        "bot_id": bot_id,
        "framework": framework,
        "code_snippet": code,
        "script_url": "https://chatty.personaliai.com/widget.js",
    }
