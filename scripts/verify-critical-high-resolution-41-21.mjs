import fs from "node:fs";
const CONFIG_PATH="config/enchev-critical-high-resolution-41-21.json";
const MASTER_PATH="app/components/MasterSystemPlanV1.tsx";
function fail(m){throw new Error("CRITICAL_HIGH_RESOLUTION_41_21 FAIL: "+m);}
function readJson(p){return JSON.parse(fs.readFileSync(p,"utf8"));}
export function inspectEvidence(e,config){
  if(!e||typeof e!=="object"||!e.sources||typeof e.sources!=="object") fail("sources evidence missing");
  for(const source of config.requiredSources){
    if(e.sources[source]?.completed!==true) fail("required source incomplete: "+source);
    if(typeof e.sources[source]?.evidenceRef!=="string"||e.sources[source].evidenceRef.length<3) fail("source evidenceRef missing: "+source);
  }
  if(!Array.isArray(e.findings)) fail("findings array missing");
  let openCritical=0,openHigh=0;
  for(const f of e.findings){
    const sev=String(f.severity||"").toLowerCase();
    if(!["critical","high"].includes(sev)) continue;
    const resolved=f.status==="resolved"&&f.verified===true&&typeof f.resolutionEvidence==="string"&&f.resolutionEvidence.length>2;
    if(!resolved){if(sev==="critical") openCritical++;else openHigh++;}
  }
  if(openCritical||openHigh) fail("unresolved Critical/High findings critical="+openCritical+" high="+openHigh);
  if(typeof e.externalPentestEvidenceSha256!=="string"||!/^[a-f0-9]{64}$/i.test(e.externalPentestEvidenceSha256)) fail("external pentest evidence SHA-256 missing");
  return {sources:config.requiredSources.length,critical:0,high:0};
}
function selfTest(config){
  const sources=Object.fromEntries(config.requiredSources.map(s=>[s,{completed:true,evidenceRef:"artifact:"+s}]));
  const good={sources,findings:[{id:"x",severity:"high",status:"resolved",verified:true,resolutionEvidence:"retest:x"}],externalPentestEvidenceSha256:"b".repeat(64)};
  inspectEvidence(good,config);
  let blocked=false;try{inspectEvidence({...good,sources:{...sources,"external-pentest-41.20":{completed:false,evidenceRef:"none"}}},config);}catch{blocked=true;}if(!blocked) fail("missing pentest source accepted");
  blocked=false;try{inspectEvidence({...good,findings:[{id:"x",severity:"critical",status:"open",verified:false,resolutionEvidence:""}]},config);}catch{blocked=true;}if(!blocked) fail("open critical accepted");
  console.log("CRITICAL_HIGH_RESOLUTION_41_21_SELF_TEST PASS all_sources_required=true open_critical_high_blocked=true");
}
const config=readJson(CONFIG_PATH);
if(config.taskId!=="41.21"||config.title!=="All Critical/High findings resolved") fail("task identity drift");
const master=fs.readFileSync(MASTER_PATH,"utf8"),p41=master.indexOf('["41","Security & abuse certification"'),p42=master.indexOf('["42","Performance certification"');
if(p41<0||p42<=p41||!master.slice(p41,p42).includes('"All Critical/High findings resolved||security"')) fail("frozen 41.21 identity missing");
const idx=process.argv.indexOf("--evidence");
if(idx>=0){const p=process.argv[idx+1];if(!p||!fs.existsSync(p)) fail("resolution evidence file missing");const r=inspectEvidence(readJson(p),config);console.log("CRITICAL_HIGH_RESOLUTION_41_21_EVIDENCE PASS sources="+r.sources+" open_critical=0 open_high=0");}
if(process.argv.includes("--self-test")) selfTest(config);
if(idx<0&&!process.argv.includes("--self-test")) fail("real aggregate security evidence required; self-test alone cannot mark 41.21 GREEN");
