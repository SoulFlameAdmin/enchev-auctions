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


export async function ensureChatGptEffortMode(page, target=DEFAULT_TARGET){
  if(!page || page.isClosed()) return {ok:false,reason:"page-unavailable"};
  if(!String(page.url?.()||"").startsWith("https://chatgpt.com/")) return {ok:false,reason:"not-chatgpt"};

  const now=Date.now();
  const last=Number(lastAttemptAt.get(page)||0);
  if(now-last<RETRY_MS) return {ok:false,reason:"cooldown"};
  lastAttemptAt.set(page,now);

  const wanted=targetRegex(target);
  const compositeWanted = String(target).toLowerCase()==="medium"
    ? /(GPT-5\.6\s*Sol.*(?:Medium|Средно)|(?:Medium|Средно).*GPT-5\.6\s*Sol)/i
    : String(target).toLowerCase()==="instant"
      ? /(GPT-5\.6\s*Sol.*(?:Instant|Кратко|Short)|(?:Instant|Кратко|Short).*GPT-5\.6\s*Sol)/i
      : /(GPT-5\.6\s*Sol.*(?:High|Високо|Дълго|Long)|(?:High|Високо|Дълго|Long).*GPT-5\.6\s*Sol)/i;
  const currentWanted=await visibleContains(page,compositeWanted,'button,[role="button"]');
  if(currentWanted) return {ok:true,changed:false,target};

  const picker=await visibleContains(page,effortPickerRegex,'button,[role="button"]');
  if(!picker) return {ok:false,reason:"picker-not-found",target};

  try{
    await picker.click({timeout:1500});
    await sleep(200);
  }catch{
    return {ok:false,reason:"picker-click-failed",target};
  }

  const option=await visibleExact(page,wanted,'[role="menuitem"],[role="option"],button,[role="button"]');
  if(!option){
    await page.keyboard.press("Escape").catch(() => {});
    return {ok:false,reason:"target-option-not-found",target};
  }

  try{
    await option.click({timeout:1500});
    await sleep(200);
  }catch{
    return {ok:false,reason:"target-click-failed",target};
  }

  const confirmed=await visibleContains(page,compositeWanted,'button,[role="button"]');
  return {ok:Boolean(confirmed),changed:true,target,reason:confirmed?"confirmed":"not-confirmed"};
}

if(process.argv.includes("--self-test")){
  const medium=targetRegex("medium");
  if(!medium.test("Medium")||!medium.test("Средно")) throw new Error("medium labels missing");
  if(!anyEffortRegex.test("Instant")||!anyEffortRegex.test("Високо")) throw new Error("effort picker labels missing");
  if(!effortPickerRegex.test("GPT-5.6 Sol Кратко")) throw new Error("composite effort picker missing");
  console.log("CHATGPT_EFFORT_MODE_SELF_TEST PASS target=medium composite_picker=GPT-5.6_Sol");
}
