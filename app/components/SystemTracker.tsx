"use client";

import { useEffect, useMemo, useState } from "react";

type Status = "green" | "yellow" | "red";
type Kind = "core" | "test" | "security" | "legal" | "global" | "ai";
type Task = { id: string; label: string; defaultStatus: Status; kind?: Kind };
type Phase = { id: string; title: string; tasks: Task[] };
type NoteMap = Record<string, { evidence?: string; blocker?: string; updatedAt?: string }>;

const task = (id: string, label: string, defaultStatus: Status = "red", kind: Kind = "core"): Task => ({ id, label, defaultStatus, kind });

const phases: Phase[] = [
  { id: "01", title: "Clean foundation", tasks: [
    task("01.01", "Private GitHub repo enchev-auctions", "green"), task("01.02", "Clean Next.js + TypeScript base", "green"),
    task("01.03", "Vercel project enchev-auctions", "green"), task("01.04", "GitHub → Vercel automatic deploy", "green"),
    task("01.05", "Supabase project"), task("01.06", "Redis environment"), task("01.07", "Local / staging / production environments"),
    task("01.08", "Environment variable validation"), task("01.09", "CI lint / typecheck / test / build", "red", "test"),
    task("01.10", "Web / API / realtime / worker health endpoints", "red", "test")
  ]},
  { id: "02", title: "Architecture & repository", tasks: [
    task("02.01", "apps/web"), task("02.02", "apps/api"), task("02.03", "apps/realtime"), task("02.04", "apps/worker"),
    task("02.05", "packages/domain"), task("02.06", "packages/contracts"), task("02.07", "packages/config"), task("02.08", "packages/providers"),
    task("02.09", "Database migrations structure"), task("02.10", "Architecture decision records")
  ]},
  { id: "03", title: "Database & data integrity", tasks: [
    task("03.01", "PostgreSQL schema baseline"), task("03.02", "Migration runner"), task("03.03", "Staging seed data"), task("03.04", "UUID identifiers"),
    task("03.05", "UTC timestamps everywhere", "red", "global"), task("03.06", "Archival rules"), task("03.07", "Immutable critical event history"),
    task("03.08", "Idempotency keys for critical writes"), task("03.09", "Transactional outbox"), task("03.10", "Migration recovery test", "red", "test")
  ]},
  { id: "04", title: "Identity & access", tasks: [
    task("04.01", "Supabase Auth"), task("04.02", "Register / login / logout / recovery"), task("04.03", "Buyer / Seller / Support / Admin roles"),
    task("04.04", "RBAC permission matrix", "red", "security"), task("04.05", "Admin MFA", "red", "security"), task("04.06", "Session revocation", "red", "security"),
    task("04.07", "Active / restricted / suspended accounts"), task("04.08", "Privileged-action audit trail", "red", "security"), task("04.09", "Cross-account access tests", "red", "test")
  ]},
  { id: "05", title: "KYC / KYB / eligibility", tasks: [
    task("05.01", "KYC provider abstraction"), task("05.02", "KYB provider abstraction"), task("05.03", "Verification states"), task("05.04", "Manual review queue"),
    task("05.05", "Buyer eligibility engine"), task("05.06", "Seller verification workflow"), task("05.07", "Compliance holds"), task("05.08", "Verification audit history"),
    task("05.09", "Blocked-user enforcement tests", "red", "test")
  ]},
  { id: "06", title: "Vehicle inventory", tasks: [
    task("06.01", "Vehicle CRUD"), task("06.02", "VIN / make / model / trim / year"), task("06.03", "Engine / fuel / transmission / drivetrain"),
    task("06.04", "Odometer model"), task("06.05", "Condition / damage / run status"), task("06.06", "Title/document status"),
    task("06.07", "Country / region / city / yard", "red", "global"), task("06.08", "Secure image uploads", "red", "security"),
    task("06.09", "Secure document uploads", "red", "security"), task("06.10", "Data provenance labels"), task("06.11", "Vehicle version history"),
    task("06.12", "Seller submit → Admin review → Publish"), task("06.13", "Vehicle validation tests", "red", "test")
  ]},
  { id: "07", title: "Marketplace & discovery", tasks: [
    task("07.01", "Homepage"), task("07.02", "Vehicle listing grid"), task("07.03", "Vehicle detail page"), task("07.04", "Search by make / model / VIN / lot"),
    task("07.05", "Filters"), task("07.06", "Sorting"), task("07.07", "Pagination / infinite loading"), task("07.08", "Upcoming / live / ended views"),
    task("07.09", "Responsive mobile UX"), task("07.10", "SEO metadata / sitemap / canonical URLs"), task("07.11", "Accessibility baseline", "red", "test")
  ]},
  { id: "08", title: "Auction configuration", tasks: [
    task("08.01", "Auction state machine"), task("08.02", "No-reserve auction"), task("08.03", "Reserve auction"), task("08.04", "Seller-approval result path"),
    task("08.05", "Buy-now mode"), task("08.06", "Versioned auction rules"), task("08.07", "Bid increment table"), task("08.08", "Pre-bid / live / end timestamps"),
    task("08.09", "Immutable auction-start vehicle snapshot"), task("08.10", "Auction publish validation", "red", "test")
  ]},
  { id: "09", title: "Pre-Bid & Max Bid engine", tasks: [
    task("09.01", "Atomic Pre-Bid transaction"), task("09.02", "Private Max Bid storage", "red", "security"), task("09.03", "Proxy bidding algorithm"),
    task("09.04", "Deterministic equal-max priority"), task("09.05", "Increment boundary validation"), task("09.06", "Eligibility before bid acceptance"),
    task("09.07", "Duplicate-request protection"), task("09.08", "Private max never exposed", "red", "test"), task("09.09", "Proxy-bid scenario matrix", "red", "test")
  ]},
  { id: "10", title: "Live realtime auction", tasks: [
    task("10.01", "Persistent WebSocket service"), task("10.02", "Authenticated WebSocket handshake", "red", "security"), task("10.03", "Auction rooms"),
    task("10.04", "Realtime bid events"), task("10.05", "Current leader event"), task("10.06", "Outbid event"), task("10.07", "Server-authoritative timer"),
    task("10.08", "Late-bid extension"), task("10.09", "Reconnect after network drop"), task("10.10", "Sequence-gap detection"),
    task("10.11", "Authoritative state refetch"), task("10.12", "Browser-clock manipulation test", "red", "test"), task("10.13", "Two-browser synchronization test", "red", "test")
  ]},
  { id: "11", title: "Finalization & winner", tasks: [
    task("11.01", "Exactly-once logical close"), task("11.02", "Close worker"), task("11.03", "Single authoritative finalizer"), task("11.04", "Deterministic winner selection"),
    task("11.05", "Reserve result"), task("11.06", "Seller-approval pending result"), task("11.07", "Unsold result"), task("11.08", "Immutable final result event"),
    task("11.09", "Exceptional void/reversal with reason + audit"), task("11.10", "Restart during close test", "red", "test"), task("11.11", "Simultaneous final bids test", "red", "test")
  ]},
  { id: "12", title: "Notifications", tasks: [
    task("12.01", "Notification event model"), task("12.02", "Email provider abstraction"), task("12.03", "SMS provider abstraction"), task("12.04", "Outbid notification"),
    task("12.05", "Auction start notification"), task("12.06", "Auction result notification"), task("12.07", "Security alerts", "red", "security"),
    task("12.08", "Notification preferences"), task("12.09", "Retry / dead-letter handling", "red", "test")
  ]},
  { id: "13", title: "Release, pickup & logistics", tasks: [
    task("13.01", "Release state machine"), task("13.02", "Compliance/document release gates"), task("13.03", "Pickup authorization"),
    task("13.04", "Single-use pickup code", "red", "security"), task("13.05", "Pickup completed event"), task("13.06", "Transport provider abstraction"),
    task("13.07", "Transport request / quote flow"), task("13.08", "Shipment status events"), task("13.09", "Release abuse tests", "red", "test")
  ]},
  { id: "14", title: "Admin & operations", tasks: [
    task("14.01", "Admin dashboard"), task("14.02", "User search / review"), task("14.03", "Verification queue"), task("14.04", "Vehicle review queue"),
    task("14.05", "Auction create/edit/publish controls"), task("14.06", "Live auction monitor"), task("14.07", "Release / logistics queue"),
    task("14.08", "Support tickets"), task("14.09", "Complaints / disputes"), task("14.10", "Evidence freeze"), task("14.11", "Feature flags"),
    task("14.12", "High-risk admin confirmation", "red", "security")
  ]},
  { id: "15", title: "Legal, privacy & transparency", tasks: [
    task("15.01", "Terms version registry", "red", "legal"), task("15.02", "Buyer auction rules", "red", "legal"), task("15.03", "Seller terms", "red", "legal"),
    task("15.04", "Vehicle condition policy", "red", "legal"), task("15.05", "Privacy notice", "red", "legal"), task("15.06", "Cookie consent / preferences", "red", "legal"),
    task("15.07", "KYC identity notice", "red", "legal"), task("15.08", "Marketplace transparency", "red", "legal"), task("15.09", "AI transparency", "red", "legal"),
    task("15.10", "Seller-of-record / platform-role display", "red", "legal"), task("15.11", "Country legal launch gate", "red", "global"), task("15.12", "Policy ↔ behavior tests", "red", "test")
  ]},
  { id: "16", title: "Security hardening", tasks: [
    task("16.01", "Authorization abuse suite", "red", "security"), task("16.02", "Rate limiting", "red", "security"), task("16.03", "Bot / scripted abuse controls", "red", "security"),
    task("16.04", "Secure headers", "red", "security"), task("16.05", "CSRF protection where applicable", "red", "security"), task("16.06", "Signed upload URLs", "red", "security"),
    task("16.07", "Upload type/size validation", "red", "security"), task("16.08", "Secrets management", "red", "security"), task("16.09", "Key rotation procedure", "red", "security"),
    task("16.10", "Least-privilege provider credentials", "red", "security"), task("16.11", "Dependency vulnerability scanning", "red", "security"), task("16.12", "External penetration test", "red", "security")
  ]},
  { id: "17", title: "Observability & recovery", tasks: [
    task("17.01", "Structured logs"), task("17.02", "Metrics"), task("17.03", "Distributed traces"), task("17.04", "Error tracking"), task("17.05", "Uptime monitoring"),
    task("17.06", "Realtime connection metrics"), task("17.07", "Bid latency metrics"), task("17.08", "Auction close failure alert"), task("17.09", "Worker failure alert"),
    task("17.10", "Database backups"), task("17.11", "Restore drill", "red", "test"), task("17.12", "Disaster recovery runbook")
  ]},
  { id: "18", title: "Load, concurrency & chaos", tasks: [
    task("18.01", "10 concurrent bidders", "red", "test"), task("18.02", "50 concurrent bidders", "red", "test"), task("18.03", "100 concurrent bidders", "red", "test"),
    task("18.04", "500+ bidder stress test", "red", "test"), task("18.05", "Database contention test", "red", "test"), task("18.06", "WebSocket fanout test", "red", "test"),
    task("18.07", "Reconnect storm test", "red", "test"), task("18.08", "Duplicate-request storm", "red", "test"), task("18.09", "Realtime restart during auction", "red", "test"),
    task("18.10", "Worker restart during close", "red", "test"), task("18.11", "Redis interruption recovery", "red", "test"), task("18.12", "No winner corruption under load", "red", "test")
  ]},
  { id: "19", title: "Closed pilot", tasks: [
    task("19.01", "Create and verify seller", "red", "test"), task("19.02", "Create vehicle + media + documents", "red", "test"), task("19.03", "Admin review + publish", "red", "test"),
    task("19.04", "Create and verify Buyer A", "red", "test"), task("19.05", "Create and verify Buyer B", "red", "test"), task("19.06", "Pre-Bid scenario", "red", "test"),
    task("19.07", "Max Bid scenario", "red", "test"), task("19.08", "Live two-buyer auction", "red", "test"), task("19.09", "Late-bid extension", "red", "test"),
    task("19.10", "Correct winner", "red", "test"), task("19.11", "Release / pickup flow", "red", "test"), task("19.12", "Complaint reconstruction", "red", "test"),
    task("19.13", "Full audit reconstruction", "red", "test"), task("19.14", "Pilot sign-off: zero critical blockers", "red", "test")
  ]},
  { id: "20", title: "Production providers", tasks: [
    task("20.01", "Production KYC/KYB provider"), task("20.02", "Production email provider"), task("20.03", "Production SMS provider"),
    task("20.04", "VIN/history provider if used"), task("20.05", "Transport provider if used"), task("20.06", "Provider timeout/retry tests", "red", "test"),
    task("20.07", "Provider outage fallback", "red", "test")
  ]},
  { id: "21", title: "International readiness", tasks: [
    task("21.01", "CountryProfile configuration model", "red", "global"), task("21.02", "No country-specific hardcoding", "red", "global"),
    task("21.03", "Locale-aware dates", "red", "global"), task("21.04", "Timezone-aware display", "red", "global"), task("21.05", "BG locale", "red", "global"),
    task("21.06", "EN locale", "red", "global"), task("21.07", "Translation key architecture", "red", "global"), task("21.08", "Country-specific KYC profile", "red", "global"),
    task("21.09", "Country-specific legal profile", "red", "global"), task("21.10", "Country-specific document profile", "red", "global"),
    task("21.11", "Market activation gate", "red", "global"), task("21.12", "Country #2 without core rewrite", "red", "global"),
    task("21.13", "Regional CDN strategy", "red", "global"), task("21.14", "Regional data/residency review", "red", "global")
  ]},
  { id: "22", title: "AI-assisted features", tasks: [
    task("22.01", "AI isolated from authoritative auction path", "red", "ai"), task("22.02", "Natural-language vehicle search", "red", "ai"),
    task("22.03", "AI support assistant", "red", "ai"), task("22.04", "AI listing assistant", "red", "ai"), task("22.05", "AI vehicle summary", "red", "ai"),
    task("22.06", "AI translation assistance", "red", "ai"), task("22.07", "AI output provenance / labels", "red", "ai"),
    task("22.08", "AI hallucination / unsafe-action tests", "red", "test"), task("22.09", "Visual damage assistant with human review", "red", "ai")
  ]},
  { id: "23", title: "Production launch & ongoing engineering", tasks: [
    task("23.01", "Production domain"), task("23.02", "Production configuration review"), task("23.03", "Production secrets review", "red", "security"),
    task("23.04", "Production backup verified", "red", "test"), task("23.05", "Production health dashboard"), task("23.06", "Incident runbook"),
    task("23.07", "First controlled live auction", "red", "test"), task("23.08", "Post-launch error review", "red", "test"),
    task("23.09", "Regression suite before every release", "red", "test"), task("23.10", "Performance baseline tracked", "red", "test")
  ]}
];

const STORAGE_KEY = "enchev-system-status-v4";
const NOTES_KEY = "enchev-system-notes-v4";
const GAPS_KEY = "enchev-system-gaps-v4";
const CHANNEL = "enchev-system-realtime-v4";

function defaultStatuses() {
  const out: Record<string, Status> = {};
  phases.forEach((p) => p.tasks.forEach((t) => { out[t.id] = t.defaultStatus; }));
  return out;
}

export default function SystemTracker() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [controlOpen, setControlOpen] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, Status>>(defaultStatuses);
  const [notes, setNotes] = useState<NoteMap>({});
  const [gaps, setGaps] = useState<Task[]>([]);
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [query, setQuery] = useState("");
  const [gapText, setGapText] = useState("");
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY), n = localStorage.getItem(NOTES_KEY), g = localStorage.getItem(GAPS_KEY);
      if (s) setStatuses((cur) => ({ ...cur, ...JSON.parse(s) }));
      if (n) setNotes(JSON.parse(n));
      if (g) setGaps(JSON.parse(g));
    } catch {}
  }, []);

  useEffect(() => { const x = window.setInterval(() => setNow(new Date()), 1000); return () => window.clearInterval(x); }, []);

  useEffect(() => {
    const c = new BroadcastChannel(CHANNEL);
    c.onmessage = (e) => {
      if (e.data?.type !== "state") return;
      if (e.data.statuses) setStatuses((cur) => ({ ...cur, ...e.data.statuses }));
      if (e.data.notes) setNotes(e.data.notes);
      if (e.data.gaps) setGaps(e.data.gaps);
    };
    return () => c.close();
  }, []);

  function persist(nextStatuses: Record<string, Status>, nextNotes: NoteMap = notes, nextGaps: Task[] = gaps) {
    setStatuses(nextStatuses); setNotes(nextNotes); setGaps(nextGaps);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextStatuses)); localStorage.setItem(NOTES_KEY, JSON.stringify(nextNotes)); localStorage.setItem(GAPS_KEY, JSON.stringify(nextGaps));
      const c = new BroadcastChannel(CHANNEL); c.postMessage({ type: "state", statuses: nextStatuses, notes: nextNotes, gaps: nextGaps }); c.close();
    } catch {}
  }

  function setStatus(id: string, status: Status) {
    persist({ ...statuses, [id]: status }, { ...notes, [id]: { ...notes[id], updatedAt: new Date().toISOString() } });
  }

  function setNote(id: string, field: "evidence" | "blocker", value: string) {
    persist(statuses, { ...notes, [id]: { ...notes[id], [field]: value, updatedAt: new Date().toISOString() } });
  }

  function addGap() {
    const label = gapText.trim(); if (!label) return;
    const id = `GAP.${Date.now()}`;
    const newGap: Task = { id, label, defaultStatus: "red", kind: "core" };
    const nextGaps: Task[] = [...gaps, newGap];
    setGapText(""); persist({ ...statuses, [id]: "red" }, notes, nextGaps);
  }

  function removeGap(id: string) {
    const s = { ...statuses }, n = { ...notes }; delete s[id]; delete n[id]; persist(s, n, gaps.filter((g) => g.id !== id));
  }

  const allTasks = useMemo(() => [...phases.flatMap((p) => p.tasks), ...gaps], [gaps]);
  const totals = useMemo(() => {
    const x: Record<Status, number> = { green: 0, yellow: 0, red: 0 };
    allTasks.forEach((t) => { x[statuses[t.id] || t.defaultStatus] += 1; }); return x;
  }, [allTasks, statuses]);
  const progress = allTasks.length ? Math.round((totals.green / allTasks.length) * 100) : 0;
  const nextTask = allTasks.find((t) => (statuses[t.id] || t.defaultStatus) !== "green");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const source: Phase[] = gaps.length ? [...phases, { id: "GAP", title: "Открити пропуски", tasks: gaps }] : phases;
    return source.map((p) => ({ ...p, tasks: p.tasks.filter((t) => {
      const st = statuses[t.id] || t.defaultStatus;
      return (filter === "all" || st === filter) && (!q || `${t.id} ${t.label} ${p.title}`.toLowerCase().includes(q));
    }) })).filter((p) => p.tasks.length);
  }, [statuses, filter, query, gaps]);

  return <>
    <button className="burgerButton" aria-label="Отвори меню" onClick={() => setMenuOpen(true)}><span/><span/><span/></button>
    {menuOpen && <div className="menuShade" onClick={() => setMenuOpen(false)}/>}
    <aside className={`sidePanel ${menuOpen ? "sideOpen" : ""}`}>
      <div className="sidePanelTop"><div><div className="miniLabel">ENCHEV AUCTIONS</div><strong>System Command Center</strong></div><button className="iconButton" onClick={() => setMenuOpen(false)}>×</button></div>
      <button className="sideMenuItem" onClick={() => { setControlOpen(true); setMenuOpen(false); }}><span className="sideMenuIcon">◫</span><span><b>Етапи</b><small>Истински системен план 0 → 100%</small></span><span>›</span></button>
      <div className="sideStatusBox"><div className="liveLine"><i/> LOCAL REALTIME · CLOUD NEXT</div><span>Системен прогрес</span><b>{progress}%</b><div className="miniProgress"><i style={{ width: `${progress}%` }}/></div><small>{totals.green} работят · {totals.yellow} тест/грешка · {totals.red} липсват</small></div>
    </aside>

    {controlOpen && <section className="controlOverlay">
      <header className="controlHeader"><div><div className="eyebrow">SYSTEM SOURCE OF TRUTH · 0 → 100%</div><h1>Enchev Auctions — Етапи</h1><p>Само реалната система: архитектура, функции, тестове, грешки, пропуски, security, providers, international readiness и production.</p></div><button className="closeControl" onClick={() => setControlOpen(false)}>×</button></header>
      <div className="controlKpis"><div><span>ПРОГРЕС</span><b>{progress}%</b><small>{allTasks.length} системни точки</small></div><div className="kGreen"><span>РАБОТИ</span><b>{totals.green}</b><small>доказано</small></div><div className="kYellow"><span>ТЕСТ / ГРЕШКА</span><b>{totals.yellow}</b><small>не е приключено</small></div><div className="kRed"><span>ЛИПСВА</span><b>{totals.red}</b><small>не е построено</small></div><div><span>LIVE</span><b className="clockText">{now.toLocaleTimeString("bg-BG")}</b><small>локален realtime</small></div></div>
      <div className="nextGrid"><div className="nextCard"><span>NEXT SYSTEM BLOCKER</span><b>{nextTask ? `${nextTask.id} · ${nextTask.label}` : "Всичко е GREEN"}</b></div></div>
      <div className="controlTools"><div className="filterGroup">{(["all","green","yellow","red"] as const).map((v) => <button key={v} className={filter===v?"active":""} onClick={() => setFilter(v)}>{v==="all"?"Всички":v==="green"?"Работи":v==="yellow"?"Тест/грешка":"Липсва"}</button>)}</div><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Търси функция, тест, етап..."/></div>
      <div className="gapBox"><div><b>Открихме пропуск?</b><small>Добавяме го веднага. Нищо не остава само в чата.</small></div><div className="gapInput"><input value={gapText} onChange={(e)=>setGapText(e.target.value)} onKeyDown={(e)=>e.key==="Enter"&&addGap()} placeholder="Нова липсваща системна стъпка..."/><button onClick={addGap}>Добави пропуск</button></div></div>
      <div className="phaseList">{visible.map((p) => {
        const g=p.tasks.filter((t)=>(statuses[t.id]||t.defaultStatus)==="green").length, y=p.tasks.filter((t)=>(statuses[t.id]||t.defaultStatus)==="yellow").length, r=p.tasks.length-g-y, pct=Math.round((g/p.tasks.length)*100);
        return <details className={`phaseBlock ${p.id==="GAP"?"gapPhase":""}`} key={p.id} open={p.id==="01"||p.id==="GAP"}><summary className="phaseHead"><div><span>ЕТАП {p.id}</span><b>{p.title}</b></div><div className="phaseCounts"><i className="greenDot">{g}</i><i className="yellowDot">{y}</i><i className="redDot">{r}</i><strong>{pct}%</strong></div></summary><div className="phaseTasks">{p.tasks.map((t) => {
          const st=statuses[t.id]||t.defaultStatus, n=notes[t.id]||{};
          return <article key={t.id} className={`taskCard task-${st}`}><div className="taskTop"><div className="taskMain"><span className="taskId">{t.id}</span>{t.kind!=="core"&&<span className={`kind kind-${t.kind}`}>{t.kind.toUpperCase()}</span>}<b>{t.label}</b><small>{st==="green"?"Работи и е проверено":st==="yellow"?"Има тест, грешка или незавършена проверка":"Още не е построено"}</small></div><div className="statusButtons"><button className={st==="green"?"green":""} onClick={()=>setStatus(t.id,"green")}>РАБОТИ</button><button className={st==="yellow"?"yellow":""} onClick={()=>setStatus(t.id,"yellow")}>ТЕСТ/ГРЕШКА</button><button className={st==="red"?"red":""} onClick={()=>setStatus(t.id,"red")}>ЛИПСВА</button>{p.id==="GAP"&&<button className="removeGap" onClick={()=>removeGap(t.id)}>×</button>}</div></div><div className="taskDetails"><input value={n.evidence||""} onChange={(e)=>setNote(t.id,"evidence",e.target.value)} placeholder="Evidence: URL / commit / test result"/><input value={n.blocker||""} onChange={(e)=>setNote(t.id,"blocker",e.target.value)} placeholder="Грешка / blocker / какво остава"/><span>{n.updatedAt?`Update ${new Date(n.updatedAt).toLocaleString("bg-BG")}`:"No update yet"}</span></div></article>;
        })}</div></details>;
      })}</div>
      <footer className="controlFooter"><b>Правило:</b> GREEN само когато функцията реално работи и има доказателство. YELLOW при тест, грешка, частично работещо или чакаща проверка. RED когато липсва. След Supabase този Command Center преминава от local realtime към cloud realtime между устройства.</footer>
    </section>}
  </>;
}
