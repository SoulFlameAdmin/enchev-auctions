# 25.04 — Contract-test strategy

## Goal

Define how Enchev Auctions detects incompatible changes between producers and consumers before integration or end-to-end execution.

## Scope

Contract tests cover HTTP/API schemas, provider-adapter interfaces, event payloads, and configuration contracts. They verify shape and compatibility, not full business behavior.

## Rules

- contract tests run in local or CI environments only;
- production calls and production credentials are forbidden;
- live provider calls are forbidden;
- versioned fixtures or schemas are used where applicable;
- required fields, field types, enums, identifiers, and compatibility policy are validated;
- breaking changes require an explicit version boundary or migration path;
- negative cases must prove that incompatible shapes are rejected;
- applicable contract-test failures block GREEN.

## Compatibility boundary

Backward-compatible additions may be accepted only where the owning contract explicitly permits them. Silent field removal, incompatible type changes, semantic identifier drift, or producer/consumer disagreement are breaking changes.

## Relationship to other frozen tasks

24.01 owns the OpenAPI/API specification. 25.02 owns integration behavior. 25.03 owns end-to-end behavior. 25.10 owns the cross-browser matrix. 25.04 defines only the contract-validation layer and does not claim that any external provider integration is implemented.
