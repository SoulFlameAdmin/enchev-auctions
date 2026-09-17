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

  const menuCard = sidePanel ? createPortal(
    <button
      onClick={openDesign}
      className="sideMenuItem"
      style={{ marginTop: 12, width: "100%", textAlign: "left" }}
    >
      <span className="sideMenuIcon">◇</span>
      <span>
        <b>Дизайн план</b>
        <small>AutoBidMaster UX reference · ENCHEV identity · {progress}%</small>
      </span>
      <span>›</span>
    </button>,
    sidePanel
  ) : null;

  return <>
    {menuCard}
    {open ? <section className="controlOverlay" style={{ zIndex: 21000 }}>
      <header className="controlHeader">
        <div>
          <div className="eyebrow">DESIGN PLAN v{designData.version} · ENCHEV AUCTIONS</div>
          <h1>Enchev Auctions — Дизайн план</h1>
          <p>Следваме доказани UX модели от AutoBidMaster като референция, но запазваме оригинални ENCHEV бранд, код, текстове, assets и визуална идентичност.</p>
        </div>
        <button className="closeControl" onClick={() => setOpen(false)}>×</button>
      </header>

      <div className="controlKpis">
        <div><span>ДИЗАЙН ПРОГРЕС</span><b>{progress}%</b><small>{tasks.length} дизайн точки</small></div>
        <div className="kGreen"><span>ГОТОВО</span><b>{totals.green}</b><small>с evidence</small></div>
        <div className="kYellow"><span>РАБОТИ СЕ</span><b>{totals.yellow}</b><small>частично / тест</small></div>
        <div className="kRed"><span>ОСТАВА</span><b>{totals.red}</b><small>не е доказано</small></div>
        <div><span>REFERENCE</span><b style={{ fontSize: 14 }}>AUTOBIDMASTER</b><small>UX / IA research only</small></div>
      </div>

      <div className="nextGrid">
        <div className="nextCard"><span>NEXT DESIGN TASK</span><b>{tasks.find((t) => t.status !== "green")?.id || "DONE"} · {tasks.find((t) => t.status !== "green")?.title || "Всички дизайн точки са GREEN"}</b></div>
        <div className="nextCard"><span>DESIGN CHAT SESSION</span><b>6aab25f8-e68c-83eb-ba1a-9e3fda3d5eb7</b></div>
        <div className="nextCard"><span>REFERENCE SITE</span><b><a href="https://www.autobidmaster.com/" target="_blank" rel="noreferrer" style={{ color: "inherit" }}>autobidmaster.com ↗</a></b></div>
      </div>

      <div className="controlTools">
        <div className="filterGroup">
          {(["all", "green", "yellow", "red"] as const).map((v) => <button key={v} className={filter === v ? "active" : ""} onClick={() => setFilter(v)}>{v === "all" ? "Всички" : v === "green" ? "Готово" : v === "yellow" ? "Работи се" : "Остава"}</button>)}
        </div>
        <div style={{ color: "#8e9aa6", fontSize: 12 }}>Source of truth: app/design-plan-evidence.json</div>
      </div>

      <div className="phaseList">
        {groups.map(([group, items]) => {
          const done = items.filter((x) => x.status === "green").length;
          const pct = items.length ? Math.round(done / items.length * 100) : 0;
          return <details className="phaseBlock" key={group} open>
            <summary className="phaseHead">
              <div><span>DESIGN</span><b>{group}</b><small>Оригинален ENCHEV UX, вдъхновен от auction best practices</small></div>
              <div className="phaseCounts"><i className="greenDot">{done}</i><i className="yellowDot">{items.filter((x) => x.status === "yellow").length}</i><i className="redDot">{items.filter((x) => x.status === "red").length}</i><strong>{pct}%</strong></div>
            </summary>
            <div className="phaseTasks">
              {items.map((t) => <article key={t.id} className={`taskCard task-${t.status}`}>
                <div className="taskTop">
                  <div className="taskMain"><span className="taskId">{t.id}</span><span className="kind kind-global">DESIGN</span><b>{t.title}</b><small>{t.status === "green" ? "Готово и доказано" : t.status === "yellow" ? "Работи се / чака визуален тест" : "Остава за изпълнение"}</small></div>
                  <div className="statusButtons"><button className={t.status === "green" ? "green" : ""}>ГОТОВО</button><button className={t.status === "yellow" ? "yellow" : ""}>РАБОТИ СЕ</button><button className={t.status === "red" ? "red" : ""}>ОСТАВА</button></div>
                </div>
                <div className="taskDetails"><input readOnly value={t.evidence || ""} placeholder="Evidence ще се добави от DAVID/GPT след тест"/><span>Статусът идва от source-controlled design evidence</span></div>
              </article>)}
            </div>
          </details>;
        })}
      </div>

      <footer className="controlFooter"><b>Design правило:</b> AutoBidMaster е само UX/IA референция. Не копираме чужди logo, assets, proprietary copy, source code или точна визуална идентичност. DAVID следва D01 → D36 и обновява evidence само след реална промяна + тест.</footer>
    </section> : null}
  </>;
}
