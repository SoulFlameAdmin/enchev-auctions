-- ENCHEV private fake-money Preview: add Krum as a third bidder.
-- Append-only follow-up to base pilot + ready-lobby migrations. Preserve historical bids.
-- No real-money workflow; only dedicated EnchevAuctions project.

alter table public.enchev_etap1_presence
  drop constraint enchev_etap1_presence_role_check,
  add constraint enchev_etap1_presence_role_check
  check (role in ('mitko','borko','krum','enchev'));

alter table public.enchev_etap1_bids
  drop constraint enchev_etap1_bids_actor_check,
  add constraint enchev_etap1_bids_actor_check
  check (actor in ('mitko','borko','krum'));

alter table public.enchev_etap1_auctions
  drop constraint enchev_etap1_auctions_leading_role_check,
  add constraint enchev_etap1_auctions_leading_role_check
  check (leading_role in ('mitko','borko','krum'));

create or replace function public.etap1_bid(p_actor text, p_nonce uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_room public.enchev_etap1_rooms%rowtype;
  v_auction public.enchev_etap1_auctions%rowtype;
  v_existing uuid;
  v_now timestamptz;
  v_new_amount numeric(12,2);
begin
  if p_actor is null or p_actor not in ('mitko','borko','krum') or p_nonce is null then
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
$$;
revoke all on function public.etap1_bid(text,uuid) from public,anon,authenticated;
grant execute on function public.etap1_bid(text,uuid) to service_role;

create or replace function public.etap1_ready_lobby(p_actor text, p_ready boolean default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
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
begin
  if p_actor is null or p_actor not in ('mitko','borko','krum','enchev','admin') then
    raise exception 'Invalid closed-demo role';
  end if;
  if p_actor = 'admin' and p_ready is not null then
    raise exception 'Admin is not a participant in READY lobby';
  end if;

  -- Same lock order as etap1_start / etap1_bid / etap1_snapshot.
  insert into public.enchev_etap1_rooms(name) values ('stage-one')
    on conflict (name) do nothing;
  select * into v_room from public.enchev_etap1_rooms
    where name='stage-one' for update;
  if v_room.active_auction_id is not null then
    select * into v_active from public.enchev_etap1_auctions
      where id=v_room.active_auction_id for update;
    if v_active.status='live' and v_active.ends_at<=v_now then
      update public.enchev_etap1_auctions
        set status='closed', closed_at=v_now
        where id=v_active.id returning * into v_active;
    end if;
    v_running := v_active.status='live' and v_active.ends_at>v_now;
  end if;
  if p_ready is not null and v_running then
    raise exception 'Cannot change READY during an active auction';
  end if;

  -- Heartbeats keep a role present for 15 seconds, allowing phone refreshes.
  -- A stale/rejoined participant must explicitly press READY again.
  if p_actor <> 'admin' then
    insert into public.enchev_etap1_presence(role,is_ready,last_seen)
      values (p_actor,coalesce(p_ready,false),v_now)
      on conflict (role) do update set
        is_ready=case
          when p_ready is not null then excluded.is_ready
          when public.enchev_etap1_presence.last_seen < v_now - interval '15 seconds'
            then false
          else public.enchev_etap1_presence.is_ready
        end,
        last_seen=v_now;
  end if;

  select count(*),count(*) filter (where is_ready)
    into v_count,v_ready_count
    from public.enchev_etap1_presence
    where last_seen >= v_now-interval '15 seconds';

  -- Exactly one winner/start is possible: all concurrent requests lock the
  -- same singleton room before checking readiness or inserting an auction.
  if not v_running and v_count between 2 and 4 and v_ready_count=v_count then
    insert into public.enchev_etap1_auctions
      (title,opening_amount,current_amount,increment,started_at,ends_at)
      values ('2026 Volkswagen Golf GTI — DEMO',16250,16250,100,
              v_now,v_now+interval '120 seconds')
      returning id into v_auction_id;
    update public.enchev_etap1_rooms
      set active_auction_id=v_auction_id where name='stage-one';
    -- Every next round requires a new explicit READY from everyone present.
    update public.enchev_etap1_presence
      set is_ready=false where last_seen >= v_now-interval '15 seconds';
  end if;

  select count(*),count(*) filter (where is_ready)
    into v_count,v_ready_count
    from public.enchev_etap1_presence
    where last_seen >= v_now-interval '15 seconds';
  select coalesce(jsonb_agg(jsonb_build_object(
      'role',p.role,'ready',p.is_ready) order by p.role),'[]'::jsonb)
    into v_people
    from public.enchev_etap1_presence p
    where p.last_seen >= v_now-interval '15 seconds';

  return jsonb_build_object(
    'lobby',jsonb_build_object('participants',v_people,
      'count',v_count,'readyCount',v_ready_count,'minPlayers',2),
    'state',public.etap1_snapshot()
  );
end;
$$;

revoke all on function public.etap1_ready_lobby(text,boolean)
  from public,anon,authenticated;
grant execute on function public.etap1_ready_lobby(text,boolean)
  to service_role;
-- Request authorization is checked by the Next.js server with signed cookies.
-- This function and presence table are intentionally NOT browser-exposed.

