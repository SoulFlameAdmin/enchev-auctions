# SYSTEM 43.01–43.08 — recovery certification foundation

This wave establishes a real PostgreSQL recovery drill for the Enchev auction authority without pretending that the production provider has already been certified.

## What is executed

The GitHub Actions workflow creates an isolated PostgreSQL 17 authority, applies the authoritative bid and finalization migrations, seeds live auctions through the same PostgreSQL bid/finalization functions, and records deterministic row-count and content fingerprints.

It then:

1. creates an automated custom-format `pg_dump` backup;
2. measures local backup freshness and restore duration;
3. introduces a valid-SQL but semantically corrupted auction state;
4. verifies that the corruption is observable;
5. simulates accidental deletion by truncating the authoritative auction tables;
6. restores the backup into a clean database;
7. verifies auction, bid and finalization row counts;
8. verifies deterministic table hashes and winner consistency after restore.

## Master Plan mapping

- 43.01 Automated database backup verified — local workflow automation is proven; production provider backup remains unverified.
- 43.02 Point-in-time recovery drill — **not production-certified**; the current drill restores a discrete backup, not provider PITR.
- 43.03 Restore into clean environment — exercised in a fresh PostgreSQL database.
- 43.04 Critical row-count/integrity verification — exercised with counts, hashes and winner checks.
- 43.05 RPO measured — local backup freshness is measured; production RPO remains pending.
- 43.06 RTO measured — local restore duration is measured; production RTO remains pending.
- 43.07 Accidental-delete recovery drill — destructive state is created after backup and recovered from the clean restore.
- 43.08 Corrupted-data recovery scenario — semantic corruption is introduced, detected and removed by restoring authoritative backup state.

## Production boundary

The evidence is deliberately marked `productionCertified: false`. SYSTEM 43.01–43.08 remain YELLOW for production until the dedicated Auction DB exists and its actual backup/PITR provider is live-tested with measured production RPO/RTO.

Workflow: `.github/workflows/system-43-recovery-wave.yml`

Harness: `scripts/certify-postgres-recovery-43-01-08.mjs`
