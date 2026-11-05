-- E&A buyer workspace: private, auth-owned records; no real-money actions.
-- Designed for dedicated ENCHEV project ejfrnjhlggebzmpmxajl only.
-- No demo lots, payment instructions, auth service keys, or fake buyer rows.
begin;

create table public.enchev_market_lots (
  id uuid primary key default gen_random_uuid(),
  lot_number text not null unique check (lot_number ~ '^EA-[0-9]{5,10}$'),
  title text not null check (char_length(btrim(title)) between 3 and 180),
  make text not null check (char_length(btrim(make)) between 2 and 80),
  model text not null check (char_length(btrim(model)) between 1 and 100),
  model_year int check (model_year between 1950 and 2100),
  vin text unique check (vin is null or vin ~ '^[A-HJ-NPR-Z0-9]{17}$'),
  country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  condition_summary text,
  price_currency text not null default 'EUR' check (price_currency='EUR'),
  starting_price numeric(15,2) check (starting_price is null or starting_price>=0),
  auction_starts_at timestamptz,
  auction_ends_at timestamptz,
  status text not null default 'draft'
    check (status in ('draft','scheduled','live','ended','cancelled')),
  published boolean not null default false,
  seller_verified_at timestamptz,
  approved_at timestamptz,
  seller_id uuid references auth.users(id) on delete restrict,
  image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (auction_ends_at is null or auction_starts_at is null or auction_ends_at>auction_starts_at)
);
comment on table public.enchev_market_lots is 'Server-reviewed REAL listings only; never populated with demo lots.';
create index enchev_market_lots_public_idx on public.enchev_market_lots(status,auction_starts_at) where published=true and approved_at is not null and seller_verified_at is not null;

create table public.enchev_buyer_saved_lots (
  user_id uuid not null references auth.users(id) on delete cascade,
  lot_id uuid not null references public.enchev_market_lots(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id,lot_id)
);
create index enchev_buyer_saved_lots_time_idx on public.enchev_buyer_saved_lots(user_id,created_at desc);

create table public.enchev_buyer_verifications (
  user_id uuid primary key references auth.users(id) on delete cascade,
  buyer_type text not null default 'individual' check (buyer_type in ('individual','business')),
  kyc_status text not null default 'not_started'
    check (kyc_status in ('not_started','pending','approved','rejected','expired')),
  deposit_status text not null default 'not_required'
    check (deposit_status in ('not_required','pending','received','refunded','forfeited')),
  review_reference text,
  updated_at timestamptz not null default now()
);
comment on table public.enchev_buyer_verifications is 'Only authorized verification workflow may create or update; browser reads own status.';

create table public.enchev_buyer_orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users(id) on delete restrict,
  lot_id uuid not null references public.enchev_market_lots(id) on delete restrict,
  status text not null default 'pending'
    check (status in ('pending','awaiting_invoice','awaiting_payment','paid','release_ready','completed','cancelled','disputed')),
  currency text not null default 'EUR' check (currency='EUR'),
  total_amount numeric(15,2) check (total_amount is null or total_amount>=0),
  invoice_number text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index enchev_buyer_orders_owner_idx on public.enchev_buyer_orders(buyer_id,created_at desc);

create table public.enchev_buyer_payment_records (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.enchev_buyer_orders(id) on delete restrict,
  provider text not null check (provider in ('stripe','revolut','bank')),
  provider_reference text unique,
  amount numeric(15,2) not null check (amount>=0),
  currency text not null default 'EUR' check (currency='EUR'),
  status text not null default 'pending'
    check (status in ('pending','processing','succeeded','failed','refunded','partially_refunded')),
  created_at timestamptz not null default now()
);
create index enchev_buyer_payments_order_idx on public.enchev_buyer_payment_records(order_id,created_at desc);

create table public.enchev_buyer_documents (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.enchev_buyer_orders(id) on delete restrict,
  kind text not null check (kind in ('invoice','contract','vehicle_title','release','transport','receipt')),
  label text not null check (char_length(btrim(label)) between 1 and 160),
  status text not null default 'pending' check (status in ('pending','issued','retracted')),
  private_object_path text,
  issued_at timestamptz,
  created_at timestamptz not null default now()
);
create index enchev_buyer_documents_order_idx on public.enchev_buyer_documents(order_id,created_at desc);

create table public.enchev_buyer_deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.enchev_buyer_orders(id) on delete restrict,
  status text not null default 'not_requested'
    check (status in ('not_requested','quoted','booked','collected','in_transit','delivered','exception')),
  destination_country text,
  eta_at timestamptz,
  delivered_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Explicitly revoke implicit public privileges before granting narrow access.
alter table public.enchev_market_lots enable row level security;
alter table public.enchev_market_lots force row level security;
alter table public.enchev_buyer_saved_lots enable row level security;
alter table public.enchev_buyer_saved_lots force row level security;
alter table public.enchev_buyer_verifications enable row level security;
alter table public.enchev_buyer_verifications force row level security;
alter table public.enchev_buyer_orders enable row level security;
alter table public.enchev_buyer_orders force row level security;
alter table public.enchev_buyer_payment_records enable row level security;
alter table public.enchev_buyer_payment_records force row level security;
alter table public.enchev_buyer_documents enable row level security;
alter table public.enchev_buyer_documents force row level security;
alter table public.enchev_buyer_deliveries enable row level security;
alter table public.enchev_buyer_deliveries force row level security;

revoke all on public.enchev_market_lots,public.enchev_buyer_saved_lots,
  public.enchev_buyer_verifications,public.enchev_buyer_orders,
  public.enchev_buyer_payment_records,public.enchev_buyer_documents,
  public.enchev_buyer_deliveries from public,anon,authenticated;
grant select on public.enchev_market_lots to anon,authenticated;
grant select,insert,delete on public.enchev_buyer_saved_lots to authenticated;
grant select on public.enchev_buyer_verifications,public.enchev_buyer_orders,
  public.enchev_buyer_payment_records,public.enchev_buyer_documents,
  public.enchev_buyer_deliveries to authenticated;

create policy enchev_market_lots_verified_public_read
  on public.enchev_market_lots for select to anon,authenticated
  using (published=true and approved_at is not null and seller_verified_at is not null
    and status in ('scheduled','live','ended'));

create policy enchev_buyer_saved_lots_owner_read
  on public.enchev_buyer_saved_lots for select to authenticated
  using ((select auth.uid())=user_id);
create policy enchev_buyer_saved_lots_owner_insert
  on public.enchev_buyer_saved_lots for insert to authenticated
  with check ((select auth.uid())=user_id and exists (
    select 1 from public.enchev_market_lots l where l.id=lot_id
  ));
create policy enchev_buyer_saved_lots_owner_delete
  on public.enchev_buyer_saved_lots for delete to authenticated
  using ((select auth.uid())=user_id);

create policy enchev_buyer_verifications_owner_read
  on public.enchev_buyer_verifications for select to authenticated
  using ((select auth.uid())=user_id);
create policy enchev_buyer_orders_owner_read
  on public.enchev_buyer_orders for select to authenticated
  using ((select auth.uid())=buyer_id);
create policy enchev_buyer_payment_records_owner_read
  on public.enchev_buyer_payment_records for select to authenticated
  using (exists(select 1 from public.enchev_buyer_orders o
    where o.id=order_id and o.buyer_id=(select auth.uid())));
create policy enchev_buyer_documents_owner_read
  on public.enchev_buyer_documents for select to authenticated
  using (exists(select 1 from public.enchev_buyer_orders o
    where o.id=order_id and o.buyer_id=(select auth.uid())));
create policy enchev_buyer_deliveries_owner_read
  on public.enchev_buyer_deliveries for select to authenticated
  using (exists(select 1 from public.enchev_buyer_orders o
    where o.id=order_id and o.buyer_id=(select auth.uid())));

commit;
