// Browser-level regression for the preserved cinematic-to-marketplace journey.
// Runs against a local built site; it does NOT certify real bidding or payments.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
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
  await caseRun("D002 restored historical media HTTP 200 + SHA-256; missing file HTTP 404",async()=>{
    const manifest=JSON.parse(await readFile("config/forge-assets.json","utf8"));
    const entry=manifest.find(a=>a.path==="media/2480ec12b70d13d46feb.jpg");
    assert.ok(entry,"historically missing file pinned in the asset manifest");
    assert.equal(entry.sha256,"00d7eb76a558c7f82450e25692ee75f90dad9c2b6792766d60027ea77f885b52");
    const recovered=await fetch(base+"/forge/"+entry.path);
    assert.equal(recovered.status,200,"D002 recovered media must return real HTTP 200");
    const bytes=Buffer.from(await recovered.arrayBuffer());
    assert.ok(bytes.length>0,"recovered media is not empty");
    assert.equal(createHash("sha256").update(bytes).digest("hex"),entry.sha256,"served restored media must match immutable SHA-256");
    const absent=await fetch(base+"/forge/media/__d002-definitely-not-present.jpg");
    assert.equal(absent.status,404,"static missing media must not be rewritten into a fake HTTP 200");
    console.log("URGENT_D002_PREVIEW_HTTP PASS repaired_media=200 sha256=verified nonexistent=404 bytes="+bytes.length);
  });
  for (const size of [{width:1440,height:900}, {width:390,height:844}]) {
    const page = await browser.newPage({viewport:size});
    try {
      await caseRun(`Cinematic iframe and platform navigation ${size.width}`, async () => {
        await page.goto(base+"/",{waitUntil:"domcontentloaded"});
        await page.locator('iframe[src="/forge/index.html"]').waitFor();
        const links = page.frameLocator('iframe[src="/forge/index.html"]').locator('a[href^="/"]');
        // Structural navigation checks must not require the first (possibly off-screen) animated link to be visible.
        // Actual top-level navigation and destination rendering are exercised below.
        await links.first().waitFor({timeout:15000,state:"attached"});
        const destinations = await links.evaluateAll(nodes => nodes.map(n => ({
          href:n.getAttribute("href"),target:n.getAttribute("target")
        })).filter(x => x.href && !x.href.startsWith("/forge/")));
        assert.ok(destinations.length >= 3,"Intro must expose platform links");
        assert.ok(destinations.every(x=>x.target==="_top"),"Intro link must open a full platform page");
        const inventoryLink = page.frameLocator('iframe[src="/forge/index.html"]').locator('a[href="/start"]').first();
        // Hydration may mount the canonical buyer-journey CTA after the initial support/home anchors.
        // Wait for the real navigation target rather than asserting against a transient empty DOM.
        await inventoryLink.waitFor({state:"attached",timeout:15000});
        await inventoryLink.evaluate(el => el.click());
        await page.waitForURL(url=>url.pathname==="/start",{timeout:15000});
        assert.ok(!page.url().includes("/forge/"),"Destination must not remain inside Forge iframe");
      });
      await caseRun(`Every cinematic gateway opens a real top-level page ${size.width}`, async () => {
        await page.goto(base+"/",{waitUntil:"domcontentloaded"});
        const frame=page.frameLocator('iframe[src="/forge/index.html"]');
        const endpoints=[
          {href:"/",name:"HOME"},
          {href:"/start",name:"BUY"},
          {href:"/auctions",name:"LIVE AUCTIONS"},
          {href:"/register",name:"REGISTER"},
          {href:"/login",name:"LOGIN"},
          {href:"/payments",name:"PAYMENTS"},
          {href:"/support",name:"SUPPORT"}
        ];
        for(const endpoint of endpoints){
          const anchor=frame.locator('a[href="'+endpoint.href+'"]').first();
          await anchor.waitFor({timeout:15000,state:"attached"});
          assert.equal(await anchor.getAttribute("target"),"_top",endpoint.name+" must leave intro frame");
          await anchor.evaluate(element=>element.click());
          await page.waitForURL(url=>url.pathname===endpoint.href,{timeout:15000});
          assert.ok(await page.locator("main#main-content").count()>0,endpoint.name+" must open real Next.js page");
          await page.goto(base+"/",{waitUntil:"domcontentloaded"});
        }
        const ctas=frame.locator('[data-enchev-cta-label]');
        const count=await ctas.count();
        assert.ok(count>=1,"At least one cinematic CTA must be mapped");
        for(let i=0;i<count;i++){
          const el=ctas.nth(i);
          const data=await el.evaluate(node=>({
            tag:node.tagName,
            href:node.getAttribute("href")||node.getAttribute("data-enchev-cta-href"),
            target:node.getAttribute("target")
          }));
          assert.ok(data.href && data.href.startsWith("/") && !data.href.startsWith("//"),"CTA "+i+" needs real internal destination");
          if(data.tag==="A")assert.equal(data.target,"_top","CTA "+i+" must be top-level");
        }
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
        // The globally shared, accessible drawer replaces the old platform-only desktop/mobile nav.
        await page.getByRole("button",{name:"Отвори главното меню"}).click();
        await page.locator('#ea-unified-drawer a[href="/vehicles"]').click();
        await page.waitForURL(url=>url.pathname==="/vehicles");
      });
      await caseRun(`Working preview price filters and saved vehicles ${size.width}`, async () => {
        await page.goto(base+"/inventory?priceMin=12000&priceMax=13000",{waitUntil:"domcontentloaded"});
        await page.waitForFunction(()=>document.querySelector("main.inventoryPage")?.getAttribute("data-result-count")==="1");
        const car=page.locator(".inventoryCard").first();
        assert.ok((await car.innerText()).includes("BMW M4 F82"),"Price filter must return matching BMW");
        const heart=page.getByRole("button",{name:/Save 2018 BMW M4 F82 to preview watchlist/});
        await heart.click();
        assert.equal(await car.locator(".inventoryHeart").getAttribute("aria-pressed"),"true","Saved heart must update state");
        // Preview favourites persist only inside the legacy demo, never masquerade as a
        // real authenticated buyer account's server-backed watchlist.
        await page.reload({waitUntil:"domcontentloaded"});
        const saved=page.getByRole("button",{name:"Remove 2018 BMW M4 F82 from preview watchlist"});
        await saved.waitFor({timeout:15000});
        assert.equal(await saved.getAttribute("aria-pressed"),"true","Demo favourite survives reload");
        await page.goto(base+"/profile",{waitUntil:"domcontentloaded"});
        assert.equal(await page.locator('.profileWatchlistCard[data-lot-id="EA-10482"]').count(),0,
          "Guest preview favourites must not appear as real buyer-account records");
        await page.goto(base+"/inventory?priceMin=12000&priceMax=13000",{waitUntil:"domcontentloaded"});
        const remove=page.getByRole("button",{name:"Remove 2018 BMW M4 F82 from preview watchlist"});
        await remove.waitFor({timeout:15000});
        await remove.click();
        await page.getByRole("button",{name:"Save 2018 BMW M4 F82 to preview watchlist"}).waitFor();
      });
      if(size.width===1440) {
        await caseRun("Every sample car opens its own correct lot page", async () => {
          const lots=[
            ["EA-10482","2018 BMW M4 F82","WBS3R9C50JAK10482"],
            ["EA-10511","2021 Mercedes-Benz GLC","WDC0G4KB1MF10511"],
            ["EA-10539","2022 Audi RS3 Sportback","WUAZZZ8Y2NA10539"],
            ["EA-10603","2026 Volkswagen Golf GTI","WVWZZZCD6TW10603"],
            ["EA-10627","2020 BMW X5 xDrive40i","5UXCR6C02L910627"],
            ["EA-10644","2019 Mercedes-AMG C43","WDDWJ6EB5KF10644"],
            ["EA-10671","2021 Audi Q7 55 TFSI","WA1LXAF75MD10671"],
            ["EA-10702","2023 Porsche Macan S","WP1AB2A59PL10702"],
          ];
          for(const [lot,title,vin] of lots){
            await page.goto(base+"/lot/"+lot,{waitUntil:"domcontentloaded"});
            assert.equal((await page.locator(".lotTitleRow h1").innerText()).trim(),title,lot+" correct model");
            assert.ok((await page.locator(".lotSpecs").innerText()).includes(vin),lot+" correct VIN");
          }
          await page.goto(base+"/lot/EA-99999",{waitUntil:"domcontentloaded"});
          await page.getByText("Preview lot not found",{exact:true}).waitFor();
        });
      }
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
