export type TestState = 'NOT RUN' | 'RUNNING' | 'PASS' | 'FAIL';
export type Evidence = { id: string; status: TestState; commit: string; startedAt: string; finishedAt: string | null; durationMs: number | null; result: string; error: string | null; source: string };
export type Definition = { id: string; title: string; stages: number[]; scope: string; critical: boolean };
export type Stage = { id: number; title: string; implemented: boolean; done: string[]; now: string; remaining: string[]; next: string; blocked: string | null; tests: string[] };

export function resolveTest(def: Definition, evidence: Evidence[], commit: string) {
  const matches = evidence.filter(e => e.id === def.id && e.commit === commit && Number.isFinite(Date.parse(e.startedAt)) && ['PASS','FAIL','RUNNING'].includes(e.status)).sort((a,b) => Date.parse(b.startedAt)-Date.parse(a.startedAt) || Date.parse(b.finishedAt||'1970-01-01')-Date.parse(a.finishedAt||'1970-01-01'));
  const latest = matches[0];
  if (!latest || (latest.status !== 'RUNNING' && (!latest.finishedAt || !Number.isFinite(Date.parse(latest.finishedAt)) || Date.parse(latest.finishedAt) < Date.parse(latest.startedAt)))) return { ...def, status: 'NOT RUN' as TestState, evidence: null };
  if (latest.status === 'RUNNING' && Date.now()-Date.parse(latest.startedAt)>30*60*1000) return { ...def, status: 'FAIL' as TestState, evidence: { ...latest, status:'FAIL' as TestState, error:'Изтекло време за изпълнение. Необходимо е повторно пускане.' } };
  return { ...def, status: latest.status, evidence: latest };
}

export function calculateReadiness(stages: Stage[], definitions: Definition[], evidence: Evidence[], commit: string) {
  const tests = definitions.map(t => resolveTest(t,evidence,commit));
  const evaluated = stages.map(stage => {
    const required = stage.tests.map(id => tests.find(t => t.id === id));
    const passed = required.filter(t => t?.status === 'PASS').length;
    const criticalFailure = required.some(t => t?.critical && t.status === 'FAIL');
    const allPass = required.length>0 && passed === required.length;
    const green = stage.implemented && !stage.blocked && allPass;
    const status = green ? 'green' : criticalFailure || (!stage.implemented && stage.done.length===0) ? 'red' : 'yellow';
    const percent = green ? 100 : Math.min(99,Math.floor(passed/Math.max(1,required.length)*100));
    return {...stage,status,percent,errors:required.filter(t=>t?.status==='FAIL').map(t=>`${t!.title}: ${t!.evidence?.error || 'Проверката е неуспешна.'}`)};
  });
  const productionReady = evaluated.length>0 && evaluated.every(s=>s.status==='green') && tests.length>0 && tests.every(t=>t.status==='PASS');
  const raw = Math.floor(evaluated.reduce((sum,s)=>sum+s.percent,0)/Math.max(1,evaluated.length));
  return {stages:evaluated,tests,productionReady,percent:productionReady?100:Math.min(99,raw)};
}
