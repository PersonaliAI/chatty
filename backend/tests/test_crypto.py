"""encrypt_secret/decrypt_secret — used to encrypt Google/Microsoft OAuth
tokens at rest (previously stored plaintext in the users / kin_connected_accounts
tables). decrypt_secret's pass-through-on-InvalidToken fallback is what lets
already-connected accounts (stored as plaintext before this existed) keep
working without a one-off data migration.
"""
from app.core.crypto import decrypt_secret, encrypt_secret


def test_encrypt_then_decrypt_round_trips():
    raw = "ya29.a0AfH6SMC_example_access_token"
    enc = encrypt_secret(raw)
    assert enc != raw
    assert decrypt_secret(enc) == raw


def test_decrypt_passes_through_legacy_plaintext_unchanged():
    # A pre-migration DB row stored the raw token directly.
    assert decrypt_secret("1//already-plaintext-refresh-token") == "1//already-plaintext-refresh-token"


def test_decrypt_passes_through_empty_string():
    assert decrypt_secret("") == ""


def test_encrypt_is_not_deterministic_but_always_decryptable():
    raw = "same-input"
    a = encrypt_secret(raw)
    b = encrypt_secret(raw)
    assert a != b  # Fernet includes a random IV/timestamp each call.
    assert decrypt_secret(a) == raw
    assert decrypt_secret(b) == raw
