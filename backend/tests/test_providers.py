from app.core import providers


def test_managed_profile_does_not_require_self_host_services(monkeypatch):
    monkeypatch.setattr(providers, "DEPLOYMENT_PROFILE", "managed_supabase")
    providers.validate_self_host_contract()


def test_provider_status_never_exposes_secret_values():
    status = providers.ProviderStatus("self_host", True, True, True)
    rendered = repr(status)
    assert "SECRET" not in rendered
    assert status.ready_for_self_host_adapters is True


def test_managed_dependency_probe_is_green_without_network(monkeypatch):
    monkeypatch.setattr(providers, "DEPLOYMENT_PROFILE", "managed_supabase")
    assert providers.check_self_host_dependencies() == {
        "database": True,
        "queue": True,
        "object_store": True,
    }
