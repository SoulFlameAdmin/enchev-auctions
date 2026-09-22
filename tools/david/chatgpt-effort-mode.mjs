import process from "node:process";

const DEFAULT_TARGET = String(process.env.DAVID_PROJECT_EFFORT_MODE || "medium").toLowerCase();
const RETRY_MS = Number(process.env.DAVID_PROJECT_EFFORT_RETRY_MS || 5000);
const lastAttemptAt = new WeakMap();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function targetRegex(target){
  if(String(target).toLowerCase()==="medium") return /^(medium|средно)$/i;
  if(String(target).toLowerCase()==="instant") return /^(instant|незабавно|незабавен|моментално|бързо)$/i;
  if(String(target).toLowerCase()==="high") return /^(high|високо)$/i;
  return new RegExp("^"+String(target).replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"$","i");
}

const anyEffortRegex = /^(instant|незабавно|незабавен|моментално|бързо|medium|средно|high|високо|extra high|много високо|thinking|мислене|auto|автоматично)$/i;
const effortPickerRegex = /(GPT-5\\.6\\s*Sol|GPT-5\\.6.*(?:Кратко|Short|Средно|Medium|Високо|High|Дълго|Long)|(?:Кратко|Short|Средно|Medium|Високо|High|Дълго|Long))/i;

async function visibleExact(page, regex, selectors){
  const nodes = page.locator(selectors);
  const count = await nodes.count().catch(() => 0);
  for(let i=count-1;i>=0;i--){
    const n=nodes.nth(i);
    if(!await n.isVisible().catch(() => false)) continue;
    const text=(await n.innerText().catch(() => "")).replace(/\s+/g," ").trim();
    const aria=((await n.getAttribute("aria-label").catch(() => ""))||"").replace(/\s+/g," ").trim();
    if(regex.test(text)||regex.test(aria)) return n;
  }
  return null;
}
async function visibleContains(page, regex, selectors){
  const nodes = page.locator(selectors);
  const count = await nodes.count().catch(() => 0);
  for(let i=count-1;i>=0;i--){
    const n=nodes.nth(i);
    if(!await n.isVisible().catch(() => false)) continue;
    const text=(await n.innerText().catch(() => "")).replace(/\s+/g," ").trim();
    const aria=((await n.getAttribute("aria-label").catch(() => ""))||"").replace(/\s+/g," ").trim();
    if(regex.test(text)||regex.test(aria)) return n;
  }
  return null;
}


async function labelOf(node){
  if(!node)return "";
  const text=((await node.innerText().catch(()=>""))||"").replace(/\s+/g," ").trim();
  const aria=((await node.getAttribute("aria-label").catch(()=>""))||"").replace(/\s+/g," ").trim();
  return (text+" "+aria).replace(/\s+/g," ").trim();
}
async function findSolPicker(page){
  const nodes=page.locator('button,[role="button"]');
  const count=await nodes.count().catch(()=>0);
  for(let i=count-1;i>=0;i--){
    const n=nodes.nth(i);
    if(!await n.isVisible().catch(()=>false))continue;
    const label=await labelOf(n);
    if(/GPT-5\.6\s*Sol/i.test(label))return n;
  }
  return null;
}
async function findEffortOption(page,target){
  const wanted=targetRegex(target);
  return await visibleExact(page,wanted,'[role="menuitem"],[role="option"],button,[role="button"]');
}
function mediumLabel(text){return /(?:^|\s)(?:Medium|Средно)(?:\s|$)/i.test(String(text||""));}
function shortLabel(text){return /(?:^|\s)(?:Instant|Кратко|Short)(?:\s|$)/i.test(String(text||""));}

export async function ensureChatGptEffortMode(page, target=DEFAULT_TARGET){
  if(!page || page.isClosed()) return {ok:false,reason:"page-unavailable"};
  if(!String(page.url?.()||"").startsWith("https://chatgpt.com/")) return {ok:false,reason:"not-chatgpt"};

  const picker=await findSolPicker(page);
  if(!picker) return {ok:false,reason:"sol-picker-not-found",target};

  const before=await labelOf(picker);
  if(String(target).toLowerCase()==="medium" && mediumLabel(before))
    return {ok:true,changed:false,target,pickerLabel:before};

  const now=Date.now();
  const last=Number(lastAttemptAt.get(page)||0);
  if(now-last<RETRY_MS) return {ok:false,reason:"cooldown-unconfirmed",target,pickerLabel:before};
  lastAttemptAt.set(page,now);

  for(let attempt=1;attempt<=2;attempt++){
    try{
      await picker.click({timeout:2000});
      await sleep(300);
    }catch{
      return {ok:false,reason:"picker-click-failed",target,pickerLabel:before};
    }

    const option=await findEffortOption(page,target);
    if(!option){
      await page.keyboard.press("Escape").catch(()=>{});
      return {ok:false,reason:"target-option-not-found",target,pickerLabel:before};
    }

    try{
      await option.click({timeout:2000});
      await sleep(500);
    }catch{
      return {ok:false,reason:"target-click-failed",target,pickerLabel:before};
    }

    const freshPicker=await findSolPicker(page);
    const after=await labelOf(freshPicker);
    if(String(target).toLowerCase()==="medium" && mediumLabel(after))
      return {ok:true,changed:true,target,attempt,pickerLabel:after};

    const standalone=await visibleExact(page,targetRegex(target),'button,[role="button"]');
    if(standalone)
      return {ok:true,changed:true,target,attempt,pickerLabel:after||"standalone-medium-confirmed"};

    await page.keyboard.press("Escape").catch(()=>{});
    await sleep(250);
  }

  const finalPicker=await findSolPicker(page);
  const finalLabel=await labelOf(finalPicker);
  return {
    ok:false,
    changed:true,
    target,
    reason:shortLabel(finalLabel)?"still-short-after-medium-click":"not-confirmed",
    pickerLabel:finalLabel
  };
}

if(process.argv.includes("--self-test")){
  const medium=targetRegex("medium");
  if(!medium.test("Medium")||!medium.test("Средно")) throw new Error("medium labels missing");
  if(!anyEffortRegex.test("Instant")||!anyEffortRegex.test("Високо")) throw new Error("effort picker labels missing");
  if(!effortPickerRegex.test("GPT-5.6 Sol Кратко")) throw new Error("composite effort picker missing");
  console.log("CHATGPT_EFFORT_MODE_SELF_TEST PASS target=medium composite_picker=GPT-5.6_Sol");
}
