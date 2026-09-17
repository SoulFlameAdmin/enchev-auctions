"use client";

import { useCallback, useEffect, useState } from "react";

type WorkerStatus = {
  online?: boolean;
  workerRunning?: boolean;
  pid?: number | null;
  startedAt?: string | null;
  turnsSent?: number;
  stopped?: boolean;
  stopReason?: string | null;
  lastLog?: string | null;
};

const BRIDGE = "http://127.0.0.1:9445";

export default function AiWorkerControl() {
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<WorkerStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [nextTask, setNextTask] = useState("Чакам етапите...");
  const [wave, setWave] = useState("Чакам WAVE...");
  const [bridgeError, setBridgeError] = useState(false);

  const readTracker = useCallback(() => {
    const cards = Array.from(document.querySelectorAll<HTMLElement>(".nextGrid .nextCard b"));
    if (cards[0]?.innerText) setNextTask(cards[0].innerText.trim());
    if (cards[1]?.innerText) setWave(cards[1].innerText.trim());
  }, []);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`${BRIDGE}/status`, { cache: "no-store", mode: "cors" });
      if (!response.ok) throw new Error(String(response.status));
      const data = await response.json();
      setStatus(data);
      setBridgeError(false);
    } catch {
      setStatus(null);
      setBridgeError(true);
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
    const timer = window.setInterval(refresh, 1600);
    refresh();
    return () => {
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, [readTracker, refresh]);

  const action = async () => {
    setBusy(true);
    try {
      if (!status?.online) {
        window.location.href = "david-enchev://start";
        window.setTimeout(refresh, 2200);
        return;
      }

      const endpoint = status.workerRunning ? "restart" : "start";
      await fetch(`${BRIDGE}/${endpoint}`, { method: "POST", mode: "cors" });
      window.setTimeout(refresh, 700);
    } finally {
      window.setTimeout(() => setBusy(false), 900);
    }
  };

  if (!visible) return null;

  const running = Boolean(status?.workerRunning);
  const label = busy
    ? "РАБОТЯ..."
    : running
      ? "РЕСТАРТИРАЙ AI WORKER"
      : bridgeError
        ? "ВКЛЮЧИ AI WORKER"
        : "СТАРТИРАЙ AI WORKER";

  const stateText = running
    ? "РАБОТИ"
    : status?.stopped
      ? "СПРЯН ЗА ЧОВЕШКО ДЕЙСТВИЕ"
      : bridgeError
        ? "ЛОКАЛНИЯТ КОНТРОЛЕР Е OFFLINE"
        : "СПРЯН";

  return (
    <div style={{
      position: "fixed",
      top: 18,
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 20050,
      width: "min(720px, calc(100vw - 220px))",
      background: "rgba(7,11,15,.96)",
      border: "1px solid rgba(65,210,126,.35)",
      borderRadius: 16,
      boxShadow: "0 18px 60px rgba(0,0,0,.45)",
      padding: "10px 14px 11px",
      backdropFilter: "blur(14px)",
      color: "#f6f8fa",
      fontFamily: "inherit"
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
          <span style={{
            width: 10,
            height: 10,
            borderRadius: 99,
            flex: "0 0 auto",
            background: running ? "#2bd66f" : status?.stopped ? "#ffbf2f" : "#ff4d57",
            boxShadow: running ? "0 0 14px rgba(43,214,111,.8)" : "none"
          }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, letterSpacing: ".09em", color: running ? "#53e68d" : "#a9b1ba", fontWeight: 800 }}>
              DAVID AI WORKER · {stateText}
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {nextTask}
            </div>
          </div>
        </div>

        <button
          onClick={action}
          disabled={busy}
          style={{
            border: running ? "1px solid #2bd66f" : "1px solid #f0b323",
            background: running ? "rgba(31,151,78,.18)" : "rgba(183,123,0,.15)",
            color: running ? "#72f0a4" : "#ffd35f",
            borderRadius: 11,
            padding: "10px 15px",
            fontSize: 12,
            fontWeight: 900,
            letterSpacing: ".04em",
            cursor: busy ? "wait" : "pointer",
            whiteSpace: "nowrap"
          }}
        >
          {label}
        </button>
      </div>

      <div style={{
        marginTop: 8,
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 10,
        alignItems: "center",
        color: "#8e9aa6",
        fontSize: 11
      }}>
        <div style={{ minWidth: 0 }}>
          <span style={{ color: "#cfd6dd", fontWeight: 700 }}>{wave}</span>
          <span> · цикли: {status?.turnsSent ?? 0}</span>
          {status?.pid ? <span> · PID {status.pid}</span> : null}
        </div>
        <div style={{ maxWidth: 310, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: "right" }}>
          {status?.lastLog || (bridgeError ? "Натисни бутона; при първи път браузърът може да поиска Open DAVID." : "Готов за старт")}
        </div>
      </div>

      {status?.stopped && status.stopReason ? (
        <div style={{ marginTop: 7, color: "#ffca59", fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          Последно спиране: {status.stopReason}
        </div>
      ) : null}
    </div>
  );
}
