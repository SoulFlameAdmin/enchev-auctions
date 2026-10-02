# SYSTEM 41.14 — Upload-content attack test

This task adds and certifies a fail-closed upload-content ingress policy for future Enchev media/document upload adapters.

## Repository reality

The repository does not currently contain a production upload route, object-storage client or malware-scanner integration. The existing country-document profile explicitly excludes upload UI, storage buckets, malware scanning and document binary content.

41.14 therefore does not invent a live upload pipeline. It certifies the security boundary that future upload adapters must call before any object can leave quarantine.

## Ingress policy

Only a deliberately narrow baseline is recognized:

- JPEG images;
- PNG images;
- PDF documents.

The original filename is display metadata only. It may not contain path separators, control characters, hidden/dot paths, unsupported characters or dangerous executable/script/archive double extensions. The client may not choose an object-storage key.

Declared size must match observed bytes and must remain within type-specific limits. MIME, extension and magic bytes must agree.

The guard rejects executable signatures, archive signatures, active web/script content and high-risk active PDF markers. JPEG/PNG/PDF also require a minimal structural envelope (image end marker/chunk or PDF EOF marker).

## Quarantine-only result

A passing file is **not clean and not publishable**. The only successful disposition is `quarantine`.

- images still require a real decoder plus decode/re-encode sanitization;
- PDFs still require a real document-security/malware scan;
- all files require malware scanning before any clean-storage release;
- client claims such as “clean” are rejected;
- storage keys must be generated server-side.

This makes scanner/provider absence fail safely instead of silently promoting a file to public storage.

## Attack certification

The verifier covers 34 scenarios: path traversal and filename tricks, size mismatch/oversize, MIME/extension/magic disagreement, executable and archive signatures, HTML/SVG/script polyglots, active PDF features, truncated structures, client bypass claims and valid JPEG/PNG/PDF quarantine outcomes.

## Claim boundaries

41.14 does not claim a production upload runtime, object-storage provider, malware scanner, full image decoder safety, complete PDF parser safety, EXIF sanitization or clean-storage release. Those later runtime/media-security tasks remain separate.

Implementation: `packages/providers/src/upload-content-policy.ts`

Run: `node scripts/verify-upload-content-attack-41-14.mjs --self-test`
