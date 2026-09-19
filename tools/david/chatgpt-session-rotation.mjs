const CHATGPT_ROOT = "https://chatgpt.com/";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function isChatGptRoot(url) {
  const normalized = String(url || "").replace(/\/+$/, "");
  return normalized === "https://chatgpt.com";
}

export function isChatGptAuthUrl(url) {
  const value = String(url || "");
  return value.includes("/auth/") || value.includes("/login");
}

export async function rotateOwnedChatPage({
  page,
  getComposer,
  setPageTag,
  pendingTag,
  managedTag,
  readyTimeoutMs = 120000,
  pollMs = 750,
  retryBackoffMs = 3000,
  onWait = null
}) {
  if (!page || page.isClosed()) {
    return { ok: false, reason: "page-missing", page };
  }

  await setPageTag(page, pendingTag);

  let attempt = 0;
  while (!page.isClosed()) {
    attempt += 1;
    let url = "";
    try { url = page.url(); } catch {}

    if (isChatGptAuthUrl(url)) {
      if (typeof onWait === "function") {
        await onWait({ phase: "auth-wait", attempt, url }).catch(() => {});
      }
      await sleep(retryBackoffMs);
      continue;
    }

    if (!isChatGptRoot(url)) {
      if (typeof onWait === "function") {
        await onWait({ phase: "navigate-new-chat", attempt, url }).catch(() => {});
      }
      await page.goto(CHATGPT_ROOT, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
    }

    const deadline = Date.now() + readyTimeoutMs;
    while (Date.now() < deadline && !page.isClosed()) {
      let currentUrl = "";
      try { currentUrl = page.url(); } catch {}

      if (isChatGptAuthUrl(currentUrl)) break;
      if (!String(currentUrl).startsWith("https://chatgpt.com")) break;

      let composer = null;
      try { composer = await getComposer(page); } catch {}
      if (composer) {
        await setPageTag(page, managedTag);
        return { ok: true, reason: "ready", page, attempt, url: currentUrl };
      }
      await sleep(pollMs);
    }

    if (page.isClosed()) {
      return { ok: false, reason: "page-closed", page, attempt };
    }

    if (typeof onWait === "function") {
      let currentUrl = "";
      try { currentUrl = page.url(); } catch {}
      await onWait({ phase: "new-chat-not-ready", attempt, url: currentUrl }).catch(() => {});
    }

    await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
    await sleep(retryBackoffMs);
  }

  return { ok: false, reason: "page-closed", page, attempt };
}

export { CHATGPT_ROOT };
