-- SYSTEM 33.01-33.05 buyer workspace foundation.
-- Repository migration only. Do not apply to the currently bound governance-only Supabase project.
create table if not exists public.enchev_watchlist (
  user_id uuid not null,
  vehicle_id uuid not null,
  auction_id uuid null,
  created_at timestamptz not null default now(),
  primary key (user_id, vehicle_id)
);

create table if not exists public.enchev_recently_viewed (
  user_id uuid not null,
  vehicle_id uuid not null,
  auction_id uuid null,
  viewed_at timestamptz not null default now(),
  primary key (user_id, vehicle_id)
);

create table if not exists public.enchev_saved_searches (
  id uuid primary key,
  user_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  query jsonb not null,
  query_fingerprint text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, query_fingerprint)
);

create table if not exists public.enchev_saved_search_alerts (
  id uuid primary key,
  user_id uuid not null,
  saved_search_id uuid not null references public.enchev_saved_searches(id) on delete cascade,
  enabled boolean not null default true,
  cooldown_seconds integer not null default 300 check (cooldown_seconds >= 60),
  last_delivered_at timestamptz null,
  unique (user_id, saved_search_id)
);

create index if not exists enchev_recently_viewed_user_time_idx
  on public.enchev_recently_viewed(user_id, viewed_at desc);

create index if not exists enchev_watchlist_user_auction_idx
  on public.enchev_watchlist(user_id, auction_id)
  where auction_id is not null;

alter table public.enchev_watchlist enable row level security;
alter table public.enchev_recently_viewed enable row level security;
alter table public.enchev_saved_searches enable row level security;
alter table public.enchev_saved_search_alerts enable row level security;

create policy enchev_watchlist_owner_select on public.enchev_watchlist
  for select using (auth.uid() = user_id);
create policy enchev_watchlist_owner_insert on public.enchev_watchlist
  for insert with check (auth.uid() = user_id);
create policy enchev_watchlist_owner_delete on public.enchev_watchlist
  for delete using (auth.uid() = user_id);

create policy enchev_recent_owner_select on public.enchev_recently_viewed
  for select using (auth.uid() = user_id);
create policy enchev_recent_owner_insert on public.enchev_recently_viewed
  for insert with check (auth.uid() = user_id);
create policy enchev_recent_owner_update on public.enchev_recently_viewed
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy enchev_recent_owner_delete on public.enchev_recently_viewed
  for delete using (auth.uid() = user_id);

create policy enchev_saved_search_owner_select on public.enchev_saved_searches
  for select using (auth.uid() = user_id);
create policy enchev_saved_search_owner_insert on public.enchev_saved_searches
  for insert with check (auth.uid() = user_id);
create policy enchev_saved_search_owner_update on public.enchev_saved_searches
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy enchev_saved_search_owner_delete on public.enchev_saved_searches
  for delete using (auth.uid() = user_id);

create policy enchev_saved_alert_owner_select on public.enchev_saved_search_alerts
  for select using (auth.uid() = user_id);
create policy enchev_saved_alert_owner_insert on public.enchev_saved_search_alerts
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.enchev_saved_searches s
      where s.id = saved_search_id and s.user_id = auth.uid()
    )
  );
create policy enchev_saved_alert_owner_update on public.enchev_saved_search_alerts
  for update using (auth.uid() = user_id) with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.enchev_saved_searches s
      where s.id = saved_search_id and s.user_id = auth.uid()
    )
  );
create policy enchev_saved_alert_owner_delete on public.enchev_saved_search_alerts
  for delete using (auth.uid() = user_id);
