# 25.10 — Cross-browser test matrix

## Goal

Formalize and continuously verify the cross-browser matrix that is actually executed in CI.

## Required browsers

The current authoritative matrix contains two required desktop browser channels:

- Chrome/Chromium on the GitHub-hosted runner;
- Microsoft Edge stable, installed during the workflow.

Both use the existing Chrome DevTools Protocol visual/runtime harness. A pass from only one browser is insufficient.

## Routes and viewport matrix

The harness covers these five acceptance routes:

- home;
- browse;
- lot EA-10539;
- live auctions;
- profile.

Each route is exercised at six viewport widths:

- 360;
- 390;
- 430;
- 1366;
- 1440;
- 1920.

That produces 30 screenshots per required browser and 60 screenshots across the two-browser matrix.

## Required evidence

For each required browser, CI must prove browser process startup, DevTools connectivity, route readiness, responsive/runtime invariants, screenshot capture, manifest identity, and artifact upload.

The workflow must verify that the Chrome and Edge manifests each contain 30 entries and that the Edge manifest identifies an Edge executable.

## Scope truth

This task does not claim Firefox, Safari, or WebKit coverage because the repository does not currently execute those browser engines.

The dedicated mobile-browser matrix belongs to frozen task 25.11. Mobile-width responsive checks performed here are part of the existing cross-browser visual harness, but they do not satisfy 25.11 by themselves.

## GREEN semantics

25.10 is GREEN only when the matrix contract, verifier, workflow gates, and the actual Chrome + Edge CI execution all pass on the same implementation commit.
