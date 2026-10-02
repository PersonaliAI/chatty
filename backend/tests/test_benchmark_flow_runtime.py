from scripts import benchmark_flow_runtime


def test_flow_runtime_benchmark_accounts_for_bounded_workers(monkeypatch):
    """The concurrent smoke path must execute every synthetic context exactly once."""
    calls = []
    original = benchmark_flow_runtime.resolve_mapping

    def tracked(*args, **kwargs):
        calls.append(args[1])
        return original(*args, **kwargs)

    monkeypatch.setattr(benchmark_flow_runtime, "resolve_mapping", tracked)
    elapsed = benchmark_flow_runtime.run(31, workers=3)

    assert elapsed >= 0
    assert len(calls) == 31
    assert len(set(calls)) == 31
