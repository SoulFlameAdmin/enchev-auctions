# ENCHEV · ЕТАП 1 — LIVE AUCTION PILOT
Status: IMPLEMENTATION BRANCH / NOT PRODUCTION ACCEPTED

## Scope
A single **isolated**, no-real-money auction room for an in-person demonstration:
- Admin starts a fresh vehicle auction (30–600 seconds).
- Mitko and Borko sign in with separate private access codes on separate devices.
- Enchev watches the same authoritative auction in observer mode.
- PostgreSQL row-locks serialize concurrent bids, so there is one accepted sequence and one winner.
- PostgreSQL uniquely indexes each (auction, bidder, nonce) to de-duplicate retries.
- Client sees server timestamps, history and current price from shared DB (1-second polling).
- Late accepted bids extend the deadline to at least 10 seconds after that bid.
- A completed auction stays in the ledger. New rounds get new IDs; past bids are not deleted.
- A click is required to enable browser sound; bid and close sounds follow real server changes.
- No invoices, payment, vehicle title, release, or real transaction creation.

**The existing /live-auctions page is intentionally unchanged.**
Stage 1 route: `/live-auctions/etap-1`.
The route is fail-closed until the dedicated ENCHEV database and all environment variables exist.

## Activation blockers
1. Confirm/create an **isolated ENCHEV Supabase project**. The shared SoulFlame/Twins project
   `frhletkiuupgksmgxoxc` is hard-denied. Never apply the migration there.
2. Have the owner approve the isolated environment and database SQL.
3. Apply `supabase/migrations/20261010131500_enchev_etap1_live_pilot.sql` in that isolated project.
4. Add the following **server-only** environment variables to a safe Vercel Preview deployment:
   - `ENCHEV_ETAP1_ENABLED=true`
   - `ENCHEV_ETAP1_PROJECT_REF=<dedicated ENCHEV Supabase project ref>`
   - `ENCHEV_ETAP1_SUPABASE_URL=https://<ref>.supabase.co`
   - `ENCHEV_ETAP1_SERVICE_ROLE_KEY=<dedicated Supabase service role key>`
   - `ENCHEV_ETAP1_SESSION_SECRET=<independently generated 32+ character high entropy secret>`
   - `ENCHEV_ETAP1_ADMIN_CODE=<independent random 16+ character secret>`
   - `ENCHEV_ETAP1_MITKO_CODE=<independent random 16+ character secret>`
   - `ENCHEV_ETAP1_BORKO_CODE=<independent random 16+ character secret>`
   - `ENCHEV_ETAP1_ENCHEV_CODE=<independent random 16+ character secret>`
5. Secrets must be unique, distributed privately, not emailed in plain text, not committed.
   All four participant codes must be different. Rotate credentials after the pilot.
6. For sensitive tests, keep Preview deployment protected. Do not activate this configuration
   on a public production host until security acceptance is green.
7. GitHub CI must pass, then activate Preview. The service key MUST NOT be NEXT_PUBLIC_.
   Database grants restrict table access and RPC functions to `service_role`.

## Local static check
`node scripts/verify-etap1-live-contract.mjs`
This catches implementation safety contracts, not actual database behavior.
`npm run typecheck` and `npm run build` are separately mandatory.

## Real device test — acceptance contract
1. Open pilot preview on **3 devices**: Mitko, Borko, Enchev. Log in independently.
   Confirm a wrong invitation code is rejected. A fourth device uses Admin.
2. Admin starts a Golf GTI demo with 120 seconds and opening €16,250 / step €100.
   Capture immutable ID and database timestamp.
3. All 3 watchers must see the **same ID, price, leader and server deadline**.
   Client clock changes MUST NOT change authoritative deadline.
4. Enable SOUND explicitly on each phone; listen for sound after remote accepted bids.
5. Bid from Mitko, then Borko. Confirm 2 increasing sequence numbers,
   €16,350 / €16,450 and shared leader Borko within acceptable latency.
6. Submit simultaneous bids. Confirm different sequence numbers, no double-accepted
   same value and no two winners.
7. Resend the EXACT SAME bid nonce. The DB must NOT insert a duplicate row.
   Submit malformed nonce or unauthorized viewer/admin bid; request must be rejected.
8. At <10 seconds remaining place an accepted bid; server deadline must extend.
   After close attempt another bid; server must reject it.
9. Observe the winner from all devices, including relogin and reload. The winner
   must match the bidder on the highest accepted (latest) row.
10. Disconnect one device and reconnect; confirm persisted history and correct state.
11. Admin starts another round after closure. Prior auction + accepted bids remain persisted.
12. Verify isolated Postgres tables have RLS and that neither anon nor authenticated
    can call `etap1_bid` directly. Confirm the service key never reached the client.
13. Confirm 320px, 390px and 430px layouts, no horizontal overflow.
14. Record results/evidence (timestamp, DB project ref, commit SHA, Preview deployment,
    screenshots, device/browser, run results, failure/recovery log).
15. Do not call this stage 100% ready until the full checklist is evidenced GREEN.

## Known limits (must not misrepresent)
- Near-real-time uses 1-second **polling**, not WebSockets. Latency must be measured.
- The role access code authorizes a **closed demo only**, not production identity/KYC.
- There is no production payment, invoice, ownership transfer or real sale.
- No real vehicle data required; illustrative title is intentionally marked DEMO.
- Only one auction is active in the pilot room; history is never silently overwritten.
- DNS, live DB configuration and acceptance on real devices are still external gates.
- This code is **not** intended to be merged into or activated on production before
  evidence review and explicit release approval.
