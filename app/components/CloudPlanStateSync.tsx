"use client";

import { useEffect, useState } from "react";
import {
  CLOUD_QUOTA_BACKOFF_KEY,
  classifyPlanEndpoint,
  isFreshPlanRows,
  shouldBlockPlanEndpoint,
} from "../lib/enchev-cloud-transport-policy";

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

/**
 * The plan-status Edge Function is a shared Free-tier governance projection.
 * On HTTP 402, fail closed and stop both EventSource auto-reconnect and the
 * fetch poller. Never pretend cloud data is fresh or manually promote GREEN.
 */
const HEALTH_CHANNEL_KEY = "enchev-plan-cloud-health-v1";

export default function CloudPlanStateSync() {
  const [quotaRestricted, setQuotaRestricted] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let source: EventSource | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;
    let inFlight = false;
    let blocked = false;
    let healthChannel: BroadcastChannel | null = null;

    const closeStream = () => {
      if (source) {
        source.close();
        source = null;
      }
    };

    const stopRequests = () => {
      closeStream();
      if (interval !== null) {
        window.clearInterval(interval);
        interval = null;
      }
    };

    function quotaCircuitOpen(persist: boolean) {
      if (blocked || !active) return;
      blocked = true;
      stopRequests();
      setQuotaRestricted(true);
      console.warn("ENCHEV cloud plan state restricted (HTTP 402). " +
        "Local status is NOT a fresh cloud verification. Check Supabase Usage/Billing.");
      if (persist) {
        try { localStorage.setItem(CLOUD_QUOTA_BACKOFF_KEY, String(Date.now())); } catch {}
        try { healthChannel?.postMessage({ type: "quota-restricted" }); } catch {}
      }
    }

    try {
      healthChannel = new BroadcastChannel(HEALTH_CHANNEL_KEY);
      healthChannel.onmessage = (event: MessageEvent<{ type?: string }>) => {
        if (event.data?.type === "quota-restricted") quotaCircuitOpen(false);
      };
    } catch {}

    const pull = async (): Promise<boolean> => {
      if (!active || blocked || inFlight) return false;
      inFlight = true;
      try {
        const response = await fetch(ENDPOINT, { cache: "no-store", signal: controller.signal });
        const kind = classifyPlanEndpoint(response.status);
        if (kind === "quota-restricted") {
          quotaCircuitOpen(true);
          return false;
        }
        if (kind !== "ok") return false;
        const body: unknown = await response.json();
        if (!isFreshPlanRows(body)) return false;
        if (!active || blocked) return false;
        applyCloudRows(body.rows as CloudRow[]);
        try { localStorage.removeItem(CLOUD_QUOTA_BACKOFF_KEY); } catch {}
        return true;
      } catch {
        // Network faults remain transient; an abort must never start new polls.
        return false;
      } finally {
        inFlight = false;
      }
    };

    const connectStream = () => {
      if (source || !active || blocked) return;
      source = new EventSource(`${ENDPOINT}?stream=1`);
      const current = source;
      current.addEventListener("state", (event: MessageEvent<string>) => {
        if (!active || blocked) return;
        try {
          const data: unknown = JSON.parse(event.data);
          if (isFreshPlanRows(data)) applyCloudRows(data.rows as CloudRow[]);
        } catch {}
      });
      current.onerror = () => {
        // EventSource otherwise reconnects immediately and indefinitely on 402.
        closeStream();
        void pull(); // One guarded GET detects 402, then stops ALL retries.
      };
    };

    let isCoolingDown = false;
    try {
      isCoolingDown = shouldBlockPlanEndpoint(
        localStorage.getItem(CLOUD_QUOTA_BACKOFF_KEY), Date.now());
    } catch {}

    if (isCoolingDown) {
      quotaCircuitOpen(false);
    } else {
      void pull().then(success => {
        if (success && active && !blocked) connectStream();
      });
      // Poll only if SSE is not connected; never run two concurrent requests.
      interval = window.setInterval(() => {
        if (!blocked && (!source || source.readyState !== EventSource.OPEN)) {
          void pull();
        }
      }, 60000);
    }

    return () => {
      active = false;
      controller.abort();
      stopRequests();
      healthChannel?.close();
    };
  }, []);

  if (!quotaRestricted) return null;

  // Visible only during a proven provider restriction, not a permanent
  // intrusive banner in the healthy auction website.
  return (
    <aside role="status" aria-live="polite" style={{
      position: "fixed", right: 12, bottom: 12, zIndex: 100,
      maxWidth: 340, padding: "9px 12px", borderRadius: 8,
      background: "#17212f", color: "#fff", fontSize: 12,
      border: "1px solid #57677a", boxShadow: "0 4px 16px #0004",
    }}>
      Master cloud: HTTP 402. Данните може да са остарели.
      Проверете Supabase Usage/Billing и презаредете страницата след възстановяване.
    </aside>
  );
}
