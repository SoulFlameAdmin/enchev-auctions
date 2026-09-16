import {publishEvent} from './publish-event.mjs';
import {setTimeout} from 'node:timers/promises';
const startedAt=new Date().toISOString();
if(!process.env.GITHUB_TOKEN)throw new Error('GitHub token unavailable');
const root='https://api.github.com/repos/SoulFlameAdmin/enchev-auctions';
async function get(path){const r=await fetch(root+path,{headers:{Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error(`Deployment read failed ${r.status}`);return r.json();}
await publishEvent({id:'deployment',status:'RUNNING',startedAt});
let found=false;
for(let i=0;i<24;i++){
 const deployments=await get(`/deployments?sha=${process.env.GITHUB_SHA}&per_page=5`);
 for(const d of deployments){
  const statuses=await get(`/deployments/${d.id}/statuses?per_page=1`);
  const status=statuses[0];if(!status)continue;
  if(['success','failure','error'].includes(status.state)){
   const candidate=status.environment_url||status.target_url;
   const url=candidate?new URL(candidate):null;
   const deploymentUrl=url&&/^enchev-auctions(?:-[a-z0-9-]+)?\.vercel\.app$/.test(url.hostname)?url.origin:undefined;
   await publishEvent({id:'deployment',status:status.state==='success'?'PASS':'FAIL',startedAt,durationMs:Date.now()-Date.parse(startedAt),deploymentUrl});
   console.log(`Deployment ${d.id}: ${status.state}`);found=true;break;
  }
 }
 if(found)break;await setTimeout(5000);
}
if(!found){await publishEvent({id:'deployment',status:'FAIL',startedAt,durationMs:Date.now()-Date.parse(startedAt)});throw new Error('Deployment status not confirmed within 120 seconds');}
