-- DAVID installer client registry.
-- Only real installer heartbeat calls create rows; Mode Center never hardcodes people.

create table if not exists public.david_installer_clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.sf_profiles(id) on delete cascade,
  client_key text not null,
  installer_version text not null default 'unknown',
  device_name text,
  status text not null default 'online'
    check (status in ('online','working','idle','error','offline')),
  mode text,
  current_task text,
  last_error text,
  installed_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  is_revoked boolean not null default false,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, client_key)
);

alter table public.david_installer_clients enable row level security;

drop policy if exists david_installer_clients_select_own on public.david_installer_clients;
create policy david_installer_clients_select_own
on public.david_installer_clients
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists david_installer_clients_insert_own on public.david_installer_clients;
create policy david_installer_clients_insert_own
on public.david_installer_clients
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists david_installer_clients_update_own on public.david_installer_clients;
create policy david_installer_clients_update_own
on public.david_installer_clients
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create or replace function public.david_installer_heartbeat(
  p_client_key text,
  p_installer_version text default 'unknown',
  p_device_name text default null,
  p_status text default 'online',
  p_mode text default null,
  p_current_task text default null,
  p_last_error text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.david_installer_clients
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.david_installer_clients;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;

  if p_client_key is null or length(btrim(p_client_key)) < 8 or length(p_client_key) > 160 then
    raise exception 'invalid client key';
  end if;

  if p_status not in ('online','working','idle','error','offline') then
    raise exception 'invalid status';
  end if;

  insert into public.david_installer_clients (
    user_id, client_key, installer_version, device_name, status,
    mode, current_task, last_error, last_seen_at, metadata, updated_at
  )
  values (
    v_uid, btrim(p_client_key), coalesce(nullif(btrim(p_installer_version),''),'unknown'),
    nullif(btrim(p_device_name),''), p_status,
    nullif(btrim(p_mode),''), nullif(btrim(p_current_task),''),
    nullif(btrim(p_last_error),''), now(), coalesce(p_metadata,'{}'::jsonb), now()
  )
  on conflict (user_id, client_key)
  do update set
    installer_version = excluded.installer_version,
    device_name = excluded.device_name,
    status = excluded.status,
    mode = excluded.mode,
    current_task = excluded.current_task,
    last_error = excluded.last_error,
    last_seen_at = now(),
    metadata = excluded.metadata,
    is_revoked = false,
    updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.david_installer_heartbeat(text,text,text,text,text,text,text,jsonb) from public;
grant execute on function public.david_installer_heartbeat(text,text,text,text,text,text,text,jsonb) to authenticated;

create or replace function public.david_installer_clients_snapshot()
returns table (
  display_name text,
  installer_version text,
  device_name text,
  connection_status text,
  runtime_status text,
  mode text,
  current_task text,
  last_error text,
  last_seen_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select
    coalesce(nullif(p.full_name,''), nullif(p.nickname,''), 'SoulFlame user') as display_name,
    c.installer_version,
    c.device_name,
    case
      when c.is_revoked then 'REVOKED'
      when c.last_seen_at >= now() - interval '90 seconds' then 'ONLINE'
      when c.last_seen_at >= now() - interval '5 minutes' then 'STALE'
      else 'OFFLINE'
    end as connection_status,
    upper(c.status) as runtime_status,
    c.mode,
    c.current_task,
    c.last_error,
    c.last_seen_at
  from public.david_installer_clients c
  join public.sf_profiles p on p.id = c.user_id
  where not c.is_revoked
  order by
    case
      when c.last_seen_at >= now() - interval '90 seconds' then 0
      when c.last_seen_at >= now() - interval '5 minutes' then 1
      else 2
    end,
    c.last_seen_at desc;
$$;

revoke all on function public.david_installer_clients_snapshot() from public;
grant execute on function public.david_installer_clients_snapshot() to anon, authenticated;
