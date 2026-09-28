# SYSTEM 35.07–35.18 — Seller workflow completion

Status: YELLOW until exact-head CI, READY Vercel preview, implementation merge and descendant GREEN evidence are proven.

## Frozen identities
- 35.07 Seller verified replies
- 35.08 Additional media attached to answers
- 35.09 Question moderation / abuse controls
- 35.10 Immutable Q&A timestamps
- 35.11 Seller live-auction presence state
- 35.12 Inspection / viewing request workflow
- 35.13 Reserve-lowering workflow
- 35.14 Reserve-not-met follow-up state
- 35.15 Listing change history
- 35.16 Republish/review after critical edit
- 35.17 Seller response notification
- 35.18 Seller workflow end-to-end test

## Contract
Seller replies are accepted only from a currently verified seller identity and only for published questions on the same vehicle. Answer attachments are bounded, normalized and duplicate-safe. Moderation can hide or restore a question without changing its original creation timestamp; reply edits preserve their creation timestamp as well.

Seller live-auction presence is seller/auction-scoped and sequence-monotonic. Viewing requests use an explicit state machine and accepted requests require a scheduled time. Reserve changes are seller-scoped, optimistic, mutation-idempotent and lower-only. A reserve-not-met follow-up can open only when the highest accepted bid is below reserve and resolves exactly once.

Listing history is append-only with contiguous per-listing sequence numbers. A critical change to a published listing forces pending review before republish. Seller response notifications are deterministic and deduplicated per reply/channel.

## Acceptance
The verifier derives all twelve task identities from the frozen master plan and exercises positive and negative cases across verified replies, answer media, moderation, immutable timestamps, presence ordering, viewing transitions, reserve lowering, reserve-not-met resolution, listing history, republish review, response-notification dedupe and one complete seller-workflow journey.
