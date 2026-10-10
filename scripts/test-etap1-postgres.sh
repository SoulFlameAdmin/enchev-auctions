#!/usr/bin/env bash
set -euo pipefail

# Runs ONLY against disposable PostgreSQL in GitHub Actions, never against
# the owner's Supabase projects. PG* variables must point to the CI service.
if [[ "${ENCHEV_ETAP1_TEST_DATABASE:-}" != "disposable-local-ci" ]]; then
  echo "REFUSING DATABASE TEST: disposable-local-ci marker required" >&2
  exit 2
fi
: "${PGHOST:=127.0.0.1}"
: "${PGUSER:=postgres}"
: "${PGDATABASE:=postgres}"
export PGHOST PGUSER PGDATABASE
psql -X -v ON_ERROR_STOP=1 <<'SQL'
do $$
begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
end $$;
SQL
psql -X -v ON_ERROR_STOP=1 -f supabase/migrations/20261010131500_enchev_etap1_live_pilot.sql

psql -X -v ON_ERROR_STOP=1 <<'SQL'
do $$
declare
  v jsonb;
begin
  v:=public.etap1_snapshot();
  if v->>'status'<>'idle' then raise exception 'initial state not idle'; end if;

  v:=public.etap1_start('2026 Golf GTI DEMO',16250,100,60);
  if v->>'status'<>'live' then raise exception 'demo did not start'; end if;

  v:=public.etap1_bid('mitko','00112233-4455-4677-8899-aabbccddeeff');
  if (v->'auction'->>'sequence')::int<>1
     or (v->'auction'->>'currentAmount')::numeric<>16350 then
     raise exception 'first bid invalid'; end if;

  v:=public.etap1_bid('mitko','00112233-4455-4677-8899-aabbccddeeff');
  if (v->'auction'->>'sequence')::int<>1 then
    raise exception 'duplicate nonce accepted twice'; end if;

  v:=public.etap1_bid('borko','00112233-4455-4677-8899-aabbccddee00');
  if (v->'auction'->>'sequence')::int<>2
    or v->'auction'->>'leadingRole'<>'borko' then
    raise exception 'second bidder not leading'; end if;

  update public.enchev_etap1_auctions
    set ends_at=clock_timestamp()-interval '1 second'
    where id=(select active_auction_id from public.enchev_etap1_rooms where name='stage-one');
  v:=public.etap1_snapshot();
  if v->>'status'<>'closed' or v->'auction'->>'winnerRole'<>'borko' then
    raise exception 'close/winner non-deterministic'; end if;

  begin
    perform public.etap1_bid('mitko','00112233-4455-4677-8899-aabbccddee01');
    raise exception 'late bid wrongly accepted';
  exception when others then
    if sqlerrm='late bid wrongly accepted' then raise; end if;
  end;

  v:=public.etap1_start('2027 Mercedes DEMO',20000,100,90);
  if (v->'auction'->>'sequence')::int<>0 then raise exception 'next round not reset'; end if;
end $$;
SQL

# Separate concurrent PostgreSQL client sessions. The row lock must serialize
# two near-simultaneous offers to €20,100 and €20,200 without equal bid amounts.
psql -X -v ON_ERROR_STOP=1 -c "select public.etap1_bid('mitko','00112233-4455-4677-8899-aabbccddee02');" > /tmp/etap1_mitko_bid.log &
p1=$!
psql -X -v ON_ERROR_STOP=1 -c "select public.etap1_bid('borko','00112233-4455-4677-8899-aabbccddee03');" > /tmp/etap1_borko_bid.log &
p2=$!
wait "$p1"
wait "$p2"

psql -X -v ON_ERROR_STOP=1 <<'SQL'
do $$
declare
  v jsonb;
  v_id uuid;
  v_rows integer;
  v_distinct integer;
  v_closed integer;
begin
  v:=public.etap1_snapshot();
  v_id:=(v->'auction'->>'id')::uuid;
  select count(*),count(distinct amount) into v_rows,v_distinct
  from public.enchev_etap1_bids where auction_id=v_id;
  if v_rows<>2 or v_distinct<>2 or (v->'auction'->>'sequence')::int<>2
    or (v->'auction'->>'currentAmount')::numeric<>20200 then
    raise exception 'simultaneous bids corrupted order: %',v;
  end if;
  select count(*) into v_closed from public.enchev_etap1_auctions where status='closed';
  if v_closed<>1 then raise exception 'historical auction lost'; end if;
end $$;
SQL

# Neither public site visitor nor registered but unauthorized user may call RPC.
if psql -X -v ON_ERROR_STOP=1 -c "set role anon; select public.etap1_bid('mitko','00112233-4455-4677-8899-aabbccddee04');" >/tmp/etap1_anon.out 2>&1; then
  echo "FAIL: anon can call privileged bid RPC" >&2; exit 1
fi
if psql -X -v ON_ERROR_STOP=1 -c "set role authenticated; select * from public.enchev_etap1_bids;" >/tmp/etap1_auth.out 2>&1; then
  echo "FAIL: authenticated can read protected bid ledger directly" >&2; exit 1
fi
echo "ETAP1 POSTGRES INTEGRATION PASS: deterministic bids, retry, close/winner, concurrent serialization, RLS privileges."
