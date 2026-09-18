import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(.:)/, "$1"));
const SYSTEM = path.join(HERE, "auto-continue-enchev-v5.mjs");
const DESIGN = path.join(HERE, "auto-continue-design-v1.mjs");
const APK = path.join(HERE, "auto-continue-david-apk-v1.mjs");
const INTERRUPT_GUARD = path.join(HERE, "connection-interruption-guard.mjs");
const NODE = process.execPath;
const children = new Map();
let shuttingDown = false;

const specs = [
  {
    name: "SYSTEM",
    script: SYSTEM,
    env: {
      DAVID_CHAT_URL: "https://chatgpt.com/c/6aab44e1-385c-83eb-b122-c4ae9836cb71",
      DAVID_STATE_FILE: path.join(HERE, ".david-enchev-state.json")
    }
  },
  {
    name: "DESIGN",
    script: DESIGN,
    env: {
      DAVID_DESIGN_CHAT_URL: "https://chatgpt.com/c/6aab25f8-e68c-83eb-ba1a-9e3fda3d5eb7",
      DAVID_DESIGN_STATE_FILE: path.join(HERE, ".david-enchev-design-state.json")
    }
  },
  {
    name: "APK",
    script: APK,
    env: {
      DAVID_APK_STATE_FILE: path.join(HERE, ".david-apk-state.json")
    }
  },
  {
    name: "INTERRUPT",
    script: INTERRUPT_GUARD,
    env: {
      DAVID_INTERRUPT_POLL_MS: "500",
      DAVID_INTERRUPT_RETRY_COOLDOWN_MS: "8000"
    }
  }
];

function pipe(name, stream, target) {
  let pending = "";
  stream.on("data", (chunk) => {
    pending += String(chunk);
    const rows = pending.split(/\r?\n/);
    pending = rows.pop() || "";
    rows.filter(Boolean).forEach((row) => target.write(`[${name}] ${row}\n`));
  });
}

function launch(spec) {
  if (shuttingDown) return;
  const child = spawn(NODE, [spec.script], {
    cwd: HERE,
    windowsHide: false,
    env: {
      ...process.env,
      DAVID_CDP_URL: process.env.DAVID_CDP_URL || "http://127.0.0.1:9444",
      DAVID_MAX_TURNS: process.env.DAVID_MAX_TURNS || "2147483647",
      ...spec.env
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  children.set(spec.name, child);
  console.log(`[DUAL] ${spec.name} worker started pid=${child.pid}`);
  pipe(spec.name, child.stdout, process.stdout);
  pipe(spec.name, child.stderr, process.stderr);
  child.on("exit", (code, signal) => {
    children.delete(spec.name);
    console.log(`[DUAL] ${spec.name} exited code=${code} signal=${signal || "none"}`);
    if (!shuttingDown) {
      console.log(`[DUAL] Restarting ${spec.name} in 3000ms...`);
      setTimeout(() => launch(spec), 3000);
    }
  });
}

function shutdown() {
  shuttingDown = true;
  for (const child of children.values()) {
    try { child.kill("SIGTERM"); } catch {}
  }
  setTimeout(() => process.exit(0), 1000);
}

console.log("[DUAL] DAVID dual-session mode ON.");
console.log("[DUAL] SYSTEM tab: 6aab44e1-385c-83eb-b122-c4ae9836cb71");
console.log("[DUAL] DESIGN tab: 6aab25f8-e68c-83eb-ba1a-9e3fda3d5eb7");
console.log("[DUAL] APK tab: auto-discover DAVID Phone / SoulFlame Twins / DAVID APK session; exact DAVID_APK_CHAT_URL wins when provided.");
console.log("[DUAL] INTERRUPTION GUARD: watches every ChatGPT conversation tab in this DAVID Edge profile.");
console.log("[DUAL] If ChatGPT shows connection interrupted: STOP response -> paste last user prompt -> SEND again.");
console.log("[DUAL] SYSTEM + DESIGN + APK share the same Edge CDP/profile on port 9444. APP2/DPP may run beside them in the same profile.");
specs.forEach(launch);

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
