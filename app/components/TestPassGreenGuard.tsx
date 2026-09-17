"use client";

import { useEffect } from "react";
import { MASTER_TEST_TASK_IDS } from "../generated-master-plan-test-ids";

type Status = "green" | "yellow" | "red";
type Note = { evidence?: string; blocker?: string; updatedAt?: string };

const STATUS_KEY = "enchev-system-status-v5";
const NOTES_KEY = "enchev-system-notes-v5";
const CHANNEL_KEY = "enchev-system-realtime-v5";
const TEST_IDS = new Set<string>(MASTER_TEST_TASK_IDS);
const TEST_BLOCKER = "GREEN блокиран: test task изисква PASS/SUCCESS evidence.";
const PASS_RE = /\b(PASS|PASSED|SUCCESS|SUCCEEDED)\b/i;
const NON_PASS_RE = /\b(FAIL|FAILED|ERROR|PENDING|CANCELLED|CANCELED|BLOCKED)\b/i;

export function hasPassingTestEvidence(value: string | undefined) {
  const evidence = (value || "").trim();
  return Boolean(evidence && PASS_RE.test(evidence) && !NON_PASS_RE.test(evidence));
}

function sanitizeTestGreens(statuses: Record<string, Status>, notes: Record<string, Note>) {
  let changed = false;
  const nextStatuses = { ...statuses };
  const nextNotes = { ...notes };
  const stamp = new Date().toISOString();

  for (const id of TEST_IDS) {
    if (nextStatuses[id] !== "green") continue;
    const existing = nextNotes[id] || {};

    if (!hasPassingTestEvidence(existing.evidence)) {
      nextStatuses[id] = "yellow";
      nextNotes[id] = { ...existing, blocker: TEST_BLOCKER, updatedAt: stamp };
      changed = true;
      continue;
    }

    if (existing.blocker === TEST_BLOCKER) {
      nextNotes[id] = { ...existing, blocker: "", updatedAt: stamp };
      changed = true;
    }
  }

  return { changed, statuses: nextStatuses, notes: nextNotes };
}

export default function TestPassGreenGuard() {
  useEffect(() => {
    const channel = new BroadcastChannel(CHANNEL_KEY);

    const apply = (incomingStatuses?: Record<string, Status>, incomingNotes?: Record<string, Note>) => {
      try {
        const statuses = incomingStatuses || JSON.parse(localStorage.getItem(STATUS_KEY) || "{}") as Record<string, Status>;
        const notes = incomingNotes || JSON.parse(localStorage.getItem(NOTES_KEY) || "{}") as Record<string, Note>;
        const result = sanitizeTestGreens(statuses, notes);
        if (!result.changed) return;

        localStorage.setItem(STATUS_KEY, JSON.stringify(result.statuses));
        localStorage.setItem(NOTES_KEY, JSON.stringify(result.notes));
        channel.postMessage({ type: "state", statuses: result.statuses, notes: result.notes });
      } catch {}
    };

    apply();

    channel.onmessage = (event) => {
      if (event.data?.type !== "state") return;
      apply(event.data.statuses, event.data.notes);
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === STATUS_KEY || event.key === NOTES_KEY) apply();
    };
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("storage", onStorage);
      channel.close();
    };
  }, []);

  return null;
}
