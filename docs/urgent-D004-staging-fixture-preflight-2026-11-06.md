# ENCHEV AUCTIONS — D004 staging-only synthetic vehicle preflight (2026-11-06)

**State: PREFLIGHT VERIFIED / D004 BLOCKED (not DONE).** Parent gate D003 is BLOCKED (4/7), so the persistent staging fixture is deliberately **not** inserted. Real-money auction authority: **NO-GO**.

## Scope and immutable targets

- Repository: `SoulFlameAdmin/enchev-auctions`, audited main SHA `1f2c2aace15674af701c3f96908f07cc42ca318c`.
- Supabase parent `enchev-auctions`: `ejfrnjhlggebzmpmxajl`; source-of-truth for existing demo history, **not** to be used for staging seed.
- Supabase isolated branch `enchev-staging`: `jranctnafndbqzrwcwos`; branch `248ecd54-771a-4830-a7ab-4a29cb81bb32`; `ACTIVE_HEALTHY`, `with_data=false`, **`persistent=false`**.
- Vercel production project `prj_X3TAEQf9oGE79te9NdNlvB6jnhno`. Project environment-variable metadata access again returned HTTP **403** on 2026-11-06. Therefore **Preview→staging binding not verified**. No environment settings or credentials were modified.

## Read-only provider evidence (2026-11-06)

| Check | Parent Supabase | Staging Supabase |
|---|---:|---:|
| `public.enchev_etap1_auctions` rows | **36** | **0** |
| `public.enchev_etap1_bids` rows | **499** | **0** |
| `public.enchev_market_lots` rows | **0** | **0** |

Both environments expose the expected `public.enchev_etap1_auctions` schema. The staging demo auction table accepts a valid *planned* insert shape for a synthetic vehicle, proven by a **non-executing** `EXPLAIN (FORMAT JSON) INSERT`: returned `ModifyTable/Insert` plan for `enchev_etap1_auctions`, not an execution result.

```sql
-- D004 PREVIEW-ONLY PREFLIGHT. EXPLAIN without ANALYZE does NOT execute an INSERT.
-- Executed by the Supabase connector with project_id=jranctnafndbqzrwcwos.
EXPLAIN (FORMAT JSON)
INSERT INTO public.enchev_etap1_auctions
  (title, currency, opening_amount, increment, current_amount, status, started_at, ends_at)
VALUES
  ('D004 STAGING TEST CAR (NOT EXECUTED)',
   'EUR', 1000, 50, 1000, 'countdown', now(), now() + interval '1 hour');
```

The staging count after this EXPLAIN remained **0 auctions / 0 bids / 0 market lots**. The production count remained **36 auctions / 499 bids / 0 market lots**. No SQL DML, SQL DDL, role grants, secrets or Vercel deployments were performed in this preflight.

**Important domain boundary:** `public.enchev_market_lots` is explicitly documented as **server-reviewed REAL listings only; never populated with demo lots**. Future synthetic auction fixture must use a dedicated demo fixture route/table in staging, not silently mix fake inventory with verified public marketplace lots. An ETAP1 auction row is only a safe schema-planning surrogate; it is *not* proof that the full planned vehicle seller/intake flow works.

## D004 execution gates — remain fail-closed

1. **D003 all 7 gates verified**, including the Vercel runtime Supabase binding (Production→parent, Preview→isolated staging); project ref checks must be performed without exposing secret values.
2. **Staging credentials and service roles scoped**, no service-role credentials in any browser/`NEXT_PUBLIC_*`; validate least privilege.
3. **Staging lifecycle durable**, not just a `persistent=false` ephemeral branch; replay/migration baseline fixed before relying on resets.
4. **Seed one synthetic test vehicle in staging only** through the selected dedicated demo/intake domain; watermark it as DEMO, never publicly approved, never linked to payment/order/payout or real lots.
5. **Proof:** the one expected synthetic staging fixture is observable in the intended staging app/API; production row counts and preferably row identifiers unchanged; negative test that Preview cannot write to production.
6. Run smoke/CI and attach exact evidence. Only then consider D004 DONE. D005 Redis PONG cannot be marked DONE without a real staging endpoint test.

## Decision

D004 **blocked-pending-D003**. This audit does *not* activate bidding or payments, deploy code, change production data, claim readiness, or authorize a persistent seed. Next operational blocker: Vercel environment metadata **403**, governance project permission, separately scoped DB roles and durable staging branch. Preserve previous D001/D002 acceptance and the 119-day emergency plan unchanged.
