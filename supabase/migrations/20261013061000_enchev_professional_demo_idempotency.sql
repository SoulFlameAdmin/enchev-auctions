-- Session-bound, payload-identical idempotent retries (no new bids for reused nonce).
create or replace function public.etap1_bid_offer_secure(
 p_actor text,p_session_id uuid,p_nonce uuid,
 p_amount numeric,p_expected_sequence integer
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
 v_room public.enchev_etap1_rooms%rowtype;
 v_a public.enchev_etap1_auctions%rowtype;
 v_wallet public.enchev_etap1_demo_wallets%rowtype;
 v_existing public.enchev_etap1_bids%rowtype;
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
 select * into v_existing from public.enchev_etap1_bids
  where auction_id=v_a.id and actor=p_actor and request_nonce=p_nonce;
 -- Retry must have the same absolute amount and the same still-valid session.
 if found then
   if v_existing.amount is distinct from p_amount then
     return jsonb_build_object('accepted',false,'code','NONCE_MISMATCH',
       'state',public.etap1_snapshot());
   end if;
   if not exists(select 1 from public.enchev_etap1_admissions a
      join public.enchev_etap1_presence p on p.role=a.role and p.session_id=a.session_id
      where a.auction_id=v_a.id and a.role=p_actor and a.session_id=p_session_id) then
     return jsonb_build_object('accepted',false,'code','SESSION_NOT_ADMITTED',
       'state',public.etap1_snapshot());
   end if;
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
