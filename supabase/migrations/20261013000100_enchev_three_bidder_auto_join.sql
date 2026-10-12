-- ENCHEV private Preview: exactly Mitko + Borko + Enchev can BID.
-- Admin is an independent view-only observer; Krum is no longer an invited role.
-- Legacy Krum auction rows are preserved; no historical bids are deleted.
-- First round auto-starts when the three signed-in participants have joined.
-- Subsequent rounds require a fresh explicit READY; never auto-loop after WINNER.

alter table public.enchev_etap1_bids
  drop constraint if exists enchev_etap1_bids_actor_check;
alter table public.enchev_etap1_bids
  add constraint enchev_etap1_bids_actor_check
  check (actor in ('mitko','borko','enchev','krum'));

alter table public.enchev_etap1_auctions
  drop constraint if exists enchev_etap1_auctions_leading_role_check;
alter table public.enchev_etap1_auctions
  add constraint enchev_etap1_auctions_leading_role_check
  check (leading_role in ('mitko','borko','enchev','krum'));

CREATE OR REPLACE FUNCTION public.etap1_bid(p_actor text, p_nonce uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_room public.enchev_etap1_rooms%rowtype;
  v_auction public.enchev_etap1_auctions%rowtype;
  v_existing uuid;
  v_now timestamptz;
  v_new_amount numeric(12,2);
begin
  if p_actor is null or p_actor not in ('mitko','borko','enchev') or p_nonce is null then
    raise exception 'Invalid demo bidder or idempotency key';
  end if;
  select * into v_room from public.enchev_etap1_rooms
    where name='stage-one' for update;
  if not found or v_room.active_auction_id is null then
    raise exception 'No active demo auction';
  end if;
  select * into v_auction from public.enchev_etap1_auctions
    where id=v_room.active_auction_id for update;
  select id into v_existing from public.enchev_etap1_bids
    where auction_id=v_auction.id and actor=p_actor and request_nonce=p_nonce;
  if found then return public.etap1_snapshot(); end if;

  v_now:=clock_timestamp();
  if v_auction.status<>'live' or v_now>=v_auction.ends_at then
    raise exception 'Auction has ended';
  end if;
  v_new_amount:=v_auction.current_amount+v_auction.increment;
  insert into public.enchev_etap1_bids(auction_id,actor,request_nonce,sequence,amount)
    values(v_auction.id,p_actor,p_nonce,v_auction.bid_sequence+1,v_new_amount);
  update public.enchev_etap1_auctions
    set current_amount=v_new_amount,
        bid_sequence=bid_sequence+1,
        leading_role=p_actor,
        ends_at=case when ends_at-v_now < interval '10 seconds'
          then v_now+interval '10 seconds' else ends_at end
    where id=v_auction.id;
  return public.etap1_snapshot();
end;
$function$


CREATE OR REPLACE FUNCTION public.etap1_ready_lobby_secure(p_actor text, p_session_id uuid, p_ready boolean DEFAULT NULL::boolean, p_rejoin boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_now timestamptz := clock_timestamp();
  v_room public.enchev_etap1_rooms%rowtype;
  v_active public.enchev_etap1_auctions%rowtype;
  v_running boolean := false;
  v_count integer;
  v_ready_count integer;
  v_people jsonb;
  v_auction_id uuid;
  v_admitted boolean := false;
begin
  if p_actor is null or p_actor not in ('mitko','borko','enchev','admin') then
    raise exception 'Invalid demo participant';
  end if;
  if p_actor='admin' then
    if p_ready is not null or p_rejoin then
      raise exception 'Admin cannot READY or rejoin';
    end if;
  elsif p_session_id is null then
    raise exception 'Participant session required';
  end if;

  insert into public.enchev_etap1_rooms(name) values ('stage-one')
    on conflict (name) do nothing;
  -- Lock order consistent with etap1_bid, etap1_snapshot and old lobby RPC:
  -- singleton room first, then active auction.
  select * into v_room from public.enchev_etap1_rooms
    where name='stage-one' for update;
  if v_room.active_auction_id is not null then
    select * into v_active from public.enchev_etap1_auctions
      where id=v_room.active_auction_id for update;
    if v_active.status='live' and v_active.ends_at<=v_now then
      update public.enchev_etap1_auctions
        set status='closed',closed_at=v_now
        where id=v_active.id returning * into v_active;
    end if;
    v_running:=v_active.status='live' and v_active.ends_at>v_now;
  end if;

  if p_actor<>'admin' then
    if p_rejoin then
      if p_ready is distinct from false then
        raise exception 'Login must reset READY';
      end if;
      -- Re-login invalidates the role's prior device session and any stale READY.
      insert into public.enchev_etap1_presence(role,session_id,is_ready,last_seen)
        values (p_actor,p_session_id,false,v_now)
      on conflict(role) do update set
        session_id=excluded.session_id,is_ready=false,last_seen=excluded.last_seen;
    else
      -- A stale tab MUST NOT steal back the role or update its READY flag.
      update public.enchev_etap1_presence set
        is_ready=case
          when p_ready is not null then p_ready
          when last_seen < v_now-interval '15 seconds' then false
          else is_ready
        end,
        last_seen=v_now
      where role=p_actor and session_id=p_session_id;
      if not found then
        -- An older browser session cannot take over the same role.
        -- Tell the API to show LOGIN again without turning a 503 into an auth error.
        return jsonb_build_object(
          'lobby',jsonb_build_object('sessionCurrent',false,'admitted',false),
          'state',public.etap1_snapshot());
      end if;
      if v_running and p_ready is not null then
        raise exception 'Cannot READY during active auction';
      end if;
    end if;
  end if;

  select count(*),count(*) filter(where is_ready)
    into v_count,v_ready_count
  from public.enchev_etap1_presence
  where role in ('mitko','borko','enchev') and last_seen>=v_now-interval '15 seconds' and session_id is not null;

  -- CRITICAL: polling GET, refresh, and login can NEVER auto-start a round.
  -- Only the final explicit READY button press can start it.
  if p_ready is true and not v_running and v_count = 3
      and v_ready_count=v_count
      and exists (select 1 from public.enchev_etap1_presence p
        where p.role='mitko' and p.session_id is not null
          and p.last_seen>=v_now-interval '15 seconds')
      and exists (select 1 from public.enchev_etap1_presence p
        where p.role='borko' and p.session_id is not null
          and p.last_seen>=v_now-interval '15 seconds')
      and exists (select 1 from public.enchev_etap1_presence p
        where p.role='enchev' and p.session_id is not null
          and p.last_seen>=v_now-interval '15 seconds') then
    insert into public.enchev_etap1_auctions
      (title,opening_amount,current_amount,increment,started_at,ends_at)
      values ('2026 Volkswagen Golf GTI — DEMO',16250,16250,100,
              v_now,v_now+interval '120 seconds')
      returning id into v_auction_id;
    update public.enchev_etap1_rooms
      set active_auction_id=v_auction_id where name='stage-one';
    -- Freeze exactly WHICH sessions pressed READY for this round.
    insert into public.enchev_etap1_admissions(auction_id,role,session_id)
      select v_auction_id,p.role,p.session_id
      from public.enchev_etap1_presence p
      where p.role in ('mitko','borko','enchev') and p.is_ready
        and p.session_id is not null
        and p.last_seen>=v_now-interval '15 seconds';
    update public.enchev_etap1_presence
      set is_ready=false
      where role in ('mitko','borko','enchev') and last_seen>=v_now-interval '15 seconds';
    v_running:=true;
    v_room.active_auction_id:=v_auction_id;
  end if;

  select count(*),count(*) filter(where is_ready)
    into v_count,v_ready_count
  from public.enchev_etap1_presence
  where role in ('mitko','borko','enchev') and last_seen>=v_now-interval '15 seconds' and session_id is not null;
  select coalesce(jsonb_agg(jsonb_build_object(
     'role',p.role,'ready',p.is_ready) order by p.role),'[]'::jsonb)
    into v_people
  from public.enchev_etap1_presence p
  where p.role in ('mitko','borko','enchev') and p.last_seen>=v_now-interval '15 seconds' and p.session_id is not null;

  if p_actor<>'admin' and v_room.active_auction_id is not null then
    select exists(
      select 1 from public.enchev_etap1_admissions a
      where a.auction_id=v_room.active_auction_id
        and a.role=p_actor and a.session_id=p_session_id
    ) into v_admitted;
  end if;

  return jsonb_build_object(
    'lobby',jsonb_build_object('participants',v_people,
      'count',v_count,'readyCount',v_ready_count,'minPlayers',3,
      'sessionCurrent',true,'admitted',v_admitted),
    'state',public.etap1_snapshot()
  );
end;
$function$


CREATE OR REPLACE FUNCTION public.etap1_bid_admitted(p_actor text, p_session_id uuid, p_nonce uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_room public.enchev_etap1_rooms%rowtype;
begin
  if p_actor not in ('mitko','borko','enchev')
      or p_session_id is null or p_nonce is null then
    raise exception 'Invalid demo bidder session';
  end if;
  select * into v_room from public.enchev_etap1_rooms
    where name='stage-one' for update;
  if not found or v_room.active_auction_id is null then
    raise exception 'No active demo auction';
  end if;
  if not exists (
    select 1 from public.enchev_etap1_admissions a
    join public.enchev_etap1_presence p on p.role=a.role
    where a.auction_id=v_room.active_auction_id
      and a.role=p_actor and a.session_id=p_session_id
      and p.session_id=p_session_id
  ) then
    raise exception 'Join the lobby and be admitted for the next auction before bidding';
  end if;
  return public.etap1_bid(p_actor,p_nonce);
end;
$function$


create or replace function public.etap1_join_lobby_automatic(
  p_actor text, p_session_id uuid
) returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare
  v_first jsonb;
begin
  if p_actor not in ('mitko','borko','enchev') or p_session_id is null then
    raise exception 'Only the three designated demo bidders can join';
  end if;
  -- New sign-in invalidates the previous browser session for that role.
  -- First mark the new session NOT READY, so stale sessions cannot bid.
  v_first := public.etap1_ready_lobby_secure(p_actor,p_session_id,false,true);
  -- Do not admit new arrivals to a running round.
  if v_first->'state'->>'status' = 'live' then
    return v_first;
  end if;
  -- Automatically READY on explicit LOGIN, but never on polling or refresh.
  -- Exactly the THIRD designated login starts the auction atomically.
  -- After WINNER, nobody auto-restarts: existing sessions must READY again.
  return public.etap1_ready_lobby_secure(p_actor,p_session_id,true,false);
end;
$$;
revoke all on function public.etap1_join_lobby_automatic(text,uuid)
  from public,anon,authenticated;
grant execute on function public.etap1_join_lobby_automatic(text,uuid)
  to service_role;
