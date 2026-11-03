import fs from "node:fs";
import assert from "node:assert/strict";

const read = (p) => fs.readFileSync(p,"utf8");
const required = [
  "app/manifest.ts",
  "app/pwa-icon/[size]/route.tsx",
  "app/api/pwa-version/route.ts",
  "public/sw.js",
  "app/offline/page.tsx",
  "app/components/EnchevPwaProvider.tsx",
  "app/app/page.tsx",
  "app/app/install/page.tsx",
  "app/app/mobile-app.css",
  "app/components/enchev-pwa.css",
];
for (const path of required) assert.ok(fs.existsSync(path),"Missing PWA file: "+path);

const manifest = read("app/manifest.ts");
assert.match(manifest,/id:\s*"\/app"/);
assert.match(manifest,/start_url:\s*"\/app"/);
assert.match(manifest,/scope:\s*"\/"/);
assert.match(manifest,/display:\s*"standalone"/);
assert.match(manifest,/192x192/);
assert.match(manifest,/512x512/);
assert.match(manifest,/purpose:\s*"maskable"/);

const worker = read("public/sw.js");
assert.match(worker,/request\.method\s*!==\s*"GET"/);
assert.match(worker,/request\.mode\s*!==\s*"navigate"/);
assert.match(worker,/fetch\(request\)\.catch/);
assert.match(worker,/caches\.match\(OFFLINE_URL\)/);
assert.match(worker,/SKIP_WAITING/);
assert.doesNotMatch(worker,/cache\.put\(request/i);
assert.doesNotMatch(worker,/caches\.open\([^)]*\)\.then\(\([^)]*\)\s*=>\s*[^\n]*api\//i);

const provider = read("app/components/EnchevPwaProvider.tsx");
assert.match(provider,/beforeinstallprompt/);
assert.match(provider,/appinstalled/);
assert.match(provider,/navigator\.serviceWorker\.register\("\/sw\.js"/);
assert.match(provider,/\/api\/pwa-version/);
assert.match(provider,/localStorage\.setItem\(VERSION_KEY/);
assert.match(provider,/newVersion|workerWaiting/);
assert.match(provider,/applyUpdate/);

const layout = read("app/layout.tsx");
assert.match(layout,/manifest:\s*"\/manifest\.webmanifest"/);
assert.match(layout,/<EnchevPwaProvider>/);

const center = read("app/components/MasterSystemPlanV1.tsx");
const menuStart = center.indexOf("sideMenuItem urgentMenuFirst");
const menuEnd = center.indexOf("</aside>",menuStart);
assert.ok(menuStart > 0 && menuEnd > menuStart);
const menu = center.slice(menuStart, menuEnd);
assert.ok(menu.includes('href="/app/install"'),"Install menu item missing");
assert.ok(menu.lastIndexOf('href="/app/install"') > menu.lastIndexOf('href="/early-access-admin"'),"Install item must be at the end");
assert.ok(menu.includes("МОБИЛНО ПРИЛОЖЕНИЕ"));

const install = read("app/app/install/page.tsx");
assert.match(install,/promptInstall/);
assert.match(install,/Сподели/);
assert.match(install,/Обнови/);
assert.match(install,/Google Play|APK|магазин/i);

console.log("ENCHEV_PWA_SOURCE_TEST PASS routes=4 icons=192,512 install_menu=last updates=no-reinstall");
