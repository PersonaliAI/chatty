from datetime import datetime, timezone

from app.services.campaign_runtime import campaign_is_active_now


NOW = datetime(2026, 9, 29, 12, 0, tzinfo=timezone.utc)


def test_campaign_runtime_window_is_enforced():
    assert campaign_is_active_now({"is_active": True}, NOW)
    assert campaign_is_active_now({"is_active": True, "start_date": "2026-09-29T11:00:00Z"}, NOW)
    assert not campaign_is_active_now({"is_active": True, "start_date": "2026-09-29T13:00:00Z"}, NOW)
    assert not campaign_is_active_now({"is_active": True, "end_date": "2026-09-29T12:00:00Z"}, NOW)


def test_campaign_runtime_fails_closed_for_disabled_or_invalid_dates():
    assert not campaign_is_active_now({"is_active": False}, NOW)
    assert not campaign_is_active_now({"is_active": True, "start_date": "not-a-date"}, NOW)


def test_campaign_quiet_hours_use_campaign_timezone_and_fail_closed():
    campaign = {"is_active": True, "schedule_config": {"timezone": "UTC"}, "safety_config": {"quiet_hours": {"start": "22:00", "end": "08:00"}}}
    assert not campaign_is_active_now(campaign, NOW.replace(hour=23))
    assert campaign_is_active_now(campaign, NOW.replace(hour=12))
    assert not campaign_is_active_now({"is_active": True, "safety_config": {"quiet_hours": {"start": "bad"}}}, NOW)
