# ENCHEV AUCTIONS — MOBILE PWA V1
Date: 2026-11-03
Project: existing `SoulFlameAdmin/enchev-auctions`
Status: **PREVIEW BUILD — REVIEW REQUIRED**, not production release

## Product contract
Deliver a **single installable E&A Auctions Progressive Web App (PWA)** from the existing site. Keep existing code, landing cinema, accounts, inventory, LIVE DEMO, plans, master system tracker and data. Use the **user-supplied MacJack screenshots** as mobile usability reference (large welcome hero, cards, bottom navigation, simple install/onboarding), while keeping original E&A automotive branding and authorized assets. Do not copy MacJack artwork, logo or text.

## Newly implemented surface
- `/app`: mobile-first start page; vehicle catalog, live demo, login/profile, transport and PWA install links.
- `/app/install`: one-tap browser install (when supported), manual Android/iOS steps, preview-origin warning, update description.
- `app/manifest.ts`: stable `id="/app"`, `start_url="/app"`, `scope="/"`, `display="standalone"`; 192x192 and 512x512 PNG icon endpoints and SVG brand fallback.
- `/pwa-icon/192`, `/pwa-icon/512`: on-demand PNG branded launcher icons.
- `/sw.js`: network-first navigation; only `/offline` and *public* E&A logo cached for offline fallback; **no bid/payment/user/private API response caches**.
- `/api/pwa-version`: no-store deployment SHA and channel. Active app checks version on entry, focus and every 15 minutes while visible.
- `EnchevPwaProvider`: native install prompt when browser supports it; standalone detection; bottom navigation on installed PWA pages; update banner and user-controlled refresh, so active auctions are not forcibly interrupted.
- `/offline`: no credentials, bids or user data in cached shell. Authenticated and live actions require actual connectivity.
- **LAST link** in original left System Command Center sidebar: `📲 МОБИЛНО ПРИЛОЖЕНИЕ` linking to `/app/install`.
- Automated code contract `scripts/verify-enchev-mobile-pwa.mjs` included in the main CI test list.

## Important install invariant: stable origin
The installed PWA is tied to its origin. The immutable Git-based Vercel preview deploy has a DIFFERENT origin from the production site. Do not treat the preview installation as permanent; it will not automatically follow commits to `main`. After gated release, install from:
`https://enchev-auctions.vercel.app/app/install`
Do not switch to a new hostname when upgrading the PWA. Keep manifest ID stable as `/app`. When moving domains in the future, plan explicit origin migration and test in supported browsers.

## Upgrade without reinstall — exact semantics
1. New E&A code is reviewed and deployed to the SAME stable production origin.
2. On reopening, the installed PWA makes network-first navigations and receives current app code without reinstallation. Revalidation/version check detects a new commit.
3. If the PWA is open with an older version, an update banner appears. User taps `Обнови` after finishing actions, triggering safe reload or waiting-worker activation.
4. Browser/OS PWA metadata and icon updates may be applied on their own schedule. If a future APK/Play Store TWA adds native capabilities, store-managed native changes may require a normal app update.
5. Never call `skipWaiting()` automatically during service worker `install`; do not interrupt live bidding; never cache auction state as authoritative.

## Release gates
1. Repo-based compile/build successful and unit test contract PASS. Validate no unrelated changes to frozen MASTER SYSTEM PLAN, EXPANSION 62–99, GAP or `tools/david/*`.
2. Open preview /app and /app/install from a real Android device, check layout at 360/390px width, accessibility, keyboard and safe area.
3. HTTP 200/MIME verification: `/manifest.webmanifest` is JSON, `/pwa-icon/192` and `/pwa-icon/512` are image/png, `/sw.js` JavaScript; manifest `id/start_url/scope` are stable.
4. Android Chrome: install prompt (when available), icon on launcher, opens standalone `/app`, bottom tabs navigate to inventory/live demo/profile, session persistence.
5. iOS: Share → Add to Home Screen, Home Screen icon, launch and bottom nav with safe areas.
6. Offline: cached /offline page loads in supported browsers; authenticated private content and API requests are **never shown from cache**.
7. Version A→B test **on one stable origin**: install A, publish approved B, reopen/receive update banner, apply, check no reinstall and data preservation.
8. Full regression of cinema front page, command sidebar, urgent plan, master plan statuses and existing business operations. No fake real bidding.
9. Security review: no secrets in generated bundle, SW scope only on E&A origin, no PWA cache storage of user, auth, bids, payments.
10. Owner approval/review and production deploy; attach evidence screenshot, deployed URL, test output, SHA.

## Phase roadmap after V1 (not completed by this PR)
- V2: buyer/seller account onboarding and verified business identity, device-auth session, saved lots, live event alerts with opt-in.
- V3: authorized backend bids, server-authoritative timer, reconnection, audited bid ledger, winner finalizer, fraud protection and real closed-pilot acceptance.
- V4: transactions, deposits, invoices, release/transport/CRM subject to legal and payment-gateway gates.
- V5: Google Play via reviewed Trusted Web Activity, Digital Asset Links, package signing and store compliance, without replacing the canonical website.

**Never claim** current `/live-auctions` demo is certified for production. The PWA wraps the existing routes; it does not magically turn demo bids into financially valid bids.
