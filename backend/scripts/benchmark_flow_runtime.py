"""Bounded local benchmark for Flow runtime mapping.

This intentionally uses synthetic contexts only. It is a repeatable smoke/load
signal for release preparation, not a production traffic generator.
"""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.flow_runtime import resolve_mapping


def _run_batch(start: int, count: int) -> int:
    template = {
        "email": "{{context.email}}",
        "message": "Hello {{input}}",
        "token": "{{context.integration.api_key}}",
    }
    for offset in range(count):
        index = start + offset
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
    return count


def run(iterations: int, workers: int = 1) -> float:
    """Run synthetic mapping work across bounded worker threads."""
    started = time.perf_counter()
    batch_size, remainder = divmod(iterations, workers)
    batches = []
    cursor = 0
    for worker in range(workers):
        count = batch_size + (1 if worker < remainder else 0)
        if count:
            batches.append((cursor, count))
            cursor += count
    if workers == 1:
        _run_batch(*batches[0])
    else:
        with ThreadPoolExecutor(max_workers=workers, thread_name_prefix="flow-bench") as pool:
            completed = sum(pool.map(lambda batch: _run_batch(*batch), batches))
        if completed != iterations:
            raise RuntimeError("benchmark worker accounting mismatch")
    return time.perf_counter() - started


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--iterations", type=int, default=10_000)
    parser.add_argument("--workers", type=int, default=1)
    args = parser.parse_args()
    if args.iterations < 1 or args.iterations > 100_000:
        parser.error("--iterations must be between 1 and 100000")
    if args.workers < 1 or args.workers > 16:
        parser.error("--workers must be between 1 and 16")
    elapsed = run(args.iterations, args.workers)
    rate = args.iterations / elapsed if elapsed else float("inf")
    print(f"flow_runtime_mapping iterations={args.iterations} workers={args.workers} elapsed_s={elapsed:.3f} ops_per_s={rate:.0f}")


if __name__ == "__main__":
    main()
