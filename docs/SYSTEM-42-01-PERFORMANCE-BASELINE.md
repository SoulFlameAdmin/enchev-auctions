# SYSTEM 42.01 — Production-like performance baseline

The exact source is installed, built with `npm run build`, and served with `next start` on an isolated GitHub Actions runner. A deterministic local workload records throughput plus p50/p95/p99 latency for the public health route and homepage.

This point establishes a reproducible baseline; it does **not** claim bidder-concurrency certification. Those limits are frozen as later Phase 42 tasks.
