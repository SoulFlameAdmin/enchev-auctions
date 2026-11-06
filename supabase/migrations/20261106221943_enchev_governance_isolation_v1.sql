-- Applied 2026-11-06 to Supabase project ejfrnjhlggebzmpmxajl.
-- Enchev MASTER governance is separate from authoritative auction tables.
create table if not exists public.enchev_plan_state (
  task_id text primary key,
  status text not null check (status in ('green','yellow','red')),
  evidence text,
  blocker text,
  updated_at timestamptz not null default now(),
  source_commit text not null,
  source_run_id text not null,
  source_workflow text not null,
  constraint enchev_plan_state_task_id_check check (task_id ~ '^([0-9]{2}\.[0-9]{2}|GAP-[0-9]{3,})$'),
  constraint enchev_plan_state_evidence_check check (evidence is null or char_length(evidence) <= 4000),
  constraint enchev_plan_state_blocker_check check (blocker is null or char_length(blocker) <= 2000),
  constraint enchev_plan_state_green_evidence check (status <> 'green' or length(btrim(coalesce(evidence,''))) > 0),
  constraint enchev_plan_state_source_commit_check check (source_commit ~ '^[0-9a-f]{40}$'),
  constraint enchev_plan_state_run_id_check check (source_run_id ~ '^[0-9]+$')
);
comment on table public.enchev_plan_state is 'ENCHEV-only verified MASTER task status projection; writes require validated GitHub main-branch OIDC through the Enchev Edge Function. Not an auction authority.';
alter table public.enchev_plan_state enable row level security;
revoke all on public.enchev_plan_state from public, anon, authenticated;
create index if not exists enchev_plan_state_updated_at_idx on public.enchev_plan_state (updated_at desc);
