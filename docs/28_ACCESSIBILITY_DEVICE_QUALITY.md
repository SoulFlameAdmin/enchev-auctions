# SYSTEM 28 — Accessibility & device quality

Phase 28 turns the already implemented D32–D35 accessibility/responsive work into an explicit MASTER SYSTEM PLAN verification contract.

## Scope and truth boundary

- Target: **WCAG 2.2 AA** across the five core buyer routes.
- This phase does **not** claim third-party WCAG certification.
- Chrome and Microsoft Edge are exercised by the existing real browser/CDP screenshot matrix.
- Android Chrome and iOS Safari are explicit release targets. Phase 28 verifies the baseline/contract and CI mobile-emulation coverage; it does **not** falsely claim that real Android/iOS browser execution has already happened. Final production acceptance still requires exact-release device-lab or approved simulator evidence.

## Task mapping

- **28.01** — target standard is pinned to WCAG 2.2 AA.
- **28.02–28.04** — skip link, keyboard focus, focus restoration, ARIA labels and landmarks are source-verified.
- **28.05** — representative ENCHEV foreground/background tokens are checked with the WCAG contrast formula.
- **28.06** — auction/connection/bid states include text labels in addition to color.
- **28.07** — form labels, error alert and loading semantics are verified.
- **28.08** — the lot media viewer is a labelled modal dialog with keyboard close/navigation and focus restoration.
- **28.09** — LIVE connection, timer, sold transition and bid feedback expose role/status/timer + aria-live semantics.
- **28.10** — reduced-motion handling is enforced.
- **28.11** — the core-route browser matrix runs at 360/390/430px, a stricter reflow width than ordinary 200% desktop zoom, and checks responsive geometry/overflow in Chrome and Edge.
- **28.12** — touch/coarse-pointer targets are pinned to at least 44px for the audited controls.
- **28.13** — desktop Chrome + Edge matrix remains mandatory.
- **28.14** — mobile CI baseline remains Chrome/Edge emulation while Android Chrome + iOS Safari remain mandatory final-release targets.

## GREEN acceptance

Phase 28 can be marked GREEN only after:
1. the dedicated verifier and negative self-tests pass;
2. the existing accessibility/mobile/cross-browser verifiers pass;
3. the full exact-head **Verify Enchev Web** job passes, including the real Chrome + Edge visual regression matrix;
4. evidence is synced only after that terminal CI result.
