"""Bounded local benchmark for Flow runtime mapping.

This intentionally uses synthetic contexts only. It is a repeatable smoke/load
signal for release preparation, not a production traffic generator.
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.flow_runtime import resolve_mapping


def run(iterations: int) -> float:
    template = {
        "email": "{{context.email}}",
        "message": "Hello {{input}}",
        "token": "{{context.integration.api_key}}",
    }
    started = time.perf_counter()
    for index in range(iterations):
        result = resolve_mapping(
            template,
            f"visitor-{index}",
            {
                "email": f"visitor-{index}@example.com",
                "integration": {"api_key": f"synthetic-secret-{index}"},
            },
        )
        if result["mapped_payload"]["token"] != "[redacted]":
            raise RuntimeError("credential redaction regression detected")
    return time.perf_counter() - started


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--iterations", type=int, default=10_000)
    args = parser.parse_args()
    if args.iterations < 1 or args.iterations > 100_000:
        parser.error("--iterations must be between 1 and 100000")
    elapsed = run(args.iterations)
    rate = args.iterations / elapsed if elapsed else float("inf")
    print(f"flow_runtime_mapping iterations={args.iterations} elapsed_s={elapsed:.3f} ops_per_s={rate:.0f}")


if __name__ == "__main__":
    main()
