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

## Evidence target

`scripts/verify-webhook-signature-contract.mjs --self-test` exercises positive signing/verification, previous-secret rotation, body tampering, wrong-secret rejection, past/future replay rejection, malformed delivery ID/signature, short-secret rejection and excess-active-secret rejection.
