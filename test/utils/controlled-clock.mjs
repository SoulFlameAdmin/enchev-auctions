const ISO_UTC_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function toEpochMs(value, label) {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new TypeError(`${label} must be a safe integer epoch millisecond value`);
    }
    return value;
  }

  if (typeof value === "string" && ISO_UTC_RE.test(value)) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  throw new TypeError(`${label} must be an explicit UTC ISO timestamp or safe integer epoch milliseconds`);
}

function toDurationMs(value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError("advance duration must be a non-negative safe integer millisecond value");
  }
  return value;
}

export function createControlledClock(initialTime) {
  let currentMs = toEpochMs(initialTime, "initialTime");

  return Object.freeze({
    nowMs() {
      return currentMs;
    },

    nowDate() {
      return new Date(currentMs);
    },

    iso() {
      return new Date(currentMs).toISOString();
    },

    set(nextTime) {
      currentMs = toEpochMs(nextTime, "nextTime");
      return currentMs;
    },

    advance(durationMs) {
      const delta = toDurationMs(durationMs);
      const next = currentMs + delta;
      if (!Number.isSafeInteger(next)) {
        throw new RangeError("controlled clock overflow");
      }
      currentMs = next;
      return currentMs;
    },

    snapshot() {
      return Object.freeze({
        epochMs: currentMs,
        iso: new Date(currentMs).toISOString()
      });
    }
  });
}
