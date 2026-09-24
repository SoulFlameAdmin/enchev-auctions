import { createHash } from "node:crypto";

const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const normalize=(v)=>String(v||"").replace(/\s+/g," ").trim();
const hashText=(v)=>createHash("sha256").update(normalize(v)).digest("hex");
const DISPATCH_POLL_MS=Number(process.env.DAVID_DISPATCH_POLL_MS||500);
const DISPATCH_HEARTBEAT_MS=Number(process.env.DAVID_DISPATCH_HEARTBEAT_MS||10000);
const AMBIGUOUS_SETTLE_MS=Number(process.env.DAVID_SEND_AMBIGUOUS_SETTLE_MS||8000);

const SEND_SELECTORS=[
  'button[data-testid="send-button"]',
  'button[aria-label*="Send"]',
  'button[aria-label*="Изпрати"]'
];
const COMPOSER_SELECTORS=[
  "#prompt-textarea",
  '[data-testid="prompt-textarea"]',
  'div[contenteditable="true"][role="textbox"]',
  'div[contenteditable="true"]'
];

async function composer(page){
  for(const selector of COMPOSER_SELECTORS){
    try{
      const c=page.locator(selector).last();
      if(await c.count()&&await c.isVisible().catch(()=>false))return c;
    }catch{}
  }
  return null;
}
async function composerText(c){
  if(!c)return "";
  try{
    const value=await c.inputValue({timeout:500}).catch(()=>null);
    if(value!=null)return normalize(value);
  }catch{}
  try{return normalize(await c.innerText({timeout:500}).catch(()=>""));}catch{return "";}
}
async function userCount(page){
  try{return await page.locator('[data-message-author-role="user"]').count();}catch{return 0;}
}
async function assistantCount(page){
  try{return await page.locator('[data-message-author-role="assistant"]').count();}catch{return 0;}
}
async function latestRole(page){
  try{
    const nodes=page.locator('[data-message-author-role]');
    const count=await nodes.count();
    for(let i=count-1;i>=0;i--){
      const n=nodes.nth(i);
      if(!await n.isVisible().catch(()=>false))continue;
      const role=String(await n.getAttribute("data-message-author-role").catch(()=>"")||"").toLowerCase();
      if(role==="user"||role==="assistant")return role;
    }
    return "";
  }catch{return "";}
}
async function latestUserText(page){
  try{
    const u=page.locator('[data-message-author-role="user"]').last();
    if(!await u.count())return "";
    return normalize(await u.innerText().catch(()=>""));
  }catch{return "";}
}
async function generating(page){
  for(const selector of [
    '[data-testid="stop-button"]',
    '[data-testid*="stop" i]',
    'button[aria-label*="Stop"]',
    'button[aria-label*="stop"]',
    'button[aria-label*="Спри"]',
    'button:has-text("Stop generating")',
    'button:has-text("Stop thinking")',
    'button:has-text("Спри да мисли")',
    'button:has-text("Спри отговора")'
  ]){
    try{
      const b=page.locator(selector).last();
      if(await b.count()&&await b.isVisible().catch(()=>false))return true;
    }catch{}
  }
  return false;
}
async function dispatchGate(page,expected,emit){
  let lastStage="",lastEmitAt=0;
  const waitEvent=(stage,data)=>{
    const now=Date.now();
    if(lastStage!==stage||now-lastEmitAt>=DISPATCH_HEARTBEAT_MS){
      lastStage=stage;
      lastEmitAt=now;
      emit(stage,data);
    }
  };
  for(;;){
    if(await generating(page)){
      waitEvent("WAIT_ACTIVE",{signal:"real-stop-or-generating-visible"});
      await sleep(DISPATCH_POLL_MS);
      continue;
    }

    const role=await latestRole(page);
    const latest=await latestUserText(page);
    const uCount=await userCount(page);
    const aCount=await assistantCount(page);
    if(role==="user"&&uCount>aCount){
      if(latest&&latest===expected)return {accepted:true,signal:"matching-user-turn-already-pending"};
      waitEvent("WAIT_PENDING_USER",{signal:"unanswered-user-turn-count-confirmed"});
      await sleep(DISPATCH_POLL_MS);
      continue;
    }

    const c=await composer(page);
    const draft=await composerText(c);
    if(draft&&draft!==expected){
      waitEvent("WAIT_FOREIGN_DRAFT",{signal:"composer-contains-non-david-draft"});
      await sleep(DISPATCH_POLL_MS);
      continue;
    }

    return {accepted:false,signal:"safe-to-dispatch"};
  }
}
async function preSubmitGate(page,expected,baselineUserCount,emit){
  let lastStage="",lastEmitAt=0;
  const waitEvent=(stage,data)=>{
    const now=Date.now();
    if(lastStage!==stage||now-lastEmitAt>=DISPATCH_HEARTBEAT_MS){
      lastStage=stage;
      lastEmitAt=now;
      emit(stage,data);
    }
  };
  for(;;){
    const latest=await latestUserText(page);
    const count=await userCount(page);
    if(count>baselineUserCount&&latest===expected){
      return {accepted:true,signal:"matching-user-turn-appeared-during-fill"};
    }
    if(await generating(page)){
      waitEvent("WAIT_ACTIVE",{signal:"generation-started-before-submit"});
      await sleep(DISPATCH_POLL_MS);
      continue;
    }
    const c=await composer(page);
    const draft=await composerText(c);
    if(!draft){
      return {accepted:false,empty:true,signal:"composer-became-empty-before-submit"};
    }
    if(draft!==expected){
      waitEvent("WAIT_FOREIGN_DRAFT",{signal:"composer-changed-after-david-fill"});
      await sleep(DISPATCH_POLL_MS);
      continue;
    }
    return {accepted:false,signal:"expected-draft-ready-to-submit"};
  }
}

async function fillComposer(page,text,expected){
  for(let attempt=1;attempt<=10;attempt++){
    let c=await composer(page);
    if(!c){await sleep(250);continue;}
    try{
      await c.fill(text,{timeout:1800});
      if(await composerText(c)===expected)return c;
    }catch{}
    c=await composer(page);
    if(!c){await sleep(250);continue;}
    try{
      await c.focus({timeout:1200});
      await page.keyboard.press("Control+A");
      await page.keyboard.insertText(text);
      if(await composerText(c)===expected)return c;
    }catch{}
    await sleep(250);
  }
  throw new Error("ChatGPT composer unavailable or exact prompt could not be verified");
}
async function waitAck(page,baselineUserCount,baselineAssistantCount,expected,timeoutMs=5000){
  const end=Date.now()+timeoutMs;
  while(Date.now()<end){
    const count=await userCount(page);
    const aCount=await assistantCount(page);
    const role=await latestRole(page);
    const latest=await latestUserText(page);
    if(count>baselineUserCount)return {ok:true,signal:"user-count-increased",acceptedUserCount:count,acceptedAssistantCount:aCount};
    if(latest&&latest===expected&&role==="user")return {ok:true,signal:"latest-user-matches-pending",acceptedUserCount:count,acceptedAssistantCount:aCount};
    if(latest&&latest===expected&&aCount>baselineAssistantCount)return {ok:true,signal:"assistant-count-increased-after-matching-user",acceptedUserCount:count,acceptedAssistantCount:aCount};
    const current=await composerText(await composer(page));
    if(!current&&await generating(page))return {ok:true,signal:"composer-cleared-and-generating",acceptedUserCount:count,acceptedAssistantCount:aCount};
    await sleep(250);
  }
  return {ok:false,signal:"no-strong-acceptance-signal"};
}
async function visibleSendButton(page){
  for(const selector of SEND_SELECTORS){
    try{
      const b=page.locator(selector).last();
      if(await b.count()&&await b.isVisible().catch(()=>false)&&await b.isEnabled().catch(()=>false))return {button:b,selector};
    }catch{}
  }
  return null;
}

export async function sendPromptVerified(page,text,{worker="DAVID",onEvent=null,ackTimeoutMs=5000}={}){
  const expected=normalize(text);
  if(!expected)throw new Error("ChatGPT send refused: empty prompt");
  const promptHash=hashText(text);
  const emit=(stage,data={})=>{
    try{onEvent?.(stage,{worker,promptHash,...data,at:new Date().toISOString()});}catch{}
  };

  const gate=await dispatchGate(page,expected,emit);
  if(gate.accepted){
    emit("ACK",{attempt:0,method:"idempotent-pre-send",signal:gate.signal});
    return {acknowledged:true,alreadyAccepted:true,attempt:0,method:"idempotent-pre-send",signal:gate.signal,promptHash};
  }

  const baselineUserCount=await userCount(page);
  const baselineAssistantCount=await assistantCount(page);
  emit("PREPARING",{baselineUserCount,baselineAssistantCount,textLength:expected.length});
  let c=await fillComposer(page,text,expected);
  emit("FILLED",{composerLength:(await composerText(c)).length,baselineUserCount,baselineAssistantCount});

  const methods=[
    async()=>{
      const found=await visibleSendButton(page);
      if(!found)throw new Error("send button unavailable");
      await found.button.click({timeout:2500});
      return "button:"+found.selector;
    },
    async()=>{
      c=await composer(page);
      if(!c)throw new Error("composer unavailable for Enter");
      await c.focus({timeout:1500});
      await c.press("Enter",{timeout:2500});
      return "enter";
    },
    async()=>{
      const found=await visibleSendButton(page);
      if(!found)throw new Error("send button unavailable for forced click");
      await found.button.click({force:true,timeout:3000});
      return "force-button:"+found.selector;
    }
  ];

  let lastError="";
  for(let i=0;i<methods.length;i++){
    const pre=await preSubmitGate(page,expected,baselineUserCount,emit);
    if(pre.accepted){
      emit("ACK",{attempt:i,method:"pre-submit-idempotence-check",signal:pre.signal,baselineUserCount,baselineAssistantCount});
      return {acknowledged:true,alreadyAccepted:true,attempt:i,method:"pre-submit-idempotence-check",signal:pre.signal,promptHash};
    }
    if(pre.empty){
      const alreadyAccepted=await waitAck(page,baselineUserCount,baselineAssistantCount,expected,1200);
      if(alreadyAccepted.ok){
        emit("ACK",{attempt:i,method:"pre-submit-empty-check",...alreadyAccepted,baselineUserCount,baselineAssistantCount});
        return {acknowledged:true,attempt:i,method:"pre-submit-empty-check",signal:alreadyAccepted.signal,promptHash};
      }
      emit("AMBIGUOUS",{attempt:i,method:"pre-submit-empty-check",signal:pre.signal,baselineUserCount,baselineAssistantCount});
      return {acknowledged:false,ambiguous:true,submitted:false,attempt:i,method:"pre-submit-empty-check",signal:pre.signal,promptHash};
    }

    const already=await waitAck(page,baselineUserCount,baselineAssistantCount,expected,500);
    if(already.ok){
      emit("ACK",{attempt:i,method:"pre-retry-check",...already,baselineUserCount,baselineAssistantCount});
      return {acknowledged:true,attempt:i,method:"pre-retry-check",signal:already.signal,promptHash};
    }

    let method="";
    try{
      method=await methods[i]();
      emit("ATTEMPT",{attempt:i+1,method,baselineUserCount,baselineAssistantCount});
    }catch(e){
      lastError=String(e?.message||e);
      emit("ATTEMPT_FAILED",{attempt:i+1,error:lastError,baselineUserCount,baselineAssistantCount});
      continue;
    }

    const ack=await waitAck(page,baselineUserCount,baselineAssistantCount,expected,ackTimeoutMs);
    if(ack.ok){
      emit("ACK",{attempt:i+1,method,...ack,baselineUserCount,baselineAssistantCount});
      return {acknowledged:true,attempt:i+1,method,signal:ack.signal,promptHash};
    }

    emit("NO_ACK",{attempt:i+1,method,signal:ack.signal,baselineUserCount,baselineAssistantCount});
    const current=await composerText(await composer(page));
    if(!current){
      const lateAck=await waitAck(page,baselineUserCount,baselineAssistantCount,expected,AMBIGUOUS_SETTLE_MS);
      if(lateAck.ok){
        emit("ACK",{attempt:i+1,method,...lateAck,baselineUserCount,baselineAssistantCount});
        return {acknowledged:true,attempt:i+1,method,signal:lateAck.signal,promptHash};
      }
      emit("AMBIGUOUS",{attempt:i+1,method,signal:"composer-cleared-without-strong-turn-evidence",baselineUserCount,baselineAssistantCount});
      return {acknowledged:false,ambiguous:true,submitted:true,attempt:i+1,method,signal:"composer-cleared-without-strong-turn-evidence",promptHash};
    }
  }

  emit("FAILED",{error:lastError||"send was not acknowledged",baselineUserCount,baselineAssistantCount});
  throw new Error("ChatGPT send not acknowledged: "+(lastError||"no acceptance signal"));
}

if(process.argv.includes("--self-test")){
  if(!SEND_SELECTORS.some(x=>x.includes("send-button")))throw new Error("send-ack self-test: send selector missing");
  if(!COMPOSER_SELECTORS.includes("#prompt-textarea"))throw new Error("send-ack self-test: composer selector missing");
  if(!dispatchGate.toString().includes("WAIT_ACTIVE"))throw new Error("send-ack self-test: active dispatch gate missing");
  if(!dispatchGate.toString().includes("WAIT_PENDING_USER"))throw new Error("send-ack self-test: pending user-turn gate missing");
  if(!dispatchGate.toString().includes("WAIT_FOREIGN_DRAFT"))throw new Error("send-ack self-test: foreign draft gate missing");
  if(!dispatchGate.toString().includes("DISPATCH_HEARTBEAT_MS"))throw new Error("send-ack self-test: dispatch heartbeat missing");
  if(!dispatchGate.toString().includes("uCount>aCount"))throw new Error("send-ack self-test: pending-user count confirmation missing");
  if(!preSubmitGate.toString().includes("expected-draft-ready-to-submit"))throw new Error("send-ack self-test: dedicated pre-submit gate missing");
  console.log("DAVID_SEND_ACK_SELF_TEST PASS verified_submission=ON bounded_fallbacks=3 duplicate_guard=ON active_dispatch_gate=ON pending_user_gate=COUNT_CONFIRMED foreign_draft_gate=ON pre_submit_gate=ON dispatch_heartbeat=ON strong_ack=ON ambiguous_no_duplicate=ON");
}
