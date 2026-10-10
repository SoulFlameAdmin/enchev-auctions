import assert from "node:assert/strict";

/* P0 auth isolation smoke test. Runs against an unconfigured preview build.
 * DOES NOT connect to any Supabase project or attempt real registrations.
 */
const base=process.env.BASE_URL||"http://127.0.0.1:3000";
const session=await fetch(base+"/api/enchev-auth/session",{cache:"no-store"});
assert.equal(session.status,200);
const state=await session.json();
assert.equal(state.available,false,"Credentials must fail closed in CI");
assert.equal(state.authenticated,false);
assert.equal(session.headers.get("cache-control")?.includes("no-store"),true);

for(const route of ["/api/enchev-auth/sign-in","/api/enchev-auth/sign-up","/api/enchev-auth/sign-out"]){
  const rejected=await fetch(base+route,{method:"POST",headers:{
    "Content-Type":"application/json","Origin":"https://untrusted.invalid"},
    body:JSON.stringify({email:"buyer@example.test",password:"this-is-not-a-password"}),
  });
  assert.equal(rejected.status,403,route+" must reject cross-origin POST");
  const off=await fetch(base+route,{method:"POST",headers:{
    "Content-Type":"application/json","Origin":base},
    body:JSON.stringify({email:"buyer@example.test",password:"this-is-not-a-password"}),
  });
  assert.equal(off.status,503,route+" must remain disabled absent isolated project config");
}
console.log("AUTH_OFF_GATE PASS: provider disabled, no real signups, no CSRF POSTs, no cached session");
