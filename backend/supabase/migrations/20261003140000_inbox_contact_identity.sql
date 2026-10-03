-- Private, bot-scoped contacts. No browser database grants, no email merging.
CREATE TABLE public.chatty_contact_identity_settings (
  bot_id uuid PRIMARY KEY REFERENCES public.chatty_bots(id) ON DELETE CASCADE,
  signing_secret text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.chatty_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL REFERENCES public.chatty_bots(id) ON DELETE CASCADE,
  external_user_id text,
  profile jsonb NOT NULL DEFAULT '{}',
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(bot_id, external_user_id), UNIQUE(bot_id, id),
  CHECK (octet_length(profile::text) <= 16384)
);
CREATE TABLE public.chatty_visitor_credentials (
  token_hash text PRIMARY KEY,
  bot_id uuid NOT NULL,
  contact_id uuid NOT NULL,
  session_id text NOT NULL,
  family_id uuid NOT NULL DEFAULT gen_random_uuid(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  FOREIGN KEY(bot_id, contact_id) REFERENCES public.chatty_contacts(bot_id,id) ON DELETE CASCADE,
  UNIQUE(bot_id, session_id)
);
CREATE INDEX chatty_contact_history ON public.chatty_visitor_credentials(bot_id,contact_id);
CREATE INDEX chatty_credential_expiry ON public.chatty_visitor_credentials(expires_at);
ALTER TABLE public.chatty_contact_identity_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatty_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatty_visitor_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chatty_contact_identity_settings, public.chatty_contacts, public.chatty_visitor_credentials FROM anon, authenticated;
GRANT ALL ON public.chatty_contact_identity_settings, public.chatty_contacts, public.chatty_visitor_credentials TO service_role;

-- ON CONFLICT serializes same-user identification without email-based merges.
CREATE FUNCTION public.chatty_create_visitor(p_bot uuid, p_external text, p_profile jsonb,
  p_hash text, p_session text, p_expires timestamptz) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE contact uuid;
BEGIN
  IF p_external IS NULL THEN
    INSERT INTO public.chatty_contacts(bot_id,profile) VALUES(p_bot,p_profile) RETURNING id INTO contact;
  ELSE
    INSERT INTO public.chatty_contacts(bot_id,external_user_id,profile) VALUES(p_bot,p_external,p_profile)
      ON CONFLICT(bot_id,external_user_id) DO UPDATE SET profile=EXCLUDED.profile,last_seen_at=now()
      RETURNING id INTO contact;
  END IF;
  INSERT INTO public.chatty_visitor_credentials(token_hash,bot_id,contact_id,session_id,expires_at)
    VALUES(p_hash,p_bot,contact,p_session,p_expires);
  RETURN contact;
END $$;
REVOKE ALL ON FUNCTION public.chatty_create_visitor(uuid,text,jsonb,text,text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.chatty_create_visitor(uuid,text,jsonb,text,text,timestamptz) TO service_role;

CREATE FUNCTION public.chatty_rotate_identity(p_bot uuid, p_secret text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.chatty_contact_identity_settings(bot_id,signing_secret) VALUES(p_bot,p_secret)
    ON CONFLICT(bot_id) DO UPDATE SET signing_secret=EXCLUDED.signing_secret,updated_at=now();
  UPDATE public.chatty_visitor_credentials SET revoked_at=now() WHERE bot_id=p_bot;
END $$;
REVOKE ALL ON FUNCTION public.chatty_rotate_identity(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.chatty_rotate_identity(uuid,text) TO service_role;

CREATE FUNCTION public.chatty_erase_contact(p_bot uuid, p_contact uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  DELETE FROM public.chatty_conversations WHERE bot_id=p_bot AND session_id IN
    (SELECT session_id FROM public.chatty_visitor_credentials WHERE bot_id=p_bot AND contact_id=p_contact);
  DELETE FROM public.chatty_leads WHERE bot_id=p_bot AND session_id IN
    (SELECT session_id FROM public.chatty_visitor_credentials WHERE bot_id=p_bot AND contact_id=p_contact);
  DELETE FROM public.chatty_sessions WHERE bot_id=p_bot AND session_id IN
    (SELECT session_id FROM public.chatty_visitor_credentials WHERE bot_id=p_bot AND contact_id=p_contact);
  DELETE FROM public.chatty_contacts WHERE bot_id=p_bot AND id=p_contact;
END $$;
REVOKE ALL ON FUNCTION public.chatty_erase_contact(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.chatty_erase_contact(uuid,uuid) TO service_role;
