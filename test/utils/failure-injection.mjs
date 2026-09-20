export const FAILURE_INJECTION_HARNESS_VERSION = 1;

export function createFailureHarness(options = {}) {
  const retryBudget = Number.isInteger(options.retryBudget) ? options.retryBudget : 2;
  const authoritativeNow = Number.isFinite(options.authoritativeNow) ? options.authoritativeNow : 1_800_000_000_000;

  if (retryBudget < 0 || retryBudget > 10) {
    throw new Error("FAILURE_HARNESS invalid retry budget");
  }

  const seen = new Set();

  return {
    providerResult(kind, attempt = 0) {
      if (!["timeout", "503", "ok"].includes(kind)) throw new Error("FAILURE_HARNESS unknown provider result");
      if (!Number.isInteger(attempt) || attempt < 0) throw new Error("FAILURE_HARNESS invalid attempt");
      if (kind === "ok") return { ok: true, action: "continue" };
      return {
        ok: false,
        action: attempt < retryBudget ? "retry" : "fail-closed",
        retryable: true,
        remainingRetries: Math.max(0, retryBudget - attempt)
      };
    },

    consumeEvent(event) {
      if (!event || typeof event !== "object") return { ok: false, action: "reject", reason: "malformed-event" };
      if (typeof event.id !== "string" || !event.id) return { ok: false, action: "reject", reason: "malformed-event" };
      if (!Number.isInteger(event.sequence) || event.sequence < 1) return { ok: false, action: "reject", reason: "malformed-event" };

      if (seen.has(event.id)) return { ok: true, action: "idempotent-ignore", duplicate: true };

      const expectedSequence = seen.size + 1;
      if (event.sequence !== expectedSequence) {
        return { ok: false, action: "authoritative-resync-required", expectedSequence, receivedSequence: event.sequence };
      }

      seen.add(event.id);
      return { ok: true, action: "apply", duplicate: false, sequence: event.sequence };
    },

    validateDeadline({ browserNow, deadline }) {
      if (!Number.isFinite(browserNow) || !Number.isFinite(deadline)) {
        return { ok: false, action: "reject", reason: "invalid-time-input" };
      }
      return authoritativeNow <= deadline
        ? { ok: true, action: "accept", authoritativeNow, browserNowIgnored: true }
        : { ok: false, action: "reject-late-operation", authoritativeNow, browserNowIgnored: true };
    }
  };
}
