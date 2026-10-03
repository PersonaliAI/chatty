"""Verify that the Chatty flow tables are visible through Supabase REST."""

import os
import sys

import requests


TABLES = ("chatty_flows", "chatty_flow_versions", "chatty_flow_runs")


def main() -> int:
    base_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    publishable_key = os.environ.get("SUPABASE_PUBLISHABLE_KEY", "")
    if not base_url or not publishable_key:
        print("Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.", file=sys.stderr)
        return 2

    headers = {"apikey": publishable_key, "Authorization": f"Bearer {publishable_key}"}
    failed = False
    for table in TABLES:
        response = requests.get(
            f"{base_url}/rest/v1/{table}?select=*&limit=1",
            headers=headers,
            timeout=15,
        )
        print(f"{table}: HTTP {response.status_code}")
        failed |= response.status_code != 200
    return int(failed)


if __name__ == "__main__":
    raise SystemExit(main())
