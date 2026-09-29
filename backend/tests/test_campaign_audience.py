from app.services.campaign_audience import campaign_audience_matches


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
