import test from "node:test";
import assert from "node:assert/strict";
import { cleanChatUrl, normalizeTranscript, classifyTranscript, newRelayTurn, safeStatus } from "./voice-guardian.mjs";

test("only exact ChatGPT conversation links accepted", () => {
  assert.equal(cleanChatUrl("https://chatgpt.com/c/6ae76768-b7cc-83ed-8960-415469e2dacb"),
    "https://chatgpt.com/c/6ae76768-b7cc-83ed-8960-415469e2dacb");
  assert.throws(() => cleanChatUrl("https://not-chatgpt.com/c/6ae76768-b7cc-83ed-8960-415469e2dacb"));
});
test("normalizes Bulgarian dictation and requires unique ids", () => {
  assert.equal(normalizeTranscript("  Здравей   DAVID\n"), "Здравей DAVID");
  assert.equal(newRelayTurn({ id:"gemini_0001", text:"Здравей DAVID" }).state, "queued");
  assert.throws(() => newRelayTurn({ id:"bad", text:"Тест" }));
});
test("holds sensitive commands until guardian approval", () => {
  assert.equal(classifyTranscript("DAVID, изтрий базата").requiresApproval, true);
  assert.equal(classifyTranscript("DAVID, деплой сайта").requiresApproval, true);
  assert.equal(classifyTranscript("Как работи търг?").requiresApproval, false);
  assert.equal(newRelayTurn({ id:"gemini_0002", text:"DAVID, пауза" }).state, "pause");
});
test("status never reveals individual transcripts", () => {
  const state={ turns:[newRelayTurn({id:"gemini_0003",text:"Тайна дума"})] };
  const s=safeStatus(state,{primaryChatUrl:"https://chatgpt.com/c/6ae76768-b7cc-83ed-8960-415469e2dacb"});
  assert.equal(s.counts.queued,1);
  assert.ok(!JSON.stringify(s).includes("Тайна"));
});
