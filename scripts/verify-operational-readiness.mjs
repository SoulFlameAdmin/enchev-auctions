import fs from "node:fs";

const CONFIG_PATH="config/enchev-operational-readiness.json";

function fail(message){throw new Error(`OPERATIONAL_READINESS FAIL: ${message}`);}
function equal(a,b,label){if(JSON.stringify(a)!==JSON.stringify(b))fail(`${label} drift`);}

export function validate(config,health,approval,scaling,dataLifecycle){
  if(config?.phaseId!=="30"||config?.phaseName!=="Operational readiness")fail("phase identity mismatch");
  const ids=Array.from({length:14},(_,i)=>`30.${String(i+1).padStart(2,"0")}`);
  equal(config.tasks?.map(x=>x.id),ids,"frozen task registry");
  if(config.reviewCompleted!==true||config.productionLaunchApproved!==false)fail("review must be complete without claiming launch approval");

  const sourceSet=new Set(config.sourceContracts||[]);
  for(const source of ["config/enchev-health-endpoints.json","config/enchev-production-approval-gate.json","config/enchev-scaling-runbook.json","config/enchev-data-lifecycle-privacy.json"]){
    if(!sourceSet.has(source))fail(`source contract missing ${source}`);
  }

  const owners=config.serviceOwnership||[];
  for(const service of ["web","api","realtime","worker","postgresql","redis","object-storage","identity","observability"]){
    const row=owners.find(x=>x.service===service);
    if(!row||!row.ownerRole||!row.escalation)fail(`30.01 owner missing for ${service}`);
  }
  for(const endpoint of health.endpoints||[]){
    const owner=owners.find(x=>x.service===endpoint.component);
    if(!owner||owner.healthPath!==endpoint.path)fail(`30.01 health ownership mismatch for ${endpoint.component}`);
  }

  const expectedRunbooks=[
    ["30.02","web-api-outage"],["30.03","realtime-outage"],["30.04","worker-outage"],["30.05","database-outage"],
    ["30.06","redis-outage"],["30.07","storage-provider-outage"],["30.08","data-corruption"],["30.09","credential-compromise"]
  ];
  for(const [taskId,id] of expectedRunbooks){
    const rb=(config.runbooks||[]).find(x=>x.taskId===taskId&&x.id===id);
    if(!rb)fail(`${taskId} runbook missing`);
    for(const section of ["detect","contain","recover","verify","never"]){
      if(!Array.isArray(rb[section])||rb[section].length===0)fail(`${taskId} ${section} section missing`);
    }
  }

  const database=config.runbooks.find(x=>x.id==="database-outage");
  if(!database.contain.some(x=>x.includes("fail closed"))||!database.never.some(x=>x.includes("projection")))fail("30.05 database authority guard missing");
  const redis=config.runbooks.find(x=>x.id==="redis-outage");
  if(!redis.contain.some(x=>x.includes("PostgreSQL authoritative"))||!redis.never.some(x=>x.includes("auction truth")))fail("30.06 Redis authority boundary missing");
  const corruption=config.runbooks.find(x=>x.id==="data-corruption");
  if(!corruption.contain.some(x=>x.includes("freeze affected writes"))||!corruption.never.some(x=>x.includes("overwrite evidence")))fail("30.08 corruption containment/evidence guard missing");
  const credential=config.runbooks.find(x=>x.id==="credential-compromise");
  if(!credential.contain.some(x=>x.includes("revoke/disable"))||!credential.recover.some(x=>x.includes("rotate credential")))fail("30.09 credential revoke/rotate sequence missing");

  const severities=config.severityModel||[];
  equal(severities.map(x=>x.id),["SEV-0","SEV-1","SEV-2","SEV-3"],"30.10 severity model");
  if(severities[0].incidentCommanderRequired!==true||severities[0].securityLeadRequired!==true||severities[0].responseMinutes>5)fail("30.10 SEV-0 response guard missing");

  if(config.escalation?.singleIncidentCommanderAtATime!==true)fail("30.11 single incident commander rule missing");
  for(const duty of ["declare severity and scope","protect authoritative auction correctness before availability","record decisions and timestamps"]){
    if(!config.escalation.incidentCommanderDuties.includes(duty))fail(`30.11 IC duty missing: ${duty}`);
  }

  const pm=config.postmortemTemplate;
  if(pm?.blameless!==true||pm?.authorityImpactQuestionRequired!==true||pm?.customerDataImpactQuestionRequired!==true)fail("30.12 postmortem guard missing");
  for(const section of ["summary","impact","timeline","root-cause","corrective-actions","owners-and-dates","evidence-links"]){
    if(!pm.requiredSections.includes(section))fail(`30.12 postmortem section missing ${section}`);
  }

  const change=config.changeProcedure;
  if(change?.productionApprovalGateMustRemainEnforced!==true||change?.emergencyDoesNotAuthorizeSecurityBypass!==true||change?.emergencyDoesNotAuthorizeDestructiveUnreviewedDataRepair!==true)fail("30.13 emergency change guard missing");
  if(approval.approval?.explicitHumanApprovalRequired!==true||approval.approval?.implicitApprovalForbidden!==true)fail("30.13 production approval source contract weakened");
  if(scaling.reviewPolicy?.changeRequiresEvidenceAndApproval!==true)fail("30.13 scaling change evidence/approval source weakened");

  const review=config.operationalReview;
  if(review?.completed!==true||review?.launchApproved!==false)fail("30.14 review truth boundary drift");
  if(!Array.isArray(review.knownBlockers)||review.knownBlockers.length<5)fail("30.14 known blockers must remain explicit");
  if(!review.knownBlockers.some(x=>x.includes("01.06"))||!review.knownBlockers.some(x=>x.includes("29.08")))fail("30.14 upstream blockers missing");
  if(dataLifecycle.backupAlignment?.greenEligible!==false)fail("30.14 may not hide Phase 29 backup blocker");

  for(const key of Object.keys(config.greenRules||{}))if(config.greenRules[key]!==true)fail(`GREEN rule disabled: ${key}`);
  return {tasks:14,services:owners.length,runbooks:config.runbooks.length,blockers:review.knownBlockers.length};
}

const config=JSON.parse(fs.readFileSync(CONFIG_PATH,"utf8"));
const health=JSON.parse(fs.readFileSync("config/enchev-health-endpoints.json","utf8"));
const approval=JSON.parse(fs.readFileSync("config/enchev-production-approval-gate.json","utf8"));
const scaling=JSON.parse(fs.readFileSync("config/enchev-scaling-runbook.json","utf8"));
const dataLifecycle=JSON.parse(fs.readFileSync("config/enchev-data-lifecycle-privacy.json","utf8"));
const result=validate(config,health,approval,scaling,dataLifecycle);

if(process.argv.includes("--self-test")){
  let cases=0;
  const reject=(label,mutate)=>{
    const candidate=structuredClone(config);
    mutate(candidate);
    let rejected=false;
    try{validate(candidate,health,approval,scaling,dataLifecycle);}catch{rejected=true;}
    if(!rejected)fail(`negative self-test not rejected: ${label}`);
    cases++;
  };
  reject("drop task",c=>c.tasks.pop());
  reject("fake launch approval",c=>{c.productionLaunchApproved=true;});
  reject("remove database runbook",c=>{c.runbooks=c.runbooks.filter(x=>x.id!=="database-outage");});
  reject("weaken Redis authority",c=>{c.runbooks.find(x=>x.id==="redis-outage").contain=[];});
  reject("remove credential revoke",c=>{c.runbooks.find(x=>x.id==="credential-compromise").contain=[];});
  reject("remove SEV-0 IC",c=>{c.severityModel[0].incidentCommanderRequired=false;});
  reject("allow emergency security bypass",c=>{c.changeProcedure.emergencyDoesNotAuthorizeSecurityBypass=false;});
  reject("hide blockers",c=>{c.operationalReview.knownBlockers=[];});
  console.log(`OPERATIONAL_READINESS_SELF_TEST PASS cases=${cases} tasks=${result.tasks} runbooks=${result.runbooks}`);
}else{
  console.log(`OPERATIONAL_READINESS PASS phase=30 tasks=${result.tasks} services=${result.services} runbooks=${result.runbooks} review_completed=true launch_approved=false blockers=${result.blockers}`);
}
