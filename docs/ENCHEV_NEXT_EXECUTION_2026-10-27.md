# ENCHEV — NEXT EXECUTION / AR CAPTURE + ETAP 1 + ETAP 2

Date: **2026-10-27**. Owner: MITKO. Physical QA and equipment test: MITKO + BORKO.
Status: **YELLOW / planning and inspected dependencies — NOT production accepted**.

> This is a dated execution addendum, not a change to the frozen MASTER SYSTEM task registry.
> `docs/MASTER_SYSTEM_PLAN_V1_FROZEN.md` and `docs/MASTER_SYSTEM_EXPANSION_V2.md` keep their immutable 4,374-item baseline. No task is promoted to GREEN by this document.

## 1. Verified snapshot and strict boundaries

| Workstream | Grounded current state | Gate |
| --- | --- | --- |
| Auction `main` | Latest commit `d23f2a7e`; last READY production deployment from `fe761a4a` | Do not equate old READY with release certification |
| ETAP 1 LIVE pilot | PR #377 remains draft; fixes for idempotent bids, 5 s cooldown, repeated anti-snipe, multi-device behavior | Physical 13-case QA still required; do not merge to production |
| ETAP 2 | PR #379 draft; commercial legal-role models SYS 63.01/63.02 | Exact-head CI, review, evidence, written legal/commercial decisions |
| Security | PR #381 draft upgrades Next.js 16.3.8 to 16.4.2 | Dependency + lockfile review, audit, build/CI verification |
| AR advertising | PR #382 draft; standalone `e-auctions-ar-showroom` Vercel project last production deployment READY | Site preview does not certify customer AR performance |
| Asset build | `scripts/restore-forge-assets.mjs` aborts on missing original `media/833f233b33cbcd789d20.jpg` with HTTP 404 | Restore verified source or authorize truthful, tested neutral fallback |
| AR leads DB | `public.enchev_ar_early_access` exists; RLS enabled with one INSERT-only policy | Verify abuse resistance, privacy notice and legal terms before campaigns; don't claim signups happened |

Evidence: GitHub PRs #377, #379, #381, #382; Vercel deployment logs for `dpl_EdAH5ZFXTEcvxZLcyoL6K4cgMR9a`; Supabase migration `20261027004128`.

**Isolation law:** auction bid ledger, live timing, wallet rules and production customer flows remain untouched while working on marketing. Never cross-write into DAVID, DPP or calendar tables in the same Supabase project. No real payments, registrations, or offers are implied by a demo.

## 2. Execution queue (ordered by blocked dependencies, not phase numbering)

### P0-A — Restore deterministic build and patch dependencies

- [ ] Recover the exact original Forge media asset from a verified owner-controlled source. Verify SHA-256 against `config/forge-assets.json`.
- [ ] If permanently unavailable, approve a **clearly labeled, neutral placeholder** and update restoration/tests in a dedicated PR. Do not replace a pictured vehicle with another make/model or silently remove integrity checking.
- [ ] Run build and browser / provenance / security checks on the exact head commit.
- [ ] Independently review and validate Next.js package + lockfile patch in PR #381; do not merge solely based on version string.
- [ ] Preserve known-good production domain and live auction environment during these checks.

**Pass:** reproducible CI and Vercel preview build, no missing unlabelled media, package audit reviewed, no changes to bidding algorithm.

### P0-B — Close the ETAP 1 physical LIVE QA gate

Hardware/browser roster: BORKO PC, MITKO PC browser profile, MITKO phone, ENCHEV phone, MITKO ADMIN phone; correct distinct access verified before start. Use demo credit only.

Checklist: 1. login/session admission; 2. lobby ready states; 3. all expected bidder devices visible; 4. 5-second cooldown shown and enforced server-side; 5. duplicate/double-click idempotency; 6. stale-price error reason; 7. concurrent bid winner serialization; 8. first anti-snipe; 9. **second** anti-snipe; 10. reconnect/resync; 11. MITKO second-device sign-in and single-device sign-out; 12. sound user-gesture/autoplay restrictions; 13. round 2 without server reset, with audit logs and winning state.

- [ ] Record for each: PASS/FAIL, device, timestamp, code revision, reproducible evidence.
- [ ] Re-test unresolved user screenshot / real-device issue.
- [ ] Review CI exact head, then have explicit owner signoff; no automatic merge/release.

**Pass:** 13/13 results with evidence; no unreviewed authorization shortcuts, no duplicate accepted bid, no phantom winner.

### P1-A — One-car AR / 360 capture proof-of-concept (separate from auctions)

**Recommended first experiment:** use phone or DSLR with **overlapping ordinary perspective photos** to make a textured 3D mesh; use a 360 camera for panorama/inspection views, not as the primary photogrammetry input. Drone is optional for outdoor marketing B-roll, not first-choice for a turntable-quality detailed car mesh.

1. Select one legally photographable test vehicle; clean and dry it. Obtain rights for photographs/models.
2. Put vehicle inside the proposed wide white spiral/curtain set only if the **camera still sees enough trackable features**. Uniform white surfaces alone can make camera pose solving harder; provide removable floor markers or reliable feature points that can be masked later.
3. Diffuse LEDs around the car, avoid harsh changing highlights, ensure safe electrical installation and free emergency exit. Keep camera exposure and focus stable.
4. Capture **three overlapping height paths** (low, beltline, high) with repeated coverage of front, back, roof and wheel arches. Start with a 120–250-photo trial; adjust from reconstruction quality. Avoid moving the car and people between shots. Highly reflective paint and glass may require selective masking/manual retouch.
5. Process first in a photogrammetry application capable of a real textured mesh; compare Polycam and another mesh-based workflow on the *same* photo set. Evaluate completeness, wheel/roof geometry, UV textures, editing burden, export licensing and cost before subscribing.
6. Capture underbody **separately** on a correctly rated professional vehicle lift with qualified personnel; never crawl under an unsupported vehicle. Prefer underside stills / 360 panorama as a distinct inspection node, with accurate labels. Do not claim one moving drone or one 360 shot gives a complete underside-to-roof production 3D model.
7. Clean mesh, reduce polygons/textures for web/mobile, export **GLB** for web and **USDZ** for iPhone native AR when supported; verify normals, scale in meters, origin/pivot and model author credit.
8. Test real model in standalone marketing project on one Android and one iPhone; 360 touch orbit must work even without camera AR capability.

**Pass:** geometry complete around vehicle, photographed defects genuinely represented, sensible initial load on mobile connection, camera user permission works, Android Scene Viewer/WebXR and iOS Quick Look or a clear compatible fallback, visible attribution and model source. No claims of exact-vehicle fidelity without real source capture.

### P1-B — Real user-owned car model and video in ad

Known local assets (not present on Vercel): 
- `D:\\ASI\\high-poly_3d_model_of_modern_game__render_ready.glb`
- `D:\\ASI\\High-Poly_3D_Model_of_Modern_Game__Render_Ready.usdz`

- [ ] User supplies source files from local PC to approved public storage (not this repository's production deploy by assumption).
- [ ] Validate file types, size, geometric scale, authorship/license, scan for scripts and inspect embedded references.
- [ ] Wire the *separate advertising project* to HTTPS GLB/USDZ with real-device smoke test; keep the current credited demo model visible until replacement works.
- [ ] Use the supplied promo video only after media rights, compression, mobile performance, captions/contrast and autoplay-muted policies are verified.
- [ ] Clarify desired mode: automatic **advertising animation** may play without buttons; **starting AR camera cannot be assumed automatic** on mobile (requires supported device and user gesture).

**Pass:** working real source model, accurate credits, tested ad on Android/iOS, no misleading vehicle or store claims.

### P1-C — Capture rig: spiral, backdrop, LED, safety

Proposed physical design: freestanding overlapping white spiral curtains with clear vertical access, modular anchors, non-slip floor, multiple diffuse LED rings, and maximum vehicle envelope sized using the actual largest SUV/pickup intended (including mirrors, door opening, camera travel and lift height). The spiral overlap avoids background gaps in wide-angle camera paths. 

- [ ] Draw scaled plan/elevation for actual site, camera field-of-view and vehicle envelope.
- [ ] Obtain cloth, frame, lighting, and lifting quotes *after* measuring.
- [ ] Build inexpensive one-bay prototype first; inspect shadows, unwanted curtain intrusion, reflections and photogrammetry tracking; do not invest in full-size rig before a complete sample mesh.
- [ ] For underside capture: separate certified lift area and safety procedure, not a homemade lift.

### P2 — Paid campaigns, leads, phones and commercial activation

- [ ] Written approval from ENCHEV on who contracts with users, who owns media, ad accounts/data and the campaign budget.
- [ ] Written decision whether the proposed **-10%** early-access discount exists, its eligibility, dates and conditions. Until then label as unconfirmed concept.
- [ ] Before paid lead collection: lawful privacy notice, controller contact, retention schedule, consent audit, CAPTCHA/rate limiting, duplicate/abuse handling, verified delivery and dashboard read restrictions. Current 0-row table is not proof of lead generation.
- [ ] Twilio is optional and scoped to permitted/support call flows; verify local legal rules, opt-ins, recording consent, numbers, usage estimates, call limits before purchasing.
- [ ] Prepare Facebook/Instagram/YouTube versions from the same approved source: 9:16 vertical, 1:1, 16:9; accurate non-autoplay AR CTA. Approve budgets and creative claims before running ads.

### P2 — Stage 2 contractual and domain gates

Before expansion beyond isolated domain code:
1. Confirm the contract counterparty/legal entity.
2. Confirm must-have/optional/out-of-scope features with ENCHEV.
3. Agree seller intake → listing → inspection → auction → payment → transfer → delivery responsibilities.
4. Document fixed budget, operator fees, aftercare, provider charges and owner responsibilities.
5. Define the written commercial meaning, duration and calculation basis of the discussed **1%**.
6. Verify country-specific legal role and tax requirements before payments or commercial auctions.
7. Proceed with SYS 63.01/63.02, then later 63.03 and downstream fee, tax, inventory and provider systems following explicit dependency graph.

## 3. Next concrete shared session (MITKO + BORKO)

1. **MITKO**: supply original GLB/USDZ, rights/source and one target sample vehicle; obtain actual photo of current camera/phone equipment.
2. **BORKO**: execute physical LIVE QA 1–13 and record code revision + proof; note exact failures.
3. **Technical workstream**: fix missing Forge source integrity blocker and review PR #381 without changing production.
4. **Together**: test one short, 3-height photo set and export one *real* GLB to mobile 360/AR; record scan time, processing time, mesh defects and iPhone/Android behavior.
5. **ENCHEV**: confirm contract scope, AR rights, discounts and advertising budget in writing.

## 4. Release rules

- Separate `e-auctions-ar-showroom` advertising deployment can be reviewed independently; do not merge draft PR #382 into the main auction branch as a shortcut.
- Do not publish car advertisements that misrepresent images, model identity, features or discount terms.
- No credentials, service-role keys, manual DB changes or real-payment provider activation as part of this addendum.
- Every technical GREEN needs reproducible code, test, deployment and acceptance proof under the frozen master governance.
