# 26.03 — Preview deployment per change

Status target: GREEN only after the repository policy verifier passes in pull-request CI and there is concrete evidence that a product-affecting PR receives a Vercel Preview deployment.

## Contract

- Pull requests targeting `main` run the canonical **Verify Enchev Web** workflow.
- Vercel Git integration remains eligible to create Preview deployments for ordinary product branches.
- `main` is intentionally excluded from automatic Git deployment. Production promotion is controlled separately and belongs to later CI/CD gates.
- DAVID-owned branch patterns remain excluded by the existing immutable orchestration policy.
- The existing `ignoreCommand` may skip non-product-only changes such as documentation, DAVID tooling and workflow-only edits. A product-affecting changed-file set must not be unconditionally skipped.
- Preview deployment is non-authoritative. PostgreSQL remains authoritative for auction state and no Preview environment may be treated as production acceptance.
- No manual Vercel deployment is required for this task. Existing Git-integration Preview evidence may be used when it is tied to an exact PR head SHA.

## Automated verification

`scripts/verify-preview-deployment-per-change.mjs` fails closed when:

1. Preview-capable branches are globally disabled in `vercel.git.deploymentEnabled`.
2. The product/system branch namespace is disabled from previews.
3. `ignoreCommand` becomes an unconditional skip.
4. The canonical workflow stops running on pull requests to `main`.
5. The canonical workflow stops executing the 26.03 verifier.

Self-tests mutate the policy in memory and prove that each invalid configuration is rejected.

## Acceptance evidence

GREEN requires both:

- exact-head GitHub Actions PASS for the 26.03 invariant and self-tests; and
- an observed READY Vercel Preview deployment for a product-affecting pull-request commit.

A docs-only or workflow-only change being intentionally skipped does not violate this contract.
