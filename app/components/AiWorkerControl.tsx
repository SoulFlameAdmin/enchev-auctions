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
    case "monitoring": return "Следи ChatGPT";
    case "gpt-thinking": return "GPT мисли / генерира";
    case "gpt-writing": return "GPT пише";
    case "response-started": return "GPT тръгна";
    case "sending-relay": return "Праща следващия етап";
    case "recovering-relay": return "Повтаря relay";
    case "refreshing-chat": return "Refresh и нов опит";
    case "stalled": return "GPT е забил — recovery";
    case "answer-complete": return "Етапът приключи";
    case "problem-detected": return "Засечен проблем";
    case "fixing-problem": return "Оправя проблема";
    case "problem-backoff": return "Нов fix след кратко изчакване";
    case "problem-fixed": return "Проблемът е оправен";
    case "human-blocked": return "Чака човешка намеса";
    case "platform-backoff": return "Платформен лимит";
    default: return value || "Готов";
  }
};

export default function AiWorkerControl() {
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<WorkerStatus | null>(null);
  const [nextTask, setNextTask] = useState("Чакам етапите...");
  const [wave, setWave] = useState("Чакам WAVE...");

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
  const stateText = running ? (hasProblem ? "AI РАБОТИ · ИМА ПРОБЛЕМ" : "AI РАБОТИ") : "AI НЕ РАБОТИ";
  const actionText = status?.lastAction || status?.lastLog || (running ? "AI е активен" : "Няма активна AI сесия");
  const syncText = status?.lastGitSync
    ? status.lastGitSync.ok
      ? "кодът е синхронизиран"
      : status.lastGitSync.skipped
        ? `sync пропуснат: ${status.lastGitSync.reason || "неизвестно"}`
        : "sync грешка"
    : "няма sync данни";

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
        }}>{running ? "AI РАБОТИ" : "AI НЕ РАБОТИ"}</div>
      </div>

      <div className="aiWorkerMeta" style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center", color: "#8e9aa6", fontSize: 11 }}>
        <div style={{ minWidth: 0 }}>
          <span style={{ color: "#cfd6dd", fontWeight: 700 }}>{wave}</span>
          <span> · цикли: {status?.turnsSent ?? 0}</span>
          <span> · relay: {status?.relayAttempts ?? 0}</span>
          {status?.pid ? <span> · PID {status.pid}</span> : null}
        </div>
        <div style={{ color: hasProblem ? "#ffc65e" : running ? "#5ee994" : "#ff858c", fontWeight: 800, whiteSpace: "nowrap" }}>
          WATCHDOG: {watchdogLabel(status?.watchdog)}
          {(status?.recoveryAttempt ?? 0) > 0 ? ` · recovery ${status?.recoveryAttempt}` : ""}
        </div>
      </div>

      <div className="aiWorkerAction" style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid rgba(255,255,255,.07)", display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 8, alignItems: "center", fontSize: 11 }}>
        <b style={{ color: "#7f8b96", letterSpacing: ".05em" }}>КАКВО ПРАВИ:</b>
        <span style={{ color: "#d3d9df", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{actionText}</span>
        <span style={{ color: status?.lastGitSync?.ok ? "#64e99a" : "#86929e", whiteSpace: "nowrap" }}>{syncText}</span>
      </div>

      {status?.problem ? (
        <div style={{ marginTop: 8, padding: "7px 9px", borderRadius: 9, background: "rgba(255,178,45,.10)", border: "1px solid rgba(255,178,45,.28)", color: "#ffd27a", fontSize: 11 }}>
          <b>ПРОБЛЕМ:</b> {status.problem}
          {(status.problemAttempts ?? 0) > 0 ? ` · DAVID fix опит ${status.problemAttempts}` : ""}
          {status.problemRetryAt ? ` · следващ опит ${new Date(status.problemRetryAt).toLocaleTimeString("bg-BG")}` : ""}
        </div>
      ) : status?.lastResult === "OK" ? (
        <div style={{ marginTop: 7, color: "#62e99a", fontSize: 11, fontWeight: 800 }}>ПОСЛЕДЕН РЕЗУЛТАТ: OK · продължава към следващия етап</div>
      ) : null}

      {status?.platformBlocker ? (
        <div style={{ marginTop: 7, color: "#ffca59", fontSize: 11 }}>
          Платформен blocker: {status.platformBlocker}
          {status.platformRetryAt ? ` · автоматичен нов опит: ${new Date(status.platformRetryAt).toLocaleTimeString("bg-BG")}` : ""}
        </div>
      ) : null}
    </div>
  );
}
