-- Give new guests 30,000 EUR of fake money and a matching spending limit
-- so they may join the lobby and press ГОТОВ immediately.
-- Never changes real buyer payments, wallet transfers or existing demo history.
create or replace function public.etap1_ready_lobby_secure(
  p_actor text,p_session_id uuid,p_ready boolean default null,p_rejoin boolean default false
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_now timestamptz:=clock_timestamp();
  v_room public.enchev_etap1_rooms%rowtype;
  v_state jsonb; v_status text; v_count integer; v_ready_count integer;
  v_people jsonb; v_id uuid; v_admitted boolean:=false; v_wallet jsonb:=null;
  v_devices integer:=0; v_guest_mode boolean:=false; v_required integer:=3;
begin
  if p_actor not in ('mitko','borko','enchev','guest1','guest2','guest3','guest4','guest5','admin') then
    raise exception 'Invalid demo role';
  end if;
  if p_actor='admin' then
    if p_ready is not null or p_rejoin then raise exception 'Admin is read-only'; end if;
  elsif p_session_id is null then
    raise exception 'Missing session';
  end if;
  insert into public.enchev_etap1_rooms(name) values('stage-one')
    on conflict(name) do nothing;
  select * into v_room from public.enchev_etap1_rooms where name='stage-one' for update;
  v_state:=public.etap1_snapshot(); v_status:=v_state->>'status';
  if p_actor<>'admin' then
    if p_ready is not null and not p_rejoin and v_status in ('live','countdown') then
      raise exception 'Cannot change READY during active round';
    end if;
    if p_rejoin then
      if p_ready is distinct from false then raise exception 'Login cannot auto READY'; end if;
      insert into public.enchev_etap1_device_sessions(role,session_id,last_seen)
        values(p_actor,p_session_id,v_now)
        on conflict(session_id) do update set last_seen=excluded.last_seen;
      insert into public.enchev_etap1_presence(role,session_id,is_ready,last_seen)
        values(p_actor,p_session_id,false,v_now)
        on conflict(role) do update set session_id=excluded.session_id,
          is_ready=case when public.enchev_etap1_presence.last_seen<v_now-interval '15 seconds'
            then false else public.enchev_etap1_presence.is_ready end,
          last_seen=v_now;
      insert into public.enchev_etap1_demo_wallets(role,session_id,buying_power,lot_budget)
        values(p_actor,p_session_id,
          case when p_actor in ('guest1','guest2','guest3','guest4','guest5') then 30000 else 10000 end,
          case when p_actor in ('guest1','guest2','guest3','guest4','guest5') then 30000 else 10000 end)
        on conflict(role) do nothing;
    else
      update public.enchev_etap1_device_sessions set last_seen=v_now
        where role=p_actor and session_id=p_session_id;
      if not found then
        return jsonb_build_object('lobby',jsonb_build_object(
          'sessionCurrent',false,'admitted',false),'state',v_state);
      end if;
      update public.enchev_etap1_presence set
        last_seen=v_now,
        is_ready=case when p_ready is not null then p_ready
          when last_seen<v_now-interval '15 seconds' then false else is_ready end
        where role=p_actor;
    end if;
  end if;

  select exists(select 1 from public.enchev_etap1_device_sessions ds
    where ds.role in ('guest1','guest2','guest3','guest4','guest5')
      and ds.last_seen>=v_now-interval '15 seconds') into v_guest_mode;
  v_required:=case when v_guest_mode then 2 else 3 end;
  select count(*),count(*) filter(where p.is_ready) into v_count,v_ready_count
  from public.enchev_etap1_presence p
  where ((not v_guest_mode and p.role in ('mitko','borko','enchev')) or (v_guest_mode and p.role in ('enchev','guest1','guest2','guest3','guest4','guest5')))
    and exists(select 1 from public.enchev_etap1_device_sessions ds
      where ds.role=p.role and ds.last_seen>=v_now-interval '15 seconds');
  if p_actor<>'admin' and p_ready is true and v_status not in ('live','countdown')
    and v_count>=v_required and v_ready_count=v_count
    and (not v_guest_mode or p_actor in ('enchev','guest1','guest2','guest3','guest4','guest5'))
    and (select count(*) from public.enchev_etap1_demo_wallets w
      join public.enchev_etap1_presence p on p.role=w.role
      where ((not v_guest_mode and p.role in ('mitko','borko','enchev')) or (v_guest_mode and p.role in ('enchev','guest1','guest2','guest3','guest4','guest5'))) and p.is_ready and w.lot_budget>=16300 and w.buying_power>=16300
      and exists(select 1 from public.enchev_etap1_device_sessions ds
        where ds.role=p.role and ds.last_seen>=v_now-interval '15 seconds'))=v_count
  then
    insert into public.enchev_etap1_auctions
      (title,opening_amount,current_amount,increment,started_at,ends_at,status,min_participants)
      values('2026 Mercedes-AMG G 63 — DEMO',16250,16250,50,
        v_now+interval '30 seconds',v_now+interval '150 seconds','countdown',v_required)
      returning id into v_id;
    update public.enchev_etap1_rooms set active_auction_id=v_id
      where name='stage-one';
    insert into public.enchev_etap1_admissions(auction_id,role,session_id)
      select v_id,p.role,p.session_id from public.enchev_etap1_presence p
      where ((not v_guest_mode and p.role in ('mitko','borko','enchev')) or (v_guest_mode and p.role in ('enchev','guest1','guest2','guest3','guest4','guest5'))) and p.is_ready
       and exists(select 1 from public.enchev_etap1_device_sessions ds
        where ds.role=p.role and ds.last_seen>=v_now-interval '15 seconds');
    update public.enchev_etap1_presence set is_ready=false
      where role in ('mitko','borko','enchev','guest1','guest2','guest3','guest4','guest5');
  end if;
  select exists(select 1 from public.enchev_etap1_device_sessions ds
    where ds.role in ('guest1','guest2','guest3','guest4','guest5')
      and ds.last_seen>=v_now-interval '15 seconds') into v_guest_mode;
  v_required:=case when v_guest_mode then 2 else 3 end;
  select count(*),count(*) filter(where p.is_ready) into v_count,v_ready_count
  from public.enchev_etap1_presence p
  where ((not v_guest_mode and p.role in ('mitko','borko','enchev')) or (v_guest_mode and p.role in ('enchev','guest1','guest2','guest3','guest4','guest5')))
    and exists(select 1 from public.enchev_etap1_device_sessions ds
      where ds.role=p.role and ds.last_seen>=v_now-interval '15 seconds');
  select coalesce(jsonb_agg(jsonb_build_object('role',p.role,'ready',p.is_ready)
      order by p.role),'[]'::jsonb) into v_people
  from public.enchev_etap1_presence p
  where ((not v_guest_mode and p.role in ('mitko','borko','enchev')) or (v_guest_mode and p.role in ('enchev','guest1','guest2','guest3','guest4','guest5')))
    and exists(select 1 from public.enchev_etap1_device_sessions ds
      where ds.role=p.role and ds.last_seen>=v_now-interval '15 seconds');
  select active_auction_id into v_id from public.enchev_etap1_rooms where name='stage-one';
  if p_actor<>'admin' then
    select exists(select 1 from public.enchev_etap1_admissions a
        where a.auction_id=v_id and a.role=p_actor) into v_admitted;
    select jsonb_build_object('buyingPower',w.buying_power,'lotBudget',w.lot_budget)
      into v_wallet from public.enchev_etap1_demo_wallets w where w.role=p_actor;
    select count(*) into v_devices from public.enchev_etap1_device_sessions ds
      where ds.role=p_actor and ds.last_seen>=v_now-interval '15 seconds';
  end if;
  return jsonb_build_object('lobby',jsonb_build_object(
    'participants',v_people,'count',v_count,'readyCount',v_ready_count,
    'minPlayers',v_required,'sessionCurrent',true,'admitted',v_admitted,'wallet',v_wallet,
    'activeDevices',v_devices),'state',public.etap1_snapshot());
end;
$$;
revoke all on function public.etap1_ready_lobby_secure(text,uuid,boolean,boolean) from public,anon,authenticated;
grant execute on function public.etap1_ready_lobby_secure(text,uuid,boolean,boolean) to service_role;