-- Publish a Flow Builder version atomically with bot deployment metadata.
-- This prevents a failed audit insert from leaving a bot on an untracked graph.
create or replace function public.publish_chatty_flow_version(
  p_bot_id uuid,
  p_version integer,
  p_flow_data jsonb,
  p_note text,
  p_created_by uuid,
  p_custom_js text
)
returns setof public.chatty_flow_versions
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_flow_data is null or p_custom_js is null then
    raise exception using errcode = '22023', message = 'flow publish payload is incomplete';
  end if;

  update public.chatty_flow_versions
  set status = 'draft'
  where bot_id = p_bot_id and status = 'published';

  update public.chatty_bots
  set custom_js = p_custom_js
  where id = p_bot_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'bot not found';
  end if;

  return query
  insert into public.chatty_flow_versions (
    bot_id, version, status, flow_data, note, created_by, published_at
  ) values (
    p_bot_id, p_version, 'published', p_flow_data, p_note, p_created_by, now()
  )
  returning *;
end;
$$;

revoke all on function public.publish_chatty_flow_version(uuid, integer, jsonb, text, uuid, text) from public;
grant execute on function public.publish_chatty_flow_version(uuid, integer, jsonb, text, uuid, text) to service_role;
