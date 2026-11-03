# ENCHEV AUCTIONS · URGENT DAY 2 (D002) · Media 404 recovery evidence
Date: 2026-11-03. Task due: 2026-11-04. Owner: Борко. Original day: `app/data/urgent-119-days.json#D002`.
**Scope:** a *clean Preview build of the actual app* without missing Forge media and a verifiable log URL. This is **not** certification of real auctions, payments or legal documents.

## Exact issue and solution

The immutable asset manifest `config/forge-assets.json` contains **134 assets**. One historical social image `media/2480ec12b70d13d46feb.jpg` used a now unavailable Sanity CDN URL (historical HTTP 404). The original restore implementation already had an Enchev historical deployment fallback and a pinned SHA-256, so an unmodified build could recover that asset. D002 now makes integrity a **hard repeatable gate** instead of relying on the initial successful recovery.

- Fixed/pinned problem asset: `/forge/media/2480ec12b70d13d46feb.jpg`
- SHA-256: `00d7eb76a558c7f82450e25692ee75f90dad9c2b6792766d60027ea77f885b52`
- `scripts/restore-forge-assets.mjs`: validates manifest before network download and verifies **all 134 local file hashes** after restoring, including the former 404, before Next build proceeds.
- `scripts/verify-urgent-d002-forge-media.mjs`: independent fail-closed validator + nine synthetic negative cases (missing/corrupted/empty/traversal/absolute/duplicate/insecure URL/unpinned digest/count).
- `scripts/verify-intro-platform-browser.mjs`: real HTTP GET on the **running built Next.js service**. Actual media must be `HTTP 200` and exactly match the SHA-256; nonexistent media must remain `HTTP 404` to reject false 200 rewrites.
- `scripts/run-ci-tests.mjs`: includes offline negative test.

## Verifiable runtime/build evidence

1. [Vercel Preview deployment for PR #402, commit 4d97ce7](https://vercel.com/dimitar-lambovs-projects/enchev-auctions/CxQT7UY2EnNqySnXAhC2UYaKL56k) — **READY** on the exact tested commit. Production still on the separate main branch until deliberate merge.
2. **Build log**, same Preview deployment: `Forge frontend restored; 134 binary assets downloaded and verified.` and `URGENT_D002_FORGE_MEDIA PASS count=134 bytes=56462720 repaired_404_asset=true`.
3. [GitHub Intro and Marketplace Browser Parity run #41668523722](https://github.com/SoulFlameAdmin/enchev-auctions/actions/runs/41668523722) — **SUCCESS**, logs include:
   - `URGENT_D002_PREVIEW_HTTP PASS repaired_media=200 sha256=verified nonexistent=404 bytes=40112`
   - `PASS D002 restored historical media HTTP 200 + SHA-256; missing file HTTP 404`
   - `Browser parity smoke PASS desktop+mobile`.

**Important interpretation:** The browser test uses a real locally built Next.js HTTP server in GitHub CI, not a direct unauthenticated outside-in GET of the Vercel protected Preview domain. The public Preview passes the independent Vercel build/READY test. Do not conflate these two.

## Quality gate / acceptance

The original D002 core acceptance is fulfilled only if the updated PR also passes the full **exact-head** CI, including `Verify Enchev Web`, browser parity and security scans, and is safely merged without changing any frozen D day. When this is recorded as complete, retain links to the independent build and browser evidence.

## Guardrails

The project uses historical binary media restored with pinned hashes. Original third-party source availability is **not** guaranteed; the fallback is a recovery mechanism and may have future lifecycle risk. Subsequent licensing/ownership review of third-party assets is independent from D002 404 availability. No payment/PSP/DAVID/Supabase migrations or real-money state touched.

D001 stays accepted; D003 remains independent and will later verify staging/production Supabase separation.
