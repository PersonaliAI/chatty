#!/usr/bin/env python3
"""Evaluate catalog retrieval predictions against a JSONL ground-truth set.

Each line must contain ``expected_ids`` (a list), ``predicted_ids`` (a ranked
list), and optionally ``expected_no_match`` (a boolean). This keeps merchant
images and labels outside the repository while making precision/recall and
no-match thresholds reproducible in CI or a release job.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


def evaluate_records(records: list[dict[str, Any]], k: int = 6) -> dict[str, Any]:
    if k < 1:
        raise ValueError("k must be positive")
    positive: list[tuple[float, float]] = []
    no_match_results: list[bool] = []
    for index, record in enumerate(records, 1):
        expected = {str(value) for value in record.get("expected_ids", [])}
        predicted = [str(value) for value in record.get("predicted_ids", [])][:k]
        if not isinstance(record.get("expected_ids", []), list) or not isinstance(record.get("predicted_ids", []), list):
            raise ValueError(f"record {index}: expected_ids and predicted_ids must be lists")
        hits = len(expected.intersection(predicted))
        if expected:
            positive.append((hits / k, hits / len(expected)))
        if "expected_no_match" in record:
            expected_no_match = bool(record["expected_no_match"])
            no_match_results.append((not predicted) == expected_no_match)
    precision = sum(item[0] for item in positive) / len(positive) if positive else 0.0
    recall = sum(item[1] for item in positive) / len(positive) if positive else 0.0
    no_match_accuracy = (
        sum(no_match_results) / len(no_match_results) if no_match_results else None
    )
    return {
        "queries": len(records),
        "positive_queries": len(positive),
        "no_match_queries": len(no_match_results),
        "k": k,
        "precision_at_k": round(precision, 6),
        "recall_at_k": round(recall, 6),
        "no_match_accuracy": None if no_match_accuracy is None else round(no_match_accuracy, 6),
    }


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        value = json.loads(line)
        if not isinstance(value, dict):
            raise ValueError(f"line {line_number}: expected a JSON object")
        records.append(value)
    return records


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("dataset", type=Path, help="JSONL ground-truth/evaluation file")
    parser.add_argument("--k", type=int, default=6)
    parser.add_argument("--min-precision", type=float, default=0.0)
    parser.add_argument("--min-recall", type=float, default=0.0)
    parser.add_argument("--min-no-match-accuracy", type=float, default=0.0)
    args = parser.parse_args(argv)
    try:
        summary = evaluate_records(load_jsonl(args.dataset), args.k)
        print(json.dumps(summary, sort_keys=True))
        checks = [
            summary["precision_at_k"] >= args.min_precision,
            summary["recall_at_k"] >= args.min_recall,
        ]
        if summary["no_match_accuracy"] is not None:
            checks.append(summary["no_match_accuracy"] >= args.min_no_match_accuracy)
        return 0 if all(checks) else 1
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"Evaluation failed: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
