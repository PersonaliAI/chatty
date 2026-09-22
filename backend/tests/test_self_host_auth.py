from app.core import deps


def test_managed_auth_keeps_supabase_verifier(monkeypatch):
    monkeypatch.setattr(deps, "DEPLOYMENT_PROFILE", "managed_supabase")
    monkeypatch.setattr(deps, "verify_supabase_jwt", lambda authorization: {"sub": "managed-user"})
    assert deps.verify_bearer_jwt("Bearer managed") == {"sub": "managed-user"}


def test_self_host_auth_selects_oidc_verifier(monkeypatch):
    monkeypatch.setattr(deps, "DEPLOYMENT_PROFILE", "self_host")
    monkeypatch.setattr(deps, "verify_oidc_jwt", lambda authorization: {"sub": "oidc-user"})
    assert deps.verify_bearer_jwt("Bearer oidc") == {"sub": "oidc-user"}
