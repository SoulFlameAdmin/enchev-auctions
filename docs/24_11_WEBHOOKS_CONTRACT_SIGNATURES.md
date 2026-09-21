# SYSTEM 24.11 — Webhooks contract + signatures

Task: **24.11 Webhooks contract + signatures**

Status: **YELLOW** — implementation exists on the task branch; GREEN requires applicable PASS CI, merge/post-merge verification and concrete evidence.

## Contract

Enchev webhook signatures use HMAC-SHA256 and the versioned format `v1=<64 lowercase/uppercase hex characters>`.

The signed byte sequence is:

`<timestamp>.<deliveryId>.<rawBody>`

The raw HTTP body must be verified before JSON parsing or mutation. Required headers are `X-Enchev-Webhook-ID`, `X-Enchev-Webhook-Timestamp`, and `X-Enchev-Webhook-Signature`.

The verifier rejects malformed delivery IDs/signatures, timestamps more than 300 seconds away from the verification clock, signatures produced with another secret, and secret sets larger than current + previous during controlled rotation. Digest comparison uses Node's constant-time `timingSafeEqual`.

Consumers must apply idempotent duplicate handling keyed by delivery ID. This signature layer authenticates transport only and never becomes auction authority; PostgreSQL remains authoritative for auction state, accepted bids, winner selection, and final results.

## Verified test scope

`scripts/verify-webhook-signature-contract.mjs --self-test` exercises positive signing/verification, previous-secret rotation, body tampering, wrong-secret rejection, past/future replay rejection, malformed delivery ID/signature, short-secret rejection and excess-active-secret rejection.


## GREEN evidence

- Implementation merged to `main` as `dd76ee358531d060048df70cf41e205bce870f9b` from PR #194.
- Exact-head implementation commit before merge: `52f212cbc58146f3919fc17028ac13c80c05655c`.
- Pre-merge dedicated SYSTEM 24.13 workflow run `35667866119`: SUCCESS.
- Post-merge SYSTEM 24.13 workflow run `35668127618`: SUCCESS; invariant and negative self-tests both PASS.
- Post-merge Verify Enchev Web run `35668127593`: CI test suite PASS, TypeScript PASS, production build PASS, built health smoke test PASS on the merged main commit.
- Pre-merge security/supply-chain checks on the exact implementation head: Secret Scan, Code Scan, SBOM Generation and Build Provenance PASS.
- Protected DAVID orchestrator files were not changed by PR #194.
- No manual Vercel deployment was required for this repository contract/test-only block.
