from app.services.campaign_audience import campaign_audience_matches, campaign_lead_matches


def test_audience_segments_are_explainable_and_bounded():
    assert campaign_audience_matches({"segment": "all"})
    assert not campaign_audience_matches({"segment": "returning"}, returning=False)
    assert campaign_audience_matches({"segment": "returning"}, returning=True)
    assert campaign_audience_matches({"segment": "high_intent"}, intent_score=80)
    assert not campaign_audience_matches({"segment": "high_intent"}, intent_score=40)


def test_audience_rejects_invalid_rules_and_enforces_minimum():
    assert not campaign_audience_matches({"segment": "unknown"})
    assert not campaign_audience_matches({"min_intent_score": 80}, intent_score=79)
    assert campaign_audience_matches({"min_intent_score": 80}, intent_score=80)
    assert not campaign_audience_matches({"returning_only": True}, returning=False)


def test_provider_lead_audience_uses_persisted_qualification_signals():
    rules = {"segment": "high_intent", "min_intent_score": 70}
    assert campaign_lead_matches(rules, {"custom_fields": {"intent_score": 85}})
    assert not campaign_lead_matches(rules, {"custom_fields": {"intent_score": 60}})
    assert not campaign_lead_matches({"segment": "returning"}, {"custom_fields": {}})
    assert campaign_lead_matches({"segment": "returning"}, {"custom_fields": {"returning": True}})


def test_returning_segment_rejects_truthy_non_boolean_qualification():
    for value in ("false", "true", 1, [True], {"value": True}):
        assert not campaign_lead_matches({"segment": "returning"}, {"returning": value})
        assert not campaign_lead_matches({"segment": "returning"},
                                         {"custom_fields": {"returning": value}})
    assert campaign_lead_matches({"segment": "returning"}, {"returning": True})
