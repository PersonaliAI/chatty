"""Enterprise PII and Data Loss Prevention (DLP) Scrubber.

Complies with PCI-DSS & SOC-2 standards by automatically detecting and
redacting sensitive customer data (Luhn-verified credit card numbers, US SSNs,
and exposed API keys/bearer tokens) before logging or storage.
"""

from __future__ import annotations

import re
from typing import NamedTuple


class PIIFinding(NamedTuple):
    pii_type: str
    original: str
    replacement: str


# Regex for candidate payment cards (13 to 19 digits, optionally spaced or hyphenated)
_CARD_CANDIDATE_REGEX = re.compile(
    r"\b(?:\d[ -]*?){13,19}\b"
)

# Regex for US Social Security Numbers (standard 9-digit format: XXX-XX-XXXX)
# Excludes invalid ranges: 000, 666, 900-999 in first group, 00 in middle, 0000 at end.
_SSN_REGEX = re.compile(
    r"\b(?!000|666|9\d{2})\d{3}[- ](?!00)\d{2}[- ](?!0000)\d{4}\b"
)

# Regex for common exposed API keys and Bearer tokens
_API_SECRET_REGEX = re.compile(
    r"\b("
    r"sk_live_[0-9a-zA-Z]{24,}|"
    r"ghp_[0-9a-zA-Z]{36}|"
    r"AIza[0-9A-Za-z-_]{35}|"
    r"Bearer\s+[a-zA-Z0-9_\-\.]{20,}"
    r")\b",
    re.IGNORECASE,
)

# Regex for candidate International Bank Account Numbers (IBAN)
# 2-letter ISO country code, 2 check digits, followed by 11 to 30 alphanumeric characters
_IBAN_REGEX = re.compile(
    r"\b[A-Za-z]{2}[0-9]{2}(?:[ -]?[0-9A-Za-z]{4}){2,7}(?:[ -]?[0-9A-Za-z]{1,4})?\b"
)


def is_iban_valid(candidate: str) -> bool:
    """Verifies candidate IBAN against official ISO 7064 MOD 97-10 algorithm."""
    clean = re.sub(r"[\s-]", "", candidate).upper()
    if len(clean) < 14 or len(clean) > 34:
        return False
    if not (clean[:2].isalpha() and clean[2:4].isdigit()):
        return False
    # Move the first 4 characters to the end
    rearranged = clean[4:] + clean[:4]
    # Convert letters to digits: A=10, B=11, ... Z=35
    digits = []
    for char in rearranged:
        if char.isdigit():
            digits.append(char)
        elif char.isalpha():
            digits.append(str(ord(char) - 55))
        else:
            return False
    try:
        return int("".join(digits)) % 97 == 1
    except (ValueError, OverflowError):
        return False


def is_luhn_valid(candidate: str) -> bool:
    """Verifies candidate card number against official MOD 10 Luhn checksum algorithm."""
    digits = [int(c) for c in candidate if c.isdigit()]
    if len(digits) < 13 or len(digits) > 19:
        return False

    total = 0
    reverse_digits = digits[::-1]
    for i, d in enumerate(reverse_digits):
        if i % 2 == 1:
            doubled = d * 2
            total += doubled - 9 if doubled > 9 else doubled
        else:
            total += d
    return total % 10 == 0


def detect_card_brand(digits_str: str) -> str:
    """Identifies the payment card brand based on IIN/BIN prefix."""
    if digits_str.startswith("4"):
        return "VISA"
    if digits_str.startswith(("34", "37")):
        return "AMEX"
    if digits_str.startswith(("51", "52", "53", "54", "55")) or (
        len(digits_str) >= 4 and 2221 <= int(digits_str[:4]) <= 2720
    ):
        return "MASTERCARD"
    if digits_str.startswith(("6011", "65")) or (
        len(digits_str) >= 3 and 644 <= int(digits_str[:3]) <= 649
    ):
        return "DISCOVER"
    return "CARD"


def scrub_pii(text: str) -> str:
    """Scrubs sensitive PII from input text, replacing cards with [REDACTED_CARD:LAST4],

    SSNs with [REDACTED_SSN], and exposed tokens with [REDACTED_TOKEN].
    Non-card sequences of numbers (e.g. 16-digit order numbers that fail Luhn) are preserved.
    """
    if not text or not isinstance(text, str):
        return text or ""

    scrubbed = text

    # 1. Redact API tokens and secret credentials
    def _token_replacer(match: re.Match) -> str:
        token = match.group(0)
        if token.lower().startswith("bearer "):
            return "Bearer [REDACTED_TOKEN]"
        return "[REDACTED_API_KEY]"

    scrubbed = _API_SECRET_REGEX.sub(_token_replacer, scrubbed)

    # 2. Redact valid US Social Security Numbers
    scrubbed = _SSN_REGEX.sub("[REDACTED_SSN]", scrubbed)

    # 3. Redact Luhn-valid Credit Cards
    # Extract non-overlapping card candidates
    matches = list(_CARD_CANDIDATE_REGEX.finditer(scrubbed))
    # Process matches in reverse order to preserve string offsets
    for m in reversed(matches):
        candidate_raw = m.group(0)
        digits_only = "".join(c for c in candidate_raw if c.isdigit())
        if 13 <= len(digits_only) <= 19 and is_luhn_valid(digits_only):
            brand = detect_card_brand(digits_only)
            last4 = digits_only[-4:]
            replacement = f"[REDACTED_{brand}:{last4}]"
            start, end = m.span()
            scrubbed = scrubbed[:start] + replacement + scrubbed[end:]

    # 4. Redact ISO 7064-valid International Bank Account Numbers (IBAN)
    iban_matches = list(_IBAN_REGEX.finditer(scrubbed))
    for m in reversed(iban_matches):
        candidate_raw = m.group(0)
        clean_iban = re.sub(r"[\s-]", "", candidate_raw).upper()
        if is_iban_valid(clean_iban):
            country = clean_iban[:2]
            last4 = clean_iban[-4:]
            replacement = f"[REDACTED_IBAN:{country}***{last4}]"
            start, end = m.span()
            scrubbed = scrubbed[:start] + replacement + scrubbed[end:]

    return scrubbed


def contains_pii(text: str) -> bool:
    """Quick boolean scan to determine if sensitive data exists in text."""
    if not text:
        return False
    if _API_SECRET_REGEX.search(text) or _SSN_REGEX.search(text):
        return True
    for m in _CARD_CANDIDATE_REGEX.finditer(text):
        digits_only = "".join(c for c in m.group(0) if c.isdigit())
        if 13 <= len(digits_only) <= 19 and is_luhn_valid(digits_only):
            return True
    for m in _IBAN_REGEX.finditer(text):
        clean_iban = re.sub(r"[\s-]", "", m.group(0)).upper()
        if is_iban_valid(clean_iban):
            return True
    return False
