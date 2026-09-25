# SYSTEM 29 — Data lifecycle & privacy engineering

Phase 29 turns the frozen data-classification model from 00.07 into concrete lifecycle engineering rules. It is an engineering/privacy-control contract, not legal advice and not a legal-compliance approval.

## What is implemented

The canonical registry is `config/enchev-data-lifecycle-privacy.json`. Framework-independent helpers live in `packages/domain/src/data-lifecycle.ts`.

The block covers system-wide data inventory, sensitivity mapping, minimization, retention, deletion/anonymization, subject export state, legal holds, provider-neutral object lifecycle, log redaction, sensitive access events, and cross-border flow inventory.

## Truth boundary

`29.08 Backup retention alignment` is deliberately **not GREEN-eligible yet**. The production authoritative PostgreSQL/backup provider and its configured backup-retention window have not been verified. A repository policy cannot substitute for provider evidence.

Object-storage lifecycle is provider-neutral: it defines how future public media/private documents/inspection evidence must age and delete, but it does not claim a storage provider is currently bound.

Cross-border inventory carries `persistentResidencyClaim=false` and does not convert CDN/runtime/provider metadata into a legal residency conclusion.

## Data-subject export

The domain helper requires a verified subject, rejects cross-subject records, rejects DC-3 records, enumerates source provenance and returns a deterministic export bundle. It does not create a public unauthenticated endpoint; auth/UI activation remains owned by their later features.

## Logging

`redactForLog` recursively removes sensitive-key values and masks email/Bearer-token patterns before data reaches logs. `createSensitiveAccessEvent` emits only structured metadata; raw sensitive values are forbidden by contract.

## Deletion and legal holds

Deletion is fail-closed under an active legal hold. Immutable authority that must remain reconstructable is anonymized rather than silently mutated or deleted. Legal holds require actor/reason/timestamps and do not authorize extra data collection.

## Acceptance

Tasks 29.01–29.07 and 29.09–29.12 may become GREEN only after the dedicated verifier/self-tests and full exact-head CI pass. Task 29.08 remains YELLOW until a real production backup provider/configuration can be compared with the retention contract.
