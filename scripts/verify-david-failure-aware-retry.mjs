import assert from "node:assert/strict";
import { failureSignature, decideRetryAction, buildReplanContext } from "../src/david/failure-aware-retry.mjs";

const base={status:"failed",error:"CDP timeout: Input.insertText",current_stage:"teacher",attempt:1};
assert.ok(failureSignature(base).includes("cdp timeout"));

let d=decideRetryAction(base,[]);
assert.equal(d.action,"retry");

d=decideRetryAction({...base,attempt:2},[base]);
assert.equal(d.action,"replan");
assert.equal(d.reason,"repeated_failure_signature");

d=decideRetryAction({...base,attempt:4},[base,base],{maxTotalAttempts:4});
assert.equal(d.action,"escalate");

d=decideRetryAction({...base,risk_level:"high"},[]);
assert.equal(d.action,"escalate");

const ctx=buildReplanContext({...base,attempt:2},[base,base]);
assert.ok(ctx.avoid.length>=1);

console.log("PASS david failure-aware retry v1");
