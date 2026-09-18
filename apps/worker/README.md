# @enchev/worker

This workspace is the repository boundary for Enchev Auctions background jobs.

At task 02.04 the workspace is intentionally a **service shell** only. It establishes product-worker ownership without claiming that scheduled/background runtime behavior has been implemented. Runtime implementation belongs to later frozen worker/job phases.

## Ownership

This workspace owns background-job boundaries, scheduled-job contracts, and asynchronous processing boundaries.

It does not own auction authority, the HTTP API, realtime authority, browser UI, or DAVID automation. Files under `tools/david/` are automation for project development and are not the Enchev product worker.

## Verification

Run:

`npm --workspace @enchev/worker run verify`

The verifier fails on false implementation claims, authority leakage, or accidental reuse of DAVID automation as product-worker runtime.
