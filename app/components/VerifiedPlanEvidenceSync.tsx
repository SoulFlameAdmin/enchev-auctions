"use client";

import { useEffect } from "react";

type Status = "green" | "yellow" | "red";
type Note = { evidence?: string; blocker?: string; updatedAt?: string };

const STATUS_KEY = "enchev-system-status-v5";
const NOTES_KEY = "enchev-system-notes-v5";
const CHANNEL_KEY = "enchev-system-realtime-v5";

const VERIFIED_WAVE_0: Record<string, string> = {
  "00.01": "docs/00_01_SYSTEM_SCOPE_AND_BOUNDARIES.md · commit 1782e4deac453adb024c2322490ac94386656a07 · Vercel production READY",
  "00.02": "docs/00_02_ACTORS_AND_PERMISSION_MAP.md · commit 332e6ecc9cc1cda93768d5d01e5d02bae97dbc8f · Vercel production READY",
  "00.03": "docs/00_03_AUTHORITATIVE_COMPONENTS_DEFINED.md · implementation 2e5a17cb10fef4ca52a4fd52feba3b37449088e8 · GREEN evidence a3c9165c0aae6b0089feaa7ec783f5f79c521833 · Vercel production READY",
  "00.04": "docs/00_04_CRITICAL_SYSTEM_INVARIANTS.md · implementation e566fe6de2c9b668142cb671026e89282ece2e44 · GREEN evidence 7a8e2c2ed556a3c464d046802e2b59641e6d3e11 · Vercel dpl_4gawek1QQZDXmchB3fgsyC2R261d READY",
  "00.05": "docs/00_05_NON_FUNCTIONAL_REQUIREMENTS.md · implementation 520891b7e54b285551c11af38936b714a3665795 · GREEN evidence 01cdce178f8cf8f1876e6c1449822b2d942a39aa · Vercel dpl_EDhvaagA8dLXnqMD3a6rPPwn6mgy READY",
  "00.06": "docs/00_06_DEPENDENCY_INVENTORY.md · implementation 7bda0dbc9603ca068deac37591c9034f9c535c9c · GREEN evidence 151ea2a898f63a1d68f688e7de56f53634630583 · Vercel dpl_GEQf6ucwQZ8C4ctMEf7TPRhjGQCx READY",
  "00.07": "docs/00_07_DATA_CLASSIFICATION_MODEL.md · implementation 1561969541ca082008d26266464ca7c184ca1e3f · GREEN evidence 9227b045986a5f6b169ad58c5baedcbbd83fc890 · verified descendant e76a4e84bb43281a7891a89dc24eca49c6435a71 · Vercel dpl_8mVzSYNxUY6PicgULaEgvcYHhQ4t READY",
};

export default function VerifiedPlanEvidenceSync() {
  useEffect(() => {
    let timer: number | undefined;

    try {
      const statuses = JSON.parse(localStorage.getItem(STATUS_KEY) || "{}") as Record<string, Status>;
      const notes = JSON.parse(localStorage.getItem(NOTES_KEY) || "{}") as Record<string, Note>;
      const stamp = new Date().toISOString();
      let changed = false;

      for (const [id, evidence] of Object.entries(VERIFIED_WAVE_0)) {
        const existing = notes[id] || {};
        const manuallyTouched = Boolean(existing.updatedAt || existing.blocker?.trim() || existing.evidence?.trim());

        // Migrate only untouched legacy/default RED state. Never overwrite a human
        // blocker or a manually edited evidence/status decision.
        if (!manuallyTouched) {
          statuses[id] = "green";
          notes[id] = { evidence, updatedAt: stamp };
          changed = true;
        }
      }

      if (!changed) return;

      localStorage.setItem(STATUS_KEY, JSON.stringify(statuses));
      localStorage.setItem(NOTES_KEY, JSON.stringify(notes));

      // Delay the broadcast so the Command Center listener is mounted on the same load.
      timer = window.setTimeout(() => {
        try {
          const channel = new BroadcastChannel(CHANNEL_KEY);
          channel.postMessage({ type: "state", statuses, notes });
          channel.close();
        } catch {}
      }, 50);
    } catch {}

    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, []);

  return null;
}
