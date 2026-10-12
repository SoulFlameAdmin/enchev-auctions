-- ENCHEV ETAP 1: session-scoped READY-to-bid admission.
-- A successful LOGIN is not equivalent to pressing READY. Re-login resets
-- the old session's readiness; rejoining while a round is LIVE waits for NEXT ROUND.
-- This is an additive, non-destructive migration in the dedicated demo database.

alter table public.enchev_etap1_presence
  add column if not exists session_id uuid;

create table if not exists public.enchev_etap1_admissions (
  auction_id uuid not null references public.enchev_etap1_auctions(id),
  role text not null check (role in ('mitko','borko','krum','enchev')),
  session_id uuid not null,
  admitted_at timestamptz not null default clock_timestamp(),
  primary key (auction_id, role)
);
alter table public.enchev_etap1_admissions enable row level security;
revoke all on public.enchev_etap1_admissions from public, anon, authenticated;

-- New RPC name leaves the old preview RPC untouched during the transition.
-- ONLY the new API route uses this session-bound RPC.
create or replace function public.etap1_ready_lobby_secure(
  p_actor text, p_session_id uuid, p_ready boolean default null,
  p_rejoin boolean default false
) returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
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
  if p_actor is null or p_actor not in ('mitko','borko','krum','enchev','admin') then
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
        raise exception 'Session replaced: log in again';
      end if;
      if v_running and p_ready is not null then
        raise exception 'Cannot READY during active auction';
      end if;
    end if;
  end if;

  select count(*),count(*) filter(where is_ready)
    into v_count,v_ready_count
  from public.enchev_etap1_presence
  where last_seen>=v_now-interval '15 seconds' and session_id is not null;

  -- CRITICAL: polling GET, refresh, and login can NEVER auto-start a round.
  -- Only the final explicit READY button press can start it.
  if p_ready is true and not v_running and v_count between 2 and 4
      and v_ready_count=v_count then
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
      where p.is_ready
        and p.session_id is not null
        and p.last_seen>=v_now-interval '15 seconds';
    update public.enchev_etap1_presence
      set is_ready=false
      where last_seen>=v_now-interval '15 seconds';
    v_running:=true;
    v_room.active_auction_id:=v_auction_id;
  end if;

  select count(*),count(*) filter(where is_ready)
    into v_count,v_ready_count
  from public.enchev_etap1_presence
  where last_seen>=v_now-interval '15 seconds' and session_id is not null;
  select coalesce(jsonb_agg(jsonb_build_object(
     'role',p.role,'ready',p.is_ready) order by p.role),'[]'::jsonb)
    into v_people
  from public.enchev_etap1_presence p
  where p.last_seen>=v_now-interval '15 seconds' and p.session_id is not null;

  if p_actor<>'admin' and v_room.active_auction_id is not null then
    select exists(
      select 1 from public.enchev_etap1_admissions a
      where a.auction_id=v_room.active_auction_id
        and a.role=p_actor and a.session_id=p_session_id
    ) into v_admitted;
  end if;

  return jsonb_build_object(
    'lobby',jsonb_build_object('participants',v_people,
      'count',v_count,'readyCount',v_ready_count,'minPlayers',2,
      'admitted',v_admitted),
    'state',public.etap1_snapshot()
  );
end;
$$;

create or replace function public.etap1_bid_admitted(
  p_actor text, p_session_id uuid, p_nonce uuid
) returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare
  v_room public.enchev_etap1_rooms%rowtype;
begin
  if p_actor not in ('mitko','borko','krum')
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
    raise exception 'Press READY for the NEXT auction before bidding';
  end if;
  return public.etap1_bid(p_actor,p_nonce);
end;
$$;

revoke all on function public.etap1_ready_lobby_secure(text,uuid,boolean,boolean)
  from public,anon,authenticated;
grant execute on function public.etap1_ready_lobby_secure(text,uuid,boolean,boolean)
  to service_role;
revoke all on function public.etap1_bid_admitted(text,uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.etap1_bid_admitted(text,uuid,uuid)
  to service_role;
