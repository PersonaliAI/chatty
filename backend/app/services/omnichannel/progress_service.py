"""Contextual Interim Progress Service.

Generates immediate, localized conversational acknowledgement and progress updates
(e.g., "Checking this image with our catalog...", "Looking up your order details...")
to provide instant feedback during multimodal inference, visual RAG, and catalog retrieval,
preventing visitors from assuming the bot is frozen or inactive.
"""

from __future__ import annotations

import logging
import re
from typing import Optional

logger = logging.getLogger("chatty.omnichannel.progress")

# Fast regex patterns for query classification
_ORDER_KEYWORDS = re.compile(
    r"\b(order|track|tracking|shipment|delivery|package|dispatch|parcel|status|wismo|ඇණවුම|ඇණවුම්|ஆர்டர்)\b",
    re.IGNORECASE,
)
_PRODUCT_KEYWORDS = re.compile(
    r"\b(price|cost|buy|purchase|stock|available|catalog|product|item|bag|shoes|watch|dress|shirt|මිල|ගන්න|තියෙනවද|භාණ්ඩ|விலை|பொருட்கள்)\b",
    re.IGNORECASE,
)
_SHORT_GREETINGS = {
    "hi", "hello", "hey", "hola", "bonjour", "ayubowan", "vanakkam", "halo",
    "ok", "yes", "no", "ow", "na", "thanks", "thank you", "thx", "bye", "goodbye"
}


def _detect_lang(text: str) -> str:
    """Fast language detector for contextual notices."""
    if not text:
        return "en"
    # Sinhala Unicode block: \u0D80-\u0DFF
    if re.search(r"[\u0D80-\u0DFF]", text):
        return "si"
    # Tamil Unicode block: \u0B80-\u0BFF
    if re.search(r"[\u0B80-\u0BFF]", text):
        return "ta"
    # Sinhala Singlish heuristics (common phonetic romanized words)
    clean_lower = text.lower()
    singlish_markers = ["wage", "ganna", "puluwand", "puluwan", "mokakda", "thiyenawada", "thiyeda", "kiyada", "karanna", "ekak", "ow", "nehe", "naha"]
    if any(re.search(rf"\b{re.escape(m)}\b", clean_lower) for m in singlish_markers):
        return "si"
    # Spanish
    if any(re.search(rf"\b{re.escape(w)}\b", clean_lower) for w in ["hola", "gracias", "precio", "cuanto", "donde", "pedido"]):
        return "es"
    # French
    if any(re.search(rf"\b{re.escape(w)}\b", clean_lower) for w in ["bonjour", "merci", "combien", "commande", "produit"]):
        return "fr"
    return "en"


def get_contextual_interim_notice(
    message_text: str,
    has_media: bool = False,
    media_mime: Optional[str] = None,
    media_filename: Optional[str] = None,
) -> Optional[str]:
    """Return an empathetic, localized interim progress message tailored to the user's inquiry."""
    raw_text = (message_text or "").strip()
    clean_text = raw_text.lower()

    # Skip interim messages for trivial one-word greetings if there is no media attachment
    if not has_media and clean_text in _SHORT_GREETINGS:
        return None

    lang = _detect_lang(raw_text)
    is_audio = bool(
        media_mime and "audio" in media_mime
        or (media_filename and any(media_filename.lower().endswith(ext) for ext in (".wav", ".mp3", ".ogg", ".m4a", ".aac")))
    )

    # 1. Media Upload (Photo, Visual Catalog Match, or Voice Note)
    if has_media:
        if is_audio:
            if lang == "si":
                return "🎙️ ඔබගේ හඬ පණිවිඩය පරීක්ෂා කරමින් සිටිනවා, සුළු මොහොතක් රැඳී සිටින්න..."
            if lang == "ta":
                return "🎙️ உங்கள் குரல் செய்தியை சரிபார்க்கிறோம், சற்று காத்திருக்கவும்..."
            return "🎙️ Listening to your audio note right now, one moment..."
        else:
            if lang == "si":
                return "🔍 ඔබ එවූ පින්තූරය අපගේ නිෂ්පාදන සමඟ පරීක්ෂා කරමින් සිටිනවා, මොහොතක් රැඳී සිටින්න..."
            if lang == "ta":
                return "🔍 நீங்கள் அனுப்பிய புகைப்படத்தை எங்கள் தயாரிப்புகளுடன் சரிபார்க்கிறோம், சற்று காத்திருக்கவும்..."
            if lang == "es":
                return "🔍 Comprobando esta imagen con nuestro catálogo, un momento..."
            if lang == "fr":
                return "🔍 Analyse de votre image dans notre catalogue en cours, un instant..."
            return "🔍 Checking this image against our catalog, one moment..."

    # 2. Order Lookup / Tracking
    if _ORDER_KEYWORDS.search(clean_text):
        if lang == "si":
            return "📦 ඔබේ ඇණවුම් විස්තර පරීක්ෂා කරමින් සිටිනවා, සුළු මොහොතක් දෙන්න..."
        if lang == "ta":
            return "📦 உங்கள் ஆர்டர் விவரங்களை சரிபார்க்கிறோம், சற்று காத்திருக்கவும்..."
        if lang == "es":
            return "📦 Buscando los detalles de su pedido ahora mismo, un momento..."
        if lang == "fr":
            return "📦 Recherche des détails de votre commande en cours, un instant..."
        return "📦 Looking up your order details right now, almost there..."

    # 3. Product Inquiry / Catalog Search
    if _PRODUCT_KEYWORDS.search(clean_text):
        if lang == "si":
            return "🛍️ ඔබ විමසූ භාණ්ඩ පිළිබඳ තොරතුරු සොයමින් සිටිනවා, මොහොතක් රැඳී සිටින්න..."
        if lang == "ta":
            return "🛍️ நீங்கள் கேட்ட தயாரிப்பு பற்றிய தகவல்களை தேடுகிறோம், சற்று காத்திருக்கவும்..."
        if lang == "es":
            return "🛍️ Buscando en nuestro catálogo para usted ahora mismo..."
        if lang == "fr":
            return "🛍️ Recherche dans notre catalogue en cours, un instant..."
        return "🛍️ Looking into our catalog for that right now, almost there..."

    # 4. General Inquiries (Only if query is substantial, e.g. > 2 words)
    words = clean_text.split()
    if len(words) >= 2 or "?" in raw_text:
        if lang == "si":
            return "✨ ඒ පිළිබඳව පරීක්ෂා කරමින් සිටිනවා, සුළු මොහොතක් රැඳී සිටින්න..."
        if lang == "ta":
            return "✨ அதைப் பற்றி சரிபார்க்கிறோம், சற்று காத்திருக்கவும்..."
        if lang == "es":
            return "✨ Revisando eso para usted ahora mismo, un momento..."
        if lang == "fr":
            return "✨ Vérification en cours, un instant..."
        return "✨ Looking into that for you right now, one moment..."

    return None
