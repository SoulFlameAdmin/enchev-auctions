"use client";

import { useEffect, useMemo, useState } from "react";

type Status = "green" | "yellow" | "red";
type Task = { id: string; label: string; defaultStatus: Status };
type Phase = { id: string; title: string; tasks: Task[] };

const phases: Phase[] = [
  { id: "00", title: "Сделка и scope", tasks: [
    { id: "00.01", label: "Заключване на Phase 1 MVP scope", defaultStatus: "yellow" },
    { id: "00.02", label: "Плащане €10k на 40/30/30", defaultStatus: "yellow" },
    { id: "00.03", label: "Exclusions + Change Request правило", defaultStatus: "yellow" },
    { id: "00.04", label: "Client-owned provider accounts", defaultStatus: "yellow" },
  ]},
  { id: "01", title: "Clean foundation", tasks: [
    { id: "01.01", label: "Private GitHub repo enchev-auctions", defaultStatus: "green" },
    { id: "01.02", label: "Clean Next.js base", defaultStatus: "green" },
    { id: "01.03", label: "Vercel project enchev-auctions", defaultStatus: "green" },
    { id: "01.04", label: "GitHub → Vercel auto deploy", defaultStatus: "green" },
    { id: "01.05", label: "Supabase project", defaultStatus: "red" },
    { id: "01.06", label: "Redis environment", defaultStatus: "red" },
    { id: "01.07", label: "CI lint/typecheck/test/build", defaultStatus: "red" },
    { id: "01.08", label: "Web/API/realtime health checks", defaultStatus: "red" },
  ]},
  { id: "02", title: "Identity & access", tasks: [
    { id: "02.01", label: "Supabase Auth", defaultStatus: "red" },
    { id: "02.02", label: "Buyer/Seller/Admin roles", defaultStatus: "red" },
    { id: "02.03", label: "RBAC permissions", defaultStatus: "red" },
    { id: "02.04", label: "Admin MFA", defaultStatus: "red" },
    { id: "02.05", label: "Legal acceptance versioning", defaultStatus: "red" },
    { id: "02.06", label: "Audit log foundation", defaultStatus: "red" },
  ]},
  { id: "03", title: "KYC / KYB / eligibility", tasks: [
    { id: "03.01", label: "KYC provider abstraction", defaultStatus: "red" },
    { id: "03.02", label: "KYB provider abstraction", defaultStatus: "red" },
    { id: "03.03", label: "Buyer eligibility engine", defaultStatus: "red" },
    { id: "03.04", label: "Seller verification flow", defaultStatus: "red" },
    { id: "03.05", label: "Compliance holds", defaultStatus: "red" },
  ]},
  { id: "04", title: "Vehicles", tasks: [
    { id: "04.01", label: "Vehicle CRUD", defaultStatus: "red" },
    { id: "04.02", label: "VIN / make / model / trim / year", defaultStatus: "red" },
    { id: "04.03", label: "Condition / damage / odometer", defaultStatus: "red" },
    { id: "04.04", label: "Secure images/documents", defaultStatus: "red" },
    { id: "04.05", label: "Data provenance", defaultStatus: "red" },
    { id: "04.06", label: "Seller submit → Admin review → Publish", defaultStatus: "red" },
    { id: "04.07", label: "Public vehicle page + search/filter", defaultStatus: "red" },
  ]},
  { id: "05", title: "Auction setup", tasks: [
    { id: "05.01", label: "Auction types and state machine", defaultStatus: "red" },
    { id: "05.02", label: "Versioned auction rules", defaultStatus: "red" },
    { id: "05.03", label: "Bid increment config", defaultStatus: "red" },
    { id: "05.04", label: "Reserve / seller approval / buy now", defaultStatus: "red" },
    { id: "05.05", label: "Immutable auction-start snapshot", defaultStatus: "red" },
  ]},
  { id: "06", title: "Pre-Bid & Max Bid", tasks: [
    { id: "06.01", label: "Atomic Pre-Bid transaction", defaultStatus: "red" },
    { id: "06.02", label: "Private Max Bid / proxy engine", defaultStatus: "red" },
    { id: "06.03", label: "Deterministic tie rule", defaultStatus: "red" },
    { id: "06.04", label: "Idempotency / duplicate protection", defaultStatus: "red" },
    { id: "06.05", label: "Bidding power enforcement", defaultStatus: "red" },
  ]},
  { id: "07", title: "Live realtime auction", tasks: [
    { id: "07.01", label: "Persistent WebSocket service", defaultStatus: "red" },
    { id: "07.02", label: "Realtime auction rooms/events", defaultStatus: "red" },
    { id: "07.03", label: "Reconnect + sequence-gap recovery", defaultStatus: "red" },
    { id: "07.04", label: "Server-authoritative clock", defaultStatus: "red" },
    { id: "07.05", label: "Late-bid extension", defaultStatus: "red" },
  ]},
  { id: "08", title: "Finalization & winner", tasks: [
    { id: "08.01", label: "Exactly-once close worker", defaultStatus: "red" },
    { id: "08.02", label: "Winner determination", defaultStatus: "red" },
    { id: "08.03", label: "Reserve/seller approval results", defaultStatus: "red" },
    { id: "08.04", label: "Immutable event history", defaultStatus: "red" },
    { id: "08.05", label: "Exceptional reversal / void flow", defaultStatus: "red" },
  ]},
  { id: "09", title: "Finance core", tasks: [
    { id: "09.01", label: "Double-entry immutable ledger", defaultStatus: "red" },
    { id: "09.02", label: "Deposit state machine", defaultStatus: "red" },
    { id: "09.03", label: "Bidding power projection", defaultStatus: "red" },
    { id: "09.04", label: "Exposure tracking", defaultStatus: "red" },
    { id: "09.05", label: "Versioned fee schedules", defaultStatus: "red" },
  ]},
  { id: "10", title: "Invoice & payments", tasks: [
    { id: "10.01", label: "Invoice generation + snapshot", defaultStatus: "red" },
    { id: "10.02", label: "Bank transfer flow", defaultStatus: "red" },
    { id: "10.03", label: "Payment provider adapter", defaultStatus: "red" },
    { id: "10.04", label: "Webhook idempotency", defaultStatus: "red" },
    { id: "10.05", label: "Refund / adjustment controls", defaultStatus: "red" },
  ]},
  { id: "11", title: "Release & logistics", tasks: [
    { id: "11.01", label: "Release gates: payment/compliance/docs", defaultStatus: "red" },
    { id: "11.02", label: "Pickup authorization", defaultStatus: "red" },
    { id: "11.03", label: "Single-use pickup code", defaultStatus: "red" },
    { id: "11.04", label: "Transport provider abstraction", defaultStatus: "red" },
    { id: "11.05", label: "Storage deadlines/charges hooks", defaultStatus: "red" },
  ]},
  { id: "12", title: "Admin & operations", tasks: [
    { id: "12.01", label: "Admin dashboard", defaultStatus: "red" },
    { id: "12.02", label: "Verification / vehicles / auctions queues", defaultStatus: "red" },
    { id: "12.03", label: "Finance / payments / release queues", defaultStatus: "red" },
    { id: "12.04", label: "Support tickets / complaints", defaultStatus: "red" },
    { id: "12.05", label: "Dispute/evidence freeze", defaultStatus: "red" },
    { id: "12.06", label: "Feature flags / configuration", defaultStatus: "red" },
  ]},
  { id: "13", title: "Legal & privacy", tasks: [
    { id: "13.01", label: "Terms / Buyer / Seller / Fees / Condition", defaultStatus: "red" },
    { id: "13.02", label: "Privacy + Cookies/CMP", defaultStatus: "red" },
    { id: "13.03", label: "Seller-of-record / platform-role disclosure", defaultStatus: "red" },
    { id: "13.04", label: "KYC / marketplace / AI transparency", defaultStatus: "red" },
    { id: "13.05", label: "Country legal launch gate", defaultStatus: "red" },
  ]},
  { id: "14", title: "Security", tasks: [
    { id: "14.01", label: "Authorization abuse tests", defaultStatus: "red" },
    { id: "14.02", label: "Rate limits / anti-bot", defaultStatus: "red" },
    { id: "14.03", label: "Secrets / least privilege / key rotation", defaultStatus: "red" },
    { id: "14.04", label: "Secure uploads", defaultStatus: "red" },
    { id: "14.05", label: "External penetration test", defaultStatus: "red" },
  ]},
  { id: "15", title: "Reliability & observability", tasks: [
    { id: "15.01", label: "Structured logs / metrics / traces", defaultStatus: "red" },
    { id: "15.02", label: "Auction/payment alerts", defaultStatus: "red" },
    { id: "15.03", label: "Backups", defaultStatus: "red" },
    { id: "15.04", label: "Restore drill", defaultStatus: "red" },
    { id: "15.05", label: "Disaster recovery runbook", defaultStatus: "red" },
  ]},
  { id: "16", title: "Load & concurrency", tasks: [
    { id: "16.01", label: "10/50/100 bidder tests", defaultStatus: "red" },
    { id: "16.02", label: "500+ bidder stress test", defaultStatus: "red" },
    { id: "16.03", label: "Database contention tests", defaultStatus: "red" },
    { id: "16.04", label: "WebSocket fanout/reconnect stress", defaultStatus: "red" },
    { id: "16.05", label: "No winner corruption under load", defaultStatus: "red" },
  ]},
  { id: "17", title: "Closed pilot", tasks: [
    { id: "17.01", label: "Seller → Vehicle → Auction", defaultStatus: "red" },
    { id: "17.02", label: "Two buyers → Live bid → Winner", defaultStatus: "red" },
    { id: "17.03", label: "Invoice → Payment → Release", defaultStatus: "red" },
    { id: "17.04", label: "Restart during live auction", defaultStatus: "red" },
    { id: "17.05", label: "Complaint reconstruction", defaultStatus: "red" },
    { id: "17.06", label: "Pilot sign-off", defaultStatus: "red" },
  ]},
  { id: "18", title: "Real providers", tasks: [
    { id: "18.01", label: "Production KYC/KYB provider", defaultStatus: "red" },
    { id: "18.02", label: "Production payment provider", defaultStatus: "red" },
    { id: "18.03", label: "Production email/SMS", defaultStatus: "red" },
    { id: "18.04", label: "VIN/history provider if used", defaultStatus: "red" },
  ]},
  { id: "19", title: "First market launch", tasks: [
    { id: "19.01", label: "CountryProfile configured", defaultStatus: "red" },
    { id: "19.02", label: "Fees/tax/payment rules finalized", defaultStatus: "red" },
    { id: "19.03", label: "Real controlled inventory", defaultStatus: "red" },
    { id: "19.04", label: "Controlled buyer cohort", defaultStatus: "red" },
    { id: "19.05", label: "First real completed transaction", defaultStatus: "red" },
  ]},
  { id: "20", title: "International scale", tasks: [
    { id: "20.01", label: "Country #2 activation", defaultStatus: "red" },
    { id: "20.02", label: "Additional PSP/KYC/logistics adapters", defaultStatus: "red" },
    { id: "20.03", label: "Languages/localization expansion", defaultStatus: "red" },
    { id: "20.04", label: "Regional scaling/CDN/read strategy", defaultStatus: "red" },
  ]},
  { id: "21", title: "AI & advanced", tasks: [
    { id: "21.01", label: "AI natural-language search", defaultStatus: "red" },
    { id: "21.02", label: "AI support assistant", defaultStatus: "red" },
    { id: "21.03", label: "AI vehicle summaries", defaultStatus: "red" },
    { id: "21.04", label: "Visual damage assistant", defaultStatus: "red" },
  ]},
  { id: "22", title: "Mature platform", tasks: [
    { id: "22.01", label: "Seller settlement automation", defaultStatus: "red" },
    { id: "22.02", label: "Advanced fraud/risk engine", defaultStatus: "red" },
    { id: "22.03", label: "B2B API / white-label", defaultStatus: "red" },
    { id: "22.04", label: "Native apps if justified", defaultStatus: "red" },
  ]},
];

const STORAGE_KEY = "enchev-auctions-stage-status-v1";

function initialStatuses() {
  const map: Record<string, Status> = {};
  phases.forEach((phase) => phase.tasks.forEach((task) => (map[task.id] = task.defaultStatus)));
  return map;
}

export default function StageTracker() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [stagesOpen, setStagesOpen] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, Status>>(initialStatuses);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setStatuses((current) => ({ ...current, ...JSON.parse(saved) }));
      } catch {}
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(statuses));
  }, [statuses]);

  useEffect(() => {
    document.body.style.overflow = stagesOpen || menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [stagesOpen, menuOpen]);

  const allTasks = useMemo(() => phases.flatMap((p) => p.tasks), []);
  const counts = useMemo(() => ({
    green: allTasks.filter((t) => statuses[t.id] === "green").length,
    yellow: allTasks.filter((t) => statuses[t.id] === "yellow").length,
    red: allTasks.filter((t) => statuses[t.id] === "red").length,
  }), [allTasks, statuses]);
  const progress = Math.round((counts.green / allTasks.length) * 100);
  const nextTask = allTasks.find((t) => statuses[t.id] !== "green");

  const setStatus = (id: string, status: Status) => {
    setStatuses((current) => ({ ...current, [id]: status }));
  };

  const resetPlan = () => {
    if (!window.confirm("Да върна ли всички статуси към началното състояние?")) return;
    setStatuses(initialStatuses());
  };

  return (
    <>
      <button className="burgerButton" aria-label="Отвори меню" onClick={() => setMenuOpen(true)}>
        <span /><span /><span />
      </button>

      {menuOpen && <button className="menuBackdrop" aria-label="Затвори меню" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidePanel ${menuOpen ? "sidePanelOpen" : ""}`}>
        <div className="sidePanelTop">
          <div>
            <div className="miniLabel">ENCHEV AUCTIONS</div>
            <strong>Control Center</strong>
          </div>
          <button className="iconButton" onClick={() => setMenuOpen(false)} aria-label="Затвори">×</button>
        </div>
        <button className="sideMenuItem" onClick={() => { setMenuOpen(false); setStagesOpen(true); }}>
          <span className="sideMenuIcon">◫</span>
          <span><b>Етапи</b><small>Пълен план 0 → 100%</small></span>
          <span>›</span>
        </button>
        <div className="sideStatusBox">
          <span>Общ прогрес</span><b>{progress}%</b>
          <div className="miniProgress"><i style={{ width: `${progress}%` }} /></div>
          <small>{counts.green} успешни · {counts.yellow} в процес · {counts.red} липсват</small>
        </div>
      </aside>

      {stagesOpen && (
        <section className="stagesOverlay" role="dialog" aria-modal="true" aria-label="Етапи на проекта">
          <header className="stagesHeader">
            <div>
              <div className="miniLabel">MASTER CONTROL</div>
              <h2>Етапи 0 → 100%</h2>
              <p>Зелено = работи и е тествано · Жълто = тест/грешка/чака · Червено = липсва</p>
            </div>
            <button className="closeStages" onClick={() => setStagesOpen(false)} aria-label="Затвори">×</button>
          </header>

          <div className="stagesSummary">
            <div><span>Прогрес</span><b>{progress}%</b></div>
            <div className="summaryGreen"><span>Работи</span><b>{counts.green}</b></div>
            <div className="summaryYellow"><span>Тест / грешка</span><b>{counts.yellow}</b></div>
            <div className="summaryRed"><span>Липсва</span><b>{counts.red}</b></div>
          </div>

          <div className="nextTaskBanner">
            <span>СЛЕДВАЩА СТЪПКА</span>
            <b>{nextTask ? `${nextTask.id} · ${nextTask.label}` : "Всичко е завършено"}</b>
          </div>

          <div className="stageProgressTrack"><i style={{ width: `${progress}%` }} /></div>

          <div className="phasesList">
            {phases.map((phase) => {
              const phaseDone = phase.tasks.filter((t) => statuses[t.id] === "green").length;
              const phasePercent = Math.round((phaseDone / phase.tasks.length) * 100);
              return (
                <details className="phaseBlock" key={phase.id} open={phase.id === "01"}>
                  <summary>
                    <span className="phaseNumber">{phase.id}</span>
                    <span className="phaseTitle">{phase.title}</span>
                    <span className="phasePercent">{phasePercent}%</span>
                  </summary>
                  <div className="phaseTasks">
                    {phase.tasks.map((task) => {
                      const status = statuses[task.id] || task.defaultStatus;
                      return (
                        <div className={`taskRow task-${status}`} key={task.id}>
                          <div className="taskId">{task.id}</div>
                          <div className="taskName">
                            <span className={`statusDot ${status}`} />
                            <b>{task.label}</b>
                          </div>
                          <div className="taskControls" aria-label={`Статус за ${task.label}`}>
                            <button className={status === "green" ? "activeGreen" : ""} onClick={() => setStatus(task.id, "green")}>Работи</button>
                            <button className={status === "yellow" ? "activeYellow" : ""} onClick={() => setStatus(task.id, "yellow")}>Тест / грешка</button>
                            <button className={status === "red" ? "activeRed" : ""} onClick={() => setStatus(task.id, "red")}>Липсва</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </details>
              );
            })}
          </div>

          <footer className="stagesFooter">
            <span>Статусите се пазят локално в този браузър.</span>
            <button onClick={resetPlan}>Reset statuses</button>
          </footer>
        </section>
      )}
    </>
  );
}
