# SYSTEM 31.01–31.05 — International expansion validation

This implementation validates the first five frozen tasks in Phase 31 with a real configuration dry run for Germany (**DE**) while keeping market activation fail-closed.

## 31.01 — Country #2 configuration dry run

`config/enchev-country-2-dry-run.json` binds DE to `de-DE` and `Europe/Berlin` and runs the same generic CountryProfile / market-bundle runtime used by the existing 21.x internationalization contracts. Generic runtime code contains no DE-specific branch.

## 31.02 — Country #2 locale package

`locales/de.json` registers the locale metadata and `locales/messages/de-DE.json` contains exact key parity with `locales/translation-keys.json`. The normal translation-completeness invariant therefore covers the new package too.

## 31.03 — Country #2 KYC / legal / document profiles

The dry-run package contains typed KYC, legal and document profiles that validate through the existing generic validators. Legal source references are deliberately named `dry-run.de.non-authoritative.*`; this is test configuration, not legal advice or legal approval.

## 31.04 — Country #2 provider routing

`packages/config/src/country-provider-routing.ts` provides credential-free, country-neutral route validation and resolution. The DE dry run resolves document, identity, notification and transport capabilities to explicit dry-run provider keys. Undefined capabilities fail closed.

No provider credential, secret or production provider binding is added by this task.

## 31.05 — Country #2 data-residency check

`packages/config/src/country-data-residency-check.ts` evaluates the technical residency policy against configured data planes. The DE check is **completed but not approved** because the production authoritative database region, object-storage region, runtime compute region policy and runtime observability retention/region remain unresolved in the upstream 21.14 review.

GREEN for 31.05 means the residency check executes deterministically, exposes its blockers and cannot silently approve unknown customer-data regions. It does **not** mean legal residency compliance or production market activation is approved.

## Fail-closed boundary

The dry run explicitly keeps these values false:

- market activation approval;
- legal validation;
- production provider binding;
- real customer-data permission.

The verifier `scripts/verify-international-expansion-validation.mjs` compiles and exercises the generic TypeScript contracts, validates locale parity, checks provider routing, checks residency blockers and includes negative self-tests.
