# SYSTEM Phase 39 — Real international proof

Phase 39 integrates the existing internationalization contracts into one deterministic, side-effect-free proof for Bulgaria (country #1), Germany (country #2), and a third-language production-shaped dry run.

The proof does **not** activate a real market, bind live providers, or send real customer data. It proves that country behavior is driven by configuration and shared contracts rather than auction-core rewrites.

## Coverage

- 39.01–39.03 validate Bulgaria and Germany as configuration-driven market bundles and prove Germany can pass a synthetic activation path without country-specific auction-core code.
- 39.04 checks the third language package (en-US) against the production translation-key registry without enabling a market.
- 39.05–39.08 verify timezone/DST transitions, locale date/time formatting, locale number formatting, and metric/imperial display profiles.
- 39.09–39.11 verify international addresses, E.164 phone models, and recursive NFC normalization of user text.
- 39.12–39.13 verify the existing RTL acceptance surface and locale fallback behavior.
- 39.14–39.17 route KYC, documents and providers by country and verify regional data-flow/residency policy.
- 39.18 proves a revisioned enable → rollback transition for country activation.

## Safety boundary

- dryRunOnly=true
- realCustomerDataAllowed=false
- provider routes in this proof are dry-run routes
- activation approvals are synthetic fixtures only
- no payment, bid, winner, settlement, or auction authority is created here

Run `node scripts/verify-international-proof-39.mjs --self-test` for the complete 18-task proof.
