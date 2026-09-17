"use client";

import { useEffect } from "react";

type Status = "green" | "yellow" | "red";
type Note = { evidence?: string; blocker?: string; updatedAt?: string };
type GapTask = { id: string; label: string; defaultStatus: Status; kind: string };
type Snapshot = { statuses: Record<string, Status>; notes: Record<string, Note>; gaps: GapTask[] };
type AuditEvent = { seq: number; at: string; taskId: string; field: "status" | "evidence" | "blocker" | "gap"; from: string | null; to: string | null; source: "local" | "realtime" | "storage"; };

const STATUS_KEY = "enchev-system-status-v5";
const NOTES_KEY = "enchev-system-notes-v5";
const GAP_KEY = "enchev-system-gaps-v5";
const CHANNEL_KEY = "enchev-system-realtime-v5";
const AUDIT_KEY = "enchev-system-status-audit-v5";
const AUDIT_SEQ_KEY = "enchev-system-status-audit-seq-v5";
const SNAPSHOT_KEY = "enchev-system-status-audit-snapshot-v5";
const MAX_EVENTS = 5000;

function readJson<T>(key: string, fallback: T): T { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; } }
function currentSnapshot(): Snapshot { return { statuses: readJson<Record<string, Status>>(STATUS_KEY, {}), notes: readJson<Record<string, Note>>(NOTES_KEY, {}), gaps: readJson<GapTask[]>(GAP_KEY, []) }; }
function normalizeSnapshot(incoming?: Partial<Snapshot>): Snapshot { const base = currentSnapshot(); return { statuses: incoming?.statuses || base.statuses, notes: incoming?.notes || base.notes, gaps: incoming?.gaps || base.gaps }; }
function appendEvents(events: Omit<AuditEvent, "seq" | "at">[]) { if (!events.length) return; const existing = readJson<AuditEvent[]>(AUDIT_KEY, []); let seq = Number(localStorage.getItem(AUDIT_SEQ_KEY) || "0"); if (!Number.isSafeInteger(seq) || seq < 0) seq = existing.reduce((m, e) => Math.max(m, e.seq || 0), 0); const at = new Date().toISOString(); const appended = events.map(event => ({ ...event, seq: ++seq, at })); const next = [...existing, ...appended].slice(-MAX_EVENTS); localStorage.setItem(AUDIT_SEQ_KEY, String(seq)); localStorage.setItem(AUDIT_KEY, JSON.stringify(next)); }
function gapMap(gaps: GapTask[]) { return new Map(gaps.map(gap => [gap.id, gap])); }
function diffSnapshots(previous: Snapshot, next: Snapshot, source: AuditEvent["source"]) { const events: Omit<AuditEvent, "seq" | "at">[] = []; const ids = new Set([...Object.keys(previous.statuses), ...Object.keys(next.statuses), ...Object.keys(previous.notes), ...Object.keys(next.notes)]); for (const id of ids) { const bs = previous.statuses[id] ?? null, as = next.statuses[id] ?? null; if (bs !== as) events.push({ taskId: id, field: "status", from: bs, to: as, source }); const be = previous.notes[id]?.evidence ?? null, ae = next.notes[id]?.evidence ?? null; if (be !== ae) events.push({ taskId: id, field: "evidence", from: be, to: ae, source }); const bb = previous.notes[id]?.blocker ?? null, ab = next.notes[id]?.blocker ?? null; if (bb !== ab) events.push({ taskId: id, field: "blocker", from: bb, to: ab, source }); } const before = gapMap(previous.gaps), after = gapMap(next.gaps); for (const id of new Set([...before.keys(), ...after.keys()])) { const b = before.get(id), a = after.get(id); const bv = b ? JSON.stringify({ label: b.label, kind: b.kind, defaultStatus: b.defaultStatus }) : null; const av = a ? JSON.stringify({ label: a.label, kind: a.kind, defaultStatus: a.defaultStatus }) : null; if (bv !== av) events.push({ taskId: id, field: "gap", from: bv, to: av, source }); } return events; }
function auditSnapshot(next: Snapshot, source: AuditEvent["source"]) { const previous = readJson<Snapshot | null>(SNAPSHOT_KEY, null); if (!previous) { localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(next)); return; } appendEvents(diffSnapshots(previous, next, source)); localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(next)); }

export default function PlanStatusAuditTrail() {
  useEffect(() => {
    auditSnapshot(currentSnapshot(), "local");
    const channel = new BroadcastChannel(CHANNEL_KEY);
    channel.onmessage = event => { if (event.data?.type === "state") auditSnapshot(normalizeSnapshot(event.data), "realtime"); };
    const onStorage = (event: StorageEvent) => { if (event.key === STATUS_KEY || event.key === NOTES_KEY || event.key === GAP_KEY) auditSnapshot(currentSnapshot(), "storage"); };
    window.addEventListener("storage", onStorage);
    return () => { window.removeEventListener("storage", onStorage); channel.close(); };
  }, []);
  return null;
}
