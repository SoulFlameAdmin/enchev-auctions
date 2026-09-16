import {publishEvent} from './publish-event.mjs';
import {isAuthorizedWorkflow} from '../supabase/functions/_shared/ci-identity.ts';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {calculateReadiness,resolveTest} from '../lib/readiness.ts';
import {formatMoney,formatTime,initialMarkets} from '../lib/international.ts';
const plan=JSON.parse(await readFile(new URL('../data/plan.json',import.meta.url),'utf8'));
const commit=process.env.VERCEL_GIT_COMMIT_SHA||process.env.GITHUB_SHA||process.env.BUILD_COMMIT||'local-working-tree';
const report={commit,generatedAt:null,tests:[]};
await mkdir('generated',{recursive:true});
const save=()=>writeFile('generated/evidence.json',JSON.stringify(report,null,2)+'\n');
let failures=0;
async function check(id,fn){
 const item={id,status:'RUNNING',commit,startedAt:new Date().toISOString(),finishedAt:null,durationMs:null,result:'Изпълнява се',error:null,source:process.env.CI?'CI runner':process.env.VERCEL?'Vercel build runner':'local runner'};
 report.tests.push(item);await save();await publishEvent(item);const start=performance.now();
 try{await fn();item.status='PASS';item.result='Проверката премина.';}catch(e){item.status='FAIL';item.result='Проверката е неуспешна.';item.error=id==='typecheck'?'TypeScript проверката не премина. Подробности в защитените build логове.':String(e.message).slice(0,500);failures++;console.error(e);}
 item.finishedAt=new Date().toISOString();item.durationMs=Math.round(performance.now()-start);report.generatedAt=item.finishedAt;await save();await publishEvent(item);console.log(`${item.status} ${id} (${item.durationMs} ms)`);
}
const def={id:'test',title:'test',stages:[1],scope:'unit',critical:true};
const stage={id:1,title:'test',implemented:true,done:['code'],now:'',remaining:[],next:'',blocked:null,tests:['test']};
const evidence=(status='PASS',sha=commit,date='2026-01-01T00:00:00Z')=>({id:'test',status,commit:sha,startedAt:date,finishedAt:date,durationMs:0,result:'actual result',error:null,source:'test runner'});
await check('tracker-rules',()=>{
 const calc=(stages=[stage],e=[evidence()],defs=[def])=>calculateReadiness(stages,defs,e,commit);
 assert.equal(calc().percent,100);assert.equal(calc().productionReady,true);
 assert.equal(calc([{...stage,remaining:['unfinished capability']}]).productionReady,false);
 assert.notEqual(calc([{...stage,remaining:['unfinished capability']}]).stages[0].status,'green');
 assert.equal(calc([stage],[]).stages[0].status,'yellow');assert.equal(calc([stage],[]).productionReady,false);
 assert.equal(calc([stage],[evidence('FAIL')]).stages[0].status,'red');
 assert.equal(calc([{...stage,implemented:false,done:[]}],[]).stages[0].status,'red');
 assert.notEqual(calc([{...stage,implemented:false}]).stages[0].status,'green');
 assert.notEqual(calc([{...stage,blocked:'missing backend'}]).percent,100);
 assert.equal(calc([{...stage,tests:[]}]).productionReady,false);
 assert.equal(calc([{...stage,tests:['unknown']}]).productionReady,false);
 assert.equal(calc([],[],[]).productionReady,false);
 assert.equal(calc([stage],[evidence()],[def,{...def,id:'critical-final'}]).productionReady,false);
 assert.ok(calc([stage],[evidence()],[def,{...def,id:'critical-final'}]).percent<100);
 assert.equal(calc([stage],[evidence('RUNNING')]).productionReady,false);
 const failure=evidence('FAIL',commit,'2026-01-02T00:00:00Z');
 assert.equal(calc([stage],[evidence(),failure]).stages[0].status,'red');
 assert.equal(calc([stage],[failure,evidence('PASS',commit,'2026-01-03T00:00:00Z')]).stages[0].status,'green');
 assert.equal(calc([stage],[evidence('FAIL')],[{...def,critical:false}]).productionReady,false);
});
await check('evidence-freshness',()=>{
 assert.equal(resolveTest(def,[evidence('PASS','old-commit')],commit).status,'NOT RUN');
 assert.equal(resolveTest(def,[{...evidence(),finishedAt:null}],commit).status,'NOT RUN');
 assert.equal(resolveTest(def,[evidence('PASS',commit,'invalid')],commit).status,'NOT RUN');
 assert.equal(resolveTest(def,[{...evidence(),finishedAt:'2025-01-01T00:00:00Z'}],commit).status,'NOT RUN');
 assert.equal(resolveTest(def,[evidence('RUNNING')],commit).status,'FAIL');
 const now=new Date().toISOString();
 assert.equal(resolveTest(def,[{...evidence('RUNNING',commit,now),finishedAt:null}],commit).status,'RUNNING');
 assert.equal(resolveTest(def,[evidence('FAIL',commit,now),evidence('PASS','other',now)],commit).status,'FAIL');
});
await check('plan-coverage',()=>{
 assert.equal(plan.stages.length,28);assert.equal(new Set(plan.stages.map(s=>s.id)).size,28);
 assert.equal(new Set(plan.tests.map(t=>t.id)).size,plan.tests.length);
 for(const s of plan.stages){assert.ok(s.tests.length>0);for(const id of s.tests)assert.ok(plan.tests.some(t=>t.id===id&&t.stages.includes(s.id)),id);}
 for(const t of plan.tests){assert.ok(t.critical);for(const id of t.stages)assert.ok(plan.stages.some(s=>s.id===id&&s.tests.includes(t.id)));}
 const mandatory=['register-login','roles','seller-flow','vehicle-upload','admin-approval','auction-start-end','minimum-bid','max-bid','concurrent-2','concurrent-10','concurrent-100','duplicate-request','bid-at-end','anti-sniping','buy-now-race','deposit','buying-power','winner','payment','duplicate-webhook','refund','documents','private-files','unauthorized-api','sql-injection','xss','malicious-upload','rate-limits','realtime-disconnect','server-restart','database-failure','backup-restore','bmw-e2e'];
 for(const id of mandatory)assert.ok(plan.tests.some(t=>t.id===id),id);
 assert.equal(calculateReadiness(plan.stages,plan.tests,[],commit).productionReady,false);
});
await check('international',()=>{
 const bg=initialMarkets[0];
 assert.match(formatMoney(12345,bg,'bg-BG'),/123,45/);
 assert.equal(formatMoney(12345,{...bg,country:'US',currency:'USD',timeZone:'America/New_York'},'en-US'),'$123.45');
 assert.equal(formatMoney(12345,{...bg,country:'JP',currency:'JPY',currencyDigits:0},'en-US'),'¥12,345');
 assert.throws(()=>formatMoney(1.5,bg,'bg-BG'));assert.throws(()=>formatMoney(Number.MAX_SAFE_INTEGER+1,bg,'bg-BG'));
 assert.throws(()=>formatMoney(100,{...bg,currencyDigits:-1},'bg-BG'));
 assert.throws(()=>formatTime('2026-01-01T12:00:00',bg,'en-GB'));
 assert.match(formatTime('2026-01-01T12:00:00Z',bg,'en-GB'),/14:00/);
 assert.match(formatTime('2026-07-01T12:00:00Z',bg,'en-GB'),/15:00/);
 assert.match(formatTime('2026-01-01T12:00:00Z',{...bg,timeZone:'America/New_York'},'en-GB'),/07:00/);
});
await check('oidc-claims',()=>{
 const valid={repository_id:'1373693893',repository_owner_id:'175710990',repository:'SoulFlameAdmin/enchev-auctions',ref:'refs/heads/staging',event_name:'push',workflow_ref:'SoulFlameAdmin/enchev-auctions/.github/workflows/ci.yml@refs/heads/staging',sha:'a'.repeat(40),run_id:'12345'};
 assert.equal(isAuthorizedWorkflow(valid),true);
 for(const [key,value] of Object.entries({repository_id:'123',repository_owner_id:'999',repository:'evil/fork',ref:'refs/heads/evil',event_name:'pull_request',workflow_ref:'other.yml',sha:'not-a-sha',run_id:'invalid'}))assert.equal(isAuthorizedWorkflow({...valid,[key]:value}),false,key);
});
await check('dependency-audit',()=>{
 const r=spawnSync('npm',['audit','--json'],{encoding:'utf8',timeout:60000});
 if(r.status!==0)throw new Error('Dependency audit failed. Inspect private CI logs.');
 const audit=JSON.parse(r.stdout);assert.equal(audit.metadata.vulnerabilities.total,0);
});
await check('typecheck',()=>{
 const r=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','--noEmit'],{stdio:'inherit'});
 assert.equal(r.status,0,'TypeScript failed');
});
await mkdir('reports',{recursive:true});await writeFile('reports/verification.json',JSON.stringify(report,null,2)+'\n');
console.log(`${report.tests.length} executed; ${plan.tests.length-report.tests.length} not run. Production readiness is NOT claimed.`);
process.exitCode=failures?1:0;
