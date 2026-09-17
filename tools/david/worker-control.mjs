import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import process from "node:process";

const HOST = "127.0.0.1";
const PORT = 9445;
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(.:)/, "$1"));
const REPO_ROOT = path.resolve(HERE, "..", "..");
const STARTER = path.join(HERE, "start-auto-continue.ps1");
const STATE_FILE = path.join(HERE, ".david-enchev-state.json");
const DESIGN_STATE_FILE = path.join(HERE, ".david-enchev-design-state.json");
const PACKAGE_FILE = path.join(HERE, "package.json");
const POWERSHELL = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
const PORTABLE_GIT = "D:\\ASI\\tools\\PortableGit\\cmd\\git.exe";

let child = null;
let startedAt = null;
let lastExit = null;
let intentionalStop = false;
let logs = [];
let lastGitSync = null;

function log(line) {
  const text = String(line || "").trim();
  if (!text) return;
  const row = `${new Date().toISOString()} ${text}`;
  logs.push(row);
  if (logs.length > 80) logs = logs.slice(-80);
  console.log(row);
}

function readJson(file, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { return fallback; }
}

function workerRunning() {
  return Boolean(child && child.exitCode === null && !child.killed);
}

function resolveGit() {
  if (fs.existsSync(PORTABLE_GIT)) return PORTABLE_GIT;
  const probe = spawnSync("git", ["--version"], { windowsHide: true, encoding: "utf8" });
  return probe.status === 0 ? "git" : null;
}

function syncRepoBeforeStart() {
  const git = resolveGit();
  if (!git || !fs.existsSync(path.join(REPO_ROOT, ".git"))) {
    lastGitSync = { ok: false, skipped: true, reason: "git-unavailable", at: new Date().toISOString() };
    log("[CONTROL] Git sync skipped: Git/repository unavailable.");
    return lastGitSync;
  }

  const dirty = spawnSync(git, ["-C", REPO_ROOT, "status", "--porcelain"], { windowsHide: true, encoding: "utf8" });
  if (dirty.status !== 0) {
    lastGitSync = { ok: false, skipped: true, reason: "status-failed", at: new Date().toISOString() };
    log("[CONTROL] Git sync skipped: git status failed.");
    return lastGitSync;
  }
  if (String(dirty.stdout || "").trim()) {
    lastGitSync = { ok: false, skipped: true, reason: "working-tree-dirty", at: new Date().toISOString() };
    log("[CONTROL] Git sync skipped: local working tree has changes; preserving them.");
    return lastGitSync;
  }

  log("[CONTROL] Syncing latest DAVID code from origin/main before start...");
  const pull = spawnSync(git, ["-C", REPO_ROOT, "pull", "--ff-only", "origin", "main"], {
    windowsHide: true,
    encoding: "utf8",
    timeout: 120000
  });
  const out = `${pull.stdout || ""}\n${pull.stderr || ""}`.trim();
  if (out) out.split(/\r?\n/).slice(-12).forEach((line) => log(`[GIT] ${line}`));
  lastGitSync = { ok: pull.status === 0, skipped: false, code: pull.status, at: new Date().toISOString() };
  if (pull.status === 0) log("[CONTROL] Git sync complete. Starting latest DAVID dual worker.");
  else log(`[CONTROL] Git sync failed (code ${pull.status}); starting existing local version.`);
  return lastGitSync;
}

function startWorker() {
  if (workerRunning()) return { ok: true, alreadyRunning: true, pid: child.pid };
  syncRepoBeforeStart();
  intentionalStop = false;

  child = spawn(POWERSHELL, [
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", STARTER,
    "-Port", "9444",
    "-MaxTurns", "2147483647"
  ], {
    cwd: HERE,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"]
  });

  startedAt = new Date().toISOString();
  lastExit = null;
  log(`[CONTROL] Real local DAVID dual worker started pid=${child.pid}`);
  child.stdout.on("data", (d) => String(d).split(/\r?\n/).forEach(log));
  child.stderr.on("data", (d) => String(d).split(/\r?\n/).forEach((x) => log(`[stderr] ${x}`)));
  child.on("exit", (code, signal) => {
    lastExit = { code, signal, at: new Date().toISOString() };
    log(`[CONTROL] Worker exited code=${code} signal=${signal || "none"}`);
    child = null;
    if (!intentionalStop) {
      log("[CONTROL] Worker is not supposed to stop. Auto-restart in 3s.");
      setTimeout(() => startWorker(), 3000);
    }
  });

  return { ok: true, pid: child.pid, mode: "local-pc-chatgpt-dual-worker", gitSync: lastGitSync };
}

function stopWorker() {
  if (!workerRunning()) return { ok: true, alreadyStopped: true };
  intentionalStop = true;
  const pid = child.pid;
  try { spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { windowsHide: true }); } catch {}
  child = null;
  log(`[CONTROL] Worker manually stopped pid=${pid}`);
  return { ok: true };
}

async function restartWorker() {
  stopWorker();
  await new Promise((r) => setTimeout(r, 700));
  return startWorker();
}

function compactState(state) {
  return {
    turnsSent: Number(state.turnsSent || 0),
    relayAttempts: Number(state.relayAttempts || 0),
    recoveryAttempt: Number(state.recoveryAttempt || 0),
    watchdog: state.watchdog || null,
    problem: state.problem || null,
    problemAttempts: Number(state.problemAttempts || 0),
    problemRetryAt: state.problemRetryAt || null,
    lastResult: state.lastResult || null,
    lastAction: state.lastAction || null,
    updatedAt: state.updatedAt || null,
    lastAssistantHash: state.lastAssistantHash || null
  };
}

function status() {
  const state = readJson(STATE_FILE, { turnsSent: 0 });
  const designState = readJson(DESIGN_STATE_FILE, { turnsSent: 0 });
  const pkg = readJson(PACKAGE_FILE, {});
  return {
    online: true,
    mode: "local-pc-chatgpt-dual-worker",
    workerVersion: pkg.version || null,
    workerScript: pkg?.scripts?.start || null,
    workerRunning: workerRunning(),
    pid: workerRunning() ? child.pid : null,
    startedAt,
    lastExit,
    lastGitSync,
    turnsSent: Number(state.turnsSent || 0),
    relayAttempts: Number(state.relayAttempts || 0),
    recoveryAttempt: Number(state.recoveryAttempt || 0),
    watchdog: state.watchdog || null,
    problem: state.problem || null,
    problemAttempts: Number(state.problemAttempts || 0),
    problemRetryAt: state.problemRetryAt || null,
    platformBlocker: state.platformBlocker || null,
    platformRetryAt: state.platformRetryAt || null,
    lastResult: state.lastResult || null,
    stopped: false,
    lastAssistantHash: state.lastAssistantHash || null,
    lastAction: state.lastAction || null,
    stateUpdatedAt: state.updatedAt || null,
    design: compactState(designState),
    lastLog: logs.at(-1) || null,
    recentLogs: logs.slice(-18)
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
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
  const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);
  try {
    if (req.method === "GET" && (url.pathname === "/status" || url.pathname === "/health")) return json(req, res, 200, status());
    if (req.method === "POST" && url.pathname === "/start") return json(req, res, 200, startWorker());
    if (req.method === "POST" && url.pathname === "/restart") return json(req, res, 200, await restartWorker());
    if (req.method === "POST" && url.pathname === "/stop") return json(req, res, 200, stopWorker());
    return json(req, res, 404, { ok: false, error: "not_found" });
  } catch (error) {
    log(`[CONTROL] ${error?.stack || error}`);
    return json(req, res, 500, { ok: false, error: String(error?.message || error) });
  }
});

server.listen(PORT, HOST, () => {
  log(`[CONTROL] DAVID bridge online at http://${HOST}:${PORT}`);
  setTimeout(() => startWorker(), 900);
});

process.on("SIGINT", () => { intentionalStop = true; stopWorker(); server.close(() => process.exit(0)); });
process.on("SIGTERM", () => { intentionalStop = true; stopWorker(); server.close(() => process.exit(0)); });
