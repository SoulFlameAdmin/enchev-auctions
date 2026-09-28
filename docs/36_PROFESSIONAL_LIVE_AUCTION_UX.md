# SYSTEM Phase 36 — Professional live-auction UX

Phase 36 turns the existing ENCHEV live-auction demo surface into a deterministic professional bidder UX contract without changing auction authority. The browser remains presentation/control-plane only; authoritative sequencing comes from server-issued snapshots.

## Scope

- 36.01–36.05: bidder focus, multi-lot dashboard, current/next lot, lane position and lots-away.
- 36.06–36.11: server-time sync, network quality, connection-loss/reconnect progress, authoritative resync and stale hard-refresh policy.
- 36.12–36.17: bid confirmation, accepted/rejected reasons, realtime outbid/late-extension, multi-tab ownership and keyboard controls.
- 36.18–36.20: responsive mobile layout, accessible live announcements and deterministic same-account multi-device convergence test.

## Safety invariants

1. A disconnected/stale/read-only client cannot arm a bid action.
2. Reconnect never trusts a lower sequence than the current client replica.
3. Multi-tab conflict resolution yields one active bidder tab and read-only secondary tabs.
4. Same-account devices converge to the newest authoritative server snapshot.
5. Accessible announcements describe state changes in text; color is never the only signal.
6. Phase 36 does not turn the demo clock endpoint into production auction authority.

## Verification

`scripts/verify-live-auction-ux-36.mjs --self-test` derives all 20 frozen task identities from the immutable master plan, compiles and executes the domain contract, validates the UI markers, and exercises negative cases for unsafe bidding, sequence regression, tab conflicts and device divergence.

The repository aggregate pre-gate invokes this verifier before the normal CI suite.
