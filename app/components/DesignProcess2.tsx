"use client";

import { useMemo, useState } from "react";
import process2 from "../design-process-2-evidence.json";

type Status = "green" | "yellow" | "red";
type Task = {
  id: string;
  group: string;
  title: string;
  status: Status;
  evidence?: string;
  blocker?: string;
  updatedAt?: string | null;
};

export default function DesignProcess2({open,onClose}:{open:boolean;onClose:()=>void}){
  const [filter,setFilter]=useState<"all"|Status>("all");
  const [query,setQuery]=useState("");
  const tasks=process2.tasks as Task[];
  const visible=useMemo(()=>{
    const q=query.trim().toLowerCase();
    return tasks.filter(task=>(filter==="all"||task.status===filter)&&(!q||`${task.id} ${task.group} ${task.title}`.toLowerCase().includes(q)));
  },[tasks,filter,query]);
  const groups=useMemo(()=>Array.from(new Set(tasks.map(task=>task.group))),[tasks]);
  const counts=useMemo(()=>({
    green:tasks.filter(t=>t.status==="green").length,
    yellow:tasks.filter(t=>t.status==="yellow").length,
    red:tasks.filter(t=>t.status==="red").length,
  }),[tasks]);
  const progress=tasks.length?Math.round((counts.green/tasks.length)*100):0;
  const next=tasks.find(t=>t.status!=="green");

  if(!open)return null;

  return <section className="controlOverlay" data-design-process="2">
    <header className="controlHeader">
      <div>
        <div className="eyebrow">ENCHEV DESIGN PROCESS 2 · WORLD-CLASS MOBILE + DESKTOP</div>
        <h1>Design Process 2</h1>
        <p>Новият premium redesign процес е отделен от завършения Design Plan V1. DAVID работи последователно по DP2-01 → DP2-30 и маркира GREEN само с implementation + test + evidence.</p>
      </div>
      <button className="closeControl" onClick={onClose} aria-label="Затвори Design Process 2">×</button>
    </header>

    <div className="controlKpis">
      <div><span>ПРОГРЕС</span><b>{progress}%</b><small>{tasks.length} DP2 задачи</small></div>
      <div className="kGreen"><span>GREEN</span><b>{counts.green}</b><small>доказано</small></div>
      <div className="kYellow"><span>YELLOW</span><b>{counts.yellow}</b><small>частично / чака proof</small></div>
      <div className="kRed"><span>RED</span><b>{counts.red}</b><small>не е завършено</small></div>
      <div><span>NEXT</span><b className="clockText">{next?.id||"COMPLETE"}</b><small>{next?.title||"Всичко е GREEN"}</small></div>
    </div>

    <div className="nextGrid">
      <div className="nextCard"><span>DAVID ACTIVE TARGET</span><b>{next?`${next.id} · ${next.title}`:"DESIGN PROCESS 2 COMPLETE"}</b></div>
      <div className="nextCard client"><span>ACCEPTANCE</span><b>Phone 360 / 390 / 430px · Desktop 1366 / 1440 / 1920-class · Chrome + Edge</b></div>
    </div>

    <div className="controlTools">
      <div className="filterGroup">{(["all","green","yellow","red"] as const).map(v=><button key={v} className={filter===v?"active":""} onClick={()=>setFilter(v)}>{v==="all"?"Всички":v.toUpperCase()}</button>)}</div>
      <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Търси DP2 задача..." aria-label="Търси в Design Process 2"/>
    </div>

    <div className="phaseList">
      {groups.map(group=>{
        const groupTasks=visible.filter(task=>task.group===group);
        if(!groupTasks.length)return null;
        const allGroup=tasks.filter(task=>task.group===group);
        const green=allGroup.filter(task=>task.status==="green").length;
        const yellow=allGroup.filter(task=>task.status==="yellow").length;
        const red=allGroup.length-green-yellow;
        const pct=Math.round((green/allGroup.length)*100);
        return <details className="phaseBlock" key={group} open>
          <summary className="phaseHead">
            <div><span>DESIGN PROCESS 2</span><b>{group}</b><small>Dependency-safe premium redesign</small></div>
            <div className="phaseCounts"><i className="greenDot">{green}</i><i className="yellowDot">{yellow}</i><i className="redDot">{red}</i><strong>{pct}%</strong></div>
          </summary>
          <div className="phaseTasks">
            {groupTasks.map(task=><article className={`taskCard task-${task.status}`} key={task.id}>
              <div className="taskTop">
                <div className="taskMain">
                  <span className="taskId">{task.id}</span>
                  <b>{task.title}</b>
                  <small>{task.status==="green"?"Implementation + test + evidence":task.status==="yellow"?"Partial / pending proof / blocker":"Not completed"}</small>
                </div>
                <div className="statusButtons"><button className={task.status}>{task.status.toUpperCase()}</button></div>
              </div>
              {(task.evidence||task.blocker)&&<div className="taskDetails">
                <input readOnly value={task.evidence||""} placeholder="Evidence ще се попълни от DAVID"/>
                <input readOnly value={task.blocker||""} placeholder="Няма blocker"/>
                <span>{task.updatedAt?`Update ${new Date(task.updatedAt).toLocaleString("bg-BG")}`:"No update yet"}</span>
              </div>}
            </article>)}
          </div>
        </details>;
      })}
    </div>

    <footer className="controlFooter"><b>Process 2 law:</b> V1 остава frozen. DP2 задачите се изпълняват DP2-01 → DP2-30. GREEN само с evidence. Не се създава DP2-31 автоматично. Source of truth: docs/DESIGN_PROCESS_2.md + app/design-process-2-evidence.json.</footer>
  </section>;
}
