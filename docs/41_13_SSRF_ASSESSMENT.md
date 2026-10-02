# SYSTEM 41.13 — SSRF assessment

This task assesses the current Enchev repository and adds a fail-closed outbound destination policy for future provider/worker HTTP adapters.

## Repository assessment

The current repository contains no production outbound `fetch`/HTTP provider client. `packages/providers/boundary.json` still declares `concrete_provider_clients: false`, and `apps/worker/boundary.json` still declares `implementation_state: not-implemented`.

Therefore 41.13 does not invent or probe a production egress path that does not exist. It certifies the reusable SSRF boundary that future outbound adapters must invoke.

## Outbound destination policy

The policy requires:

- HTTPS only;
- exact hostname allowlisting;
- explicit allowed ports;
- no URL credentials/userinfo;
- no IP-literal URL hosts;
- no localhost, `.local`, `.internal`, `.lan`, or similar internal hostnames;
- a non-empty trusted DNS resolution result;
- **every** resolved address must be globally routable/public;
- RFC1918, loopback, link-local, CGNAT, documentation/reserved/multicast IPv4 ranges rejected;
- loopback, ULA, link-local/site-local, multicast, documentation, 6to4/Teredo-like and IPv4-mapped private IPv6 rejected;
- redirect handling must be manual;
- every redirect hop must repeat URL allowlist + DNS-address validation;
- redirect count is bounded.

A mixed DNS answer containing one public and one private address fails closed. A previously allowed hostname that later resolves private also fails on the next validation, modeling DNS-rebinding resistance.

## DNS pinning boundary

The policy returns the exact validated resolution set. A production HTTP adapter must connect only to a validated address from that set rather than resolving the hostname again after validation. No production HTTP client exists yet, so actual resolver-to-socket pinning is not claimed by this task.

## Claim boundaries

41.13 does not claim a production egress firewall, production DNS resolver/socket pinning, concrete HTTP-client integration or a live provider hostname allowlist. Upload-content attack certification remains 41.14.

Implementation: `packages/providers/src/outbound-url-policy.ts`

Run: `node scripts/verify-ssrf-assessment-41-13.mjs --self-test`

## Verification note

The implementation branch was rebuilt from clean `main` history after a secret-scanner false positive caused by a credential-shaped test URI. The test now constructs userinfo dynamically; the SSRF policy and assertions are unchanged.
