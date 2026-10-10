-- ENCHEV P0 Identity: dedicated project ONLY (never SoulFlame/Twins).
-- PRECONDITION: a separate ENCHEV Supabase project, with email confirmation on.
-- Do not run this on soulflame-twins (frhletkiuupgksmgxoxc) or veska-logoped.
-- Buyer-only profile: no is_admin / role / balance / authorization claims.
-- Permissions are strictly scoped to the current Supabase Auth UUID.
begin;

create table public.enchev_buyer_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text null
    check (display_name is null or char_length(btrim(display_name)) between 1 and 120),
  phone_e164 text null
    check (phone_e164 is null or phone_e164 ~ '^\\+[1-9][0-9]{6,14}$'),
  locale text not null default 'en' check (locale in ('bg','en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.enchev_buyer_profiles is
  'ENCHEV buyer contact profile. No identity or bidding authorization is inferred from this table. Dedicated ENCHEV Supabase project only.';

alter table public.enchev_buyer_profiles enable row level security;
alter table public.enchev_buyer_profiles force row level security;

-- Default table privileges can vary across Supabase installations. Limit the
-- browser-identity roles explicitly; they may not create, delete or set IDs.
revoke all on table public.enchev_buyer_profiles from public, anon, authenticated;
grant select on public.enchev_buyer_profiles to authenticated;
grant update (display_name, phone_e164, locale) on public.enchev_buyer_profiles to authenticated;

create policy enchev_buyer_profiles_self_read
  on public.enchev_buyer_profiles for select
  to authenticated using ((select auth.uid()) = id);

create policy enchev_buyer_profiles_self_update
  on public.enchev_buyer_profiles for update
  to authenticated using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- A verified auth identity is the source of profile ownership. Sign-up creates
-- a minimal profile via a SECURITY DEFINER function. The trigger has no user
-- metadata inputs, role flags, or authorization decisions.
create function public.enchev_create_buyer_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into public.enchev_buyer_profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$function$;

revoke all on function public.enchev_create_buyer_profile() from public, anon, authenticated;

create trigger enchev_after_auth_user_created
  after insert on auth.users
  for each row execute function public.enchev_create_buyer_profile();

create function public.enchev_touch_buyer_profile()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

revoke all on function public.enchev_touch_buyer_profile() from public, anon, authenticated;
create trigger enchev_buyer_profile_updated_at
  before update on public.enchev_buyer_profiles
  for each row execute function public.enchev_touch_buyer_profile();

commit;

-- Acceptance BEFORE enabling ENCHEV_AUTH_ENABLED:
-- [ ] Dedicated ENCHEV ref proven, not a shared governance/health project.
-- [ ] RLS tested with two distinct authenticated JWTs: own SELECT/UPDATE work;
--     other user's rows not visible/editable; anonymous is denied.
-- [ ] Neither user can INSERT, DELETE, edit id/timestamps, nor set any role.
-- [ ] Signup → email verification → login → profile creation/lookup works.
-- [ ] Recovery, session rotation, logout and rate limiting verified in staging.
