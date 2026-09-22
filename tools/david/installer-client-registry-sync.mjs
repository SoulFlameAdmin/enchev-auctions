import fs from "node:fs";
import path from "node:path";

const HERE=path.dirname(new URL(import.meta.url).pathname.replace(/^\/(.:)/,"$1"));
const ROOT=path.resolve(HERE,"..","..");
const OUT=path.join(HERE,".david-installer-clients.json");
const DEFAULT_URL="https://frhletkiuupgksmgxoxc.supabase.co";
const POLL_MS=Math.max(3000,Number(process.env.DAVID_INSTALLER_CLIENTS_POLL_MS||5000));

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const now=()=>new Date().toISOString();

function parseEnvFile(file){
  if(!fs.existsSync(file))return {};
  const out={};
  for(const raw of fs.readFileSync(file,"utf8").split(/\r?\n/)){
    const line=raw.trim();
    if(!line||line.startsWith("#"))continue;
    const i=line.indexOf("=");
    if(i<1)continue;
    const key=line.slice(0,i).trim();
    let value=line.slice(i+1).trim();
    if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'"))){
      value=value.slice(1,-1);
    }
    out[key]=value;
  }
  return out;
}

function config(){
  const merged={
    ...parseEnvFile(path.join(ROOT,".env")),
    ...parseEnvFile(path.join(ROOT,".env.local")),
    ...process.env
  };
  return {
    url:merged.NEXT_PUBLIC_SUPABASE_URL||merged.SUPABASE_URL||DEFAULT_URL,
    anonKey:merged.NEXT_PUBLIC_SUPABASE_ANON_KEY||merged.SUPABASE_ANON_KEY||""
  };
}

function write(data){
  const tmp=OUT+".tmp";
  fs.writeFileSync(tmp,JSON.stringify(data,null,2),"utf8");
  fs.renameSync(tmp,OUT);
}

function normalize(row){
  return {
    name:String(row?.display_name||"Installer client"),
    installerVersion:String(row?.installer_version||"unknown"),
    deviceName:String(row?.device_name||""),
    connectionStatus:String(row?.connection_status||"OFFLINE").toUpperCase(),
    runtimeStatus:String(row?.runtime_status||"").toUpperCase(),
    mode:String(row?.mode||""),
    currentTask:String(row?.current_task||""),
    lastError:String(row?.last_error||""),
    lastSeenAt:row?.last_seen_at||null
  };
}

async function fetchSnapshot(){
  const {url,anonKey}=config();
  if(!anonKey)throw new Error("missing Supabase anon key (NEXT_PUBLIC_SUPABASE_ANON_KEY)");

  const res=await fetch(url.replace(/\/$/,"")+"/rest/v1/rpc/david_installer_clients_snapshot",{
    method:"POST",
    headers:{
      apikey:anonKey,
      Authorization:"Bearer "+anonKey,
      "Content-Type":"application/json"
    },
    body:"{}"
  });
  if(!res.ok){
    const body=(await res.text().catch(()=>"")).slice(0,1200);
    throw new Error("snapshot HTTP "+res.status+" "+body);
  }
  const rows=await res.json();
  const clients=Array.isArray(rows)?rows.map(normalize):[];
  const online=clients.filter(x=>x.connectionStatus==="ONLINE").length;
  const working=clients.filter(x=>x.runtimeStatus==="WORKING").length;
  return {version:1,updatedAt:now(),online,working,total:clients.length,clients,error:null};
}

async function cycle(){
  try{
    write(await fetchSnapshot());
  }catch(e){
    const previous=(()=>{try{return JSON.parse(fs.readFileSync(OUT,"utf8"));}catch{return null;}})();
    write({
      version:1,
      updatedAt:now(),
      online:previous?.online||0,
      working:previous?.working||0,
      total:previous?.total||0,
      clients:Array.isArray(previous?.clients)?previous.clients:[],
      error:String(e?.message||e)
    });
  }
}

async function main(){
  if(process.argv.includes("--self-test")){
    const sample=normalize({
      display_name:"BORKO",
      installer_version:"1.0.0",
      connection_status:"online",
      runtime_status:"working"
    });
    if(sample.name!=="BORKO"||sample.connectionStatus!=="ONLINE"||sample.runtimeStatus!=="WORKING"){
      throw new Error("installer client registry normalize self-test failed");
    }
    console.log("DAVID_INSTALLER_CLIENT_REGISTRY_SYNC PASS dynamic_only=ON hardcoded_people=OFF heartbeat_registry=ON");
    return;
  }
  while(true){
    await cycle();
    await sleep(POLL_MS);
  }
}

main().catch(e=>{write({version:1,updatedAt:now(),online:0,working:0,total:0,clients:[],error:String(e?.stack||e)});process.exit(1);});
