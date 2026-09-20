# 25.13 — Production smoke suite

## Goal

Define a read-only fail-closed smoke suite for the canonical Enchev Auctions production runtime.

## Production target

Task 01.07 defines production as the canonical Vercel production environment on the main branch. The suite reads the canonical production URL from the runtime-environment contract and does not accept Preview, localhost, alternate hosts or caller-supplied production URLs.

## Coverage

The live suite verifies the current declared health contract for web, API, realtime and worker, then checks the five critical pages: home, inventory, lot EA-10539, live auctions and profile.

The smoke suite verifies declared readiness. It does not turn currently service-pending realtime or worker health into a false healthy claim.

## Safety

The suite uses GET only, rejects redirects, performs no mutation request and does not require a deployment. Running the suite is therefore safe against the already deployed canonical production runtime.

## GREEN evidence

GREEN requires a passing CI contract/self-test on the implementation commit and a real live run against the canonical production URL. Evidence must record the observed Vercel production deployment so runtime evidence is attributable instead of inferred.
