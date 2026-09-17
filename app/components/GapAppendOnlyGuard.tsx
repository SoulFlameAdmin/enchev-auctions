"use client";

import { useEffect } from "react";

type Status = "green" | "yellow" | "red";
type Kind = "core" | "test" | "security" | "legal" | "global" | "ai";
type GapTask = { id: string; label: string; defaultStatus: Status; kind: Kind };
type Note = { evidence?: string; blocker?: string; updatedAt?: string };

const GAP_KEY = "enchev-system-gaps-v5";
const STATUS_KEY = "enchev-system-status-v5";
const NOTES_KEY = "enchev-system-notes-v5";
const CHANNEL_KEY = "enchev-system-realtime-v5";
const GAP_SEQUENCE_KEY = "enchev-system-gap-seq-v5";
const AUDIT_MAX_GAP = 94;
const GAP_ID_RE = /^GAP-(\d{3,})$/;
// 32.07 production-verification retrigger only; allocator behavior is unchanged.

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function gapNumber(id: string): number | null {
  const match = GAP_ID_RE.exec(id);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function readHighWater(gaps: GapTask[]): number {
  const persisted = Number(localStorage.getItem(GAP_SEQUENCE_KEY) || "0");
  const ids = gaps.map((gap) => gapNumber(gap.id) || 0);
  return Math.max(AUDIT_MAX_GAP, Number.isSafeInteger(persisted) ? persisted : 0, ...ids);
}

function formatGapId(value: number): string {
  return `GAP-${String(value).padStart(3, "0")}`;
}

function broadcast(statuses: Record<string, Status>, notes: Record<string, Note>, gaps: GapTask[]) {
  try {
    const channel = new BroadcastChannel(CHANNEL_KEY);
    channel.postMessage({ type: "state", statuses, notes, gaps });
    channel.close();
  } catch {}
}

function persistState(statuses: Record<string, Status>, notes: Record<string, Note>, gaps: GapTask[]) {
  localStorage.setItem(STATUS_KEY, JSON.stringify(statuses));
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  localStorage.setItem(GAP_KEY, JSON.stringify(gaps));
  broadcast(statuses, notes, gaps);
}

function normalizeStoredGaps(incoming?: GapTask[]) {
  const gaps = Array.isArray(incoming) ? incoming : readJson<GapTask[]>(GAP_KEY, []);
  const statuses = readJson<Record<string, Status>>(STATUS_KEY, {});
  const notes = readJson<Record<string, Note>>(NOTES_KEY, {});
  let highWater = readHighWater(gaps);
  const seen = new Set<string>();
  let changed = false;

  const normalized = gaps.map((gap) => {
    const parsed = gapNumber(gap.id);
    if (parsed !== null && !seen.has(gap.id)) {
      seen.add(gap.id);
      highWater = Math.max(highWater, parsed);
      return gap;
    }

    let id: string;
    do {
      highWater += 1;
      id = formatGapId(highWater);
    } while (seen.has(id));

    // Reserve the sequence before writing the migrated record. A crash may skip an ID,
    // but must never make an already-issued ID eligible for reuse.
    localStorage.setItem(GAP_SEQUENCE_KEY, String(highWater));
    seen.add(id);
    const priorStatus = statuses[gap.id];
    const priorNote = notes[gap.id];
    statuses[id] = priorStatus || "red";
    if (priorNote) notes[id] = priorNote;
    if (parsed === null) {
      delete statuses[gap.id];
      delete notes[gap.id];
    }
    changed = true;
    return { ...gap, id, defaultStatus: "red" as Status };
  });

  localStorage.setItem(GAP_SEQUENCE_KEY, String(highWater));
  if (changed) persistState(statuses, notes, normalized);
}

function allocateGap(label: string) {
  const gaps = readJson<GapTask[]>(GAP_KEY, []);
  const statuses = readJson<Record<string, Status>>(STATUS_KEY, {});
  const notes = readJson<Record<string, Note>>(NOTES_KEY, {});
  const used = new Set(gaps.map((gap) => gap.id));
  let highWater = readHighWater(gaps);
  let id: string;

  do {
    highWater += 1;
    id = formatGapId(highWater);
  } while (used.has(id));

  // High-water is committed first so deletion/retry cannot recycle this ID.
  localStorage.setItem(GAP_SEQUENCE_KEY, String(highWater));
  const gap: GapTask = { id, label, defaultStatus: "red", kind: "core" };
  const nextGaps = [...gaps, gap];
  const nextStatuses = { ...statuses, [id]: "red" as Status };
  persistState(nextStatuses, notes, nextGaps);
}

function clearControlledInput(input: HTMLInputElement) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (setter) setter.call(input, "");
  else input.value = "";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

export default function GapAppendOnlyGuard() {
  useEffect(() => {
    normalizeStoredGaps();

    const channel = new BroadcastChannel(CHANNEL_KEY);
    channel.onmessage = (event) => {
      if (event.data?.type === "state" && Array.isArray(event.data.gaps)) {
        normalizeStoredGaps(event.data.gaps as GapTask[]);
      }
    };

    const onClickCapture = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const button = target?.closest(".gapInput button");
      if (!button) return;
      const box = button.closest(".gapInput");
      const input = box?.querySelector("input") as HTMLInputElement | null;
      const label = input?.value.trim() || "";
      if (!input || !label) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      allocateGap(label);
      clearControlledInput(input);
    };

    const onKeyDownCapture = (event: KeyboardEvent) => {
      if (event.key !== "Enter") return;
      const input = event.target instanceof HTMLInputElement ? event.target : null;
      if (!input?.closest(".gapInput")) return;
      const label = input.value.trim();
      if (!label) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      allocateGap(label);
      clearControlledInput(input);
    };

    document.addEventListener("click", onClickCapture, true);
    document.addEventListener("keydown", onKeyDownCapture, true);
    return () => {
      channel.close();
      document.removeEventListener("click", onClickCapture, true);
      document.removeEventListener("keydown", onKeyDownCapture, true);
    };
  }, []);

  return null;
}
