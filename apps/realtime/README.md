# @enchev/realtime

This workspace owns the Enchev Auctions realtime delivery service.

The runtime is implemented in `apps/realtime/server.mjs` as a non-authoritative WebSocket transport. It validates canonical events against `config/enchev-websocket-event-registry.json`, groups eligible subscribers by auction subject, and delivers projection events to connected clients.

## Authority boundary

Realtime delivery never decides whether a bid is accepted, never selects a winner, and never writes auction state. PostgreSQL remains authoritative for auction state, accepted bids, winner selection, and final results.

The service owns only:
- realtime service transport
- socket room/subscription delivery
- presence/delivery boundary

It does not own:
- auction authority
- HTTP API authority
- worker jobs
- browser UI

## Runtime

Start the service with:

`ENCHEV_REALTIME_INTERNAL_KEY=<server-only-key> npm --workspace @enchev/realtime run start`

Health:

`GET /health`

WebSocket subscription:

`GET /ws?subject=auction/<auction-id>` with an RFC6455 upgrade.

Internal projection publisher:

`POST /publish` with `x-enchev-realtime-key`. Only canonical registered events are accepted.

## Verification

Run:

`npm --workspace @enchev/realtime run verify`

The verifier fails if the runtime takes auction authority, loses the event-registry boundary, or drifts back to an unimplemented shell.
