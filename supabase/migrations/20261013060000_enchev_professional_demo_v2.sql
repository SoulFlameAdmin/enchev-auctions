-- ENCHEV Eтап 1 DEMO V2; isolated demo project only; no real money.
-- Preserves historic auctions and bid ledgers. Changes only private demo behavior.
create table if not exists public.enchev_etap1_demo_wallets(
 role text primary key check(role in ('mitko','borko','enchev')),
 session_id uuid not null,
 buying_power numeric(12,2) not null default 10000 check(buying_power between 10000 and 100000),
 lot_budget numeric(12,2) not null default 10000 check(lot_budget between 0 and 100000),
 updated_at timestamptz not null default clock_timestamp(),
 check(lot_budget<=buying_power)
);
alter table public.enchev_etap1_demo_wallets enable row level security;
revoke all on public.enchev_etap1_demo_wallets from public, anon, authenticated;
alter table public.enchev_etap1_auctions
 add column if not exists next_bid_allowed_at timestamptz;
alter table public.enchev_etap1_auctions
 drop constraint if exists enchev_etap1_auctions_status_check;
alter table public.enchev_etap1_auctions
 add constraint enchev_etap1_auctions_status_check
 check(status in ('live','closed','countdown','canceled'));

-- Snapshot is the single authority for phase transitions. It also ensures
-- countdown cannot start if any admitted bidder disconnected/took over.
create or replace function public.etap1_snapshot()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
 v_room public.enchev_etap1_rooms%rowtype;
 v_a public.enchev_etap1_auctions%rowtype;
 v_bids jsonb;
 v_now timestamptz;
 v_admitted_count integer;
begin
 select * into v_room from public.enchev_etap1_rooms
  where name='stage-one' for update;
 v_now:=clock_timestamp();
 if not found or v_room.active_auction_id is null then
  return jsonb_build_object('status','idle','demo',true,'serverNow',v_now,
    'auction',null,'bids','[]'::jsonb);
 end if;
 select * into v_a from public.enchev_etap1_auctions
   where id=v_room.active_auction_id for update;
 if v_a.status='countdown' then
   select count(*) into v_admitted_count
   from public.enchev_etap1_admissions ad
   join public.enchev_etap1_presence pr on pr.role=ad.role
   where ad.auction_id=v_a.id and ad.role in ('mitko','borko','enchev')
     and ad.session_id=pr.session_id and pr.last_seen>=v_now-interval '15 seconds';
   if v_admitted_count <> 3 then
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
 from (select sequence,actor,amount,accepted_at
   from public.enchev_etap1_bids where auction_id=v_a.id
   order by sequence desc limit 15) b;
 return jsonb_build_object(
  'status',v_a.status,'demo',true,'serverNow',v_now,
  'auction',jsonb_build_object(
   'id',v_a.id,'title',v_a.title,'currency',v_a.currency,
   'openingAmount',v_a.opening_amount,'currentAmount',v_a.current_amount,
   'increment',v_a.increment,'sequence',v_a.bid_sequence,
   'leadingRole',v_a.leading_role,
   'winnerRole',case when v_a.status='closed' then v_a.leading_role else null end,
   'startedAt',v_a.started_at,'endsAt',v_a.ends_at,'closedAt',v_a.closed_at,
   'nextBidAllowedAt',v_a.next_bid_allowed_at,
   'cooldownSeconds',5,'minimumStep',50,'maximumOffer',100000),
  'bids',v_bids);
end;
$$;

create or replace function public.etap1_ready_lobby_secure(
 p_actor text,p_session_id uuid,p_ready boolean default null,p_rejoin boolean default false
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
 v_now timestamptz:=clock_timestamp();
 v_room public.enchev_etap1_rooms%rowtype;
 v_state jsonb;
 v_status text;
 v_count integer;
 v_ready_count integer;
 v_people jsonb;
 v_id uuid;
 v_admitted boolean:=false;
 v_wallet jsonb:=null;
begin
 if p_actor not in ('mitko','borko','enchev','admin') then
   raise exception 'Invalid demo role';
 end if;
 if p_actor='admin' then
   if p_ready is not null or p_rejoin then raise exception 'Admin is read-only'; end if;
 elsif p_session_id is null then raise exception 'Missing session';
 end if;
 insert into public.enchev_etap1_rooms(name) values('stage-one')
   on conflict(name) do nothing;
 select * into v_room from public.enchev_etap1_rooms
   where name='stage-one' for update;
 v_state:=public.etap1_snapshot();
 v_status:=v_state->>'status';

 if p_actor<>'admin' then
   if p_rejoin then
     if p_ready is distinct from false then raise exception 'Rejoin must reset READY'; end if;
     insert into public.enchev_etap1_presence(role,session_id,is_ready,last_seen)
       values(p_actor,p_session_id,false,v_now)
       on conflict(role) do update set
         session_id=excluded.session_id,is_ready=false,last_seen=excluded.last_seen;
     insert into public.enchev_etap1_demo_wallets(role,session_id,buying_power,lot_budget)
       values(p_actor,p_session_id,10000,10000)
       on conflict(role) do update set session_id=excluded.session_id,
         buying_power=10000,lot_budget=10000,updated_at=v_now;
   else
     update public.enchev_etap1_presence set
       last_seen=v_now,
       is_ready=case when p_ready is not null then p_ready
          when last_seen<v_now-interval '15 seconds' then false else is_ready end
       where role=p_actor and session_id=p_session_id;
     if not found then
       return jsonb_build_object('lobby',jsonb_build_object(
        'sessionCurrent',false,'admitted',false),'state',v_state);
     end if;
     if v_status in ('live','countdown') and p_ready is not null then
        raise exception 'Cannot READY during active round';
     end if;
   end if;
 end if;
 select count(*),count(*) filter(where is_ready) into v_count,v_ready_count
 from public.enchev_etap1_presence
 where role in ('mitko','borko','enchev') and session_id is not null
   and last_seen>=v_now-interval '15 seconds';

 -- Only the THIRD explicit READY can create a 30-second scheduled countdown.
 if p_actor<>'admin' and p_ready is true
    and v_status not in ('live','countdown')
    and v_count=3 and v_ready_count=3
    and (select count(*) from public.enchev_etap1_demo_wallets w
      join public.enchev_etap1_presence p
      on p.role=w.role and p.session_id=w.session_id
      where p.is_ready and p.last_seen>=v_now-interval '15 seconds'
       and w.lot_budget>=16300 and w.buying_power>=16300)=3 then
   insert into public.enchev_etap1_auctions
     (title,opening_amount,current_amount,increment,started_at,ends_at,status)
   values ('2026 Volkswagen Golf GTI — DEMO',16250,16250,50,
       v_now+interval '30 seconds',v_now+interval '150 seconds','countdown')
   returning id into v_id;
   update public.enchev_etap1_rooms set active_auction_id=v_id where name='stage-one';
   insert into public.enchev_etap1_admissions(auction_id,role,session_id)
     select v_id,role,session_id from public.enchev_etap1_presence
       where role in ('mitko','borko','enchev') and is_ready
          and last_seen>=v_now-interval '15 seconds';
   update public.enchev_etap1_presence set is_ready=false
       where role in ('mitko','borko','enchev');
 end if;

 select count(*),count(*) filter(where is_ready) into v_count,v_ready_count
 from public.enchev_etap1_presence
 where role in ('mitko','borko','enchev') and session_id is not null
   and last_seen>=v_now-interval '15 seconds';
 select coalesce(jsonb_agg(jsonb_build_object('role',role,'ready',is_ready)
     order by role),'[]'::jsonb) into v_people
 from public.enchev_etap1_presence
 where role in ('mitko','borko','enchev') and session_id is not null
  and last_seen>=v_now-interval '15 seconds';
 select active_auction_id into v_id from public.enchev_etap1_rooms
  where name='stage-one';
 if p_actor<>'admin' then
   select exists(select 1 from public.enchev_etap1_admissions a
    where a.auction_id=v_id and a.role=p_actor and a.session_id=p_session_id)
    into v_admitted;
   select jsonb_build_object('buyingPower',w.buying_power,
      'lotBudget',w.lot_budget) into v_wallet
   from public.enchev_etap1_demo_wallets w
   where w.role=p_actor and w.session_id=p_session_id;
 end if;
 return jsonb_build_object('lobby',jsonb_build_object(
   'participants',v_people,'count',v_count,'readyCount',v_ready_count,
   'minPlayers',3,'sessionCurrent',true,'admitted',v_admitted,
   'wallet',v_wallet),'state',public.etap1_snapshot());
end;
$$;

-- LOGIN never silently sets READY or auto-starts; participants configure budget.
create or replace function public.etap1_join_lobby_automatic(
 p_actor text,p_session_id uuid
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if p_actor not in ('mitko','borko','enchev') or p_session_id is null then
   raise exception 'Only invited demo participants can join';
 end if;
 return public.etap1_ready_lobby_secure(p_actor,p_session_id,false,true);
end;
$$;

create or replace function public.etap1_wallet_update_secure(
 p_actor text,p_session_id uuid,p_topup numeric default 0,
 p_lot_budget numeric default null
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
 v_room public.enchev_etap1_rooms%rowtype;
 v_wallet public.enchev_etap1_demo_wallets%rowtype;
 v_state jsonb;
 v_next_power numeric;
 v_next_budget numeric;
begin
 if p_actor not in ('mitko','borko','enchev') or p_session_id is null
    or p_topup is null or p_topup<0 or p_topup>90000
    or p_topup<>trunc(p_topup,0) then
   raise exception 'Invalid demo budget request';
 end if;
 select * into v_room from public.enchev_etap1_rooms
   where name='stage-one' for update;
 v_state:=public.etap1_snapshot();
 if v_state->>'status' in ('live','countdown') then
   raise exception 'Budget locked during countdown and live round';
 end if;
 if not exists(select 1 from public.enchev_etap1_presence
    where role=p_actor and session_id=p_session_id
      and last_seen>=clock_timestamp()-interval '15 seconds'
      and is_ready=false) then
   raise exception 'Rejoin lobby and unready before changing budget';
 end if;
 select * into v_wallet from public.enchev_etap1_demo_wallets
   where role=p_actor and session_id=p_session_id for update;
 if not found then raise exception 'Demo wallet missing'; end if;
 v_next_power:=v_wallet.buying_power+p_topup;
 v_next_budget:=coalesce(p_lot_budget,v_wallet.lot_budget);
 if v_next_power>100000 or v_next_budget<0
    or v_next_budget>v_next_power or v_next_budget<>trunc(v_next_budget,0) then
   raise exception 'Demo budget must be within your buying power and 100,000 EUR';
 end if;
 update public.enchev_etap1_demo_wallets set
   buying_power=v_next_power,lot_budget=v_next_budget,
   updated_at=clock_timestamp() where role=p_actor;
 return public.etap1_ready_lobby_secure(p_actor,p_session_id,null,false);
end;
$$;

-- Atomic offer, expected sequence, exact confirmed absolute amount and 5s ALL-user lock.
create or replace function public.etap1_bid_offer_secure(
 p_actor text,p_session_id uuid,p_nonce uuid,
 p_amount numeric,p_expected_sequence integer
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
 v_room public.enchev_etap1_rooms%rowtype;
 v_a public.enchev_etap1_auctions%rowtype;
 v_wallet public.enchev_etap1_demo_wallets%rowtype;
 v_existing uuid;
 v_now timestamptz;
 v_state jsonb;
 v_code text;
begin
 if p_actor not in ('mitko','borko','enchev') or p_session_id is null
    or p_nonce is null then raise exception 'Invalid offer identity'; end if;
 select * into v_room from public.enchev_etap1_rooms
  where name='stage-one' for update;
 if not found or v_room.active_auction_id is null then
   raise exception 'No demo round';
 end if;
 select * into v_a from public.enchev_etap1_auctions
   where id=v_room.active_auction_id for update;
 select id into v_existing from public.enchev_etap1_bids
  where auction_id=v_a.id and actor=p_actor and request_nonce=p_nonce;
 -- Exact same nonce is a safe retry, never a second bid.
 if found then
   return jsonb_build_object('accepted',true,'duplicate',true,
     'state',public.etap1_snapshot());
 end if;
 v_now:=clock_timestamp();
 v_state:=public.etap1_snapshot();
 select * into v_a from public.enchev_etap1_auctions where id=v_a.id;
 if not exists(select 1 from public.enchev_etap1_admissions a
   join public.enchev_etap1_presence p
     on p.role=a.role and p.session_id=a.session_id
   where a.auction_id=v_a.id and a.role=p_actor
     and a.session_id=p_session_id) then
   v_code:='SESSION_NOT_ADMITTED';
 elsif v_a.status='countdown' or v_now<v_a.started_at then
   v_code:='AUCTION_NOT_STARTED';
 elsif v_a.status<>'live' or v_now>=v_a.ends_at then
   v_code:='AUCTION_CLOSED';
 elsif p_amount is null or p_amount<>trunc(p_amount,0) or p_amount>100000
   or p_amount<v_a.current_amount+50 then
   v_code:='INVALID_AMOUNT';
 elsif p_expected_sequence is null or p_expected_sequence<>v_a.bid_sequence then
   v_code:='PRICE_CHANGED';
 elsif v_a.leading_role=p_actor then
   v_code:='ALREADY_LEADING';
 elsif v_a.next_bid_allowed_at is not null and v_now<v_a.next_bid_allowed_at then
   v_code:='COOLDOWN_ACTIVE';
 else
   select * into v_wallet from public.enchev_etap1_demo_wallets w
    where w.role=p_actor and w.session_id=p_session_id for update;
   if not found or p_amount>v_wallet.buying_power or p_amount>v_wallet.lot_budget then
     v_code:='LIMIT_EXCEEDED';
   end if;
 end if;
 if v_code is not null then
   return jsonb_build_object('accepted',false,'code',v_code,
    'state',public.etap1_snapshot());
 end if;
 insert into public.enchev_etap1_bids
  (auction_id,actor,request_nonce,sequence,amount)
 values(v_a.id,p_actor,p_nonce,v_a.bid_sequence+1,p_amount);
 update public.enchev_etap1_auctions
 set current_amount=p_amount,bid_sequence=bid_sequence+1,
   leading_role=p_actor,next_bid_allowed_at=v_now+interval '5 seconds',
   ends_at=case when ends_at-v_now<=interval '10 seconds'
     then v_now+interval '10 seconds' else ends_at end
 where id=v_a.id;
 return jsonb_build_object('accepted',true,'duplicate',false,
   'state',public.etap1_snapshot());
end;
$$;

revoke all on function public.etap1_wallet_update_secure(text,uuid,numeric,numeric)
 from public,anon,authenticated;
grant execute on function public.etap1_wallet_update_secure(text,uuid,numeric,numeric) to service_role;
revoke all on function public.etap1_bid_offer_secure(text,uuid,uuid,numeric,integer)
 from public,anon,authenticated;
grant execute on function public.etap1_bid_offer_secure(text,uuid,uuid,numeric,integer) to service_role;
-- Legacy RPC is not used by the revised API. Deny any ordinary client calls.
revoke all on function public.etap1_bid_admitted(text,uuid,uuid)
 from public,anon,authenticated;
