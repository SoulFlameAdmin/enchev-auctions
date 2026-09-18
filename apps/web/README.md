# @enchev/web

This workspace is the repository boundary for the Enchev Auctions web application.

The current production Next.js source remains in the root `app/` directory and is referenced by `boundary.json` as a **single-source bridge**. This avoids maintaining two divergent Next.js applications while the repository is being split into the frozen `apps/*` architecture.

## Ownership

The web workspace owns browser UI, web routes, and Next.js route handlers.

It does not own authoritative auction state, realtime authority, or background worker jobs.

## Verification

Run:

`npm --workspace @enchev/web run verify`

The verifier fails if the workspace contract drifts, the root web source disappears, or a second Next app is introduced under `apps/web`.
