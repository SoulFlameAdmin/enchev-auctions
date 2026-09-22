const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const normalize=(v)=>String(v||"").replace(/\s+/g," ").trim();
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
    'button[aria-label*="Спри"]'
  ]){
    try{
      const b=page.locator(selector).last();
      if(await b.count()&&await b.isVisible().catch(()=>false))return true;
    }catch{}
  }
  return false;
}

async function fillComposer(page,text){
  for(let attempt=1;attempt<=10;attempt++){
    let c=await composer(page);
    if(!c){await sleep(250);continue;}
    try{
      await c.fill(text,{timeout:1800});
      const v=await composerText(c);
      if(v.length>0)return c;
    }catch{}

    c=await composer(page);
    if(!c){await sleep(250);continue;}
    try{
      await c.focus({timeout:1200});
      await page.keyboard.press("Control+A");
      await page.keyboard.insertText(text);
      const v=await composerText(c);
      if(v.length>0)return c;
    }catch{}
    await sleep(250);
  }
  throw new Error("ChatGPT composer unavailable or could not be filled");
}

async function waitAck(page,baselineUserCount,expected,timeoutMs=5000){
  const end=Date.now()+timeoutMs;
  let emptySince=0;
  while(Date.now()<end){
    const count=await userCount(page);
    if(count>baselineUserCount)return {ok:true,signal:"user-count-increased"};

    const latest=await latestUserText(page);
    if(latest&&latest===expected)return {ok:true,signal:"latest-user-matches"};

    const c=await composer(page);
    const current=await composerText(c);
    if(!current){
      if(!emptySince)emptySince=Date.now();
      if(await generating(page))return {ok:true,signal:"composer-cleared-and-generating"};
      if(Date.now()-emptySince>=1200)return {ok:true,signal:"composer-cleared"};
    }else{
      emptySince=0;
    }
    await sleep(250);
  }
  return {ok:false,signal:"no-acceptance-signal"};
}

async function visibleSendButton(page){
  for(const selector of SEND_SELECTORS){
    try{
      const b=page.locator(selector).last();
      if(await b.count()&&await b.isVisible().catch(()=>false)&&await b.isEnabled().catch(()=>false)){
        return {button:b,selector};
      }
    }catch{}
  }
  return null;
}

export async function sendPromptVerified(page,text,{worker="DAVID",onEvent=null,ackTimeoutMs=5000}={}){
  const emit=(stage,data={})=>{
    try{onEvent?.(stage,{worker,...data,at:new Date().toISOString()});}catch{}
  };

  const expected=normalize(text);
  const baselineUserCount=await userCount(page);
  emit("PREPARING",{baselineUserCount,textLength:expected.length});

  let c=await fillComposer(page,text);
  emit("FILLED",{composerLength:(await composerText(c)).length});

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
    const already=await waitAck(page,baselineUserCount,expected,500);
    if(already.ok){
      emit("ACK",{attempt:i,method:"pre-retry-check",signal:already.signal});
      return {acknowledged:true,attempt:i,method:"pre-retry-check",signal:already.signal};
    }

    let method="";
    try{
      method=await methods[i]();
      emit("ATTEMPT",{attempt:i+1,method});
    }catch(e){
      lastError=String(e?.message||e);
      emit("ATTEMPT_FAILED",{attempt:i+1,error:lastError});
      continue;
    }

    const ack=await waitAck(page,baselineUserCount,expected,ackTimeoutMs);
    if(ack.ok){
      emit("ACK",{attempt:i+1,method,signal:ack.signal});
      return {acknowledged:true,attempt:i+1,method,signal:ack.signal};
    }

    emit("NO_ACK",{attempt:i+1,method,signal:ack.signal});

    // If the composer is empty, do not risk a duplicate user turn. Wait longer
    // before trying a second submission method.
    const current=await composerText(await composer(page));
    if(!current){
      const lateAck=await waitAck(page,baselineUserCount,expected,5000);
      if(lateAck.ok){
        emit("ACK",{attempt:i+1,method,signal:lateAck.signal});
        return {acknowledged:true,attempt:i+1,method,signal:lateAck.signal};
      }
      lastError="composer cleared but no user-turn acknowledgement appeared";
      break;
    }
  }

  emit("FAILED",{error:lastError||"send was not acknowledged"});
  throw new Error("ChatGPT send not acknowledged: "+(lastError||"no acceptance signal"));
}

if(process.argv.includes("--self-test")){
  if(!SEND_SELECTORS.some(x=>x.includes("send-button")))throw new Error("send-ack self-test: send selector missing");
  if(!COMPOSER_SELECTORS.includes("#prompt-textarea"))throw new Error("send-ack self-test: composer selector missing");
  console.log("DAVID_SEND_ACK_SELF_TEST PASS verified_submission=ON bounded_fallbacks=3 duplicate_guard=ON");
}
