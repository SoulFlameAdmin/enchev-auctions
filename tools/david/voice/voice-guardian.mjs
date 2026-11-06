// Pure, conservative validation. This module has no shell/browser execution rights.
export const MAX_TRANSCRIPT = 3000;
export const CHAT_URL_RE = /^https:\/\/chatgpt\.com\/c\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function cleanChatUrl(url) {
  const value = String(url || "").trim().replace(/[?#].*$/, "").replace(/\/$/, "");
  if (!CHAT_URL_RE.test(value)) throw new Error("Invalid ChatGPT conversation URL");
  return value;
}

export function normalizeTranscript(value) {
  if (typeof value !== "string") throw new Error("Transcript must be text");
  const text = value.normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ").trim();
  if (!text || text.length > MAX_TRANSCRIPT) throw new Error("Invalid transcript length");
  return text;
}

export function classifyTranscript(value) {
  const text = normalizeTranscript(value);
  // False positives are acceptable: sensitive requests must wait for a second human approval.
  if (/^(?:(?:давид|дейвид|девид|david)[\s,]*)?(?:пауза|спри слушането|спри гласа|pause|stop listening)[.!?]*$/i.test(text)) {
    return { intent: "pause", requiresApproval: false };
  }
  const risky = /(?:изтри|изтрий|премахни|унищожи|форматирай|изключи защит|парол|api[ -]?key|токен|secret|deploy|deployment|деплой|публикувай|плати|плащан|преведи пари|купи|продай|подпиши|rollback|restart|рестарт|delete|remove|wipe|purchase|transfer funds|execute shell|powershell|cmd\.exe|sudo|rm -rf|mfa|captcha)/i.test(text);
  return { intent: risky ? "approval_required" : "conversation", requiresApproval: risky };
}

export function newRelayTurn({ id, text, source = "gemini-relay" }) {
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{8,90}$/.test(id)) {
    throw new Error("Relay ID must be unique and use 8-90 safe characters");
  }
  if (source !== "gemini-relay") throw new Error("Untrusted transcript source");
  const transcript = normalizeTranscript(text);
  const policy = classifyTranscript(transcript);
  return {
    id, text: transcript, source,
    state: policy.requiresApproval ? "held" : policy.intent === "pause" ? "pause" : "queued",
    intent: policy.intent, createdAt: new Date().toISOString()
  };
}

export function safeStatus(state, config, live = false, armed = false) {
  const turns = Array.isArray(state.turns) ? state.turns : [];
  const counts = {};
  for (const t of turns) counts[t.state] = (counts[t.state] || 0) + 1;
  return {
    service: "DAVID_VOICE", mode: live ? "live" : "dry-run",
    armed: Boolean(armed), primaryChatUrl: config.primaryChatUrl,
    counts, totalTurns: turns.length,
    lastError: state.lastError || null,
    updatedAt: state.updatedAt || null,
    rolloverRequired: Boolean(state.rolloverRequired)
  };
}
