"""Unit tests for enterprise PII scrubber and DLP service."""

import pytest
from app.services.pii_service import is_luhn_valid, detect_card_brand, scrub_pii, contains_pii


def test_luhn_checksum_valid_cards():
    # Standard test card numbers (Luhn valid)
    assert is_luhn_valid("4532015112830366") is True  # Visa
    assert is_luhn_valid("4532 0151 1283 0366") is True
    assert is_luhn_valid("4532-0151-1283-0366") is True
    assert is_luhn_valid("378282246310005") is True    # Amex
    assert is_luhn_valid("5555555555554444") is True  # MasterCard
    assert is_luhn_valid("6011111111111117") is True  # Discover


def test_luhn_checksum_invalid_numbers():
    # Numbers that fail the Luhn checksum
    assert is_luhn_valid("4532015112830367") is False
    assert is_luhn_valid("1234567890123456") is False
    assert is_luhn_valid("9999999999999999") is False
    # Numbers too short or too long
    assert is_luhn_valid("1234567890") is False
    assert is_luhn_valid("123456789012345678901") is False


def test_detect_card_brand():
    assert detect_card_brand("4532015112830366") == "VISA"
    assert detect_card_brand("378282246310005") == "AMEX"
    assert detect_card_brand("5555555555554444") == "MASTERCARD"
    assert detect_card_brand("6011111111111117") == "DISCOVER"


def test_scrub_credit_cards():
    text = "Please charge my Visa 4532-0151-1283-0366 for the subscription."
    scrubbed = scrub_pii(text)
    assert "4532-0151-1283-0366" not in scrubbed
    assert "[REDACTED_VISA:0366]" in scrubbed

    # Non-card 16 digit number that fails Luhn should NOT be redacted
    fake_order = "My order number is 1234-5678-9012-3456 please check status."
    assert scrub_pii(fake_order) == fake_order


def test_scrub_ssn():
    text = "My SSN is 123-45-6789 and my friend is 987 65 4321."
    scrubbed = scrub_pii(text)
    assert "123-45-6789" not in scrubbed
    assert "[REDACTED_SSN]" in scrubbed


def test_scrub_api_keys_and_tokens():
    mock_key = f"{'sk'}_{'live'}_1234567890abcdef1234567890"
    text = f"Here is my key: {mock_key} and Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz"
    scrubbed = scrub_pii(text)
    assert "sk_live_" not in scrubbed
    assert "[REDACTED_API_KEY]" in scrubbed
    assert "Bearer [REDACTED_TOKEN]" in scrubbed


def test_contains_pii():
    assert contains_pii("Hello, my email is test@example.com") is False
    assert contains_pii("Visa card 4532015112830366") is True
    assert contains_pii("My SSN is 123-45-6789") is True
    assert contains_pii(f"Token: {'sk'}_{'live'}_abcdef1234567890abcdef1234") is True
