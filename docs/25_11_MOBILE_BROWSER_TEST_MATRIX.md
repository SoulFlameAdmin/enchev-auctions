# 25.11 — Mobile-browser test matrix

## Goal

Define and gate the mobile-browser matrix without overstating what CI currently executes.

## Executable CI baseline

The repository already runs the same acceptance harness against Chrome/Chromium and Microsoft Edge stable with mobile emulation enabled.

The required mobile viewports are:

- 360 × 800;
- 390 × 844;
- 430 × 932.

The required routes are:

- home;
- inventory;
- lot EA-10539;
- live auctions;
- profile.

That produces 15 mobile captures per CI browser channel and 30 mobile captures across the two-channel baseline.

The harness enables touch emulation and validates responsive geometry plus task-specific mobile invariants such as sticky/fixed action safety, focus visibility, reconnect-state visibility, and horizontal-overflow protection.

## Release target

CI desktop browsers in mobile-emulation mode are not equivalent to real Android Chrome or iOS Safari.

Final production acceptance therefore requires separate exact-release evidence for:

- Android Chrome;
- iOS Safari.

That evidence may come from a real-device lab or an approved platform simulator/browser service. This task does not claim those release channels are currently executed.

## GREEN semantics

25.11 is GREEN when the mobile matrix contract, verifier, explicit CI mobile-count gate, and executable Chrome/Edge mobile-emulation baseline pass on the exact implementation commit.

GREEN for 25.11 does not waive the final-production requirement for Android Chrome and iOS Safari evidence.
