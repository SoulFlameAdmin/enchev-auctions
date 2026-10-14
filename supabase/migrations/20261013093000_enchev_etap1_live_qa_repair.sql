-- ENCHEV ETAP1 QA repairs — isolated DEMO database only. No payment flows.
-- Per-device sessions, role-scoped wallets, authoritative audit events and repeatable anti-snipe.
create table if not exists public.enchev_etap1_device_sessions (
  session_id uuid primary key,
  role text not null check (role in ('mitko','borko','enchev')),
  joined_at timestamptz not null default clock_timestamp(),
  last_seen timestamptz not null default clock_timestamp()
);
create index if not exists enchev_etap1_device_sessions_role_seen
  on public.enchev_etap1_device_sessions(role,last_seen desc);
alter table public.enchev_etap1_device_sessions enable row level security;
revoke all on public.enchev_etap1_device_sessions from public, anon, authenticated;
grant select,insert,update,delete on public.enchev_etap1_device_sessions to service_role;

-- Preserve live sessions when the migration is rolled out. Each new login gets its OWN row.
insert into public.enchev_etap1_device_sessions(session_id,role,last_seen)
select p.session_id,p.role,p.last_seen
from public.enchev_etap1_presence p
where p.role in ('mitko','borko','enchev') and p.session_id is not null
on conflict (session_id) do nothing;

alter table public.enchev_etap1_auctions
  add column if not exists extension_count integer not null default 0;

create table if not exists public.enchev_etap1_bid_attempts (
  id bigint generated always as identity primary key,
  auction_id uuid not null references public.enchev_etap1_auctions(id),
  role text not null check(role in ('mitko','borko','enchev')),
  session_id uuid not null,
  request_nonce uuid not null,
  requested_amount numeric(12,2),
  expected_sequence integer,
  result_code text not null,
  accepted boolean not null default false,
  received_at timestamptz not null default clock_timestamp()
);
create index if not exists enchev_etap1_attempts_recent on public.enchev_etap1_bid_attempts(auction_id,id desc);
alter table public.enchev_etap1_bid_attempts enable row level security;
revoke all on public.enchev_etap1_bid_attempts from public,anon,authenticated;
grant select,insert on public.enchev_etap1_bid_attempts to service_role;
grant usage,select on sequence public.enchev_etap1_bid_attempts_id_seq to service_role;

-- A snapshot transitions phases atomically using the DB clock, not browser clocks.
create or replace function public.etap1_snapshot()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_room public.enchev_etap1_rooms%rowtype;
  v_a public.enchev_etap1_auctions%rowtype;
  v_bids jsonb; v_now timestamptz:=clock_timestamp(); v_admitted_count integer;
begin
  select * into v_room from public.enchev_etap1_rooms
    where name='stage-one' for update;
  if not found or v_room.active_auction_id is null then
    return jsonb_build_object('status','idle','demo',true,'serverNow',v_now,
       'auction',null,'bids','[]'::jsonb);
  end if;
  select * into v_a from public.enchev_etap1_auctions
    where id=v_room.active_auction_id for update;
  if v_a.status='countdown' then
    select count(*) into v_admitted_count
    from public.enchev_etap1_admissions ad
    where ad.auction_id=v_a.id and ad.role in ('mitko','borko','enchev')
      and exists (
       select 1 from public.enchev_etap1_device_sessions ds
       where ds.role=ad.role and ds.last_seen>=v_now-interval '15 seconds'
      );
    if v_admitted_count<>3 then
      update public.enchev_etap1_auctions set status='canceled',closed_at=v_now
        where id=v_a.id returning * into v_a;
    elsif v_now>=v_a.started_at then
      update public.enchev_etap1_auctions set status='live'
        where id=v_a.id returning * into v_a;
    end if;
  end if;
  if v_a.status='live' and v_a.ends_at<=v_now then
    update public.enchev_etap1_auctions set status='closed',closed_at=v_now
      where id=v_a.id returning * into v_a;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
     'sequence',b.sequence,'role',b.actor,'amount',b.amount,'at',b.accepted_at)
       order by b.sequence desc),'[]'::jsonb) into v_bids
  from (select sequence,actor,amount,accepted_at from public.enchev_etap1_bids
        where auction_id=v_a.id order by sequence desc limit 30) b;
  return jsonb_build_object('status',v_a.status,'demo',true,'serverNow',v_now,
    'auction',jsonb_build_object(
       'id',v_a.id,'title',v_a.title,'currency',v_a.currency,
       'openingAmount',v_a.opening_amount,'currentAmount',v_a.current_amount,
       'increment',v_a.increment,'sequence',v_a.bid_sequence,
       'leadingRole',v_a.leading_role,
       'winnerRole',case when v_a.status='closed' then v_a.leading_role else null end,
       'startedAt',v_a.started_at,'endsAt',v_a.ends_at,'closedAt',v_a.closed_at,
       'nextBidAllowedAt',v_a.next_bid_allowed_at,'cooldownSeconds',5,
       'minimumStep',50,'maximumOffer',100000,'extensionCount',v_a.extension_count),
    'bids',v_bids);
end;
$$;

-- Exactly THREE distinct roles participate. A role may have multiple independent devices.
-- Readiness and wallet belong to the role, never to one particular device cookie.
create or replace function public.etap1_ready_lobby_secure(
  p_actor text,p_session_id uuid,p_ready boolean default null,p_rejoin boolean default false
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_now timestamptz:=clock_timestamp();
  v_room public.enchev_etap1_rooms%rowtype;
  v_state jsonb; v_status text; v_count integer; v_ready_count integer;
  v_people jsonb; v_id uuid; v_admitted boolean:=false; v_wallet jsonb:=null;
  v_devices integer:=0;
begin
  if p_actor not in ('mitko','borko','enchev','admin') then
    raise exception 'Invalid demo role';
  end if;
  if p_actor='admin' then
    if p_ready is not null or p_rejoin then raise exception 'Admin is read-only'; end if;
  elsif p_session_id is null then
    raise exception 'Missing session';
  end if;
  insert into public.enchev_etap1_rooms(name) values('stage-one')
    on conflict(name) do nothing;
  select * into v_room from public.enchev_etap1_rooms where name='stage-one' for update;
  v_state:=public.etap1_snapshot(); v_status:=v_state->>'status';
  if p_actor<>'admin' then
    if p_ready is not null and v_status in ('live','countdown') then
      raise exception 'Cannot change READY during active round';
    end if;
    if p_rejoin then
      if p_ready is distinct from false then raise exception 'Login cannot auto READY'; end if;
      insert into public.enchev_etap1_device_sessions(role,session_id,last_seen)
        values(p_actor,p_session_id,v_now)
        on conflict(session_id) do update set last_seen=excluded.last_seen;
      insert into public.enchev_etap1_presence(role,session_id,is_ready,last_seen)
        values(p_actor,p_session_id,false,v_now)
        on conflict(role) do update set session_id=excluded.session_id,
          is_ready=case when public.enchev_etap1_presence.last_seen<v_now-interval '15 seconds'
            then false else public.enchev_etap1_presence.is_ready end,
          last_seen=v_now;
      insert into public.enchev_etap1_demo_wallets(role,session_id,buying_power,lot_budget)
        values(p_actor,p_session_id,10000,10000)
        on conflict(role) do nothing;
    else
      update public.enchev_etap1_device_sessions set last_seen=v_now
        where role=p_actor and session_id=p_session_id;
      if not found then
        return jsonb_build_object('lobby',jsonb_build_object(
          'sessionCurrent',false,'admitted',false),'state',v_state);
      end if;
      update public.enchev_etap1_presence set
        last_seen=v_now,
        is_ready=case when p_ready is not null then p_ready
          when last_seen<v_now-interval '15 seconds' then false else is_ready end
        where role=p_actor;
    end if;
  end if;

  select count(*),count(*) filter(where p.is_ready) into v_count,v_ready_count
  from public.enchev_etap1_presence p
  where p.role in ('mitko','borko','enchev')
    and exists(select 1 from public.enchev_etap1_device_sessions ds
      where ds.role=p.role and ds.last_seen>=v_now-interval '15 seconds');
  if p_actor<>'admin' and p_ready is true and v_status not in ('live','countdown')
    and v_count=3 and v_ready_count=3
    and (select count(*) from public.enchev_etap1_demo_wallets w
      join public.enchev_etap1_presence p on p.role=w.role
      where p.is_ready and w.lot_budget>=16300 and w.buying_power>=16300
      and exists(select 1 from public.enchev_etap1_device_sessions ds
        where ds.role=p.role and ds.last_seen>=v_now-interval '15 seconds'))=3
  then
    insert into public.enchev_etap1_auctions
      (title,opening_amount,current_amount,increment,started_at,ends_at,status)
      values('2026 Volkswagen Golf GTI — DEMO',16250,16250,50,
        v_now+interval '30 seconds',v_now+interval '150 seconds','countdown')
      returning id into v_id;
    update public.enchev_etap1_rooms set active_auction_id=v_id
      where name='stage-one';
    insert into public.enchev_etap1_admissions(auction_id,role,session_id)
      select v_id,p.role,p.session_id from public.enchev_etap1_presence p
      where p.role in ('mitko','borko','enchev') and p.is_ready
       and exists(select 1 from public.enchev_etap1_device_sessions ds
        where ds.role=p.role and ds.last_seen>=v_now-interval '15 seconds');
    update public.enchev_etap1_presence set is_ready=false
      where role in ('mitko','borko','enchev');
  end if;
  select count(*),count(*) filter(where p.is_ready) into v_count,v_ready_count
  from public.enchev_etap1_presence p
  where p.role in ('mitko','borko','enchev')
    and exists(select 1 from public.enchev_etap1_device_sessions ds
      where ds.role=p.role and ds.last_seen>=v_now-interval '15 seconds');
  select coalesce(jsonb_agg(jsonb_build_object('role',p.role,'ready',p.is_ready)
      order by p.role),'[]'::jsonb) into v_people
  from public.enchev_etap1_presence p
  where p.role in ('mitko','borko','enchev')
    and exists(select 1 from public.enchev_etap1_device_sessions ds
      where ds.role=p.role and ds.last_seen>=v_now-interval '15 seconds');
  select active_auction_id into v_id from public.enchev_etap1_rooms where name='stage-one';
  if p_actor<>'admin' then
    select exists(select 1 from public.enchev_etap1_admissions a
        where a.auction_id=v_id and a.role=p_actor) into v_admitted;
    select jsonb_build_object('buyingPower',w.buying_power,'lotBudget',w.lot_budget)
      into v_wallet from public.enchev_etap1_demo_wallets w where w.role=p_actor;
    select count(*) into v_devices from public.enchev_etap1_device_sessions ds
      where ds.role=p_actor and ds.last_seen>=v_now-interval '15 seconds';
  end if;
  return jsonb_build_object('lobby',jsonb_build_object(
    'participants',v_people,'count',v_count,'readyCount',v_ready_count,
    'minPlayers',3,'sessionCurrent',true,'admitted',v_admitted,'wallet',v_wallet,
    'activeDevices',v_devices),'state',public.etap1_snapshot());
end;
$$;

create or replace function public.etap1_wallet_update_secure(
 p_actor text,p_session_id uuid,p_topup numeric default 0,p_lot_budget numeric default null
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_room public.enchev_etap1_rooms%rowtype;
  v_wallet public.enchev_etap1_demo_wallets%rowtype;
  v_state jsonb; v_next_power numeric; v_next_budget numeric;
begin
  if p_actor not in ('mitko','borko','enchev') or p_session_id is null
    or p_topup is null or p_topup<0 or p_topup>90000 or p_topup<>trunc(p_topup,0)
    then raise exception 'Invalid demo budget request'; end if;
  select * into v_room from public.enchev_etap1_rooms
    where name='stage-one' for update;
  v_state:=public.etap1_snapshot();
  if v_state->>'status' in ('live','countdown') then
    raise exception 'Budget locked during countdown and LIVE';
  end if;
  if not exists(select 1 from public.enchev_etap1_device_sessions ds
      join public.enchev_etap1_presence p on p.role=ds.role
      where ds.role=p_actor and ds.session_id=p_session_id
        and ds.last_seen>=clock_timestamp()-interval '15 seconds'
        and p.is_ready=false) then
    raise exception 'Join lobby and unready before changing budget';
  end if;
  select * into v_wallet from public.enchev_etap1_demo_wallets
    where role=p_actor for update;
  if not found then raise exception 'Demo wallet missing'; end if;
  v_next_power:=v_wallet.buying_power+p_topup;
  v_next_budget:=coalesce(p_lot_budget,v_wallet.lot_budget);
  if v_next_power>100000 or v_next_budget<0 or v_next_budget>v_next_power
    or v_next_budget<>trunc(v_next_budget,0) then
    raise exception 'Demo lot budget must fit buying power'; end if;
  update public.enchev_etap1_demo_wallets set
    buying_power=v_next_power,lot_budget=v_next_budget,updated_at=clock_timestamp()
    where role=p_actor;
  return public.etap1_ready_lobby_secure(p_actor,p_session_id,null,false);
end;
$$;

-- A duplicate request never creates a second accepted bid. All attempts are auditable.
-- The room lock serializes two browser tabs and three devices; the DB is the authority.
create or replace function public.etap1_bid_offer_secure(
 p_actor text,p_session_id uuid,p_nonce uuid,p_amount numeric,p_expected_sequence integer
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_room public.enchev_etap1_rooms%rowtype;
  v_a public.enchev_etap1_auctions%rowtype;
  v_wallet public.enchev_etap1_demo_wallets%rowtype;
  v_existing public.enchev_etap1_bids%rowtype;
  v_now timestamptz; v_code text; v_extend boolean:=false;
begin
  if p_actor not in ('mitko','borko','enchev') or p_session_id is null
     or p_nonce is null then raise exception 'Invalid offer identity'; end if;
  select * into v_room from public.enchev_etap1_rooms
    where name='stage-one' for update;
  if not found or v_room.active_auction_id is null then
    raise exception 'No demo round'; end if;
  select * into v_a from public.enchev_etap1_auctions
    where id=v_room.active_auction_id for update;
  v_now:=clock_timestamp();

  if not exists(select 1 from public.enchev_etap1_device_sessions
       where role=p_actor and session_id=p_session_id
         and last_seen>=v_now-interval '15 seconds') then
    v_code:='SESSION_EXPIRED';
  elsif not exists(select 1 from public.enchev_etap1_admissions a
       where a.auction_id=v_a.id and a.role=p_actor) then
    v_code:='SESSION_NOT_ADMITTED';
  end if;
  if v_code is not null then
    insert into public.enchev_etap1_bid_attempts
      (auction_id,role,session_id,request_nonce,requested_amount,expected_sequence,result_code)
      values(v_a.id,p_actor,p_session_id,p_nonce,p_amount,p_expected_sequence,v_code);
    return jsonb_build_object('accepted',false,'code',v_code,'state',public.etap1_snapshot());
  end if;

  select * into v_existing from public.enchev_etap1_bids
    where auction_id=v_a.id and actor=p_actor and request_nonce=p_nonce;
  if found then
    v_code:=case when v_existing.amount is distinct from p_amount
      or p_expected_sequence is distinct from v_existing.sequence-1
      then 'NONCE_MISMATCH' else 'DUPLICATE' end;
    insert into public.enchev_etap1_bid_attempts
      (auction_id,role,session_id,request_nonce,requested_amount,expected_sequence,result_code,accepted)
      values(v_a.id,p_actor,p_session_id,p_nonce,p_amount,p_expected_sequence,v_code,v_code='DUPLICATE');
    return jsonb_build_object('accepted',v_code='DUPLICATE','duplicate',v_code='DUPLICATE',
      'code',v_code,'state',public.etap1_snapshot());
  end if;

  -- Snapshot may close a round whose authoritative end was reached during the request.
  perform public.etap1_snapshot();
  select * into v_a from public.enchev_etap1_auctions where id=v_a.id;
  v_now:=clock_timestamp();
  if v_a.status='countdown' or v_now<v_a.started_at then
    v_code:='AUCTION_NOT_STARTED';
  elsif v_a.status<>'live' or v_now>=v_a.ends_at then
    v_code:='AUCTION_CLOSED';
  elsif p_expected_sequence is null or p_expected_sequence<>v_a.bid_sequence then
    v_code:='PRICE_CHANGED';
  elsif v_a.leading_role=p_actor then
    v_code:='ALREADY_LEADING';
  elsif v_a.next_bid_allowed_at is not null and v_now<v_a.next_bid_allowed_at then
    v_code:='COOLDOWN_ACTIVE';
  elsif p_amount is null or p_amount<>trunc(p_amount,0)
       or p_amount>100000 or p_amount<v_a.current_amount+50 then
    v_code:='INVALID_AMOUNT';
  else
    select * into v_wallet from public.enchev_etap1_demo_wallets
       where role=p_actor for update;
    if not found or p_amount>v_wallet.buying_power or p_amount>v_wallet.lot_budget then
      v_code:='LIMIT_EXCEEDED';
    end if;
  end if;
  if v_code is not null then
    insert into public.enchev_etap1_bid_attempts
      (auction_id,role,session_id,request_nonce,requested_amount,expected_sequence,result_code)
      values(v_a.id,p_actor,p_session_id,p_nonce,p_amount,p_expected_sequence,v_code);
    return jsonb_build_object('accepted',false,'code',v_code,'state',public.etap1_snapshot());
  end if;

  v_extend:=v_a.ends_at-v_now<=interval '10 seconds';
  insert into public.enchev_etap1_bids
    (auction_id,actor,request_nonce,sequence,amount)
    values(v_a.id,p_actor,p_nonce,v_a.bid_sequence+1,p_amount);
  update public.enchev_etap1_auctions set
    current_amount=p_amount,bid_sequence=bid_sequence+1,
    leading_role=p_actor,next_bid_allowed_at=v_now+interval '5 seconds',
    ends_at=case when v_extend then greatest(ends_at,v_now+interval '10 seconds') else ends_at end,
    extension_count=extension_count+case when v_extend then 1 else 0 end
    where id=v_a.id;
  insert into public.enchev_etap1_bid_attempts
    (auction_id,role,session_id,request_nonce,requested_amount,expected_sequence,result_code,accepted)
    values(v_a.id,p_actor,p_session_id,p_nonce,p_amount,p_expected_sequence,
      case when v_extend then 'ACCEPTED_EXTENDED' else 'ACCEPTED' end,true);
  return jsonb_build_object('accepted',true,'duplicate',false,'extended',v_extend,
    'state',public.etap1_snapshot());
end;
$$;

-- These DEFINER RPCs are callable only through the protected, server-side service role.
revoke all on function public.etap1_snapshot() from public,anon,authenticated;
revoke all on function public.etap1_ready_lobby_secure(text,uuid,boolean,boolean) from public,anon,authenticated;
revoke all on function public.etap1_wallet_update_secure(text,uuid,numeric,numeric) from public,anon,authenticated;
revoke all on function public.etap1_bid_offer_secure(text,uuid,uuid,numeric,integer) from public,anon,authenticated;
grant execute on function public.etap1_snapshot() to service_role;
grant execute on function public.etap1_ready_lobby_secure(text,uuid,boolean,boolean) to service_role;
grant execute on function public.etap1_wallet_update_secure(text,uuid,numeric,numeric) to service_role;
grant execute on function public.etap1_bid_offer_secure(text,uuid,uuid,numeric,integer) to service_role;
