#!/usr/bin/env python3
"""Chatty Template Importer CLI.

Reads an industry starter template JSON file and provisions a fully-configured
chatbot with system prompt, custom styling, and seeded knowledge base chunks.

Usage:
    python scripts/import_template.py --template templates/ecommerce-store.json --dry-run
    python scripts/import_template.py --template templates/ecommerce-store.json [--backend http://localhost:8000]
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.request
import urllib.error

# ANSI styling
CYAN = "\033[96m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
BOLD = "\033[1m"
RESET = "\033[0m"


def main() -> int:
    parser = argparse.ArgumentParser(description="Import a production Chatty bot template.")
    parser.add_argument("--template", required=True, help="Path to template JSON file")
    parser.add_argument("--backend", default=os.environ.get("CHATTY_BACKEND_URL", "http://localhost:8000"), help="Chatty backend base URL")
    parser.add_argument("--token", default=os.environ.get("CHATTY_API_KEY") or os.environ.get("SUPABASE_SECRET_KEY"), help="API token / secret key")
    parser.add_argument("--dry-run", action="store_true", help="Validate and print template details without applying")

    args = parser.parse_args()

    if not os.path.exists(args.template):
        print(f"Error: Template file '{args.template}' not found.", file=sys.stderr)
        return 1

    with open(args.template, "r", encoding="utf-8") as f:
        template = json.load(f)

    meta = template.get("metadata", {})
    cfg = template.get("bot_config", {})
    kb = template.get("knowledge_base", [])

    print("\n" + "=" * 64)
    print(f"{BOLD}  🤖 CHATTY TEMPLATE IMPORTER{RESET}")
    print("=" * 64)
    print(f"  Template Name : {CYAN}{meta.get('name')}{RESET}")
    print(f"  Category      : {meta.get('category')}")
    print(f"  Description   : {meta.get('description')}")
    print(f"  Bot Name      : {cfg.get('name')}")
    print(f"  Model         : {cfg.get('selected_model')}")
    print(f"  Color Theme   : {cfg.get('primary_color')}")
    print(f"  Knowledge Docs: {len(kb)} articles")
    print("-" * 64)

    if args.dry_run:
        print(f"{GREEN}[DRY-RUN]{RESET} Template validated successfully. No changes made.")
        print(f"Sample Prompts:")
        for p in template.get("sample_prompts", []):
            print(f"  • {p}")
        print("=" * 64 + "\n")
        return 0

    if not args.token:
        print(f"{YELLOW}Warning: Neither CHATTY_API_KEY nor SUPABASE_SECRET_KEY is set.{RESET}")
        print(f"Please set your authentication token or pass --token <KEY> to apply to live server.")
        return 1

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {args.token}"
    }

    # 1. Create bot
    create_url = f"{args.backend.rstrip('/')}/api/bots"
    create_payload = json.dumps({
        "name": cfg.get("name"),
        "welcome_message": cfg.get("welcome_message"),
        "system_instructions": cfg.get("system_instructions"),
        "selected_model": cfg.get("selected_model", "gemini-2.5-flash"),
        "primary_color": cfg.get("primary_color", "#111827"),
        "response_language": cfg.get("response_language", "en")
    }).encode("utf-8")

    req = urllib.request.Request(create_url, data=create_payload, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            bot_resp = json.loads(resp.read().decode("utf-8"))
            bot_id = bot_resp.get("id") or bot_resp.get("bot_id")
            print(f"{GREEN}✓ Successfully created bot:{RESET} {bot_id}")
    except urllib.error.HTTPError as e:
        print(f"Failed to create bot: HTTP {e.code} - {e.read().decode('utf-8')}", file=sys.stderr)
        return 1
    except Exception as e:
        print(f"Failed to connect to backend at {create_url}: {e}", file=sys.stderr)
        return 1

    # 2. Add knowledge base articles
    for item in kb:
        kb_url = f"{args.backend.rstrip('/')}/api/bots/{bot_id}/knowledge/text"
        kb_payload = json.dumps({
            "name": item.get("name"),
            "content": item.get("content")
        }).encode("utf-8")
        kb_req = urllib.request.Request(kb_url, data=kb_payload, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(kb_req) as resp:
                print(f"  {GREEN}✓ Seeded knowledge:{RESET} {item.get('name')}")
        except Exception as e:
            print(f"  {YELLOW}⚠ Warning: Could not seed knowledge '{item.get('name')}': {e}{RESET}")

    print("\n" + "=" * 64)
    print(f"{GREEN}{BOLD}🎉 TEMPLATE IMPORT COMPLETE!{RESET}")
    print(f"  Bot ID: {CYAN}{bot_id}{RESET}")
    print(f"  Test your bot in the dashboard at:")
    print(f"  http://localhost:3000/dashboard?bot_id={bot_id}")
    print("=" * 64 + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
