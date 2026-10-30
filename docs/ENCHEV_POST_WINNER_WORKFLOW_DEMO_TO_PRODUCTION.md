# ENCHEV AUCTIONS — after-winner workflow, demo evidence and production gates
Date: 2026-10-13. Scope: private three-bidder fake-money pilot. NO real funds, tax invoices, transfers, vehicle pickup or production activation.

## What Copart-like means (process, not copied branding)

Copart commonly shows the highest/winning bid then directs the buyer to the account's purchase/payment area, itemized fees and payment, documents/title and pickup/delivery. **Highest bid alone can be subject to seller approval**; deadlines, methods and rules depend on market, account and lot. Never transplant Copart USA's fee schedule, US-specific three-business-day deadline, relist penalties or title/licence forms into Bulgarian ENCHEV terms without agreement. References: copart.com/content/us/en/support/how-to-buy/pay-and-pick-up; copart.co.uk/how-it-works.

## Current pilot, implemented

1. ONLY MITKO, BORKO, ENCHEV may log in as bidders. Admin uses a separate signed cookie and watch-only monitor, opens/closes independently, cannot delay or start rounds.
2. First round automatically starts when the three active, authorized browser sessions enter the lobby. The DB serializes start and admitted bids against one room. Admin login/refresh cannot start anything.
3. Winner is chosen by **server-accepted highest bid**, never by a client timer. Server's clock and atomic bid sequence are authoritative, with idempotent nonces; bids beyond the deadline are blocked, extension of less than 10 seconds is handled server-side.
4. Immediately after server marks CLOSED, every user can see a **persistent result**: lot ID, winner, amount, accepted bid count and server closing time. Winner sees YOU ARE THE HIGHEST BIDDER; other bidders see who led; no bids -> NO WINNING BIDDER.
5. The app offers a **downloadable DEMO closing record (.txt)** to bidders and admins. It is explicit evidence of the simulation only — NOT an invoice, sale contract, payment request, legal award, transport release or vehicle ownership proof.
6. After CLOSED, all three must explicitly READY for the next round. No auto-restart on HTTP GET/refresh/admin monitoring. A new login during LIVE is not admitted to the active round.

## What to show on the three phones and control-room PC

| Moment | Bidder/winner UI | Admin UI |
| --- | --- | --- |
| 0/3, 1/3, 2/3 joined | Lobby counts and online status, never an active bid | Exact online participants; separate monitor |
| Third joins | One synchronized auction; price, lot, timer, leading bidder | LIVE and three admitted bidder statuses |
| Bids | Server-confirmed value, sequence and leader; sound (opt-in) | Matching accepted bid history and values |
| Last seconds | Deadline set by server and possible anti-snipe extension | Same deadline/price |
| CLOSE | Highest bidder / lost / no bids; final amount, lot ID, DEMO download | Winner, price, bid count, DEMO operator download |
| Next | Fresh READY from all three for new auction ID; 0 bids | Admin never counted |

Run at least 2 full rounds on three devices, monitor on separate PC, compare IDs and sequences with Supabase; prove refresh, reconnect, simultaneous bids, 401/session takeover, duplicate nonce and payment-disabled behavior. Any mismatch = FAIL, not READY.

## Next build phase: order and seller approval (not implemented as real transactions)

A database close means **highest bidder determined**, not necessarily contract binding or seller approval. Before any real order or payment:

- auction_closed -> `PENDING_SELLER_APPROVAL` (if reserve/seller approval required) OR explicit `AWARDED` when pre-authorized rules permit.
- Seller's decision: `APPROVED`, `COUNTER_OFFER_PENDING` (only if auction terms allow), `DECLINED`, `RESERVE_NOT_MET`. Store actor, timestamp, conditions, version and audit log. Never tell someone to pay while pending/declined.
- `AWARDED` -> create immutable order ID and fee breakdown. Buyer sees PURCHASE SUMMARY with sale price, explicitly approved buyer/platform fees, VAT/taxes if applicable, transport estimates (separately), total, due date and payment instructions. No invented taxes, fees or deadlines.
- `PAYMENT_DUE` -> `PAYMENT_VERIFICATION_PENDING` -> `PAID` only when verified by authorized admin/bank/payment provider; never trust a user-uploaded screenshot as proof.
- `DOCUMENTS_PENDING` -> `DOCUMENTS_VERIFIED` according to the actual legal seller, vehicle, buyer, registration jurisdiction and accountant/lawyer-reviewed templates.
- `RELEASE_AUTHORIZED` only if `AWARDED` + `PAID` + `COMPLIANCE_CLEARED` + `DOCUMENTS_READY` are all true.
- `PICKUP_BOOKED` or `TRANSPORT_BOOKED` -> signed `HANDOVER_COMPLETED` -> `COMPLETE` (plus payout and audit).
- Exception states with controlled permissions: payment delay/nonpayment, seller refusal, dispute, cancellation, refund, failed document, no-show and manual support.

## Which documents exist in demo versus real operations

DEMO TEST FILES, marked on every page "ДЕМО — НЕ Е ПРАВЕН/ДАНЪЧЕН ДОКУМЕНТ":
A) Test lot/vehicle sheet with fictional VIN or masked VIN and seller description;
B) demo auction terms + configured rules (reserve, clock, increment, admission);
C) read-only bid history / audit log with server timestamps;
D) downloadable winner/highest bid record (available now as TXT, suitable for PDF styling later);
E) demo seller approval/decline decision record (future sandbox);
F) demo purchase cost estimate/pro forma (not fiscal invoice, future);
G) simulated payment confirmation (not evidence of real payment, future);
H) demo release order only AFTER simulated approval/payment/docs checks (future);
I) demo vehicle handover protocol and settlement/audit receipt (future).

REAL documents depend on business model and legal review:
1. Seller-to-platform mandate/consignment or owner listing agreement; authorization to sell, reserve, representations and VIN/ownership record.
2. Buyer registration & verification/eligibility, purchase terms, bidding agreement, privacy, deposit/fee schedule.
3. Lot disclosure / condition/defects / ownership/title/registration documents.
4. Auction closing & seller acceptance record (with explicit legal binding rules).
5. Sale agreement and itemized valid tax invoice/receipt issued by the actual legal supplier using applicable Bulgarian/EU VAT/accounting treatment; do NOT auto-issue from demo.
6. Payment instructions, reconciled bank/provider receipt, AML/KYC records as applicable.
7. Vehicle ownership transfer, deregistration/export/registration/PoA documents as legally applicable, decided per exact transaction.
8. Release authorization, delivery/transport order or CMR if applicable, pickup identity, signed handover protocol.
9. Versioned audit trail with who uploaded/approved/changed each document, access restrictions and retention policy.

## Questions Enchev must settle BEFORE production seller approval/invoices

- Is ENCHEV the legal seller, an auction intermediary/agent or merchant of record? Who invoices whom and receives/sends money?
- Does the seller approve the winning bid? Is there a reserve price? When does acceptance become binding?
- Exact fees, calculation of VAT/taxes (accountant), deposit terms, buyer payment deadline, cancellation/late fees.
- Who verifies payment and which PSP/bank is used? When is the seller paid? Refund/dispute/chargeback policy.
- Original vehicle ownership papers, registration/export, storage and vehicle condition/defect disclaimer.
- Who arranges transport/pickup, pickup window, title release and proof of handover?
- Who signs documents (qualified e-signature or wet signature), privacy/GDPR/legal terms, retention, customer support owner.

## Sequence — do NOT mix stages

A. **Stabilize pilot and prove three-phone realtime** with current private Preview (CI + two full consecutive device passes).
B. **Freeze/LOCK pilot behavior** with build SHA, test report, screenshots, server bid log and DB IDs. Note known exceptions.
C. **Build next-stage seller approval/order/doc sandbox** with only DEMO instruments first.
D. Have Enchev, accountant and lawyer approve actual commercial and legally valid documents and statuses.
E. Only after gates, add real payment provider, verified identity and release flow; one controlled real vehicle pilot.
F. Finish mobile/PC visual design after behavior is stable; run accessibility, responsive and end-to-end regressions before public Production launch.

**Definition of Done**: no 100% claims based merely on Vercel READY, pages HTTP 200 or passing GitHub CI. Verify real devices, logs, behavior, security and operator steps together.
