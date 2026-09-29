# DAVID Stage 7.4–7.5

## 7.4 Failure-aware retry / replan
DAVID now derives a normalized failure signature and chooses one of:
- retry: bounded retry of the same logical goal;
- replan: repeated signature detected; avoid repeating the same tool path;
- escalate: attempt budget exhausted or risk gate hit.

This prevents repeating failures such as `CDP timeout: Input.insertText` indefinitely.

## 7.5 Measurable learning benchmark
DAVID can compare before/after run groups using:
- success rate;
- average duration;
- average action count;
- failure reduction.

A benchmark only passes when the configured thresholds are met without success-rate regression.

Verification:
- `node scripts/verify-david-failure-aware-retry.mjs`
- `node scripts/verify-david-learning-benchmark.mjs`
