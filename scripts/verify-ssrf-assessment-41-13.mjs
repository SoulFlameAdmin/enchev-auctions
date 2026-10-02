import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const CONFIG_PATH="config/enchev-ssrf-assessment-41-13.json";
const MODULE_PATH="packages/providers/src/outbound-url-policy.ts";
const MASTER_PATH="app/components/MasterSystemPlanV1.tsx";
const PROVIDER_BOUNDARY="packages/providers/boundary.json";
const WORKER_BOUNDARY="apps/worker/boundary.json";

function fail(message){throw new Error("SSRF_ASSESSMENT_41_13 FAIL: "+message);}
function readJson(p){return JSON.parse(fs.readFileSync(p,"utf8"));}
function expectReject(label,fn,code=""){
  let actual="";
  try{fn();}catch(error){actual=String(error);}
  if(!actual||(code&&!actual.includes(code))) fail("negative case not rejected: "+label+" actual="+actual);
}

async function loadModule(){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"enchev-ssrf-41-13-"));
  const tsc=path.resolve("node_modules/typescript/bin/tsc");
  const r=spawnSync(process.execPath,[tsc,MODULE_PATH,"--ignoreConfig","--target","ES2022","--module","ES2022","--moduleResolution","Bundler","--types","node","--skipLibCheck","--outDir",tmp,"--pretty","false"],{encoding:"utf8"});
  if(r.status!==0) fail("provider TypeScript compile failed: "+(r.stderr||r.stdout||"").trim());
  const mod=await import(pathToFileURL(path.join(tmp,"outbound-url-policy.js")).href+"?v="+Date.now());
  return {mod,tmp};
}

const config=readJson(CONFIG_PATH);
if(config.taskId!=="41.13"||config.title!=="SSRF assessment"||config.kind!=="security") fail("task identity drift");
for(const key of ["exactHostAllowlistRequired","httpsOnly","allowedPortsExplicit","ipLiteralUrlsForbidden","userinfoForbidden","fragmentsForbidden","localhostAndInternalHostnamesForbidden","resolvedAddressesRequired","allResolvedAddressesMustBePublic","ipv4PrivateReservedBlocked","ipv6PrivateReservedBlocked","ipv4MappedIpv6Checked","manualRedirectHandlingRequired","everyRedirectRevalidated","dnsRebindingPrivateResolutionRejected","failClosed"]){
  if(config.policy?.[key]!==true) fail("policy guardrail disabled: "+key);
}
for(const key of ["productionEgressFirewallNotClaimed","productionDnsResolverPinningNotClaimed","productionHttpClientIntegrationNotClaimed","liveProviderAllowlistNotClaimed","uploadContentAttackCertificationRemains41_14"]){
  if(config.claimBoundary?.[key]!==true) fail("claim boundary disabled: "+key);
}
if(!Array.isArray(config.abuseScenarios)||config.abuseScenarios.length!==25) fail("abuse scenario coverage drift");

const providers=readJson(PROVIDER_BOUNDARY);
const worker=readJson(WORKER_BOUNDARY);
if(providers.concrete_provider_clients!==false||providers.credential_free!==true) fail("provider repository assessment drift");
if(worker.implementation_state!=="not-implemented") fail("worker repository assessment drift");
if(config.repositoryAssessment?.productionOutboundFetchFound!==false||config.repositoryAssessment?.concreteProviderClientsFound!==false||config.repositoryAssessment?.workerRuntimeImplemented!==false||config.repositoryAssessment?.providerBoundaryCredentialFree!==true) fail("repository assessment config drift");

const master=fs.readFileSync(MASTER_PATH,"utf8");
const p41Start=master.indexOf('["41","Security & abuse certification"');
const p42Start=master.indexOf('["42","Performance certification"');
if(p41Start<0||p42Start<=p41Start) fail("frozen Phase 41 not found");
if(!master.slice(p41Start,p42Start).includes('"SSRF assessment||security"')) fail("frozen 41.13 identity missing");

const {mod:d,tmp}=await loadModule();
const policy=d.validateOutboundUrlPolicy({
  allowedHosts:config.testPolicy.allowedHosts,
  allowedPorts:config.testPolicy.allowedPorts,
  maxRedirects:config.testPolicy.maxRedirects,
  httpsOnly:true,
  requireResolvedAddresses:true,
  manualRedirectHandlingRequired:true,
});

const ok4=d.authorizeOutboundTarget("https://provider.example.com/v1/data",["93.184.216.34"],policy);
if(ok4.hostname!=="provider.example.com"||ok4.port!==443||ok4.resolvedAddresses[0]!=="93.184.216.34") fail("allowed public IPv4 target drift");
const ok6=d.authorizeOutboundTarget("https://media.example.com/assets",["2606:4700:4700::1111"],policy);
if(ok6.hostname!=="media.example.com") fail("allowed public IPv6 target drift");

expectReject("http scheme",()=>d.authorizeOutboundTarget("http://provider.example.com/",["93.184.216.34"],policy),"SSRF_SCHEME_FORBIDDEN");
expectReject("file scheme",()=>d.authorizeOutboundTarget("file:///etc/passwd",["93.184.216.34"],policy),"SSRF_SCHEME_FORBIDDEN");
const userinfoUrl=new URL("https://provider.example.com/");
userinfoUrl.username="test-user";
userinfoUrl.password="test-password";
expectReject("userinfo",()=>d.authorizeOutboundTarget(userinfoUrl.toString(),["93.184.216.34"],policy),"SSRF_USERINFO_FORBIDDEN");
expectReject("custom port",()=>d.authorizeOutboundTarget("https://provider.example.com:8443/",["93.184.216.34"],policy),"SSRF_PORT_FORBIDDEN");
expectReject("fragment",()=>d.authorizeOutboundTarget("https://provider.example.com/a#b",["93.184.216.34"],policy),"SSRF_FRAGMENT_FORBIDDEN");
expectReject("IP literal loopback",()=>d.authorizeOutboundTarget("https://127.0.0.1/",["127.0.0.1"],policy),"SSRF_IP_LITERAL_FORBIDDEN");
expectReject("integer IP loopback normalization",()=>d.authorizeOutboundTarget("https://2130706433/",["127.0.0.1"],policy),"SSRF_IP_LITERAL_FORBIDDEN");
expectReject("localhost",()=>d.authorizeOutboundTarget("https://localhost/",["127.0.0.1"],policy),"SSRF_BLOCKED_HOSTNAME");
expectReject("metadata internal hostname",()=>d.authorizeOutboundTarget("https://metadata.google.internal/",["169.254.169.254"],policy),"SSRF_BLOCKED_HOSTNAME");
expectReject("host not allowlisted",()=>d.authorizeOutboundTarget("https://evil.example.net/",["93.184.216.34"],policy),"SSRF_HOST_NOT_ALLOWLISTED");
expectReject("DNS loopback",()=>d.authorizeOutboundTarget("https://provider.example.com/",["127.0.0.1"],policy),"SSRF_PRIVATE_OR_RESERVED_ADDRESS_FORBIDDEN");
expectReject("DNS RFC1918",()=>d.authorizeOutboundTarget("https://provider.example.com/",["10.1.2.3"],policy),"SSRF_PRIVATE_OR_RESERVED_ADDRESS_FORBIDDEN");
expectReject("DNS metadata link local",()=>d.authorizeOutboundTarget("https://provider.example.com/",["169.254.169.254"],policy),"SSRF_PRIVATE_OR_RESERVED_ADDRESS_FORBIDDEN");
expectReject("DNS CGNAT",()=>d.authorizeOutboundTarget("https://provider.example.com/",["100.64.1.1"],policy),"SSRF_PRIVATE_OR_RESERVED_ADDRESS_FORBIDDEN");
expectReject("IPv6 loopback",()=>d.authorizeOutboundTarget("https://provider.example.com/",["::1"],policy),"SSRF_PRIVATE_OR_RESERVED_ADDRESS_FORBIDDEN");
expectReject("IPv6 ULA",()=>d.authorizeOutboundTarget("https://provider.example.com/",["fd00::1"],policy),"SSRF_PRIVATE_OR_RESERVED_ADDRESS_FORBIDDEN");
expectReject("IPv6 link local",()=>d.authorizeOutboundTarget("https://provider.example.com/",["fe80::1"],policy),"SSRF_PRIVATE_OR_RESERVED_ADDRESS_FORBIDDEN");
expectReject("IPv4 mapped IPv6 private",()=>d.authorizeOutboundTarget("https://provider.example.com/",["::ffff:127.0.0.1"],policy),"SSRF_PRIVATE_OR_RESERVED_ADDRESS_FORBIDDEN");
expectReject("mixed DNS answer",()=>d.authorizeOutboundTarget("https://provider.example.com/",["93.184.216.34","10.0.0.1"],policy),"SSRF_PRIVATE_OR_RESERVED_ADDRESS_FORBIDDEN");
expectReject("empty DNS answer",()=>d.authorizeOutboundTarget("https://provider.example.com/",[],policy),"SSRF_RESOLUTION_EMPTY");

expectReject("redirect disallowed host",()=>d.authorizeOutboundRedirect({
  previous:ok4,nextUrl:"https://evil.example.net/",nextResolvedAddresses:["93.184.216.34"],redirectCount:0
},policy),"SSRF_HOST_NOT_ALLOWLISTED");
expectReject("redirect private resolution",()=>d.authorizeOutboundRedirect({
  previous:ok4,nextUrl:"https://media.example.com/next",nextResolvedAddresses:["10.0.0.4"],redirectCount:0
},policy),"SSRF_PRIVATE_OR_RESERVED_ADDRESS_FORBIDDEN");
expectReject("redirect limit",()=>d.authorizeOutboundRedirect({
  previous:ok4,nextUrl:"https://media.example.com/next",nextResolvedAddresses:["93.184.216.34"],redirectCount:policy.maxRedirects
},policy),"SSRF_REDIRECT_LIMIT_EXCEEDED");
const redirectOk=d.authorizeOutboundRedirect({
  previous:ok4,nextUrl:"https://media.example.com/next",nextResolvedAddresses:["93.184.216.34"],redirectCount:0
},policy);
if(redirectOk.hostname!=="media.example.com") fail("allowed redirect not revalidated");

if(process.argv.includes("--self-test")){
  expectReject("empty allowlist",()=>d.validateOutboundUrlPolicy({...policy,allowedHosts:[]}),"SSRF_ALLOWLIST_REQUIRED");
  expectReject("allowlist IP literal",()=>d.validateOutboundUrlPolicy({...policy,allowedHosts:["127.0.0.1"]}),"SSRF_ALLOWED_HOST_IP_LITERAL_FORBIDDEN");
  expectReject("allowlist internal host",()=>d.validateOutboundUrlPolicy({...policy,allowedHosts:["service.internal"]}),"SSRF_BLOCKED_HOSTNAME");
  expectReject("invalid resolved address",()=>d.authorizeOutboundTarget("https://provider.example.com/",["not-an-ip"],policy),"SSRF_RESOLVED_ADDRESS_INVALID");
  expectReject("duplicate resolution",()=>d.authorizeOutboundTarget("https://provider.example.com/",["93.184.216.34","93.184.216.34"],policy),"SSRF_RESOLUTION_DUPLICATE");
  console.log("SSRF_ASSESSMENT_41_13_SELF_TEST PASS scenarios=25 exact_allowlist=true https_only=true ip_literal_url_rejected=true private_ipv4_rejected=true private_ipv6_rejected=true ipv4_mapped_ipv6_checked=true mixed_dns_fail_closed=true redirects_revalidated=true dns_rebinding_private_rejected=true production_http_client_claim=false production_egress_firewall_claim=false negative_cases=5");
}else{
  console.log("SSRF_ASSESSMENT_41_13 PASS scenarios=25 outbound_policy=true production_http_client_claim=false");
}
setTimeout(()=>fs.rmSync(tmp,{recursive:true,force:true}),0);
