-- SYSTEM 42.08 authoritative auction finalization.
-- PostgreSQL alone decides and durably records the terminal auction result.

alter table public.enchev_auctions
  add column if not exists closed_at timestamptz,
  add column if not exists winner_bid_id uuid,
  add column if not exists winner_bidder_id uuid,
  add column if not exists winning_amount_cents bigint;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'enchev_auctions_winner_bid_fkey'
      and conrelid = 'public.enchev_auctions'::regclass
  ) then
    alter table public.enchev_auctions
      add constraint enchev_auctions_winner_bid_fkey
      foreign key (winner_bid_id) references public.enchev_bids(id) on delete restrict;
  end if;
end
$$;

create table if not exists public.enchev_auction_finalizations (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null unique references public.enchev_auctions(id) on delete restrict,
  outcome text not null check (outcome in ('winner_assigned','closed_without_winner')),
  winner_bid_id uuid references public.enchev_bids(id) on delete restrict,
  winner_bidder_id uuid,
  winning_amount_cents bigint check (winning_amount_cents is null or winning_amount_cents > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  closed_at timestamptz not null,
  idempotency_key text not null unique,
  request_fingerprint text not null check (length(request_fingerprint) = 64),
  created_at timestamptz not null default now(),
  check (
    (outcome = 'winner_assigned'
      and winner_bid_id is not null
      and winner_bidder_id is not null
      and winning_amount_cents is not null)
    or
    (outcome = 'closed_without_winner'
      and winner_bid_id is null
      and winner_bidder_id is null
      and winning_amount_cents is null)
  )
);

create index if not exists enchev_auction_finalizations_closed_at_idx
  on public.enchev_auction_finalizations (closed_at);

alter table public.enchev_auction_finalizations enable row level security;
revoke all on table public.enchev_auction_finalizations from anon, authenticated;
grant select, insert on table public.enchev_auction_finalizations to service_role;
grant update on table public.enchev_auctions to service_role;

create or replace function public.enchev_finalize_auction(
  p_auction_id uuid,
  p_idempotency_key text,
  p_request_fingerprint text
) returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_auction public.enchev_auctions%rowtype;
  v_existing public.enchev_auction_finalizations%rowtype;
  v_winner public.enchev_bids%rowtype;
  v_final public.enchev_auction_finalizations%rowtype;
  v_closed_at timestamptz := clock_timestamp();
  v_outcome text;
begin
  if p_auction_id is null then
    return jsonb_build_object('finalized', false, 'reason', 'invalid-auction-id');
  end if;
  if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' then
    return jsonb_build_object('finalized', false, 'reason', 'invalid-idempotency-key');
  end if;
  if p_request_fingerprint is null or p_request_fingerprint !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('finalized', false, 'reason', 'invalid-request-fingerprint');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('finalize:' || p_auction_id::text, 0));

  select * into v_existing
  from public.enchev_auction_finalizations
  where idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_fingerprint <> p_request_fingerprint then
      return jsonb_build_object('finalized', false, 'reason', 'idempotency-conflict');
    end if;
    return jsonb_build_object(
      'finalized', true,
      'authority', 'postgresql',
      'finalizationId', v_existing.id,
      'auctionId', v_existing.auction_id,
      'outcome', v_existing.outcome,
      'winnerBidId', v_existing.winner_bid_id,
      'winnerBidderId', v_existing.winner_bidder_id,
      'winningAmountCents', v_existing.winning_amount_cents,
      'currency', v_existing.currency,
      'closedAt', v_existing.closed_at,
      'replayed', true
    );
  end if;

  select * into v_existing
  from public.enchev_auction_finalizations
  where auction_id = p_auction_id;

  if found then
    return jsonb_build_object(
      'finalized', true,
      'authority', 'postgresql',
      'finalizationId', v_existing.id,
      'auctionId', v_existing.auction_id,
      'outcome', v_existing.outcome,
      'winnerBidId', v_existing.winner_bid_id,
      'winnerBidderId', v_existing.winner_bidder_id,
      'winningAmountCents', v_existing.winning_amount_cents,
      'currency', v_existing.currency,
      'closedAt', v_existing.closed_at,
      'replayed', true
    );
  end if;

  select * into v_auction
  from public.enchev_auctions
  where id = p_auction_id
  for update;

  if not found then
    return jsonb_build_object('finalized', false, 'reason', 'auction-not-found');
  end if;
  if v_auction.status not in ('live','ended') then
    return jsonb_build_object('finalized', false, 'reason', 'auction-not-finalizable');
  end if;
  if v_auction.ends_at is null or v_auction.ends_at > v_closed_at then
    return jsonb_build_object('finalized', false, 'reason', 'auction-not-ended');
  end if;

  select * into v_winner
  from public.enchev_bids
  where auction_id = p_auction_id
  order by sequence desc
  limit 1;

  if found then
    v_outcome := 'winner_assigned';
  else
    v_outcome := 'closed_without_winner';
  end if;

  insert into public.enchev_auction_finalizations (
    auction_id,
    outcome,
    winner_bid_id,
    winner_bidder_id,
    winning_amount_cents,
    currency,
    closed_at,
    idempotency_key,
    request_fingerprint
  ) values (
    v_auction.id,
    v_outcome,
    case when v_outcome = 'winner_assigned' then v_winner.id else null end,
    case when v_outcome = 'winner_assigned' then v_winner.bidder_id else null end,
    case when v_outcome = 'winner_assigned' then v_winner.amount_cents else null end,
    v_auction.currency,
    v_closed_at,
    p_idempotency_key,
    p_request_fingerprint
  )
  returning * into v_final;

  update public.enchev_auctions
  set status = 'ended',
      closed_at = v_final.closed_at,
      winner_bid_id = v_final.winner_bid_id,
      winner_bidder_id = v_final.winner_bidder_id,
      winning_amount_cents = v_final.winning_amount_cents,
      updated_at = v_final.closed_at
  where id = v_auction.id;

  return jsonb_build_object(
    'finalized', true,
    'authority', 'postgresql',
    'finalizationId', v_final.id,
    'auctionId', v_final.auction_id,
    'outcome', v_final.outcome,
    'winnerBidId', v_final.winner_bid_id,
    'winnerBidderId', v_final.winner_bidder_id,
    'winningAmountCents', v_final.winning_amount_cents,
    'currency', v_final.currency,
    'closedAt', v_final.closed_at,
    'replayed', false
  );
end;
$$;

revoke all on function public.enchev_finalize_auction(uuid, text, text) from public, anon, authenticated;
grant execute on function public.enchev_finalize_auction(uuid, text, text) to service_role;
