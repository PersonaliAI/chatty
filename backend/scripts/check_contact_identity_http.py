"""Self-cleaning live identity acceptance. Creates one isolated temporary bot.

No AI calls, emails, booking changes or real customer conversations. Never prints
credentials. Requires database environment plus BYOK_ENCRYPTION_KEY. Creates a
temporary, passwordless test owner; never alters customer plan limits. Run only
against an authorized project.
"""
import hashlib
import json
import os
import secrets
import time
import uuid

import httpx
import jwt
import psycopg2
from cryptography.fernet import Fernet


def main():
    bot = str(uuid.uuid4())
    owner = str(uuid.uuid4())
    owner_email = f"identity-acceptance-{owner}@example.invalid"
    secret = secrets.token_urlsafe(48)
    connection = psycopg2.connect(host=os.environ["SUPABASE_DB_HOST"], user=os.environ["SUPABASE_DB_USER"],
        password=os.environ["SUPABASE_DB_PASSWORD"], dbname="postgres", port=os.environ.get("SUPABASE_DB_PORT", "5432"),
        sslmode="require", connect_timeout=30)
    client = httpx.Client(base_url=os.environ.get("CHATTY_ACCEPTANCE_API", "https://api.chatty.personaliai.com"), timeout=30)
    def api(method, path, token=None, body=None):
        return client.request(method, path, headers={"X-Chatty-Visitor": token} if token else {}, json=body)
    def identify(user, old=None):
        now = int(time.time())
        token = jwt.encode({"iss": "chatty-customer", "aud": f"chatty:{bot}", "sub": user,
            "iat": now, "exp": now + 120, "profile": {"name": "Acceptance visitor", "custom_attributes": {"plan": "test"}}}, secret, algorithm="HS256")
        response = api("POST", "/api/widget/identity", old, {"bot_id": bot, "identity_token": token})
        assert response.status_code == 200, f"Identify returned {response.status_code}"
        return response.json()
    def poll(value, session=None):
        return api("GET", f"/api/widget/poll?bot_id={bot}&session_id={session or value['session_id']}", value["visitor_token"])
    try:
        with connection:
            with connection.cursor() as cursor:
                cursor.execute("INSERT INTO auth.users(id,email,aud,role) VALUES(%s,%s,'authenticated','authenticated')", (owner, owner_email))
                cursor.execute("INSERT INTO public.chatty_bots(id,user_id,name,email_notify) VALUES(%s,%s,%s,false)", (bot, owner, "Identity acceptance (temporary)"))
                encrypted = Fernet(os.environ["BYOK_ENCRYPTION_KEY"].encode()).encrypt(secret.encode()).decode()
                cursor.execute("INSERT INTO public.chatty_contact_identity_settings(bot_id,signing_secret) VALUES(%s,%s)", (bot, encrypted))
        anonymous = api("POST", "/api/widget/identity", body={"bot_id": bot}).json()
        customer = identify("customer-a", anonymous["visitor_token"])
        second_device = identify("customer-a")
        assert poll(anonymous).status_code == 401, "Identification did not revoke anonymous family"
        with connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT count(*) FROM public.chatty_contacts WHERE bot_id=%s AND external_user_id='customer-a'", (bot,))
                assert cursor.fetchone()[0] == 1, "Duplicate verified contacts"
                cursor.execute("INSERT INTO public.chatty_sessions(bot_id,session_id,channel,status) VALUES(%s,%s,'web','open')", (bot, customer["session_id"]))
                cursor.execute("INSERT INTO public.chatty_conversations(bot_id,session_id,role,content,sender) VALUES(%s,%s,'assistant','Identity acceptance human reply','human')", (bot, customer["session_id"]))
        response = poll(customer)
        assert response.status_code == 200 and response.json()["messages"][0]["content"] == "Identity acceptance human reply"
        response = api("GET", f"/api/widget/poll?bot_id={bot}&session_id={customer['session_id']}")
        assert response.status_code == 401, "Unauthenticated transcript access"
        history = api("GET", f"/api/widget/identity/history?bot_id={bot}", second_device["visitor_token"])
        assert history.status_code == 200 and len(history.json()["conversations"]) == 1
        wrong_bot = api("GET", f"/api/widget/identity/history?bot_id={uuid.uuid4()}", customer["visitor_token"])
        assert wrong_bot.status_code == 401, "Cross-bot access"
        different = identify("customer-b", customer["visitor_token"])
        assert poll(different, customer["session_id"]).status_code == 403, "Cross-customer conversation access"
        assert poll(customer).status_code == 401, "Account switching did not revoke prior family"
        new_conversation = api("POST", "/api/widget/identity", second_device["visitor_token"], {"bot_id": bot, "new_conversation": True}).json()
        response = api("POST", "/api/widget/identity/logout", new_conversation["visitor_token"], {"bot_id": bot})
        assert response.status_code == 200
        assert poll(second_device).status_code == 401, "Logout missed a prior family credential"
        print("PASS: signed identity, cross-device dedupe/history, human reply delivery, cross-bot/contact denial, account switching and family logout")
    finally:
        connection.rollback()
        with connection:
            with connection.cursor() as cursor:
                # Exact UUID generated by this run only; FK cascades fixture data.
                cursor.execute("DELETE FROM public.chatty_bots WHERE id=%s AND name=%s", (bot, "Identity acceptance (temporary)"))
                cursor.execute("DELETE FROM auth.users WHERE id=%s AND email=%s", (owner, owner_email))
        client.close()
        connection.close()
        print("Temporary acceptance bot and passwordless owner removed")


if __name__ == "__main__":
    main()
