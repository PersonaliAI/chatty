from app.services import multimodal_service


def test_catalog_recommendation_policy_filters_unpublished_and_out_of_stock_items():
    assert multimodal_service.catalog_item_is_recommendable({"metadata": {}}) is True
    assert multimodal_service.catalog_item_is_recommendable({
        "metadata": {"status": "draft", "in_stock": True}
    }) is False
    assert multimodal_service.catalog_item_is_recommendable({
        "metadata": {"status": "publish", "stock_status": "outofstock"}
    }) is False
    assert multimodal_service.catalog_item_is_recommendable({
        "metadata": {"status": "publish", "in_stock": False}
    }, in_stock_only=False) is True
    assert multimodal_service.catalog_similarity_meets_threshold({"similarity": "0.5"}, 0.35) is True
    assert multimodal_service.catalog_similarity_meets_threshold({"similarity": "bad"}, 0.35) is False


def test_catalog_search_limits_result_count_and_confidence():
    assert multimodal_service.MAX_CATALOG_RESULTS == 20
    assert multimodal_service.FALLBACK_MIN_SCORE == 0.3


def test_fallback_catalog_score_is_normalized_and_weights_title_and_sku():
    exact = multimodal_service.fallback_catalog_score(
        {"title": "Blue trail shoe", "description": "A shoe", "sku": "TRAIL-42"},
        ["blue", "trail", "shoe"],
    )
    weak = multimodal_service.fallback_catalog_score(
        {"title": "Accessory", "description": "blue item", "sku": "OTHER"},
        ["blue", "trail", "shoe"],
    )
    assert 0.0 <= exact <= 1.0
    assert exact > weak
