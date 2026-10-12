-- Encrypted-at-rest operator credential fallback for the dedicated DEMO DB.
-- Migration intentionally contains NO passwords or hashes: credential is
-- provisioned separately by the database owner using a secure one-time action.
-- Does not touch public user accounts or actual financial transaction tables.
create table if not exists public.enchev_etap1_admin_access (
  id text primary key check (id='operator'),
  password_hash text not null,
  updated_at timestamptz not null default now()
);
alter table public.enchev_etap1_admin_access enable row level security;
revoke all on public.enchev_etap1_admin_access from public, anon, authenticated;

create or replace function public.etap1_admin_code_matches(p_code text)
returns boolean
language plpgsql
security definer
set search_path=public,pg_temp,extensions
as $$
declare
  v_hash text;
begin
  if p_code is null or char_length(p_code) < 20 or char_length(p_code) > 128 then
    return false;
  end if;
  select password_hash into v_hash
  from public.enchev_etap1_admin_access
  where id='operator';
  if v_hash is null then return false; end if;
  -- bcrypt verifies the supplied credential against a salted stored hash.
  return v_hash = extensions.crypt(p_code,v_hash);
end;
$$;
revoke all on function public.etap1_admin_code_matches(text)
from public, anon, authenticated;
grant execute on function public.etap1_admin_code_matches(text) to service_role;
