-- SYSTEM 42.02 authoritative bidding foundation.
-- PostgreSQL is the only authority for accepted bid ordering and current price.
-- The HTTP API authenticates the buyer first, then calls this RPC with a backend-only secret key.

create table if not exists public.enchev_auctions (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'draft' check (status in ('draft','live','ended','cancelled')),
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  current_bid_cents bigint not null default 0 check (current_bid_cents >= 0),
  bid_increment_cents bigint not null default 100 check (bid_increment_cents > 0),
  current_sequence bigint not null default 0 check (current_sequence >= 0),
  leader_bidder_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.enchev_bids (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.enchev_auctions(id) on delete restrict,
  bidder_id uuid not null,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  sequence bigint not null check (sequence > 0),
  accepted_at timestamptz not null default now(),
  idempotency_key text not null,
  request_fingerprint text not null check (length(request_fingerprint) = 64),
  unique (auction_id, sequence),
  unique (bidder_id, idempotency_key)
);

create index if not exists enchev_bids_auction_accepted_idx
  on public.enchev_bids (auction_id, sequence);

alter table public.enchev_auctions enable row level security;
alter table public.enchev_bids enable row level security;

revoke all on table public.enchev_auctions from anon, authenticated;
revoke all on table public.enchev_bids from anon, authenticated;

create or replace function public.enchev_place_bid(
  p_auction_id uuid,
  p_bidder_id uuid,
  p_amount_cents bigint,
  p_idempotency_key text,
  p_request_fingerprint text
) returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_auction public.enchev_auctions%rowtype;
  v_existing public.enchev_bids%rowtype;
  v_bid public.enchev_bids%rowtype;
  v_minimum bigint;
begin
  if p_auction_id is null or p_bidder_id is null then
    return jsonb_build_object('accepted', false, 'reason', 'invalid-identity');
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 then
    return jsonb_build_object('accepted', false, 'reason', 'invalid-amount');
  end if;
  if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' then
    return jsonb_build_object('accepted', false, 'reason', 'invalid-idempotency-key');
  end if;
  if p_request_fingerprint is null or p_request_fingerprint !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('accepted', false, 'reason', 'invalid-request-fingerprint');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_bidder_id::text || ':' || p_idempotency_key, 0));

  select * into v_existing
  from public.enchev_bids
  where bidder_id = p_bidder_id and idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_fingerprint <> p_request_fingerprint then
      return jsonb_build_object('accepted', false, 'reason', 'idempotency-conflict');
    end if;
    return jsonb_build_object(
      'accepted', true,
      'authority', 'postgresql',
      'auctionId', v_existing.auction_id,
      'bidId', v_existing.id,
      'bidderId', v_existing.bidder_id,
      'amountCents', v_existing.amount_cents,
      'currency', v_existing.currency,
      'sequence', v_existing.sequence,
      'acceptedAt', v_existing.accepted_at,
      'replayed', true
    );
  end if;

  select * into v_auction
  from public.enchev_auctions
  where id = p_auction_id
  for update;

  if not found then
    return jsonb_build_object('accepted', false, 'reason', 'auction-not-found');
  end if;
  if v_auction.status <> 'live' then
    return jsonb_build_object('accepted', false, 'reason', 'auction-not-live');
  end if;
  if v_auction.starts_at is not null and v_auction.starts_at > now() then
    return jsonb_build_object('accepted', false, 'reason', 'auction-not-started');
  end if;
  if v_auction.ends_at is not null and v_auction.ends_at <= now() then
    return jsonb_build_object('accepted', false, 'reason', 'auction-ended');
  end if;

  v_minimum := v_auction.current_bid_cents + v_auction.bid_increment_cents;
  if p_amount_cents < v_minimum then
    return jsonb_build_object('accepted', false, 'reason', 'bid-below-minimum', 'minimumAmountCents', v_minimum);
  end if;

  insert into public.enchev_bids (
    auction_id, bidder_id, amount_cents, currency, sequence, idempotency_key, request_fingerprint
  ) values (
    v_auction.id, p_bidder_id, p_amount_cents, v_auction.currency,
    v_auction.current_sequence + 1, p_idempotency_key, p_request_fingerprint
  )
  returning * into v_bid;

  update public.enchev_auctions
  set current_bid_cents = v_bid.amount_cents,
      current_sequence = v_bid.sequence,
      leader_bidder_id = v_bid.bidder_id,
      updated_at = now()
  where id = v_auction.id;

  return jsonb_build_object(
    'accepted', true,
    'authority', 'postgresql',
    'auctionId', v_bid.auction_id,
    'bidId', v_bid.id,
    'bidderId', v_bid.bidder_id,
    'amountCents', v_bid.amount_cents,
    'currency', v_bid.currency,
    'sequence', v_bid.sequence,
    'acceptedAt', v_bid.accepted_at,
    'replayed', false
  );
end;
$$;

revoke all on function public.enchev_place_bid(uuid, uuid, bigint, text, text) from public, anon, authenticated;
grant execute on function public.enchev_place_bid(uuid, uuid, bigint, text, text) to service_role;
