import json
from pathlib import Path

from scripts import evaluate_catalog_retrieval


def test_catalog_evaluation_reports_precision_recall_and_no_match():
    summary = evaluate_catalog_retrieval.evaluate_records([
        {"expected_ids": ["shoe-1"], "predicted_ids": ["shoe-1", "shoe-2"]},
        {"expected_ids": [], "predicted_ids": [], "expected_no_match": True},
    ], k=2)

    assert summary == {
        "queries": 2,
        "positive_queries": 1,
        "no_match_queries": 1,
        "k": 2,
        "precision_at_k": 0.5,
        "recall_at_k": 1.0,
        "no_match_accuracy": 1.0,
    }


def test_catalog_evaluation_loads_jsonl(tmp_path: Path):
    path = tmp_path / "eval.jsonl"
    path.write_text(json.dumps({"expected_ids": ["a"], "predicted_ids": ["a"]}) + "\n", encoding="utf-8")
    assert evaluate_catalog_retrieval.load_jsonl(path)[0]["expected_ids"] == ["a"]
