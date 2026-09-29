#!/usr/bin/env python3
"""Fetch repository metrics and update docs/assets/traction_history.json."""

from __future__ import annotations

import json
import os
import sys
import urllib.request
from datetime import datetime, timezone


def main() -> int:
    repo = "PersonaliAI/chatty"
    url = f"https://api.github.com/repos/{repo}"
    headers = {"User-Agent": "Chatty-Traction-Tracker"}
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"

    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
    except Exception as e:
        print(f"Error fetching repo data: {e}", file=sys.stderr)
        data = {}

    stars = data.get("stargazers_count", 0)
    forks = data.get("forks_count", 0)
    open_issues = data.get("open_issues_count", 0)
    watchers = data.get("watchers_count", 0)

    history_file = "docs/assets/traction_history.json"
    os.makedirs("docs/assets", exist_ok=True)
    history = []
    if os.path.exists(history_file):
        try:
            with open(history_file, "r", encoding="utf-8") as f:
                history = json.load(f)
        except Exception:
            history = []

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    entry = {
        "date": today,
        "stars": stars,
        "forks": forks,
        "open_issues": open_issues,
        "watchers": watchers,
    }

    # Update today's entry if already present, or append
    if history and history[-1].get("date") == today:
        history[-1] = entry
    else:
        history.append(entry)

    with open(history_file, "w", encoding="utf-8") as f:
        json.dump(history, f, indent=2)

    print(f"Recorded metrics for {today}: Stars={stars}, Forks={forks}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
