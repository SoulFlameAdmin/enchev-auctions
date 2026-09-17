"use client";

import { useCallback, useEffect, useState } from "react";

type WorkerStatus = {
  online?: boolean;
  mode?: string;
  workerRunning?: boolean;
  pid?: number | null;
  startedAt?: string | null;
  turnsSent?: number;
  relayAttempts?: number;
  recoveryAttempt?: number;
  watchdog?: string | null;
  pendingSince?: string | null;
  stopped?: boolean;
  stopReason?: string | null;
  lastAction?: string | null;
  stateUpdatedAt?: string | null;
  lastLog?: string | null;
};

const BRIDGE = "http://127.0.0.1:9445";

const watchdogLabel = (value?: string | null) => {
  switch (value) {
    case "monitoring": return "Следи ChatGPT";
    case "gpt-thinking": return "GPT мисли / генерира";
    case "gpt-writing": return "GPT започна нов отговор";
    case "waiting-for-gpt": return "Чака GPT да започне";
    case "waiting-for-complete-answer": return "Чака края на отговора";
    case "answer-complete": return "Отговорът е завършен";
    case "sending-relay": return "Праща relay за следващия етап";
    case "recovering-relay": return "Повтаря relay — GPT не тръгна";
    case "refreshing-chat": return "Refresh на ChatGPT и нов опит";
    case "blank-response-wait": return "Празен отговор — watchdog чака";
    case "unknown-ui": return "Неясно състояние — watchdog следи";
    case "response-started": return "GPT тръгна успешно";
    case "human-action": return "Чака човешко действие";
    case "blocked": return "Спрян от реален blocker";
    case "recovery-exhausted": return "Recovery опитите са изчерпани";
    default: return value || "Готов";
  }
};

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
    const timer = window.setInterval(refresh, 1200);
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
        window.setTimeout(refresh, 1800);
        window.setTimeout(refresh, 4200);
        return;
      }

      const endpoint = status.workerRunning ? "restart" : "start";
      const response = await fetch(`${BRIDGE}/${endpoint}`, { method: "POST", mode: "cors" });
      if (!response.ok) throw new Error(`DAVID ${endpoint} failed: ${response.status}`);
      window.setTimeout(refresh, 500);
      window.setTimeout(refresh, 1600);
    } catch {
      setBridgeError(true);
      window.location.href = "david-enchev://start";
      window.setTimeout(refresh, 2500);
    } finally {
      window.setTimeout(() => setBusy(false), 900);
    }
  };

  if (!visible) return null;

  const running = Boolean(status?.workerRunning);
  const label = busy
    ? "СТАРТИРАМ DAVID..."
    : running
      ? "РЕСТАРТИРАЙ DAVID"
      : bridgeError
        ? "ВКЛЮЧИ DAVID НА КОМПЮТЪРА"
        : "СТАРТИРАЙ DAVID НА КОМПЮТЪРА";

  const stateText = running
    ? "РАБОТИ НА ТОЗИ КОМПЮТЪР"
    : status?.stopped
      ? "СПРЯН ЗА ЧОВЕШКО ДЕЙСТВИЕ"
      : bridgeError
        ? "ЛОКАЛНИЯТ DAVID Е OFFLINE"
        : "СПРЯН";

  const actionText = status?.lastAction || status?.lastLog || (bridgeError
    ? "Натисни бутона — ще се стартира локалният DAVID controller."
    : "Готов за старт");

  return (
    <div style={{
      position: "fixed",
      top: 18,
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 20050,
      width: "min(820px, calc(100vw - 220px))",
      background: "rgba(7,11,15,.97)",
      border: "1px solid rgba(65,210,126,.38)",
      borderRadius: 16,
      boxShadow: "0 18px 60px rgba(0,0,0,.48)",
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
          <span> · relay опити: {status?.relayAttempts ?? 0}</span>
          {status?.pid ? <span> · PID {status.pid}</span> : null}
        </div>
        <div style={{ color: running ? "#5ee994" : "#a9b1ba", fontWeight: 800, whiteSpace: "nowrap" }}>
          WATCHDOG: {watchdogLabel(status?.watchdog)}
          {(status?.recoveryAttempt ?? 0) > 0 ? ` · recovery ${status?.recoveryAttempt}` : ""}
        </div>
      </div>

      <div style={{
        marginTop: 6,
        paddingTop: 6,
        borderTop: "1px solid rgba(255,255,255,.07)",
        display: "grid",
        gridTemplateColumns: "auto 1fr",
        gap: 8,
        alignItems: "center",
        fontSize: 11
      }}>
        <b style={{ color: "#7f8b96", letterSpacing: ".05em" }}>КАКВО ПРАВИ:</b>
        <span style={{ color: "#d3d9df", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {actionText}
        </span>
      </div>

      {status?.stopped && status.stopReason ? (
        <div style={{ marginTop: 7, color: "#ffca59", fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          Последно спиране: {status.stopReason}
        </div>
      ) : null}
    </div>
  );
}
