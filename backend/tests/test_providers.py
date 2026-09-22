from app.core import providers


def test_managed_profile_does_not_require_self_host_services(monkeypatch):
    monkeypatch.setattr(providers, "DEPLOYMENT_PROFILE", "managed_supabase")
    providers.validate_self_host_contract()


def test_provider_status_does_not_expose_secret_values():
    status = providers.ProviderStatus("self_host", True, True, True)
    assert "SECRET" not in repr(status)
    assert status.ready_for_self_host_adapters is True
