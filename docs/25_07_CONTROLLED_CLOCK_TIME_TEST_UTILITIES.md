# 25.07 — Controlled clock/time-test utilities

## Goal

Provide an executable deterministic clock for time-sensitive tests without depending on the machine wall clock or real sleeps.

## Utility

`test/utils/controlled-clock.mjs` exposes `createControlledClock(initialTime)`.

The returned clock supports:

- `nowMs()`
- `nowDate()`
- `iso()`
- `set(nextTime)`
- `advance(durationMs)`
- `snapshot()`

## Test contract

Time-sensitive code should accept a clock/time source through dependency injection. Tests can then set exact UTC boundaries and advance elapsed time deterministically.

The helper intentionally does **not** patch the global `Date` object and does not fake timers globally. It also does not sleep. That keeps parallel tests isolated and avoids hidden process-wide state.

Inputs must be explicit UTC ISO timestamps with millisecond precision or safe integer epoch milliseconds. Negative advances and overflow are rejected. `nowDate()` returns a fresh Date instance so callers cannot mutate the clock through a returned object.

## Ownership boundaries

25.06 owns deterministic fixture data. 25.08 owns flaky-test policy. 25.07 only provides controlled time-test mechanics and their executable verification.
