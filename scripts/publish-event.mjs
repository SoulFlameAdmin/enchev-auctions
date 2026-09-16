const endpoint='https://frhletkiuupgksmgxoxc.supabase.co/functions/v1/enchev-development-status';
export async function publishEvent(event){
 if(!process.env.ACTIONS_ID_TOKEN_REQUEST_URL || !['push','workflow_dispatch'].includes(process.env.GITHUB_EVENT_NAME))return;
 const url=new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);url.searchParams.set('audience','enchev-development-status');
 const tokenResponse=await fetch(url,{headers:{Authorization:`Bearer ${process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}`},signal:AbortSignal.timeout(10000)});
 if(!tokenResponse.ok)throw new Error(`OIDC unavailable (${tokenResponse.status})`);
 const token=await tokenResponse.json();
 const response=await fetch(endpoint,{method:'POST',headers:{Authorization:`Bearer ${token.value}`,'Content-Type':'application/json'},body:JSON.stringify(event),signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw new Error(`Evidence publisher rejected (${response.status})`);
}
if(process.argv[1]?.endsWith('/publish-event.mjs'))await publishEvent({id:process.argv[2],status:process.argv[3],startedAt:process.env.RUN_STARTED_AT||new Date().toISOString(),durationMs:null});
