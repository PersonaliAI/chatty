from app.services.campaign_analytics import aggregate_campaign_events


def test_campaign_analytics_returns_rates_and_breakdowns():
    result = aggregate_campaign_events([
        {"event_type": "impression", "metadata": {"device": "mobile", "channel": "web"}},
        {"event_type": "click", "metadata": {"device": "mobile", "channel": "web"}},
        {"event_type": "conversion", "metadata": {"device": "desktop", "channel": "email"}},
        {"event_type": "ignored", "metadata": {"device": "bot"}},
    ])
    assert result["impression"] == 1
    assert result["click_rate"] == 1.0
    assert result["conversion_rate"] == 1.0
    assert result["by_device"] == {"desktop": 1, "mobile": 2}
    assert result["by_channel"] == {"email": 1, "web": 2}
    assert result["sample_size"] == 4


def test_campaign_analytics_is_safe_for_empty_input():
    result = aggregate_campaign_events([])
    assert result["impression"] == 0
    assert result["click_rate"] == 0
    assert result["by_device"] == {}
