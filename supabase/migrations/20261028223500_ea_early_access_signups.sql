-- E&A East West Auctioneers Group: isolated, persistent early-access signup list.
-- Target ONLY Supabase project ejfrnjhlggebzmpmxajl (enchev-auctions).
-- Execute on the correct Enchev DB by an authorized database owner.
create table if not exists public.ea_early_access_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  source text not null default 'cinematic_presentation_2',
  consent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint ea_early_access_email_valid check (
    email = lower(btrim(email)) and char_length(email) <= 254 and
    email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  ),
  constraint ea_early_access_email_unique unique (email)
);
create index if not exists ea_early_access_created_idx on public.ea_early_access_signups(created_at desc);
alter table public.ea_early_access_signups enable row level security;
-- Never expose private email rows to public/normal logged-in visitors.
revoke all on table public.ea_early_access_signups from anon, authenticated, public;
grant select, insert on table public.ea_early_access_signups to service_role;
comment on table public.ea_early_access_signups is
  'E&A early-access email addresses with consent. Server-only; do not expose via public Data API.';
