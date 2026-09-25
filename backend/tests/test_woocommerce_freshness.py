from datetime import datetime, timedelta, timezone

from app.services import woocommerce_service


def test_catalog_freshness_reports_stale_catalog_age():
    old = (datetime.now(timezone.utc) - timedelta(seconds=woocommerce_service.COMMERCE_FRESHNESS_SLO_SECONDS + 30)).isoformat()
    snapshot = woocommerce_service.catalog_freshness({
        "sync_status": "synced",
        "catalog_freshness_at": old,
        "last_webhook_at": old,
    })

    assert snapshot["freshness_status"] == "stale"
    assert snapshot["freshness_age_seconds"] >= woocommerce_service.COMMERCE_FRESHNESS_SLO_SECONDS
    assert snapshot["freshness_slo_seconds"] == woocommerce_service.COMMERCE_FRESHNESS_SLO_SECONDS


def test_catalog_freshness_prioritizes_failed_and_syncing_states():
    assert woocommerce_service.catalog_freshness({"sync_status": "failed"})["freshness_status"] == "failed"
    assert woocommerce_service.catalog_freshness({"sync_status": "syncing"})["freshness_status"] == "syncing"
