# ENCHEV AUCTIONS — Real vehicle marketplace (2026-11-06)

## Scope implemented
- `/vehicles` is one Bulgarian, responsive marketplace for desktop, tablet and mobile.
- The UI consumes `GET /api/buyer/catalog`, not seed/mock inventory.
- Verified auctions take the spotlight, only when an approved, actually scheduled/live record exists.
- The system never reports a starting price as the **current bid**.
- Search, make, year, auction status and sorting work on the verified catalogue; car details link to `/vehicles/[id]`.
- Profile, saved lots, login and registration use the existing protected server API.
- Anonymous users clicking Save are prompted to register/login, preserving the selected lot for safe sign-in.
- The optional “Моите стъпки” header button appears after a real account is at least 7 days old; it changes after 30 days. It is not an authorization control.
- The welcome-10% banner is present, but no discount code is currently issued or redeemed; the UI discloses this and does not promise a vehicle-price discount.

## Actual sources of truth
- Database: the dedicated Supabase project `ejfrnjhlggebzmpmxajl`.
- Inventory: `public.enchev_market_lots`, RLS policy `enchev_market_lots_verified_public_read`.
- Publicly shown rows must meet **all**: `published=true`, `approved_at IS NOT NULL`, `seller_verified_at IS NOT NULL`, `status IN ('scheduled','live','ended')`.
- Vehicle fields: make, model, model year, mileage_km, fuel_type, transmission, power_kw, body_type, country, starting price, dates, condition summary.
- Images: approved publicly viewable assets in Supabase Storage bucket `enchev-lot-public` (8 MB max; jpeg, png, webp). Store a path relative to the bucket in `enchev_market_lots.image_path`. The API accepts only safe relative image keys. Store photos with permission from the seller; do not copy mobile.bg images without licensing.
- No storage upload policy for anonymous users. Uploads require privileged, separately controlled administrative access.
- The LIVE clock only represents a scheduled live lot's timestamp; **real bid prices and acceptance must come from a separate authoritative server bidding engine**. The old demo clock is not that engine.

## Important production blockers
1. The dedicated auth project is active, but production `/api/enchev-auth/session` currently returns `available:false`. Vercel declined the tool's read access to environment variables with HTTP 403. An authorized project owner must configure and verify:
   - `ENCHEV_AUTH_ENABLED=true`
   - `ENCHEV_AUTH_URL=https://ejfrnjhlggebzmpmxajl.supabase.co`
   - `ENCHEV_AUTH_PROJECT_REF=ejfrnjhlggebzmpmxajl`
   - `ENCHEV_AUTH_ANON_KEY` (publishable/anon key; use Vercel encrypted env)
   - `ENCHEV_AUTH_SITE_ORIGIN=https://enchev-auctions.vercel.app`
   Set variables only through Vercel protected project settings, **not** in repository code.
2. There are currently **zero verified published lots**. Add only seller-authorized assets and records after verification, with gallery asset licensing, vehicle terms, dates and initial price validated.
3. Production real-money bidding and transaction processing are **not enabled**. Required before launch: KYC/KYB, auction/bid authorization, server-authoritative timer, atomic bid commits, extensions, audit history, payment settlement and dispute handling.
4. The marketing 10%-code program needs terms (eligible platform fees, ceiling, duration, abuse protection), unique generation and fulfillment on verified signup, redemption at payment, and tests. No automatic codes should be promised as already sent.

## Release acceptance
- Next.js TypeScript build and production deployment must be READY.
- Browser checks at 320, 375, 390, 430, 768, 1024, 1440 widths.
- No horizontal overflow, clipped E&A logo or overlay with ☰.
- Search/filters and registration navigation work.
- No public fake offers, false active auctions or unapproved listing images.
