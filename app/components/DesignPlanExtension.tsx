"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import designData from "../design-plan-evidence.json";

type DesignStatus = "green" | "yellow" | "red";
type DesignTask = { id: string; group: string; title: string; status: DesignStatus; evidence: string };

const tasks = designData.tasks as DesignTask[];

export default function DesignPlanExtension() {
  const [sidePanel, setSidePanel] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | DesignStatus>("all");
  const [systemProgress, setSystemProgress] = useState<number | null>(null);
  const [systemNext, setSystemNext] = useState("loading...");

  useEffect(() => {
    const patch = () => {
      const panel = document.querySelector<HTMLElement>(".sidePanel");
      if (panel && panel !== sidePanel) setSidePanel(panel);

      const live = document.querySelector<HTMLElement>(".sideStatusBox .liveLine");
      if (live && live.dataset.enchevSystemLabel !== "1") {
        const dot = live.querySelector("i");
        live.replaceChildren();
        if (dot) live.appendChild(dot);
        live.appendChild(document.createTextNode(" SYSTEM"));
        live.dataset.enchevSystemLabel = "1";
      }

      const systemBox = document.querySelector<HTMLElement>(".sidePanel > .sideStatusBox:not(.designStatusBox)");
      if (systemBox) {
        systemBox.dataset.enchevSystemStatus = "1";
        const value = systemBox.querySelector<HTMLElement>("b")?.innerText?.trim() || "";
        const parsed = Number.parseInt(value.replace("%", ""), 10);
        if (Number.isFinite(parsed)) setSystemProgress(parsed);
      }

      const blocker = document.querySelector<HTMLElement>(".controlOverlay .nextGrid .nextCard b");
      if (blocker?.innerText) setSystemNext(blocker.innerText.trim());
    };

    patch();
    const observer = new MutationObserver(patch);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    const timer = window.setInterval(patch, 1200);
    return () => {
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, [sidePanel]);

  const totals = useMemo(() => {
    const x = { green: 0, yellow: 0, red: 0 };
    tasks.forEach((t) => x[t.status]++);
    return x;
  }, []);
  const progress = tasks.length ? Math.round((totals.green / tasks.length) * 100) : 0;
  const nextDesignTask = tasks.find((t) => t.status !== "green");
  const designNext = nextDesignTask ? `${nextDesignTask.id} · ${nextDesignTask.title}` : "All design points are GREEN";
  const summarySentence = `System is ${systemProgress ?? "—"}% ready, design is ${progress}%; next System: ${systemNext}, and Design: ${designNext}.`;

  const groups = useMemo(() => {
    const map = new Map<string, DesignTask[]>();
    tasks.filter((t) => filter === "all" || t.status === filter).forEach((t) => {
      if (!map.has(t.group)) map.set(t.group, []);
      map.get(t.group)!.push(t);
    });
    return Array.from(map.entries());
  }, [filter]);

  const openDesign = () => {
    const close = document.querySelector<HTMLButtonElement>(".sidePanel .iconButton");
    close?.click();
    setOpen(true);
  };

  const menuContent = sidePanel ? createPortal(<>
    <button
      onClick={openDesign}
      className="sideMenuItem"
      style={{ marginTop: 12, width: "100%", textAlign: "left" }}
    >
      <span className="sideMenuIcon">◇</span>
      <span>
        <b>Design Plan</b>
        <small>AutoBidMaster UX reference · ENCHEV identity · {progress}%</small>
      </span>
      <span>›</span>
    </button>

    <div className="sideStatusBox designStatusBox" style={{ marginTop: 12 }}>
      <div className="liveLine"><i/> DESIGN</div>
      <span>Design progress</span>
      <b>{progress}%</b>
      <div className="miniProgress"><i style={{ width: `${progress}%` }}/></div>
      <small>{totals.green} done · {totals.yellow} in progress · {totals.red} remaining</small>
    </div>

    <div className="sideStatusBox conciseStatusBox" style={{ marginTop: 12 }}>
      <div className="liveLine" style={{ color: "#cfd6dd" }}>SUMMARY</div>
      <p style={{ margin: "8px 0 0", color: "#d7dde3", fontSize: 12, lineHeight: 1.55 }}>
        {summarySentence}
      </p>
    </div>
  </>, sidePanel) : null;

  return <>
    {menuContent}
    {open ? <section className="controlOverlay" style={{ zIndex: 21000 }}>
      <header className="controlHeader">
        <div>
          <div className="eyebrow">DESIGN PLAN v{designData.version} · ENCHEV AUCTIONS</div>
          <h1>Enchev Auctions — Design Plan</h1>
          <p>We use proven AutoBidMaster UX patterns as a reference while keeping ENCHEV branding, code, copy, assets and visual identity original.</p>
        </div>
        <button className="closeControl" onClick={() => setOpen(false)}>×</button>
      </header>

      <div className="controlKpis">
        <div><span>DESIGN PROGRESS</span><b>{progress}%</b><small>{tasks.length} design points</small></div>
        <div className="kGreen"><span>DONE</span><b>{totals.green}</b><small>with evidence</small></div>
        <div className="kYellow"><span>IN PROGRESS</span><b>{totals.yellow}</b><small>partial / test</small></div>
        <div className="kRed"><span>REMAINING</span><b>{totals.red}</b><small>not proven</small></div>
        <div><span>REFERENCE</span><b style={{ fontSize: 14 }}>AUTOBIDMASTER</b><small>UX / IA research only</small></div>
      </div>

      <div className="nextGrid">
        <div className="nextCard"><span>NEXT DESIGN TASK</span><b>{designNext}</b></div>
        <div className="nextCard"><span>DESIGN CHAT SESSION</span><b>6aab25f8-e68c-83eb-ba1a-9e3fda3d5eb7</b></div>
        <div className="nextCard"><span>REFERENCE SITE</span><b><a href="https://www.autobidmaster.com/" target="_blank" rel="noreferrer" style={{ color: "inherit" }}>autobidmaster.com ↗</a></b></div>
      </div>

      <div className="controlTools">
        <div className="filterGroup">
          {(["all", "green", "yellow", "red"] as const).map((v) => <button key={v} className={filter === v ? "active" : ""} onClick={() => setFilter(v)}>{v === "all" ? "All" : v === "green" ? "Done" : v === "yellow" ? "In progress" : "Остава"}</button>)}
        </div>
        <div style={{ color: "#8e9aa6", fontSize: 12 }}>Source of truth: app/design-plan-evidence.json</div>
      </div>

      <div className="phaseList">
        {groups.map(([group, items]) => {
          const done = items.filter((x) => x.status === "green").length;
          const pct = items.length ? Math.round(done / items.length * 100) : 0;
          return <details className="phaseBlock" key={group} open>
            <summary className="phaseHead">
              <div><span>DESIGN</span><b>{group}</b><small>Original ENCHEV UX inspired by auction best practices</small></div>
              <div className="phaseCounts"><i className="greenDot">{done}</i><i className="yellowDot">{items.filter((x) => x.status === "yellow").length}</i><i className="redDot">{items.filter((x) => x.status === "red").length}</i><strong>{pct}%</strong></div>
            </summary>
            <div className="phaseTasks">
              {items.map((t) => <article key={t.id} className={`taskCard task-${t.status}`}>
                <div className="taskTop">
                  <div className="taskMain"><span className="taskId">{t.id}</span><span className="kind kind-global">DESIGN</span><b>{t.title}</b><small>{t.status === "green" ? "Done и доказано" : t.status === "yellow" ? "In progress / чака визуален тест" : "Pending implementation"}</small></div>
                  <div className="statusButtons"><button className={t.status === "green" ? "green" : ""}>DONE</button><button className={t.status === "yellow" ? "yellow" : ""}>IN PROGRESS</button><button className={t.status === "red" ? "red" : ""}>REMAINING</button></div>
                </div>
                <div className="taskDetails"><input readOnly value={t.evidence || ""} placeholder="Evidence will be added by DAVID/GPT after testing"/><span>Status comes from source-controlled design evidence</span></div>
              </article>)}
            </div>
          </details>;
        })}
      </div>

      <footer className="controlFooter"><b>Design rule:</b> AutoBidMaster is only a UX/IA reference. We do not copy third-party logos, assets, proprietary copy, source code or exact visual identity. DAVID follows D01 → D36 and updates evidence only after a real change + test.</footer>
    </section> : null}
  </>;
}