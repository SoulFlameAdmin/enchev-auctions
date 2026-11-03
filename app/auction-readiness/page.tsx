"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import "./readiness.css";

type Service = "web" | "api" | "realtime" | "worker" | "auth" | "redis" | "demo";
type HealthState = "checking" | "ready" | "pending" | "unavailable" | "demo";
type ProbeResult = Readonly<{
  service: Service;
  state: HealthState;
  httpStatus: number | null;
  measuredAt: string;
  latencyMs: number | null;
  details: string;
  evidence: Readonly<Record<string, boolean | string | number | null>>;
}>;

const SERVICES: readonly Readonly<{
  id: Service;
  label: string;
  description: string;
  path: string;
  critical: boolean;
}>[] = [
  { id: "web", label: "WEB", description: "Уеб интерфейс и Next.js маршрути", path: "/api/health/web", critical: true },
  { id: "api", label: "API", description: "Основни API услуги", path: "/api/health/api", critical: true },
  { id: "realtime", label: "REALTIME", description: "Синхронизация между участниците", path: "/api/health/realtime", critical: true },
  { id: "worker", label: "WORKER", description: "Фоново приключване на търгове", path: "/api/health/worker", critical: true },
  { id: "auth", label: "IDENTITY", description: "Регистрация и проверка на участници", path: "/api/enchev-auth/session", critical: true },
  { id: "redis", label: "REDIS", description: "Свързаност с Redis/Valkey", path: "/api/health/redis", critical: true },
  { id: "demo", label: "LIVE DEMO", description: "Безпарична демонстрация, не е реален търг", path: "/api/live-auction-clock", critical: false },
] as const;

const stateLabels: Record<HealthState, string> = {
  checking: "ПРОВЕРКА",
  ready: "ДОСТЪПНА",
  pending: "НЕГОТОВА",
  unavailable: "НЕДОСТЪПНА",
  demo: "САМО ДЕМО",
};
const fmt = (date: string) => date ? new Date(date).toLocaleString("bg-BG", {dateStyle:"medium",timeStyle:"medium"}) : "—";

function safeEvidence(data: unknown) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  const d = data as Record<string, unknown>;
  const out: Record<string, boolean | string | number | null> = {};
  // Allowlist only: never copy token, email, user, secret, account or raw response.
  for (const field of ["ok", "ready", "available", "configured", "auctionAuthority", "valuesExposed"]) {
    if (typeof d[field] === "boolean") out[field] = d[field] as boolean;
  }
  for (const field of ["component", "status", "scope", "binding"]) {
    if (typeof d[field] === "string") out[field] = String(d[field]).slice(0,70);
  }
  if (typeof d.schemaVersion === "number" && Number.isFinite(d.schemaVersion)) out.schemaVersion = d.schemaVersion;
  return out;
}

function classify(service: Service, httpStatus: number, data: Record<string, unknown> | null): Pick<ProbeResult,"state"|"details"> {
  if (!data) return {state:"unavailable",details:"Отговорът не е валиден JSON обект."};
  if (service === "demo") {
    const isDemo = httpStatus === 200 &&
      data.scope === "server-issued-browser-session-demo" && data.auctionAuthority === false;
    return isDemo
      ? {state:"demo",details:"Demo endpoint. Няма право да извършва реални търгове или плащания."}
      : {state:"unavailable",details:"Demo контрактът не е потвърден."};
  }
  if (service === "auth") {
    if (httpStatus === 200 && data.available === true) return {state:"ready",details:"Идентификационната услуга съобщава, че е активна. Не е тест на регистрация."};
    return {state:"pending",details:"Регистрацията/идентификацията не е потвърдена като активна."};
  }
  if (service === "redis") {
    if (httpStatus === 200 && data.ok === true && data.status === "pong")
      return {state:"ready",details:"Сървърната Redis проверка връща PONG."};
    return {state:"pending",details:"Няма потвърден PONG от Redis/Valkey."};
  }
  if (httpStatus === 200 &&
      data.component === service && data.ok === true && data.ready === true &&
      data.status === "healthy" && data.valuesExposed === false)
    return {state:"ready",details:"Здравният endpoint връща очаквания контракт."};
  if (httpStatus === 503 && data.component === service && data.ready === false)
    return {state:"pending",details:"Endpoint обозначава услугата като непусната. Не приемай реални оферти."};
  return {state:"unavailable",details:"HTTP/JSON контрактът е неочакван или услугата е недостъпна."};
}

export default function AuctionReadinessPage() {
  const [results,setResults] = useState<Partial<Record<Service,ProbeResult>>>({});
  const [busy,setBusy] = useState(false);
  const [started,setStarted] = useState(false);
  const [notice,setNotice] = useState("");
  const [lastRun,setLastRun] = useState("");
  const checks = useMemo(() => SERVICES.filter(x=>x.critical),[]);
  const readyCount = checks.filter(x=>results[x.id]?.state === "ready").length;
  const checkedCount = checks.filter(x=>results[x.id]?.httpStatus !== undefined).length;

  const runAll = useCallback(async () => {
    setBusy(true);setStarted(true);setNotice("");
    const begin = new Date().toISOString();
    const initial = Object.fromEntries(SERVICES.map(x=>[x.id,{
      service:x.id,state:"checking" as const,httpStatus:null,measuredAt:begin,latencyMs:null,
      details:"Свързване...",evidence:{},
    }]));
    setResults(initial as Partial<Record<Service,ProbeResult>>);
    const all = await Promise.all(SERVICES.map(async service => {
      const start = Date.now();
      const controller = new AbortController();
      const timer = window.setTimeout(()=>controller.abort(),8000);
      try {
        const response = await fetch(service.path,{method:"GET",credentials:"same-origin",cache:"no-store",redirect:"error",signal:controller.signal});
        let data: Record<string,unknown> | null = null;
        try {
          const parsed: unknown = await response.json();
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) data = parsed as Record<string,unknown>;
        } catch { /* non-JSON response: fail closed */ }
        const verdict = classify(service.id,response.status,data);
        return {service:service.id,state:verdict.state,httpStatus:response.status,
          measuredAt:new Date().toISOString(),latencyMs:Date.now()-start,details:verdict.details,evidence:safeEvidence(data)} satisfies ProbeResult;
      } catch {
        return {service:service.id,state:"unavailable" as const,httpStatus:null,
          measuredAt:new Date().toISOString(),latencyMs:Date.now()-start,
          details:"Няма потвърден HTTP отговор (мрежа, timeout или блокирана заявка).",
          evidence:{}} satisfies ProbeResult;
      } finally {window.clearTimeout(timer);}
    }));
    setResults(Object.fromEntries(all.map(x=>[x.service,x])) as Partial<Record<Service,ProbeResult>>);
    setLastRun(new Date().toISOString());setBusy(false);
  },[]);

  useEffect(()=>{void runAll();},[runAll]);
  function exportEvidence() {
    if (!lastRun || busy) return;
    const payload = {
      schemaVersion:1,kind:"ENCHEV_D001_BROWSER_HEALTH_AUDIT",
      target:"same-origin",observedOrigin:window.location.origin,
      observedAt:lastRun,source:"browser GET, no authenticated bid or payment test",
      checks:SERVICES.map(s=>({service:s.id,endpoint:s.path,...results[s.id],requiredForAuction:s.critical})),
      conclusion:readyCount===checks.length
        ? "HTTP readiness only. Real auctions NOT certified by this probe."
        : "GO/NO-GO: NO-GO for real auctions. Required services not fully confirmed.",
    };
    const blob = new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
    const url = URL.createObjectURL(blob), anchor = document.createElement("a");
    anchor.href=url;anchor.download="enchev-D001-audit-"+lastRun.slice(0,10)+".json";
    document.body.appendChild(anchor);anchor.click();anchor.remove();
    window.setTimeout(()=>URL.revokeObjectURL(url),2000);
    setNotice("Експортиран е действителният резултат от браузърните проверки (без токени и лични данни).");
  }

  const remaining = Math.max(0,checks.length-readyCount);
  return <main id="main-content" className="arPage">
    <div className="arShell">
      <header className="arTop">
        <a className="arBrand" href="/" aria-label="E&A начало">
          <img src="/brand/ea-approved-1to1.jpg" alt="" />
          <span><b>EAST WEST</b><small>AUCTIONEERS GROUP</small></span>
        </a>
        <nav aria-label="Бързи връзки"><a href="/inventory">Автомобили</a><a href="/live-auctions">LIVE DEMO</a><a href="/">Command Center</a></nav>
      </header>
      <div className="arHero">
        <div>
          <span className="arOverline">ENCHEV AUCTIONS · FOUNDATION · D001</span>
          <h1>AUCTION <em>READINESS</em></h1>
          <p>Проверка на реалната инфраструктурна основа за безопасно наддаване. Данните се взимат от този deployment, а не от примерни зелени индикатори.</p>
          <div className="arHeroActions">
            <button type="button" onClick={()=>void runAll()} disabled={busy} className="arPrimary">{busy?"ПРОВЕРЯВАМ...":"ПРОВЕРИ СИСТЕМАТА"} <span aria-hidden="true">↗</span></button>
            <button type="button" onClick={exportEvidence} disabled={!lastRun||busy} className="arSecondary">ЕКСПОРТ НА ДОКАЗАТЕЛСТВА ↓</button>
          </div>
        </div>
        <div className="arScore" aria-live="polite">
          <span>ПРОВЕРЕНИ КРИТИЧНИ УСЛУГИ</span>
          <strong>{readyCount}<i> / {checks.length}</i></strong>
          <div className="arProgress" role="progressbar" aria-label="Достъпни услуги" aria-valuemin={0} aria-valuemax={checks.length} aria-valuenow={readyCount}><i style={{width:readyCount/checks.length*100+"%"}} /></div>
          <b>{!started||busy?"ПРОВЕРКАТА ТЕЧЕ":remaining?"НЕ Е ГОТОВО ЗА РЕАЛНИ ТЪРГОВЕ":"НУЖНИ СА ДОПЪЛНИТЕЛНИ ПРИЕМАТЕЛНИ ТЕСТОВЕ"}</b>
          <small>{lastRun?"Последна проверка: "+fmt(lastRun):"Проверка в реално време от вашия браузър"}</small>
        </div>
      </div>
      <div className="arTruth">
        <strong>DEMO ≠ PRODUCTION</strong>
        <p>LIVE екранът използва временна браузърна демонстрационна сесия. Този статус панел не удостоверява победител, плащане, сигурност на наддаване или готовност за пускане на реални търгове.</p>
      </div>
      <section className="arPanel" aria-labelledby="arServices">
        <div className="arSectionHeading"><div><span>01 · ТЕХНИЧЕСКИ ПРОБИ</span><h2 id="arServices">Сървърни услуги</h2></div><small>{checkedCount} / {checks.length} критични резултата</small></div>
        <div className="arServices">
          {SERVICES.map((service,i)=>{
            const result=results[service.id];
            const state=result?.state??"checking";
            return <article key={service.id} className="arService" data-probe={service.id} data-state={state}>
              <span className="arServiceIndex">{String(i+1).padStart(2,"0")}</span>
              <div className="arServiceBody"><h3>{service.label}</h3><p>{service.description}</p><code>{service.path}</code>{result&&<small>{result.details}</small>}</div>
              <div className="arResult"><span className={"arState ar-"+state}>{stateLabels[state]}</span>
                <b>{result?.httpStatus===null||result?.httpStatus===undefined?"HTTP —":"HTTP "+result.httpStatus}</b>
                <small>{typeof result?.latencyMs==="number"?result.latencyMs+" ms":"—"}</small>
              </div>
            </article>;
          })}
        </div>
      </section>
      <section className="arNext" aria-labelledby="arNextHeading">
        <div className="arSectionHeading"><div><span>02 · КАКВО СЛЕДВА</span><h2 id="arNextHeading">Път до първия истински търг</h2></div></div>
        <div className="arMilestones">
          <article><span>01</span><h3>Услуги и достъпи</h3><p>Потвърдени Web, API, Realtime, Worker, Auth и Redis с надежден HTTP/JSON резултат.</p></article>
          <article><span>02</span><h3>Безопасно наддаване</h3><p>Server-authoritative bids, проверки, atomic транзакции, таймер, extension, reconnect и финализиране.</p></article>
          <article><span>03</span><h3>Затворен пилот</h3><p>Реален продавач и трима тестови купувачи, документирани тестове и нула критични дефекти.</p></article>
          <article><span>04</span><h3>Одобрение за старт</h3><p>Операторът одобрява условия, роли, плащания, мониторинг, резервно възстановяване и Go/No-Go.</p></article>
        </div>
        <div className="arLinks"><a href="/inventory">РАЗГЛЕДАЙ КАТАЛОГА ↗</a><a href="/live-auctions">ОТВОРИ DEMO АУКЦИОН ↗</a><a href="/register">РЕГИСТРАЦИЯ ↗</a></div>
      </section>
      {notice&&<p className="arNotice" role="status">{notice}</p>}
      <footer className="arFoot">E&A East West Auctioneers Group · Read-only audit · Никакви парични операции или промяна на production данни. HTTP GET статус ≠ пълен end-to-end тест.</footer>
    </div>
  </main>;
}
