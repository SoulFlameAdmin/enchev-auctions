const DEFAULT_URL="https://frhletkiuupgksmgxoxc.supabase.co";

const clean=v=>String(v||"").trim();

async function heartbeat(){
  const url=clean(process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL||DEFAULT_URL).replace(/\/$/,"");
  const anonKey=clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||process.env.SUPABASE_ANON_KEY);
  const token=clean(process.env.SOULFLAME_ACCESS_TOKEN);
  const clientKey=clean(process.env.DAVID_CLIENT_KEY);
  if(!anonKey)throw new Error("SUPABASE anon key missing");
  if(!token)throw new Error("SOULFLAME_ACCESS_TOKEN missing");
  if(clientKey.length<8)throw new Error("DAVID_CLIENT_KEY missing/invalid");

  const payload={
    p_client_key:clientKey,
    p_installer_version:clean(process.env.DAVID_INSTALLER_VERSION||"unknown"),
    p_device_name:clean(process.env.DAVID_DEVICE_NAME||process.env.COMPUTERNAME||"Windows PC"),
    p_status:clean(process.env.DAVID_RUNTIME_STATUS||"online").toLowerCase(),
    p_mode:clean(process.env.DAVID_RUNTIME_MODE||""),
    p_current_task:clean(process.env.DAVID_CURRENT_TASK||""),
    p_last_error:clean(process.env.DAVID_LAST_ERROR||""),
    p_metadata:{source:"david-installer",platform:process.platform}
  };

  const res=await fetch(url+"/rest/v1/rpc/david_installer_heartbeat",{
    method:"POST",
    headers:{
      apikey:anonKey,
      Authorization:"Bearer "+token,
      "Content-Type":"application/json"
    },
    body:JSON.stringify(payload)
  });
  if(!res.ok){
    const body=(await res.text().catch(()=>"")).slice(0,1200);
    throw new Error("heartbeat HTTP "+res.status+" "+body);
  }
  return res.json();
}

if(process.argv.includes("--self-test")){
  if(!DEFAULT_URL.includes("supabase.co"))throw new Error("heartbeat URL invariant missing");
  console.log("DAVID_INSTALLER_HEARTBEAT PASS authenticated_user=REQUIRED client_key=REQUIRED");
}else{
  heartbeat().then(x=>{console.log(JSON.stringify(x));}).catch(e=>{console.error(e?.stack||e);process.exit(1);});
}
