import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import process from "node:process";

const HOST = "127.0.0.1";
const PORT = 9445;
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(.:)/, "$1"));
const STARTER = path.join(HERE, "start-auto-continue.ps1");
const STATE_FILE = path.join(HERE, ".david-enchev-state.json");
const RESUME_ONCE_FILE = path.join(HERE, ".david-resume-once");
const POWERSHELL = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");

let child = null;
let startedAt = null;
let lastExit = null;
let intentionalStop = false;
let logs = [];

function log(line) {
  const text = String(line || "").trim();
  if (!text) return;
  const row = `${new Date().toISOString()} ${text}`;
  logs.push(row);
  if (logs.length > 40) logs = logs.slice(-40);
  console.log(row);
}

function readJson(file, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { return fallback; }
}

function workerRunning() {
  return Boolean(child && child.exitCode === null && !child.killed);
}

function markResumeOnce() {
  fs.writeFileSync(RESUME_ONCE_FILE, new Date().toISOString(), "utf8");
}

function startWorker(forceResume = false) {
  if (workerRunning()) return { ok: true, alreadyRunning: true, pid: child.pid };
  if (forceResume) markResumeOnce();

  intentionalStop = false;
  const args = [
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", STARTER,
    "-Port", "9444",
    "-MaxTurns", "2147483647"
  ];

  child = spawn(POWERSHELL, args, {
    cwd: HERE,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"]
  });
  startedAt = new Date().toISOString();
  lastExit = null;
  log(`[CONTROL] Real local DAVID worker started pid=${child.pid}${forceResume ? " force-resume" : ""}`);

  child.stdout.on("data", (d) => String(d).split(/\r?\n/).forEach(log));
  child.stderr.on("data", (d) => String(d).split(/\r?\n/).forEach((x) => log(`[stderr] ${x}`)));
  child.on("exit", (code, signal) => {
    lastExit = { code, signal, at: new Date().toISOString() };
    log(`[CONTROL] Worker exited code=${code} signal=${signal || "none"}`);
    child = null;

    const state = readJson(STATE_FILE, {});
    if (!intentionalStop && !state.stopped && code !== 0) {
      log("[CONTROL] Unexpected exit. Auto-restart in 5s.");
      setTimeout(() => startWorker(false), 5000);
    }
  });

  return { ok: true, pid: child.pid, mode: "local-pc-chatgpt-worker" };
}

function stopWorker() {
  if (!workerRunning()) return { ok: true, alreadyStopped: true };
  intentionalStop = true;
  const pid = child.pid;
  try {
    spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { windowsHide: true });
  } catch {}
  child = null;
  log(`[CONTROL] Worker stopped pid=${pid}`);
  return { ok: true };
}

async function restartWorker(forceResume = true) {
  stopWorker();
  await new Promise((r) => setTimeout(r, 900));
  return startWorker(forceResume);
}

function status() {
  const state = readJson(STATE_FILE, { turnsSent: 0, stopped: false });
  return {
    online: true,
    mode: "local-pc-chatgpt-worker",
    workerRunning: workerRunning(),
    pid: workerRunning() ? child.pid : null,
    startedAt,
    lastExit,
    turnsSent: Number(state.turnsSent || 0),
    relayAttempts: Number(state.relayAttempts || 0),
    recoveryAttempt: Number(state.recoveryAttempt || 0),
    watchdog: state.watchdog || null,
    pendingSince: state.pendingSince || null,
    stopped: Boolean(state.stopped),
    stopReason: state.stopReason || null,
    lastAssistantHash: state.lastAssistantHash || null,
    lastAction: state.lastAction || null,
    stateUpdatedAt: state.updatedAt || null,
    lastLog: logs.at(-1) || null,
    recentLogs: logs.slice(-10)
  };
}

function cors(req, res) {
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Private-Network", "true");
  res.setHeader("Cache-Control", "no-store");
}

function json(req, res, code, payload) {
  cors(req, res);
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

const server = http.createServer(async (req, res) => {
  cors(req, res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);
  try {
    if (req.method === "GET" && (url.pathname === "/status" || url.pathname === "/health")) {
      return json(req, res, 200, status());
    }
    if (req.method === "POST" && url.pathname === "/start") {
      return json(req, res, 200, startWorker(true));
    }
    if (req.method === "POST" && url.pathname === "/restart") {
      return json(req, res, 200, await restartWorker(true));
    }
    if (req.method === "POST" && url.pathname === "/stop") {
      return json(req, res, 200, stopWorker());
    }
    return json(req, res, 404, { ok: false, error: "not_found" });
  } catch (error) {
    log(`[CONTROL] ${error?.stack || error}`);
    return json(req, res, 500, { ok: false, error: String(error?.message || error) });
  }
});

server.listen(PORT, HOST, () => {
  log(`[CONTROL] DAVID bridge online at http://${HOST}:${PORT}`);
  const state = readJson(STATE_FILE, { stopped: false });
  if (!state.stopped) {
    setTimeout(() => startWorker(false), 1200);
  } else {
    log("[CONTROL] Previous DAVID_STOP preserved. Use the site button to resume intentionally.");
  }
});

process.on("SIGINT", () => { intentionalStop = true; stopWorker(); server.close(() => process.exit(0)); });
process.on("SIGTERM", () => { intentionalStop = true; stopWorker(); server.close(() => process.exit(0)); });
