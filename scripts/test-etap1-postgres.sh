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

# Also validate the atomic two/three-participant READY lobby in disposable CI.
psql -X -v ON_ERROR_STOP=1 -f supabase/migrations/20261012033000_enchev_etap1_ready_lobby.sql
psql -X -v ON_ERROR_STOP=1 -f supabase/migrations/20261012160000_enchev_etap1_krum_preview_bidder.sql
psql -X -v ON_ERROR_STOP=1 <<'SQL'
do $$
declare
  v jsonb;
  v_before uuid;
  v_after uuid;
begin
  update public.enchev_etap1_auctions
    set ends_at=clock_timestamp()-interval '1 second'
    where id=(select active_auction_id from public.enchev_etap1_rooms where name='stage-one');
  v:=public.etap1_snapshot();
  if v->>'status'<>'closed' then raise exception 'test preparation failed'; end if;
  v_before:=(v->'auction'->>'id')::uuid;

  -- Three online: two READY should NOT start until the third participant joins.
  perform public.etap1_ready_lobby('mitko',null);
  perform public.etap1_ready_lobby('borko',null);
  perform public.etap1_ready_lobby('enchev',null);
  v:=public.etap1_ready_lobby('mitko',true);
  if v->'lobby'->>'readyCount'<>'1' then raise exception 'first READY ignored'; end if;
  v:=public.etap1_ready_lobby('borko',true);
  if v->'state'->>'status'='live' or v->'lobby'->>'readyCount'<>'2' then
    raise exception 'started before observer was READY'; end if;
  v:=public.etap1_ready_lobby('enchev',true);
  if v->'state'->>'status'<>'live' or v->'lobby'->>'readyCount'<>'0' then
    raise exception 'third READY did not start atomic round or reset READY'; end if;
  v_after:=(v->'state'->'auction'->>'id')::uuid;
  if v_after=v_before then raise exception 'reused auction id'; end if;
  if (v->'state'->'auction'->>'currentAmount')::numeric <>16250 then
    raise exception 'unexpected READY lot opening'; end if;
  if (select count(*) from public.enchev_etap1_auctions where id=v_after) <> 1 then
    raise exception 'READY created duplicate auctions'; end if;

  -- Simulate observer leaving and next round: two participants suffice.
  update public.enchev_etap1_auctions
    set ends_at=clock_timestamp()-interval '1 second' where id=v_after;
  perform public.etap1_snapshot();
  update public.enchev_etap1_presence
    set last_seen=clock_timestamp()-interval '45 seconds'
    where role='enchev';
  v:=public.etap1_ready_lobby('mitko',true);
  if v->'state'->>'status'='live' then raise exception 'single READY started round'; end if;
  v:=public.etap1_ready_lobby('borko',true);
  if v->'state'->>'status'<>'live' or (v->'lobby'->>'count')::int<>2 then
    raise exception 'two-person READY did not start round'; end if;
end $$;
SQL

# Four demo participants: Krum is a valid bidder, Enchev remains observer.
psql -X -v ON_ERROR_STOP=1 <<'SQL'
do $$
declare
  v jsonb;
  v_id uuid;
begin
  update public.enchev_etap1_auctions
    set ends_at=clock_timestamp()-interval '1 second'
    where id=(select active_auction_id from public.enchev_etap1_rooms where name='stage-one');
  perform public.etap1_snapshot();
  update public.enchev_etap1_presence set last_seen=clock_timestamp()-interval '1 minute', is_ready=false;

  perform public.etap1_ready_lobby('mitko',null);
  perform public.etap1_ready_lobby('borko',null);
  perform public.etap1_ready_lobby('krum',null);
  perform public.etap1_ready_lobby('enchev',null);
  perform public.etap1_ready_lobby('mitko',true);
  perform public.etap1_ready_lobby('borko',true);
  v:=public.etap1_ready_lobby('krum',true);
  if v->'state'->>'status'='live' then raise exception 'four-person room started before fourth READY'; end if;
  v:=public.etap1_ready_lobby('enchev',true);
  if v->'state'->>'status'<>'live' or (v->'lobby'->>'count')::int<>4
    or (v->'lobby'->>'readyCount')::int<>0 then
    raise exception 'four-person READY failed: %',v; end if;
  v_id:=(v->'state'->'auction'->>'id')::uuid;
  v:=public.etap1_bid('krum','00112233-4455-4677-8899-aabbccddee55');
  if v->'auction'->>'leadingRole'<>'krum'
     or (v->'auction'->>'currentAmount')::numeric<>16350
     or (select count(*) from public.enchev_etap1_bids where auction_id=v_id and actor='krum')<>1 then
    raise exception 'Krum accepted bid failed: %',v; end if;
  v:=public.etap1_bid('krum','00112233-4455-4677-8899-aabbccddee55');
  if (v->'auction'->>'sequence')::int<>1 then
    raise exception 'Krum idempotency failed'; end if;
end $$;
SQL
echo "ETAP1 KRUM BIDDER PASS: four-person READY barrier, Krum bid and retry."

if psql -X -v ON_ERROR_STOP=1 -c "set role anon; select public.etap1_ready_lobby('mitko',true);" >/tmp/etap1_ready_anon.out 2>&1; then
  echo "FAIL: anon can call privileged READY RPC" >&2; exit 1
fi
echo "ETAP1 READY LOBBY INTEGRATION PASS: 2/3-person barrier, atomic start, distinct IDs, reset, and RLS."

# Check that every new LOGIN gets a fresh session and READY is required per round.
psql -X -v ON_ERROR_STOP=1 -f supabase/migrations/20261012170000_enchev_etap1_session_admission.sql
psql -X -v ON_ERROR_STOP=1 <<'SQL'
do $$
declare
  m1 uuid:='11111111-1111-4111-8111-111111111111';
  m2 uuid:='11111111-1111-4111-8111-222222222222';
  b1 uuid:='22222222-2222-4222-8222-111111111111';
  k1 uuid:='33333333-3333-4333-8333-111111111111';
  v jsonb;
  round_one uuid;
  round_two uuid;
begin
  -- Finish the legacy test round, and expire all legacy heartbeat entries.
  update public.enchev_etap1_auctions
    set ends_at=clock_timestamp()-interval '1 second'
    where id=(select active_auction_id from public.enchev_etap1_rooms where name='stage-one');
  perform public.etap1_snapshot();
  update public.enchev_etap1_presence set last_seen=clock_timestamp()-interval '1 minute',is_ready=false;

  perform public.etap1_ready_lobby_secure('mitko',m1,false,true);
  perform public.etap1_ready_lobby_secure('borko',b1,false,true);
  v:=public.etap1_ready_lobby_secure('mitko',m1,null,false);
  if v->'state'->>'status'='live' or (v->'lobby'->>'readyCount')::int<>0 then
    raise exception 'Login or polling auto-started round'; end if;

  v:=public.etap1_ready_lobby_secure('mitko',m1,true,false);
  if v->'state'->>'status'='live' then raise exception 'Single READY auto-started'; end if;
  v:=public.etap1_ready_lobby_secure('borko',b1,true,false);
  if v->'state'->>'status'<>'live' or v->'lobby'->>'admitted'<>'true' then
    raise exception 'Both READY did not start or admit bidder'; end if;
  round_one:=(v->'state'->'auction'->>'id')::uuid;
  v:=public.etap1_ready_lobby_secure('mitko',m1,null,false);
  if v->'lobby'->>'admitted'<>'true' then
    raise exception 'First READY bidder missing admission'; end if;

  -- A NEW Krum login during a live round is sent to LOBBY, not admitted.
  v:=public.etap1_ready_lobby_secure('krum',k1,false,true);
  if v->'lobby'->>'admitted' <> 'false' then
    raise exception 'Late login bypassed READY barrier'; end if;
  begin
    perform public.etap1_bid_admitted('krum',k1,gen_random_uuid());
    raise exception 'Late Krum was allowed to bid';
  exception when raise_exception then
    if sqlerrm='Late Krum was allowed to bid' then raise; end if;
  end;
  v:=public.etap1_bid_admitted('mitko',m1,gen_random_uuid());
  if v->'auction'->>'leadingRole'<>'mitko' then
    raise exception 'Admitted bidder rejected'; end if;

  -- Logging back in with the SAME role creates a NEW session: NO old admission.
  v:=public.etap1_ready_lobby_secure('mitko',m2,false,true);
  if v->'lobby'->>'admitted'<>'false' then
    raise exception 'Fresh login inherited prior READY admission'; end if;
  v:=public.etap1_ready_lobby_secure('mitko',m1,null,false);
  if v->'lobby'->>'sessionCurrent'<>'false' then
    raise exception 'Stale phone session was not invalidated'; end if;
  begin
    perform public.etap1_bid_admitted('mitko',m2,gen_random_uuid());
    raise exception 'Re-login bypassed READY barrier';
  exception when raise_exception then
    if sqlerrm='Re-login bypassed READY barrier' then raise; end if;
  end;

  -- Closed winner -> fresh login -> polling does not start next round.
  update public.enchev_etap1_auctions
    set ends_at=clock_timestamp()-interval '1 second'
    where id=round_one;
  v:=public.etap1_ready_lobby_secure('mitko',m2,null,false);
  if v->'state'->>'status'<>'closed' then
    raise exception 'Winner did not return to closed lobby'; end if;
  update public.enchev_etap1_presence
    set last_seen=clock_timestamp()-interval '1 minute',is_ready=false
    where role='krum';
  -- Even an accidentally persisted READY flag cannot auto-start on polling.
  update public.enchev_etap1_presence set is_ready=true
    where role in ('mitko','borko');
  v:=public.etap1_ready_lobby_secure('borko',b1,null,false);
  if v->'state'->>'status'='live' then
    raise exception 'Polling restarted auction without click'; end if;
  -- Re-login always resets ready; no old READY carries over.
  perform public.etap1_ready_lobby_secure('mitko',m2,false,true);
  perform public.etap1_ready_lobby_secure('borko',b1,false,true);
  v:=public.etap1_ready_lobby_secure('borko',b1,true,false);
  if v->'state'->>'status'='live' then
    raise exception 'First READY after winner started round'; end if;
  v:=public.etap1_ready_lobby_secure('mitko',m2,true,false);
  if v->'state'->>'status'<>'live' then
    raise exception 'Second explicit READY did not start NEW round'; end if;
  round_two:=(v->'state'->'auction'->>'id')::uuid;
  if round_two=round_one or v->'lobby'->>'admitted'<>'true' then
    raise exception 'New auction reused prior ID or session not admitted'; end if;
  v:=public.etap1_bid_admitted('borko',b1,gen_random_uuid());
  if v->'auction'->>'leadingRole'<>'borko' then
    raise exception 'Borko not admitted to new round'; end if;
end $$;
SQL
echo "ETAP1 SESSION ADMISSION INTEGRATION PASS: login->lobby, READY-only start, winner->lobby, re-login blocked, admitted bids."
