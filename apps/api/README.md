# @enchev/api

This workspace is the repository boundary for the Enchev Auctions HTTP API.

The current production API route handlers remain under the root `app/api/` tree and are referenced by `boundary.json` as a **single-source bridge**. This prevents a second divergent API implementation while the frozen `apps/*` architecture is introduced incrementally.

## Ownership

The API workspace owns HTTP API boundaries, request/response contracts, and health API routes.

It does not own authoritative auction state, realtime authority, background jobs, or browser UI.

## Verification

Run:

`npm --workspace @enchev/api run verify`

The verifier fails if the workspace contract drifts, the root API source disappears, or a duplicate API source tree is introduced under `apps/api`.
