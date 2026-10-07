"""Pure tests for Chatty's server-side weighted AI credit policy."""

from app.services.chatty_quota_service import usage_units_for_message


def test_normal_text_turn_costs_one_credit():
    assert usage_units_for_message("What are your opening hours?") == 1


def test_long_text_is_bounded_and_progressively_weighted():
    assert usage_units_for_message("x" * 4000) == 1
    assert usage_units_for_message("x" * 4001) == 2
    assert usage_units_for_message("x" * 20000) == 5
    assert usage_units_for_message("x" * 100000) == 8


def test_media_request_has_a_fixed_multimodal_surcharge():
    assert usage_units_for_message("Please inspect this", has_media=True) == 4
    assert usage_units_for_message("x" * 20000, has_media=True) == 8
