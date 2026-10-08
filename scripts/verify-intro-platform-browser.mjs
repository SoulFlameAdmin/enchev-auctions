// Browser-level regression for the preserved cinematic-to-marketplace journey.
// Runs against a local built site; it does NOT certify real bidding or payments.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("/tmp/enchev-browser/node_modules/playwright");

const base = process.env.BASE_URL || "http://127.0.0.1:3000";
const browser = await chromium.launch({ headless: true });
const failures = [];
async function caseRun(name, body) {
  try { await body(); console.log("PASS " + name); }
  catch (error) { failures.push(name + ": " + String(error?.message ?? error)); console.error("FAIL " + name, error); }
}

try {
  for (const size of [{width:1440,height:900}, {width:390,height:844}]) {
    const page = await browser.newPage({viewport:size});
    try {
      await caseRun(`Cinematic iframe and platform navigation ${size.width}`, async () => {
        await page.goto(base+"/",{waitUntil:"domcontentloaded"});
        await page.locator('iframe[src="/forge/index.html"]').waitFor();
        const links = page.frameLocator('iframe[src="/forge/index.html"]').locator('a[href^="/"]');
        await links.first().waitFor({timeout:15000});
        const destinations = await links.evaluateAll(nodes => nodes.map(n => ({
          href:n.getAttribute("href"),target:n.getAttribute("target")
        })).filter(x => x.href && !x.href.startsWith("/forge/")));
        assert.ok(destinations.length >= 3,"Intro must expose platform links");
        assert.ok(destinations.every(x=>x.target==="_top"),"Intro link must open a full platform page");
        const inventoryLink = page.frameLocator('iframe[src="/forge/index.html"]').locator('a[href="/inventory"]').first();
        assert.ok(await inventoryLink.count()>0,"Intro must link directly to inventory");
        await inventoryLink.evaluate(el => el.click());
        await page.waitForURL(url=>url.pathname==="/inventory",{timeout:15000});
        assert.ok(!page.url().includes("/forge/"),"Destination must not remain inside Forge iframe");
      });
      await caseRun(`Classic marketplace and brand/model discovery ${size.width}`, async () => {
        await page.goto(base+"/platform",{waitUntil:"domcontentloaded"});
        await page.locator(".eaHomeDiscoveryV2").waitFor({timeout:12000});
        await page.locator('a[href="/inventory?make=BMW"]').first().click();
        await page.waitForURL(url=>url.pathname==="/inventory" && url.searchParams.get("make")==="BMW",{timeout:12000});
        const brand = page.locator('select[aria-label="Филтър по марка"]');
        if (size.width < 768) {
          await page.locator(".inv2MobileFiltersToggle").click();
        }
        await brand.waitFor();
        await page.waitForFunction(()=>document.querySelector('select[aria-label="Филтър по марка"]')?.value==="BMW");
        const model = page.locator('select[aria-label="Филтър по модел"]');
        await model.selectOption("M4 F82");
        await page.waitForFunction(()=>new URL(location.href).searchParams.get("model")==="M4 F82");
        const status = page.locator('select[aria-label="Филтър по статус на търга"]');
        await status.selectOption("LIVE");
        await page.waitForFunction(()=>new URL(location.href).searchParams.get("status")==="LIVE");
        if (size.width < 768) {
          await page.locator(".eaAppMenuButton").click();
          await page.locator('#ea-mobile-navigation a[href="/platform"]').click();
        } else {
          await page.locator('.eaAppDesktopNav a[href="/platform"]').click();
        }
        await page.waitForURL(url=>url.pathname==="/platform");
      });
      await caseRun(`LIVE and vehicle-history routes ${size.width}`, async () => {
        await page.goto(base+"/live-auctions",{waitUntil:"domcontentloaded"});
        await page.locator(".livePage").waitFor();
        const state = await page.request.get(base+"/api/live-auction-clock");
        assert.equal(state.status(),200,"Demo server clock endpoint HTTP 200");
        const j=await state.json();
        assert.equal(j.auctionAuthority,false,"Live clock must not falsely claim authoritative production bidding");
        await page.goto(base+"/vehicle-history",{waitUntil:"domcontentloaded"});
        await page.locator(".historyPage").waitFor();
      });
    } finally { await page.close(); }
  }
} finally { await browser.close(); }
if(failures.length) {
  console.error("Browser parity failures ("+failures.length+"):\n"+failures.join("\n"));
  process.exitCode=1;
} else {
  console.log("Browser parity smoke PASS desktop+mobile; authenticated/real-money paths are NOT proven.");
}
