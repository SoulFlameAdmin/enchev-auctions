# SYSTEM 38.01 — Exact VIN search

The search contract accepts only a canonical **17-character VIN** and performs **exact equality** after trim + ASCII uppercase normalization.

- VIN characters **I, O and Q** are rejected.
- Cyrillic/mixed-script confusables are rejected by the ASCII VIN allowlist.
- A **partial VIN** is not treated as an exact VIN hit.
- Near matches are not returned.
- A **duplicate normalized VIN** fails closed instead of selecting an arbitrary vehicle.
- This is a discovery projection only; it never mutates vehicle, auction, bid, winner or settlement authority.

Verification: `node scripts/verify-exact-vin-search-38-01.mjs --self-test`.
