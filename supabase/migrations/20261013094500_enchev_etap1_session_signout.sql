-- ENCHEV demo QA: log out a single browser device without terminating
-- a different device belonging to the same invited bidder role.
-- Keep historical session identifiers for bid audit; only expire heartbeat.
create or replace function public.etap1_device_signout(
  p_actor text,p_session_id uuid
) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_room public.enchev_etap1_rooms%rowtype;
  v_now timestamptz:=clock_timestamp();
begin
  if p_actor not in ('mitko','borko','enchev') or p_session_id is null then
    return false;
  end if;
  select * into v_room from public.enchev_etap1_rooms
    where name='stage-one' for update;
  update public.enchev_etap1_device_sessions
    set last_seen=v_now-interval '1 minute'
    where role=p_actor and session_id=p_session_id;
  if not found then return false; end if;
  if not exists(
    select 1 from public.enchev_etap1_device_sessions
    where role=p_actor and last_seen>=v_now-interval '15 seconds'
  ) then
    update public.enchev_etap1_presence
      set is_ready=false,last_seen=v_now-interval '1 minute'
      where role=p_actor;
  end if;
  return true;
end;
$$;
revoke all on function public.etap1_device_signout(text,uuid)
  from public,anon,authenticated;
grant execute on function public.etap1_device_signout(text,uuid) to service_role;
