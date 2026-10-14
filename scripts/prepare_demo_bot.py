#!/usr/bin/env python3
"""Chatty Outreach Demo Bot Generator CLI.

Automates the creation of pre-trained claimable demo bots for cold outreach (Product Hunt launches, etc.):
1. Creates a bot under the admin/incubator account with matching brand identity.
2. Generates a secure, unique /claim/ link.
3. Automatically indexes target website sources into the knowledge base.
4. Outputs the claim link and personalized outreach email + Twitter/LinkedIn DM templates.

Usage:
    python scripts/prepare_demo_bot.py --name "Supadata" --url "https://supadata.ai" [--color "#2563eb"]
"""

from __future__ import annotations

import argparse
import os
import secrets
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Add backend to path so we can reuse app core clients and services
backend_path = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from app.core.clients import supabase
from app.core.config import FRONTEND_URL


def prepare_demo_bot(
    target_name: str,
    target_url: str,
    primary_color: str = "#0f172a",
    welcome_message: str | None = None,
    admin_user_id: str | None = None,
) -> dict:
    if not target_url.startswith("http"):
        target_url = f"https://{target_url}"

    # Generate crypto-secure claim token and 14-day expiration
    claim_token = f"clm_{secrets.token_urlsafe(16)}"
    expires_at = (datetime.now(timezone.utc) + timedelta(days=14)).isoformat()

    welcome = (
        welcome_message
        or f"Hello! I am {target_name}'s AI assistant. Ask me anything about our features, pricing, or docs."
    )

    system_inst = (
        f"You are the official customer support AI assistant for {target_name} ({target_url}). "
        f"Only answer questions based on the company's verified knowledge. Be polite, concise, and helpful."
    )

    prompts = [
        f"What is {target_name} and what problem does it solve?",
        "What are your pricing plans and features?",
        "How do I sign up or get started?",
    ]

    # If no admin_user_id provided, fetch first user from users table
    if not admin_user_id:
        res = supabase.table("users").select("auth_user_id").limit(1).execute()
        if res.data:
            admin_user_id = res.data[0]["auth_user_id"]
        else:
            raise RuntimeError("No admin user found in database. Create a user first.")

    bot_payload = {
        "user_id": admin_user_id,
        "name": f"{target_name} Assistant",
        "welcome_message": welcome,
        "system_instructions": system_inst,
        "selected_model": "gemini-2.5-flash",
        "primary_color": primary_color,
        "claim_token": claim_token,
        "claim_status": "unclaimed",
        "demo_target_name": target_name,
        "demo_target_url": target_url,
        "demo_expires_at": expires_at,
        "suggested_prompts": prompts,
    }

    # Insert bot
    bot_res = supabase.table("chatty_bots").insert(bot_payload).execute()
    if not bot_res.data:
        raise RuntimeError("Failed to create demo bot row in chatty_bots.")

    bot = bot_res.data[0]
    bot_id = bot["id"]

    # Register initial URL source for crawling
    source_payload = {
        "bot_id": bot_id,
        "type": "url",
        "name": f"{target_name} Homepage",
        "content": f"Target website URL: {target_url}",
        "status": "training",
    }
    supabase.table("chatty_sources").insert(source_payload).execute()

    base_frontend = (FRONTEND_URL or "https://chatty.personaliai.com").rstrip("/")
    claim_url = f"{base_frontend}/claim/{claim_token}"

    email_subject = f"Congrats on launching {target_name}! (+ pre-trained an AI assistant for you)"
    email_body = f"""Hi,

Huge congrats on launching {target_name}!

Launch traffic usually brings dozens of repetitive visitor questions about pricing, features, and integrations.

To help out, I pre-trained a 24/7 AI customer support assistant specifically on {target_url}.

You and your team can test it live in this interactive sandbox (zero signup or login required):
👉 {claim_url}

Try asking it about your pricing or how specific features work.

If you like how it answers, you can claim this assistant with 1 click and drop the 1-line script onto your site.

Best,
Founder, Chatty (chatty.personaliai.com)"""

    dm_pitch = f"""Hey! Huge congrats on launching {target_name}! Saw your launch and loved the concept.

Pre-trained an AI support assistant on {target_url} to help answer launch traffic questions. You can test it live here with zero signup: {claim_url}"""

    return {
        "bot_id": bot_id,
        "claim_token": claim_token,
        "claim_url": claim_url,
        "expires_at": expires_at,
        "email_subject": email_subject,
        "email_body": email_body,
        "dm_pitch": dm_pitch,
    }


def main():
    parser = argparse.ArgumentParser(description="Create a claimable pre-trained demo bot for cold outreach.")
    parser.add_argument("--name", required=True, help="Target company or startup name (e.g. Supadata)")
    parser.add_argument("--url", required=True, help="Target website URL (e.g. https://supadata.ai)")
    parser.add_argument("--color", default="#0f172a", help="Primary brand hex color (e.g. #2563eb)")
    parser.add_argument("--user-id", help="Admin user UUID (optional, defaults to first user in DB)")

    args = parser.parse_args()

    try:
        res = prepare_demo_bot(
            target_name=args.name,
            target_url=args.url,
            primary_color=args.color,
            admin_user_id=args.user_id,
        )

        print("\n" + "=" * 65)
        print(f"✅ Demo Assistant Created for {args.name}")
        print("=" * 65)
        print(f"Bot ID:       {res['bot_id']}")
        print(f"Claim Token:  {res['claim_token']}")
        print(f"Public Link:  {res['claim_url']}")
        print(f"Expires At:   {res['expires_at']}")
        print("-" * 65)
        print(f"\n📧 EMAIL SUBJECT:\n{res['email_subject']}")
        print(f"\n📧 EMAIL BODY:\n{res['email_body']}")
        print("-" * 65)
        print(f"\n💬 TWITTER / LINKEDIN DM:\n{res['dm_pitch']}")
        print("=" * 65 + "\n")

    except Exception as exc:
        print(f"❌ Error creating demo bot: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
