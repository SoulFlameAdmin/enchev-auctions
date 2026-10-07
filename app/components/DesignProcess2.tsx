"use client";

import { useMemo, useState } from "react";
import process2 from "../design-process-2-evidence.json";

type Status = "green" | "yellow" | "red";

const DP2_BG_GROUPS: Record<string,string> = {
  "Foundation":"Основа",
  "Homepage":"Начална страница",
  "Inventory":"Инвентар",
  "Vehicle detail":"Детайли за автомобил",
  "LIVE auction":"Търг на живо",
  "Buyer workspace":"Работно пространство на купувача",
  "Responsive & accessibility":"Адаптивност и достъпност",
  "Polish & certification":"Финална полировка и сертифициране"
};

const DP2_BG_TITLES: Record<string,string> = {
  "DP2-01":"Одит на текущия UX/UI и доклад за пропуските",
  "DP2-02":"Премиум дизайн токени на ENCHEV",
  "DP2-03":"Типография, отстояния, плътност и адаптивна мрежа",
  "DP2-04":"Единна адаптивна обвивка на приложението и навигация",
  "DP2-05":"Премиум композиция на началния екран и ясно стойностно предложение",
  "DP2-06":"Търсене, бързо откриване и преки категории",
  "DP2-07":"Карти на избрани автомобили и йерархия на състоянието на търга",
  "DP2-08":"Доверие, процес, логистика, поддръжка и финален призив за действие",
  "DP2-09":"Информационна архитектура за търсене/филтри и система за филтри на компютър",
  "DP2-10":"Мобилен панел за филтри и работа с активни филтри",
  "DP2-11":"Премиум карти в инвентара и режими мрежа/списък",
  "DP2-12":"Сортиране, странициране, брой резултати, запазени действия и празни състояния",
  "DP2-13":"Галерия, миниатюри, увеличение/преглед и медийна йерархия",
  "DP2-14":"Заглавие, идентификатори, характеристики, щети, документи и йерархия на състоянието",
  "DP2-15":"Панел за наддаване/Купи сега и фиксиран адаптивен призив за действие",
  "DP2-16":"История, такси и контекст, транспорт, подобни автомобили и доверие",
  "DP2-17":"Композиция и визуален приоритет на сцената за търг на живо",
  "DP2-18":"Състояния при оферта и безопасност на действията",
  "DP2-19":"Следващ лот, опашка, продадени резултати и непрекъснатост",
  "DP2-20":"Таймер, връзка, повторно свързване и увереност при остаряло състояние",
  "DP2-21":"Обвивка на профила/таблото и навигация на профила",
  "DP2-22":"Запазени автомобили и Моите търгове",
  "DP2-23":"Последователност между поддръжка, транспорт, история и профил",
  "DP2-24":"Приемане на телефон при 360/390/430px",
  "DP2-25":"Приемане на таблет и компютър при 768px–1920px+",
  "DP2-26":"Клавиатура, фокус, контраст, увеличение, намалено движение и размери за докосване",
  "DP2-27":"Състояния при зареждане, празно, грешка, офлайн и успех и последователност на текста",
  "DP2-28":"Дизайн, ориентиран към производителност и стабилност на оформлението",
  "DP2-29":"Визуална регресия в Chrome и Edge на компютър и телефон",
  "DP2-30":"Финална последователност, оригиналност и продукционно приемане на ENCHEV"
};


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
        <div className="eyebrow">ENCHEV ДИЗАЙН ПРОЦЕС 2 · ПРЕМИУМ МОБИЛЕН + КОМПЮТЪРЕН ИЗГЛЕД</div>
        <h1>Дизайн процес 2</h1>
        <p>Новият премиум процес за редизайн е отделен от завършения Дизайн план V1. DAVID работи последователно по DP2-01 → DP2-30 и маркира ЗЕЛЕНО само при имплементация + тест + доказателство.</p>
      </div>
      <button className="closeControl" onClick={onClose} aria-label="Затвори Дизайн процес 2">×</button>
    </header>

    <div className="controlKpis">
      <div><span>ПРОГРЕС</span><b>{progress}%</b><small>{tasks.length} DP2 задачи</small></div>
      <div className="kGreen"><span>ЗЕЛЕНО</span><b>{counts.green}</b><small>доказано</small></div>
      <div className="kYellow"><span>ЖЪЛТО</span><b>{counts.yellow}</b><small>частично / чака доказателство</small></div>
      <div className="kRed"><span>ЧЕРВЕНО</span><b>{counts.red}</b><small>не е завършено</small></div>
      <div><span>СЛЕДВАЩО</span><b className="clockText">{next?.id||"ЗАВЪРШЕНО"}</b><small>{next?DP2_BG_TITLES[next.id]||next.title:"Всичко е ЗЕЛЕНО"}</small></div>
    </div>

    <div className="nextGrid">
      <div className="nextCard"><span>АКТИВНА ЦЕЛ НА DAVID</span><b>{next?`${next.id} · ${DP2_BG_TITLES[next.id]||next.title}`:"ДИЗАЙН ПРОЦЕС 2 ЗАВЪРШЕН"}</b></div>
      <div className="nextCard client"><span>ПРИЕМАНЕ</span><b>Телефон 360 / 390 / 430px · Компютър 1366 / 1440 / клас 1920 · Chrome + Edge</b></div>
    </div>

    <div className="controlTools">
      <div className="filterGroup">{(["all","green","yellow","red"] as const).map(v=><button key={v} className={filter===v?"active":""} onClick={()=>setFilter(v)}>{v==="all"?"Всички":v==="green"?"ЗЕЛЕНО":v==="yellow"?"ЖЪЛТО":"ЧЕРВЕНО"}</button>)}</div>
      <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Търси DP2 задача..." aria-label="Търси в Дизайн процес 2"/>
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
            <div><span>ДИЗАЙН ПРОЦЕС 2</span><b>{DP2_BG_GROUPS[group]||group}</b><small>Премиум редизайн със запазени зависимости</small></div>
            <div className="phaseCounts"><i className="greenDot">{green}</i><i className="yellowDot">{yellow}</i><i className="redDot">{red}</i><strong>{pct}%</strong></div>
          </summary>
          <div className="phaseTasks">
            {groupTasks.map(task=><article className={`taskCard task-${task.status}`} key={task.id}>
              <div className="taskTop">
                <div className="taskMain">
                  <span className="taskId">{task.id}</span>
                  <b>{DP2_BG_TITLES[task.id]||task.title}</b>
                  <small>{task.status==="green"?"Имплементация + тест + доказателство":task.status==="yellow"?"Частично / чака доказателство / блокер":"Не е завършено"}</small>
                </div>
                <div className="statusButtons"><button className={task.status}>{task.status==="green"?"ЗЕЛЕНО":task.status==="yellow"?"ЖЪЛТО":"ЧЕРВЕНО"}</button></div>
              </div>
              {(task.evidence||task.blocker)&&<div className="taskDetails">
                <input readOnly value={task.evidence||""} placeholder="Доказателството ще се попълни от DAVID"/>
                <input readOnly value={task.blocker||""} placeholder="Няма блокер"/>
                <span>{task.updatedAt?`Обновено ${new Date(task.updatedAt).toLocaleString("bg-BG")}`:"Все още няма обновяване"}</span>
              </div>}
            </article>)}
          </div>
        </details>;
      })}
    </div>

    <footer className="controlFooter"><b>Правило на процес 2:</b> V1 остава заключен. DP2 задачите се изпълняват DP2-01 → DP2-30. ЗЕЛЕНО само с доказателство. DP2-31 не се създава автоматично. Основен източник: docs/DESIGN_PROCESS_2.md + app/design-process-2-evidence.json.</footer>
  </section>;
}
