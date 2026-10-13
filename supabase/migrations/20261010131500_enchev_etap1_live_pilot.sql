-- ENCHEV ETAP 1: isolated, NO MONEY, single demo auction room.
-- Apply ONLY in the dedicated ENCHEV Supabase project; never in SoulFlame/Twins.
-- All state changes and bid ordering happen inside PostgreSQL transactions.

create extension if not exists pgcrypto;

create table if not exists public.enchev_etap1_auctions (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 4 and 120),
  currency text not null default 'EUR' check (currency = 'EUR'),
  opening_amount numeric(12,2) not null check (opening_amount > 0),
  increment numeric(12,2) not null check (increment between 10 and 100000),
  current_amount numeric(12,2) not null check (current_amount > 0),
  bid_sequence integer not null default 0 check (bid_sequence >= 0),
  leading_role text check (leading_role in ('mitko','borko')),
  status text not null default 'live' check (status in ('live','closed')),
  started_at timestamptz not null default clock_timestamp(),
  ends_at timestamptz not null,
  closed_at timestamptz,
  created_at timestamptz not null default clock_timestamp()
);

create table if not exists public.enchev_etap1_rooms (
  name text primary key check (name = 'stage-one'),
  active_auction_id uuid references public.enchev_etap1_auctions(id)
);

create table if not exists public.enchev_etap1_bids (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.enchev_etap1_auctions(id),
  actor text not null check (actor in ('mitko','borko')),
  request_nonce uuid not null,
  sequence integer not null check (sequence >= 1),
  amount numeric(12,2) not null check (amount > 0),
  accepted_at timestamptz not null default clock_timestamp(),
  unique (auction_id, actor, request_nonce),
  unique (auction_id, sequence)
);
create index if not exists enchev_etap1_bids_latest
  on public.enchev_etap1_bids (auction_id, sequence desc);

alter table public.enchev_etap1_auctions enable row level security;
alter table public.enchev_etap1_rooms enable row level security;
alter table public.enchev_etap1_bids enable row level security;
revoke all on public.enchev_etap1_auctions from public, anon, authenticated;
revoke all on public.enchev_etap1_rooms from public, anon, authenticated;
revoke all on public.enchev_etap1_bids from public, anon, authenticated;

create or replace function public.etap1_snapshot()
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_room public.enchev_etap1_rooms%rowtype;
  v_auction public.enchev_etap1_auctions%rowtype;
  v_bids jsonb;
begin
  -- Stable lock order across all RPCs: room first, auction second.
  select * into v_room from public.enchev_etap1_rooms
   where name = 'stage-one' for update;
  if not found or v_room.active_auction_id is null then
    return jsonb_build_object('status','idle','demo',true,'serverNow',clock_timestamp(),
      'auction',null,'bids','[]'::jsonb);
  end if;
  select * into v_auction from public.enchev_etap1_auctions
   where id = v_room.active_auction_id for update;
  if v_auction.status = 'live' and v_auction.ends_at <= clock_timestamp() then
    update public.enchev_etap1_auctions set status='closed', closed_at=clock_timestamp()
     where id = v_auction.id returning * into v_auction;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'sequence', b.sequence, 'role', b.actor, 'amount', b.amount,
    'at', b.accepted_at) order by b.sequence desc), '[]'::jsonb)
    into v_bids
  from (
    select sequence, actor, amount, accepted_at
    from public.enchev_etap1_bids where auction_id=v_auction.id
    order by sequence desc limit 15
  ) b;

  return jsonb_build_object(
    'status',v_auction.status, 'demo',true, 'serverNow',clock_timestamp(),
    'auction', jsonb_build_object(
      'id',v_auction.id,'title',v_auction.title,'currency',v_auction.currency,
      'openingAmount',v_auction.opening_amount,'currentAmount',v_auction.current_amount,
      'increment',v_auction.increment,'sequence',v_auction.bid_sequence,
      'leadingRole',v_auction.leading_role,'winnerRole',
        case when v_auction.status='closed' then v_auction.leading_role else null end,
      'startedAt',v_auction.started_at,'endsAt',v_auction.ends_at,
      'closedAt',v_auction.closed_at
    ), 'bids', v_bids
  );
end;
$$;

create or replace function public.etap1_start(
  p_title text, p_opening_amount numeric, p_increment numeric, p_duration_seconds integer
) returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_room public.enchev_etap1_rooms%rowtype;
  v_prev public.enchev_etap1_auctions%rowtype;
  v_new uuid;
begin
  if p_title is null or char_length(btrim(p_title)) not between 4 and 120
    or p_opening_amount is null or p_opening_amount not between 100 and 10000000
    or p_increment is null or p_increment not between 10 and 100000
    or p_duration_seconds is null or p_duration_seconds not between 30 and 600 then
    raise exception 'Invalid demo auction configuration';
  end if;
  insert into public.enchev_etap1_rooms(name) values ('stage-one')
    on conflict (name) do nothing;
  select * into v_room from public.enchev_etap1_rooms
    where name='stage-one' for update;
  if v_room.active_auction_id is not null then
    select * into v_prev from public.enchev_etap1_auctions
      where id=v_room.active_auction_id for update;
    if v_prev.status='live' and v_prev.ends_at > clock_timestamp() then
      raise exception 'Previous demo auction remains active';
    end if;
    if v_prev.status='live' then
      update public.enchev_etap1_auctions set status='closed',closed_at=clock_timestamp()
        where id=v_prev.id;
    end if;
  end if;
  insert into public.enchev_etap1_auctions (
    title, opening_amount, current_amount, increment, started_at, ends_at
  ) values (
    btrim(p_title), p_opening_amount, p_opening_amount, p_increment,
    clock_timestamp(), clock_timestamp() + make_interval(secs=>p_duration_seconds)
  ) returning id into v_new;
  update public.enchev_etap1_rooms set active_auction_id=v_new where name='stage-one';
  return public.etap1_snapshot();
end;
$$;

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
  if p_actor is null or p_actor not in ('mitko','borko') or p_nonce is null then
    raise exception 'Invalid demo bidder or idempotency key';
  end if;
  select * into v_room from public.enchev_etap1_rooms
    where name='stage-one' for update;
  if not found or v_room.active_auction_id is null then
    raise exception 'No active demo auction';
  end if;
  select * into v_auction from public.enchev_etap1_auctions
    where id=v_room.active_auction_id for update;
  -- Retries return the same state without inserting a second accepted bid.
  select id into v_existing from public.enchev_etap1_bids
    where auction_id=v_auction.id and actor=p_actor and request_nonce=p_nonce;
  if found then return public.etap1_snapshot(); end if;

  v_now:=clock_timestamp();
  if v_auction.status<>'live' or v_now>=v_auction.ends_at then
    -- Do not accept late bids. Caller must refresh to observe the closed state.
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

revoke all on function public.etap1_snapshot() from public, anon, authenticated;
revoke all on function public.etap1_start(text,numeric,numeric,integer) from public, anon, authenticated;
revoke all on function public.etap1_bid(text,uuid) from public, anon, authenticated;
grant execute on function public.etap1_snapshot() to service_role;
grant execute on function public.etap1_start(text,numeric,numeric,integer) to service_role;
grant execute on function public.etap1_bid(text,uuid) to service_role;
-- Service-role key must be confined to Next.js server-side ENV; never browser.
