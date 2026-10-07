"use client";

import { useCallback, useEffect, useState } from "react";

type WorkerStatus = {
  online?: boolean;
  workerVersion?: string | null;
  workerRunning?: boolean;
  pid?: number | null;
  lastGitSync?: { ok?: boolean; skipped?: boolean; reason?: string; at?: string } | null;
  turnsSent?: number;
  relayAttempts?: number;
  recoveryAttempt?: number;
  watchdog?: string | null;
  problem?: string | null;
  problemAttempts?: number;
  problemRetryAt?: string | null;
  platformBlocker?: string | null;
  platformRetryAt?: string | null;
  lastResult?: string | null;
  lastAction?: string | null;
  lastLog?: string | null;
};

const BRIDGE = "http://127.0.0.1:9445";

const watchdogLabel = (value?: string | null) => {
  switch (value) {
    case "monitoring": return "Monitoring ChatGPT";
    case "gpt-thinking": return "GPT thinking / generating";
    case "gpt-writing": return "GPT writing";
    case "response-started": return "GPT response started";
    case "sending-relay": return "Sending next stage";
    case "recovering-relay": return "Retrying relay";
    case "refreshing-chat": return "Refresh and retry";
    case "stalled": return "GPT stalled — recovery";
    case "answer-complete": return "Stage complete";
    case "problem-detected": return "Problem detected";
    case "fixing-problem": return "Fixing problem";
    case "problem-backoff": return "New fix after short backoff";
    case "problem-fixed": return "Problem fixed";
    case "human-blocked": return "Waiting for human intervention";
    case "platform-backoff": return "Platform limit";
    default: return value || "Ready";
  }
};

export default function AiWorkerControl() {
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<WorkerStatus | null>(null);
  const [nextTask, setNextTask] = useState("Waiting for stages...");
  const [wave, setWave] = useState("Waiting for WAVE...");

  const readTracker = useCallback(() => {
    const cards = Array.from(document.querySelectorAll<HTMLElement>(".nextGrid .nextCard b"));
    if (cards[0]?.innerText) setNextTask(cards[0].innerText.trim());
    if (cards[1]?.innerText) setWave(cards[1].innerText.trim());
  }, []);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`${BRIDGE}/status`, { cache: "no-store", mode: "cors" });
      if (!response.ok) throw new Error(String(response.status));
      setStatus(await response.json());
    } catch {
      setStatus(null);
    }
    readTracker();
  }, [readTracker]);

  useEffect(() => {
    const syncVisibility = () => {
      setVisible(Boolean(document.querySelector(".controlOverlay")));
      readTracker();
    };
    syncVisibility();
    const observer = new MutationObserver(syncVisibility);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    const timer = window.setInterval(refresh, 1000);
    refresh();
    return () => {
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, [readTracker, refresh]);

  if (!visible) return null;

  const running = Boolean(status?.online && status?.workerRunning);
  const hasProblem = Boolean(status?.problem || status?.platformBlocker);
  const stateText = running ? (hasProblem ? "AI WORKING · PROBLEM DETECTED" : "AI WORKING") : "AI NOT WORKING";
  const actionText = status?.lastAction || status?.lastLog || (running ? "AI is active" : "No active AI session");
  const syncText = status?.lastGitSync
    ? status.lastGitSync.ok
      ? "code synchronized"
      : status.lastGitSync.skipped
        ? `sync skipped: ${status.lastGitSync.reason || "unknown"}`
        : "sync error"
    : "no sync data";

  return (
    <div className="aiWorkerStatus" style={{
      position: "fixed",
      top: 18,
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 20050,
      width: "min(900px, calc(100vw - 24px))",
      background: "rgba(7,11,15,.97)",
      border: hasProblem ? "1px solid rgba(255,178,45,.72)" : running ? "1px solid rgba(65,210,126,.38)" : "1px solid rgba(255,77,87,.34)",
      borderRadius: 16,
      boxShadow: "0 18px 60px rgba(0,0,0,.48)",
      padding: "10px 14px 11px",
      backdropFilter: "blur(14px)",
      color: "#f6f8fa",
      fontFamily: "inherit"
    }}>
      <div className="aiWorkerStatusTop" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
          <span style={{
            width: 10,
            height: 10,
            borderRadius: 99,
            flex: "0 0 auto",
            background: running ? (hasProblem ? "#ffb22d" : "#2bd66f") : "#ff4d57",
            boxShadow: running ? (hasProblem ? "0 0 14px rgba(255,178,45,.75)" : "0 0 14px rgba(43,214,111,.8)") : "0 0 12px rgba(255,77,87,.45)"
          }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, letterSpacing: ".09em", color: hasProblem ? "#ffc65e" : running ? "#53e68d" : "#ff7a82", fontWeight: 900 }}>
              {stateText}{status?.workerVersion ? ` · v${status.workerVersion}` : ""}
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {nextTask}
            </div>
          </div>
        </div>
        <div className="aiWorkerBadge" style={{
          border: running ? "1px solid #2bd66f" : "1px solid #ff4d57",
          background: running ? "rgba(31,151,78,.16)" : "rgba(255,77,87,.10)",
          color: running ? "#72f0a4" : "#ff858c",
          borderRadius: 999,
          padding: "8px 12px",
          fontSize: 11,
          fontWeight: 900,
          letterSpacing: ".04em",
          whiteSpace: "nowrap"
        }}>{running ? "AI WORKING" : "AI NOT WORKING"}</div>
      </div>

      <div className="aiWorkerMeta" style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center", color: "#8e9aa6", fontSize: 11 }}>
        <div style={{ minWidth: 0 }}>
          <span style={{ color: "#cfd6dd", fontWeight: 700 }}>{wave}</span>
          <span> · cycles: {status?.turnsSent ?? 0}</span>
          <span> · relay: {status?.relayAttempts ?? 0}</span>
          {status?.pid ? <span> · PID {status.pid}</span> : null}
        </div>
        <div style={{ color: hasProblem ? "#ffc65e" : running ? "#5ee994" : "#ff858c", fontWeight: 800, whiteSpace: "nowrap" }}>
          WATCHDOG: {watchdogLabel(status?.watchdog)}
          {(status?.recoveryAttempt ?? 0) > 0 ? ` · recovery ${status?.recoveryAttempt}` : ""}
        </div>
      </div>

      <div className="aiWorkerAction" style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid rgba(255,255,255,.07)", display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 8, alignItems: "center", fontSize: 11 }}>
        <b style={{ color: "#7f8b96", letterSpacing: ".05em" }}>CURRENT ACTION:</b>
        <span style={{ color: "#d3d9df", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{actionText}</span>
        <span style={{ color: status?.lastGitSync?.ok ? "#64e99a" : "#86929e", whiteSpace: "nowrap" }}>{syncText}</span>
      </div>

      {status?.problem ? (
        <div style={{ marginTop: 8, padding: "7px 9px", borderRadius: 9, background: "rgba(255,178,45,.10)", border: "1px solid rgba(255,178,45,.28)", color: "#ffd27a", fontSize: 11 }}>
          <b>PROBLEM:</b> {status.problem}
          {(status.problemAttempts ?? 0) > 0 ? ` · DAVID fix attempt ${status.problemAttempts}` : ""}
          {status.problemRetryAt ? ` · next attempt ${new Date(status.problemRetryAt).toLocaleTimeString("en-GB")}` : ""}
        </div>
      ) : status?.lastResult === "OK" ? (
        <div style={{ marginTop: 7, color: "#62e99a", fontSize: 11, fontWeight: 800 }}>LAST RESULT: OK · continuing to next stage</div>
      ) : null}

      {status?.platformBlocker ? (
        <div style={{ marginTop: 7, color: "#ffca59", fontSize: 11 }}>
          Platform blocker: {status.platformBlocker}
          {status.platformRetryAt ? ` · automatic retry: ${new Date(status.platformRetryAt).toLocaleTimeString("en-GB")}` : ""}
        </div>
      ) : null}
    </div>
  );
}
