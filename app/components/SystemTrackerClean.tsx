'use client';

import {useCallback,useEffect,useRef,useState} from 'react';
import type {DevelopmentStatus} from '../../lib/development-status';

const statusLabels={green:'🟢 Проверено',yellow:'🟡 Незавършено',red:'🔴 Липсва / критичен проблем'};
function stamp(value:string|null|undefined){return value?new Date(value).toLocaleString('bg-BG',{timeZone:'Europe/Sofia'}):'Няма изпълнение';}

export default function SystemTrackerClean(){
  const [menu,setMenu]=useState(false),[open,setOpen]=useState(false);
  const [data,setData]=useState<DevelopmentStatus|null>(null),[error,setError]=useState<string|null>(null);
  const [query,setQuery]=useState(''),[filter,setFilter]=useState('all'),[testFilter,setTestFilter]=useState('all');
  const [tab,setTab]=useState('plan');
  const menuDialog=useRef<HTMLDialogElement>(null),trackerDialog=useRef<HTMLDialogElement>(null);
  const busy=useRef(false);
  const refresh=useCallback(async()=>{
    if(busy.current)return;
    busy.current=true;
    try{
      const response=await fetch('/api/development-status',{cache:'no-store',signal:AbortSignal.timeout(12000)});
      if(!response.ok)throw new Error();
      const next=await response.json();
      if(!Array.isArray(next.stages)||!Array.isArray(next.tests))throw new Error();
      setData(next);setError(null);
    }catch{setError('Връзката е прекъсната. Показаните резултати може да са остарели. Повторен опит на всеки 15 секунди.');}
    finally{busy.current=false;}
  },[]);
  useEffect(()=>{void refresh();},[refresh]);
  useEffect(()=>{
    if(!open)return;
    const timer=setInterval(()=>{if(!document.hidden)void refresh();},15000);
    const onVisible=()=>{if(!document.hidden)void refresh();};
    document.addEventListener('visibilitychange',onVisible);
    return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',onVisible);};
  },[open,refresh]);
  useEffect(()=>{if(menu)menuDialog.current?.showModal();else menuDialog.current?.close();},[menu]);
  useEffect(()=>{
    if(open){trackerDialog.current?.showModal();void refresh();}else trackerDialog.current?.close();
    document.body.style.overflow=open||menu?'hidden':'';
    return()=>{document.body.style.overflow='';};
  },[open,menu,refresh]);
  const stages=data?.stages||[],tests=data?.tests||[];
  const visible=stages.filter(s=>(filter==='all'||s.status===filter)&&`${s.title} ${s.remaining.join(' ')} ${s.id}`.toLocaleLowerCase('bg').includes(query.toLocaleLowerCase('bg')));
  const completed=stages.filter(s=>s.status==='green');
  const latest=tests.filter(t=>t.evidence).sort((a,b)=>Date.parse(b.evidence!.startedAt)-Date.parse(a.evidence!.startedAt));
  return <>
    <button className="burgerButton" aria-label="Отвори меню" aria-expanded={menu} onClick={()=>setMenu(true)}><span/><span/><span/></button>
    <dialog ref={menuDialog} className="navDialog" onCancel={()=>setMenu(false)} onClose={()=>setMenu(false)} aria-label="Главно меню">
      <div className="sidePanelTop"><div><div className="miniLabel">ENCHEV AUCTIONS</div><strong>Контролен център</strong></div><button className="iconButton" aria-label="Затвори меню" onClick={()=>setMenu(false)}>×</button></div>
      <button className="sideMenuItem" onClick={()=>{setMenu(false);setOpen(true);}}><span>◫</span><span><b>Етапи</b><small>План · тестове · реални резултати</small></span><span>→</span></button>
      <p className="muted">Готовност: {data?`${data.percent}%`:'проверяваме…'}</p>
      <p className="muted">Зелено само след всички задължителни проверки.</p>
    </dialog>
    <dialog ref={trackerDialog} className="trackerDialog" onCancel={()=>setOpen(false)} onClose={()=>setOpen(false)} aria-labelledby="tracker-title">
      <header className="trackerHeader"><div><div className="eyebrow">ENCHEV AUCTIONS / DEVELOPMENT</div><h1 id="tracker-title">Етапи<span className="headerDot">.</span></h1><p className="muted">От основата до първия завършен търг. Всяка зелена отметка изисква доказателство.</p></div><button className="closeControl" aria-label="Затвори етапи" onClick={()=>setOpen(false)}>×</button></header>
      <div className="trackerBody">
      {error&&<div role="alert" className="warning">{error}</div>}
      {!data?<p role="status">{error?'Няма потвърдено състояние.':'Зареждаме реалното състояние…'}</p>:<>
        <section className="summaryGrid" aria-label="Обща готовност">
          <div className="progressCard"><span className="eyebrow">ДОКАЗАНА ГОТОВНОСТ</span><strong>{data.percent}<small>%</small></strong><progress value={data.percent} max="100"/><p>{data.productionReady&&!error?'🟢 PRODUCTION READY':'НЕ Е ГОТОВО ЗА РЕАЛНИ ТЪРГОВЕ'}</p></div>
          <div className="metric"><span>Проверени етапи</span><b className="greenText">{completed.length}<small> / 28</small></b><p>Всички тестове са минали</p></div>
          <div className="metric"><span>Тестове PASS</span><b>{tests.filter(t=>t.status==='PASS').length}<small> / {tests.length}</small></b><p>{tests.filter(t=>t.status==='FAIL').length} FAIL · {tests.filter(t=>t.status==='NOT RUN').length} NOT RUN</p></div>
          <div className="metric"><span>Обновяване</span><b className="smallMetric">{error?'Прекъснато':'На 15 секунди'}</b><p>{stamp(data.checkedAt)} · София</p><button className="textButton" onClick={()=>void refresh()}>Обнови сега ↗</button></div>
        </section>
        <section className="releaseBar"><span>СРЕДА <b>{data.environmentName}</b></span><span>КЛОН <b>{data.branch}</b></span><span>COMMIT <code>{data.commit.slice(0,12)}</code></span><span>DEPLOY <b>{data.deployment.state}</b></span>{data.deployment.url&&<a href={`https://${data.deployment.url}`} target="_blank" rel="noreferrer">Отвори deployment ↗</a>}</section>
        <nav className="trackerTabs" aria-label="Раздели на етапите">{[['plan','План и етапи'],['tests',`Test Center · ${tests.length}`],['activity','Commit / Deploy / CI'],['decisions','Decision Log']].map(([id,label])=><button key={id} aria-current={tab===id?'page':undefined} className={tab===id?'active':''} onClick={()=>setTab(id)}>{label}</button>)}</nav>
        {tab==='plan'&&<>
          <div className="workGrid"><section className="workCard"><h2>РАБОТИМ СЕГА</h2><p>Техническа основа и доказуем Test Center</p><small>Build, TypeScript, правила за статуса, staging smoke. Неизпълнените интеграции остават червени.</small></section><section className="workCard"><h2>СЛЕДВАЩО</h2><p>Изолирани Supabase среди → migrations → Auth</p><small>После seller flow, каталог и атомарно наддаване.</small></section><section className="workCard blocked"><h2>БЛОКИРАНО</h2><p>{data.blockers.length} непокрити условия</p><details><summary>Покажи зависимостите</summary><ul>{data.blockers.map(b=><li key={b}>{b}</li>)}</ul></details></section><section className="workCard"><h2>ЗАВЪРШЕНО</h2><p>{completed.length?completed.map(s=>s.title).join(', '):'Няма напълно приет етап'}</p><small>Преминал отделен тест не означава завършен модул.</small></section></div>
          <div className="controlTools"><div className="filterGroup">{[['all','Всички'],['green','🟢 Проверени'],['yellow','🟡 Частични'],['red','🔴 Липсват / проблем']].map(([id,label])=><button key={id} className={filter===id?'active':''} onClick={()=>setFilter(id)}>{label}</button>)}</div><input aria-label="Търси етап" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Търси етап или функция…"/></div>
          <div className="phaseList">{visible.map(s=><details className={`phaseBlock status-${s.status}`} key={s.id}><summary className="phaseHead"><div><span>ЕТАП {String(s.id).padStart(2,'0')}</span><b>{s.title}</b></div><div className="stageSummary"><span>{statusLabels[s.status as keyof typeof statusLabels]}</span><strong>{s.percent}%</strong></div></summary><div className="phaseContent"><dl><dt>Какво е готово</dt><dd>{s.done.length?s.done.join(' · '):'Няма реализирана функционалност.'}</dd><dt>Какво се прави сега</dt><dd>{s.now}</dd><dt>Какво остава</dt><dd>{s.remaining.join(' · ')}</dd><dt>Тестове</dt><dd><div className="testChips">{s.tests.map(id=>{const t=tests.find(t=>t.id===id);return <span className={`testBadge test-${t?.status.replace(' ','-')}`} key={id}>{t?.title}: <b>{t?.status}</b></span>;})}</div></dd><dt>Грешки / блокиране</dt><dd>{s.errors.length?s.errors.join(' · '):s.blocked||'Няма регистриран FAIL. Непуснатите тестове не доказват липса на грешки.'}</dd><dt>Следваща стъпка</dt><dd>{s.next}</dd></dl></div></details>)}</div>
          {!visible.length&&<p className="muted">Няма етапи за избрания филтър.</p>}
          <section className="recentTests"><h2>ПОСЛЕДНИ ТЕСТОВЕ</h2>{latest.length?latest.slice(0,6).map(t=><div key={t.id}><span>{t.title}</span><b className={`testBadge test-${t.status.replace(' ','-')}`}>{t.status}</b><small>{stamp(t.evidence?.finishedAt)}</small></div>):<p>Няма резултати за текущия commit.</p>}</section>
        </>}
        {tab==='tests'&&<section><div className="sectionIntro"><h2>Test Center</h2><p>NOT RUN → RUNNING → PASS / FAIL. Само резултати за текущия commit. Тестовете се пускат от доверения build/CI runner; тук няма бутон за измислен PASS.</p></div><div className="filterGroup testFilters">{['all','NOT RUN','RUNNING','PASS','FAIL'].map(state=><button key={state} className={testFilter===state?'active':''} onClick={()=>setTestFilter(state)}>{state==='all'?'Всички':state}</button>)}</div><div className="testTableWrap"><table className="testTable"><thead><tr><th>Тест / обхват</th><th>Статус</th><th>Изпълнение · София</th><th>Резултат / грешка</th></tr></thead><tbody>{tests.filter(t=>testFilter==='all'||t.status===testFilter).map(t=><tr key={t.id}><td><b>{t.title}</b><small>{t.id} · {t.scope} · задължителен</small></td><td><span className={`testBadge test-${t.status.replace(' ','-')}`}>{t.status}</span></td><td>{stamp(t.evidence?.startedAt)}{t.evidence&&<small>Край: {stamp(t.evidence.finishedAt)} · {t.evidence.durationMs??'—'} ms<br/>Източник: {t.evidence.source}</small>}</td><td>{t.evidence?.result||'Предстои реално изпълнение.'}{t.evidence?.error&&<p className="redText">{t.evidence.error}</p>}</td></tr>)}</tbody></table></div><p className="muted">Процентът отчита задължителните проверки с равно тегло по етап. Той не е оценка на оставащото работно време.</p></section>}
        {tab==='activity'&&<section className="activity"><h2>Real-Time Development Status</h2><p>{data.cloudConnected?'🟢 Cloud evidence endpoint е свързан':'🔴 Cloud evidence е недостъпен'}</p><p className="muted">Сървърно опресняване на всеки 15 секунди. Commit, deployment и тестовите доказателства са отделни проверки.</p><div className="workGrid"><article className="workCard"><h3>GitHub / CI</h3><p>{data.github.connected?'Свързано':'🟡 Няма live връзка'}</p><small>{data.github.error||`Последен commit: ${data.github.latestCommit?.slice(0,12)}`}</small>{data.github.runs.map(run=><p key={run.id}><a href={run.url} target="_blank" rel="noreferrer">{run.name}</a> · {run.state} · {run.commit.slice(0,8)} · {stamp(run.updatedAt)}</p>)}</article><article className="workCard"><h3>Vercel</h3><p>{data.vercel.connected?'Свързано':'🟡 Показан е текущият deployment'}</p><small>{data.vercel.error}</small>{data.vercel.deployments.map((d:{id:string;state:string;url:string;commit:string|null})=><p key={d.id}><a href={`https://${d.url}`} target="_blank" rel="noreferrer">{d.state}</a> · {d.commit?.slice(0,8)}</p>)}</article></div><h3>Конфигурация на обслужващата среда</h3><p className="muted">Показва се само наличие на настройки. Наличен ключ не доказва работеща интеграция.</p><ul className="envList">{data.environment.map(e=><li key={e.name}><code>{e.name}</code><span>{e.configured?'🟡 Зададено, интеграцията чака тест':'🔴 Липсва'}</span></li>)}</ul><p>Test report: {stamp(data.reportGeneratedAt)} · commit {data.reportCommit.slice(0,12)}</p></section>}
        {tab==='decisions'&&<section><h2>Decision Log</h2>{data.decisions.map(d=><article className="decision" key={d.id}><code>{d.id}</code><p>{d.text}</p></article>)}</section>}
        <footer className="controlFooter">🟢 Всички задължителни тестове са PASS · 🟡 Частично готово / непотвърдено · 🔴 Липсва / критичен FAIL.<br/><b>100% се отключва само при завършени етапи и всички задължителни тестове PASS, включително production smoke и пълния BMW сценарий.</b></footer>
      </>}
      </div>
    </dialog>
  </>;
}
