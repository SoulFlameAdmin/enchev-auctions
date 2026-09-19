// DAVID SESSION RESILIENCE V1: deterministic classifier and recovery policy for managed ChatGPT sessions.
import process from "node:process";

export const SESSION_ISSUE = Object.freeze({
  NONE: "none",
  RATE_LIMIT: "rate-limit",
  SEND_TIMEOUT: "send-timeout",
  INTERRUPTION: "interruption",
  RETRYABLE_ERROR: "retryable-error",
  NETWORK_OFFLINE: "network-offline",
  MODEL_UNAVAILABLE: "model-unavailable",
  SERVICE_UNAVAILABLE: "service-unavailable",
  CONVERSATION_UNAVAILABLE: "conversation-unavailable",
  CONVERSATION_LIMIT: "conversation-limit",
  AUTH_REQUIRED: "auth-required",
  HUMAN_REQUIRED: "human-required"
});

export const SESSION_ACTION = Object.freeze({
  WAIT: "wait",
  RATE_LIMIT_COORDINATOR: "rate-limit-coordinator",
  CLICK_RETRY: "click-retry",
  REFRESH_VERIFY: "refresh-verify",
  ROTATE_CHAT: "rotate-chat",
  WAIT_BACKOFF: "wait-backoff",
  HUMAN_REQUIRED: "human-required"
});

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

const patterns = [
  {
    issue: SESSION_ISSUE.HUMAN_REQUIRED,
    re: /(captcha|verify you are human|confirm you are human|потвърдете, че сте човек|проверка, че сте човек|security challenge|challenge required|mfa|2fa|two[- ]factor|verification code|код за потвърждение)/i
  },
  {
    issue: SESSION_ISSUE.AUTH_REQUIRED,
    re: /(^|\b)(log in|login|sign in|sign-in|authentication required|session expired|влезте|вход|сесията изтече)(\b|$)/i
  },
  {
    issue: SESSION_ISSUE.RATE_LIMIT,
    re: /(too many requests|requests too quickly|rate limit|please wait a few minutes|you(?:'ve| have) reached (?:your )?(?:usage )?limit|достигнахте лимита|твърде много заявки|правите заявки прекалено бързо|изчакайте няколко минути)/i
  },
  {
    issue: SESSION_ISSUE.SEND_TIMEOUT,
    re: /(message sending timed out|sending the message timed out|message send timed out|sending timed out|изпращането на съобщението изтече по време|съобщението не можа да бъде изпратено навреме)/i
  },
  {
    issue: SESSION_ISSUE.INTERRUPTION,
    re: /(connection (?:was )?interrupted|waiting for (?:the )?full response|връзката беше прекъсната|изчакване на пълния отговор)/i
  },
  {
    issue: SESSION_ISSUE.CONVERSATION_LIMIT,
    re: /(maximum conversation length|conversation (?:is )?too long|conversation limit|reached the maximum.*conversation|start a new chat to continue|разговорът е твърде дълъг|лимит.*разговор|започнете нов чат)/i
  },
  {
    issue: SESSION_ISSUE.CONVERSATION_UNAVAILABLE,
    re: /(unable to load conversation|failed to load conversation|conversation not found|conversation unavailable|could not load conversation|неуспешно зареждане на разговора|разговорът не е намерен|разговорът не е наличен)/i
  },
  {
    issue: SESSION_ISSUE.MODEL_UNAVAILABLE,
    re: /(model .* unavailable|model is unavailable|model not available|selected model.*unavailable|моделът .* недостъпен|моделът не е наличен)/i
  },
  {
    issue: SESSION_ISSUE.SERVICE_UNAVAILABLE,
    re: /(service unavailable|temporarily unavailable|internal server error|server error|upstream error|bad gateway|gateway timeout|услугата не е достъпна|временно недостъпна|сървърна грешка)/i
  },
  {
    issue: SESSION_ISSUE.NETWORK_OFFLINE,
    re: /(you are offline|you're offline|no internet|network offline|network error|connection failed|няма интернет|няма мрежова връзка|мрежова грешка)/i
  },
  {
    issue: SESSION_ISSUE.RETRYABLE_ERROR,
    re: /(something went wrong|please try again|try again|retry|error generating (?:a )?response|there was an error generating (?:a )?response|failed to generate|възникна грешка|нещо се обърка|моля, опитайте отново|опитайте отново)/i
  }
];

export function classifyPlatformText(text) {
  const normalized = clean(text);
  if (!normalized) return { issue: SESSION_ISSUE.NONE, text: "" };
  for (const item of patterns) {
    if (item.re.test(normalized)) return { issue: item.issue, text: normalized };
  }
  return { issue: SESSION_ISSUE.NONE, text: normalized };
}

export function chooseRecoveryAction({
  issue,
  active = false,
  progressed = false,
  retryVisible = false,
  retryAttempt = 0,
  maxRetryAttempts = 3,
  confirmed = false
} = {}) {
  if (!issue || issue === SESSION_ISSUE.NONE) return SESSION_ACTION.WAIT;
  if (active || progressed) return SESSION_ACTION.WAIT;

  switch (issue) {
    case SESSION_ISSUE.HUMAN_REQUIRED:
    case SESSION_ISSUE.AUTH_REQUIRED:
      return SESSION_ACTION.HUMAN_REQUIRED;
    case SESSION_ISSUE.RATE_LIMIT:
      return SESSION_ACTION.RATE_LIMIT_COORDINATOR;
    case SESSION_ISSUE.CONVERSATION_LIMIT:
    case SESSION_ISSUE.CONVERSATION_UNAVAILABLE:
      return confirmed ? SESSION_ACTION.ROTATE_CHAT : SESSION_ACTION.WAIT;
    case SESSION_ISSUE.MODEL_UNAVAILABLE:
    case SESSION_ISSUE.SERVICE_UNAVAILABLE:
    case SESSION_ISSUE.NETWORK_OFFLINE:
      return retryVisible && retryAttempt < maxRetryAttempts
        ? SESSION_ACTION.CLICK_RETRY
        : SESSION_ACTION.WAIT_BACKOFF;
    case SESSION_ISSUE.SEND_TIMEOUT:
    case SESSION_ISSUE.RETRYABLE_ERROR:
      if (retryVisible && retryAttempt < maxRetryAttempts) return SESSION_ACTION.CLICK_RETRY;
      return confirmed ? SESSION_ACTION.REFRESH_VERIFY : SESSION_ACTION.WAIT;
    case SESSION_ISSUE.INTERRUPTION:
      return confirmed ? SESSION_ACTION.REFRESH_VERIFY : SESSION_ACTION.WAIT;
    default:
      return SESSION_ACTION.WAIT;
  }
}

export function issueRequiresHuman(issue) {
  return issue === SESSION_ISSUE.HUMAN_REQUIRED || issue === SESSION_ISSUE.AUTH_REQUIRED;
}

export function issueNeedsFreshChat(issue) {
  return issue === SESSION_ISSUE.CONVERSATION_LIMIT || issue === SESSION_ISSUE.CONVERSATION_UNAVAILABLE;
}

export function isRetryableIssue(issue) {
  return new Set([
    SESSION_ISSUE.SEND_TIMEOUT,
    SESSION_ISSUE.INTERRUPTION,
    SESSION_ISSUE.RETRYABLE_ERROR,
    SESSION_ISSUE.NETWORK_OFFLINE,
    SESSION_ISSUE.MODEL_UNAVAILABLE,
    SESSION_ISSUE.SERVICE_UNAVAILABLE
  ]).has(issue);
}

function assert(condition, message) {
  if (!condition) throw new Error("chatgpt-session-resilience self-test: " + message);
}

export function selfTest() {
  const cases = [
    ["Изпращането на съобщението изтече по време. Моля, опитайте отново.", SESSION_ISSUE.SEND_TIMEOUT],
    ["Връзката беше прекъсната. Изчакване на пълния отговор", SESSION_ISSUE.INTERRUPTION],
    ["Too many requests. Please wait a few minutes.", SESSION_ISSUE.RATE_LIMIT],
    ["Something went wrong. Try again.", SESSION_ISSUE.RETRYABLE_ERROR],
    ["Unable to load conversation", SESSION_ISSUE.CONVERSATION_UNAVAILABLE],
    ["Maximum conversation length reached. Start a new chat to continue.", SESSION_ISSUE.CONVERSATION_LIMIT],
    ["Model is unavailable", SESSION_ISSUE.MODEL_UNAVAILABLE],
    ["Service unavailable", SESSION_ISSUE.SERVICE_UNAVAILABLE],
    ["You are offline", SESSION_ISSUE.NETWORK_OFFLINE],
    ["Verify you are human", SESSION_ISSUE.HUMAN_REQUIRED],
    ["Session expired. Log in", SESSION_ISSUE.AUTH_REQUIRED]
  ];
  for (const [text, expected] of cases) {
    assert(classifyPlatformText(text).issue === expected, `expected ${expected} for ${text}`);
  }

  assert(
    chooseRecoveryAction({ issue: SESSION_ISSUE.SEND_TIMEOUT, active: true, retryVisible: true, confirmed: true }) === SESSION_ACTION.WAIT,
    "active work must always wait"
  );
  assert(
    chooseRecoveryAction({ issue: SESSION_ISSUE.SEND_TIMEOUT, retryVisible: true, retryAttempt: 0 }) === SESSION_ACTION.CLICK_RETRY,
    "send timeout should prefer Retry"
  );
  assert(
    chooseRecoveryAction({ issue: SESSION_ISSUE.INTERRUPTION, confirmed: true }) === SESSION_ACTION.REFRESH_VERIFY,
    "confirmed interruption should refresh+verify"
  );
  assert(
    chooseRecoveryAction({ issue: SESSION_ISSUE.RATE_LIMIT, confirmed: true }) === SESSION_ACTION.RATE_LIMIT_COORDINATOR,
    "rate limit must use global coordinator"
  );
  assert(
    chooseRecoveryAction({ issue: SESSION_ISSUE.CONVERSATION_UNAVAILABLE, confirmed: true }) === SESSION_ACTION.ROTATE_CHAT,
    "unavailable conversation should request fresh chat"
  );
  assert(
    chooseRecoveryAction({ issue: SESSION_ISSUE.HUMAN_REQUIRED, confirmed: true }) === SESSION_ACTION.HUMAN_REQUIRED,
    "human gate must never be bypassed"
  );
  return true;
}

if (process.argv.includes("--self-test")) {
  selfTest();
  console.log("DAVID_CHATGPT_SESSION_RESILIENCE_SELF_TEST PASS issues=11 active_wait=1 retry=1 interruption=1 rate_limit=1 rotate=1 human_gate=1");
}
