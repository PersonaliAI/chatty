#!/usr/bin/env python3
"""Chatty Performance Auditor CLI.

Conducts an independent 5-pillar operational audit of an AI Chatbot instance:
1. 🎯 Conversion (Lead capture, booking, revenue intent)
2. 💬 Engagement & Deflection (Self-service resolution, conversation depth)
3. 🧠 Accuracy & Grounding (Knowledge adherence, RAG confidence)
4. ⚡ Reliability & Responsiveness (p95 latency, error budget)
5. 😊 Customer Satisfaction (CSAT ratings, sentiment balance)

Outputs an A-F letter grade scorecard inspired by iFixAi, along with actionable
operational recommendations to boost conversion and deflection.

Usage:
    python scripts/audit_bot.py --sample
    python scripts/audit_bot.py --bot-id <bot_uuid> [--days 30] [--format text|json|markdown]
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone

# ANSI Colors
CYAN = "\033[96m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
BOLD = "\033[1m"
DIM = "\033[2m"
RESET = "\033[0m"


def _bar(score: float, width: int = 24) -> str:
    filled = int(round((score / 100.0) * width))
    filled = max(0, min(width, filled))
    bar_str = "█" * filled + "░" * (width - filled)
    if score >= 85:
        return f"{GREEN}{bar_str}{RESET}"
    elif score >= 70:
        return f"{CYAN}{bar_str}{RESET}"
    elif score >= 55:
        return f"{YELLOW}{bar_str}{RESET}"
    return f"{RED}{bar_str}{RESET}"


def _color_grade(grade: str) -> str:
    if "A" in grade:
        return f"{GREEN}{BOLD}{grade}{RESET}"
    elif "B" in grade:
        return f"{CYAN}{BOLD}{grade}{RESET}"
    elif "C" in grade:
        return f"{YELLOW}{BOLD}{grade}{RESET}"
    return f"{RED}{BOLD}{grade}{RESET}"


def generate_sample_audit(bot_id: str = "demo-bot-sample") -> dict:
    """Generate a realistic sample audit for demonstration and offline testing."""
    return {
        "bot_id": bot_id,
        "period_days": 30,
        "overall_grade": "A-",
        "composite_score": 88.5,
        "status": "High Performing",
        "audit_timestamp": datetime.now(timezone.utc).isoformat(),
        "pillars": {
            "conversion": {
                "name": "Conversion & Revenue Intent",
                "score": 86.4,
                "weight": "25%",
                "metrics": {
                    "sessions": 1420,
                    "leads_captured": 248,
                    "lead_rate_pct": 17.5,
                    "meetings_booked": 84,
                    "booking_rate_pct": 5.9,
                },
                "summary": "Strong lead conversion (17.5%). Calendar booking triggers are active."
            },
            "engagement": {
                "name": "Engagement & Deflection",
                "score": 91.2,
                "weight": "20%",
                "metrics": {
                    "conversations": 1180,
                    "deflected_pct": 89.4,
                    "escalated_count": 125,
                    "avg_turns": 4.8,
                },
                "summary": "89.4% of queries resolved autonomously without agent escalation."
            },
            "accuracy": {
                "name": "Accuracy & Knowledge Grounding",
                "score": 93.0,
                "weight": "25%",
                "metrics": {
                    "total_ai_calls": 5664,
                    "success_pct": 99.1,
                    "hallucination_guard_triggers": 12,
                    "rag_confidence_avg": "94.2%",
                },
                "summary": "High RAG precision. Strict booking anti-hallucination active."
            },
            "reliability": {
                "name": "Reliability & Responsiveness",
                "score": 85.0,
                "weight": "15%",
                "metrics": {
                    "p95_latency_ms": 1380.0,
                    "uptime_pct": 99.98,
                    "error_count": 5,
                },
                "summary": "p95 latency is well within SLA (1.38s). Uptime is 99.98%."
            },
            "satisfaction": {
                "name": "Satisfaction & Sentiment",
                "score": 86.8,
                "weight": "15%",
                "metrics": {
                    "total_ratings": 312,
                    "average_csat": 4.62,
                    "positive_feedback_pct": 91.0,
                },
                "summary": "4.62/5 CSAT average based on 312 verified visitor ratings."
            }
        },
        "recommendations": [
            "Enable exit-intent campaign triggers to recover an estimated 8-12% more abandoning cart visitors.",
            "Add FAQ chunks for international shipping to resolve the remaining 10.6% support escalations.",
        ]
    }


def render_terminal_scorecard(audit: dict) -> None:
    grade = audit["overall_grade"]
    score = audit["composite_score"]
    status = audit["status"]
    bot_id = audit["bot_id"]
    days = audit["period_days"]

    print("\n" + "=" * 68)
    print(f"{BOLD}  🤖 CHATTY BOT PERFORMANCE SCORECARD & AUDIT REPORT{RESET}")
    print(f"{DIM}     Independent operational evaluation powered by PersonaliAI{RESET}")
    print("=" * 68)
    print(f"  Bot Instance : {CYAN}{bot_id}{RESET}")
    print(f"  Window       : Last {days} days")
    print(f"  Audit Time   : {audit['audit_timestamp']}")
    print("-" * 68)
    print(f"  OVERALL GRADE : [ {_color_grade(grade)} ]   COMPOSITE SCORE : {BOLD}{score}/100{RESET} ({status})")
    print("-" * 68)
    print(f"{BOLD}  OPERATIONAL PILLARS BREAKDOWN:{RESET}\n")

    for key, p in audit["pillars"].items():
        name = p.get("name", key.capitalize())
        s = p["score"]
        weight = p.get("weight", "")
        print(f"  {name.ljust(34)} {weight.ljust(5)} {_bar(s)} {str(s).rjust(5)}%")
        # Key metrics bullet
        metrics_strs = [f"{k.replace('_', ' ')}: {v}" for k, v in list(p.get("metrics", {}).items())[:3]]
        print(f"    {DIM}└─ {', '.join(metrics_strs)}{RESET}")

    print("\n" + "-" * 68)
    print(f"{BOLD}  📋 ACTIONABLE RECOMMENDATIONS TO IMPROVE SCORE:{RESET}")
    for i, rec in enumerate(audit.get("recommendations", []), 1):
        print(f"  {YELLOW}{i}.{RESET} {rec}")
    print("=" * 68 + "\n")


def render_markdown_scorecard(audit: dict) -> str:
    md = [
        f"# 🤖 Chatty Performance Scorecard: {audit['bot_id']}",
        f"\n**Overall Grade:** `{audit['overall_grade']}` | **Composite Score:** `{audit['composite_score']}/100` ({audit['status']})",
        f"**Audit Window:** Last {audit['period_days']} days | **Date:** {audit['audit_timestamp']}\n",
        "## 📊 Operational Pillars Breakdown\n",
        "| Operational Pillar | Weight | Score | Status | Key Metrics |",
        "|---|---|---|---|---|",
    ]
    for key, p in audit["pillars"].items():
        name = p.get("name", key.capitalize())
        s = p["score"]
        w = p.get("weight", "")
        status = "Optimal" if s >= 85 else ("Acceptable" if s >= 70 else "Needs Action")
        metrics_str = ", ".join(f"{k}: {v}" for k, v in list(p.get("metrics", {}).items())[:2])
        md.append(f"| **{name}** | {w} | **{s}%** | {status} | {metrics_str} |")

    md.append("\n## 🎯 Prioritized Action Plan\n")
    for i, rec in enumerate(audit.get("recommendations", []), 1):
        md.append(f"{i}. {rec}")

    md.append("\n---\n*Generated by Chatty Performance Auditor CLI*")
    return "\n".join(md)


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit Chatty AI Chatbot performance with an A-F letter grade.")
    parser.add_argument("--bot-id", help="UUID or identifier of the chatbot to audit")
    parser.add_argument("--days", type=int, default=30, help="Audit timeframe in days (default: 30)")
    parser.add_argument("--sample", action="store_true", help="Run with synthetic sample benchmark data")
    parser.add_argument("--format", choices=["text", "json", "markdown"], default="text", help="Output format")
    parser.add_argument("--output", help="Optional path to write report file")

    args = parser.parse_args()

    if args.sample or not args.bot_id:
        audit = generate_sample_audit(args.bot_id or "demo-store-assistant")
    else:
        # In live mode, connect to Chatty backend API if configured
        api_url = os.environ.get("CHATTY_BACKEND_URL", "http://localhost:8000")
        import urllib.request
        import urllib.error
        endpoint = f"{api_url}/api/admin/analytics/scorecard?bot_id={args.bot_id}&days={args.days}"
        token = os.environ.get("CHATTY_API_KEY") or os.environ.get("SUPABASE_SECRET_KEY")
        headers = {}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        req = urllib.request.Request(endpoint, headers=headers)
        try:
            with urllib.request.urlopen(req) as resp:
                audit = json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            print(f"{YELLOW}Warning: Could not fetch live data from {endpoint} ({e}). Falling back to sample benchmark.{RESET}", file=sys.stderr)
            audit = generate_sample_audit(args.bot_id)

    if args.format == "json":
        output_text = json.dumps(audit, indent=2)
        print(output_text)
    elif args.format == "markdown":
        output_text = render_markdown_scorecard(audit)
        print(output_text)
    else:
        render_terminal_scorecard(audit)
        output_text = ""

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            if args.format == "text":
                # For file output of text format, write markdown for readability
                f.write(render_markdown_scorecard(audit))
            else:
                f.write(output_text)
        print(f"Report saved to {args.output}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
