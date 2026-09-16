import {createRemoteJWKSet,jwtVerify} from 'npm:jose@6.2.12';
import {isAuthorizedWorkflow} from '../_shared/ci-identity.ts';
const issuer='https://token.actions.githubusercontent.com';
const jwks=createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks`));
const repository='SoulFlameAdmin/enchev-auctions';
const headers={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
const table='enchev_development_events';
const allowedTests=new Set(['tracker-rules','evidence-freshness','plan-coverage','international','typecheck','dependency-audit','status-api','staging-smoke','production-smoke','tracker-ui','ci-run','deployment','oidc-claims']);
async function database(query:string,init:RequestInit={}){
 const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
 return fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/${table}${query}`,{...init,headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',...(init.headers||{})}});
}
Deno.serve(async(req:Request)=>{
 try{
  if(req.method==='GET'){
   const url=new URL(req.url),sha=url.searchParams.get('commit');
   if(sha&&!/^[a-f0-9]{40}$/.test(sha))return reply({error:'Invalid commit'},400);
   const query=`?select=commit_sha,branch,run_id,run_attempt,test_id,status,started_at,occurred_at,duration_ms,deployment_url&order=occurred_at.desc&limit=250${sha?`&commit_sha=eq.${sha}`:''}`;
   const response=await database(query);
   if(!response.ok)return reply({error:'Evidence store unavailable'},503);
   return reply({events:await response.json(),checkedAt:new Date().toISOString()});
  }
  if(req.method!=='POST')return reply({error:'Method not allowed'},405);
  const bearer=req.headers.get('Authorization');
  if(!bearer?.startsWith('Bearer '))return reply({error:'GitHub OIDC required'},401);
  let claims;
  try{({payload:claims}=await jwtVerify(bearer.slice(7),jwks,{issuer,audience:'enchev-development-status',algorithms:['RS256'],maxTokenAge:'10m',clockTolerance:5}));}catch{return reply({error:'Invalid GitHub identity'},401);}
  const ref=String(claims.ref||'');
  if(!isAuthorizedWorkflow(claims))return reply({error:'Workflow not authorized'},403);
  if(Number(req.headers.get('content-length')||0)>4096)return reply({error:'Payload too large'},413);
  const raw=await req.text();if(raw.length>4096)return reply({error:'Payload too large'},413);
  let body;try{body=JSON.parse(raw);}catch{return reply({error:'Invalid JSON'},400);}
  if(!allowedTests.has(body.id)||!['RUNNING','PASS','FAIL'].includes(body.status))return reply({error:'Invalid event'},400);
  const parsedStart=Date.parse(body.startedAt);
  if(!Number.isFinite(parsedStart)||Math.abs(Date.now()-parsedStart)>3600000)return reply({error:'Invalid start time'},400);
  if(body.durationMs!=null&&(!Number.isSafeInteger(body.durationMs)||body.durationMs<0||body.durationMs>3600000))return reply({error:'Invalid duration'},400);
  let deployment_url:null|string=null;
  if(body.deploymentUrl){const parsed=new URL(body.deploymentUrl);if(parsed.protocol!=='https:'||!/^enchev-auctions(?:-[a-z0-9-]+)?\.vercel\.app$/.test(parsed.hostname)||parsed.username||parsed.password||parsed.search||parsed.hash)return reply({error:'Invalid deployment URL'},400);deployment_url=parsed.origin;}
  // Identity and commit come from the signed token, never from request JSON.
  // No free-text logs or errors are persisted in this publicly readable feed.
  const response=await database('?on_conflict=run_id,run_attempt,test_id,status',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify({commit_sha:claims.sha,branch:ref.slice(11),run_id:String(claims.run_id),run_attempt:Number(claims.run_attempt||1),test_id:body.id,status:body.status,started_at:new Date(parsedStart).toISOString(),duration_ms:body.durationMs??null,deployment_url})});
  if(!response.ok)return reply({error:'Evidence write failed'},503);
  return reply({accepted:true},202);
 }catch{return reply({error:'Request could not be processed'},500);}
});
