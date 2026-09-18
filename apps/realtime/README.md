# @enchev/realtime

This workspace is the repository boundary for the Enchev Auctions realtime service.

At task 02.03 the workspace is intentionally a **service shell** only. It establishes ownership and package boundaries without claiming that WebSocket/realtime runtime behavior has been implemented. That implementation belongs to later frozen realtime phases.

## Ownership

This workspace owns the realtime service boundary, socket-room contracts, and presence/delivery boundary.

It does not own authoritative auction state, the HTTP API, worker jobs, or browser UI.

## Verification

Run:

`npm --workspace @enchev/realtime run verify`

The verifier fails if the workspace drifts into a false implementation claim or begins owning authority that belongs elsewhere.
