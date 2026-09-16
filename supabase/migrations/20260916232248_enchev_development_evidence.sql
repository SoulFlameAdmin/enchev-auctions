-- Additive and isolated technical evidence only. No auction/customer/payment data.
create table public.enchev_development_events (
 id bigint generated always as identity primary key,
 commit_sha text not null check (commit_sha ~ '^[a-f0-9]{40}$'),
 branch text not null check (branch in ('main','staging')),
 run_id text not null check (run_id ~ '^[0-9]+$'),
 run_attempt integer not null check (run_attempt > 0),
 test_id text not null check (length(test_id) between 1 and 80),
 status text not null check (status in ('RUNNING','PASS','FAIL')),
 started_at timestamptz not null,
 occurred_at timestamptz not null default clock_timestamp(),
 duration_ms integer check (duration_ms between 0 and 3600000),
 deployment_url text,
 unique (run_id, run_attempt, test_id, status)
);
create index enchev_development_commit_time on public.enchev_development_events (commit_sha, occurred_at desc);
create index enchev_development_time on public.enchev_development_events (occurred_at desc);
alter table public.enchev_development_events enable row level security;
revoke all on public.enchev_development_events from public, anon, authenticated;
grant select, insert on public.enchev_development_events to service_role;
grant usage, select on sequence public.enchev_development_events_id_seq to service_role;
comment on table public.enchev_development_events is 'Enchev technical test evidence. RLS denies client access. Edge function verifies GitHub OIDC and publishes only safe structured results. No customer data or raw logs.';
