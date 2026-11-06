// ENCHEV-only plan evidence endpoint.
// Read: the repository's already-public verified evidence, polled only by the admin UI.
// Write: GitHub main-branch verify-enchev-web workflow via signature-verified OIDC only.
// No auction-authority tables or client credentials are ever used.
const PROJECT="ejfrnjhlggebzmpmxajl";
const ISSUER="https://token.actions.githubusercontent.com";
const REPO="SoulFlameAdmin/enchev-auctions";
const REPO_ID="1373693893";
const WORKFLOW=REPO+"/.github/workflows/verify-enchev-web.yml@refs/heads/main";
const AUDIENCE="enchev-plan-state";
const MAX_BODY=60000;
const DB_URL=Deno.env.get("SUPABASE_URL")||"";
const DB_KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const cors={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Methods":"GET,POST,OPTIONS",
  "Access-Control-Allow-Headers":"authorization,content-type",
  "Cache-Control":"no-store"
};
function json(data,status=200){
  return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8",...cors}});
}
function invalid(status=403){return json({error:"unauthorized"},status);}
function decode(value){
  if(!/^[A-Za-z0-9_-]+$/.test(value)||value.length>14000)throw Error("bad JWT encoding");
  const input=value.replace(/-/g,"+").replace(/_/g,"/");
  const padded=input+"=".repeat((4-input.length%4)%4);
  return Uint8Array.from(atob(padded),c=>c.charCodeAt(0));
}
function parseJwtPart(value){return JSON.parse(new TextDecoder().decode(decode(value)));}
async function verifyGithubOidc(auth){
  if(!auth||!auth.startsWith("Bearer ")||auth.length>16000)throw Error("missing OIDC");
  const raw=auth.slice(7).trim();
  const segments=raw.split(".");
  if(segments.length!==3)throw Error("bad OIDC");
  const header=parseJwtPart(segments[0]);
  const claims=parseJwtPart(segments[1]);
  if(header.alg!=="RS256"||typeof header.kid!=="string"||header.kid.length>128)throw Error("unexpected OIDC header");
  const response=await fetch(ISSUER+"/.well-known/jwks",{signal:AbortSignal.timeout(7000)});
  if(!response.ok)throw Error("OIDC provider unavailable");
  const keys=await response.json();
  const jwk=(keys.keys||[]).find(k=>k.kid===header.kid&&k.kty==="RSA"&&(!k.alg||k.alg==="RS256")&&(!k.use||k.use==="sig"));
  if(!jwk)throw Error("untrusted OIDC key");
  const key=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
  const bytes=new TextEncoder().encode(segments[0]+"."+segments[1]);
  if(!await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,decode(segments[2]),bytes))throw Error("invalid OIDC signature");
  const now=Math.floor(Date.now()/1000);
  const audience=claims.aud;
  if(claims.iss!==ISSUER||(audience!==AUDIENCE&&!(Array.isArray(audience)&&audience.includes(AUDIENCE)))||
     typeof claims.exp!=="number"||claims.exp<=now||claims.exp>now+650||
     typeof claims.iat!=="number"||claims.iat>now+30||claims.iat<now-650||
     (claims.nbf!==undefined&&(typeof claims.nbf!=="number"||claims.nbf>now+30)))throw Error("invalid issuer/audience/time");
  if(claims.repository!==REPO||String(claims.repository_id)!==REPO_ID||
     claims.ref!=="refs/heads/main"||claims.sub!=="repo:"+REPO+":ref:refs/heads/main"||
     claims.event_name!=="push"||claims.workflow_ref!==WORKFLOW||
     !/^[0-9a-f]{40}$/.test(claims.sha||"")||!/^[0-9]+$/.test(String(claims.run_id||""))){
    throw Error("OIDC claims deny write");
  }
  return claims;
}
function dbRequest(path,options={}){
  if(!DB_URL.startsWith("https://"+PROJECT+".supabase.co")||!DB_KEY)throw Error("Enchev project binding missing");
  return fetch(DB_URL+"/rest/v1/"+path,{
    ...options,
    headers:{
      apikey:DB_KEY,
      Authorization:"Bearer "+DB_KEY,
      "Content-Type":"application/json",
      ...(options.headers||{})
    },
    signal:AbortSignal.timeout(15000),
    cache:"no-store"
  });
}
const ID=/^([0-9]{2}\.[0-9]{2}|GAP-[0-9]{3,})$/;
function validateRows(body,claims){
  if(!Array.isArray(body.rows)||body.rows.length===0||body.rows.length>120)throw Error("invalid batch size");
  const seen=new Set();
  return body.rows.map(row=>{
    if(!row||typeof row!=="object"||!ID.test(row.taskId||"")||
       row.status!=="green"||typeof row.evidence!=="string"||
       row.evidence.trim().length===0||row.evidence.length>4000||
       (row.blocker!==null&&row.blocker!==undefined)||
       seen.has(row.taskId))throw Error("invalid verified evidence row");
    seen.add(row.taskId);
    return {
      task_id:row.taskId,status:"green",evidence:row.evidence,blocker:null,
      updated_at:new Date().toISOString(),
      source_commit:claims.sha,
      source_run_id:String(claims.run_id),
      source_workflow:WORKFLOW
    };
  });
}
Deno.serve(async request=>{
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
  if(request.method==="GET"){
    if(new URL(request.url).searchParams.has("stream"))
      return json({error:"Use bounded five-minute admin polling; full-snapshot SSE is disabled."},410);
    try{
      const upstream=await dbRequest("enchev_plan_state?select=task_id,status,evidence,blocker,updated_at,source_commit,source_run_id,source_workflow&order=task_id.asc&limit=5000");
      if(!upstream.ok)return json({error:"Enchev governance read unavailable"},503);
      const rows=await upstream.json();
      if(!Array.isArray(rows))return json({error:"Invalid governance read"},503);
      return json({rows});
    }catch{return json({error:"Enchev governance temporarily unavailable"},503);}
  }
  if(request.method!=="POST")return json({error:"method not allowed"},405);
  let claims;
  try{claims=await verifyGithubOidc(request.headers.get("authorization"));}
  catch{return invalid(401);}
  if(!(request.headers.get("content-type")||"").toLowerCase().startsWith("application/json"))return json({error:"content-type"},415);
  if(Number(request.headers.get("content-length")||0)>MAX_BODY)return json({error:"batch exceeds limit"},413);
  try{
    const raw=await request.text();
    if(raw.length>MAX_BODY)return json({error:"batch exceeds limit"},413);
    const rows=validateRows(JSON.parse(raw),claims);
    const upstream=await dbRequest("enchev_plan_state?on_conflict=task_id",{
      method:"POST",
      headers:{"Prefer":"resolution=merge-duplicates,return=minimal"},
      body:JSON.stringify(rows)
    });
    if(!upstream.ok)return json({error:"Enchev governance write unavailable"},503);
    return json({ok:true,written:rows.length,source_commit:claims.sha});
  }catch{return json({error:"invalid evidence batch or temporary DB failure"},400);}
});
