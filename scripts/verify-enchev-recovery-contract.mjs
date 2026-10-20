import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read = path => readFileSync(new URL("../"+path, import.meta.url),"utf8");
const route=read("app/api/enchev-auth/[action]/route.ts");
const server=read("app/lib/enchev-auth-server.ts");
const form=read("app/components/BuyerAuthForm.tsx");
const client=read("app/components/BuyerPasswordRecovery.tsx");
const page=read("app/reset-password/page.tsx");

// Source invariant gate — MUST be followed by two-account provider/browser tests.
assert.match(route,/sameOriginPost\(request\)/);
assert.match(route,/const config=authConfig\(\)/);
for(const action of ["request-reset","verify-recovery","set-new-password"]){
  assert.ok(route.includes('action==="'+action+'"'),"Missing recovery action "+action);
}
assert.match(route,/\/auth\/v1\/recover\?redirect_to=/);
assert.match(route,/\/auth\/v1\/user","PUT",token,\{password\}/);
assert.match(route,/clearResetCookie\(response\)/);
assert.match(route,/clearAuthCookies\(response\)/);
assert.match(server,/RESET_NAME/);
assert.match(server,/httpOnly: true/);
assert.match(server,/sameSite: "strict"/);
assert.match(server,/maxAge: 600/);
assert.match(server,/ENCHEV_AUTH_ENABLED/);
assert.match(server,/expectedRef === SHARED_GOVERNANCE_REF/);
assert.match(server,/value\.type !== "recovery"/);
assert.match(server,/method:"GET"\|"POST"\|"PUT"/);
assert.match(client,/window\.history\.replaceState/);
assert.match(client,/params\.get\("token_type"\)!=="bearer"/);
assert.match(client,/credentials:"same-origin"/);
assert.doesNotMatch(client,/localStorage|sessionStorage/);
assert.match(form,/href="\/reset-password"/);
assert.match(page,/index:false/);

console.log("ENCHEV P0 recovery source gate PASS (not provider/browser certification).");
