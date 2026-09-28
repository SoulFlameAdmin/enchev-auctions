import fs from "node:fs";

const endpoint = "https://frhletkiuupgksmgxoxc.supabase.co/functions/v1/enchev-plan-state";
const audience = "enchev-plan-state";
const MAX_BATCH_BODY_CHARS = 60000;
const verifiedSource = fs.readFileSync("app/components/VerifiedPlanEvidenceSync.tsx", "utf8");

function extractVerifiedRows(source) {
  const marker = "const VERIFIED_WAVE_0";
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) throw new Error("VERIFIED_WAVE_0 not found");
  const open = source.indexOf("{", markerIndex);
  const close = source.indexOf("\n};", open);
  if (open < 0 || close < 0) throw new Error("VERIFIED_WAVE_0 block malformed");
  const block = source.slice(open + 1, close);
  const rows = [];
  const seen = new Set();
  const linePattern = /^\s*"([^"]+)":\s*"((?:[^"\\]|\\.)*)",?\s*$/gm;
  for (const match of block.matchAll(linePattern)) {
    const taskId = match[1];
    const evidence = JSON.parse(`"${match[2]}"`);
    if (seen.has(taskId)) throw new Error(`Duplicate verified task ${taskId}`);
    if (!evidence.trim()) throw new Error(`Missing evidence for ${taskId}`);
    seen.add(taskId);
    rows.push({ taskId, status: "green", evidence, blocker: null });
  }
  if (!rows.length) throw new Error("No verified plan rows extracted");
  return rows;
}

function buildBatches(rows, maxBodyChars = MAX_BATCH_BODY_CHARS) {
  const batches = [];
  let current = [];

  for (const row of rows) {
    const candidate = [...current, row];
    if (JSON.stringify({ rows: candidate }).length <= maxBodyChars) {
      current = candidate;
      continue;
    }

    if (!current.length) {
      throw new Error(`Single cloud plan row exceeds batch limit: ${row.taskId}`);
    }

    batches.push(current);
    current = [row];

    if (JSON.stringify({ rows: current }).length > maxBodyChars) {
      throw new Error(`Single cloud plan row exceeds batch limit: ${row.taskId}`);
    }
  }

  if (current.length) batches.push(current);
  return batches;
}

async function getOidcToken() {
  const requestUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const requestToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if (!requestUrl || !requestToken) throw new Error("GitHub OIDC environment unavailable");
  const url = new URL(requestUrl);
  url.searchParams.set("audience", audience);
  const response = await fetch(url, { headers: { Authorization: `bearer ${requestToken}` } });
  if (!response.ok) throw new Error(`OIDC token request failed: HTTP ${response.status}`);
  const body = await response.json();
  if (!body.value) throw new Error("OIDC token response missing value");
  return body.value;
}

async function writeBatch(token, batch, index, total) {
  const write = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ rows: batch }),
  });
  const writeText = await write.text();
  if (!write.ok) {
    throw new Error(`Cloud plan write failed for batch ${index}/${total}: HTTP ${write.status} ${writeText.slice(0, 300)}`);
  }
}

const rows = extractVerifiedRows(verifiedSource);
const batches = buildBatches(rows);
const token = await getOidcToken();

for (let index = 0; index < batches.length; index += 1) {
  await writeBatch(token, batches[index], index + 1, batches.length);
}

const read = await fetch(endpoint, { headers: { "Cache-Control": "no-cache" } });
if (!read.ok) throw new Error(`Cloud plan read-back failed: HTTP ${read.status}`);
const body = await read.json();
const cloudRows = new Map((body.rows || []).map(row => [row.task_id, row]));
const expectedCommit = process.env.GITHUB_SHA;
for (const row of rows) {
  const cloud = cloudRows.get(row.taskId);
  if (!cloud) throw new Error(`Cloud read-back missing ${row.taskId}`);
  if (cloud.status !== row.status || cloud.evidence !== row.evidence) throw new Error(`Cloud read-back mismatch for ${row.taskId}`);
  if (expectedCommit && cloud.source_commit !== expectedCommit) throw new Error(`Cloud source commit mismatch for ${row.taskId}`);
}

console.log(`CLOUD_PLAN_STATE_SYNC PASS rows=${rows.length} batches=${batches.length} commit=${expectedCommit || "unknown"}`);
