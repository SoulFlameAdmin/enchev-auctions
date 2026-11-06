# SYSTEM 48.01 — Infrastructure-as-Code baseline

**Scope:** A versioned, source-controlled declaration of Enchev's existing infrastructure configuration. This is a *baseline only*, not a certification that all cloud resources can be recreated.

## Canonical source inventory

- `vercel.json` — app deployment configuration.
- `supabase/migrations/` — versioned PostgreSQL migration source.
- `.github/workflows/` — CI/workflow definitions.
- `config/enchev-runtime-environments.json` — environment boundaries for local, preview/staging and production.
- `config/enchev-iac-baseline.json` — machine-verifiable inventory, restrictions and explicit nonclaims.

The verifier checks the canonical paths and source structures, rejects inventory omissions/duplicates, enforces fail-closed secret/production-mutation flags, checks staging cannot be labeled production-authoritative, and runs negative self-tests. It performs **zero external cloud operations**.

## Explicitly NOT certified under 48.01

- Terraform/Pulumi or equivalent full resource provisioning and state locking (48.02–48.05);
- cloud provider identity, RBAC, service-role credentials, actual Vercel Preview → Supabase staging binding or permanent staging (D003);
- DNS ownership, TLS production policy, backup or disaster-recovery;
- production provider apply, migration execution or real-money bidding.

A source file, a passing verifier or a READY deployment is **not** proof of these dependencies.

## Verification / acceptance

Run:
```bash
node scripts/verify-infrastructure-as-code-baseline.mjs
node scripts/verify-infrastructure-as-code-baseline.mjs --self-test
npm test
```

The pre-gate runner executes the negative self-test on every aggregate test run. A new GREEN state for SYSTEM 48.01 requires successful exact-head CI, source-integrity evidence and a reviewed merge. Until then mark **YELLOW / pending proof**. No direct Production deployment is needed or authorized by this change.
