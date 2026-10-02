# SYSTEM 41.14 — Upload-content attack test

This task adds a reusable, fail-closed upload-content inspection boundary and an abuse suite for the next frozen Phase 41 security item.

## Repository boundary

The current repository does not expose a production vehicle media/document upload route and does not contain a concrete object-storage upload adapter. 41.14 therefore does **not** invent a live upload endpoint or claim production storage controls that do not exist yet.

Instead, it certifies the content-validation boundary future upload routes must invoke before accepted bytes can move to storage.

## Enforced boundary

The validator rejects by default unless all three representations agree:

1. byte signature / structural content,
2. declared MIME type,
3. filename extension.

Additional controls:

- vehicle images: JPEG, PNG or WebP only;
- vehicle documents: PDF, JPEG or PNG only;
- SVG, HTML/XML active markup rejected;
- PE/ELF/Mach-O/Java-like executable signatures rejected;
- ZIP/GZIP/RAR/7z archives rejected;
- path separators, encoded traversal tokens, NUL/control characters and Unicode bidi filename spoofing rejected;
- purpose confusion is rejected (for example PDF as image or WebP as document);
- size and minimum-size bounds are mandatory;
- JPEG must end at EOI;
- PNG must end at IEND;
- WebP RIFF size must match the actual object length;
- PDF must contain a terminal %%EOF with no non-whitespace trailing payload;
- PDF JavaScript, launch, embedded-file, open-action and additional-action markers are rejected;
- embedded archive markers are rejected to catch common appended polyglot payloads.

## Abuse suite

The verifier exercises 26 negative scenarios plus positive JPEG/PNG/WebP image and PDF/JPEG/PNG document fixtures. Every negative case must fail closed with the expected security error family.

Implementation: `packages/domain/src/upload-content-policy.ts`

Run:

```bash
node scripts/verify-upload-content-attack-41-14.mjs --self-test
```

## Claim boundaries

This task does not claim a production upload endpoint, object-storage IAM, antivirus provider scanning, image decoder/re-encoding, or content-disarm-and-reconstruction. Those remain production-integration controls for later implementation. Phase 41.15 remains the frozen Secret scanning clean certification.
