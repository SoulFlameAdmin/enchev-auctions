"use client";

import { useEffect } from "react";

type Status = "green" | "yellow" | "red";
type Note = { evidence?: string; blocker?: string; updatedAt?: string };
type CloudRow = {
  task_id: string;
  status: Status;
  evidence: string | null;
  blocker: string | null;
  updated_at: string;
  source_commit: string;
  source_run_id: string;
  source_workflow: string;
};

const STATUS_KEY = "enchev-system-status-v5";
const NOTES_KEY = "enchev-system-notes-v5";
const GAP_KEY = "enchev-system-gaps-v5";
const CHANNEL_KEY = "enchev-system-realtime-v5";
const ENDPOINT = "https://frhletkiuupgksmgxoxc.supabase.co/functions/v1/enchev-plan-state";
const VALID_ID = /^([0-9]{2}\.[0-9]{2}|GAP-[0-9]{3,})$/;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function validRow(row: CloudRow) {
  return VALID_ID.test(row.task_id) &&
    ["green", "yellow", "red"].includes(row.status) &&
    (!row.evidence || row.evidence.length <= 4000) &&
    (!row.blocker || row.blocker.length <= 2000) &&
    (row.status !== "green" || Boolean(row.evidence?.trim()));
}

function applyCloudRows(rows: CloudRow[]) {
  const statuses = readJson<Record<string, Status>>(STATUS_KEY, {});
  const notes = readJson<Record<string, Note>>(NOTES_KEY, {});
  const gaps = readJson<unknown[]>(GAP_KEY, []);
  let changed = false;

  for (const row of rows) {
    if (!validRow(row)) continue;
    const existing = notes[row.task_id] || {};
    const localTime = Date.parse(existing.updatedAt || "");
    const cloudTime = Date.parse(row.updated_at || "");
    const localIsNewer = Number.isFinite(localTime) && Number.isFinite(cloudTime) && localTime > cloudTime;

    // A newer local manual decision is never silently overwritten by cloud projection.
    if (localIsNewer && (existing.blocker?.trim() || existing.evidence?.trim())) continue;

    const nextNote: Note = {
      ...existing,
      evidence: row.evidence || undefined,
      blocker: row.blocker || undefined,
      updatedAt: row.updated_at,
    };

    if (statuses[row.task_id] !== row.status ||
        existing.evidence !== nextNote.evidence ||
        existing.blocker !== nextNote.blocker ||
        existing.updatedAt !== nextNote.updatedAt) {
      statuses[row.task_id] = row.status;
      notes[row.task_id] = nextNote;
      changed = true;
    }
  }

  if (!changed) return;
  localStorage.setItem(STATUS_KEY, JSON.stringify(statuses));
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));

  try {
    const channel = new BroadcastChannel(CHANNEL_KEY);
    channel.postMessage({ type: "state", statuses, notes, gaps, source: "cloud" });
    channel.close();
  } catch {}
}

async function pullCloudState(signal?: AbortSignal) {
  const response = await fetch(ENDPOINT, { cache: "no-store", signal });
  if (!response.ok) throw new Error(`Cloud plan state HTTP ${response.status}`);
  const body = (await response.json()) as { rows?: CloudRow[] };
  if (Array.isArray(body.rows)) applyCloudRows(body.rows);
}

export default function CloudPlanStateSync() {
  useEffect(() => {
    const controller = new AbortController();
    void pullCloudState(controller.signal).catch(() => {});

    const source = new EventSource(`${ENDPOINT}?stream=1`);
    const onState = (event: MessageEvent<string>) => {
      try {
        const body = JSON.parse(event.data) as { rows?: CloudRow[] };
        if (Array.isArray(body.rows)) applyCloudRows(body.rows);
      } catch {}
    };
    source.addEventListener("state", onState as EventListener);
    source.onerror = () => { void pullCloudState(controller.signal).catch(() => {}); };

    const fallback = window.setInterval(() => {
      void pullCloudState(controller.signal).catch(() => {});
    }, 30000);

    return () => {
      controller.abort();
      window.clearInterval(fallback);
      source.removeEventListener("state", onState as EventListener);
      source.close();
    };
  }, []);

  return null;
}
