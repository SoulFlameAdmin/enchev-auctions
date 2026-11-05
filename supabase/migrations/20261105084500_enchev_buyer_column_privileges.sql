-- Defense in depth: row ownership AND minimum-column access for public API.
-- Apply to dedicated ENCHEV project. No account data or payment state is changed.
begin;
revoke select on public.enchev_market_lots from anon,authenticated;
grant select (
  id,lot_number,title,make,model,model_year,vin,country_code,
  condition_summary,starting_price,price_currency,status,
  auction_starts_at,auction_ends_at,created_at
) on public.enchev_market_lots to anon,authenticated;

revoke select on public.enchev_buyer_verifications from authenticated;
grant select (user_id,buyer_type,kyc_status,deposit_status,updated_at)
  on public.enchev_buyer_verifications to authenticated;

revoke select on public.enchev_buyer_payment_records from authenticated;
grant select (id,order_id,provider,amount,currency,status,created_at)
  on public.enchev_buyer_payment_records to authenticated;

revoke select on public.enchev_buyer_documents from authenticated;
grant select (id,order_id,kind,label,status,issued_at,created_at)
  on public.enchev_buyer_documents to authenticated;
commit;
