from datetime import datetime, timezone

from app.services.campaign_schedule import next_campaign_run_at


NOW = datetime(2026, 9, 29, 12, 30, tzinfo=timezone.utc)


def test_next_run_handles_hourly_and_timezone():
    result = next_campaign_run_at({
        "created_at": "2026-09-29T11:45:00Z",
        "schedule_config": {"cadence": "hourly", "timezone": "Asia/Colombo"},
    }, NOW)
    assert result == datetime(2026, 9, 29, 12, 45, tzinfo=timezone.utc)


def test_next_run_respects_once_and_end_window():
    assert next_campaign_run_at({
        "start_date": "2026-09-29T13:00:00Z",
        "schedule_config": {"cadence": "once", "timezone": "UTC"},
    }, NOW) == datetime(2026, 9, 29, 13, 0, tzinfo=timezone.utc)
    assert next_campaign_run_at({
        "start_date": "2026-09-29T11:00:00Z",
        "end_date": "2026-09-29T12:00:00Z",
        "schedule_config": {"cadence": "daily", "timezone": "UTC"},
    }, NOW) is None


def test_next_run_fails_closed_for_invalid_schedule():
    assert next_campaign_run_at({"created_at": "bad", "schedule_config": {"cadence": "hourly"}}, NOW) is None
    assert next_campaign_run_at({"created_at": "2026-09-29T11:00:00Z", "schedule_config": {"timezone": "Mars/Olympus"}}, NOW) is None
