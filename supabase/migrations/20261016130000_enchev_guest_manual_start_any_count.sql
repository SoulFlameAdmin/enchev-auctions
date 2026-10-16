-- Guest-initiated demonstration, no fixed team size. Isolated DEMO service-role only.
-- Keep historic bids and previously closed rounds untouched.
alter table public.enchev_etap1_auctions
 drop constraint if exists enchev_etap1_auctions_min_participants_check;
alter table public.enchev_etap1_auctions
 add constraint enchev_etap1_auctions_min_participants_check
 check (min_participants between 1 and 6);

-- A guest who disconnects during the countdown must not cancel the
-- presentation while at least one admitted guest remains online.
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
    if v_admitted_count<v_a.min_participants then
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

-- Atomic room lock ensures only one guest can start a round at a time.
-- All connected guest identities (1-5) join the same thirty-second countdown.
create or replace function public.etap1_guest_start(
  p_actor text, p_session_id uuid
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_now timestamptz := clock_timestamp();
  v_room public.enchev_etap1_rooms%rowtype;
  v_state jsonb;
  v_id uuid;
  v_count integer;
  v_result jsonb;
begin
  if p_actor not in ('guest1','guest2','guest3','guest4','guest5') or p_session_id is null then
    raise exception 'Guest demo seat required';
  end if;

  -- A synchronized room-level transaction serializes concurrent START clicks.
  select * into v_room from public.enchev_etap1_rooms
    where name='stage-one' for update;
  if not found then raise exception 'Demo room unavailable'; end if;

  -- Use registered short-lived session heartbeats, not a caller's self-report.
  if not exists (
    select 1 from public.enchev_etap1_device_sessions ds
    where ds.role=p_actor and ds.session_id=p_session_id
      and ds.last_seen>=v_now-interval '15 seconds'
  ) then
    raise exception 'Guest session expired; reconnect';
  end if;

  v_state:=public.etap1_snapshot();
  if v_state->>'status' in ('live','countdown') then
    raise exception 'A demo round is already starting or active';
  end if;

  select count(*) into v_count from public.enchev_etap1_presence p
  where p.role in ('guest1','guest2','guest3','guest4','guest5')
    and exists(
      select 1 from public.enchev_etap1_device_sessions ds
      where ds.role=p.role and ds.last_seen>=v_now-interval '15 seconds'
    );
  if v_count<1 or v_count>5 then raise exception 'No eligible guests online'; end if;

  insert into public.enchev_etap1_auctions(
    title,opening_amount,current_amount,increment,started_at,ends_at,status,min_participants
  ) values (
    '2026 Mercedes-AMG G 63 — DEMO',
    16250,16250,50,v_now+interval '30 seconds',
    v_now+interval '150 seconds','countdown',1
  ) returning id into v_id;

  update public.enchev_etap1_rooms set active_auction_id=v_id
   where name='stage-one';

  insert into public.enchev_etap1_admissions(auction_id,role,session_id)
    select v_id,p.role,p.session_id
      from public.enchev_etap1_presence p
      where p.role in ('guest1','guest2','guest3','guest4','guest5')
      and exists(
        select 1 from public.enchev_etap1_device_sessions ds
        where ds.role=p.role and ds.last_seen>=v_now-interval '15 seconds'
      );
  update public.enchev_etap1_presence set is_ready=false
   where role in ('guest1','guest2','guest3','guest4','guest5');

  -- Return a verified snapshot plus lobby state for the pressing guest.
  v_result:=public.etap1_ready_lobby_secure(p_actor,p_session_id,null,false);
  return v_result || jsonb_build_object('started',true,'admittedCount',v_count);
end;
$$;

revoke all on function public.etap1_snapshot() from public,anon,authenticated;
grant execute on function public.etap1_snapshot() to service_role;
revoke all on function public.etap1_guest_start(text,uuid) from public,anon,authenticated;
grant execute on function public.etap1_guest_start(text,uuid) to service_role;
