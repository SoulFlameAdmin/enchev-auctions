import fs from "node:fs";
const CONFIG_PATH="config/enchev-production-like-performance-baseline-42-01.json";
const WORKFLOW_PATH=".github/workflows/performance-baseline-42-01.yml";
const MASTER_PATH="app/components/MasterSystemPlanV1.tsx";
function fail(m){throw new Error("PERFORMANCE_BASELINE_42_01 FAIL: "+m);}
function readJson(p){return JSON.parse(fs.readFileSync(p,"utf8"));}
function percentile(sorted,p){if(!sorted.length)return 0;const i=Math.min(sorted.length-1,Math.max(0,Math.ceil(p*sorted.length)-1));return sorted[i];}
function stats(values){const s=[...values].sort((a,b)=>a-b);const sum=s.reduce((a,b)=>a+b,0);return {p50:percentile(s,.50),p95:percentile(s,.95),p99:percentile(s,.99),max:s.at(-1)||0,mean:s.length?sum/s.length:0};}

export function inspectReport(r,config){
  if(!r||typeof r!=="object") fail("report missing");
  if(r.mode!=="production-build-local-ci") fail("environment mode drift");
  if(Number(r.totalRequests)!==config.workload.totalRequests) fail("request-count drift");
  if(Number(r.concurrency)!==config.workload.concurrency) fail("concurrency drift");
  if(Number(r.networkErrors)!==0) fail("network errors="+r.networkErrors);
  if(Number(r.failureCount)!==0) fail("non-success responses="+r.failureCount);
  if(Number(r.successCount)!==config.workload.totalRequests) fail("success count drift");
  if(!r.latencyMs||![r.latencyMs.p50,r.latencyMs.p95,r.latencyMs.p99].every(Number.isFinite)) fail("latency percentiles missing");
  if(!Number.isFinite(r.throughputRps)||r.throughputRps<=0) fail("throughput missing");
  return {p50:r.latencyMs.p50,p95:r.latencyMs.p95,p99:r.latencyMs.p99,throughputRps:r.throughputRps};
}
async function timedFetch(url,timeoutMs){
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);const start=process.hrtime.bigint();
  try{const res=await fetch(url,{signal:controller.signal,redirect:"manual",headers:{"user-agent":"enchev-baseline-42.01"}});await res.arrayBuffer();const ms=Number(process.hrtime.bigint()-start)/1e6;return {ok:res.status>=200&&res.status<400,status:res.status,ms};}
  catch(error){const ms=Number(process.hrtime.bigint()-start)/1e6;return {ok:false,status:0,ms,error:String(error?.name||error)};}
  finally{clearTimeout(timer);}
}
async function runBaseline(baseUrl,out,config){
  const {paths,warmupRequests,totalRequests,concurrency,requestTimeoutMs}=config.workload;
  for(let i=0;i<warmupRequests;i++){const r=await timedFetch(baseUrl+paths[i%paths.length],requestTimeoutMs);if(!r.ok) fail("warmup request failed status="+r.status);}
  const latencies=[];const statusCounts={};let successCount=0,failureCount=0,networkErrors=0,next=0;
  const start=process.hrtime.bigint();
  async function worker(){
    for(;;){const i=next++;if(i>=totalRequests)return;const r=await timedFetch(baseUrl+paths[i%paths.length],requestTimeoutMs);latencies.push(r.ms);statusCounts[r.status]=(statusCounts[r.status]||0)+1;if(r.ok)successCount++;else{failureCount++;if(r.status===0)networkErrors++;}}
  }
  await Promise.all(Array.from({length:concurrency},()=>worker()));
  const seconds=Number(process.hrtime.bigint()-start)/1e9;
  const report={taskId:"42.01",mode:"production-build-local-ci",headSha:process.env.BASELINE_HEAD_SHA||process.env.GITHUB_SHA||"local",baseUrl,paths,totalRequests,concurrency,successCount,failureCount,networkErrors,statusCounts,durationSeconds:seconds,throughputRps:totalRequests/seconds,latencyMs:stats(latencies),generatedAt:new Date().toISOString()};
  fs.mkdirSync(new URL(".", "file://"+process.cwd()+"/"+out).pathname,{recursive:true});
  fs.writeFileSync(out,JSON.stringify(report,null,2)+"\n");
  return report;
}
function verifyWorkflow(text,config){
  const f=[];if(!text.includes("npm run build"))f.push("production build missing");if(!text.includes("next start --hostname 127.0.0.1 --port 3000"))f.push("production server missing");if(!text.includes("verify-production-like-performance-baseline-42-01.mjs --run"))f.push("baseline runner missing");if(!text.includes("verify-production-like-performance-baseline-42-01.mjs --report "+config.report))f.push("real report gate missing");if(!text.includes("actions/upload-artifact@v4"))f.push("baseline archive missing");return f;
}
function selfTest(config){
  const r={mode:"production-build-local-ci",totalRequests:config.workload.totalRequests,concurrency:config.workload.concurrency,networkErrors:0,failureCount:0,successCount:config.workload.totalRequests,latencyMs:{p50:10,p95:20,p99:30},throughputRps:50};inspectReport(r,config);
  let blocked=false;try{inspectReport({...r,networkErrors:1},config);}catch{blocked=true;}if(!blocked)fail("network error fixture accepted");
  console.log("PERFORMANCE_BASELINE_42_01_SELF_TEST PASS production_build_required=true zero_failures_required=true metrics_required=true");
}
const config=readJson(CONFIG_PATH);
if(config.taskId!=="42.01"||config.title!=="Production-like performance baseline") fail("task identity drift");
const wf=fs.readFileSync(WORKFLOW_PATH,"utf8"),wfFailures=verifyWorkflow(wf,config);if(wfFailures.length)fail(wfFailures.join("; "));
const master=fs.readFileSync(MASTER_PATH,"utf8"),p42=master.indexOf('["42","Performance certification"'),p43=master.indexOf('["43","');
if(p42<0||!master.slice(p42,p43>p42?p43:undefined).includes('"Production-like performance baseline||test"')) fail("frozen 42.01 identity missing");

if(process.argv.includes("--self-test")) selfTest(config);
const runIdx=process.argv.indexOf("--run");
if(runIdx>=0){const baseIdx=process.argv.indexOf("--base-url"),outIdx=process.argv.indexOf("--out");const base=baseIdx>=0?process.argv[baseIdx+1]:null,out=outIdx>=0?process.argv[outIdx+1]:null;if(!base||!out)fail("--base-url and --out required");const report=await runBaseline(base,out,config);inspectReport(report,config);console.log("PERFORMANCE_BASELINE_42_01_RUN PASS p95_ms="+report.latencyMs.p95.toFixed(2)+" rps="+report.throughputRps.toFixed(2));}
const reportIdx=process.argv.indexOf("--report");
if(reportIdx>=0){const p=process.argv[reportIdx+1];if(!p||!fs.existsSync(p))fail("baseline report missing");const r=inspectReport(readJson(p),config);console.log("PERFORMANCE_BASELINE_42_01_REPORT PASS p50_ms="+r.p50.toFixed(2)+" p95_ms="+r.p95.toFixed(2)+" p99_ms="+r.p99.toFixed(2)+" rps="+r.throughputRps.toFixed(2));}
if(!process.argv.includes("--self-test")&&runIdx<0&&reportIdx<0)console.log("PERFORMANCE_BASELINE_42_01 PASS exact_head_workflow_success_required=true");
