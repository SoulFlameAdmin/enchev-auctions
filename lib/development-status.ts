import plan from '../data/plan.json';
import report from '../generated/evidence.json';
import {calculateReadiness, type Evidence, type Stage, type Definition} from './readiness';

type CloudEvent={commit_sha:string;branch:string;run_id:string;run_attempt:number;test_id:string;status:'RUNNING'|'PASS'|'FAIL';started_at:string;occurred_at:string;duration_ms:number|null;deployment_url:string|null};
const evidenceEndpoint='https://frhletkiuupgksmgxoxc.supabase.co/functions/v1/enchev-development-status';
const repository = 'SoulFlameAdmin/enchev-auctions';
async function readJSON(url:string, token:string) {
  const response = await fetch(url,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(5000)});
  if (!response.ok) throw new Error(`Provider HTTP ${response.status}`);
  return response.json();
}

export async function developmentStatus() {
  const commit = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || process.env.BUILD_COMMIT || report.commit;
  const branch = process.env.VERCEL_GIT_COMMIT_REF || process.env.GITHUB_REF_NAME || 'local';
  const checkedAt = new Date().toISOString();
  const githubToken=process.env.GITHUB_STATUS_TOKEN;
  const vercelToken=process.env.VERCEL_STATUS_TOKEN;
  const [githubResult,vercelResult,cloudResult] = await Promise.allSettled([
    githubToken ? Promise.all([
      readJSON(`https://api.github.com/repos/${repository}/commits/${encodeURIComponent(branch)}`,githubToken),
      readJSON(`https://api.github.com/repos/${repository}/actions/runs?branch=${encodeURIComponent(branch)}&per_page=5`,githubToken)
    ]) : Promise.resolve(null),
    vercelToken ? readJSON('https://api.vercel.com/v6/deployments?projectId=prj_X3TAEQf9oGE79te9NdNlvB6jnhno&teamId=team_cKaIZfnCMzoiiq80J0MhV0A2&limit=5',vercelToken) : Promise.resolve(null),
    fetch(evidenceEndpoint,{cache:'no-store',signal:AbortSignal.timeout(5000)}).then(async r=>{if(!r.ok)throw new Error('Evidence unavailable');return r.json() as Promise<{events:CloudEvent[]}>;})
  ]);
  let github:{connected:boolean;error:string|null;latestCommit:string|null;runs:{id:number;name:string;state:string;commit:string;url:string;updatedAt:string}[]}={connected:false,error:'Не е конфигуриран read-only GitHub status token. Live CI feed не е свързан.',latestCommit:null,runs:[]};
  if(githubResult.status==='fulfilled' && githubResult.value) {
    const [head,runs]=githubResult.value;
    github={connected:true,error:null,latestCommit:head.sha,runs:(runs.workflow_runs||[]).map((run:{id:number;name:string;status:string;conclusion:string;head_sha:string;html_url:string;updated_at:string})=>({id:run.id,name:run.name,state:run.status==='completed'?(run.conclusion==='success'?'PASS':'FAIL'):'RUNNING',commit:run.head_sha,url:run.html_url,updatedAt:run.updated_at}))};
  } else if(githubResult.status==='rejected') github.error='GitHub връзката е недостъпна. Последният CI резултат не е потвърден.';
  const vercel={connected:vercelResult.status==='fulfilled'&&!!vercelResult.value,error:!vercelToken?'Live deployment feed не е конфигуриран. Показва се обслужващият deployment.':vercelResult.status==='rejected'?'Vercel feed е недостъпен.':null,deployments:vercelResult.status==='fulfilled'&&vercelResult.value?(vercelResult.value.deployments||[]).map((d:{uid:string;state:string;url:string;created:number;meta?:{githubCommitSha?:string}})=>({id:d.uid,state:d.state,url:d.url,created:d.created,commit:d.meta?.githubCommitSha||null})):[]};
  const cloudConnected=cloudResult.status==='fulfilled';
  const cloudEvents:CloudEvent[]=cloudResult.status==='fulfilled'?cloudResult.value.events:[];
  if(cloudConnected&&!github.connected){
    const runs=cloudEvents.filter(e=>e.test_id==='ci-run');
    const unique=runs.filter((e,i)=>runs.findIndex(r=>r.run_id===e.run_id&&r.run_attempt===e.run_attempt)===i);
    github={connected:true,error:null,latestCommit:cloudEvents[0]?.commit_sha||null,runs:unique.map(e=>({id:Number(e.run_id),name:`GitHub CI · ${e.branch} · опит ${e.run_attempt}`,state:e.status==='RUNNING'&&Date.now()-Date.parse(e.started_at)>1800000?'FAIL':e.status,commit:e.commit_sha,url:`https://github.com/${repository}/actions/runs/${e.run_id}`,updatedAt:e.occurred_at}))};
  }
  const remoteEvidence:Evidence[]=cloudEvents.filter(e=>!['ci-run','deployment'].includes(e.test_id)).map(e=>({id:e.test_id,status:e.status,commit:e.commit_sha,startedAt:e.started_at,finishedAt:e.status==='RUNNING'?null:e.occurred_at,durationMs:e.duration_ms,result:e.status==='PASS'?'Проверката премина в GitHub CI.':e.status==='RUNNING'?'Изпълнява се в GitHub CI.':'CI проверката е неуспешна.',error:e.status==='FAIL'?'Виж защитените GitHub Actions логове.':null,source:`GitHub Actions #${e.run_id}`}));
  const readiness=calculateReadiness(plan.stages as Stage[],plan.tests as Definition[],[...remoteEvidence,...report.tests as Evidence[]],commit);
  const required=['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','SUPABASE_SECRET_KEY','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET'];
  const environment=required.map(name=>({name,configured:!!process.env[name]}));
  return {...readiness,checkedAt,commit,branch,environmentName:process.env.VERCEL_ENV||'local',deployment:{url:process.env.VERCEL_URL||null,id:process.env.VERCEL_DEPLOYMENT_ID||null,state:'SERVING'},environment,github,vercel,cloudConnected,cloudEvents,reportGeneratedAt:report.generatedAt,reportCommit:report.commit,
    blockers:[...environment.filter(e=>!e.configured).map(e=>`Липсва ${e.name}`),...(!github.connected?[github.error!]:[]),...(!vercel.connected?[vercel.error!]:[]),'Няма преминал пълен BMW сценарий. Реални наддавания и плащания още не са активни.'],
    decisions:[{id:'ADR-001',text:'Статусите се изчисляват от тестови доказателства за конкретен commit. Няма ръчно маркиране GREEN.'},{id:'ADR-002',text:'За auction данните са нужни изолирани preview/production бази. Само техническите CI доказателства използват отделна enchev_development_events таблица в съществуващата инфраструктура.'},{id:'ADR-003',text:'Суми в цели minor units + currency; UTC в база; locale и timezone само за представяне.'},{id:'ADR-004',text:'Наддаване, Max Bid, Buying Power и winner ще се изпълняват атомарно в PostgreSQL. Браузърът няма право да ги определя.'},{id:'ADR-005',text:'Тракерът показва само обобщени технически резултати. Секрети, лични данни и сурови логове не се публикуват.'},{id:'ADR-006',text:'Обновяване на всеки 15 секунди. При липса на provider връзка това е видим blocker, не симулиран realtime.'}]
  };
}

export type DevelopmentStatus = Awaited<ReturnType<typeof developmentStatus>>;
