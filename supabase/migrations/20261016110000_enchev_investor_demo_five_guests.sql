-- ENCHEV investor demo: five independent fake-money preview guest identities.
-- Original 3-person QA mode is preserved when no guest seats are connected.
alter table public.enchev_etap1_auctions
  add column if not exists min_participants integer not null default 3
  check(min_participants between 2 and 6);
alter table public.enchev_etap1_presence drop constraint if exists enchev_etap1_presence_role_check;
alter table public.enchev_etap1_presence add constraint enchev_etap1_presence_role_check check(role in ('mitko','borko','enchev','guest1','guest2','guest3','guest4','guest5','krum'));
alter table public.enchev_etap1_admissions drop constraint if exists enchev_etap1_admissions_role_check;
alter table public.enchev_etap1_admissions add constraint enchev_etap1_admissions_role_check check(role in ('mitko','borko','enchev','guest1','guest2','guest3','guest4','guest5','krum'));
alter table public.enchev_etap1_device_sessions drop constraint if exists enchev_etap1_device_sessions_role_check;
alter table public.enchev_etap1_device_sessions add constraint enchev_etap1_device_sessions_role_check check(role in ('mitko','borko','enchev','guest1','guest2','guest3','guest4','guest5'));
alter table public.enchev_etap1_demo_wallets drop constraint if exists enchev_etap1_demo_wallets_role_check;
alter table public.enchev_etap1_demo_wallets add constraint enchev_etap1_demo_wallets_role_check check(role in ('mitko','borko','enchev','guest1','guest2','guest3','guest4','guest5'));
alter table public.enchev_etap1_bid_attempts drop constraint if exists enchev_etap1_bid_attempts_role_check;
alter table public.enchev_etap1_bid_attempts add constraint enchev_etap1_bid_attempts_role_check check(role in ('mitko','borko','enchev','guest1','guest2','guest3','guest4','guest5'));
alter table public.enchev_etap1_bids drop constraint if exists enchev_etap1_bids_actor_check;
alter table public.enchev_etap1_bids add constraint enchev_etap1_bids_actor_check check(actor in ('mitko','borko','enchev','guest1','guest2','guest3','guest4','guest5','krum'));
alter table public.enchev_etap1_auctions drop constraint if exists enchev_etap1_auctions_leading_role_check;
alter table public.enchev_etap1_auctions add constraint enchev_etap1_auctions_leading_role_check check(leading_role in ('mitko','borko','enchev','guest1','guest2','guest3','guest4','guest5','krum'));

create or replace function public.etap1_snapshot()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_room public.enchev_etap1_rooms%rowtype;
  v_a public.enchev_etap1_auctions%rowtype;
  v_bids jsonb; v_now timestamptz:=clock_timestamp(); v_admitted_count integer; v_expected_count integer;
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
    where ad.auction_id=v_a.id
      and exists (
       select 1 from public.enchev_etap1_device_sessions ds
       where ds.role=ad.role and ds.last_seen>=v_now-interval '15 seconds'
      );
    select count(*) into v_expected_count
    from public.enchev_etap1_admissions ad where ad.auction_id=v_a.id;
    if v_expected_count<v_a.min_participants or v_admitted_count<>v_expected_count then
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
create or replace function public.etap1_ready_lobby_secure(
  p_actor text,p_session_id uuid,p_ready boolean default null,p_rejoin boolean default false
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_now timestamptz:=clock_timestamp();
  v_room public.enchev_etap1_rooms%rowtype;
  v_state jsonb; v_status text; v_count integer; v_ready_count integer;
  v_people jsonb; v_id uuid; v_admitted boolean:=false; v_wallet jsonb:=null;
  v_devices integer:=0; v_guest_mode boolean:=false; v_required integer:=3;
begin
  if p_actor not in ('mitko','borko','enchev','guest1','guest2','guest3','guest4','guest5','admin') then
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
    if p_ready is not null and not p_rejoin and v_status in ('live','countdown') then
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

  select exists(select 1 from public.enchev_etap1_device_sessions ds
    where ds.role in ('guest1','guest2','guest3','guest4','guest5')
      and ds.last_seen>=v_now-interval '15 seconds') into v_guest_mode;
  v_required:=case when v_guest_mode then 2 else 3 end;
  select count(*),count(*) filter(where p.is_ready) into v_count,v_ready_count
  from public.enchev_etap1_presence p
  where ((not v_guest_mode and p.role in ('mitko','borko','enchev')) or (v_guest_mode and p.role in ('enchev','guest1','guest2','guest3','guest4','guest5')))
    and exists(select 1 from public.enchev_etap1_device_sessions ds
      where ds.role=p.role and ds.last_seen>=v_now-interval '15 seconds');
  if p_actor<>'admin' and p_ready is true and v_status not in ('live','countdown')
    and v_count>=v_required and v_ready_count=v_count
    and (not v_guest_mode or p_actor in ('enchev','guest1','guest2','guest3','guest4','guest5'))
    and (select count(*) from public.enchev_etap1_demo_wallets w
      join public.enchev_etap1_presence p on p.role=w.role
      where ((not v_guest_mode and p.role in ('mitko','borko','enchev')) or (v_guest_mode and p.role in ('enchev','guest1','guest2','guest3','guest4','guest5'))) and p.is_ready and w.lot_budget>=16300 and w.buying_power>=16300
      and exists(select 1 from public.enchev_etap1_device_sessions ds
        where ds.role=p.role and ds.last_seen>=v_now-interval '15 seconds'))=v_count
  then
    insert into public.enchev_etap1_auctions
      (title,opening_amount,current_amount,increment,started_at,ends_at,status,min_participants)
      values('2026 Mercedes-AMG G 63 — DEMO',16250,16250,50,
        v_now+interval '30 seconds',v_now+interval '150 seconds','countdown',v_required)
      returning id into v_id;
    update public.enchev_etap1_rooms set active_auction_id=v_id
      where name='stage-one';
    insert into public.enchev_etap1_admissions(auction_id,role,session_id)
      select v_id,p.role,p.session_id from public.enchev_etap1_presence p
      where ((not v_guest_mode and p.role in ('mitko','borko','enchev')) or (v_guest_mode and p.role in ('enchev','guest1','guest2','guest3','guest4','guest5'))) and p.is_ready
       and exists(select 1 from public.enchev_etap1_device_sessions ds
        where ds.role=p.role and ds.last_seen>=v_now-interval '15 seconds');
    update public.enchev_etap1_presence set is_ready=false
      where role in ('mitko','borko','enchev','guest1','guest2','guest3','guest4','guest5');
  end if;
  select exists(select 1 from public.enchev_etap1_device_sessions ds
    where ds.role in ('guest1','guest2','guest3','guest4','guest5')
      and ds.last_seen>=v_now-interval '15 seconds') into v_guest_mode;
  v_required:=case when v_guest_mode then 2 else 3 end;
  select count(*),count(*) filter(where p.is_ready) into v_count,v_ready_count
  from public.enchev_etap1_presence p
  where ((not v_guest_mode and p.role in ('mitko','borko','enchev')) or (v_guest_mode and p.role in ('enchev','guest1','guest2','guest3','guest4','guest5')))
    and exists(select 1 from public.enchev_etap1_device_sessions ds
      where ds.role=p.role and ds.last_seen>=v_now-interval '15 seconds');
  select coalesce(jsonb_agg(jsonb_build_object('role',p.role,'ready',p.is_ready)
      order by p.role),'[]'::jsonb) into v_people
  from public.enchev_etap1_presence p
  where ((not v_guest_mode and p.role in ('mitko','borko','enchev')) or (v_guest_mode and p.role in ('enchev','guest1','guest2','guest3','guest4','guest5')))
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
    'minPlayers',v_required,'sessionCurrent',true,'admitted',v_admitted,'wallet',v_wallet,
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
  if p_actor not in ('mitko','borko','enchev','guest1','guest2','guest3','guest4','guest5') or p_session_id is null
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
  if p_actor not in ('mitko','borko','enchev','guest1','guest2','guest3','guest4','guest5') or p_session_id is null
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
create or replace function public.etap1_join_lobby_automatic(
  p_actor text, p_session_id uuid
) returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare
  v_first jsonb;
begin
  if p_actor not in ('mitko','borko','enchev','guest1','guest2','guest3','guest4','guest5') or p_session_id is null then
    raise exception 'Only the three designated demo bidders can join';
  end if;
  -- New sign-in invalidates the previous browser session for that role.
  -- First mark the new session NOT READY, so stale sessions cannot bid.
  v_first := public.etap1_ready_lobby_secure(p_actor,p_session_id,false,true);
  -- Guests set their own demo wallet then press READY explicitly (no auto start).
  if p_actor in ('guest1','guest2','guest3','guest4','guest5') then
    return v_first;
  end if;
  -- Do not admit new arrivals to a running round.
  if v_first->'state'->>'status' in ('live','countdown') then
    return v_first;
  end if;
  -- Automatically READY on explicit LOGIN, but never on polling or refresh.
  -- Exactly the THIRD designated login starts the auction atomically.
  -- After WINNER, nobody auto-restarts: existing sessions must READY again.
  return public.etap1_ready_lobby_secure(p_actor,p_session_id,true,false);
end;
$$;
create or replace function public.etap1_device_signout(
  p_actor text,p_session_id uuid
) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_room public.enchev_etap1_rooms%rowtype;
  v_now timestamptz:=clock_timestamp();
begin
  if p_actor not in ('mitko','borko','enchev','guest1','guest2','guest3','guest4','guest5') or p_session_id is null then
    return false;
  end if;
  select * into v_room from public.enchev_etap1_rooms
    where name='stage-one' for update;
  update public.enchev_etap1_device_sessions
    set last_seen=v_now-interval '1 minute'
    where role=p_actor and session_id=p_session_id;
  if not found then return false; end if;
  if not exists(
    select 1 from public.enchev_etap1_device_sessions
    where role=p_actor and last_seen>=v_now-interval '15 seconds'
  ) then
    update public.enchev_etap1_presence
      set is_ready=false,last_seen=v_now-interval '1 minute'
      where role=p_actor;
  end if;
  return true;
end;
$$;
revoke all on function public.etap1_snapshot() from public,anon,authenticated;
grant execute on function public.etap1_snapshot() to service_role;
revoke all on function public.etap1_ready_lobby_secure(text,uuid,boolean,boolean) from public,anon,authenticated;
grant execute on function public.etap1_ready_lobby_secure(text,uuid,boolean,boolean) to service_role;
revoke all on function public.etap1_wallet_update_secure(text,uuid,numeric,numeric) from public,anon,authenticated;
grant execute on function public.etap1_wallet_update_secure(text,uuid,numeric,numeric) to service_role;
revoke all on function public.etap1_bid_offer_secure(text,uuid,uuid,numeric,integer) from public,anon,authenticated;
grant execute on function public.etap1_bid_offer_secure(text,uuid,uuid,numeric,integer) to service_role;
revoke all on function public.etap1_join_lobby_automatic(text,uuid) from public,anon,authenticated;
grant execute on function public.etap1_join_lobby_automatic(text,uuid) to service_role;
revoke all on function public.etap1_device_signout(text,uuid) from public,anon,authenticated;
grant execute on function public.etap1_device_signout(text,uuid) to service_role;
